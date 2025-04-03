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

/**
 * Загружает одно изображение на сервер
 * @param file Файл изображения для загрузки
 * @returns Информация о загруженном файле, включая URL
 */
export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file); // Используем 'file' как имя поля, такое же как на сервере
  
  // Проверяем наличие токена авторизации
  const token = localStorage.getItem('auth_token');
  console.log('uploadImage: Наличие токена авторизации:', !!token);
  if (!token) {
    throw new Error('Не найден токен авторизации. Пожалуйста, войдите в систему снова.');
  }

  try {
    console.log('uploadImage: Отправка файла на /api/upload через fetch, размер:', file.size, 'тип:', file.type);
    
    // Используем fetch вместо axios, так как это может обойти некоторые проблемы с сетью
    const url = `${api.defaults.baseURL}/upload`;
    console.log(`uploadImage: URL запроса: ${url}`);
    
    // Fetch не устанавливает автоматически Content-Type для FormData, позволяя браузеру установить правильный заголовок с boundary
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (textError) {
      console.error('Не удалось получить текст ответа:', textError);
    }
    
    if (!response.ok) {
      console.error(`Ошибка сервера: ${response.status} ${response.statusText}`, responseText);
      throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
    }
    
    // Проверяем, не вернулся ли HTML вместо JSON
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      console.error('Получен HTML вместо JSON:', responseText.substring(0, 200) + '...');
      throw new Error('Сервер вернул HTML вместо JSON. Возможно, проблема с авторизацией или маршрутизацией.');
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('Ошибка парсинга JSON:', jsonError, 'Ответ сервера:', responseText.substring(0, 200) + '...');
      throw new Error('Некорректный формат ответа от сервера');
    }
    
    console.log('uploadImage: Ответ сервера:', data);
    return data;
  } catch (error: any) {
    console.error('Ошибка при загрузке через универсальный маршрут, пробуем резервный:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    
    // Если не удалось - пробуем старый маршрут для обратной совместимости
    try {
      console.log('uploadImage: Пробуем резервный маршрут /api/upload-image через fetch');
      const backupFormData = new FormData();
      backupFormData.append('image', file);
      
      const backupResponse = await fetch(`${api.defaults.baseURL}/upload-image`, {
        method: 'POST',
        body: backupFormData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      let backupResponseText = '';
      try {
        backupResponseText = await backupResponse.text();
      } catch (textError) {
        console.error('Не удалось получить текст ответа резервного маршрута:', textError);
      }
      
      if (!backupResponse.ok) {
        console.error(`Ошибка резервного сервера: ${backupResponse.status} ${backupResponse.statusText}`, backupResponseText);
        throw new Error(`Ошибка резервного сервера: ${backupResponse.status} ${backupResponse.statusText}`);
      }
      
      // Проверяем, не вернулся ли HTML вместо JSON
      if (backupResponseText.trim().startsWith('<!DOCTYPE') || backupResponseText.trim().startsWith('<html')) {
        console.error('Получен HTML вместо JSON (резервный маршрут):', backupResponseText.substring(0, 200) + '...');
        throw new Error('Сервер вернул HTML вместо JSON. Возможно, проблема с авторизацией или маршрутизацией.');
      }
      
      let backupData;
      try {
        backupData = JSON.parse(backupResponseText);
      } catch (jsonError) {
        console.error('Ошибка парсинга JSON (резервный маршрут):', jsonError, 'Ответ сервера:', backupResponseText.substring(0, 200) + '...');
        throw new Error('Некорректный формат ответа от сервера при использовании резервного маршрута');
      }
      console.log('uploadImage: Ответ резервного сервера:', backupData);
      return backupData;
    } catch (fallbackError: any) {
      console.error('Ошибка при загрузке изображения через резервный маршрут:', fallbackError);
      console.error('Детали ошибки резервного маршрута:', {
        message: fallbackError.message,
        name: fallbackError.name,
        stack: fallbackError.stack,
      });
      
      // Если все методы загрузки не работают, возвращаем информативную ошибку
      throw new Error(`Не удалось загрузить изображение. Ошибка: ${fallbackError.message}. Directus сервис файлов недоступен. Пожалуйста, попробуйте позже или используйте внешнюю ссылку.`);
    }
  }
};

/**
 * Загружает несколько изображений на сервер
 * @param files Массив файлов для загрузки
 * @returns Информация о загруженных файлах, включая URL
 */
export const uploadMultipleImages = async (files: File[]) => {
  const formData = new FormData();
  
  // Проверяем наличие токена авторизации
  const token = localStorage.getItem('auth_token');
  console.log('uploadMultipleImages: Наличие токена авторизации:', !!token);
  if (!token) {
    throw new Error('Не найден токен авторизации. Пожалуйста, войдите в систему снова.');
  }
  
  files.forEach(file => {
    formData.append('images', file); // Должно совпадать с именем в upload.array('images', 10) на сервере
    console.log(`Добавлен файл: ${file.name}, размер: ${file.size}, тип: ${file.type}`);
  });

  try {
    console.log(`uploadMultipleImages: Отправка ${files.length} файлов на сервер...`);
    
    // Используем fetch вместо axios, так как с ним могут быть проблемы
    const url = `${api.defaults.baseURL}/upload-multiple-images`;
    console.log(`uploadMultipleImages: URL запроса: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`
        // Не указываем Content-Type, fetch автоматически установит правильный с boundary для FormData
      }
    });
    
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (textError) {
      console.error('Не удалось получить текст ответа:', textError);
    }
    
    if (!response.ok) {
      console.error(`Ошибка сервера: ${response.status} ${response.statusText}`, responseText);
      throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
    }
    
    // Проверяем, не вернулся ли HTML вместо JSON
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      console.error('Получен HTML вместо JSON:', responseText.substring(0, 200) + '...');
      throw new Error('Сервер вернул HTML вместо JSON. Возможно, проблема с авторизацией или маршрутизацией.');
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('Ошибка парсинга JSON:', jsonError, 'Ответ сервера:', responseText.substring(0, 200) + '...');
      throw new Error('Некорректный формат ответа от сервера');
    }
    console.log('uploadMultipleImages: Ответ сервера:', data);
    return data;
  } catch (error: any) {
    console.error('Ошибка при загрузке изображений:', error);
    
    // Максимально детальное логирование ошибки
    console.error('Детали ошибки:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    
    throw error;
  }
};

export default api;