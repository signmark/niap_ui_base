import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { log } from '../utils/logger';

/**
 * Модуль маршрутов для прямого планирования публикаций
 */
export function registerDirectScheduleRoutes(router: Router): void {
  log('[direct-schedule-routes] Регистрация маршрутов прямого планирования...');

  /**
   * Маршрут для прямого планирования публикации контента
   * POST /api/direct-schedule/:id
   */
  router.post('/direct-schedule/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { scheduledAt, socialPlatforms, status } = req.body;
      
      // Проверяем наличие необходимых параметров
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Content ID is required'
        });
      }

      log(`[api] Планирование публикации для контента ${id} на дату ${scheduledAt}`);
      
      // Получаем текущий контент
      const currentContent = await storage.getCampaignContentById(id);
      
      if (!currentContent) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }
      
      // Обновляем контент - устанавливаем дату публикации и статус
      const updatedContent = await storage.updateCampaignContent(id, {
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: status || 'scheduled',
        socialPlatforms: socialPlatforms || {}
      });
      
      log(`[api] Публикация успешно запланирована для контента ${id}`);

      return res.status(200).json({
        success: true,
        data: updatedContent
      });
    } catch (error) {
      console.error('Error scheduling content:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });
}