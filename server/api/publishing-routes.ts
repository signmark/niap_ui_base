import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { log } from '../utils/logger';

/**
 * Модуль маршрутов для управления публикациями
 */
export function registerPublishingRoutes(router: Router): void {
  log('[publishing-routes] Регистрация маршрутов управления публикациями...');

  /**
   * Получение списка запланированных публикаций
   * GET /api/publish/scheduled
   */
  router.get('/publish/scheduled', async (req: Request, res: Response) => {
    try {
      // Получаем userId из заголовка X-User-ID, из запроса или из сессии аутентификации
      let userId = req.header('X-User-ID') || req.query.userId as string;
      
      // Если userId отсутствует, но есть объект user в запросе, используем его
      if (!userId && req.user && (req.user as any).id) {
        userId = (req.user as any).id;
      }
      
      // Получаем campaignId из запроса
      const { campaignId } = req.query;

      // Проверяем наличие userId
      if (!userId) {
        log('[api] Ошибка: User ID не предоставлен в запросе запланированных публикаций');
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      log('[api] Запрос запланированных публикаций для пользователя ' + userId);

      // Получаем запланированные публикации из хранилища
      const scheduledContent = await storage.getScheduledContent(
        userId as string,
        campaignId as string
      );

      log('[api] Получено ' + scheduledContent.length + ' запланированных публикаций');

      return res.status(200).json({
        success: true,
        data: scheduledContent
      });
    } catch (error) {
      console.error('Error getting scheduled content:', error);
      return res.status(500).json({
        success: false,
        message: 'Error getting scheduled content',
        error
      });
    }
  });
}