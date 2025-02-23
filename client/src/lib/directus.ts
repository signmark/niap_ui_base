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
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Directus API Request:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    });
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
directusApi.interceptors.response.use(
  (response) => {
    console.log('Directus API Response:', {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('Directus API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);