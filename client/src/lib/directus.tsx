import axios from 'axios';

// Создаем экземпляр axios с базовым URL без дублирующихся слешей
export const directusApi = axios.create({
  baseURL: 'https://directus.nplanner.ru', // Убрали trailing slash
});

// Вспомогательная функция для проверки и получения токена
export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

// Вспомогательная функция для проверки авторизации
export const isAuthenticated = () => {
  return !!getAuthToken();
};

// Добавляем функцию для получения заголовков авторизации
export const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};
