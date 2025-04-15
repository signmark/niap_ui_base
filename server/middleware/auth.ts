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
        // Добавляем токен в запрос для использования в дальнейших обработчиках
        req.user = {
            id: 'authenticated-user', // Заглушка для ID
            token: token
        };
        
        return next();
    } catch (error) {
        log(`Authentication error: ${(error as Error).message}`, 'auth-middleware');
        return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized: Invalid token' 
        });
    }
}