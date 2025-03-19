import { Request, Response, NextFunction } from 'express';
import { directusApi } from '../../directus';

/**
 * Middleware для аутентификации пользователя
 * Извлекает токен из заголовка Authorization и устанавливает userId в объект запроса
 */
export async function authenticateApiRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Необходимо авторизоваться'
      });
    }
    
    // Извлекаем токен
    const token = authHeader.replace('Bearer ', '');
    
    // Получаем информацию о пользователе из токена
    try {
      const userResponse = await directusApi.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Устанавливаем userId в объект запроса
      (req as any).userId = userResponse?.data?.data?.id;
      (req as any).directusToken = token;
      
      if (!userResponse?.data?.data?.id) {
        console.error('Не удалось получить ID пользователя из токена');
        return res.status(401).json({
          success: false,
          message: 'Недействительный токен авторизации'
        });
      }
      
      // Продолжаем выполнение запроса
      next();
    } catch (error) {
      console.error('Ошибка при получении информации о пользователе по токену:', error);
      return res.status(401).json({
        success: false,
        message: 'Ошибка авторизации'
      });
    }
  } catch (error) {
    console.error('Ошибка в middleware аутентификации:', error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
}