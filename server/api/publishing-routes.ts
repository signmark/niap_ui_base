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
      // Получаем authToken из заголовка
      const authToken = req.header('Authorization')?.split(' ')[1];
      
      // Получаем userId из разных источников (с приоритетом)
      let userId = req.header('X-User-ID') || req.query.userId as string;
      
      // Если userId отсутствует, но есть объект user в запросе, используем его
      if (!userId && (req as any).user && (req as any).user.id) {
        userId = (req as any).user.id;
      }
      
      // Получаем campaignId из запроса
      const { campaignId } = req.query;

      // Проверяем наличие токена авторизации
      if (!authToken) {
        log('[api] Ошибка: Отсутствует токен авторизации в запросе запланированных публикаций');
        return res.status(401).json({
          success: false,
          message: 'Требуется авторизация. Пожалуйста, войдите снова.'
        });
      }

      // Проверяем наличие userId
      if (!userId) {
        log('[api] Ошибка: User ID не предоставлен в запросе запланированных публикаций');
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      log('[api] Запрос запланированных публикаций для пользователя ' + userId);

      // Добавляем дополнительные логи для отладки
      log('[api] Параметры запроса: ' + JSON.stringify({
        userId,
        campaignId,
        hasAuthToken: !!authToken
      }));

      // Получаем запланированные публикации из хранилища
      try {
        const scheduledContent = await storage.getScheduledContent(
          userId as string,
          campaignId as string
        );

        log('[api] Получено ' + scheduledContent.length + ' запланированных публикаций');

        return res.status(200).json({
          success: true,
          data: scheduledContent
        });
      } catch (storageError) {
        log('[api] Ошибка при получении запланированных публикаций из хранилища: ' + storageError);
        return res.status(500).json({
          success: false,
          message: 'Error getting scheduled content from storage',
          error: storageError instanceof Error ? storageError.message : String(storageError)
        });
      }
    } catch (error) {
      console.error('Error getting scheduled content:', error);
      return res.status(500).json({
        success: false,
        message: 'Error getting scheduled content',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}