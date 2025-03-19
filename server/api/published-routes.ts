import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../utils/logger';
import { authenticateApiRequest } from './middleware/auth';

/**
 * Регистрирует маршруты для работы с опубликованным контентом
 */
export function registerPublishedRoutes(router: Router) {
  log('Регистрация маршрутов опубликованного контента...', 'published-routes');

  /**
   * Получение списка опубликованного контента
   * GET /api/published
   * Query params:
   * - campaignId: ID кампании (опционально)
   * - startDate: начальная дата (ISO string)
   * - endDate: конечная дата (ISO string)
   */
  router.get('/published', async (req: Request, res: Response) => {
    try {
      // В реальном приложении здесь будет получение userId из сессии
      // В данном случае используем userId из запроса или заголовка Authorization
      const userId = (req as any).userId;
      
      // Проверка авторизации
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Необходимо авторизоваться'
        });
      }
      
      const campaignId = req.query.campaignId as string | undefined;
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;
      
      // Преобразование строковых дат в объекты Date
      const startDate = startDateStr ? new Date(startDateStr) : undefined;
      const endDate = endDateStr ? new Date(endDateStr) : undefined;
      
      console.log(`Получение опубликованного контента для пользователя ${userId}, кампания: ${campaignId || 'все'}`);
      console.log(`Фильтр по дате: ${startDateStr || 'с начала'} - ${endDateStr || 'до конца'}`);
      
      // Получаем опубликованный контент
      const publishedContent = await storage.getPublishedContent(userId, campaignId);
      
      // Фильтрация по датам, если они указаны
      const filteredContent = publishedContent.filter(content => {
        if (!content.publishedAt) return false;
        
        const publishDate = new Date(content.publishedAt);
        
        if (startDate && publishDate < startDate) return false;
        if (endDate && publishDate > endDate) return false;
        
        return true;
      });
      
      console.log(`Найдено ${filteredContent.length} опубликованных элементов контента`);
      
      return res.json({
        success: true,
        data: filteredContent
      });
    } catch (error) {
      console.error('Ошибка при получении опубликованного контента:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении опубликованного контента'
      });
    }
  });

  /**
   * Получение детальной информации о публикации
   * GET /api/published/:id
   */
  router.get('/published/:id', async (req: Request, res: Response) => {
    try {
      // В реальном приложении здесь будет получение userId из сессии
      // В данном случае используем userId из запроса или заголовка Authorization
      const userId = (req as any).userId;
      
      // Проверка авторизации
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Необходимо авторизоваться'
        });
      }
      
      const contentId = req.params.id;
      
      console.log(`Получение детальной информации о публикации ${contentId} для пользователя ${userId}`);
      
      const content = await storage.getCampaignContentById(contentId);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Публикация не найдена'
        });
      }
      
      return res.json({
        success: true,
        data: content
      });
    } catch (error) {
      console.error('Ошибка при получении информации о публикации:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении информации о публикации'
      });
    }
  });

  log('Маршруты опубликованного контента зарегистрированы', 'published-routes');
}