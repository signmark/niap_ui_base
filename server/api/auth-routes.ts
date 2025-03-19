import { Router, Request, Response } from 'express';
import { log } from '../utils/logger';
import { directusApi } from '../directus';

/**
 * Регистрирует маршруты для авторизации
 * @param app Express Router
 */
export function registerAuthRoutes(app: any): void {
  log('Регистрация маршрутов авторизации...', 'auth-routes');

  // Маршрут для проверки статуса авторизации
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    
    console.log(`QueryClient [/api/auth/me]: Token length: ${token.length}, User ID: ${userId || 'none'}`);
    
    if (!token) {
      return res.json({ 
        authenticated: false,
        userId: null,
        message: 'No token provided'
      });
    }
    
    try {
      // Если токен есть, и есть ID пользователя в заголовке, считаем авторизованным
      if (userId) {
        return res.json({
          authenticated: true,
          userId: userId,
          message: 'Authenticated via header'
        });
      }
      
      // Иначе проверяем токен через Directus API
      const response = await fetch('https://dev-directus-nplanner.nplanner.ru/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        return res.json({
          authenticated: false,
          message: 'Invalid token'
        });
      }
      
      const userData = await response.json();
      
      if (!userData?.data?.id) {
        return res.json({
          authenticated: false,
          message: 'User not found'
        });
      }
      
      return res.json({
        authenticated: true,
        userId: userData.data.id,
        message: 'Authenticated via Directus'
      });
      
    } catch (error) {
      console.error('Auth check error:', error);
      return res.json({
        authenticated: false,
        message: 'Authentication error'
      });
    }
  });
  
  // Маршрут для входа в систему
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать email и пароль'
      });
    }
    
    try {
      const response = await directusApi.post('/auth/login', {
        email,
        password
      });
      
      return res.json(response.data);
    } catch (error: any) {
      console.error('Login error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Ошибка авторизации. Проверьте email и пароль'
      });
    }
  });
  
  // Маршрут для обновления токена
  app.post('/api/auth/refresh', async (req: Request, res: Response) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Необходим refresh_token'
      });
    }
    
    try {
      const response = await directusApi.post('/auth/refresh', {
        refresh_token
      });
      
      return res.json(response.data);
    } catch (error: any) {
      console.error('Token refresh error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Не удалось обновить токен'
      });
    }
  });
  
  // Маршрут для выхода из системы
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Выход выполнен успешно'
    });
  });
  
  log('Маршруты авторизации зарегистрированы', 'auth-routes');
}