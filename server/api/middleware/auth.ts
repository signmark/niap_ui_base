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
      log(`[api] Ошибка: Отсутствует токен авторизации в запросе ${req.path}`);
      return res.status(401).json({
        success: false,
        message: 'Необходимо авторизоваться'
      });
    }
    
    // Извлекаем токен
    const token = authHeader.replace('Bearer ', '');
    
    // Извлекаем ID пользователя из заголовка (основной метод)
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      log(`[api] Ошибка: Отсутствует ID пользователя в запросе ${req.path}`);
      return res.status(401).json({
        success: false,
        message: 'Отсутствует ID пользователя'
      });
    }
    
    // Добавляем информацию о пользователе в запрос
    (req as any).userId = userId;
    (req as any).token = token;
    
    // Для запросов запланированных публикаций добавляем доп.информацию в логи
    if (req.path.includes('/api/publish/scheduled')) {
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