/**
 * Вспомогательные функции для работы с администраторскими токенами Directus
 */

import axios from 'axios';

/**
 * Получает актуальный токен администратора с автоматическим обновлением при необходимости
 */
export async function getAdminToken(): Promise<string | null> {
  try {
    // Импортируем DirectusAuthManager динамически
    const { directusAuthManager } = await import('../services/directus-auth-manager');
    
    // Сначала проверяем, есть ли у нас уже активная сессия администратора
    const adminSessions = directusAuthManager.getAllActiveSessions();
    
    if (adminSessions.length > 0) {
      console.log('Использование кэшированного токена администратора');
      return adminSessions[0].token;
    }
    
    // Если нет, пробуем принудительно обновить сессию администратора
    console.log('Отсутствует сессия администратора, пробуем принудительно обновить');
    
    // Принудительно обновляем токен администратора
    await directusAuthManager.refreshSession();
    
    // Пробуем войти под администратором
    await directusAuthManager.loginAdmin();
    
    // Получаем обновленный токен
    const refreshedSessions = directusAuthManager.getAllActiveSessions();
    
    if (refreshedSessions.length > 0) {
      console.log('Успешно получен свежий токен администратора');
      return refreshedSessions[0].token;
    }
    
    // Если и это не помогло, пытаемся получить токен напрямую
    console.log('Все предыдущие попытки получения токена администратора не удались, пробуем напрямую');
    
    // Получаем e-mail и пароль администратора из переменных окружения
    const email = process.env.DIRECTUS_EMAIL;
    const password = process.env.DIRECTUS_PASSWORD;
    
    if (!email || !password) {
      console.error('Отсутствуют учетные данные администратора (DIRECTUS_EMAIL, DIRECTUS_PASSWORD)');
      return null;
    }
    
    // Пытаемся авторизоваться как администратор
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    const response = await axios.post(`${directusUrl}/auth/login`, {
      email,
      password
    });
    
    if (response?.data?.data?.access_token) {
      const token = response.data.data.access_token;
      console.log('Получен новый токен администратора через прямую авторизацию');
      return token;
    }
    
    return null;
  } catch (error) {
    console.error('Ошибка при получении токена администратора:', error);
    return null;
  }
}

/**
 * Получает контент Directus по ID с использованием токена администратора
 */
export async function getDirectusContentById(collectionName: string, id: string): Promise<any> {
  try {
    // Получаем токен администратора
    const adminToken = await getAdminToken();
    
    if (!adminToken) {
      console.error(`Не удалось получить токен администратора для запроса ${collectionName}/${id}`);
      return null;
    }
    
    // Создаем экземпляр axios с заголовком авторизации
    const directusApi = axios.create({
      baseURL: process.env.DIRECTUS_URL || 'https://directus.nplanner.ru',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    console.log(`Запрос данных коллекции ${collectionName} по ID ${id} с токеном администратора`);
    
    // Выполняем запрос
    const response = await directusApi.get(`/items/${collectionName}/${id}`);
    
    if (response?.data?.data) {
      console.log(`Успешно получены данные из коллекции ${collectionName} по ID ${id}`);
      return response.data.data;
    } else {
      console.warn(`Получен пустой ответ при запросе ${collectionName}/${id}`);
      return null;
    }
    
  } catch (error) {
    console.error(`Ошибка при получении данных из коллекции ${collectionName} по ID ${id}:`, error);
    return null;
  }
}