/**
 * Маршруты для авторизации и управления токенами
 */

import { Request, Response, Express } from 'express';
import axios from 'axios';
import { directusApiManager } from '../directus';
import { log } from '../utils/logger';
import { initiateInstagramAuth, handleInstagramCallback, getInstagramSettings } from '../services/instagram-auth';

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
  
  // Маршрут для выхода из системы
  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({ 
        success: true,
        message: 'Сессия завершена'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Пытаемся сделать logout в Directus
      await directusApiManager.request({
        url: '/auth/logout',
        method: 'post'
      }, token);
      
      return res.status(200).json({
        success: true,
        message: 'Успешный выход из системы'
      });
    } catch (error) {
      // Даже если произошла ошибка при выходе из Directus, 
      // мы всё равно считаем операцию успешной с точки зрения клиента
      log(`Ошибка при выходе из системы: ${error instanceof Error ? error.message : 'Unknown error'}`, 'auth');
      return res.status(200).json({
        success: true,
        message: 'Сессия завершена'
      });
    }
  });

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
  app.get('/api/auth/me', async (req: Request, res: Response) => {
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
  
  // Маршруты для OAuth авторизации Instagram
  
  // Маршрут для инициирования OAuth авторизации Instagram
  app.get('/api/auth/instagram', async (req: Request, res: Response) => {
    // Проверяем авторизацию из Cookie, если не найдена - проверяем заголовок авторизации
    // Это необходимо, потому что при клике на кнопке браузер выполняет обычное GET-запрос без заголовков авторизации
    let userId = null;
    let token = null;
    
    // Сначала проверяем cookies
    if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
      try {
        // Пытаемся получить ID пользователя из токена в cookie
        const userInfo = await directusApiManager.request({
          url: '/users/me',
          method: 'get'
        }, token);
        
        if (userInfo?.data?.data?.id) {
          userId = userInfo.data.data.id;
        }
      } catch (error) {
        log(`Ошибка при получении пользователя из cookie токена: ${error instanceof Error ? error.message : 'Unknown error'}`, 'auth');
      }
    }
    
    // Если не удалось получить ID пользователя из cookie, пробуем заголовок авторизации
    if (!userId) {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Не авторизован',
          message: 'Требуется токен авторизации. Пожалуйста, войдите в систему.'
        });
      }
      
      token = authHeader.substring(7);
      
      try {
        // Получаем информацию о пользователе по токену
        const userInfo = await directusApiManager.request({
          url: '/users/me',
          method: 'get'
        }, token);
        
        if (userInfo?.data?.data?.id) {
          userId = userInfo.data.data.id;
        }
      } catch (error: any) {
        log(`Ошибка при получении пользователя из заголовка авторизации: ${error.message}`, 'auth');
      }
    }
    
    if (!userId) {
      return res.status(401).json({
        error: 'Недействительный токен',
        message: 'Не удалось определить пользователя. Пожалуйста, войдите в систему заново.'
      });
    }
    
    try {
      // Сохраняем идентификатор пользователя в объекте запроса
      req.user = {
        id: userId,
        token
      };
      
      // Инициируем авторизацию Instagram
      return initiateInstagramAuth(req, res);
    } catch (error: any) {
      log(`Ошибка при инициировании авторизации Instagram: ${error.message}`, 'auth');
      return res.status(500).json({
        error: 'Не удалось инициировать авторизацию Instagram',
        message: error.message
      });
    }
  });
  
  // Маршрут для обработки коллбека после авторизации Instagram
  app.get('/api/auth/instagram/callback', handleInstagramCallback);
  
  // Маршрут для получения настроек Instagram
  app.get('/api/auth/instagram/settings', async (req: Request, res: Response) => {
    // Проверяем авторизацию
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
        // Сохраняем идентификатор пользователя в объекте запроса
        req.user = {
          id: userInfo.data.data.id,
          token
        };
        
        // Получаем настройки Instagram
        return getInstagramSettings(req, res);
      }
      
      return res.status(401).json({
        error: 'Недействительный токен'
      });
    } catch (error: any) {
      log(`Ошибка при получении настроек Instagram: ${error.message}`, 'auth');
      return res.status(500).json({
        error: 'Не удалось получить настройки Instagram',
        message: error.message
      });
    }
  });
}