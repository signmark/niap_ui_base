/**
 * Универсальный метод для выполнения запросов к API
 * с автоматическим добавлением токена авторизации
 */
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  // Добавляем токен авторизации, если он есть
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
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