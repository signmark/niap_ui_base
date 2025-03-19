import { Router, Request, Response } from 'express';
import axios from 'axios';
import { log } from '../utils/logger';
import { apiKeyService } from '../services/api-keys';

/**
 * Регистрирует маршруты для работы с сервисом Yandex.Wordstat через XMLRiver
 */
export function registerWordStatRoutes(router: Router) {
  log('Регистрация маршрутов для Wordstat...', 'wordstat-routes');

  /**
   * Получение статистики по ключевому слову от XMLRiver
   * GET /api/wordstat/:keyword
   */
  router.get('/wordstat/:keyword', async (req: Request, res: Response) => {
    try {
      const keyword = req.params.keyword;
      const userId = (req as any).userId;
      
      if (!keyword) {
        return res.status(400).json({
          success: false,
          message: 'Необходимо указать ключевое слово'
        });
      }
      
      // Получаем API ключ пользователя для XMLRiver
      const apiKey = await apiKeyService.getApiKey(userId, 'xmlriver');
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: 'API ключ для XMLRiver не настроен'
        });
      }
      
      console.log(`Searching WordStat for keyword: ${keyword}`);
      
      // Делаем запрос к XMLRiver API
      const response = await axios.get('https://xmlriver.com/api/v1/yandex_wordstat', {
        params: {
          keyword: keyword,
          apikey: apiKey
        }
      });
      
      // Проверяем ответ
      if (response.data && response.data.success) {
        // Формируем данные для ответа
        const wordstatData = {
          keyword: keyword,
          shows: response.data.wordstat?.shows || 0,
          relatedKeywords: response.data.related_keys?.map((item: any) => ({
            keyword: item.phrase,
            shows: item.shows
          })) || []
        };
        
        return res.json({
          success: true,
          data: wordstatData
        });
      } else {
        // Возвращаем ошибку от XMLRiver
        return res.status(400).json({
          success: false,
          message: 'Ошибка при получении данных от XMLRiver',
          details: response.data.error || 'Неизвестная ошибка'
        });
      }
    } catch (error: any) {
      console.error('Ошибка при получении статистики Wordstat:', error.message);
      
      // Проверяем наличие ответа от сервера с ошибкой
      const errorResponse = error.response?.data || { error: 'Неизвестная ошибка' };
      
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении статистики Wordstat',
        details: errorResponse
      });
    }
  });

  log('Маршруты Wordstat зарегистрированы', 'wordstat-routes');
}