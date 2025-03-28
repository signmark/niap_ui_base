import { Request, Response, NextFunction } from 'express';
import { directusApiManager } from '../directus';

// Расширяем интерфейс Request для включения пользователя
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        avatar?: string;
        name?: string;
        [key: string]: any;
      };
    }
  }
}

// Для отладки: переключатель для пропуска аутентификации
const DEBUG_SKIP_AUTH = true;
// ID пользователя по умолчанию для отладки
const DEBUG_USER_ID = "53921f16-f51d-4591-80b9-8caa4fde4d13";

/**
 * Middleware для аутентификации пользователя.
 * Проверяет наличие и валидность токена JWT в заголовке Authorization.
 * В случае успеха добавляет информацию о пользователе в объект req.user
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    // ВРЕМЕННОЕ РЕШЕНИЕ ДЛЯ ОТЛАДКИ: Пропускаем аутентификацию
    if (DEBUG_SKIP_AUTH) {
      console.log('[AUTH] ⚠️ ОТЛАДКА: Пропускаем аутентификацию, используем ID пользователя по умолчанию');
      req.user = {
        id: DEBUG_USER_ID,
        email: "debug@example.com",
        name: "Debug User",
        avatar: null
      };
      next();
      return;
    }
    
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No authorization header provided');
      return res.status(401).json({ error: 'Не авторизован: Отсутствует заголовок Authorization или неверный формат' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Проверяем токен через Directus API
    try {
      // Делаем запрос к /users/me, чтобы проверить токен и получить данные пользователя
      const response = await directusApiManager.instance.get('/users/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.status === 200 && response.data?.data) {
        const userData = response.data.data;
        
        // Добавляем информацию о пользователе в req.user
        req.user = {
          id: userData.id,
          email: userData.email,
          name: userData.first_name 
            ? `${userData.first_name} ${userData.last_name || ''}`.trim()
            : userData.email,
          avatar: userData.avatar
        };
        
        // Продолжаем выполнение запроса
        next();
      } else {
        console.error('Failed to verify token: unexpected response', response.status);
        return res.status(401).json({ error: 'Не авторизован: Не удалось подтвердить токен' });
      }
    } catch (error: any) {
      console.error('Error verifying token:', error.message);
      
      // Проверяем тип ошибки
      if (error.response?.status === 401) {
        return res.status(401).json({ error: 'Не авторизован: Неверный или просроченный токен' });
      } else {
        return res.status(500).json({ error: 'Внутренняя ошибка сервера при проверке токена' });
      }
    }
  } catch (error) {
    console.error('Unexpected error in auth middleware:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}