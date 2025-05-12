/**
 * Маршрутизатор для публикации Instagram Stories
 * 
 * Этот файл отвечает за обработку запросов на публикацию Instagram Stories
 */

import express from 'express';
import { validateAuthentication } from '../middleware/authentication';
import { log } from '../utils/logger';
import { InstagramStoriesService } from '../services/social/instagram-stories-service';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен Instagram API и ID бизнес-аккаунта из переменных окружения или настроек
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

/**
 * Регистрирует маршруты для публикации Instagram Stories
 * @param app Express приложение
 */
export function registerInstagramStoriesRoutes(app: express.Express) {
  // Инициализируем сервис Instagram Stories
  const initInstagramStoriesService = (token: string, accountId: string) => {
    return new InstagramStoriesService(token, accountId);
  };
  
  /**
   * Публикует историю в Instagram с заданным URL изображения
   * 
   * POST /api/publish/instagram-story
   * 
   * Body: {
   *   imageUrl: string,
   *   caption?: string,
   *   campaignId: string
   * }
   */
  app.post('/api/publish/instagram-story', validateAuthentication, async (req, res) => {
    try {
      const { imageUrl, caption, campaignId } = req.body;
      
      if (!imageUrl) {
        log('Отсутствует URL изображения для публикации');
        return res.status(400).json({
          success: false,
          error: 'Требуется URL изображения'
        });
      }
      
      if (!campaignId) {
        log('Отсутствует ID кампании для публикации');
        return res.status(400).json({
          success: false,
          error: 'Требуется ID кампании'
        });
      }
      
      // Получаем реквизиты публикации из кампании
      log(`Получение настроек Instagram из кампании ID: ${campaignId}`);
      
      try {
        // Запрос к глобальному объекту directusApiManager для получения настроек кампании
        const campaign = await global.directusApiManager.readItem('campaigns', campaignId, {
          fields: ['id', 'name', 'instagram_token', 'instagram_business_account_id']
        });
        
        if (!campaign) {
          log(`Кампания с ID ${campaignId} не найдена`);
          return res.status(404).json({
            success: false,
            error: 'Кампания не найдена'
          });
        }
        
        const instagramToken = campaign.instagram_token;
        const instagramBusinessAccountId = campaign.instagram_business_account_id;
        
        if (!instagramToken || !instagramBusinessAccountId) {
          log('В настройках кампании отсутствуют учетные данные Instagram API');
          return res.status(400).json({
            success: false,
            error: 'В настройках кампании отсутствуют учетные данные Instagram API'
          });
        }
        
        // Создаем сервис Instagram Stories с настройками из кампании
        const instagramService = initInstagramStoriesService(
          instagramToken,
          instagramBusinessAccountId
        );
        
        // Публикуем историю
        const result = await instagramService.publishStory(imageUrl, caption);
        
        return res.json({
          success: true,
          result
        });
      } catch (campaignError) {
        log(`Ошибка при получении настроек кампании: ${campaignError}`);
        return res.status(500).json({
          success: false,
          error: `Не удалось получить настройки кампании: ${campaignError}`
        });
      }
    } catch (error) {
      log(`Ошибка при публикации Instagram Stories: ${error}`);
      return res.status(500).json({
        success: false,
        error: `Не удалось опубликовать историю: ${error}`
      });
    }
  });

  /**
   * Публикует контент в Instagram Stories по ID контента
   * 
   * POST /api/publish/instagram-stories
   * 
   * Body: {
   *   contentId: string,
   *   campaignId: string
   * }
   */
  app.post('/api/publish/instagram-stories', validateAuthentication, async (req, res) => {
    try {
      const { contentId, campaignId } = req.body;
      
      if (!contentId) {
        log('Отсутствует ID контента для публикации');
        return res.status(400).json({
          success: false,
          error: 'Требуется ID контента'
        });
      }
      
      if (!campaignId) {
        log('Отсутствует ID кампании для публикации');
        return res.status(400).json({
          success: false,
          error: 'Требуется ID кампании'
        });
      }
      
      // Получаем реквизиты публикации из кампании
      log(`Получение настроек Instagram из кампании ID: ${campaignId}`);
      
      try {
        // Запрос к глобальному объекту directusApiManager для получения настроек кампании
        const campaign = await global.directusApiManager.readItem('campaigns', campaignId, {
          fields: ['id', 'name', 'instagram_token', 'instagram_business_account_id']
        });
        
        if (!campaign) {
          log(`Кампания с ID ${campaignId} не найдена`);
          return res.status(404).json({
            success: false,
            error: 'Кампания не найдена'
          });
        }
        
        const instagramToken = campaign.instagram_token;
        const instagramBusinessAccountId = campaign.instagram_business_account_id;
        
        if (!instagramToken || !instagramBusinessAccountId) {
          log('В настройках кампании отсутствуют учетные данные Instagram API');
          return res.status(400).json({
            success: false,
            error: 'В настройках кампании отсутствуют учетные данные Instagram API'
          });
        }
        
        // Получаем данные контента из Directus
        const content = await global.directusApiManager.readItem('campaign_content', contentId, {
          fields: ['*', 'additional_images', 'content_text', 'title']
        });
        
        if (!content) {
          log(`Контент с ID ${contentId} не найден`);
          return res.status(404).json({
            success: false,
            error: 'Контент не найден'
          });
        }
        
        // Определяем медиафайл для публикации
        let imageUrl = null;
        let caption = content.content_text || content.title || '';
        
        log(`Проверка медиафайлов для контента: ${JSON.stringify({
          contentId,
          hasAdditionalImages: !!content.additional_images,
          additionalImagesType: content.additional_images ? typeof content.additional_images : 'undefined',
          hasAdditionalImagesArray: content.additional_images && Array.isArray(content.additional_images),
          additionalImagesLength: content.additional_images && Array.isArray(content.additional_images) ? content.additional_images.length : 0
        })}`);
        
        // Обработка поля additional_images (snake_case)
        if (content.additional_images && Array.isArray(content.additional_images)) {
          log(`Найдено ${content.additional_images.length} медиафайлов в поле additional_images`);
          
          // Берем первое изображение из массива
          for (const imgItem of content.additional_images) {
            if (typeof imgItem === 'object' && imgItem.url && typeof imgItem.url === 'string') {
              imageUrl = imgItem.url;
              log(`Найдено изображение в объекте: ${imageUrl}`);
              break;
            } else if (typeof imgItem === 'string') {
              try {
                const parsedImg = JSON.parse(imgItem);
                if (parsedImg.url && typeof parsedImg.url === 'string') {
                  imageUrl = parsedImg.url;
                  log(`Найдено изображение в JSON строке: ${imageUrl}`);
                  break;
                }
              } catch (e) {
                // Если строка не является JSON, проверяем, может это прямая ссылка
                if (imgItem.startsWith('http')) {
                  imageUrl = imgItem;
                  log(`Найдено изображение в прямой ссылке: ${imageUrl}`);
                  break;
                }
              }
            }
          }
        }
        
        // Если изображение не найдено
        if (!imageUrl) {
          log(`Не удалось найти медиафайл для контента ID: ${contentId}`);
          return res.status(400).json({
            success: false,
            error: 'Не удалось найти медиафайл для публикации'
          });
        }
        
        // Создаем сервис Instagram Stories
        const instagramService = initInstagramStoriesService(
          instagramToken,
          instagramBusinessAccountId
        );
        
        // Публикуем историю
        const result = await instagramService.publishStory(imageUrl, caption);
        
        // Обновляем статус контента, добавляя информацию о публикации в Instagram Stories
        const updateData = {
          instagram_stories_status: 'published',
          instagram_stories_id: result.instagramStoryId || result.storyId, // Используем новое поле или старое для обратной совместимости
          instagram_stories_url: result.storyUrl,
          instagram_stories_published_at: new Date().toISOString()
        };
        
        try {
          await global.directusApiManager.updateItem('campaign_content', contentId, updateData);
        } catch (updateError) {
          log(`Ошибка при обновлении статуса контента: ${updateError}`);
          // Ошибка обновления не должна прерывать выполнение, т.к. публикация уже произошла
        }
        
        return res.json({
          success: true,
          result
        });
      } catch (processingError) {
        log(`Ошибка при обработке контента: ${processingError}`);
        return res.status(500).json({
          success: false,
          error: `Не удалось обработать контент: ${processingError}`
        });
      }
    } catch (error) {
      log(`Ошибка при публикации контента в Instagram Stories: ${error}`);
      return res.status(500).json({
        success: false,
        error: `Не удалось опубликовать контент: ${error}`
      });
    }
  });

  /**
   * Получает параметры доступа к Instagram API для конкретной кампании
   * 
   * GET /api/instagram-stories/settings/:campaignId
   */
  app.get('/api/instagram-stories/settings/:campaignId', validateAuthentication, async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      if (!campaignId) {
        return res.status(400).json({
          success: false,
          error: 'Не указан ID кампании'
        });
      }
      
      // Запрос к глобальному объекту directusApiManager для получения настроек кампании
      const campaign = await global.directusApiManager.readItem('campaigns', campaignId, {
        fields: ['id', 'name', 'instagram_token', 'instagram_business_account_id']
      });
      
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Кампания не найдена'
        });
      }
      
      const hasToken = !!campaign.instagram_token;
      const hasAccountId = !!campaign.instagram_business_account_id;
      
      return res.json({
        success: true,
        settings: {
          hasToken,
          hasAccountId,
          isConfigured: hasToken && hasAccountId
        }
      });
    } catch (error) {
      log(`Ошибка при получении настроек Instagram: ${error}`);
      return res.status(500).json({
        success: false,
        error: `Не удалось получить настройки: ${error}`
      });
    }
  });
}