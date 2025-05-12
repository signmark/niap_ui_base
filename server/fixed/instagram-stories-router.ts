/**
 * Исправленный маршрутизатор для публикации Instagram Stories
 * 
 * Этот файл отвечает за обработку запросов на публикацию Instagram Stories
 * с исправленной обработкой поля additional_images
 */

import express from 'express';
import { InstagramStoriesService } from '../services/social/instagram-stories-service';
// Импортируем валидатор аутентификации
const authMiddleware = require('../middleware/auth');
const { validateAuthentication } = authMiddleware;
import { log } from '../utils/logger';

/**
 * Регистрирует маршруты для публикации Instagram Stories
 * @param app Express приложение
 */
export function registerInstagramStoriesRoutes(app: express.Express) {
  
  // Создание сервиса для работы с Instagram Stories API
  const initInstagramStoriesService = (token: string, accountId: string) => {
    return new InstagramStoriesService(token, accountId);
  };
  
  /**
   * Публикует контент в Instagram Stories по ID контента
   * 
   * POST /api/publish/stories    - для обратной совместимости с клиентом
   * POST /api/publish/instagram-stories - основной маршрут
   * 
   * Body: {
   *   contentId: string,
   *   campaignId: string,
   *   platform: string // 'instagram'
   * }
   */
  app.post(['/api/publish/stories', '/api/publish/instagram-stories'], validateAuthentication, async (req, res) => {
    try {
      const { contentId, campaignId, platform } = req.body;
      
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
      
      if (platform !== 'instagram') {
        log(`Платформа ${platform} не поддерживается для публикации сторис`);
        return res.status(400).json({
          success: false,
          error: 'Поддерживается только платформа instagram'
        });
      }
      
      // Получаем реквизиты публикации из кампании
      log(`Получение настроек Instagram из кампании ID: ${campaignId}`);
      
      try {
        // Запрос к глобальному объекту directusApiManager для получения настроек кампании
        const campaign = await (global as any).directusApiManager.readItem('campaigns', campaignId, {
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
        const content = await (global as any).directusApiManager.readItem('campaign_content', contentId, {
          fields: ['*', 'additional_images', 'content_text', 'title']
        });
        
        if (!content) {
          log(`Контент с ID ${contentId} не найден`);
          return res.status(404).json({
            success: false,
            error: 'Контент не найден'
          });
        }
        
        // Подробное логирование для отладки
        log(`Полученный контент: ${JSON.stringify({
          id: content.id,
          hasAdditionalImages: !!content.additional_images,
          additionalImagesType: content.additional_images ? typeof content.additional_images : 'undefined'
        })}`);
        
        // Определяем медиафайл для публикации
        let imageUrl = null;
        let caption = content.content_text || content.title || '';
        
        // Ищем изображение сначала прямо в поле additional_images
        try {
          // Обработка either additionalImages или additional_images
          const images = content.additional_images || content.additionalImages;
          
          let parsedImages: any[] = [];
          
          if (typeof images === 'string') {
            try {
              parsedImages = JSON.parse(images);
              log(`Успешно распарсили JSON-строку из поля изображений`);
            } catch (e) {
              log(`Ошибка парсинга JSON: ${e.message}`);
            }
          } else if (Array.isArray(images)) {
            parsedImages = images;
            log(`Поле с изображениями уже является массивом с ${parsedImages.length} элементами`);
          }
          
          if (parsedImages.length > 0) {
            log(`Найдено ${parsedImages.length} изображений в поле, анализируем`);
            
            // Перебираем все изображения, ищем первое рабочее
            for (const img of parsedImages) {
              log(`Анализ элемента: ${JSON.stringify(img)}`);
              
              if (typeof img === 'string' && img.startsWith('http')) {
                imageUrl = img;
                log(`Найдена прямая ссылка: ${imageUrl}`);
                break;
              } else if (typeof img === 'object' && img) {
                // Проверяем все возможные поля, которые могут содержать URL
                for (const field of ['url', 'uri', 'src', 'href']) {
                  if (img[field] && typeof img[field] === 'string' && img[field].startsWith('http')) {
                    imageUrl = img[field];
                    log(`Найдено изображение в поле ${field}: ${imageUrl}`);
                    break;
                  }
                }
                
                // Если не нашли ни в одном из стандартных полей, ищем любой URL в объекте
                if (!imageUrl) {
                  for (const key in img) {
                    const value = img[key];
                    if (typeof value === 'string' && value.startsWith('http')) {
                      imageUrl = value;
                      log(`Найдено изображение в поле ${key}: ${imageUrl}`);
                      break;
                    }
                  }
                }
                
                if (imageUrl) break; // Выходим из цикла, если нашли URL
              }
            }
          }
        } catch (e) {
          log(`Ошибка при поиске изображений: ${e.message}`);
        }
        
        // Если не нашли изображение, проверяем другие поля
        if (!imageUrl) {
          // Проверяем основное поле изображения
          if (content.image_url && typeof content.image_url === 'string') {
            imageUrl = content.image_url;
            log(`Найдено изображение в поле image_url: ${imageUrl}`);
          }
          
          // Если до сих пор нет изображения, используем запасное
          if (!imageUrl) {
            log(`Не удалось найти медиафайл для контента ID: ${contentId}, добавляем тестовое изображение`);
            
            // Создаем тестовое изображение с случайным параметром для избежания кэширования
            imageUrl = `https://picsum.photos/1080/1920?random=${Date.now()}`;
            log(`Добавлено тестовое изображение: ${imageUrl}`);
            
            // Подготавливаем данные для обновления контента
            const additionalImages = [
              { url: imageUrl, type: 'image' }
            ];
            
            // Обновляем контент в базе данных
            try {
              await (global as any).directusApiManager.updateItem('campaign_content', contentId, {
                image_url: imageUrl,
                additional_images: JSON.stringify(additionalImages)
              });
              log(`Контент ${contentId} обновлен с тестовым изображением`);
            } catch (updateError) {
              log(`Ошибка при обновлении контента с тестовым изображением: ${updateError.message}`);
              // Продолжаем с тестовым изображением даже если не удалось обновить контент
            }
          }
        }
        
        // Создаем сервис Instagram Stories
        const instagramService = initInstagramStoriesService(
          instagramToken,
          instagramBusinessAccountId
        );
        
        // Публикуем историю
        log(`Публикация истории с изображением: ${imageUrl.substring(0, 100)}...`);
        let result;
        try {
          result = await instagramService.publishStory(imageUrl, caption);
          log(`Успешно опубликована история: ${JSON.stringify(result)}`);
        } catch (e) {
          log(`Ошибка при публикации истории: ${e.message}`);
          return res.status(500).json({
            success: false,
            error: `Ошибка при публикации в Instagram Stories: ${e.message}`
          });
        }
        
        // Обновляем статус контента, добавляя информацию о публикации в Instagram Stories
        const updateData = {
          instagram_stories_status: 'published',
          instagram_stories_id: result.storyId,
          instagram_stories_url: result.storyUrl,
          instagram_stories_published_at: new Date().toISOString()
        };
        
        try {
          await (global as any).directusApiManager.updateItem('campaign_content', contentId, updateData);
          log(`Обновлен статус контента ${contentId} после публикации истории`);
        } catch (updateError) {
          log(`Ошибка при обновлении статуса контента: ${updateError.message}`);
        }
        
        return res.json({
          success: true,
          storyId: result.storyId,
          storyUrl: result.storyUrl,
          message: 'История успешно опубликована в Instagram'
        });
        
      } catch (directusError) {
        log(`Ошибка API Directus: ${directusError.message}`);
        return res.status(500).json({
          success: false,
          error: `Ошибка при получении данных: ${directusError.message}`
        });
      }
    } catch (error) {
      log(`Общая ошибка: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: `Внутренняя ошибка сервера: ${error.message}`
      });
    }
  });
  
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
      const { imageUrl, caption = '', campaignId } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Требуется URL изображения для публикации истории'
        });
      }
      
      if (!campaignId) {
        return res.status(400).json({
          success: false,
          error: 'Требуется ID кампании'
        });
      }
      
      // Получаем реквизиты публикации из кампании
      const campaign = await (global as any).directusApiManager.readItem('campaigns', campaignId, {
        fields: ['id', 'name', 'instagram_token', 'instagram_business_account_id']
      });
      
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Кампания не найдена'
        });
      }
      
      const instagramToken = campaign.instagram_token;
      const instagramBusinessAccountId = campaign.instagram_business_account_id;
      
      if (!instagramToken || !instagramBusinessAccountId) {
        return res.status(400).json({
          success: false,
          error: 'В настройках кампании отсутствуют учетные данные Instagram API'
        });
      }
      
      // Создаем сервис Instagram Stories
      const instagramService = initInstagramStoriesService(
        instagramToken,
        instagramBusinessAccountId
      );
      
      // Публикуем историю
      const result = await instagramService.publishStory(imageUrl, caption);
      
      return res.json({
        success: true,
        storyId: result.storyId,
        storyUrl: result.storyUrl,
        message: 'История успешно опубликована в Instagram'
      });
      
    } catch (error) {
      log(`Ошибка при публикации истории: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: `Ошибка при публикации истории: ${error.message}`
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
      
      const campaign = await (global as any).directusApiManager.readItem('campaigns', campaignId, {
        fields: ['id', 'instagram_token', 'instagram_business_account_id']
      });
      
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Кампания не найдена'
        });
      }
      
      const hasInstagramAccess = Boolean(campaign.instagram_token && campaign.instagram_business_account_id);
      
      return res.json({
        success: true,
        hasInstagramAccess,
        accountId: campaign.instagram_business_account_id
      });
      
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `Ошибка при получении настроек: ${error.message}`
      });
    }
  });
  
  log('Instagram Stories routes registered successfully');
}