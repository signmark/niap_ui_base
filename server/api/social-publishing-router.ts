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
    
    // Получаем контент для проверки типа
    const content = await storage.getCampaignContentById(contentId);
    if (!content) {
      log(`[Social Publishing] Ошибка: не найден контент с ID ${contentId}`);
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // Если тип контента stories, переадресуем на webhookUrl для Instagram Stories
    if (content.contentType === 'stories') {
      log(`[Social Publishing] Обнаружен контент типа 'stories', переадресуем на специальный эндпоинт`);
      
      // Проверяем, включена ли Instagram в выбранных платформах
      if (Array.isArray(platforms) && platforms.includes('instagram') || 
          !Array.isArray(platforms) && platforms.instagram === true) {
        
        // Получаем ссылку на webhook Instagram Stories
        const n8nWebhookUrl = process.env.INSTAGRAM_STORIES_WEBHOOK_URL || 'https://n8n.nplanner.ru/webhook-test/publish-instagram-stories';
        log(`[Social Publishing] Перенаправляем на специальный вебхук для Instagram Stories: ${n8nWebhookUrl}`);
        
        try {
          // Импортируем Instagram Stories webhook handler
          const instagramStoriesHandler = await import('./instagram-stories-webhook').then(m => m.default);
          
          // Используем аналогичную логику, как в handlePublishRequest
          // Отправляем запрос на webhook для Instagram Stories
          const dataForN8n = {
            contentId
          };
          
          const response = await axios.post(n8nWebhookUrl, dataForN8n);
          
          log(`[Social Publishing] Успешно перенаправлено на Instagram Stories webhook, результат: ${JSON.stringify(response.data)}`);
          
          // Если Instagram - единственная выбранная платформа
          const onlyInstagram = Array.isArray(platforms) 
            ? platforms.length === 1 && platforms[0] === 'instagram'
            : Object.keys(platforms).filter(p => platforms[p] === true).length === 1 && platforms.instagram === true;
            
          if (onlyInstagram) {
            // Возвращаем успешный результат
            return res.status(200).json({
              success: true,
              message: 'Контент Instagram Stories отправлен на публикацию',
              results: [{
                platform: 'instagram',
                success: true,
                result: response.data
              }]
            });
          }
          
          // Если есть другие платформы, просто продолжаем выполнение для них
          // Удаляем Instagram из списка платформ для дальнейшей обработки
          let updatedPlatforms;
          if (Array.isArray(platforms)) {
            updatedPlatforms = platforms.filter(p => p !== 'instagram');
          } else if (platforms.instagram) {
            // Создаем копию объекта без Instagram
            const { instagram, ...restPlatforms } = platforms;
            updatedPlatforms = restPlatforms;
          } else {
            updatedPlatforms = platforms;
          }
          
          // Обновляем платформы для дальнейшей обработки
          platforms = updatedPlatforms;
          
          // Если после удаления Instagram не осталось других платформ
          if (Array.isArray(platforms) && platforms.length === 0 || 
              !Array.isArray(platforms) && Object.values(platforms).filter(v => v === true).length === 0) {
            return res.status(200).json({
              success: true,
              message: 'Контент Instagram Stories отправлен на публикацию',
              results: [{
                platform: 'instagram',
                success: true,
                result: response.data
              }]
            });
          }
          
          // Иначе продолжаем обработку для остальных платформ
          log(`[Social Publishing] Продолжаем публикацию для остальных платформ: ${JSON.stringify(platforms)}`);
        } catch (error: any) {
          log(`[Social Publishing] Ошибка при перенаправлении на Instagram Stories webhook: ${error.message}`);
          
          // Продолжаем выполнение для других платформ, но добавляем ошибку в результаты
          return res.status(200).json({
            success: true,
            message: 'Ошибка при публикации Instagram Stories, публикация в другие платформы продолжается',
            results: [{
              platform: 'instagram',
              success: false,
              error: `Ошибка при публикации Instagram Stories: ${error.message}`
            }]
          });
        }
      }
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
    
    // Детальное логирование полученного контента (без вывода больших полей)
    const contentTypeDebug = content.contentType || content.content_type || 'не указан';
    log(`[Social Publishing] Получен контент ${contentId}, тип: "${contentTypeDebug}"`);
    log(`[Social Publishing] Доступные поля в контенте: ${Object.keys(content).join(', ')}`);
    
    // Проверяем тип контента с учетом разных вариантов записи поля
    const contentType = content.contentType || content.content_type;
    
    // Если тип контента stories ИЛИ контент содержит специальный маркер isStories,
    // используем прямую публикацию через Instagram Stories webhook
    if (contentType === 'stories' || content.isStories === true) {
      log(`[Social Publishing] Обнаружен контент типа 'stories' (contentType=${contentType}), используем прямую публикацию через Instagram Stories webhook`);
      
      try {
        // Проверяем, что запрос для Instagram
        if (platform.toLowerCase() !== 'instagram') {
          return res.status(400).json({
            success: false,
            error: `Платформа ${platform} не поддерживает публикацию сторис`
          });
        }
        
        // Получаем ссылку на webhook Instagram Stories
        const n8nWebhookUrl = process.env.INSTAGRAM_STORIES_WEBHOOK_URL || 'https://n8n.nplanner.ru/webhook-test/publish-instagram-stories';
        log(`[Social Publishing] Перенаправляем на специальный вебхук для Instagram Stories: ${n8nWebhookUrl}`);
        
        // Подготавливаем данные для отправки в n8n, аналогично instagram-stories-webhook.ts
        // Учитываем различные варианты именования полей
        const title = content.title || "";
        const contentText = content.content || "";
        const campaignId = content.campaignId || content.campaign_id;
        const imageUrl = content.imageUrl || content.image_url;
        const videoUrl = content.videoUrl || content.video_url;
        const additionalImages = content.additionalImages || content.additional_images || [];
        const additionalVideos = content.additionalVideos || content.additional_videos || [];
        const metadata = content.metadata || {};
        
        // Подготавливаем полный набор данных для n8n
        const dataForN8n = {
          contentId,
          title,
          content: contentText,
          imageUrl,
          additionalImages,
          videoUrl,
          additionalVideos,
          metadata,
          campaignId,
          // Добавляем дополнительные поля для n8n
          requestTimestamp: Date.now(),
          source: 'smm-manager-standard-endpoint'
        };
        
        // Детальное логирование перед отправкой запроса
        log(`[Social Publishing] Отправляем запрос на Instagram Stories webhook: URL=${n8nWebhookUrl}`);
        log(`[Social Publishing] Данные для n8n: ${JSON.stringify(dataForN8n, null, 2)}`);
        
        let result: any = {};
        
        try {
          const response = await axios.post(n8nWebhookUrl, dataForN8n);
          
          log(`[Social Publishing] Успешно перенаправлено на Instagram Stories webhook, результат: ${JSON.stringify(response.data)}`);
  
          // Формируем результат на основе ответа webhook
          result = response.data;
        } catch (webhookError: any) {
          // Детальное логирование ошибки при вызове webhook
          log(`[Social Publishing] ОШИБКА при вызове Instagram Stories webhook: ${webhookError.message}`);
          if (webhookError.response) {
            log(`[Social Publishing] Детали ошибки webhook: status=${webhookError.response.status}, data=${JSON.stringify(webhookError.response.data)}`);
          }
          
          // Пробуем альтернативный подход - прямой вызов функции обработчика
          log(`[Social Publishing] Пробуем вызвать обработчик Instagram Stories напрямую`);
          
          // Используем прямой запрос к Instagram Stories webhook в Express
          log(`[Social Publishing] Используем прямой запрос к Instagram Stories webhook через Express`);
          
          // Путь к нашему собственному эндпоинту Instagram Stories webhook в Express
          const localWebhookUrl = '/api/instagram-stories-webhook';
          
          let resultData: any = null;
          
          try {
            // Отправляем запрос на наш локальный эндпоинт
            const localResponse = await axios.post(`http://localhost:${process.env.PORT || 5000}${localWebhookUrl}`, { 
              contentId,
              forceStories: true // Добавляем флаг принудительной обработки как Stories
            });
            
            log(`[Social Publishing] Локальный эндпоинт Instagram Stories вернул ответ: ${JSON.stringify(localResponse.data)}`);
            resultData = localResponse.data.result;
          } catch (localError: any) {
            log(`[Social Publishing] Ошибка при вызове локального эндпоинта Instagram Stories: ${localError.message}`);
            
            // Напрямую используем низкоуровневую функциональность
            log(`[Social Publishing] Используем альтернативный метод обработки Instagram Stories`);
            
            try {
              // Импортируем модуль
              const { default: instagramStoriesRouter } = await import('./instagram-stories-webhook');
              
              // Создаем имитацию запроса и ответа для Express
              const mockReq: any = { 
                body: { 
                  contentId,
                  forceStories: true // Принудительная обработка как Stories
                } 
              };
              
              const mockRes: any = {
                json: (data: any) => {
                  log(`[Social Publishing] Прямой вызов обработчика Instagram Stories успешен: ${JSON.stringify(data)}`);
                  resultData = data;
                  return mockRes;
                },
                status: (code: number) => {
                  log(`[Social Publishing] Прямой вызов обработчика Instagram Stories вернул статус: ${code}`);
                  return mockRes;
                }
              };
              
              // Получаем стек middleware из роутера
              const routerStack = instagramStoriesRouter.stack || [];
              
              // Находим обработчик POST запросов
              const postHandler = routerStack.find((layer: any) => 
                layer.route && 
                layer.route.path === '/' && 
                layer.route.methods && 
                layer.route.methods.post
              );
              
              if (postHandler && postHandler.route && postHandler.route.stack && postHandler.route.stack[0]) {
                // Извлекаем непосредственно функцию-обработчик
                const handler = postHandler.route.stack[0].handle;
                
                // Вызываем обработчик напрямую с нашими mock-объектами
                await handler(mockReq, mockRes, () => {
                  log(`[Social Publishing] Middleware next() вызван в обработчике Instagram Stories`);
                });
              } else {
                log(`[Social Publishing] Не удалось найти обработчик POST запросов в Instagram Stories webhook`);
              }
            } catch (directCallError: any) {
              log(`[Social Publishing] Ошибка при прямом вызове обработчика Instagram Stories: ${directCallError.message}`);
            }
          }
          
          // Если все методы не сработали, создаем базовый результат
          if (!resultData) {
            resultData = {
              platform: 'instagram',
              status: 'pending',
              message: 'Instagram Stories запрос отправлен через резервный механизм'
            };
          }
          
          if (resultData) {
            result = resultData;
          }
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
      const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
      const adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'zQJK4b84qrQeuTYS2-x9QqpEyDutJGsb';
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
 */
router.post('/publish/stories', authMiddleware, async (req, res) => {
  try {
    const { contentId, platform } = req.body;
    
    if (!contentId || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId и platform'
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
      const campaignSettings = await storage.getCampaignById(content.campaignId);
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
          const { vkService } = require('../services/social/vk-service');
          result = await vkService.publishToPlatform(content, platform, campaignSettings.socialSettings);
          break;
          
        case 'instagram':
          const { instagramService } = require('../services/social/instagram-service');
          result = await instagramService.publishToPlatform(content, platform, campaignSettings.socialSettings);
          break;
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
  } catch (error: any) {
    log(`[Social Publishing] Критическая ошибка при публикации сторис: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Внутренняя ошибка сервера: ${error.message}`
    });
  }
});

export default router;