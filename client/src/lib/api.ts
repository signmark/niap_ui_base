/**
 * Универсальный метод для выполнения запросов к API
 * с автоматическим добавлением токена авторизации
 */
export async function apiRequest(url: string, options: any = {}) {
  try {
    // Получаем токен из localStorage
    const token = localStorage.getItem('auth_token');

    // Добавляем заголовок Authorization, если есть токен
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// Вспомогательная функция для проверки авторизации
export function checkAuth() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Требуется авторизация');
  }
  return token;
}