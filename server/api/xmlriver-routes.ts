/**
 * Маршруты для работы с XMLRiver API
 */

import { Request, Response, Express, NextFunction } from 'express';
import axios from 'axios';
import { xmlRiverClient } from '../services/xmlriver-client';
import { log } from '../utils/logger';

/**
 * Middleware для авторизации запросов
 */
const authenticateXmlRiverRequest = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Не авторизован',
      message: 'Требуется токен авторизации'
    });
  }
  
  // Извлекаем токен
  const token = authHeader.substring(7);
  
  try {
    // Получаем информацию о пользователе из Directus API
    const response = await axios.get('https://directus.nplanner.ru/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.data?.data?.id) {
      log('Invalid token: cannot get user info', 'xmlriver-auth');
      return res.status(401).json({ error: 'Не авторизован: Недействительный токен' });
    }

    // Устанавливаем информацию о пользователе в объект запроса
    const userId = response.data.data.id;
    
    log(`User authenticated: ${userId}`, 'xmlriver-auth');
    
    // Сохраняем информацию о пользователе в запросе
    (req as any).userId = userId;
    (req as any).token = token;
    
    next();
  } catch (error) {
    log(`Auth error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'xmlriver-auth');
    return res.status(401).json({ 
      error: 'Не авторизован: Ошибка проверки токена',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Регистрирует маршруты для работы с XMLRiver API
 * @param app Express приложение
 */
export function registerXmlRiverRoutes(app: Express): void {
  // Маршрут для получения ключевых слов напрямую из XMLRiver API
  app.get('/api/xmlriver/keywords/:query', authenticateXmlRiverRequest, async (req: Request, res: Response) => {
    try {
      const query = req.params.query;
      const userId = (req as any).userId;
      const token = (req as any).token;
      
      if (!query) {
        return res.status(400).json({
          error: 'Отсутствует поисковый запрос',
          message: 'Необходимо указать поисковый запрос'
        });
      }
      
      log(`Поиск ключевых слов в XMLRiver для запроса: ${query}`, 'xmlriver-api');
      
      const keywords = await xmlRiverClient.getKeywords(query, userId, token);
      
      if (keywords === null) {
        return res.status(400).json({
          error: 'Ошибка получения данных',
          message: 'Не удалось получить данные от XMLRiver API. Проверьте настройки API ключа.'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          keywords: keywords.map((item: any) => ({
            keyword: item.phrase,
            frequency: parseInt(item.number.replace(/\s/g, '')),
            competition: 0, // По умолчанию 0, так как XMLRiver не предоставляет данные о конкуренции
            source: 'xmlriver'
          }))
        }
      });
    } catch (error) {
      log(`Ошибка при запросе к XMLRiver API: ${error instanceof Error ? error.message : 'Unknown error'}`, 'xmlriver-api');
      
      return res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        message: 'Произошла ошибка при обработке запроса к XMLRiver API'
      });
    }
  });
}