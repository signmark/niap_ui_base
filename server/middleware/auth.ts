/**
 * Промежуточное ПО для аутентификации
 */
import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';
import { directusApi } from '../directus';

/**
 * Промежуточное ПО для проверки аутентификации запросов
 * @param req Express запрос
 * @param res Express ответ
 * @param next Функция для продолжения цепочки обработки запроса
 */
/**
 * Промежуточное ПО для проверки аутентификации пользователя
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    // Проверка наличия заголовка авторизации
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ 
            success: false, 
            error: 'Необходима авторизация' 
        });
    }
    
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'Недействительный формат токена' 
        });
    }
    
    // Проверяем токен через Directus API
    directusApi.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => {
        const userData = response.data.data;
        // Сохраняем информацию о пользователе в объекте запроса
        req.user = {
            id: userData.id,
            token: token,
            email: userData.email,
            firstName: userData.first_name,
            lastName: userData.last_name,
            is_smm_admin: userData.is_smm_admin || false
        };
        next();
    })
    .catch(error => {
        console.error('Authentication error:', error.message);
        return res.status(401).json({ 
            success: false, 
            error: 'Ошибка авторизации. Недействительный токен.' 
        });
    });
}

/**
 * Промежуточное ПО для проверки, является ли пользователь SMM админом
 */
export function isSmmAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ 
            success: false, 
            error: 'Необходима авторизация' 
        });
    }
    
    if (!req.user.is_smm_admin) {
        return res.status(403).json({ 
            success: false, 
            error: 'Отказано в доступе. Требуются права администратора SMM.' 
        });
    }
    
    next();
}

/**
 * Устаревшее промежуточное ПО для аутентификации запросов
 * @deprecated Используйте isAuthenticated вместо этого
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