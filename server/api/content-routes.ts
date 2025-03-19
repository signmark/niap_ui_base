import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../utils/logger';

/**
 * Регистрирует маршруты для работы с контентом кампаний
 */
export function registerContentRoutes(router: Router) {
  log('Регистрация маршрутов контента...', 'content-routes');

  /**
   * Получение списка контента для кампании
   * GET /api/campaign-content
   * Query params:
   * - campaignId: ID кампании (опционально)
   */
  router.get('/campaign-content', async (req: Request, res: Response) => {
    try {
      // Получаем userId из запроса (добавляется middleware auth)
      const userId = (req as any).userId;
      // Получаем токен из заголовка Authorization
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Необходимо авторизоваться'
        });
      }
      
      const campaignId = req.query.campaignId as string | undefined;
      
      console.log(`Fetching content for campaign ID: ${campaignId}, token present: ${!!token}`);
      
      const content = await storage.getCampaignContent(userId, campaignId, token || undefined);
      
      // Логирование примера ключевых слов
      if (content.length > 0) {
        const sampleKeywords = content[0].keywords;
        console.log(`Sample keywords being sent to client: ${typeof sampleKeywords} "${JSON.stringify(sampleKeywords)}"`);
      }
      
      console.log(`Found ${content.length} content items for campaign ${campaignId}`);
      
      return res.json({
        success: true,
        data: content
      });
    } catch (error) {
      console.error('Ошибка при получении контента:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении контента'
      });
    }
  });

  /**
   * Получение данных конкретного контента
   * GET /api/campaign-content/:id
   */
  router.get('/campaign-content/:id', async (req: Request, res: Response) => {
    try {
      const contentId = req.params.id;
      
      // Получаем токен из заголовка Authorization
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      
      console.log(`Fetching content by ID: ${contentId}, token present: ${!!token}`);
      
      const content = await storage.getCampaignContentById(contentId, token || undefined);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Контент не найден'
        });
      }
      
      return res.json({
        success: true,
        data: content
      });
    } catch (error) {
      console.error('Ошибка при получении данных контента:', error);
      return res.status(500).json({
        success: false,
        message: 'Ошибка при получении данных контента'
      });
    }
  });

  log('Маршруты контента зарегистрированы', 'content-routes');
}