import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { log } from '../utils/logger';
import { directusAuthManager } from '../services/directus-auth-manager';

/**
 * Модуль маршрутов для работы с опубликованным контентом
 */
export function registerPublishedRoutes(router: Router): void {
  log('[published-routes] Регистрация маршрутов для опубликованного контента...');

  /**
   * Получение списка опубликованного контента
   * GET /api/publish/published
   */
  router.get('/publish/published', async (req: Request, res: Response) => {
    try {
      const { userId, campaignId } = req.query;

      // Проверяем наличие userId
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Получаем токен для авторизации
      let authToken: string | null = null;
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.substring(7);
        directusAuthManager.cacheAuthToken(userId as string, authToken, 3600);
        log('[api] Токен для пользователя ' + userId + ' кэширован');
      }

      log('[api] Запрос опубликованного контента с токеном авторизации для пользователя ' + userId);

      // Получаем опубликованный контент из хранилища
      const publishedContent = await storage.getPublishedContent(
        userId as string,
        campaignId as string
      );

      log('[api] Получено ' + publishedContent.length + ' опубликованных элементов из улучшенного адаптера');

      return res.status(200).json({
        success: true,
        data: publishedContent
      });
    } catch (error) {
      console.error('Error getting published content:', error);
      return res.status(500).json({
        success: false,
        message: 'Error getting published content',
        error
      });
    }
  });
}