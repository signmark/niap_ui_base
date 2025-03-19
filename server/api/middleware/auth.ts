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
    // Пропускаем проверку для не-API маршрутов и открытых путей
    if (!req.path.startsWith('/api') || openPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // ВАЖНО: Для обеспечения обратной совместимости проверяем заголовки и query параметры
    
    // Получаем токен из заголовка
    const authHeader = req.headers['authorization'];
    const queryToken = req.query.token as string;
    const token = authHeader ? authHeader.replace('Bearer ', '') : queryToken || '';
    
    // Извлекаем ID пользователя из заголовка или query
    const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
    
    if (!token && !userId) {
      log(`[api] Ошибка: Отсутствуют данные аутентификации в запросе ${req.path}`);
      return res.status(401).json({
        success: false,
        message: 'Необходимо авторизоваться'
      });
    }
    
    // Добавляем информацию о пользователе в запрос
    if (userId) {
      (req as any).userId = userId;
    }
    
    if (token) {
      (req as any).token = token;
    }
    
    // Для запросов запланированных публикаций добавляем доп.информацию в логи
    if (req.path.includes('/api/publish/scheduled') && userId) {
      log(`[api] Запрос запланированных публикаций для пользователя ${userId}`);
    }
    
    next();
    
  } catch (error) {
    log(`Ошибка middleware аутентификации: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`, 'auth');
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера при проверке аутентификации'
    });
  }
};