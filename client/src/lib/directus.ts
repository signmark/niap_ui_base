import axios from 'axios';
import { useAuthStore } from './store';

// Динамическое получение URL Directus с сервера
let directusUrl = import.meta.env.VITE_DIRECTUS_URL;

// Функция для получения конфигурации с сервера
async function getServerConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    return config.directusUrl;
  } catch (error) {
    console.warn('Failed to get server config, using default:', error);
    return directusUrl;
  }
}

// Обновляем URL при загрузке
getServerConfig().then(url => {
  if (url && url !== directusUrl) {
    directusUrl = url;
    directusApi.defaults.baseURL = url;
    console.log('Updated Directus URL to:', url);
  }
});

export const DIRECTUS_URL = directusUrl;

export const directusApi = axios.create({
  baseURL: directusUrl,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor to handle auth token
directusApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
directusApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If we get a 401 error and have a refresh token, try to refresh the access token
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${DIRECTUS_URL}/auth/refresh`, {
            refresh_token: refreshToken,
            mode: 'json'
          });

          const { access_token } = response.data.data;
          localStorage.setItem('auth_token', access_token);

          // Update auth store
          const auth = useAuthStore.getState();
          auth.setAuth(access_token, auth.userId);

          // Retry original request
          const originalRequest = error.config;
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
          return axios(originalRequest);
        } catch (refreshError) {
          // If refresh fails, clear auth and throw error
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          const auth = useAuthStore.getState();
          auth.clearAuth();
          throw new Error('Session expired. Please log in again.');
        }
      }
    }

    // For other errors, throw with meaningful message
    const message = error.response?.data?.errors?.[0]?.message || 
                   error.response?.data?.error?.message ||
                   error.message ||
                   'An error occurred';
    throw new Error(message);
  }
);