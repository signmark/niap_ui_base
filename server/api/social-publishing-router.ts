/**
 * Маршрутизатор публикации в социальные сети
 * Этот файл отвечает за перенаправление запросов публикации контента
 * на соответствующие обработчики для разных социальных платформ.
 */

import express from 'express';
import axios from 'axios';
import { log } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import * as instagramCarouselHandler from './instagram-carousel-webhook';
import { storage } from '../storage';
import { SocialPlatform } from '@shared/schema';
import { instagramService } from '../services/social/instagram-service';

const router = express.Router();

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
    
    // Получаем контент для проверки типа с использованием вспомогательной утилиты
    const { getDirectusContentById } = await import('../utils/directus-admin-helper');
    const directusContent = await getDirectusContentById('campaign_content', contentId);
    
    if (!directusContent) {
      log(`[Social Publishing] Ошибка: не найден контент с ID ${contentId}`);
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // Преобразуем данные из Directus в формат CampaignContent
    const content = {
      id: directusContent.id,
      userId: directusContent.user_id,
      content: directusContent.content,
      campaignId: directusContent.campaign_id,
      status: directusContent.status,
      contentType: directusContent.content_type || "text",
      title: directusContent.title || null,
      imageUrl: directusContent.image_url,
      videoUrl: directusContent.video_url,
      prompt: directusContent.prompt || "",
      scheduledAt: directusContent.scheduled_at ? new Date(directusContent.scheduled_at) : null,
      createdAt: new Date(directusContent.created_at),
      socialPlatforms: directusContent.social_platforms,
      publishedPlatforms: directusContent.published_platforms || [],
      keywords: directusContent.keywords || [] 
    };
    
    // Если тип контента stories, возвращаем ошибку, так как сторис должны публиковаться напрямую
    if (content.contentType === 'stories') {
      log(`[Social Publishing] Ошибка: попытка опубликовать контент типа 'stories' через n8n`);
      return res.status(400).json({
        success: false,
        error: 'Для публикации сторис используйте отдельный эндпоинт /api/publish/stories'
      });
    }
    
    // Поддерживаем два формата: объект {platformName: boolean} и массив строк ["platform1", "platform2"]
    log(`[Social Publishing] Проверка формата объекта platforms: ${JSON.stringify(platforms)}`);
    const validPlatformKeys = ['telegram', 'vk', 'instagram', 'facebook'];
    
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
    
    // Получаем токен администратора из сервиса DirectusAuthManager
    // Импортируем его динамически, чтобы избежать проблем с циклическими зависимостями
    const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
    
    // Получаем токен из активных сессий администратора или используем токен из переменных окружения
    let adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'zQJK4b84qrQeuTYS2-x9QqpEyDutJGsb';
    const sessions = directusAuthManager.getAllActiveSessions();
    
    if (sessions.length > 0) {
      // Берем самый свежий токен из активных сессий
      adminToken = sessions[0].token;
      log(`[Social Publishing] Используется токен администратора из активной сессии`);
    } else {
      log(`[Social Publishing] Активные сессии не найдены, используется токен из переменных окружения`);
    }
    
    // Сначала сохраняем информацию о выбранных платформах в контент
    // Это очень важно - сохраняем структуру платформ перед публикацией
    const platformsData: Record<string, any> = {};
    
    selectedPlatforms.forEach(platform => {
      platformsData[platform] = {
        selected: true,
        status: 'pending' // Начальный статус - ожидание публикации
      };
    });
    
    try {
      log(`[Social Publishing] Обновляем статусы платформ для контента ${contentId} с токеном администратора`);
      
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
          if (!['telegram', 'vk', 'instagram', 'facebook'].includes(platform)) {
            publishResults.push({
              platform,
              success: false,
              error: `Платформа ${platform} не поддерживается`
            });
            continue;
          }
          
          log(`[Social Publishing] Запускаем публикацию контента ${contentId} в ${platform}`);
          
          // Для Facebook используем прямой API вместо n8n
          let result;
          if (platform === 'facebook') {
            log(`[Social Publishing] Использование прямого API для Facebook вместо n8n вебхука`);
            // Отправляем запрос на прямой эндпоинт Facebook
            const appBaseUrl = process.env.APP_URL || `http://0.0.0.0:${process.env.PORT || 5000}`;
            const facebookWebhookUrl = `${appBaseUrl}/api/facebook-webhook-direct`;
            
            log(`[Social Publishing] Отправка запроса на Facebook webhook: ${facebookWebhookUrl}`);
            
            const facebookResponse = await axios.post(facebookWebhookUrl, { contentId });
            result = facebookResponse.data;
          } else {
            // Для остальных платформ используем n8n вебхук
            result = await publishViaN8nAsync(contentId, platform);
          }
          
          publishResults.push({
            platform,
            success: true,
            result
          });
        } catch (error: any) {
          log(`[Social Publishing] Ошибка при публикации в ${platform}: ${error.message}`);
          
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
    const { contentId, platform } = req.body;
    
    if (!contentId || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId и platform'
      });
    }
    
    log(`[Social Publishing] Запрос на публикацию контента ${contentId} в ${platform}`);
    
    // Получаем контент для проверки его типа
    const content = await storage.getCampaignContentById(contentId);
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // Если тип контента stories, используем прямую публикацию
    if (content.contentType === 'stories') {
      log(`[Social Publishing] Обнаружен контент типа 'stories', используем прямую публикацию`);
      
      try {
        log(`[Social Publishing] Пытаемся получить настройки кампании для ID: ${content.campaignId}`);
        const campaignSettings = await storage.getCampaignById(content.campaignId);
        
        if (!campaignSettings) {
          log(`[Social Publishing] Не найдены настройки кампании для ID: ${content.campaignId}. Попытаемся получить настройки через запрос к user_campaigns`);
          
          // Получаем токен администратора с улучшенной логикой получения токена
          const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
          let adminToken = null;
          
          // Сначала проверяем активные сессии
          const sessions = directusAuthManager.getAllActiveSessions();
          if (sessions && sessions.length > 0) {
            adminToken = sessions[0].token;
            log(`[Social Publishing] Используем токен администратора из активной сессии`);
          } else {
            // Если нет активных сессий, пробуем получить токен другими методами
            adminToken = await directusAuthManager.getAdminToken();
            
            if (!adminToken) {
              adminToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
              log(`[Social Publishing] Используем токен администратора из переменных окружения`);
            } else {
              log(`[Social Publishing] Используем токен администратора из метода getAdminToken`);
            }
          }
          
          if (!adminToken) {
            log(`[Social Publishing] Не удалось получить токен администратора для запроса настроек кампании. Ни одного метода не сработало.`, 'error');
            return res.status(500).json({
              success: false,
              error: `Не удалось получить токен администратора для запроса настроек кампании`
            });
          }
          
          // Пробуем получить настройки кампании напрямую с улучшенной обработкой ошибок
          try {
            const directusApi = await import('../lib/directus').then(m => m.directusApi);
            log(`[Social Publishing] Выполняем запрос к /items/user_campaigns/${content.campaignId}`);
            
            // Подробное логирование запроса для отладки
            log(`[Social Publishing] Используем токен администратора: ${adminToken.substring(0, 10)}...`);
            
            // Отправляем запрос с обработкой различных сценариев ошибок
            try {
              const response = await directusApi.get(`/items/user_campaigns/${content.campaignId}`, {
                headers: {
                  'Authorization': `Bearer ${adminToken}`
                }
              });
              
              if (response.data?.data) {
                log(`[Social Publishing] Успешно получены настройки кампании напрямую: ${response.data.data.name}`);
                
                // ВАЖНО! Обновляем переменную campaignSettings в родительской области видимости
                campaignSettings = response.data.data;
                
                // Проверяем, что socialSettings присутствуют
                if (!campaignSettings.socialSettings) {
                  log(`[Social Publishing] В настройках кампании отсутствуют настройки социальных сетей, создаем пустой объект`);
                  campaignSettings.socialSettings = {};
                }
                
                // Проверяем настройки для Instagram, которые необходимы для сторис
                if (platform.toLowerCase() === 'instagram' && (!campaignSettings.socialSettings.instagram || 
                    !campaignSettings.socialSettings.instagram.token || 
                    !campaignSettings.socialSettings.instagram.businessAccountId)) {
                  log(`[Social Publishing] Отсутствуют необходимые настройки Instagram в кампании: 
                    token: ${Boolean(campaignSettings.socialSettings.instagram?.token)}, 
                    businessAccountId: ${Boolean(campaignSettings.socialSettings.instagram?.businessAccountId)}`, 'warn');
                  
                  // Если это Instagram сторис и нет необходимых настроек, возвращаем ошибку
                  if (content.contentType === 'stories') {
                    return res.status(400).json({
                      success: false,
                      error: `В настройках кампании отсутствуют необходимые параметры для публикации в Instagram`
                    });
                  }
                }
              } else {
                log(`[Social Publishing] Не удалось получить настройки кампании напрямую (пустой ответ API)`, 'error');
                return res.status(404).json({
                  success: false,
                  error: `Не найдены настройки кампании для ID ${content.campaignId}`
                });
              }
            } catch (apiError) {
              // Получаем детали ошибки API
              const errorDetails = apiError.response ? 
                `${apiError.response.status}: ${JSON.stringify(apiError.response.data || {})}` : 
                apiError.message;
              
              log(`[Social Publishing] Ошибка API Directus при запросе настроек кампании: ${errorDetails}`, 'error');
              
              // Если ошибка 401, значит токен истек или недействителен
              if (apiError.response && apiError.response.status === 401) {
                log(`[Social Publishing] Токен администратора недействителен, пытаемся получить новый токен`);
                
                // Пытаемся получить новый токен администратора
                const newToken = await directusAuthManager.refreshAdminToken();
                
                if (newToken) {
                  log(`[Social Publishing] Получен новый токен администратора, повторяем запрос`);
                  
                  // Повторяем запрос с новым токеном
                  try {
                    // Используем API с новым токеном
                    const { directusApi } = await import('../lib/directus');
                    const retryResponse = await directusApi.get(`/items/user_campaigns/${content.campaignId}`, {
                      headers: {
                        'Authorization': `Bearer ${newToken}`
                      }
                    });
                    
                    if (retryResponse.data?.data) {
                      log(`[Social Publishing] Успешно получены настройки кампании с новым токеном`);
                      campaignSettings = retryResponse.data.data;
                      
                      if (!campaignSettings.socialSettings) {
                        campaignSettings.socialSettings = {};
                      }
                    } else {
                      throw new Error('Пустой ответ API после обновления токена');
                    }
                  } catch (retryError) {
                    throw new Error(`Ошибка повторного запроса после обновления токена: ${retryError.message}`);
                  }
                } else {
                  throw new Error('Не удалось получить новый токен администратора');
                }
              } else {
                // Другие ошибки API
                throw apiError;
              }
            }
          } catch (directusError) {
            log(`[Social Publishing] Ошибка при прямом запросе настроек кампании: ${directusError.message}`, 'error');
            return res.status(404).json({
              success: false,
              error: `Не найдены настройки кампании для ID ${content.campaignId}: ${directusError.message}`
            });
          }
        }
        
        // Получаем сервис в зависимости от платформы
        let result;
        switch (platform.toLowerCase()) {
          case 'vk':
            const { vkService } = require('../services/social/vk-service');
            result = await vkService.publishToPlatform(content, platform, campaignSettings.socialSettings);
            break;
            
          case 'instagram':
            const { instagramService } = require('../services/social/instagram-service');
            // Передаем campaignSettings.social_media_settings, если они есть, или campaignSettings.socialSettings как запасной вариант
            // это нужно, потому что в разных местах используются разные структуры
            const instagramSettings = campaignSettings.social_media_settings || campaignSettings.socialSettings;
            
            // Дополнительное логирование для отладки
            log(`[Social Publishing] Оригинальная структура настроек: ${JSON.stringify({
              social_media_settings: campaignSettings.social_media_settings ? 'имеется' : 'отсутствует',
              socialSettings: campaignSettings.socialSettings ? 'имеется' : 'отсутствует',
            })}`);
            
            // Проверяем наличие настроек Instagram
            if (!instagramSettings?.instagram) {
              log(`[Social Publishing] ВНИМАНИЕ: Не найдены настройки Instagram, используем пустой объект`, 'warn');
            }
            
            // Проверяем token/accessToken
            const token = instagramSettings?.instagram?.accessToken || instagramSettings?.instagram?.token || null;
            if (!token) {
              log(`[Social Publishing] ВНИМАНИЕ: Отсутствует токен Instagram`, 'warn');
            }
            
            // Проверяем businessAccountId
            const businessAccountId = instagramSettings?.instagram?.businessAccountId || null;
            if (!businessAccountId) {
              log(`[Social Publishing] ВНИМАНИЕ: Отсутствует businessAccountId Instagram`, 'warn');
            }
            
            log(`[Social Publishing] Instagram публикация сторис, настройки: ${JSON.stringify({
              token: token ? `${token.substring(0, 5)}...` : null,
              businessAccountId
            })}`);
            
            result = await instagramService.publishStory(content, 
                         {
                           token: token,
                           accessToken: token, // дублируем для совместимости
                           businessAccountId: businessAccountId
                         },
                         instagramSettings);
            break;
            
          default:
            return res.status(400).json({
              success: false,
              error: `Платформа ${platform} не поддерживает сторис`
            });
        }
        
        // Обновляем статус в базе данных
        await storage.updateContentPlatformStatus(contentId, platform, result);
        
        return res.status(200).json({
          success: true,
          message: `Сторис успешно опубликован в ${platform}`,
          result
        });
      } catch (error: any) {
        log(`[Social Publishing] Ошибка при публикации сторис в ${platform}: ${error.message}`);
        return res.status(500).json({
          success: false,
          error: `Ошибка при публикации сторис: ${error.message}`
        });
      }
    }
    
    // Для обычного контента - стандартная маршрутизация
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
      'facebook': 'publish-facebook'
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
    // Для n8n вебхуков отправляем только contentId, как указано в требованиях
    const webhookPayload = {
      contentId
    };
    
    // Отправляем запрос на n8n вебхук только с contentId
    const response = await axios.post(webhookUrl, webhookPayload);
    
    log(`[Social Publishing] Отправлены данные в n8n вебхук: contentId=${contentId}, platform=${platform}`);
    log(`[Social Publishing] Данные извлекаются из Directus по contentId`);
    
    log(`[Social Publishing] Ответ от n8n вебхука: ${JSON.stringify(response.data)}`);
    
    // Обновляем статус платформы после успешной публикации
    try {
      log(`[Social Publishing] Обновление статуса платформы ${platform} для контента ${contentId} на "published"`);
      
      // Получаем токен администратора
      const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
      let adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'zQJK4b84qrQeuTYS2-x9QqpEyDutJGsb';
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
    // Специальная логика для Facebook - используем прямую публикацию, а не n8n
    if (platform.toLowerCase() === 'facebook') {
      log(`[Social Publishing] Прямая публикация контента ${contentId} в Facebook через direct webhook`);
      
      // Вызываем напрямую Facebook webhook-direct
      try {
        // Получаем базовый URL приложения для формирования полного пути
        const appBaseUrl = process.env.APP_URL || `http://0.0.0.0:${process.env.PORT || 5000}`;
        const facebookWebhookUrl = `${appBaseUrl}/api/facebook-webhook-direct`;
        
        log(`[Social Publishing] Отправка запроса на Facebook webhook: ${facebookWebhookUrl}`);
        
        const response = await axios.post(facebookWebhookUrl, { contentId });
        
        log(`[Social Publishing] Facebook webhook-direct ответ: ${JSON.stringify(response.data)}`);
        return response.data;
      } catch (fbError: any) {
        log(`[Social Publishing] Ошибка при прямой публикации в Facebook: ${fbError.message}`);
        
        if (fbError.response) {
          log(`[Social Publishing] Детали ошибки Facebook публикации: ${JSON.stringify(fbError.response.data)}`);
        }
        
        throw new Error(`Ошибка при публикации в Facebook: ${fbError.message}`);
      }
    }
    
    // Стандартная логика для других платформ через n8n
    log(`[Social Publishing] Асинхронная публикация контента ${contentId} в ${platform} через n8n вебхук`);
    
    // Маппинг платформ на соответствующие n8n вебхуки
    const webhookMap: Record<string, string> = {
      'telegram': 'publish-telegram',
      'vk': 'publish-vk',
      'instagram': 'publish-instagram'
      // 'facebook' удален из маппинга, так как теперь используется прямой код
    };
    
    const webhookName = webhookMap[platform];
    if (!webhookName) {
      throw new Error(`Платформа ${platform} не имеет настроенного вебхука`);
    }
    
    // Формируем URL вебхука
    // ИСПРАВЛЕНО: Поправлен формат URL для вызова webhook
    const baseUrl = "https://n8n.nplanner.ru/webhook";
    // Убираем возможный слеш в конце базового URL
    const baseUrlWithoutTrailingSlash = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const webhookUrl = `${baseUrlWithoutTrailingSlash}/${webhookName}`;
    
    // Логируем URL для отладки
    log(`[Social Publishing] Сформирован URL для n8n webhook: ${webhookUrl}`);
    // Для n8n вебхуков отправляем только contentId, как указано в требованиях
    const webhookPayload = {
      contentId
    };
    
    // Отправляем запрос на n8n вебхук
    const response = await axios.post(webhookUrl, webhookPayload);
    
    log(`[Social Publishing] Отправлены данные в n8n вебхук: contentId=${contentId}, platform=${platform}`);
    log(`[Social Publishing] Данные извлекаются из Directus по contentId`);
    
    log(`[Social Publishing] Ответ от n8n вебхука: ${JSON.stringify(response.data)}`);
    
    // Автоматически вызываем обновление статуса после публикации
    try {
      const { getAdminToken } = await import('../utils/directus-admin-helper');
      const adminToken = await getAdminToken();
      const appBaseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
      
      if (!adminToken) {
        log(`[Social Publishing] Ошибка: Не удалось получить токен администратора для обновления статуса`);
        return;
      }
      
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
      const adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'zQJK4b84qrQeuTYS2-x9QqpEyDutJGsb';
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
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'zQJK4b84qrQeuTYS2-x9QqpEyDutJGsb';
    
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
    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'zQJK4b84qrQeuTYS2-x9QqpEyDutJGsb';
    
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
 * @api {post} /api/publish/stories Публикация сторис в социальные сети
 * @apiDescription Прямая публикация сторис без использования n8n webhook
 * @apiVersion 1.0.0
 * @apiName PublishStories
 * @apiGroup SocialPublishing
 * 
 * @apiParam {String} contentId ID контента для публикации
 * @apiParam {String} platform Платформа для публикации (vk, instagram)
 * 
 * @apiSuccess {Boolean} success Статус операции
 * @apiSuccess {Object} result Результат публикации
 * 
 * @apiNote Для Instagram важно использовать параметр media_type="STORIES" (а не "IMAGE"/"VIDEO")
 * и не использовать параметр is_story=true, который не принимается API.
 */
router.post('/publish/stories', authMiddleware, async (req, res) => {
  try {
    const { contentId, platform } = req.body;
    
    // Расширенное логирование для диагностики
    log(`[Social Publishing] Получен запрос на публикацию сторис:`, 'stories');
    log(`[Social Publishing] - contentId: ${contentId}`, 'stories');
    log(`[Social Publishing] - platform: ${platform}`, 'stories');
    log(`[Social Publishing] - body: ${JSON.stringify(req.body)}`, 'stories');
    
    // Детальное логирование для отладки
    log(`[Social Publishing] ПОЛНАЯ СТРУКТУРА ЗАПРОСА: ${JSON.stringify({
      headers: req.headers,
      query: req.query,
      body: req.body,
      params: req.params
    }, null, 2)}`, 'stories', 'warn');
    
    if (!contentId || !platform) {
      log(`[Social Publishing] Ошибка: не указан contentId или platform`, 'stories', 'error');
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId и platform'
      });
    }
    
    // Проверяем, что платформа поддерживает сторис
    if (!['instagram', 'vk'].includes(platform)) {
      log(`[Social Publishing] Ошибка: платформа ${platform} не поддерживает сторис`, 'stories', 'error');
      return res.status(400).json({
        success: false,
        error: `Платформа ${platform} не поддерживает сторис`
      });
    }
    
    log(`[Social Publishing] Запрос на публикацию сторис ${contentId} в ${platform}`);
    
    // Получаем контент
    const content = await storage.getCampaignContentById(contentId);
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // КРИТИЧНО: обработка JSON строк для медиа прямо в роутере
    try {
      log(`[Social Publishing] Проверка и обработка медиа в формате JSON строк`, 'stories', 'warn');
      
      // Логирование исходных данных
      log(`[Social Publishing] Типы данных полей:
        additionalImages: ${typeof content.additionalImages} ${content.additionalImages ? (Array.isArray(content.additionalImages) ? 'это массив' : 'не массив') : 'undefined'}
        additionalMedia: ${typeof content.additionalMedia} ${content.additionalMedia ? (Array.isArray(content.additionalMedia) ? 'это массив' : 'не массив') : 'undefined'}`, 'stories');
      
      // Обработка additionalImages если это JSON строка
      if (content.additionalImages && typeof content.additionalImages === 'string') {
        log(`[Social Publishing] additionalImages это строка, пробуем распарсить JSON: ${content.additionalImages}`, 'stories');
        try {
          content.additionalImages = JSON.parse(content.additionalImages);
          log(`[Social Publishing] Успешно распарсили JSON строку additionalImages: ${JSON.stringify(content.additionalImages)}`, 'stories');
        } catch (parseError) {
          log(`[Social Publishing] Ошибка при парсинге JSON строки additionalImages: ${parseError.message}`, 'stories', 'error');
        }
      }
      
      // Обработка additionalMedia если это JSON строка
      if (content.additionalMedia && typeof content.additionalMedia === 'string') {
        log(`[Social Publishing] additionalMedia это строка, пробуем распарсить JSON: ${content.additionalMedia}`, 'stories');
        try {
          content.additionalMedia = JSON.parse(content.additionalMedia);
          log(`[Social Publishing] Успешно распарсили JSON строку additionalMedia: ${JSON.stringify(content.additionalMedia)}`, 'stories');
        } catch (parseError) {
          log(`[Social Publishing] Ошибка при парсинге JSON строки additionalMedia: ${parseError.message}`, 'stories', 'error');
        }
      }
    } catch (error) {
      log(`[Social Publishing] Общая ошибка при обработке JSON строк: ${error.message}`, 'stories', 'error');
    }
    
    // Проверяем, что тип контента - stories
    if (content.contentType !== 'stories') {
      return res.status(400).json({
        success: false,
        error: 'Этот эндпоинт предназначен только для публикации сторис'
      });
    }
    
    // Проверяем поддерживаемые платформы
    if (!['vk', 'instagram'].includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Платформа ${platform} не поддерживает публикацию сторис через прямой API`
      });
    }
    
    try {
      // Получаем настройки кампании
      let campaignSettings = await storage.getCampaignById(content.campaignId);
      log(`[Social Publishing] Получены настройки кампании для сторис: ${campaignSettings ? 'Да' : 'Нет'}`, 'stories');
      
      // Если настройки не получены через стандартный метод, пробуем получить через прямой API запрос
      if (!campaignSettings || !campaignSettings.socialSettings) {
        log(`[Social Publishing] Не удалось получить настройки через storage, пробуем через API`, 'stories');
        
        // Получаем админский токен для запроса
        const adminToken = await storage.getAdminToken();
        if (!adminToken) {
          log(`[Social Publishing] Ошибка: не удалось получить токен администратора`, 'stories', 'error');
          return res.status(500).json({
            success: false,
            error: 'Ошибка авторизации при получении настроек кампании'
          });
        }
        
        try {
          const directusApi = await import('../lib/directus').then(m => m.directusApi);
          log(`[Social Publishing] Выполняем запрос к /items/user_campaigns/${content.campaignId}`, 'stories');
          
          const response = await directusApi.get(`/items/user_campaigns/${content.campaignId}`, {
            headers: {
              'Authorization': `Bearer ${adminToken}`
            }
          });
          
          if (response.data?.data) {
            log(`[Social Publishing] Успешно получены настройки кампании напрямую: ${response.data.data.name}`, 'stories');
            
            // Обновляем переменную campaignSettings
            campaignSettings = response.data.data;
            
            // Проверяем, что socialSettings присутствуют
            if (!campaignSettings.socialSettings) {
              log(`[Social Publishing] В настройках кампании отсутствуют настройки социальных сетей, создаем пустой объект`, 'stories');
              campaignSettings.socialSettings = {};
            }
          } else {
            log(`[Social Publishing] Не удалось получить настройки кампании напрямую`, 'stories', 'error');
            return res.status(404).json({
              success: false,
              error: `Не найдены настройки кампании для ID ${content.campaignId}`
            });
          }
        } catch (directusError) {
          log(`[Social Publishing] Ошибка при прямом запросе настроек кампании: ${directusError.message}`, 'stories', 'error');
          return res.status(500).json({
            success: false,
            error: `Ошибка при получении настроек кампании: ${directusError.message}`
          });
        }
      }
      
      // Финальная проверка настроек
      if (!campaignSettings) {
        return res.status(404).json({
          success: false,
          error: `Не найдены настройки кампании для ID ${content.campaignId}`
        });
      }
      
      // Публикуем сторис в зависимости от платформы
      let result;
      switch (platform.toLowerCase()) {
        case 'vk':
          log(`[Social Publishing] Инициализация VK сервиса для публикации сторис`, 'stories');
          const { vkService } = require('../services/social/vk-service');
          result = await vkService.publishToPlatform(content, platform, campaignSettings.socialSettings);
          log(`[Social Publishing] Результат публикации сторис в VK: ${JSON.stringify(result)}`, 'stories');
          break;
          
        case 'instagram':
          // Проверяем настройки Instagram
          log(`[Social Publishing] Настройки campaignSettings: ${JSON.stringify(campaignSettings)}`, 'stories');
          
          // Доступ к полю social_media_settings в соответствии со структурой таблицы кампании
          const socialMediaSettings = campaignSettings.social_media_settings || {};
          log(`[Social Publishing] social_media_settings: ${JSON.stringify(socialMediaSettings)}`, 'stories');
          
          // Получаем настройки Instagram из social_media_settings
          const instagramSettings = socialMediaSettings.instagram || {};
          log(`[Social Publishing] instagram настройки: ${JSON.stringify(instagramSettings)}`, 'stories');
          
          // Получаем токен из настроек - проверяем оба возможных поля
          const instToken = instagramSettings.token || instagramSettings.accessToken;
          const businessId = instagramSettings.businessAccountId;
          
          log(`[Social Publishing] Извлеченный токен: ${instToken ? 'Присутствует' : 'Отсутствует'}, businessAccountId: ${businessId || 'Отсутствует'}`, 'stories');
          
          // Проверяем наличие всех необходимых настроек
          if (!instagramSettings || !instToken || !businessId) {
            log(`[Social Publishing] Ошибка: не найдены корректные настройки Instagram в кампании`, 'stories', 'error');
            log(`[Social Publishing] Детали: token/accessToken=${instToken ? 'присутствует' : 'отсутствует'}, businessAccountId=${businessId || 'отсутствует'}`, 'stories', 'error');
            
            return res.status(400).json({
              success: false,
              error: 'Не найдены корректные настройки Instagram в кампании'
            });
          }

          log(`[Social Publishing] Настройки Instagram получены:`, 'stories');
          log(`[Social Publishing] - Business Account ID: ${businessId}`, 'stories');
          log(`[Social Publishing] - Access Token: ${instToken ? 'Присутствует' : 'Отсутствует'}`, 'stories');
          
          // Проверяем наличие медиафайлов для сторис, с учетом всех возможных полей для медиа
          // Пытаемся преобразовать строки JSON в объекты для всех полей медиа
          try {
            if (content.additionalImages && typeof content.additionalImages === 'string') {
              try {
                log(`[Social Publishing] Поле additionalImages - строка, попытка парсинга JSON: ${content.additionalImages}`, 'stories');
                content.additionalImages = JSON.parse(content.additionalImages);
                log(`[Social Publishing] Успешно распарсили JSON в поле additionalImages`, 'stories');
              } catch (e) {
                log(`[Social Publishing] Ошибка парсинга JSON в поле additionalImages: ${e.message}`, 'stories', 'error');
              }
            }
            
            if (content.additionalMedia && typeof content.additionalMedia === 'string') {
              try {
                log(`[Social Publishing] Поле additionalMedia - строка, попытка парсинга JSON: ${content.additionalMedia}`, 'stories');
                content.additionalMedia = JSON.parse(content.additionalMedia);
                log(`[Social Publishing] Успешно распарсили JSON в поле additionalMedia`, 'stories');
              } catch (e) {
                log(`[Social Publishing] Ошибка парсинга JSON в поле additionalMedia: ${e.message}`, 'stories', 'error');
              }
            }
            
            if (content.additional_images && typeof content.additional_images === 'string') {
              try {
                log(`[Social Publishing] Поле additional_images - строка, попытка парсинга JSON: ${content.additional_images}`, 'stories');
                content.additional_images = JSON.parse(content.additional_images);
                log(`[Social Publishing] Успешно распарсили JSON в поле additional_images`, 'stories');
              } catch (e) {
                log(`[Social Publishing] Ошибка парсинга JSON в поле additional_images: ${e.message}`, 'stories', 'error');
              }
            }
          } catch (error) {
            log(`[Social Publishing] Общая ошибка при обработке JSON медиа: ${error.message}`, 'stories', 'error');
          }
          
          // После обработки JSON строк, проверяем наличие медиа
          const additionalImagesField = content.additionalImages || content.additional_images || content.additionalMedia;
          log(`[Social Publishing] Тип additionalImagesField: ${typeof additionalImagesField}, isArray: ${Array.isArray(additionalImagesField)}, length: ${additionalImagesField && Array.isArray(additionalImagesField) ? additionalImagesField.length : 'N/A'}`, 'stories');
          
          const hasAdditionalMedia = Boolean(
            additionalImagesField && (
              (Array.isArray(additionalImagesField) && additionalImagesField.length > 0) ||
              (typeof additionalImagesField === 'string' && additionalImagesField.trim() !== '')
            )
          );
          
          const hasMedia = Boolean(content.imageUrl || content.videoUrl || hasAdditionalMedia);
          
          log(`[Social Publishing] Проверка медиафайлов для сторис: imageUrl=${Boolean(content.imageUrl)}, videoUrl=${Boolean(content.videoUrl)}, hasAdditionalMedia=${hasAdditionalMedia}`, 'stories');
          
          if (!hasMedia) {
            log(`[Social Publishing] Ошибка: не найдены медиафайлы для публикации сторис в Instagram`, 'stories', 'error');
            log(`[Social Publishing] СОДЕРЖИМОЕ КОНТЕНТА (ДЕТАЛЬНО):
              additionalImages: ${JSON.stringify(content.additionalImages)}
              additionalMedia: ${JSON.stringify(content.additionalMedia)}
              additional_images: ${JSON.stringify(content.additional_images)}
              imageUrl: ${content.imageUrl || 'не указан'}
              videoUrl: ${content.videoUrl || 'не указан'}
            `, 'stories', 'error');
            log(`[Social Publishing] Детали контента: ${JSON.stringify({
              contentId,
              contentType: content.contentType,
              hasImageUrl: Boolean(content.imageUrl),
              hasVideoUrl: Boolean(content.videoUrl),
              hasAdditionalImages: hasAdditionalMedia,
              additionalImagesType: additionalImagesField ? typeof additionalImagesField : 'undefined'
            })}`, 'stories', 'error');
            
            return res.status(400).json({
              success: false,
              error: 'Для публикации сторис в Instagram необходимо указать изображение или видео'
            });
          }
          
          // Если есть дополнительные медиа, но нет основного media_url, используем первое из дополнительных
          if (!content.imageUrl && !content.videoUrl && hasAdditionalMedia) {
            const firstMedia = additionalImagesField[0];
            if (firstMedia && typeof firstMedia === 'object' && firstMedia.url) {
              if (firstMedia.type === 'video') {
                content.videoUrl = firstMedia.url;
                log(`[Social Publishing] Используем первое видео из дополнительных медиа: ${firstMedia.url.substring(0, 100)}...`, 'stories');
              } else {
                content.imageUrl = firstMedia.url;
                log(`[Social Publishing] Используем первое изображение из дополнительных медиа: ${firstMedia.url.substring(0, 100)}...`, 'stories');
              }
            }
          }

          // Получаем сервис Instagram для публикации сторис
          log(`[Social Publishing] Инициализация сервиса Instagram для публикации`, 'stories');
          const { InstagramService } = require('../services/social/instagram-service');
          
          // Инициализируем сервис Instagram
          const instagramService = new InstagramService();
          
          // Обратите внимание: для сторис должен использоваться специальный параметр media_type="STORIES"
          log(`[Social Publishing] Вызов метода publishStory в Instagram сервисе`, 'stories');
          
          // Передаем настройки и social_media_settings для корректной публикации сторис
          const instagramConfig = {
            token: instToken,
            accessToken: instagramSettings.accessToken,
            businessAccountId: businessId
          };
          
          log(`[Social Publishing] Передаваемые настройки в сервис: ${JSON.stringify(instagramConfig)}`, 'stories');
          
          // Используем метод publishStory, который специально создан для сторис
          result = await instagramService.publishStory(content, instagramConfig, socialMediaSettings);
          log(`[Social Publishing] Результат публикации сторис в Instagram: ${JSON.stringify(result)}`, 'stories');
          break;
      }
      
      // Обновляем статус в базе данных
      try {
        log(`[Social Publishing] Обновление статуса платформы в базе данных: contentId=${contentId}, platform=${platform}`, 'stories');
        const adminToken = await storage.getAdminToken();
        
        if (!adminToken) {
          log(`[Social Publishing] Предупреждение: не удалось получить токен администратора для обновления статуса`, 'stories', 'warn');
        }
        
        const updatedContent = await storage.updateContentPlatformStatus(contentId, platform, result);
        log(`[Social Publishing] Статус платформы успешно обновлен: ${platform}`, 'stories');
        
        // Проверяем обновленный статус для платформы
        const updatedPlatformStatus = updatedContent.social_platforms?.[platform]?.status || 'unknown';
        log(`[Social Publishing] Новый статус для платформы ${platform}: ${updatedPlatformStatus}`, 'stories');
      } catch (updateError) {
        log(`[Social Publishing] Ошибка при обновлении статуса платформы: ${updateError.message}`, 'stories', 'error');
        // Продолжаем выполнение даже при ошибке обновления статуса
      }
      
      return res.status(200).json({
        success: true,
        message: `Сторис успешно опубликован в ${platform}`,
        result
      });
    } catch (error: any) {
      log(`[Social Publishing] Ошибка при публикации сторис в ${platform}: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: `Ошибка при публикации сторис: ${error.message}`
      });
    }
  } catch (error: any) {
    log(`[Social Publishing] Критическая ошибка при публикации сторис: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Внутренняя ошибка сервера: ${error.message}`
    });
  }
});

/**
 * @api {post} /api/publish/instagram/stories Публикация Instagram Stories
 * @apiDescription Публикует Instagram Stories напрямую через Instagram API (минуя n8n)
 * @apiVersion 1.0.0
 * @apiName PublishInstagramStories
 * @apiGroup SocialPublishing
 * 
 * @apiParam {String} contentId ID контента для публикации
 * 
 * @apiSuccess {Boolean} success Статус операции
 * @apiSuccess {Object} result Результат публикации
 */
router.post('/publish/instagram/stories', authMiddleware, async (req, res) => {
  try {
    log(`[Instagram Stories] Получен запрос на публикацию сторис: ${JSON.stringify(req.body)}`);
    
    const { contentId } = req.body;
    
    if (!contentId) {
      log(`[Instagram Stories] Ошибка: не указан contentId`);
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId'
      });
    }

    // Получаем данные контента
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      log(`[Instagram Stories] Ошибка: контент с ID ${contentId} не найден`, 'instagram', 'error');
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }

    // Подробный лог данных контента для отладки
    log(`[Instagram Stories] Детали контента для публикации:
      ID: ${content.id}
      Тип: ${content.contentType}
      Заголовок: ${content.title}
      Текст: ${content.content ? content.content.substring(0, 50) + '...' : 'отсутствует'}
      Основное изображение: ${content.imageUrl || 'отсутствует'}
      Доп. изображения: ${content.additionalImages ? 'присутствуют' : 'отсутствуют'}
      Доп. медиа: ${content.additionalMedia ? 'присутствуют' : 'отсутствуют'}`, 'instagram');

    // Получаем данные кампании для настроек Instagram
    const campaign = await storage.getCampaignById(content.campaignId);
    
    if (!campaign) {
      log(`[Instagram Stories] Ошибка: кампания с ID ${content.campaignId} не найдена`, 'instagram', 'error');
      return res.status(404).json({
        success: false,
        error: 'Кампания не найдена'
      });
    }

    // Получаем настройки Instagram из кампании
    const socialMediaSettings = campaign.social_media_settings || {};
    const instagramSettings = socialMediaSettings.instagram || {};
    
    // Проверяем наличие токена и business_account_id
    if (!instagramSettings.token && !instagramSettings.accessToken) {
      log(`[Instagram Stories] Ошибка: отсутствует токен Instagram в настройках кампании`, 'instagram', 'error');
      return res.status(400).json({
        success: false,
        error: 'Отсутствует токен Instagram в настройках кампании'
      });
    }

    if (!instagramSettings.businessAccountId) {
      log(`[Instagram Stories] Ошибка: отсутствует ID бизнес-аккаунта Instagram в настройках кампании`, 'instagram', 'error');
      return res.status(400).json({
        success: false,
        error: 'Отсутствует ID бизнес-аккаунта Instagram в настройках кампании'
      });
    }

    // Подготавливаем структуру для платформ в контенте, если она не существует
    const socialPlatforms = content.socialPlatforms || {};
    
    // Устанавливаем статус "pending" для Instagram
    socialPlatforms.instagram = {
      ...socialPlatforms.instagram, 
      status: 'pending',
      platform: 'instagram',
      userId: req.user?.id || null,
      error: null
    };
    
    // Получаем токен администратора
    const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
    const adminToken = await directusAuthManager.getAdminToken();
    
    if (!adminToken) {
      log(`[Instagram Stories] Ошибка: не удалось получить токен администратора`, 'instagram', 'error');
      return res.status(500).json({
        success: false,
        error: 'Ошибка авторизации администратора'
      });
    }
    
    // Сохраняем выбранные платформы для контента
    await storage.updateCampaignContent(
      contentId,
      { socialPlatforms: socialPlatforms },
      adminToken
    );

    // Публикуем через специальный метод publishStory
    log(`[Instagram Stories] Публикация сторис через Instagram API`, 'instagram');
    
    // Подготавливаем конфигурацию для Instagram
    const instagramConfig = {
      token: instagramSettings.token || instagramSettings.accessToken,
      businessAccountId: instagramSettings.businessAccountId,
      // Явно указываем, что это сторис
      mediaType: 'STORIES'
    };
    
    log(`[Instagram Stories] Передаем конфигурацию: ${JSON.stringify(instagramConfig)}`, 'instagram');
    
    // Вызываем метод publishStory напрямую
    const result = await instagramService.publishStory(content, instagramConfig, socialMediaSettings);
    
    log(`[Instagram Stories] Результат публикации: ${JSON.stringify(result)}`, 'instagram');
    
    // Обновляем статус публикации в Instagram
    await storage.updateCampaignContent(
      contentId,
      {
        socialPlatforms: {
          ...socialPlatforms,
          instagram: result
        }
      },
      adminToken
    );

    // Проверяем результат публикации
    if (result.error) {
      log(`[Instagram Stories] Ошибка при публикации: ${result.error}`, 'instagram', 'error');
      return res.status(400).json({
        success: false,
        error: result.error,
        result
      });
    }

    // Если публикация прошла успешно, обновляем статус контента, если он был в статусе draft
    if (content.status === 'draft') {
      await storage.updateCampaignContent(
        contentId,
        { status: 'scheduled' },
        adminToken
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Сторис успешно опубликованы в Instagram',
      result
    });

  } catch (error) {
    log(`[Instagram Stories] Критическая ошибка при публикации: ${error.message}`, 'instagram', 'error');
    return res.status(500).json({
      success: false,
      error: `Внутренняя ошибка сервера: ${error.message}`
    });
  }
});

export default router;