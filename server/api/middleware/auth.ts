import { Request, Response, NextFunction } from 'express';
import { log } from '../../utils/logger';

/**
 * Список публичных путей, для которых не требуется аутентификация
 */
export const openPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/me',
  '/api/auth/check',
  '/api/auth/logout',
  '/login',
  '/register',
  '/auth'
];

/**
 * Middleware для аутентификации API-запросов
 * Проверяет токен в заголовке и передает userId в запрос
 */
export const authenticateApiRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Пропускаем проверку для не-API маршрутов
    if (!req.path.startsWith('/api') || openPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Получаем токен из заголовка
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      log(`Аутентификация отклонена для ${req.path} - нет заголовка Authorization`, 'auth');
      return res.status(401).json({
        success: false,
        message: 'Необходимо авторизоваться'
      });
    }
    
    // Извлекаем токен
    const token = authHeader.replace('Bearer ', '');
    log(`API Auth: Обработка запроса ${req.path} с токеном длиной ${token.length}`, 'auth');
    
    try {
      // Извлекаем ID пользователя из заголовка (если есть)
      const userId = req.headers['x-user-id'] as string || null;
      
      log(`API Auth [${req.path}]: Token length=${token.length}, UserId=${userId || 'не указан'}`, 'auth');
      
      if (userId) {
        // Добавляем информацию о пользователе в запрос
        (req as any).userId = userId;
        (req as any).token = token;
        
        log(`Аутентификация успешна для ${req.path} - пользователь ${userId}`, 'auth');
        
        // Прямой доступ без запроса к Directus API
        return next();
      }
      
      // Если ID пользователя не указан в заголовке, пытаемся получить через Directus API
      const userResponse = await fetch('https://dev-directus-nplanner.nplanner.ru/users/me', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!userResponse.ok) {
        log(`Аутентификация отклонена для ${req.path} - ошибка API Directus: ${userResponse.status}`, 'auth');
        return res.status(401).json({
          success: false,
          message: 'Требуется авторизация. Пожалуйста, войдите снова.'
        });
      }
      
      const userData = await userResponse.json();
      
      if (!userData?.data?.id) {
        log(`Аутентификация отклонена для ${req.path} - нет данных пользователя`, 'auth');
        return res.status(401).json({
          success: false,
          message: 'Требуется авторизация. Пользователь не найден.'
        });
      }
      
      // Добавляем информацию о пользователе в запрос
      (req as any).userId = userData.data.id;
      (req as any).token = token;
      log(`Аутентификация успешна для ${req.path} - пользователь ${userData.data.id}`, 'auth');
      
      next();
    } catch (error) {
      console.error(`Ошибка аутентификации для ${req.path}:`, error);
      return res.status(401).json({
        success: false,
        message: 'Ошибка авторизации. Пожалуйста, попробуйте войти снова.'
      });
    }
  } catch (error) {
    console.error('Глобальная ошибка в middleware аутентификации:', error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};