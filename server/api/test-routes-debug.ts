/**
 * Тестовые маршруты для отладки API
 * Этот файл содержит дополнительные маршруты для диагностики проблем
 */
import { Express, Request, Response } from 'express';
import { telegramService } from '../services/social/telegram-service';
import { socialPublishingService } from '../services/social';
import { storage } from '../storage';
import { CampaignContent, SocialMediaSettings } from '@shared/schema';
import { log } from '../utils/logger';

/**
 * Регистрирует тестовые маршруты для отладки
 */
export function registerTestDebugRoutes(app: Express): void {
  console.log('[test-routes-debug] Регистрация отладочных маршрутов...');

  // Маршрут для отладки параметров публикации в Telegram
  app.post('/api/test/telegram-debug-publish', async (req: Request, res: Response) => {
    try {
      const { contentId, platforms, campaignId } = req.body;
      
      log(`[DEBUG] Отладочный запрос на публикацию контента ${contentId} в платформы: ${JSON.stringify(platforms)}`, 'test-api');

      // Получаем контент
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({ 
          error: 'Контент не найден',
          debug: { contentId, platforms }
        });
      }

      // Получаем кампанию
      const campaign = await storage.getCampaignById(campaignId || content.campaignId);
      if (!campaign) {
        return res.status(404).json({ 
          error: 'Кампания не найдена',
          debug: { contentId, campaignId: content.campaignId, platforms }
        });
      }

      // Логируем полученные объекты для отладки
      log(`[DEBUG] Полученный контент: ${JSON.stringify({
        id: content.id,
        campaignId: content.campaignId,
        contentType: content.contentType,
        contentKeys: Object.keys(content),
        content: content.content,
        imageUrl: content.imageUrl,
        additionalImages: content.additionalImages,
        socialPlatforms: content.socialPlatforms
      })}`, 'test-api');

      log(`[DEBUG] Настройки кампании: ${JSON.stringify({
        id: campaign.id,
        name: campaign.name,
        settingsKeys: Object.keys(campaign.settings || {}),
        socialMediaSettings: campaign.socialMediaSettings || campaign.settings,
        telegram: (campaign.socialMediaSettings || campaign.settings)?.telegram
      })}`, 'test-api');

      return res.status(200).json({
        success: true,
        debug: {
          content: {
            id: content.id,
            campaignId: content.campaignId,
            contentType: content.contentType,
            contentKeys: Object.keys(content),
            content: content.content,
            imageUrl: content.imageUrl,
            additionalImages: content.additionalImages,
            socialPlatforms: content.socialPlatforms
          },
          campaign: {
            id: campaign.id,
            name: campaign.name,
            settingsKeys: Object.keys(campaign.settings || {}),
            socialMediaSettings: campaign.socialMediaSettings || campaign.settings,
            telegram: (campaign.socialMediaSettings || campaign.settings)?.telegram
          }
        }
      });
    } catch (error: any) {
      log(`[DEBUG] Ошибка отладки: ${error.message}`, 'test-api');
      return res.status(500).json({
        error: 'Ошибка при отладке',
        message: error.message
      });
    }
  });

  // Маршрут для тестовой публикации через SocialPublishingService
  app.post('/api/test/service-debug-publish', async (req: Request, res: Response) => {
    try {
      const { contentId, platform, campaignId } = req.body;
      
      log(`[DEBUG] Отладочный запрос на публикацию через сервис, контент ${contentId}, платформа: ${platform}`, 'test-api');

      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }

      if (!platform) {
        return res.status(400).json({ error: 'Не указана платформа' });
      }

      // Получаем контент
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Контент не найден' });
      }

      // Получаем кампанию
      const campaign = await storage.getCampaignById(campaignId || content.campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Кампания не найдена' });
      }

      // Логируем структуру объектов перед отправкой в сервис
      log(`[DEBUG] Структура контента перед отправкой:
        id: ${content.id}
        content: ${content.content ? "присутствует" : "отсутствует"} (${typeof content.content})
        text: ${(content as any).text ? "присутствует" : "отсутствует"} (${typeof (content as any).text})
        imageUrl: ${content.imageUrl ? "присутствует" : "отсутствует"} 
        image: ${(content as any).image ? "присутствует" : "отсутствует"}
        additionalImages: ${content.additionalImages ? `присутствует (${Array.isArray(content.additionalImages) ? content.additionalImages.length : 'не массив'})` : "отсутствует"}
        additional_images: ${(content as any).additional_images ? `присутствует (${Array.isArray((content as any).additional_images) ? (content as any).additional_images.length : 'не массив'})` : "отсутствует"}`, 'test-api');

      // Получаем настройки кампании
      const settings = campaign.socialMediaSettings || campaign.settings;
      log(`[DEBUG] Настройки перед отправкой: ${JSON.stringify(settings?.telegram || {})}`, 'test-api');

      // Публикуем через сервис
      try {
        const result = await socialPublishingService.publishToPlatform(platform, content, campaign);
        return res.status(200).json({
          success: true,
          result
        });
      } catch (error: any) {
        log(`[DEBUG] Ошибка в сервисе публикации: ${error.message}`, 'test-api');
        return res.status(500).json({
          error: 'Ошибка в сервисе публикации',
          message: error.message
        });
      }
    } catch (error: any) {
      log(`[DEBUG] Ошибка отладки: ${error.message}`, 'test-api');
      return res.status(500).json({
        error: 'Ошибка при отладке',
        message: error.message
      });
    }
  });

}