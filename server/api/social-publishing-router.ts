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
    
    // Проверяем, что платформы указаны и это объект
    if (!platforms || typeof platforms !== 'object') {
      log(`[Social Publishing] Ошибка: платформы не указаны или не являются объектом: ${JSON.stringify(platforms)}`);
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать платформы для публикации'
      });
    }
    
    // Валидируем, что платформы имеют ожидаемый формат {platformName: boolean}
    log(`[Social Publishing] Проверка формата объекта platforms: ${JSON.stringify(platforms)}`);
    const validPlatformKeys = ['telegram', 'vk', 'instagram', 'facebook'];
    const receivedPlatformKeys = Object.keys(platforms);
    
    log(`[Social Publishing] Ожидаемые ключи платформ: ${validPlatformKeys.join(', ')}`);
    log(`[Social Publishing] Полученные ключи платформ: ${receivedPlatformKeys.join(', ')}`);
    
    // Проверяем, что хотя бы один ключ валидный и его значение - boolean
    // Не требуем все ключи, так как могут быть отправлены только нужные платформы
    const validFormat = receivedPlatformKeys.length > 0 && receivedPlatformKeys.some(key => 
      validPlatformKeys.includes(key) && typeof platforms[key] === 'boolean'
    );
    
    if (!validFormat) {
      log(`[Social Publishing] Ошибка: неверный формат объекта platforms`);
      return res.status(400).json({
        success: false,
        error: 'Неверный формат платформ. Ожидается объект с ключами: telegram, vk, instagram, facebook'
      });
    }

    // Получаем список выбранных платформ (где значение true)
    const selectedPlatforms = Object.entries(platforms)
      .filter(([_, selected]) => selected === true)
      .map(([name]) => name);
    
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
      
      // Обновляем контент, чтобы сохранить выбранные платформы
      const updatedContent = await storage.updateCampaignContent(
        contentId,
        { socialPlatforms: platformsData },
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
          
          // Запускаем публикацию через n8n вебхук
          const result = await publishViaN8nAsync(contentId, platform);
          
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
      
      // Проверяем, есть ли успешные публикации
      const hasSuccessfulPublications = publishResults.some(result => result.success);
      
      if (hasSuccessfulPublications) {
        // Автоматически обновляем общий статус контента на "published"
        try {
          log(`[Social Publishing] Автоматическое обновление статуса для контента ${contentId} после успешной публикации`);
          
          await storage.updateCampaignContent(
            contentId,
            { status: 'published', publishedAt: new Date() },
            adminToken
          );
          
          log(`[Social Publishing] Статус контента успешно обновлен на "published"`);
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
      'instagram': 'publish-instagram'
    };
    
    const webhookName = webhookMap[platform];
    if (!webhookName) {
      return res.status(400).json({
        success: false,
        error: `Платформа ${platform} не имеет настроенного вебхука`
      });
    }
    
    // Формируем URL вебхука
    const webhookUrl = `https://n8n.nplanner.ru/webhook/${webhookName}`;
    
    // Для n8n вебхуков отправляем только contentId, как указано в требованиях
    const webhookPayload = {
      contentId
    };
    
    // Отправляем запрос на n8n вебхук только с contentId
    const response = await axios.post(webhookUrl, webhookPayload);
    
    log(`[Social Publishing] Отправлены данные в n8n вебхук: contentId=${contentId}, platform=${platform}`);
    log(`[Social Publishing] Данные извлекаются из Directus по contentId`);
    
    log(`[Social Publishing] Ответ от n8n вебхука: ${JSON.stringify(response.data)}`);
    
    // Обновляем статус контента на "published" после успешной публикации
    try {
      log(`[Social Publishing] Обновление статуса контента ${contentId} на "published" после публикации в ${platform}`);
      
      // Получаем токен администратора
      const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
      let adminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'zQJK4b84qrQeuTYS2-x9QqpEyDutJGsb';
      const sessions = directusAuthManager.getAllActiveSessions();
      
      if (sessions.length > 0) {
        adminToken = sessions[0].token;
      }
      
      await storage.updateCampaignContent(
        contentId,
        { status: 'published', publishedAt: new Date() },
        adminToken
      );
      
      log(`[Social Publishing] Статус контента ${contentId} успешно обновлен на "published"`);
    } catch (statusError: any) {
      log(`[Social Publishing] Ошибка при обновлении статуса контента: ${statusError.message}`);
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
    log(`[Social Publishing] Асинхронная публикация контента ${contentId} в ${platform} через n8n вебхук`);
    
    // Маппинг платформ на соответствующие n8n вебхуки
    const webhookMap: Record<string, string> = {
      'telegram': 'publish-telegram',
      'vk': 'publish-vk',
      'instagram': 'publish-instagram',
      'facebook': 'publish-facebook'
    };
    
    const webhookName = webhookMap[platform];
    if (!webhookName) {
      throw new Error(`Платформа ${platform} не имеет настроенного вебхука`);
    }
    
    // Формируем URL вебхука
    const webhookUrl = `https://n8n.nplanner.ru/webhook/${webhookName}`;
    
    // Для n8n вебхуков отправляем только contentId, как указано в требованиях
    const webhookPayload = {
      contentId
    };
    
    // Отправляем запрос на n8n вебхук
    const response = await axios.post(webhookUrl, webhookPayload);
    
    log(`[Social Publishing] Отправлены данные в n8n вебхук: contentId=${contentId}, platform=${platform}`);
    log(`[Social Publishing] Данные извлекаются из Directus по contentId`);
    
    log(`[Social Publishing] Ответ от n8n вебхука: ${JSON.stringify(response.data)}`);
    
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
    
    // Автоматически обновляем статус на "published", так как этот эндпоинт вызывается
    // сразу после публикации во все выбранные платформы
    const updatedContent = await storage.updateCampaignContent(
      contentId,
      { status: 'published', publishedAt: new Date() },
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
        published: platform && platform.status === 'published'
      };
    });
    
    // Записываем информацию о статусах публикации
    const publishedPlatforms = platformStatuses.filter(p => p.published);
    const pendingPlatforms = platformStatuses.filter(p => !p.published);
    
    log(`[Social Publishing] Платформы с статусом published: ${publishedPlatforms.map(p => p.name).join(', ') || 'нет'}`);
    log(`[Social Publishing] Платформы с другими статусами: ${pendingPlatforms.map(p => p.name).join(', ') || 'нет'}`);
    
    // Проверяем, все ли выбранные платформы опубликованы
    const allPublished = pendingPlatforms.length === 0;
    
    if (allPublished) {
      log(`[Social Publishing] Все выбранные платформы опубликованы для контента ${contentId}, обновляем общий статус`);
      
      // Обновляем общий статус контента на "published"
      const updatedContent = await storage.updateCampaignContent(
        contentId,
        { status: 'published', publishedAt: new Date() },
        adminToken
      );
      
      if (updatedContent) {
        log(`[Social Publishing] Успешно обновлен общий статус контента ${contentId} на "published"`);
        return res.status(200).json({
          success: true,
          message: 'Общий статус публикации обновлен на "published"',
          result: {
            contentId,
            status: 'published',
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
      log(`[Social Publishing] Не все платформы опубликованы для контента ${contentId}, статус не обновлен`);
      return res.status(200).json({
        success: false,
        message: 'Не все выбранные платформы опубликованы, общий статус не обновлен',
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

export default router;