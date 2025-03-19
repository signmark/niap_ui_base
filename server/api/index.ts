import { Router, Request, Response, NextFunction } from 'express';
import { registerCampaignRoutes } from './campaign-routes';
import { registerContentRoutes } from './content-routes';
import { registerWordStatRoutes } from './wordstat-routes';
import { registerPublishedRoutes } from './published-routes';
import { registerAuthRoutes } from './auth-routes';
import { log } from '../utils/logger';
import { authenticateApiRequest } from './middleware/auth';

/**
 * Middleware для глобальной аутентификации API
 * Проверяет наличие токена в заголовке и добавляет userId в запрос
 */
const globalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Для определенных маршрутов пропускаем проверку
    const openPaths = [
      '/api/auth/login', 
      '/api/auth/register', 
      '/api/auth/refresh', 
      '/api/auth/me',
      '/api/auth/check',
      '/api/auth/logout'
    ];
    
    if (openPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Получаем токен из заголовка
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      console.log(`Аутентификация отклонена для ${req.path} - нет заголовка Authorization`);
      return res.status(401).json({
        success: false,
        message: 'Необходимо авторизоваться'
      });
    }
    
    // Извлекаем токен
    const token = authHeader.replace('Bearer ', '');
    console.log(`API Auth: Обработка запроса ${req.path} с токеном длиной ${token.length}`);
    
    // Примечание: в целях отладки и быстрой разработки, 
    // мы временно пропускаем проверку токена через Directus и используем
    // пользовательский ID напрямую из заголовка
    try {
      const userId = req.headers['x-user-id'] as string || null;
      
      console.log(`API Auth [${req.path}]: Token length=${token.length}, UserId=${userId || 'не указан'}`);
      
      if (userId) {
        // Добавляем информацию о пользователе в запрос
        (req as any).userId = userId;
        (req as any).directusToken = token;
        
        console.log(`Аутентификация успешна для ${req.path} - пользователь ${userId}`);
        
        // Прямой доступ без запроса к Directus
        return next();
      }
      
      // Если ID пользователя не указан в заголовке, пытаемся получить через Directus API
      const userResponse = await fetch('https://directus.nplanner.ru/users/me', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!userResponse.ok) {
        console.log(`Аутентификация отклонена для ${req.path} - ошибка API Directus: ${userResponse.status}`);
        return res.status(401).json({
          success: false,
          message: 'Требуется авторизация. Пожалуйста, войдите снова.'
        });
      }
      
      const userData = await userResponse.json();
      
      if (!userData?.data?.id) {
        console.log(`Аутентификация отклонена для ${req.path} - нет данных пользователя`);
        return res.status(401).json({
          success: false,
          message: 'Требуется авторизация. Пользователь не найден.'
        });
      }
      
      // Добавляем информацию о пользователе в запрос
      (req as any).userId = userData.data.id;
      (req as any).directusToken = token;
      console.log(`Аутентификация успешна для ${req.path} - пользователь ${userData.data.id}`);
      
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

export function registerAPIRoutes(app: Router) {
  log('Starting route registration...', 'api');
  
  // Применяем глобальный middleware аутентификации для всех API маршрутов
  app.use('/api', globalAuthMiddleware);
  
  // Регистрируем все API маршруты
  registerAuthRoutes(app); // Важно зарегистрировать маршруты аутентификации
  registerCampaignRoutes(app);
  registerContentRoutes(app);
  registerWordStatRoutes(app);
  registerPublishedRoutes(app);
  
  log('Route registration completed', 'api');
}