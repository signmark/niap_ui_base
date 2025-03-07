import { directusApi } from './directus';
import { useAuthStore } from './store';

interface AuthResponse {
  data: {
    access_token: string;
    refresh_token: string;
    expires: number;
  };
}

let refreshPromise: Promise<string> | null = null;
let refreshTimeout: NodeJS.Timeout | null = null;

export const refreshAccessToken = async (): Promise<string> => {
  if (typeof window === 'undefined') {
    throw new Error('This function should only be called in browser environment');
  }

  // Если уже идет обновление, вернем тот же промис
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    refreshPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('Attempting to refresh access token...');
        const response = await directusApi.post<AuthResponse>('/auth/refresh', {
          refresh_token: refreshToken,
          mode: 'json'
        });

        const { access_token, refresh_token, expires } = response.data.data;
        console.log(`Token refresh successful. New token expires in ${expires} ms`);

        // Сохраняем новые токены
        localStorage.setItem('auth_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        // Обновляем состояние в store
        const auth = useAuthStore.getState();
        auth.setAuth(access_token, auth.userId);

        // Планируем следующее обновление за 1 минуту до истечения
        setupTokenRefresh(expires);

        resolve(access_token);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // Если не удалось обновить токен, очищаем данные авторизации
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        const auth = useAuthStore.getState();
        auth.clearAuth();
        reject(error);
      }
    });

    return refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

export const setupTokenRefresh = (expires: number) => {
  if (typeof window === 'undefined') return;

  // Очищаем предыдущий таймер, если он был
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  console.log('Setting up token refresh. Token expires in:', expires, 'ms');

  // Устанавливаем обновление токена за 1 минуту до истечения
  const refreshIn = Math.max(expires - 60000, 1000); // Минимум 1 секунда
  console.log(`Scheduling initial token refresh in ${refreshIn} ms`);

  refreshTimeout = setTimeout(() => {
    refreshAccessToken().catch(error => {
      console.error('Failed to refresh token in scheduled refresh:', error);
    });
  }, refreshIn);
};

// Функция для начальной настройки при логине
export const setupInitialAuth = (expires: number) => {
  setupTokenRefresh(expires);

  // Добавляем обработчик для обновления токена при возвращении на вкладку
  window.addEventListener('focus', () => {
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      refreshAccessToken().catch(console.error);
    }
  });
};