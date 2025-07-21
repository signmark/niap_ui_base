import express from 'express';
import { storage } from '../storage';
import log from '../utils/logger';

const router = express.Router();

/**
 * Публикует Instagram Stories через наш Instagram Private Service
 */
async function publishViaInstagramStoriesAPI(contentId: string): Promise<any> {
  const instagramPrivateService = await import('../services/instagram-private-service.js');
  const instagramService = instagramPrivateService.default;
  
  try {
    log(`[Instagram Stories] Начало публикации Stories для контента ${contentId}`);
    
    // Получаем контент из базы данных
    const adminToken = process.env.DIRECTUS_TOKEN;
    if (!adminToken) {
      throw new Error('DIRECTUS_TOKEN не найден');
    }
    
    const content = await storage.getCampaignContentById(contentId);
    if (!content) {
      throw new Error(`Контент с ID ${contentId} не найден`);
    }
    
    log(`[Instagram Stories] Контент найден: ${content.title || 'Без названия'}, тип: ${content.contentType}`);
    log(`[Instagram Stories] Изображение: ${content.imageUrl}`);
    log(`[Instagram Stories] Текст: ${content.content}`);
    
    // Получаем настройки Instagram из кампании
    const campaign = await storage.getCampaignById(content.campaignId);
    if (!campaign || !campaign.socialMediaSettings) {
      throw new Error('Настройки социальных сетей не найдены в кампании');
    }
    
    const instagramSettings = campaign.socialMediaSettings.instagram;
    if (!instagramSettings || !instagramSettings.username || !instagramSettings.password) {
      throw new Error('Настройки Instagram (username/password) не найдены в кампании');
    }
    
    log(`[Instagram Stories] Использую учетные данные: ${instagramSettings.username}`);
    
    // Формируем данные для публикации Stories
    let storyData;
    
    if (content.contentType === 'story' && content.slides) {
      // Если это Stories с слайдами
      log(`[Instagram Stories] Обнаружены слайды Stories: ${content.slides.length} слайдов`);
      storyData = {
        slides: content.slides.map(slide => ({
          imageUrl: slide.imageUrl || content.imageUrl,
          videoUrl: slide.videoUrl,
          interactiveElements: slide.elements || [],
          username: instagramSettings.username
        }))
      };
    } else {
      // Обычный контент как Stories
      log(`[Instagram Stories] Публикация обычного контента как Stories`);
      storyData = {
        imageUrl: content.imageUrl || content.additionalImages?.[0],
        videoUrl: content.videoUrl,
        interactiveElements: [],
        username: instagramSettings.username
      };
    }
    
    log(`[Instagram Stories] Данные Stories:`, JSON.stringify(storyData, null, 2));
    
    // Публикуем через Instagram Private Service
    const result = await instagramService.publishStory(
      instagramSettings.username,
      instagramSettings.password,
      storyData
    );
    
    log(`[Instagram Stories] Результат публикации:`, JSON.stringify(result, null, 2));
    
    if (result.success) {
      // Обновляем статус в базе данных
      try {
        await storage.updateCampaignContentSocialPlatform(
          contentId,
          'instagram',
          {
            status: 'published',
            storyId: result.storyId,
            storyUrl: result.storyUrl,
            publishedAt: new Date().toISOString(),
            message: 'Успешно опубликовано в Instagram Stories',
            slidesPublished: result.slidesPublished,
            totalSlides: result.totalSlides
          },
          adminToken
        );
        
        log(`[Instagram Stories] Статус обновлен в базе данных`);
      } catch (updateError: any) {
        log(`[Instagram Stories] Ошибка обновления статуса: ${updateError.message}`);
      }
      
      return {
        success: true,
        status: 'published',
        storyId: result.storyId,
        storyUrl: result.storyUrl,
        platform: 'instagram',
        publishedAt: new Date().toISOString(),
        message: 'Успешно опубликовано в Instagram Stories',
        slidesPublished: result.slidesPublished,
        totalSlides: result.totalSlides
      };
    } else {
      throw new Error('Неуспешная публикация Stories');
    }
    
  } catch (error: any) {
    log(`[Instagram Stories] Ошибка публикации: ${error.message}`);
    
    // Обновляем статус как failed
    try {
      const adminToken = process.env.DIRECTUS_TOKEN;
      if (adminToken) {
        await storage.updateCampaignContentSocialPlatform(
          contentId,
          'instagram',
          {
            status: 'failed',
            error: error.message,
            failedAt: new Date().toISOString()
          },
          adminToken
        );
      }
    } catch (updateError: any) {
      log(`[Instagram Stories] Ошибка обновления статуса на failed: ${updateError.message}`);
    }
    
    return {
      success: false,
      status: 'failed',
      platform: 'instagram',
      error: error.message,
      message: 'Ошибка публикации в Instagram Stories'
    };
  }
}

/**
 * Тестовый эндпоинт для публикации Stories по contentId
 */
router.post('/test-story-by-id', async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId'
      });
    }
    
    log(`[Test Story by ID] Тестирование Stories с ID: ${contentId}`);
    
    // Используем нашу функцию для публикации Stories
    const result = await publishViaInstagramStoriesAPI(contentId);
    
    log(`[Test Story by ID] Результат: ${JSON.stringify(result)}`);
    
    return res.status(200).json({
      success: result.success,
      message: result.success ? 
        'Stories успешно опубликована!' : 
        'Ошибка при публикации Stories',
      result: result
    });
    
  } catch (error: any) {
    log(`[Test Story by ID] Ошибка: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Ошибка тестирования Stories по ID: ${error.message}`
    });
  }
});

export default router;