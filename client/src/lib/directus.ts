import axios from 'axios';
import { useAuthStore } from './store';

export const DIRECTUS_URL = 'https://directus.nplanner.ru';

// Create an instance of axios for Directus API
export const directusApi = axios.create({
  baseURL: DIRECTUS_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*'
  }
});

// Add a request interceptor
directusApi.interceptors.request.use(
  (config) => {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {};
    }

    const token = localStorage.getItem('auth_token');
    if (token) {
      // Добавляем больше логирования
      console.log('Adding auth token to request:', {
        url: config.url,
        method: config.method,
        data: config.data,
        token: `Bearer ${token.substring(0, 10)}...`, // Log only part of the token for security
        headers: config.headers
      });

      // Set authorization header
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('No auth token found for request:', config.url);
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
      console.error('Permission denied:', {
        url: originalRequest.url,
        method: originalRequest.method,
        data: originalRequest.data,
        headers: {
          ...originalRequest.headers,
          Authorization: originalRequest.headers.Authorization ? 'Bearer [hidden]' : 'none'
        },
        response: error.response.data
      });
      throw new Error(error.response.data.errors?.[0]?.message || 'Нет прав доступа к данному ресурсу');
    }

    // Handle 401 error (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('Refresh token not found');
        }

        const response = await axios.post(`${DIRECTUS_URL}/auth/refresh`, {
          refresh_token: refreshToken,
          mode: 'json'
        });

        const { access_token, refresh_token } = response.data.data;

        // Update tokens
        localStorage.setItem('auth_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        // Update auth store
        const auth = useAuthStore.getState();
        auth.setAuth(access_token, auth.userId);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return directusApi(originalRequest);
      } catch (error) {
        // Clear auth on refresh failure
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