/**
 * Конфигурация API для разных окружений
 */

export function getApiBaseUrl(): string {
  // Если мы на продакшене smm.nplanner.ru, используем полный URL
  if (typeof window !== 'undefined' && window.location.hostname === 'smm.nplanner.ru') {
    return 'https://smm.nplanner.ru';
  }
  
  // Для локальной разработки используем относительные пути
  return '';
}

export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${endpoint}`;
}

// Экспортируем готовые URL для основных endpoint'ов
export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  ME: '/api/auth/me',
} as const;

export function getFullApiUrl(endpoint: keyof typeof API_ENDPOINTS): string {
  return getApiUrl(API_ENDPOINTS[endpoint]);
}