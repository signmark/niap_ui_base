/**
 * Промежуточное ПО для аутентификации
 */
import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';
import { directusCrud } from '../services/directus-crud';
import { directusApi } from '../directus';

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

/**
 * Middleware для проверки аутентификации пользователя
 * Устанавливает userId в request если токен действительный
 */
export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    try {
        // Проверяем заголовок авторизации
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
                error: 'Неверный формат токена авторизации'
            });
        }

        // Проверяем токен, запрашивая данные пользователя
        try {
            const userData = await directusCrud.getCurrentUser({ authToken: token });
            if (!userData || !userData.id) {
                return res.status(401).json({
                    success: false,
                    error: 'Недействительный токен авторизации'
                });
            }

            // Добавляем ID пользователя в запрос
            (req as any).userId = userData.id;
            (req as any).userEmail = userData.email;
            
            // Если эндпоинт требует проверки на SMM-администратора, 
            // проверим это и установим флаг в запросе
            (req as any).isSmmAdmin = userData.is_smm_admin === true;

            next();
        } catch (error) {
            console.error('Ошибка при проверке токена:', error);
            return res.status(401).json({
                success: false,
                error: 'Ошибка при проверке авторизации'
            });
        }
    } catch (error) {
        console.error('Ошибка в middleware аутентификации:', error);
        return res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при проверке авторизации'
        });
    }
}

/**
 * Middleware для проверки прав SMM-администратора
 * Должен использоваться после middleware isAuthenticated
 */
export async function isSmmAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        // Проверяем, установлен ли флаг isSmmAdmin в предыдущем middleware
        if ((req as any).isSmmAdmin === true) {
            // Пользователь является SMM-администратором
            return next();
        }

        // Если флаг не установлен или false, то проверим напрямую через Directus API
        const userId = (req as any).userId;
        const authHeader = req.headers['authorization'];
        
        if (!userId || !authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Необходима авторизация'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        try {
            // Запрашиваем информацию о пользователе, чтобы проверить флаг is_smm_admin
            const userData = await directusCrud.getCurrentUser({ authToken: token });
            
            if (!userData) {
                return res.status(401).json({
                    success: false,
                    error: 'Не удалось получить информацию о пользователе'
                });
            }

            // Проверяем флаг is_smm_admin
            if (userData.is_smm_admin === true) {
                // Пользователь является SMM-администратором
                (req as any).isSmmAdmin = true;
                return next();
            }

            // Если нет прав SMM-администратора, возвращаем ошибку доступа
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав для доступа к этому ресурсу. Требуются права SMM-администратора.'
            });
        } catch (error) {
            console.error('Ошибка при проверке прав SMM-администратора:', error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка сервера при проверке прав доступа'
            });
        }
    } catch (error) {
        console.error('Ошибка в middleware проверки SMM-администратора:', error);
        return res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при проверке прав доступа'
        });
    }
}