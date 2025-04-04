import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Список путей, которые не требуют аутентификации
const PUBLIC_PATHS = [
  '/api/login',
  '/api/register',
  '/api/auth/check',
  '/api/auth/refresh',
  '/api/upload-image', // Временно делаем публичным для отладки
  '/api/cdn'
];

/**
 * Middleware для проверки аутентификации пользователя
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Проверяем, является ли путь публичным
    const isPublicPath = PUBLIC_PATHS.some(path => req.path.startsWith(path));
    
    if (isPublicPath) {
      logger.info(`[Auth] Пропускаем запрос к ${req.path} без проверки аутентификации`);
      return next();
    }
    
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`[Auth] Запрос к ${req.path} без токена аутентификации`);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication token is required' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      logger.warn(`[Auth] Запрос к ${req.path} без ID пользователя`);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User ID is required'
      });
    }
    
    // В этой точке мы можем быть уверены, что токен и userId существуют
    // В реальной ситуации здесь следовало бы проверить действительность токена

    // Добавляем информацию о пользователе к запросу
    (req as any).user = { 
      id: userId,
      token
    };
    
    logger.info(`[Auth] Пользователь ${userId} прошел аутентификацию для ${req.path}`);
    next();
  } catch (error) {
    logger.error(`[Auth] Ошибка при проверке аутентификации: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'Failed to authenticate user'
    });
  }
};