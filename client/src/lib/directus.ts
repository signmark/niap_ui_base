import axios from 'axios';

export const DIRECTUS_URL = 'https://directus.nplanner.ru';

export const directusApi = axios.create({
  baseURL: DIRECTUS_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Простой интерцептор для добавления токена
directusApi.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Простая обработка ошибок
directusApi.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.data?.errors) {
      throw new Error(error.response.data.errors[0].message);
    }
    throw error;
  }
);