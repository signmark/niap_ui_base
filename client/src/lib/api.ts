import axios from 'axios';

// Create an instance of axios for Directus API
export const directusApi = axios.create({
  baseURL: 'https://directus.nplanner.ru',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*'
  }
});

// Добавляем интерцептор для включения токена в заголовок Authorization
directusApi.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Create a general API instance
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Добавляем интерцептор для включения токена в заголовок Authorization
api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  const userId = localStorage.getItem('user_id');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (userId) {
    config.headers['x-user-id'] = userId;
  }
  
  return config;
});

// При получении 401 ошибки, перенаправляем на страницу входа
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      console.log('Токен авторизации не найден или недействителен, перенаправляем на страницу входа');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_id');
      
      // Перенаправляем на страницу входа, если мы не уже на ней
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;