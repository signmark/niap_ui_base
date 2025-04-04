/**
 * Утилиты для работы с аутентификацией
 */

import { Request } from 'express';

/**
 * Извлекает токен авторизации из заголовка запроса
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