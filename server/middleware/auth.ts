/**
 * Промежуточное ПО для аутентификации
 */
import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

/**
 * Промежуточное ПО для проверки аутентификации запросов
 * @param req Express запрос
 * @param res Express ответ
 * @param next Функция для продолжения цепочки обработки запроса
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    // Если есть объект пользователя в запросе, значит пользователь аутентифицирован
    if (req.user) {
        return next();
    }

    // Проверяем заголовок авторизации
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized: No authorization token provided' 
        });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized: Invalid token format' 
        });
    }

    try {
        // Проверяем что токен не пустой
        if (!token || token.trim() === '' || token === 'undefined' || token === 'null') {
            console.log('[DEV] [auth-middleware] Empty or invalid token:', token);
            return res.status(401).json({ 
                success: false, 
                error: 'Unauthorized: Empty token' 
            });
        }

        // Декодируем JWT токен для получения реального user ID
        const base64Payload = token.split('.')[1];
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
        
        req.user = {
            id: payload.id || 'authenticated-user',
            token: token
        };
        
        console.log('[DEV] [auth-middleware] User authenticated:', req.user.id);
        return next();
    } catch (error) {
        log(`Authentication error: ${(error as Error).message}`, 'auth-middleware');
        return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized: Invalid token' 
        });
    }
}