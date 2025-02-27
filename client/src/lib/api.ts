/**
 * Универсальный метод для выполнения запросов к API
 * с автоматическим добавлением токена авторизации
 */
export async function apiRequest(url: string, options: any = {}) {
  try {
    // Получаем токен из localStorage
    const token = localStorage.getItem('auth_token');

    if (!token) {
      console.warn('Токен авторизации не найден в localStorage');
    }

    // Добавляем заголовок Authorization, если есть токен
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
      ...(options.headers || {})
    };

    // Логируем запрос для отладки
    console.log(`API Request to ${url}:`, { headers });

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || 'API request failed';
      console.error(`API Response error (${response.status}):`, errorData);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// Вспомогательная функция для проверки авторизации
export function isAuthenticated() {
  return !!localStorage.getItem('auth_token');
}

// Вспомогательная функция для проверки авторизации
export function checkAuth() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Требуется авторизация');
  }
  return token;
}