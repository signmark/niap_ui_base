/**
 * Маршруты для работы с XMLRiver API
 */

import { Request, Response, Express, NextFunction } from 'express';
import axios from 'axios';
import { xmlRiverClient } from '../services/xmlriver-client';
import { log } from '../utils/logger';
import { ApiServiceName, apiKeyService } from '../services/api-keys';


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
    // Используем наш собственный API для проверки токена
    // Получаем хост из запроса для правильного формирования URL
    const protocol = req.protocol;
    const host = req.get('host');
    const meUrl = `${protocol}://${host}/api/auth/me`;
    
    const response = await axios.get(meUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.data?.user?.id) {
      log('Invalid token: cannot get user info', 'xmlriver-auth');
      return res.status(401).json({ error: 'Не авторизован: Недействительный токен' });
    }

    // Устанавливаем информацию о пользователе в объект запроса
    const userId = response.data.user.id;
    
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
  // Маршрут для сохранения XML River API ключа
  app.post('/api/xmlriver/save-key', authenticateXmlRiverRequest, async (req: Request, res: Response) => {
    try {
      const { apiKey, userId } = req.body;
      const userIdFromToken = (req as any).userId;
      const token = (req as any).token;
      
      if (userIdFromToken !== userId) {
        return res.status(403).json({
          error: 'Отказано в доступе',
          message: 'Вы можете сохранять API ключи только для своего аккаунта'
        });
      }
      
      if (!apiKey) {
        return res.status(400).json({
          error: 'Отсутствует API ключ',
          message: 'Необходимо указать API ключ'
        });
      }
      
      // Попытка форматировать API ключ, если он не является JSON
      let formattedApiKey = apiKey;
      
      try {
        // Проверяем, является ли ключ валидным JSON
        JSON.parse(apiKey);
      } catch (e) {
        // Если ключ не является JSON, преобразуем его
        if (apiKey.includes(':')) {
          // Формат user:key
          const [user, key] = apiKey.split(':');
          formattedApiKey = JSON.stringify({ user: user.trim(), key: key.trim() });
        } else {
          // Просто ключ без user_id
          formattedApiKey = JSON.stringify({ user: "16797", key: apiKey.trim() });
        }
      }
      
      // Сохраняем API ключ в сервисе
      const success = await apiKeyService.saveApiKey(
        userId,
        'xmlriver' as ApiServiceName,
        formattedApiKey,
        token
      );
      
      if (success) {
        return res.status(200).json({
          success: true,
          message: 'API ключ XMLRiver успешно сохранен'
        });
      } else {
        return res.status(500).json({
          error: 'Ошибка сохранения',
          message: 'Не удалось сохранить API ключ'
        });
      }
    } catch (error) {
      log(`Ошибка при сохранении API ключа: ${error instanceof Error ? error.message : 'Unknown error'}`, 'xmlriver-api');
      
      return res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        message: 'Произошла ошибка при обработке запроса'
      });
    }
  });
  
  // Маршрут для получения ключевых слов из XMLRiver API
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
      
      if (!userId) {
        return res.status(401).json({
          error: 'Необходима авторизация',
          message: 'Для доступа к API необходимо авторизоваться'
        });
      }
      
      log(`Поиск ключевых слов в XMLRiver для запроса: ${query} (userId: ${userId})`, 'xmlriver-api');
      
      // Получаем ключ из сервиса API ключей
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