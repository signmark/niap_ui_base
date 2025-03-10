import axios from 'axios';
import { useAuthStore } from './store';

export const DIRECTUS_URL = 'https://directus.nplanner.ru';

// Create an instance of axios for Directus API
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
      throw new Error('Нет прав доступа к данному ресурсу');
    }

    // Handle 401 error (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
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

        // Retry original request
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
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