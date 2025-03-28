import { Request, Response, NextFunction } from 'express';

/**
 * Middleware для аутентификации пользователя
 * Проверяет наличие токена в заголовке и устанавливает userId в объект запроса
 */
export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      error: 'Unauthorized',
      message: 'Authentication token is required' 
    });
  }
  
  // Извлекаем токен
  const token = authHeader.substring(7);
  
  try {
    // В реальной реализации здесь должна быть проверка валидности токена
    // Для простоты демонстрации сейчас просто устанавливаем флаг авторизации
    
    // Получаем информацию о пользователе из токена (в реальности здесь должен быть decode JWT)
    // В данном случае просто извлекаем userId из запроса (которое должно быть установлено другим middleware)
    (req as any).userId = (req as any).user?.id || 'unknown-user';
    
    // Переходим к следующему middleware
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false,
      error: 'Unauthorized',
      message: 'Invalid authentication token' 
    });
  }
}