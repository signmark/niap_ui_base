import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware для проверки аутентификации.
 * В этой реализации, поскольку мы не используем полную аутентификацию,
 * мы просто пропускаем запрос дальше, но в реальном приложении 
 * здесь должна быть проверка токена и получение пользователя.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    // В этой версии мы просто разрешаем все запросы
    // В реальном приложении здесь должна быть проверка токена
    logger.info(`[Auth] Пропускаем запрос к ${req.originalUrl} без проверки аутентификации`);
    next();
  } catch (error) {
    logger.error(`[Auth] Ошибка аутентификации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    res.status(401).json({
      success: false,
      error: 'Требуется аутентификация',
    });
  }
};