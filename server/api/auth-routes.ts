/**
 * Маршруты для авторизации и управления токенами
 */

import { Request, Response, Express } from 'express';
import axios from 'axios';
import { directusApiManager } from '../directus';
import { log } from '../utils/logger';

/**
 * Регистрирует маршруты для авторизации
 * @param app Express приложение
 */
export function registerAuthRoutes(app: Express): void {
  // Маршрут для проверки валидности токена
  app.get('/api/auth/check', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Не авторизован',
        message: 'Требуется токен авторизации'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Пытаемся получить информацию о пользователе с этим токеном
      const userInfo = await directusApiManager.request({
        url: '/users/me',
        method: 'get'
      }, token);
      
      // Если успешно получили информацию, токен валидный
      if (userInfo && userInfo.data && userInfo.data.id) {
        return res.status(200).json({
          valid: true,
          user_id: userInfo.data.id
        });
      }
      
      // Если не смогли получить информацию, но не получили ошибку, токен невалидный
      return res.status(401).json({
        valid: false,
        message: 'Недействительный токен'
      });
    } catch (error: any) {
      // Ошибка при запросе, токен невалидный или сервер недоступен
      log(`Ошибка при проверке токена: ${error.message}`, 'auth');
      return res.status(401).json({
        valid: false,
        message: 'Недействительный токен или ошибка сервера'
      });
    }
  });
  
  // Маршрут для обновления токена через refresh token
  app.post('/api/auth/refresh', async (req: Request, res: Response) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        error: 'Отсутствует refresh_token'
      });
    }
    
    try {
      // Обновляем токен через Directus API
      const response = await axios.post(`${process.env.DIRECTUS_URL}/auth/refresh`, {
        refresh_token,
        mode: 'json'
      });
      
      if (response.data && response.data.data) {
        const { access_token, refresh_token, expires } = response.data.data;
        
        // Получаем информацию о пользователе
        const userInfo = await directusApiManager.request({
          url: '/users/me',
          method: 'get'
        }, access_token);
        
        const userId = userInfo?.data?.data?.id;
        
        if (userId) {
          // Кэшируем новый токен
          directusApiManager.cacheAuthToken(userId, access_token, expires || 3600);
          
          return res.status(200).json({
            token: access_token,
            refresh_token,
            user_id: userId,
            expires
          });
        }
      }
      
      return res.status(401).json({
        error: 'Не удалось обновить токен'
      });
    } catch (error: any) {
      log(`Ошибка при обновлении токена: ${error.message}`, 'auth');
      return res.status(500).json({
        error: 'Ошибка при обновлении токена',
        message: error.message
      });
    }
  });
  
  // Маршрут для прямой авторизации
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Отсутствуют учетные данные'
      });
    }
    
    try {
      // Авторизуемся через Directus API
      const response = await axios.post(`${process.env.DIRECTUS_URL}/auth/login`, {
        email,
        password,
        mode: 'json'
      });
      
      if (response.data && response.data.data) {
        const { access_token, refresh_token, expires } = response.data.data;
        
        // Получаем информацию о пользователе
        const userInfo = await directusApiManager.request({
          url: '/users/me',
          method: 'get'
        }, access_token);
        
        const userId = userInfo?.data?.data?.id;
        
        if (userId) {
          // Кэшируем токен
          directusApiManager.cacheAuthToken(userId, access_token, expires || 3600);
          
          return res.status(200).json({
            token: access_token,
            refresh_token,
            user_id: userId,
            expires
          });
        }
      }
      
      return res.status(401).json({
        error: 'Неверные учетные данные'
      });
    } catch (error: any) {
      log(`Ошибка при авторизации: ${error.message}`, 'auth');
      return res.status(500).json({
        error: 'Ошибка при авторизации',
        message: error.message
      });
    }
  });

  // Маршрут для получения информации о текущем пользователе
  app.get('/auth/me', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Не авторизован',
        message: 'Требуется токен авторизации'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Получаем информацию о пользователе по токену
      const userInfo = await directusApiManager.request({
        url: '/users/me',
        method: 'get'
      }, token);
      
      if (userInfo?.data?.data?.id) {
        const userData = userInfo.data.data;
        
        // Возвращаем только нужные поля пользователя
        return res.status(200).json({
          id: userData.id,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role
        });
      }
      
      return res.status(401).json({
        error: 'Недействительный токен'
      });
    } catch (error: any) {
      log(`Ошибка при получении данных пользователя: ${error.message}`, 'auth');
      return res.status(401).json({
        error: 'Не удалось получить информацию о пользователе',
        message: error.message
      });
    }
  });
}