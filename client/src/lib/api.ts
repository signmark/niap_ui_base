import axios from 'axios';
import { refreshAccessToken } from './auth';

// Create an instance of axios for Directus API
export const directusApi = axios.create({
  baseURL: 'https://directus.nplanner.ru',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*'
  }
});

// Флаг для отслеживания выполнения обновления токена
let isRefreshing = false;
// Очередь запросов, ожидающих обновления токена
let refreshQueue: Array<(token: string) => void> = [];

// Функция для обработки очереди запросов после обновления токена
const processQueue = (error: any, token: string | null = null) => {
  refreshQueue.forEach(callback => {
    if (error) {
      callback(error);
    } else if (token) {
      callback(token);
    }
  });
  refreshQueue = [];
};

// Добавляем интерцептор для включения токена в заголовок Authorization
directusApi.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Добавляем интерцептор обработки ответов для автоматического обновления токена
directusApi.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // Проверяем, что ошибка связана с истечением срока действия токена
    // и запрос не является попыткой обновить токен
    if (error.response && error.response.status === 401 && 
        !originalRequest._retry && 
        !originalRequest.url.includes('/auth/refresh')) {
      
      originalRequest._retry = true;
      
      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          // Пытаемся обновить токен
          const newToken = await refreshAccessToken();
          
          // Обновление успешно, обрабатываем очередь запросов
          isRefreshing = false;
          processQueue(null, newToken);
          
          // Обновляем заголовок для текущего запроса
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return directusApi(originalRequest);
        } catch (refreshError) {
          // Не удалось обновить токен, отклоняем все запросы
          isRefreshing = false;
          processQueue(refreshError);
          
          // Очищаем данные авторизации и перенаправляем на страницу входа
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_id');
          
          if (window.location.pathname !== '/auth/login') {
            window.location.href = '/auth/login';
          }
          
          return Promise.reject(refreshError);
        }
      } else {
        // Добавляем запрос в очередь ожидания
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (typeof token === 'string') {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(directusApi(originalRequest));
            } else {
              reject(token);
            }
          });
        });
      }
    }
    
    return Promise.reject(error);
  }
);

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

// При получении 401 ошибки, пытаемся обновить токен
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Пытаемся обновить токен
        const newToken = await refreshAccessToken();
        
        // Обновление успешно, обновляем заголовок для текущего запроса
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.log('Не удалось обновить токен авторизации, перенаправляем на страницу входа');
        
        // Очищаем данные авторизации
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_id');
        
        // Перенаправляем на страницу входа, если мы не уже на ней
        if (window.location.pathname !== '/auth/login') {
          window.location.href = '/auth/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;