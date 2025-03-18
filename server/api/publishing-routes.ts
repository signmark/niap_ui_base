import { Express, Request, Response } from 'express';
import { storage } from '../storage';
import { socialPublishingService } from '../services/social-publishing';
import { publishScheduler } from '../services/publish-scheduler';
import { SocialPlatform } from '@shared/schema';
import { log } from '../utils/logger';

/**
 * Регистрирует маршруты для управления публикациями
 * @param app Express приложение
 */
export function registerPublishingRoutes(app: Express): void {
  // Публикация контента вручную
  app.post('/api/publish/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      const { platforms } = req.body;

      // Проверяем параметры
      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }

      if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ error: 'Не указаны платформы для публикации' });
      }

      // Получаем контент
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Контент не найден' });
      }

      // Получаем кампанию для настроек социальных сетей
      const campaign = await storage.getCampaign(parseInt(content.campaignId));
      if (!campaign) {
        return res.status(404).json({ error: 'Кампания не найдена' });
      }

      // Настройки социальных сетей
      const socialSettings = campaign.socialMediaSettings || {};

      // Результаты публикации
      const results: Record<string, any> = {};

      // Публикуем в каждую платформу
      for (const platform of platforms) {
        if (!['telegram', 'vk', 'instagram', 'facebook'].includes(platform)) {
          results[platform] = { error: 'Неподдерживаемая платформа' };
          continue;
        }

        // Публикуем контент в платформу
        const result = await socialPublishingService.publishToPlatform(
          content,
          platform as SocialPlatform,
          socialSettings
        );

        // Обновляем статус публикации
        await socialPublishingService.updatePublicationStatus(
          contentId,
          platform as SocialPlatform,
          result
        );

        // Сохраняем результат
        results[platform] = result;
      }

      // Получаем обновленный контент
      const updatedContent = await storage.getCampaignContentById(contentId);
      
      // Возвращаем результат
      return res.status(200).json({ 
        success: true, 
        results,
        content: updatedContent
      });
    } catch (error: any) {
      log(`Ошибка при ручной публикации: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при публикации контента',
        message: error.message
      });
    }
  });

  // Получение статуса публикации
  app.get('/api/publish/status/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;

      // Проверяем параметры
      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }

      // Получаем контент
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Контент не найден' });
      }

      // Возвращаем статус публикации
      return res.status(200).json({ 
        success: true, 
        status: content.status,
        publishedAt: content.publishedAt,
        socialPlatforms: content.socialPlatforms || {}
      });
    } catch (error: any) {
      log(`Ошибка при получении статуса публикации: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при получении статуса публикации',
        message: error.message
      });
    }
  });

  // Запуск проверки запланированных публикаций
  app.post('/api/publish/check-scheduled', async (req: Request, res: Response) => {
    try {
      // Проверяем запланированные публикации немедленно
      publishScheduler.checkScheduledContent()
        .then(() => {
          log('Проверка запланированных публикаций завершена', 'api');
        })
        .catch((error) => {
          log(`Ошибка при проверке запланированных публикаций: ${error.message}`, 'api');
        });

      // Возвращаем успешный результат не дожидаясь завершения проверки
      return res.status(200).json({ 
        success: true, 
        message: 'Проверка запланированных публикаций запущена'
      });
    } catch (error: any) {
      log(`Ошибка при запуске проверки публикаций: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при запуске проверки публикаций',
        message: error.message
      });
    }
  });
}