import { directusApi } from './directus';
import { useAuthStore } from './store';

interface AuthResponse {
  data: {
    access_token: string;
    refresh_token: string;
    expires: number;
    user: {
      id: string;
    };
  };
}

let refreshTimeout: NodeJS.Timeout | null = null;

/**
 * Настраивает автоматическое обновление токена доступа перед его истечением
 * @param expires Время до истечения токена в миллисекундах или секундах
 */
export const setupTokenRefresh = (expires: number) => {
  if (typeof window === 'undefined') return;

  // Очищаем существующий таймер
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  // Конвертируем в миллисекунды, если указано в секундах
  let expiresMs = expires;
  if (expires < 10000) { // Если меньше 10 секунд, скорее всего это секунды
    console.log('Значение expires в секундах, конвертируем в миллисекунды');
    expiresMs = expires * 1000;
  }

  // Планируем обновление на 80% от времени жизни токена
  const refreshIn = Math.max(Math.floor(expiresMs * 0.8), 1000); // Минимум 1 секунда
  
  console.log(`Токен истечет через ${expiresMs/1000} секунд, обновление запланировано через ${refreshIn/1000} секунд`);
  
  refreshTimeout = setTimeout(() => {
    console.log('Запущено обновление токена по расписанию');
    refreshAccessToken().catch(error => {
      console.error('Ошибка при плановом обновлении токена:', error);
    });
  }, refreshIn);
};

/**
 * Обновляет токен доступа с использованием refresh_token
 * @returns Промис с новым токеном доступа
 */
export const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  const userId = localStorage.getItem('user_id');
  
  if (!refreshToken) {
    console.error('Невозможно обновить токен: отсутствует refresh_token');
    throw new Error('No refresh token available');
  }

  try {
    console.log('Начинаем обновление токена');
    
    // Используем только локальный API endpoint для обновления токена
    console.log('Используем локальный API для обновления токена');
    const apiResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',  // Предотвращаем кэширование
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ 
        refresh_token: refreshToken,
        user_id: userId 
      })
    });
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`Ошибка обновления токена: ${apiResponse.status}`, errorText);
      throw new Error(`Ошибка обновления токена: ${apiResponse.statusText}`);
    }
    
    const data = await apiResponse.json();
    
    // Проверяем успешность ответа и наличие токена
    if (!data.success || !data.token) {
      console.error('Неверный формат ответа при обновлении токена:', data);
      throw new Error('Неверный формат ответа при обновлении токена');
    }
    
    console.log('Токен успешно обновлен через API');
    
    // Обновляем токены в localStorage
    localStorage.setItem('auth_token', data.token);
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    
    // Обновляем store
    const authStore = useAuthStore.getState();
    authStore.setAuth(data.token, userId);
    
    // Настраиваем следующее обновление
    const expires = data.expires_at || 900000; // 15 минут по умолчанию
    setupTokenRefresh(expires);
    
    console.log('Токен успешно обновлен, длина нового токена:', data.token.length);
    
    return data.token;
  } catch (error) {
    console.error('Ошибка при обновлении токена доступа:', error);
    
    // Очищаем токены при ошибке
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    
    // Очищаем store
    const authStore = useAuthStore.getState();
    authStore.clearAuth();
    
    throw error;
  }
};

/**
 * Выполняет вход через Directus API
 * @param email Email пользователя
 * @param password Пароль пользователя
 * @returns Промис с токеном и данными пользователя
 */
export const loginWithDirectus = async (email: string, password: string) => {
  try {
    // Используем локальный API вместо прямого запроса к Directus
    console.log('Выполняем вход через локальный API');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ошибка входа:', errorText);
      throw new Error(`Ошибка входа: ${response.statusText}`);
    }
    
    const authData = await response.json();
    
    if (!authData.token) {
      throw new Error('Неверный формат ответа от сервера');
    }
    
    const access_token = authData.token;
    const refresh_token = authData.refresh_token;
    const expires = authData.expires || 900000;
    const userId = authData.user.id;
    
    // Сохраняем токены и ID пользователя
    localStorage.setItem('auth_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user_id', userId);
    
    // Обновляем store
    const authStore = useAuthStore.getState();
    authStore.setAuth(access_token, userId);
    
    // Настраиваем обновление токена
    setupTokenRefresh(expires);
    
    return { access_token, user: authData.user };
  } catch (error: any) {
    console.error('Ошибка входа:', error);
    throw new Error(error.message || 'Ошибка при входе в систему');
  }
};

/**
 * Выполняет выход из системы
 */
export const logout = async () => {
  try {
    // Очищаем таймер обновления
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    
    // Пробуем выполнить выход через API
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      console.log('Выход через API выполнен успешно');
    } catch (error) {
      console.warn('Ошибка при выходе через API:', error);
    }
    
    // Очищаем токены из localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('is_admin');
    
    // Очищаем store
    const authStore = useAuthStore.getState();
    authStore.clearAuth();
    
    console.log('Выход выполнен, данные аутентификации очищены');
  } catch (error) {
    console.error('Ошибка при выходе:', error);
    throw error;
  }
};

/**
 * Получает текущий токен аутентификации из localStorage
 * Используется для API запросов, требующих авторизации
 * @returns Promise<string> Токен доступа
 */
export const getToken = async (): Promise<string> => {
  const token = localStorage.getItem('auth_token');
  
  // Если токен отсутствует, попробуем обновить его
  if (!token) {
    try {
      return await refreshAccessToken();
    } catch (error) {
      console.error('Не удалось получить токен аутентификации:', error);
      throw new Error('Токен аутентификации недоступен');
    }
  }
  
  return token;
};