#!/usr/bin/env node

/**
 * Тест публикации определенного контента в Instagram Stories
 */

import InstagramPrivateService from './server/services/instagram-private-service.js';
import { storage } from './server/storage.js';

const log = console.log;

async function testContentPublication(contentId) {
  try {
    log(`[Test] Начинаем тест публикации контента ${contentId}`);
    
    // Получаем контент из базы данных
    const adminToken = process.env.DIRECTUS_TOKEN;
    if (!adminToken) {
      throw new Error('DIRECTUS_TOKEN не найден');
    }
    
    const content = await storage.getCampaignContentById(contentId);
    if (!content) {
      throw new Error(`Контент с ID ${contentId} не найден`);
    }
    
    log(`[Test] Контент найден: ${content.title || 'Без названия'}, тип: ${content.contentType}`);
    log(`[Test] Изображение: ${content.imageUrl}`);
    log(`[Test] Текст: ${content.content || 'Нет текста'}`);
    
    // Получаем настройки Instagram из кампании
    const campaign = await storage.getCampaignById(content.campaignId);
    if (!campaign || !campaign.socialMediaSettings) {
      throw new Error('Настройки социальных сетей не найдены в кампании');
    }
    
    const instagramSettings = campaign.socialMediaSettings.instagram;
    if (!instagramSettings || !instagramSettings.username || !instagramSettings.password) {
      throw new Error('Настройки Instagram (username/password) не найдены в кампании');
    }
    
    log(`[Test] Instagram аккаунт: ${instagramSettings.username}`);
    
    // Определяем данные для Stories
    let storyData;
    
    if (content.contentType === 'story' && content.slides) {
      // Если это Stories с слайдами
      log(`[Test] Обнаружены слайды Stories: ${content.slides.length} слайдов`);
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
      log(`[Test] Публикация обычного контента как Stories`);
      storyData = {
        imageUrl: content.imageUrl || content.additionalImages?.[0],
        videoUrl: content.videoUrl,
        interactiveElements: [],
        username: instagramSettings.username
      };
    }
    
    log(`[Test] Данные Stories:`, JSON.stringify(storyData, null, 2));
    
    // Публикуем через Instagram Private Service
    const result = await InstagramPrivateService.publishStory(
      instagramSettings.username,
      instagramSettings.password,
      storyData
    );
    
    log(`[Test] Результат публикации:`, JSON.stringify(result, null, 2));
    
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
        
        log(`[Test] Статус обновлен в базе данных`);
      } catch (updateError) {
        log(`[Test] Ошибка обновления статуса:`, updateError.message);
      }
      
      log(`[Test] ✅ УСПЕХ! Stories опубликована: ${result.storyUrl}`);
      return {
        success: true,
        storyUrl: result.storyUrl,
        storyId: result.storyId
      };
    } else {
      log(`[Test] ❌ ОШИБКА публикации:`, result.error);
      return {
        success: false,
        error: result.error
      };
    }
    
  } catch (error) {
    log(`[Test] ❌ КРИТИЧЕСКАЯ ОШИБКА:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Запускаем тест
const contentId = 'd01d7577-8cd8-4790-b4ad-ad4ba87a2880';
testContentPublication(contentId).then(result => {
  log(`[Test] Финальный результат:`, JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
});