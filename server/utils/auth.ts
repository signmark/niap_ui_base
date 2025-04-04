import { Request } from 'express';

/**
 * Извлекает токен авторизации из заголовка Authorization или из cookie
 * 
 * @param req Express запрос
 * @returns Токен авторизации или null, если не найден
 */
export function getAuthTokenFromRequest(req: Request): string | null {
  // Извлечение токена из заголовка Authorization
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Удаляем 'Bearer ' из начала
  }
  
  // Извлечение токена из cookie, если он не найден в заголовке
  const authToken = req.cookies?.authToken;
  if (authToken) {
    return authToken;
  }
  
  // Извлечение токена из параметра запроса, если он не найден в заголовке или cookie
  const tokenParam = req.query.token;
  if (tokenParam && typeof tokenParam === 'string') {
    return tokenParam;
  }
  
  // Проверка наличия временного токена в заголовках (для совместимости)
  const tempToken = req.headers['x-auth-token'];
  if (tempToken && typeof tempToken === 'string') {
    return tempToken;
  }
  
  // Если ничего не найдено, возвращаем null
  return null;
}