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
      throw new Error(error.response.data.errors?.[0]?.message || 'Нет прав доступа');
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
          refresh_token: refreshToken,
          mode: 'json'
        });

        const { access_token, refresh_token } = response.data.data;
        localStorage.setItem('auth_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        console.log('Token refresh successful, retrying original request');

        // Повторяем исходный запрос с новым токеном
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        return directusApi(originalRequest);
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // Если не удалось обновить токен, очищаем данные авторизации
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        const auth = useAuthStore.getState();
        auth.clearAuth();
        throw error;
      }
    }

    return Promise.reject(error);
  }
);