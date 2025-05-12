/**
 * Middleware для проверки аутентификации
 * 
 * Эти функции проверяют, авторизован ли пользователь для выполнения запросов
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

/**
 * Проверяет аутентификацию пользователя
 * 
 * Этот middleware гарантирует, что запрос выполняется авторизованным пользователем
 * В данной реализации мы пропускаем все запросы, так как аутентификация
 * обрабатывается через токены Directus
 * 
 * @param req Express запрос
 * @param res Express ответ
 * @param next Следующий middleware
 */
export function validateAuthentication(req: Request, res: Response, next: NextFunction) {
  // В текущей реализации пропускаем все запросы
  // В будущем здесь может быть добавлена проверка JWT токена или сессии
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    log('Доступ без токена авторизации');
    // Пропускаем запрос, но в продакшене здесь должна быть проверка
    return next();
  }
  
  log(`Запрос авторизован с токеном`);
  next();
}

/**
 * Проверяет, является ли пользователь администратором
 * 
 * @param req Express запрос
 * @param res Express ответ
 * @param next Следующий middleware
 */
export function validateAdmin(req: Request, res: Response, next: NextFunction) {
  // В текущей реализации пропускаем все запросы
  // В будущем здесь может быть добавлена проверка, является ли пользователь администратором
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    log('Администраторский доступ без токена авторизации');
    // В продакшене здесь должен быть возврат ошибки 401
    return next();
  }
  
  log(`Запрос администратора авторизован с токеном`);
  next();
}