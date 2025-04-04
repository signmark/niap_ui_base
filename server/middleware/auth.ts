/**
 * Middleware для аутентификации запросов
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';

/**
 * Middleware для аутентификации по токену
 * @param req Express запрос
 * @param res Express ответ
 * @param next Функция следующего middleware
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      log(`[auth] Запрос без токена авторизации: ${req.path}`);
      return res.status(401).json({ 
        success: false, 
        error: 'Не авторизован: Отсутствует заголовок авторизации' 
      });
    }
    
    // Сохраняем токен в request для использования в других middleware или обработчиках
    (req as any).token = token;
    
    next();
  } catch (error: any) {
    log(`[auth] Ошибка аутентификации: ${error.message}`);
    return res.status(403).json({ 
      success: false, 
      error: 'Доступ запрещен: Ошибка проверки токена' 
    });
  }
}

/**
 * Помощник для извлечения токена авторизации из запроса
 * @param req Express запрос
 * @returns Токен авторизации или null, если токен отсутствует
 */
export function getAuthTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}