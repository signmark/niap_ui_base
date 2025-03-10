import axios from 'axios';
import { useAuthStore } from './store';

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
    // Получаем токен из localStorage напрямую
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
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

    if (error.response?.status === 403) {
      console.error('Permission denied:', error.response.data);
      return Promise.reject(new Error(error.response.data.errors?.[0]?.message || 'Нет прав доступа'));
    }

    // Если ошибка 401 и это не запрос на обновление токена
    if (error.response?.status === 401 && !originalRequest._retry && 
        !originalRequest.url?.includes('/auth/refresh')) {
      originalRequest._retry = true;

      try {
        console.log('Token expired, attempting to refresh...');
        const refreshToken = localStorage.getItem('refresh_token');

        if (!refreshToken) {
          throw new Error('No refresh token found');
        }

        // Пробуем обновить токен
        const response = await axios.post(`${DIRECTUS_URL}/auth/refresh`, {
          refresh_token: refreshToken
        });

        const newToken = response.data.data.access_token;
        localStorage.setItem('auth_token', newToken);

        console.log('Token refresh successful, retrying original request');

        // Повторяем исходный запрос с новым токеном
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return directusApi(originalRequest);
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        // Если не удалось обновить токен, очищаем авторизацию
        useAuthStore.getState().clearAuth();
        if (window.location.pathname !== '/auth/login') {
          window.location.href = '/auth/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);