/**
 * Маршрутизатор публикации в социальные сети
 * Этот файл отвечает за перенаправление запросов публикации контента
 * на соответствующие обработчики для разных социальных платформ.
 */

import express from 'express';
import axios from 'axios';
import { log } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { publicationLockManager } from '../services/publication-lock-manager';
import * as instagramCarouselHandler from './instagram-carousel-webhook';
import { storage } from '../storage';
import { SocialPlatform } from '@shared/schema';

const router = express.Router();

/**
 * Публикует контент через Instagram Direct API
 * @param contentId ID контента для публикации
 */
async function publishViaInstagramDirectAPI(contentId: string) {
  try {
    log(`[Social Publishing] Публикация в Instagram через Direct API для контента ${contentId}`);
    
    // Получаем контент из базы данных
    const content = await storage.getCampaignContentById(contentId);
    if (!content) {
      throw new Error(`Контент с ID ${contentId} не найден`);
    }

    // Получаем настройки кампании для получения Instagram credentials
    const campaign = await storage.getCampaignById(content.campaignId);
    if (!campaign) {
      throw new Error(`Кампания с ID ${content.campaignId} не найдена`);
    }

    // Извлекаем Instagram credentials из настроек кампании
    const socialMediaSettings = campaign.socialMediaSettings || {};
    const instagramSettings = socialMediaSettings.instagram || {};
    
    if (!instagramSettings.username || !instagramSettings.password) {
      throw new Error('Instagram credentials не настроены в кампании');
    }

    // Подготавливаем данные для публикации
    const publishData: any = {
      username: instagramSettings.username,
      password: instagramSettings.password,
      caption: content.content || ''
    };

    // Определяем тип контента и добавляем соответствующие данные
    if (content.contentType === 'stories') {
      // Публикация Instagram Stories
      log(`[Social Publishing] Публикация Instagram Stories для контента ${contentId}`);
      
      // Используем первое изображение из дополнительных изображений или основное изображение
      let imageUrl = content.imageUrl;
      if (content.additionalImages && content.additionalImages.length > 0) {
        imageUrl = content.additionalImages[0];
      }
      
      if (!imageUrl) {
        throw new Error('Для Stories требуется изображение');
      }

      // Скачиваем изображение и конвертируем в base64
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBase64 = `data:image/jpeg;base64,${Buffer.from(imageResponse.data).toString('base64')}`;
      
      publishData.imageData = imageBase64;
      
      // Добавляем интерактивные элементы если они есть
      if (content.storyElements) {
        publishData.interactive = content.storyElements;
      }

      // Вызываем Instagram Direct API для Stories
      const response = await axios.post('http://localhost:5000/api/instagram-direct/publish-story', publishData);
      
      if (response.data.success) {
        log(`[Social Publishing] Instagram Stories опубликована успешно: ${response.data.storyUrl}`);
        
        // Обновляем статус в базе данных
        await updateInstagramStatus(contentId, 'published', response.data.storyUrl, response.data.storyId);
        
        return {
          platform: 'instagram',
          status: 'published',
          postUrl: response.data.storyUrl,
          postId: response.data.storyId,
          message: 'Stories опубликована в Instagram'
        };
      } else {
        throw new Error(response.data.error || 'Ошибка публикации Stories');
      }
      
    } else {
      // Обычная публикация поста
      log(`[Social Publishing] Публикация обычного поста в Instagram для контента ${contentId}`);
      
      if (!content.imageUrl) {
        throw new Error('Для публикации поста требуется изображение');
      }

      // Скачиваем изображение и конвертируем в base64
      const imageResponse = await axios.get(content.imageUrl, { responseType: 'arraybuffer' });
      const imageBase64 = `data:image/jpeg;base64,${Buffer.from(imageResponse.data).toString('base64')}`;
      
      publishData.imageData = imageBase64;

      // Вызываем Instagram Direct API для фото поста
      const response = await axios.post('http://localhost:5000/api/instagram-direct/publish-photo', publishData);
      
      if (response.data.success) {
        log(`[Social Publishing] Instagram пост опубликован успешно: ${response.data.postUrl}`);
        
        // Обновляем статус в базе данных
        await updateInstagramStatus(contentId, 'published', response.data.postUrl, response.data.postId);
        
        return {
          platform: 'instagram',
          status: 'published',
          postUrl: response.data.postUrl,
          postId: response.data.postId,
          message: 'Пост опубликован в Instagram'
        };
      } else {
        throw new Error(response.data.error || 'Ошибка публикации поста');
      }
    }

  } catch (error: any) {
    log(`[Social Publishing] Ошибка публикации в Instagram: ${error.message}`);
    
    // Обновляем статус на failed
    await updateInstagramStatus(contentId, 'failed', null, null, error.message);
    
    throw error;
  }
}

/**
 * Обновляет статус Instagram платформы в базе данных
 */
async function updateInstagramStatus(contentId: string, status: string, postUrl?: string | null, postId?: string | null, errorMessage?: string) {
  try {
    // Получаем токен администратора
    const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
    let adminToken = process.env.DIRECTUS_TOKEN;
    const sessions = directusAuthManager.getAllActiveSessions();
    
    if (sessions.length > 0) {
      adminToken = sessions[0].token;
    }

    // Получаем текущий контент
    const content = await storage.getCampaignContentById(contentId);
    if (!content || !content.socialPlatforms) {
      log(`[Social Publishing] Не удалось получить контент ${contentId} для обновления статуса Instagram`);
      return;
    }

    // Обновляем статус Instagram платформы
    const updatedSocialPlatforms = { ...content.socialPlatforms };
    updatedSocialPlatforms.instagram = {
      ...updatedSocialPlatforms.instagram,
      status,
      publishedAt: status === 'published' ? new Date().toISOString() : null,
      postUrl,
      postId,
      error: errorMessage || null
    };

    // Сохраняем обновления
    await storage.updateCampaignContent(
      contentId,
      { socialPlatforms: updatedSocialPlatforms },
      adminToken
    );

    log(`[Social Publishing] Статус Instagram обновлен на "${status}" для контента ${contentId}`);
  } catch (updateError: any) {
    log(`[Social Publishing] Ошибка обновления статуса Instagram: ${updateError.message}`);
  }
}

/**
 * @api {post} /api/publish/now Публикация контента сразу в выбранные социальные сети
 * @apiDescription Публикует контент сразу в выбранные социальные сети и сохраняет выбранные платформы
 * @apiVersion 1.0.0
 * @apiName PublishContentNow
 * @apiGroup SocialPublishing
 * 
 * @apiParam {String} contentId ID контента для публикации
 * @apiParam {Object} platforms Объект с выбранными платформами, например: {telegram: true, vk: true, instagram: false}
 * 
 * @apiSuccess {Boolean} success Статус операции
 * @apiSuccess {Object} result Результат публикации
 */
router.post('/publish/now', authMiddleware, async (req, res) => {
  try {
    log(`[Social Publishing] Получен запрос на публикацию с телом: ${JSON.stringify(req.body)}`);
    
    const { contentId, platforms } = req.body;
    
    log(`[Social Publishing] Запрос на публикацию контента ${contentId} сразу в несколько платформ: ${JSON.stringify(platforms)}`);
    
    if (!contentId) {
      log(`[Social Publishing] Ошибка: не указан contentId`);
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId'
      });
    }
    
    // Проверяем, что платформы указаны и это объект или массив
    if (!platforms || (typeof platforms !== 'object' && !Array.isArray(platforms))) {
      log(`[Social Publishing] Ошибка: платформы не указаны или имеют неверный тип: ${JSON.stringify(platforms)}`);
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать платформы для публикации'
      });
    }
    
    // Поддерживаем два формата: объект {platformName: boolean} и массив строк ["platform1", "platform2"]
    log(`[Social Publishing] Проверка формата объекта platforms: ${JSON.stringify(platforms)}`);
    const validPlatformKeys = ['telegram', 'vk', 'instagram', 'facebook', 'youtube'];
    
    let selectedPlatforms: string[] = [];
    
    // Обработка формата массива ["facebook", "telegram", ...]
    if (Array.isArray(platforms)) {
      log(`[Social Publishing] Обнаружен формат массива для platforms`);
      
      // Фильтруем только валидные платформы
      selectedPlatforms = platforms.filter(platform => 
        typeof platform === 'string' && validPlatformKeys.includes(platform)
      );
      
      log(`[Social Publishing] Валидные платформы из массива: ${selectedPlatforms.join(', ')}`);
    } 
    // Обработка объектного формата {facebook: true, telegram: false, ...}
    else {
      log(`[Social Publishing] Обнаружен объектный формат для platforms`);
      const receivedPlatformKeys = Object.keys(platforms);
      
      log(`[Social Publishing] Ожидаемые ключи платформ: ${validPlatformKeys.join(', ')}`);
      log(`[Social Publishing] Полученные ключи платформ: ${receivedPlatformKeys.join(', ')}`);
      
      // Проверяем, что хотя бы один ключ валидный и его значение - boolean
      const validFormat = receivedPlatformKeys.length > 0 && receivedPlatformKeys.some(key => 
        validPlatformKeys.includes(key) && typeof platforms[key] === 'boolean'
      );
      
      if (!validFormat) {
        log(`[Social Publishing] Ошибка: неверный формат объекта platforms`);
        return res.status(400).json({
          success: false,
          error: 'Неверный формат платформ. Ожидается объект с ключами: telegram, vk, instagram, facebook или массив строк'
        });
      }
      
      // Получаем список выбранных платформ (где значение true)
      selectedPlatforms = Object.entries(platforms)
        .filter(([_, selected]) => selected === true)
        .map(([name]) => name);
    }
    
    if (selectedPlatforms.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не выбрано ни одной платформы для публикации'
      });
    }
    
    log(`[Social Publishing] Выбранные платформы: ${selectedPlatforms.join(', ')}`);
    
    // Используем постоянный DIRECTUS_TOKEN для публикации
    const adminToken = process.env.DIRECTUS_TOKEN;
    
    if (!adminToken) {
      log(`[Social Publishing] DIRECTUS_TOKEN не найден в переменных окружения`);
      return res.status(500).json({
        success: false,
        error: 'Отсутствует токен для публикации'
      });
    }
    
    log(`[Social Publishing] Используем DIRECTUS_TOKEN для публикации: ${adminToken.substring(0, 20)}...`);
    
    // Сначала сохраняем информацию о выбранных платформах в контент
    // Это очень важно - сохраняем структуру платформ перед публикацией
    const platformsData: Record<string, any> = {};
    
    selectedPlatforms.forEach(platform => {
      platformsData[platform] = {
        status: 'pending' // Начальный статус - ожидание публикации перед отправкой к N8N
      };
    });
    
    log(`[Social Publishing] Предварительно заполняем social_platforms со статусом "pending": ${JSON.stringify(platformsData)}`);
    
    try {
      log(`[Social Publishing] Обновляем статусы платформ для контента ${contentId} с DIRECTUS_TOKEN`);
      
      // Обновляем контент, чтобы сохранить выбранные платформы и сразу переводим в статус 'scheduled'
      const updatedContent = await storage.updateCampaignContent(
        contentId,
        { 
          status: 'scheduled', // Устанавливаем статус 'scheduled' сразу при запуске публикации "Опубликовать сейчас"
          socialPlatforms: platformsData 
        },
        adminToken
      );
    
      if (!updatedContent) {
        log(`[Social Publishing] Ошибка при сохранении выбранных платформ для контента ${contentId}`);
        return res.status(500).json({
          success: false,
          error: 'Не удалось сохранить выбранные платформы'
        });
      }
    
      log(`[Social Publishing] Успешно сохранены выбранные платформы для контента ${contentId}`);
      
      // Запускаем публикацию в каждую выбранную платформу
      const publishResults = [];
      
      for (const platform of selectedPlatforms) {
        try {
          // Проверяем, поддерживается ли эта платформа
          if (!['telegram', 'vk', 'instagram', 'facebook', 'youtube'].includes(platform)) {
            publishResults.push({
              platform,
              success: false,
              error: `Платформа ${platform} не поддерживается`
            });
            continue;
          }
          
          // КРИТИЧЕСКАЯ ЗАЩИТА: Проверяем блокировку для предотвращения дублирования
          const lockAcquired = await publicationLockManager.acquireLock(contentId, platform);
          if (!lockAcquired) {
            log(`[Social Publishing] 🔒 Блокировка уже установлена для ${contentId}:${platform}, пропускаем`);
            publishResults.push({
              platform,
              success: false,
              error: `Публикация уже выполняется для платформы ${platform}`
            });
            continue;
          }
          
          log(`[Social Publishing] Запускаем публикацию контента ${contentId} в ${platform}`);
          
          // Instagram использует прямой API, остальные платформы используют N8N вебхуки
          let result;
          if (platform === 'instagram') {
            // Определяем тип контента для выбора метода публикации
            const content = await storage.getCampaignContentById(contentId);
            const isStoriesContent = content && (content.contentType === 'story' || content.contentType === 'instagram_stories');
            
            if (isStoriesContent) {
              log(`[Social Publishing] Обнаружен контент типа Stories (${content.contentType}), используем Stories API`);
              result = await publishViaInstagramStoriesAPI(contentId);
            } else {
              log(`[Social Publishing] Обычный контент (${content?.contentType}), используем стандартный Instagram API`);
              result = await publishViaInstagramDirectAPI(contentId);
            }
          } else {
            log(`[Social Publishing] Публикация ${platform} через N8N вебхук`);
            result = await publishViaN8nAsync(contentId, platform);
          }
          
          publishResults.push({
            platform,
            success: true,
            result
          });
          
          // Освобождаем блокировку после успешной публикации
          await publicationLockManager.releaseLock(contentId, platform);
        } catch (error: any) {
          log(`[Social Publishing] Ошибка при публикации в ${platform}: ${error.message}`);
          
          // Освобождаем блокировку при ошибке
          await publicationLockManager.releaseLock(contentId, platform);
          
          publishResults.push({
            platform,
            success: false,
            error: error.message
          });
        }
      }
      
      // Проверяем, есть ли успешные публикации и неудачные публикации
      const hasSuccessfulPublications = publishResults.some(result => result.success);
      const hasFailedPublications = publishResults.some(result => !result.success);
      // Исправленная логика: определяем количество выбранных платформ правильно
      const selectedPlatformsCount = Array.isArray(platforms) 
        ? platforms.length 
        : Object.entries(platforms).filter(([_, selected]) => selected === true).length;
      
      const allPlatformsPublished = hasSuccessfulPublications && !hasFailedPublications && publishResults.length === selectedPlatformsCount;
      
      log(`[Social Publishing] Статус публикаций: успешных=${hasSuccessfulPublications}, неудачных=${hasFailedPublications}, все платформы опубликованы=${allPlatformsPublished} (выбрано: ${selectedPlatformsCount}, результатов: ${publishResults.length})`);
      
      if (hasSuccessfulPublications) {
        // Автоматически обновляем общий статус контента на "published" ТОЛЬКО если ВСЕ платформы успешны
        try {
          // Получаем текущий контент, чтобы проверить статусы платформ
          const content = await storage.getCampaignContentById(contentId);
          
          if (content && content.socialPlatforms) {
            // Проверяем статусы платформ
            const socialPlatforms = content.socialPlatforms;
            const allPlatforms = Object.keys(socialPlatforms);
            
            // Получаем успешно опубликованные платформы
            const publishedPlatforms = Object.entries(socialPlatforms)
              .filter(([_, data]) => data.status === 'published')
              .map(([platform]) => platform);
            
            // Получаем платформы в статусе pending (для логирования)
            const pendingPlatforms = Object.entries(socialPlatforms)
              .filter(([_, data]) => data.status === 'pending')
              .map(([platform]) => platform);
            
            log(`[Social Publishing] Проверка статусов платформ для контента ${contentId}: опубликовано ${publishedPlatforms.length}/${allPlatforms.length}, в ожидании: ${pendingPlatforms.join(', ')}`);           
            
            // Считаем контент опубликованным ТОЛЬКО ЕСЛИ ВСЕ платформы опубликованы
            
            // Проверяем, что все выбранные платформы опубликованы
            const selectedPlatforms = Object.entries(socialPlatforms)
                .filter(([_, data]) => data.selected === true)
                .map(([platform]) => platform);
                
            const publishedSelectedPlatforms = Object.entries(socialPlatforms)
                .filter(([_, data]) => data.selected === true && data.status === 'published')
                .map(([platform]) => platform);
                
            log(`[Social Publishing] Статусы выбранных платформ: опубликовано ${publishedSelectedPlatforms.length}/${selectedPlatforms.length}`);
            
            // Считаем контент опубликованным, только если все выбранные платформы опубликованы
            const allSelectedPlatformsPublished = selectedPlatforms.length > 0 && 
                                             publishedSelectedPlatforms.length === selectedPlatforms.length;
                                             
            // Без исключений! Только если все выбранные платформы опубликованы
            const shouldMarkAsPublished = allSelectedPlatformsPublished;
                                         
            if (shouldMarkAsPublished) {
              log(`[Social Publishing] Автоматическое обновление статуса для контента ${contentId} на published - ВСЕ платформы опубликованы`);
              
              await storage.updateCampaignContent(
                contentId,
                { status: 'published', publishedAt: new Date() },
                adminToken
              );
              
              log(`[Social Publishing] Статус контента успешно обновлен на "published"`);
            } else if (content.status === 'draft') {
              // Если не все платформы опубликованы, но контент в статусе draft,
              // меняем статус на scheduled чтобы показать что процесс публикации начался
              log(`[Social Publishing] Автоматическое обновление статуса для контента ${contentId} на scheduled - часть платформ опубликована`);
              
              await storage.updateCampaignContent(
                contentId,
                { status: 'scheduled' },
                adminToken
              );
            }
          } else {
            log(`[Social Publishing] Не удалось получить данные контента ${contentId} для проверки статусов платформ`);
          }
        } catch (statusError: any) {
          log(`[Social Publishing] Ошибка при обновлении статуса контента: ${statusError.message}`);
          // Продолжаем работу даже при ошибке обновления статуса
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Контент отправлен на публикацию в выбранные платформы',
        results: publishResults
      });
    } catch (error: any) {
      log(`[Social Publishing] Критическая ошибка при публикации: ${error.message}`);
      
      return res.status(500).json({
        success: false,
        error: `Внутренняя ошибка сервера: ${error.message}`
      });
    }
  } catch (error: any) {
    log(`[Social Publishing] Глобальная ошибка при публикации: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Внутренняя ошибка сервера: ${error.message}`
    });
  }
});

/**
 * @api {post} /api/publish Публикация контента в социальные сети
 * @apiDescription Публикует контент в выбранную социальную платформу (универсальный маршрут)
 * @apiVersion 1.0.0
 * @apiName PublishContent
 * @apiGroup SocialPublishing
 * 
 * @apiParam {String} contentId ID контента для публикации
 * @apiParam {String} platform Платформа для публикации (telegram, vk, instagram)
 * 
 * @apiSuccess {Boolean} success Статус операции
 * @apiSuccess {Object} result Результат публикации
 */
router.post('/publish', authMiddleware, async (req, res) => {
  try {
    console.log(`🎯 [SOCIAL-PUBLISHING-ROUTER] Запрос на публикацию получен`);
    console.log(`🎯 [SOCIAL-PUBLISHING-ROUTER] Параметры:`, req.body);
    
    const { contentId, platform } = req.body;
    
    if (!contentId || !platform) {
      console.log(`🎯 [SOCIAL-PUBLISHING-ROUTER] Ошибка: contentId или platform не указаны`);
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId и platform'
      });
    }
    
    console.log(`🎯 [SOCIAL-PUBLISHING-ROUTER] Запрос на публикацию контента ${contentId} в ${platform}`);
    log(`[Social Publishing] Запрос на публикацию контента ${contentId} в ${platform}`);
    
    // Маршрутизация запросов в зависимости от платформы
    switch (platform.toLowerCase()) {
      case 'telegram':
        // Для Telegram используем n8n вебхук
        return publishViaN8n(contentId, 'telegram', req, res);
        
      case 'vk':
        // Для VK используем n8n вебхук
        return publishViaN8n(contentId, 'vk', req, res);
        
      case 'instagram':
        // Для Instagram теперь всегда используем n8n вебхук
        log(`[Social Publishing] Instagram публикации перенаправляются через n8n`);
        return publishViaN8n(contentId, 'instagram', req, res);
      
      case 'facebook':
        // Для Facebook используем прямую публикацию через API
        log(`[Social Publishing] Facebook публикации обрабатываются через прямой API, не через n8n`);
        // Формируем прямой запрос к facebook-webhook-direct
        try {
          // Получаем базовый URL приложения для формирования полного пути
          const appBaseUrl = process.env.APP_URL || `http://0.0.0.0:${process.env.PORT || 5000}`;
          const facebookWebhookUrl = `${appBaseUrl}/api/facebook-webhook-direct`;
          
          log(`[Social Publishing] Отправка запроса на Facebook webhook: ${facebookWebhookUrl}`);
          
          const response = await axios.post(facebookWebhookUrl, { contentId });
          
          log(`[Social Publishing] Успешный ответ от Facebook webhook-direct: ${JSON.stringify(response.data)}`);
          
          return res.status(200).json({
            success: true,
            message: `Контент успешно отправлен на публикацию в Facebook`,
            result: response.data
          });
        } catch (fbError: any) {
          log(`[Social Publishing] Ошибка при прямой публикации в Facebook: ${fbError.message}`);
          if (fbError.response?.data) {
            log(`[Social Publishing] Детали ошибки Facebook: ${JSON.stringify(fbError.response.data)}`);
          }
          return res.status(500).json({
            success: false,
            error: `Ошибка при публикации в Facebook: ${fbError.message}`
          });
        }
        
      case 'youtube':
        // ВРЕМЕННО: Прямая публикация YouTube вместо N8N workflow
        log(`[Social Publishing] YouTube публикации - прямая интеграция`);
        try {
          const youtubeService = await import('../services/social/youtube').then(m => m.YouTubeService);
          const youtube = new youtubeService();
          const result = await youtube.publishContent(contentId, req.user.id);
          return res.status(200).json({
            success: true,
            platform: 'youtube',
            status: result.status,
            postUrl: result.postUrl,
            videoId: result.videoId,
            message: 'Видео успешно опубликовано на YouTube'
          });
        } catch (error: any) {
          log(`[Social Publishing] Ошибка при публикации YouTube: ${error.message}`);
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        
      default:
        return res.status(400).json({
          success: false,
          error: `Платформа ${platform} не поддерживается`
        });
    }
  } catch (error: any) {
    log(`[Social Publishing] Критическая ошибка: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Внутренняя ошибка сервера: ${error.message}`
    });
  }
});

/**
 * Публикует контент через n8n вебхук
 * @param contentId ID контента для публикации
 * @param platform Платформа для публикации
 * @param req Исходный запрос
 * @param res Исходный ответ
 */
async function publishViaN8n(contentId: string, platform: string, req: express.Request, res: express.Response) {
  try {
    log(`[Social Publishing] Публикация контента ${contentId} в ${platform} через n8n вебхук`);
    
    // Маппинг платформ на соответствующие n8n вебхуки
    const webhookMap: Record<string, string> = {
      'telegram': 'publish-telegram',
      'vk': 'publish-vk',
      'instagram': 'publish-instagram',
      'facebook': 'publish-facebook',
      'youtube': 'publish-youtube'
    };
    
    const webhookName = webhookMap[platform];
    if (!webhookName) {
      return res.status(400).json({
        success: false,
        error: `Платформа ${platform} не имеет настроенного вебхука`
      });
    }
    
    // Формируем URL вебхука
    // Формируем URL вебхука
    // ИСПРАВЛЕНО: Поправлен формат URL для вызова webhook
        // Формируем URL вебхука с учетом N8N_URL
    let baseUrl = process.env.N8N_URL || "https://n8n.nplanner.ru";
    
    // Логируем какой URL используется
    log(`[Social Publishing] N8N_URL из переменной окружения: ${process.env.N8N_URL}`);
    log(`[Social Publishing] Используемый базовый URL для n8n: ${baseUrl}`);
    log(`[Social Publishing] Реальный contentId отправляемый в n8n: ${contentId}`);
    
    // Всегда добавляем /webhook если его нет
    if (!baseUrl.includes("/webhook")) {
      // Если baseUrl заканчивается на /, убираем его перед добавлением /webhook
      if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.slice(0, -1);
      }
      baseUrl = `${baseUrl}/webhook`;
    }
    // Убираем возможный слеш в конце базового URL
    const baseUrlWithoutTrailingSlash = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const webhookUrl = `${baseUrlWithoutTrailingSlash}/${webhookName}`;
    
    // Логируем URL для отладки
    log(`[Social Publishing] Сформирован URL для n8n webhook: ${webhookUrl}`);
    // Для n8n вебхуков отправляем contentId и platform для YouTube
    const webhookPayload = {
      contentId,
      platform
    };
    
    // Отправляем запрос на n8n вебхук с contentId и platform
    const response = await axios.post(webhookUrl, webhookPayload);
    
    log(`[Social Publishing] Отправлены данные в n8n вебхук: contentId=${contentId}, platform=${platform}`);
    log(`[Social Publishing] Данные извлекаются из Directus по contentId`);
    
    log(`[Social Publishing] Ответ от n8n вебхука: ${JSON.stringify(response.data)}`);
    
    // Обновляем статус платформы после успешной публикации
    try {
      log(`[Social Publishing] Обновление статуса платформы ${platform} для контента ${contentId} на "published"`);
      
      // Получаем токен администратора
      const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
      let adminToken = process.env.DIRECTUS_TOKEN;
      const sessions = directusAuthManager.getAllActiveSessions();
      
      if (sessions.length > 0) {
        adminToken = sessions[0].token;
      }
      
      // Получаем текущий контент
      const content = await storage.getCampaignContentById(contentId);
      
      if (!content || !content.socialPlatforms) {
        log(`[Social Publishing] Не удалось получить контент ${contentId} или нет настроек платформ`); 
        return;
      }
      
      // Обновляем статус конкретной платформы
      const updatedPlatforms = { ...content.socialPlatforms };
      
      // Проверяем, есть ли данная платформа в настройках
      if (updatedPlatforms[platform]) {
        log(`[Social Publishing] Обновление статуса платформы ${platform} на published`);
        
        // Обновляем статус платформы на published
        updatedPlatforms[platform] = {
          ...updatedPlatforms[platform],
          status: 'published',
          publishedAt: new Date()
        };
        
        // Сохраняем обновленные настройки платформ
        await storage.updateCampaignContent(
          contentId,
          { socialPlatforms: updatedPlatforms },
          adminToken
        );
        
        log(`[Social Publishing] Статус платформы ${platform} успешно обновлен на "published"`);
        
        // Проверяем, все ли выбранные платформы опубликованы
        const selectedPlatforms = Object.entries(updatedPlatforms)
            .filter(([_, data]) => data.selected === true)
            .map(([platform]) => platform);
            
        const publishedSelectedPlatforms = Object.entries(updatedPlatforms)
            .filter(([_, data]) => data.selected === true && data.status === 'published')
            .map(([platform]) => platform);
            
        log(`[Social Publishing] Статусы выбранных платформ: опубликовано ${publishedSelectedPlatforms.length}/${selectedPlatforms.length}`);
        
        // Обновляем общий статус, если все выбранные платформы опубликованы
        if (selectedPlatforms.length > 0 && publishedSelectedPlatforms.length === selectedPlatforms.length) {
          log(`[Social Publishing] Все выбранные платформы опубликованы, обновляем общий статус на published`);
          
          await storage.updateCampaignContent(
            contentId,
            { status: 'published', publishedAt: new Date() },
            adminToken
          );
          
          log(`[Social Publishing] Общий статус контента обновлен на "published"`);
        } else if (content.status === 'draft') {
          // Если контент в статусе draft, обновляем его до scheduled
          log(`[Social Publishing] Контент в статусе draft, обновляем до scheduled для отслеживания прогресса`);
          
          await storage.updateCampaignContent(
            contentId,
            { status: 'scheduled' },
            adminToken
          );
        }
      } else {
        log(`[Social Publishing] Платформа ${platform} не найдена в настройках контента ${contentId}`);
      }

      // Дополнительно вызываем маршрут обновления статуса после публикации
      try {
        const appBaseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
        log(`[Social Publishing] Автоматический вызов обновления статуса после публикации в ${platform}`);
        
        await axios.post(
          `${appBaseUrl}/api/publish/update-status`,
          { contentId },
          {
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        log(`[Social Publishing] Успешный вызов обновления статуса после публикации в ${platform}`);
      } catch (updateStatusError: any) {
        log(`[Social Publishing] Ошибка при вызове обновления статуса: ${updateStatusError.message}`);
        // Продолжаем даже при ошибке обновления статуса
      }
    } catch (statusError: any) {
      log(`[Social Publishing] Ошибка при обновлении статуса платформы: ${statusError.message}`);
      // Продолжаем даже при ошибке обновления статуса
    }
    
    return res.status(200).json({
      success: true,
      message: `Контент успешно отправлен на публикацию в ${platform}`,
      result: response.data
    });
  } catch (error: any) {
    log(`[Social Publishing] Ошибка при публикации через n8n: ${error.message}`);
    if (error.response) {
      log(`[Social Publishing] Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    
    return res.status(500).json({
      success: false,
      error: `Ошибка при публикации через n8n: ${error.message}`
    });
  }
}

/**
 * Асинхронно публикует контент через n8n вебхук и возвращает результат (для использования с Promise)
 * @param contentId ID контента для публикации
 * @param platform Платформа для публикации
 * @returns Результат публикации
 */
async function publishViaN8nAsync(contentId: string, platform: string): Promise<any> {
  try {
    // ВСЕ платформы идут через N8N вебхуки - никаких исключений!
    
    // Стандартная логика для других платформ через n8n
    log(`[Social Publishing] Асинхронная публикация контента ${contentId} в ${platform} через n8n вебхук`);
    
    // Маппинг платформ на соответствующие n8n вебхуки
    const webhookMap: Record<string, string> = {
      'telegram': 'publish-telegram',
      'vk': 'publish-vk',
      'instagram': 'publish-instagram',
      'youtube': 'publish-youtube',
      'facebook': 'publish-facebook'
    };
    
    console.log(`🔍 [WEBHOOK-MAP] Ищем webhook для платформы: "${platform}"`);
    console.log(`🔍 [WEBHOOK-MAP] Доступные webhooks:`, Object.keys(webhookMap));
    
    const webhookName = webhookMap[platform];
    console.log(`🔍 [WEBHOOK-MAP] Найденный webhook: "${webhookName}"`);
    
    if (!webhookName) {
      console.log(`🔍 [WEBHOOK-MAP] Ошибка: webhook не найден для платформы "${platform}"`);
      throw new Error(`Платформа ${platform} не имеет настроенного вебхука`);
    }
    
    // Формируем URL вебхука
    // ИСПРАВЛЕНО: Поправлен формат URL для вызова webhook
    const baseUrl = "https://n8n.roboflow.tech/webhook";
    // Убираем возможный слеш в конце базового URL
    const baseUrlWithoutTrailingSlash = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const webhookUrl = `${baseUrlWithoutTrailingSlash}/${webhookName}`;
    
    // Логируем URL для отладки
    log(`[Social Publishing] Сформирован URL для n8n webhook: ${webhookUrl}`);
    // Для n8n вебхуков отправляем contentId и platform для YouTube
    const webhookPayload = {
      contentId,
      platform
    };
    
    // Отправляем запрос на n8n вебхук
    const response = await axios.post(webhookUrl, webhookPayload);
    
    log(`[Social Publishing] Отправлены данные в n8n вебхук: contentId=${contentId}, platform=${platform}`);
    log(`[Social Publishing] Данные извлекаются из Directus по contentId`);
    
    log(`[Social Publishing] Ответ от n8n вебхука: ${JSON.stringify(response.data)}`);
    
    // Автоматически вызываем обновление статуса после публикации
    try {
      const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
      const adminToken = process.env.DIRECTUS_TOKEN;
      const appBaseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
      
      log(`[Social Publishing] Автоматический вызов обновления статуса после асинхронной публикации в ${platform}`);
      
      await axios.post(
        `${appBaseUrl}/api/publish/update-status`,
        { contentId },
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      log(`[Social Publishing] Успешный вызов обновления статуса после асинхронной публикации в ${platform}`);
    } catch (updateStatusError: any) {
      log(`[Social Publishing] Ошибка при вызове обновления статуса после асинхронной публикации: ${updateStatusError.message}`);
      // Продолжаем даже при ошибке обновления статуса
    }
    
    return {
      success: true,
      message: `Контент успешно отправлен на публикацию в ${platform}`,
      data: response.data
    };
  } catch (error: any) {
    log(`[Social Publishing] Ошибка при публикации через n8n: ${error.message}`);
    if (error.response) {
      log(`[Social Publishing] Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    
    throw new Error(`Ошибка при публикации через n8n: ${error.message}`);
  }
}

/**
 * Публикует карусель в Instagram через прямую интеграцию с API
 * @param contentId ID контента для публикации
 * @param req Исходный запрос
 * @param res Исходный ответ
 */
async function publishInstagramCarousel(contentId: string, req: express.Request, res: express.Response) {
  try {
    log(`[Social Publishing] Публикация карусели в Instagram для контента ${contentId}`);
    
    // Получаем необходимые данные для публикации карусели
    const { token, businessAccountId, caption, imageUrl, additionalImages } = req.body;
    
    // Проверяем наличие необходимых параметров
    if (!token || !businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Для публикации карусели необходимо указать token и businessAccountId'
      });
    }
    
    // Собираем все изображения в массив
    const allImages = [imageUrl];
    if (additionalImages && Array.isArray(additionalImages)) {
      allImages.push(...additionalImages);
    }
    
    // Проверяем, что изображений достаточно для карусели
    if (allImages.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Для карусели необходимо минимум 2 изображения'
      });
    }
    
    // Публикуем карусель через Instagram Carousel API
    const result = await instagramCarouselHandler.publishCarousel(contentId, allImages, caption || '', token, businessAccountId);
    
    // Автоматически вызываем обновление статуса после публикации карусели
    try {
      const adminToken = process.env.DIRECTUS_TOKEN;
      const appBaseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
      
      log(`[Social Publishing] Автоматический вызов обновления статуса после публикации карусели в Instagram`);
      
      await axios.post(
        `${appBaseUrl}/api/publish/update-status`,
        { contentId },
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      log(`[Social Publishing] Успешный вызов обновления статуса после публикации карусели в Instagram`);
    } catch (updateStatusError: any) {
      log(`[Social Publishing] Ошибка при вызове обновления статуса после публикации карусели: ${updateStatusError.message}`);
      // Продолжаем даже при ошибке обновления статуса
    }
    
    return res.status(200).json({
      success: true,
      message: 'Запрос на публикацию карусели в Instagram обрабатывается',
      result
    });
  } catch (error: any) {
    log(`[Social Publishing] Ошибка при публикации карусели в Instagram: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Ошибка при публикации карусели в Instagram: ${error.message}`
    });
  }
}

/**
 * @api {post} /api/publish/auto-update-status Автоматически обновить статус публикации
 * @apiDescription Автоматически проверяет статусы публикации во всех выбранных соцсетях и обновляет общий статус
 * @apiVersion 1.0.0
 * @apiName AutoUpdatePublicationStatus
 * @apiGroup SocialPublishing
 * 
 * @apiParam {String} contentId ID контента для проверки
 * 
 * @apiSuccess {Boolean} success Статус операции
 * @apiSuccess {Object} result Результат обновления статуса
 */
router.post('/publish/auto-update-status', authMiddleware, async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId'
      });
    }
    
    log(`[Social Publishing] Запрос на автоматическое обновление статуса публикации для контента ${contentId}`);
    
    // Получаем токен для работы с Directus API
    const adminToken = process.env.DIRECTUS_TOKEN;
    
    // Получаем текущие данные контента через storage
    const content = await storage.getCampaignContentById(contentId, adminToken);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }
    
    log(`[Social Publishing] Получен контент: ${JSON.stringify({
      id: content.id,
      status: content.status,
      hasSocialPlatforms: !!content.socialPlatforms,
      socialPlatformsType: content.socialPlatforms ? typeof content.socialPlatforms : 'undefined'
    })}`);
    
    // Проверяем, действительно ли все выбранные платформы опубликованы
    const socialPlatforms = content.socialPlatforms || {};
    
    // Получаем список выбранных платформ
    const selectedPlatforms = Object.entries(socialPlatforms)
      .filter(([_, platformData]) => platformData?.selected)
      .map(([platform, _]) => platform);
    
    // Получаем список опубликованных платформ
    const publishedPlatforms = Object.entries(socialPlatforms)
      .filter(([_, platformData]) => platformData?.selected && platformData?.status === 'published')
      .map(([platform, _]) => platform);
      
    // Получаем список платформ с ошибками
    const failedPlatforms = Object.entries(socialPlatforms)
      .filter(([_, platformData]) => platformData?.selected && (platformData?.status === 'failed' || platformData?.error))
      .map(([platform, _]) => platform);
    
    // Получаем список платформ в ожидании
    const pendingPlatforms = Object.entries(socialPlatforms)
      .filter(([_, platformData]) => platformData?.selected && platformData?.status !== 'published' && platformData?.status !== 'failed' && !platformData?.error)
      .map(([platform, _]) => platform);
    
    // Проверяем, что все выбранные платформы либо опубликованы, либо завершились с ошибкой
    // Если все платформы достигли финального статуса (нет pending), нужно обновить общий статус
    const allFinalized = pendingPlatforms.length === 0 && selectedPlatforms.length > 0;
    const allPublished = selectedPlatforms.length > 0 && selectedPlatforms.length === publishedPlatforms.length;
    
    log(`Проверка статуса: выбрано ${selectedPlatforms.length}, опубликовано ${publishedPlatforms.length}, с ошибками ${failedPlatforms.length}, в ожидании ${pendingPlatforms.length}, allFinalized=${allFinalized}, allPublished=${allPublished}`);
    
    // Обновляем статус на "published" если все выбранные платформы опубликованы,
    // ИЛИ если статус всех платформ финализирован (опубликованы или с ошибками) и есть хотя бы одна успешная публикация
    let newStatus = content.status; // по умолчанию оставляем текущий статус
    
    if (allPublished) {
      // Если все платформы опубликованы, ставим статус published
      newStatus = 'published';
      log(`[Social Publishing] Все платформы опубликованы, устанавливаем статус published`);
    } else if (allFinalized && publishedPlatforms.length > 0) {
      // Если все платформы завершили публикацию (либо успешно, либо с ошибкой) и есть хотя бы одна успешная, также ставим published
      newStatus = 'published';
      log(`[Social Publishing] Все платформы завершили публикацию, из них ${publishedPlatforms.length} успешно, ${failedPlatforms.length} с ошибками. Устанавливаем статус published`);
    }
    
    const updatedContent = await storage.updateCampaignContent(
      contentId,
      { status: newStatus, publishedAt: new Date() },
      adminToken
    );
    
    if (updatedContent) {
      log(`[Social Publishing] Успешно установлен статус "published" для контента ${contentId} (автоматически)`);
      return res.status(200).json({
        success: true,
        message: 'Контент автоматически отмечен как опубликованный',
        result: {
          contentId,
          status: 'published'
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Не удалось обновить статус контента',
        error: 'Ошибка при обновлении статуса в Directus'
      });
    }
  } catch (error: any) {
    log(`[Social Publishing] Ошибка при автоматическом обновлении статуса: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Внутренняя ошибка сервера: ${error.message}`
    });
  }
});

/**
 * @api {post} /api/publish/update-status Обновить статус публикации после публикации во все платформы
 * @apiDescription Проверяет статусы публикации во всех выбранных соцсетях и обновляет общий статус на "published"
 * @apiVersion 1.0.0
 * @apiName UpdatePublicationStatus
 * @apiGroup SocialPublishing
 * 
 * @apiParam {String} contentId ID контента для проверки
 * 
 * @apiSuccess {Boolean} success Статус операции
 * @apiSuccess {Object} result Результат обновления статуса
 */
router.post('/publish/update-status', authMiddleware, async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId'
      });
    }
    
    log(`[Social Publishing] Запрос на обновление статуса публикации для контента ${contentId}`);
    
    // Получаем токен для работы с Directus API
    const adminToken = process.env.DIRECTUS_TOKEN;
    
    // Получаем текущие данные контента через storage
    const content = await storage.getCampaignContentById(contentId, adminToken);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }
    
    log(`[Social Publishing] Получен контент: ${JSON.stringify({
      id: content.id,
      status: content.status,
      hasSocialPlatforms: !!content.socialPlatforms,
      socialPlatformsType: content.socialPlatforms ? typeof content.socialPlatforms : 'undefined'
    })}`);
    
    // Проверяем, есть ли данные о социальных платформах
    if (!content.socialPlatforms || typeof content.socialPlatforms !== 'object') {
      log(`[Social Publishing] Контент ${contentId} не имеет данных о социальных платформах`);
      return res.status(200).json({
        success: false,
        message: 'Контент не имеет данных о социальных платформах',
        result: {
          contentId,
          status: content.status || 'draft'
        }
      });
    }

    // Получаем список выбранных платформ и их статусы
    const platforms = content.socialPlatforms as Record<string, any>;
    const platformNames = Object.keys(platforms);
    
    if (platformNames.length === 0) {
      log(`[Social Publishing] Для контента ${contentId} не выбраны платформы для публикации`);
      
      // Если контент уже имеет статус "published", то не меняем его
      if (content.status === 'published') {
        return res.status(200).json({
          success: true,
          message: 'Контент уже опубликован',
          result: {
            contentId,
            status: 'published'
          }
        });
      }
      
      // Если платформы не указаны, но запрос пришел от нашего клиента,
      // все равно обновляем статус на "published"
      const updatedContent = await storage.updateCampaignContent(
        contentId,
        { status: 'published', publishedAt: new Date() },
        adminToken
      );
      
      if (updatedContent) {
        log(`[Social Publishing] Успешно установлен статус "published" для контента ${contentId} (без платформ)`);
        return res.status(200).json({
          success: true,
          message: 'Контент отмечен как опубликованный (без платформ)',
          result: {
            contentId,
            status: 'published'
          }
        });
      } else {
        return res.status(200).json({
          success: false,
          message: 'Не удалось обновить статус контента',
          result: {
            contentId,
            status: content.status || 'draft'
          }
        });
      }
    }
    
    log(`[Social Publishing] Проверка статусов публикации для контента ${contentId} в платформах: ${platformNames.join(', ')}`);
    
    // Проверяем статусы публикации в каждой платформе
    const platformStatuses = platformNames.map(name => {
      const platform = platforms[name];
      return {
        name,
        status: platform && platform.status ? platform.status : 'pending',
        published: platform && platform.status === 'published',
        failed: platform && (platform.status === 'failed' || platform.error),
        pending: platform && platform.status !== 'published' && platform.status !== 'failed' && !platform.error
      };
    });
    
    // Записываем информацию о статусах публикации
    const publishedPlatforms = platformStatuses.filter(p => p.published);
    const failedPlatforms = platformStatuses.filter(p => p.failed);
    const pendingPlatforms = platformStatuses.filter(p => p.pending);
    
    log(`[Social Publishing] Платформы с статусом published: ${publishedPlatforms.map(p => p.name).join(', ') || 'нет'}`);
    log(`[Social Publishing] Платформы с статусом failed: ${failedPlatforms.map(p => p.name).join(', ') || 'нет'}`);
    log(`[Social Publishing] Платформы с статусом pending: ${pendingPlatforms.map(p => p.name).join(', ') || 'нет'}`);
    
    // Проверяем, все ли выбранные платформы опубликованы
    const allPublished = publishedPlatforms.length === platformStatuses.length;
    // Проверяем, что все платформы достигли финального статуса (опубликованы или с ошибкой)
    const allFinalized = pendingPlatforms.length === 0;
    
    // Определяем, нужно ли обновить статус контента
    let shouldUpdateStatus = false;
    let newStatus = content.status; // по умолчанию оставляем текущий статус
    
    if (allPublished) {
      // Если все платформы опубликованы, ставим статус published
      shouldUpdateStatus = true;
      newStatus = 'published';
      log(`[Social Publishing] Все выбранные платформы опубликованы для контента ${contentId}, обновляем общий статус`);
    } else if (allFinalized && publishedPlatforms.length > 0) {
      // Если все платформы завершили публикацию (либо успешно, либо с ошибкой) и есть хотя бы одна успешная, также ставим published
      shouldUpdateStatus = true;
      newStatus = 'published';
      log(`[Social Publishing] Все платформы завершили публикацию, из них ${publishedPlatforms.length} успешно, ${failedPlatforms.length} с ошибками. Обновляем статус на published`);
    }
    
    if (shouldUpdateStatus) {
      // Обновляем общий статус контента на "published"
      const updatedContent = await storage.updateCampaignContent(
        contentId,
        { status: newStatus, publishedAt: new Date() },
        adminToken
      );
      
      if (updatedContent) {
        log(`[Social Publishing] Успешно обновлен общий статус контента ${contentId} на "${newStatus}"`);
        return res.status(200).json({
          success: true,
          message: `Общий статус публикации обновлен на "${newStatus}"`,
          result: {
            contentId,
            status: newStatus,
            platformStatuses
          }
        });
      } else {
        log(`[Social Publishing] Ошибка при обновлении общего статуса контента ${contentId}`);
        return res.status(500).json({
          success: false,
          error: 'Не удалось обновить общий статус контента'
        });
      }
    } else {
      log(`[Social Publishing] Не все платформы завершили публикацию для контента ${contentId}, статус не обновлен`);
      return res.status(200).json({
        success: false,
        message: 'Не все выбранные платформы завершили публикацию, общий статус не обновлен',
        result: {
          contentId,
          status: content.status,
          platformStatuses
        }
      });
    }
  } catch (error: any) {
    log(`[Social Publishing] Ошибка при обновлении статуса публикации: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: `Внутренняя ошибка сервера: ${error.message}`
    });
  }
});

/**
 * Публикует Instagram Stories через новый Stories API
 * @param contentId ID контента для публикации Stories
 * @returns Результат публикации
 */
async function publishViaInstagramStoriesAPI(contentId: string): Promise<any> {
  try {
    log(`[Instagram Stories] Начинаем публикацию Stories для контента ${contentId}`);
    
    // Получаем контент из базы данных
    const adminToken = process.env.DIRECTUS_TOKEN;
    if (!adminToken) {
      throw new Error('DIRECTUS_TOKEN не найден');
    }
    
    const content = await storage.getCampaignContentById(contentId, adminToken);
    if (!content) {
      throw new Error(`Контент с ID ${contentId} не найден`);
    }
    
    log(`[Instagram Stories] Контент найден: ${content.title || 'Без названия'}, тип: ${content.contentType}`);
    
    // Получаем настройки кампании
    const campaign = await storage.getCampaignById(content.campaignId, adminToken);
    if (!campaign || !campaign.socialMediaSettings) {
      throw new Error('Настройки социальных сетей не найдены в кампании');
    }
    
    const instagramSettings = campaign.socialMediaSettings.instagram;
    if (!instagramSettings || !instagramSettings.username || !instagramSettings.password) {
      throw new Error('Настройки Instagram (username/password) не найдены в кампании');
    }
    
    log(`[Instagram Stories] Использую аккаунт: ${instagramSettings.username}`);
    
    // Определяем изображение для Stories
    let imagePath = content.imageUrl;
    if (!imagePath && content.additionalImages && content.additionalImages.length > 0) {
      // Используем первое изображение из дополнительных
      imagePath = content.additionalImages[0];
    }
    if (!imagePath) {
      // Используем случайное изображение для тестирования
      imagePath = 'https://picsum.photos/1080/1920';
      log(`[Instagram Stories] Изображение не указано, используем тестовое: ${imagePath}`);
    }
    
    // Определяем текст для Stories
    const storyText = content.content || content.title || '';
    
    // Подготавливаем данные для публикации через Stories API
    const storiesPayload = {
      username: instagramSettings.username,
      password: instagramSettings.password,
      imagePath: imagePath,
      caption: storyText
    };
    
    log(`[Instagram Stories] Отправляем запрос к Stories API: ${JSON.stringify({ ...storiesPayload, password: '***' })}`);
    
    // Публикуем через наш новый Stories API
    const publishResult = await axios.post('http://localhost:5000/api/instagram-stories/publish-simple', storiesPayload, {
      timeout: 90000, // 90 секунд timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = publishResult.data;
    log(`[Instagram Stories] Результат публикации: ${JSON.stringify(responseData)}`);
    
    if (responseData.success && responseData.result) {
      const result = responseData.result;
      
      // Обновляем статус в базе данных
      try {
        await storage.updateCampaignContentSocialPlatforms(
          contentId,
          {
            instagram: {
              status: 'published',
              storyId: result.storyId,
              storyUrl: result.storyUrl,
              publishedAt: new Date().toISOString(),
              message: result.message || 'Успешно опубликовано в Instagram Stories'
            }
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
        publishedAt: result.publishedAt || new Date().toISOString(),
        message: result.message || 'Успешно опубликовано в Instagram Stories'
      };
    } else {
      throw new Error(responseData.error || 'Неизвестная ошибка при публикации Stories');
    }
    
  } catch (error: any) {
    log(`[Instagram Stories] Ошибка публикации: ${error.message}`);
    
    // Обновляем статус как failed
    try {
      const adminToken = process.env.DIRECTUS_TOKEN;
      if (adminToken) {
        await storage.updateCampaignContentSocialPlatforms(
          contentId,
          {
            instagram: {
              status: 'failed',
              error: error.message,
              failedAt: new Date().toISOString()
            }
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
 * @api {post} /api/publish/test-stories Тестовая публикация Instagram Stories
 * @apiDescription Тестирует публикацию Instagram Stories с интерактивными элементами
 * @apiVersion 1.0.0
 * @apiName TestInstagramStories
 * @apiGroup SocialPublishing
 */
router.post('/publish/test-stories', async (req, res) => {
  try {
    log(`[Test Stories] Получен запрос на тестовую публикацию Stories`);
    
    const { username, password, interactive } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать username и password для тестирования'
      });
    }
    
    // Импортируем Instagram Private Service
    const { default: InstagramPrivateService } = await import('../services/instagram-private-service.js');
    const igService = InstagramPrivateService;
    
    // Тестовые данные
    const testImagePath = './uploads/smmtest.jpg';
    const testText = 'Тестовая Instagram Stories с интерактивными элементами! 🚀';
    
    // Тестовые интерактивные элементы, если не переданы
    const defaultInteractive = {
      polls: [
        {
          question: 'Нравится ли вам наш контент?',
          options: ['Да!', 'Супер!']
        }
      ],
      sliders: [
        {
          question: 'Оцените от 1 до 10',
          emoji: '⭐'
        }
      ],
      questions: [
        {
          text: 'Задайте ваш вопрос'
        }
      ]
    };
    
    const elementsToUse = interactive || defaultInteractive;
    
    log(`[Test Stories] Публикация тестового Stories для ${username} с интерактивными элементами`);
    
    let result;
    
    if (Object.keys(elementsToUse).length > 0) {
      // Публикация с интерактивными элементами
      result = await igService.publishStory(username, password, {
        imageUrl: testImagePath,
        content: testText,
        interactiveElements: elementsToUse
      });
    } else {
      // Простая публикация без интерактивных элементов
      result = await igService.publishStory(username, password, {
        imageUrl: testImagePath,
        content: testText
      });
    }
    
    log(`[Test Stories] Результат публикации: ${JSON.stringify(result)}`);
    
    return res.status(200).json({
      success: result.success,
      message: result.success ? 
        'Тестовая Instagram Stories успешно опубликована!' : 
        'Ошибка при публикации тестовой Stories',
      result: result
    });
    
  } catch (error: any) {
    log(`[Test Stories] Ошибка при тестовой публикации Stories: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Ошибка тестирования Stories: ${error.message}`
    });
  }
});

/**
 * Обновленная функция для публикации Instagram Stories
 */
async function publishViaInstagramStoriesAPIUpdated(contentId: string, interactive: any = null): Promise<any> {
  const { InstagramPrivateService } = await import('../services/instagram-private-service.js');
  const instagramService = new InstagramPrivateService();
  
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
        interactiveElements: interactive || [],
        username: instagramSettings.username
      };
    }
    
    // Публикуем через Instagram Private Service
    const result = await instagramService.publishStory(
      instagramSettings.username,
      instagramSettings.password,
      storyData
    );
    
    log(`[Instagram Stories] Результат публикации: ${JSON.stringify(result)}`);
    
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
 * @api {post} /api/publish/test-story-by-id Тестовая публикация Stories по ID
 * @apiDescription Тестирует публикацию конкретной Stories по её ID
 * @apiVersion 1.0.0
 * @apiName TestStoriesByID
 * @apiGroup SocialPublishing
 */
router.post('/publish/test-story-by-id', async (req, res) => {
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