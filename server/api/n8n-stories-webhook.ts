/**
 * N8N Webhook для публикации Stories
 * Обрабатывает Stories контент и отправляет на публикацию через N8N workflows
 */

import express from 'express';
import axios from 'axios';
import { log } from '../utils/logger';

const router = express.Router();

/**
 * @api {post} /api/n8n/stories/publish N8N webhook для публикации Stories
 * @apiDescription Отправляет Stories контент в N8N для публикации в соцсети
 * @apiVersion 1.0.0
 * @apiName PublishStoriesToN8N
 * @apiGroup N8NWebhooks
 * 
 * @apiParam {String} contentId ID контента Stories для публикации
 * @apiParam {Object} platforms Объект с выбранными платформами
 * @apiParam {String} [scheduleTime] Время для отложенной публикации (ISO string)
 * 
 * @apiSuccess {Boolean} success Статус операции
 * @apiSuccess {Object} result Результат отправки в N8N
 */
router.post('/publish', async (req, res) => {
  try {
    const { contentId, platforms, scheduleTime } = req.body;
    
    log(`[N8N Stories] Получен запрос на публикацию Stories контента ${contentId}`, 'n8n-stories');
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId'
      });
    }

    // Получаем контент из Directus
    const contentResponse = await axios.get(
      `${process.env.DIRECTUS_URL}/items/campaign_content/${contentId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
        }
      }
    );

    const content = contentResponse.data.data;
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }

    // Проверяем, что это Stories контент
    if (content.content_type !== 'stories') {
      return res.status(400).json({
        success: false,
        error: 'Контент не является Stories'
      });
    }

    // Извлекаем Stories данные из metadata
    const metadata = content.metadata || {};
    const storyData = metadata.storyData || {};
    
    if (!storyData.slides || storyData.slides.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Stories не содержат слайдов'
      });
    }

    log(`[N8N Stories] Обработка Stories с ${storyData.slides.length} слайдами`, 'n8n-stories');

    // Определяем N8N URL
    const n8nBaseUrl = process.env.N8N_URL;
    if (!n8nBaseUrl) {
      return res.status(500).json({
        success: false,
        error: 'N8N_URL не настроен'
      });
    }

    const results = [];

    // Отправляем Stories в каждую выбранную платформу
    for (const [platform, isSelected] of Object.entries(platforms || {})) {
      if (!isSelected) continue;

      try {
        // Определяем webhook endpoint для каждой платформы
        const webhookEndpoint = getStoriesWebhookEndpoint(platform);
        const webhookUrl = `${n8nBaseUrl.replace(/\/$/, '')}/webhook/${webhookEndpoint}`;

        log(`[N8N Stories] Отправка в ${platform} через ${webhookUrl}`, 'n8n-stories');

        // Подготавливаем данные для N8N
        const n8nPayload = {
          contentId,
          platform,
          contentType: 'stories',
          storyData,
          metadata: content.metadata,
          title: content.title,
          scheduleTime,
          // Дополнительные данные для обработки в N8N
          slides: storyData.slides,
          hasInteractiveElements: hasInteractiveElements(storyData),
          campaign: {
            id: content.campaign_id,
            title: content.campaign?.title
          }
        };

        // Отправляем в N8N
        const n8nResponse = await axios.post(webhookUrl, n8nPayload, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        results.push({
          platform,
          success: true,
          response: n8nResponse.data,
          webhookUrl
        });

        log(`[N8N Stories] Успешно отправлено в ${platform}`, 'n8n-stories');

      } catch (error: any) {
        log(`[N8N Stories] Ошибка отправки в ${platform}: ${error.message}`, 'n8n-stories');
        
        results.push({
          platform,
          success: false,
          error: error.message,
          webhookUrl: `${n8nBaseUrl}/webhook/${getStoriesWebhookEndpoint(platform)}`
        });
      }
    }

    res.json({
      success: true,
      contentId,
      results,
      storiesInfo: {
        slidesCount: storyData.slides.length,
        hasInteractiveElements: hasInteractiveElements(storyData),
        interactiveTypes: getInteractiveTypes(storyData)
      }
    });

  } catch (error: any) {
    log(`[N8N Stories] Общая ошибка: ${error.message}`, 'n8n-stories');
    
    res.status(500).json({
      success: false,
      error: `Ошибка публикации Stories: ${error.message}`
    });
  }
});

/**
 * Определяет N8N webhook endpoint для каждой платформы Stories
 */
function getStoriesWebhookEndpoint(platform: string): string {
  const endpoints: Record<string, string> = {
    'instagram': 'publish-instagram-stories',
    'facebook': 'publish-facebook-stories', 
    'vk': 'publish-vk-stories',
    'telegram': 'publish-telegram-stories'
  };

  return endpoints[platform.toLowerCase()] || `publish-${platform.toLowerCase()}-stories`;
}

/**
 * Проверяет наличие интерактивных элементов в Stories
 */
function hasInteractiveElements(storyData: any): boolean {
  if (!storyData?.slides) return false;

  return storyData.slides.some((slide: any) => 
    slide.elements?.some((element: any) => 
      ['poll', 'quiz', 'slider', 'question'].includes(element.type)
    )
  );
}

/**
 * Получает типы интерактивных элементов
 */
function getInteractiveTypes(storyData: any): string[] {
  if (!storyData?.slides) return [];

  const types = new Set<string>();
  
  storyData.slides.forEach((slide: any) => {
    slide.elements?.forEach((element: any) => {
      if (['poll', 'quiz', 'slider', 'question'].includes(element.type)) {
        types.add(element.type);
      }
    });
  });

  return Array.from(types);
}

export default router;