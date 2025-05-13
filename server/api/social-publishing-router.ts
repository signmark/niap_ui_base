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
 * @apiName PublishNow
 * @apiGroup SocialPublishing
 * 
 * @apiParam {String} contentId ID контента для публикации
 * @apiParam {Array|Object} platforms Массив выбранных платформ или объект с платформами
 * 
 * @apiSuccess {Boolean} success Статус успешности операции
 * @apiSuccess {Array} results Результаты публикации для каждой платформы
 * 
 * @apiError {Boolean} success Статус успешности операции (false)
 * @apiError {String} error Сообщение об ошибке
 */
router.post('/publish/now', authMiddleware, async (req, res) => {
  try {
    log(`[Social Publishing] Получен запрос на публикацию с телом: ${JSON.stringify(req.body)}`);
    
    const { contentId, platforms } = req.body;
    
    // Объявляем переменную platformsForOtherNetworks для использования в разных частях функции
    let platformsForOtherNetworks: any = null;
    
    log(`[Social Publishing] Запрос на публикацию контента ${contentId} сразу в несколько платформ: ${JSON.stringify(platforms)}`);
    
    // Проверяем, существует ли контент
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // Для отладки: показываем тип контента, чтобы понимать, как система его определяет
    const contentTypeDebug = content.contentType || content.content_type || 'не указан';
    log(`[Social Publishing] Тип контента: ${contentTypeDebug}`);
    
    // Определяем, является ли контент Instagram Stories по нескольким возможным атрибутам:
    // - contentType = 'stories' (стандартное именование)
    // - content_type = 'stories' (альтернативное именование)
    // - type = 'stories' (еще один возможный вариант)
    // - isStories = true (прямой флаг)
    // - hasStories = true (еще один вариант флага)
    // - title содержит [stories] или #stories (маркер в заголовке)
    const isStoriesContent = 
      content.contentType === 'stories' || 
      content.content_type === 'stories' ||
      content.type === 'stories' ||
      content.isStories === true ||
      content.hasStories === true ||
      (content.title && (
        content.title.toLowerCase().includes('[stories]') || 
        content.title.toLowerCase().includes('#stories')
      ));
    
    // ПРИНУДИТЕЛЬНЫЙ РЕЖИМ: Также трактуем как Stories, если публикуется ТОЛЬКО в Instagram
    // Это удобно для пользователей, которые не понимают механику типов контента
    const onlyInstagram = Array.isArray(platforms) 
      ? platforms.length === 1 && platforms[0] === 'instagram'
      : Object.keys(platforms).filter(p => platforms[p] === true).length === 1 && platforms.instagram === true;
        
    if (isStoriesContent || onlyInstagram) {
      log(`[Social Publishing] Обнаружен контент для Instagram Stories (тип=${contentTypeDebug}, onlyInstagram=${onlyInstagram}), используем унифицированный подход`);
      
      // Проверяем, включена ли Instagram в выбранных платформах
      if (Array.isArray(platforms) && platforms.includes('instagram') || 
          !Array.isArray(platforms) && platforms.instagram === true) {
        
        log(`[Social Publishing] Публикация Instagram Stories через унифицированный механизм publishViaN8n`);
        
        // Используем тот же подход, что и для обычных постов, но с платформой instagram-stories
        return publishViaN8n(contentId, 'instagram-stories', req, res);
      } else {
        // Если Instagram не выбран, сообщаем об ошибке
        return res.status(400).json({
          success: false,
          error: 'Instagram не выбран в списке платформ для публикации Stories'
        });
      }
    } else {
      // Платформы для других социальных сетей (не для Instagram Stories)
      const platformsForOtherNetworks = Array.isArray(platforms) 
        ? platforms 
        : Object.keys(platforms).filter(p => platforms[p] === true);
      
      log(`[Social Publishing] Публикация в стандартные платформы: ${platformsForOtherNetworks.join(', ')}`);
      
      // Результаты публикации для каждой платформы
      const publishResults = [];
      
      // Публикуем по одной платформе последовательно
      for (const platform of platformsForOtherNetworks) {
        try {
          log(`[Social Publishing] Публикация в ${platform}...`);
          
          let result = null;
          
          // Специализированная обработка для Telegram через n8n webhook
          if (platform === 'telegram') {
            log(`[Social Publishing] Используем n8n webhook для ${platform}`);
            result = await publishViaN8nAsync(contentId, platform);
          }
          // Специализированная обработка для Facebook через n8n webhook
          else if (platform === 'facebook') {
            log(`[Social Publishing] Используем n8n webhook для ${platform}`);
            result = await publishViaN8nAsync(contentId, platform);
          }
          // Специализированная обработка для VK через n8n webhook
          else if (platform === 'vk') {
            log(`[Social Publishing] Используем n8n webhook для ${platform}`);
            result = await publishViaN8nAsync(contentId, platform);
          }
          // Специализированная обработка для Instagram через n8n webhook
          else if (platform === 'instagram') {
            log(`[Social Publishing] Используем n8n webhook для ${platform}`);
            result = await publishViaN8nAsync(contentId, platform);
          }
          // Универсальный обработчик для остальных платформ
          else {
            log(`[Social Publishing] Нет специализированного обработчика для ${platform}, используем универсальный`);
            
            // Пока заглушка - в будущем здесь можно добавить универсальный обработчик
            result = {
              platform,
              success: false,
              error: `Platform ${platform} is not supported yet`
            };
          }
          
          log(`[Social Publishing] Результат публикации в ${platform}: ${JSON.stringify(result)}`);
          publishResults.push(result);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          log(`[Social Publishing] Ошибка при публикации в ${platform}: ${errorMessage}`);
          
          publishResults.push({
            platform,
            success: false,
            error: `Error: ${errorMessage}`
          });
        }
      }
      
      // Общие результаты публикации во все платформы
      return res.json({
        success: true,
        results: publishResults
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[Social Publishing] Ошибка при обработке запроса на публикацию: ${errorMessage}`);
    
    return res.status(500).json({
      success: false,
      error: `Server error: ${errorMessage}`
    });
  }
});

/**
 * @api {post} /api/publish/later Запланировать публикацию контента
 * @apiDescription Планирует публикацию контента на определенное время в выбранные социальные сети
 * @apiVersion 1.0.0
 * @apiName PublishLater
 * @apiGroup SocialPublishing
 * 
 * @apiParam {String} contentId ID контента для публикации
 * @apiParam {Array|Object} platforms Массив выбранных платформ или объект с платформами
 * @apiParam {String} scheduleTime Время публикации в формате ISO
 * 
 * @apiSuccess {Boolean} success Статус успешности операции
 * @apiSuccess {Object} data Информация о запланированной публикации
 * 
 * @apiError {Boolean} success Статус успешности операции (false)
 * @apiError {String} error Сообщение об ошибке
 */
router.post('/publish/later', authMiddleware, async (req, res) => {
  try {
    const { contentId, platforms, scheduleTime } = req.body;
    
    // Проверка параметров
    if (!contentId) {
      return res.status(400).json({
        success: false, 
        error: 'Content ID is required'
      });
    }
    
    if (!platforms || (Array.isArray(platforms) && platforms.length === 0) || 
        (!Array.isArray(platforms) && Object.keys(platforms).length === 0)) {
      return res.status(400).json({
        success: false, 
        error: 'At least one platform must be selected'
      });
    }
    
    if (!scheduleTime) {
      return res.status(400).json({
        success: false, 
        error: 'Schedule time is required'
      });
    }
    
    // Проверяем, существует ли контент
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Content with ID ${contentId} not found`
      });
    }
    
    // Преобразуем дату
    const scheduleDate = new Date(scheduleTime);
    
    // Проверка валидности даты
    if (isNaN(scheduleDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schedule time format'
      });
    }
    
    // Имя задания для планировщика
    const jobId = `publish_${contentId}_${scheduleDate.getTime()}`;
    
    // Платформы для публикации
    const platformsList = Array.isArray(platforms) 
      ? platforms 
      : Object.keys(platforms).filter(p => platforms[p] === true);
    
    try {
      // Получаем текущие данные контента
      const content = await storage.getCampaignContentById(contentId);
      
      if (!content) {
        throw new Error(`Контент ${contentId} не найден`);
      }
      
      // Формируем структуру для обновления
      let socialPlatforms = content.social_platforms || {};
      
      if (typeof socialPlatforms === 'string') {
        try {
          socialPlatforms = JSON.parse(socialPlatforms);
        } catch (e) {
          socialPlatforms = {};
        }
      }
      
      // Обновляем статус для выбранных платформ
      for (const platform of platformsList) {
        socialPlatforms[platform] = {
          ...(socialPlatforms[platform] || {}),
          selected: true,
          status: 'scheduled',
          scheduledFor: scheduleDate.toISOString()
        };
      }
      
      // Обновляем контент в базе данных
      await storage.updateCampaignContent(contentId, {
        social_platforms: socialPlatforms,
        // Если у контента нет статуса, устанавливаем "scheduled"
        status: content.status === 'draft' ? 'scheduled' : content.status
      });
      
      log(`[Social Publishing] Запланирована публикация контента ${contentId} на ${scheduleDate.toISOString()} для платформ: ${platformsList.join(', ')}`);
      
      return res.json({
        success: true,
        data: {
          contentId,
          platforms: platformsList,
          scheduleTime: scheduleDate.toISOString(),
          jobId
        }
      });
    } catch (updateError) {
      log(`[Social Publishing] Ошибка при планировании публикации: ${updateError}`);
      
      return res.status(500).json({
        success: false,
        error: `Ошибка при планировании публикации: ${updateError}`
      });
    }
  } catch (webhookError) {
    log(`[Social Publishing] Ошибка при обработке запроса планирования: ${webhookError}`);
    
    return res.status(500).json({
      success: false,
      error: `Внутренняя ошибка сервера: ${webhookError}`
    });
  }
});

/**
 * @api {post} /api/publish/telegram Публикация контента в Telegram
 * @apiDescription Публикует контент в Telegram с использованием n8n webhook
 * @apiVersion 1.0.0
 * @apiName PublishTelegram
 * @apiGroup SocialPublishing
 * 
 * @apiParam {String} contentId ID контента для публикации
 * 
 * @apiSuccess {Boolean} success Статус успешности операции
 * @apiSuccess {Object} data Информация о публикации
 * 
 * @apiError {Boolean} success Статус успешности операции (false)
 * @apiError {String} error Сообщение об ошибке
 */
router.post('/publish/telegram', authMiddleware, async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Content ID is required'
      });
    }
    
    // Используем общую функцию для публикации в Telegram через n8n webhook
    return publishViaN8n(contentId, 'telegram', req, res);
  } catch (error) {
    
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
      'instagram-stories': 'publish-instagram-stories',
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
      
      if (!content) {
        log(`[Social Publishing] Не удалось получить контент ${contentId}`); 
        return;
      }
      
      // Определяем, с каким полем работаем: socialPlatforms или social_platforms
      let platformsData = content.socialPlatforms || content.social_platforms;
      
      if (typeof platformsData === 'string') {
        try {
          platformsData = JSON.parse(platformsData);
        } catch (e) {
          platformsData = {};
        }
      }
      
      if (!platformsData) {
        platformsData = {};
      }
      
      // Создаем объект платформы, если его нет
      if (!platformsData[platform]) {
        platformsData[platform] = {};
      }
      
      // Обновляем статус платформы
      log(`[Social Publishing] Обновление статуса платформы ${platform} на published`);
      
      // Обновляем статус платформы на published
      platformsData[platform] = {
        ...platformsData[platform],
        status: 'published',
        publishedAt: new Date().toISOString(),
        selected: true
      };
      
      // Если пришла информация о postUrl, добавляем её
      if (response.data && response.data.postUrl) {
        platformsData[platform].postUrl = response.data.postUrl;
      }
      
      // Если пришла информация о postId, добавляем её
      if (response.data && response.data.postId) {
        platformsData[platform].postId = response.data.postId;
      }
      
      // Обновляем настройки платформ в контенте
      const updateData: any = {};
      
      // Используем правильное имя поля в зависимости от того, что используется в контенте
      if (content.hasOwnProperty('socialPlatforms')) {
        updateData.socialPlatforms = platformsData;
      } else {
        updateData.social_platforms = platformsData;
      }
      
      await storage.updateCampaignContent(contentId, updateData);
      
      log(`[Social Publishing] Статус платформы ${platform} обновлен на published для контента ${contentId}`);
      
      // Принудительно обновляем статус контента через сервис проверки статусов
      try {
        const statusCheckerModule = await import('../services/status-checker');
        log(`[Social Publishing] Вызов принудительного обновления статуса контента ${contentId}`);
        
        // Проверяем, является ли платформа Instagram Stories
        if (platform === 'instagram-stories') {
          log(`[Social Publishing] Используем принудительное обновление статуса для Instagram Stories`);
          
          // Обновляем статус контента напрямую
          try {
            const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
            const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
            let adminToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
            
            const sessions = directusAuthManager.getAllActiveSessions();
            if (sessions.length > 0) {
              adminToken = sessions[0].token;
            }
            
            if (!adminToken) {
              log(`[Social Publishing] Не удалось получить токен администратора для обновления статуса`);
              return;
            }
            
            const updateResponse = await axios.patch(
              `${directusUrl}/items/campaign_content/${contentId}`,
              { status: 'published' },
              {
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            log(`[Social Publishing] Статус контента принудительно обновлен на 'published'`);
          } catch (directUpdateError: any) {
            log(`[Social Publishing] Ошибка при принудительном обновлении статуса: ${directUpdateError.message}`);
          }
        } else {
          // Для других платформ используем обычную проверку
          try {
            // Принудительно обновляем статус контента напрямую через storage и Directus API
            log(`[Social Publishing] Принудительное обновление статуса для других платформ`);
            
            // Пытаемся получить токен администратора
            const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
            let adminToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
            
            const sessions = directusAuthManager.getAllActiveSessions();
            if (sessions.length > 0) {
              adminToken = sessions[0].token;
            }
            
            if (!adminToken) {
              log(`[Social Publishing] Не удалось получить токен администратора для обновления статуса`);
              return;
            }
            
            // Обновляем через хранилище
            await storage.updateCampaignContent(contentId, { status: 'published' }, adminToken);
            log(`[Social Publishing] Статус контента успешно обновлен на 'published'`);
          } catch (updateError) {
            log(`[Social Publishing] Ошибка при принудительном обновлении статуса: ${updateError.message}`);
          }
        }
        
        log(`[Social Publishing] Принудительное обновление статуса контента ${contentId} выполнено`);
      } catch (statusError: any) {
        log(`[Social Publishing] Ошибка при вызове обновления статуса: ${statusError.message}`);
      }
    } catch (error: any) {
      log(`[Social Publishing] Ошибка при обновлении статуса платформы: ${error.message}`);
    }
    
    // Возвращаем ответ от n8n вебхука клиенту
    return res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    log(`[Social Publishing] Ошибка при публикации через n8n вебхук: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Ошибка при публикации через n8n вебхук: ${error.message}`
    });
  }
}

/**
 * Асинхронно публикует контент через n8n вебхук и возвращает результат
 * @param contentId ID контента для публикации
 * @param platform Платформа для публикации
 * @returns Результат публикации
 */
async function publishViaN8nAsync(contentId: string, platform: string): Promise<any> {
  try {
    log(`[Social Publishing] Публикация контента ${contentId} в ${platform} через n8n вебхук (async)`);
    
    // Маппинг платформ на соответствующие n8n вебхуки
    const webhookMap: Record<string, string> = {
      'telegram': 'publish-telegram',
      'vk': 'publish-vk',
      'instagram': 'publish-instagram',
      'instagram-stories': 'publish-instagram-stories',
      'facebook': 'publish-facebook'
    };
    
    const webhookName = webhookMap[platform];
    if (!webhookName) {
      throw new Error(`Платформа ${platform} не имеет настроенного вебхука`);
    }
    
    // Формируем URL вебхука
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
      
      // Получаем текущий контент
      const content = await storage.getCampaignContentById(contentId);
      
      if (!content || !content.social_platforms) {
        log(`[Social Publishing] Не удалось получить контент ${contentId} или нет настроек платформ`); 
        return { platform, success: true, data: response.data };
      }
      
      // Обновляем статус конкретной платформы
      let socialPlatforms = content.social_platforms;
      
      if (typeof socialPlatforms === 'string') {
        try {
          socialPlatforms = JSON.parse(socialPlatforms);
        } catch (e) {
          socialPlatforms = {};
        }
      }
      
      // Проверяем, есть ли данная платформа в настройках
      if (!socialPlatforms[platform]) {
        socialPlatforms[platform] = {};
      }
      
      // Обновляем статус платформы на published
      socialPlatforms[platform] = {
        ...socialPlatforms[platform],
        status: 'published',
        publishedAt: new Date().toISOString()
      };
      
      // Если пришла информация о postUrl, добавляем её
      if (response.data && response.data.postUrl) {
        socialPlatforms[platform].postUrl = response.data.postUrl;
      }
      
      // Если пришла информация о postId, добавляем её
      if (response.data && response.data.postId) {
        socialPlatforms[platform].postId = response.data.postId;
      }
      
      // Обновляем настройки платформ в контенте
      await storage.updateCampaignContent(contentId, {
        social_platforms: socialPlatforms
      });
      
      log(`[Social Publishing] Статус платформы ${platform} обновлен на published для контента ${contentId}`);
    } catch (error) {
      log(`[Social Publishing] Ошибка при обновлении статуса платформы: ${error.message}`);
    }
    
    // Возвращаем результат публикации
    return {
      platform,
      success: true,
      data: response.data
    };
  } catch (error) {
    log(`[Social Publishing] Ошибка при публикации через n8n вебхук: ${error.message}`);
    
    return {
      platform,
      success: false,
      error: `Ошибка при публикации через n8n вебхук: ${error.message}`
    };
  }
}

export default router;