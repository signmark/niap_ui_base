import axios from 'axios';
import { useAuthStore } from './store';
import { refreshAccessToken } from './auth';

export const DIRECTUS_URL = 'https://directus.nplanner.ru';

export const directusApi = axios.create({
  baseURL: DIRECTUS_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor
directusApi.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor
directusApi.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Если ошибка 401 и это не запрос на обновление токена
    if (error.response?.status === 401 && !originalRequest._retry && 
        !originalRequest.url?.includes('/auth/refresh') &&
        typeof window !== 'undefined') {
      originalRequest._retry = true;

      try {
        console.log('Token expired, attempting to refresh...');
        // Пробуем обновить токен
        const newToken = await refreshAccessToken();
        console.log('Token refresh successful, retrying original request');

        // Повторяем исходный запрос с новым токеном
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return directusApi(originalRequest);
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        // Если не удалось обновить токен, очищаем авторизацию
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
    }

    return Promise.reject(error);
  }
);