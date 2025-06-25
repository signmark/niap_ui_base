import { Express, Request, Response } from 'express';
import axios from 'axios';
import { storage } from '../storage';
import { socialPublishingService } from '../services/social/index';

// Не используем старый сервис, заменив его на новый модульный
import { getPublishScheduler } from '../services/publish-scheduler';
// Определяем тип SocialPlatform локально
type SocialPlatform = 'instagram' | 'facebook' | 'telegram' | 'vk';
import { log } from '../utils/logger';
import { directusApiManager } from '../directus';
import { directusStorageAdapter } from '../services/directus';

/**
 * Регистрирует маршруты для управления публикациями
 * @param app Express приложение
 */
export function registerPublishingRoutes(app: Express): void {
  console.log('[publishing-routes] Регистрация маршрутов управления публикациями...');
  
  // Восстановлена проверка запланированных публикаций после исправления критических ошибок
  app.all('/api/publish/check-scheduled', async (req: Request, res: Response) => {
    try {
      log('Проверка запланированных публикаций восстановлена', 'api');
      
      // Получаем планировщик из глобального экспорта
      const publishScheduler = getPublishScheduler();
      
      if (!publishScheduler) {
        return res.status(500).json({ 
          error: 'Планировщик не инициализирован'
        });
      }
      
      // Выполняем проверку запланированных публикаций
      await publishScheduler.checkScheduledContent();
      
      return res.json({ 
        success: true,
        message: 'Проверка запланированных публикаций выполнена'
      });
    } catch (error: any) {
      log(`Ошибка при проверке запланированных публикаций: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при проверке публикаций',
        details: error.message
      });
    }
  });
  
  // Управление глобальным флагом отключения публикаций
  // Важно: этот маршрут должен быть определен ДО маршрута с параметром :contentId
  app.all('/api/publish/toggle-publishing', async (req: Request, res: Response) => {
    try {
      const enable = req.query.enable === 'true';
      const publishScheduler = getPublishScheduler();
      
      // Новый планировщик не имеет флага disablePublishing
      // Вместо этого мы просто включаем/выключаем его работу
      if (enable) {
        publishScheduler.start();
        log('Планировщик публикаций ВКЛЮЧЕН. Контент будет публиковаться в соцсети.', 'api');
      } else {
        publishScheduler.stop();
        log('Планировщик публикаций ОТКЛЮЧЕН. Автоматические публикации приостановлены.', 'api');
      }
      
      return res.status(200).json({
        success: true,
        publishing: enable,
        message: enable 
          ? 'Планировщик публикаций включен. Контент будет публиковаться в соцсети.' 
          : 'Планировщик публикаций отключен. Автоматические публикации приостановлены.'
      });
    } catch (error: any) {
      log(`Ошибка при управлении флагом публикаций: ${error.message}`, 'api');
      return res.status(500).json({
        error: 'Ошибка при управлении флагом публикаций',
        message: error.message
      });
    }
  });
  
  // Маршрут для принудительной пометки контента как опубликованного без фактической публикации
  // Важно: этот маршрут должен быть определен ДО маршрута с параметром :contentId
  app.all('/api/publish/mark-as-published/:contentId', async (req: Request, res: Response) => {
    try {
      const contentId = req.params.contentId;
      log(`Запрос на принудительную пометку контента ${contentId} как опубликованного`, 'api');
      
      // Получаем текущий контент
      const content = await storage.getCampaignContent(contentId);
      
      if (!content) {
        return res.status(404).json({
          error: 'Контент не найден',
          message: `Контент с ID ${contentId} не найден`
        });
      }
      
      // Обновляем статус на published без фактической публикации
      await storage.updateCampaignContent(contentId, {
        status: 'published'
      });
      
      // Устанавливаем publishedAt через прямой запрос к API
      try {
        // Получаем системный токен
        const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
        const directusUrl = process.env.DIRECTUS_URL;
        
        // Пробуем получить токен из активных сессий
        const sessions = directusAuthManager.getAllActiveSessions();
        let token = null;
        
        if (sessions.length > 0) {
          token = sessions[0].token;
        }
        
        if (token) {
          await axios.patch(
            `${directusUrl}/items/campaign_content/${contentId}`,
            { published_at: new Date().toISOString() },
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          log(`Установлено поле published_at для контента ${contentId}`, 'api');
        }
      } catch (error: any) {
        log(`Ошибка при установке published_at: ${error.message}`, 'api');
      }
      
      // Новый планировщик автоматически обрабатывает статусы контента
      // поэтому нет необходимости в ручном добавлении в список обработанных
      log(`Контент ${contentId} помечен как опубликованный`, 'api');
      
      return res.status(200).json({
        success: true,
        message: `Контент ${contentId} помечен как опубликованный без фактической публикации`,
        contentId
      });
    } catch (error: any) {
      log(`Ошибка при пометке контента как опубликованного: ${error.message}`, 'api');
      return res.status(500).json({
        error: 'Ошибка при пометке контента как опубликованного',
        message: error.message
      });
    }
  });
  
  // Очистка кэша обработанных ID контента
  // Важно: этот маршрут должен быть определен ДО маршрута с параметром :contentId
  app.all('/api/publish/reset-processed-cache', async (req: Request, res: Response) => {
    try {
      log('Запрос на очистку кэша обработанных ID контента', 'api');
      
      // Новый планировщик не использует кэш обработанных ID
      // Он работает на основе статусов в базе данных
      const publishScheduler = getPublishScheduler();
      publishScheduler.stop();
      publishScheduler.start();
      
      log('Кэш обработанных ID контента очищен', 'api');
      
      return res.status(200).json({ 
        success: true, 
        message: 'Кэш обработанных ID контента очищен'
      });
    } catch (error: any) {
      log(`Ошибка при очистке кэша обработанных ID: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при очистке кэша обработанных ID',
        message: error.message
      });
    }
  });
  
  // Публикация контента через API для тестирования
  app.post('/api/publish/content', async (req: Request, res: Response) => {
    try {
      log(`Запрос на публикацию контента через API`, 'api');
      
      // Получаем объект контента и список платформ из запроса
      const { content, platforms, userId, force = false } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Объект контента не предоставлен' });
      }
      
      // Обработка двух возможных форматов платформ: массив или объект
      let selectedPlatforms: string[] = [];
      
      if (Array.isArray(platforms)) {
        // Формат массива: ["telegram", "vk"]
        selectedPlatforms = platforms;
      } else if (platforms && typeof platforms === 'object') {
        // Формат объекта: {telegram: true, vk: true, instagram: false}
        selectedPlatforms = Object.entries(platforms)
          .filter(([_, selected]) => selected === true)
          .map(([name]) => name);
      }
      
      // Проверка, что выбрана хотя бы одна платформа
      if (!selectedPlatforms.length) {
        log(`[publishing-routes] Ошибка: не указаны платформы для публикации. Переданные данные: ${JSON.stringify(platforms)}`, 'api');
        return res.status(400).json({ error: 'Не указаны платформы для публикации' });
      }
      
      // Заменяем оригинальные platforms на преобразованный массив, чтобы не менять остальной код
      const platformsArray = selectedPlatforms;
      
      log(`Публикация контента ${content.id || 'без ID'} в платформы: ${JSON.stringify(selectedPlatforms)}`, 'api');
      
      // КРИТИЧЕСКАЯ ЗАЩИТА: Проверяем уже опубликованные платформы
      const alreadyPublishedPlatforms: string[] = [];
      const platformsToPublish: string[] = [];
      
      if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
        for (const platform of platformsArray) {
          const platformData = content.socialPlatforms[platform];
          
          // Платформа считается уже опубликованной, если есть статус 'published' И postUrl
          if (platformData && platformData.status === 'published' && platformData.postUrl && platformData.postUrl.trim() !== '') {
            alreadyPublishedPlatforms.push(platform);
            log(`БЛОКИРОВКА: Платформа ${platform} уже опубликована (postUrl: ${platformData.postUrl}), пропускаем`, 'api');
          } else {
            platformsToPublish.push(platform);
            
            // Сбрасываем некорректные published статусы без postUrl
            if (platformData && platformData.status === 'published' && (!platformData.postUrl || platformData.postUrl.trim() === '')) {
              log(`ИСПРАВЛЕНИЕ: Сброс некорректного статуса 'published' без postUrl для платформы ${platform} в /api/publish/content`, 'api');
            }
          }
        }
      } else {
        // Если нет данных о платформах, публикуем во все выбранные
        platformsToPublish.push(...platformsArray);
      }

      // Если все выбранные платформы уже опубликованы
      if (platformsToPublish.length === 0) {
        return res.status(409).json({
          error: 'Все выбранные платформы уже опубликованы',
          alreadyPublished: alreadyPublishedPlatforms,
          message: `Контент уже опубликован в: ${alreadyPublishedPlatforms.join(', ')}`
        });
      }

      // Информируем о частичной публикации
      if (alreadyPublishedPlatforms.length > 0) {
        log(`Частичная публикация: ${platformsToPublish.join(', ')} (уже опубликовано: ${alreadyPublishedPlatforms.join(', ')})`, 'api');
      }
      
      // Получаем настройки кампании
      const campaign = await storage.getCampaignById(content.campaignId);
      if (!campaign) {
        log(`Кампания ${content.campaignId} не найдена при попытке публикации контента`, 'api');
        return res.status(404).json({ error: `Кампания ${content.campaignId} не найдена` });
      }
      
      // Получаем админский токен для обновления статуса публикации
      const systemToken = await socialPublishingService.getSystemToken();
      if (!systemToken) {
        log(`Не удалось получить системный токен для публикации контента`, 'api');
      } else {
        log(`Системный токен для публикации контента получен успешно`, 'api');
      }
      
      // Публикуем контент во все указанные платформы
      const results: Record<string, any> = {}; 
      let hasSuccess = false;
      
      // Сбрасываем успешный результат для повторных попыток
      if (force) {
        log(`Принудительная повторная публикация контента ${content.id || 'без ID'}`, 'api');
      }

      try {
        // Устанавливаем статус в pending для всех платформ
        if (content.id) {
          // Создаем socialPlatforms объект, если его нет
          const socialPlatforms = content.socialPlatforms || {};
          
          const updatedPlatforms: Record<string, any> = {};
          
          // Обновляем статус только для платформ, которые нужно опубликовать
          for (const platform of platformsToPublish) {
            updatedPlatforms[platform] = {
              ...(socialPlatforms[platform] || {}),
              status: 'pending',
              error: null
            };
          }
          
          // Обновляем контент через хранилище
          await storage.updateCampaignContent(content.id, {
            socialPlatforms: {
              ...socialPlatforms,
              ...updatedPlatforms
            }
          }, systemToken || undefined);
          
          log(`Статус публикации установлен в pending для контента ${content.id}`, 'api');
        }
        
        // Публикуем ТОЛЬКО на платформы, которые нужно опубликовать
        for (const platformName of platformsToPublish) {
          const platform = platformName as SocialPlatform;
          
          try {
            log(`Публикация контента в ${platform}`, 'api');
            
            // Публикуем контент в выбранную платформу
            const result = await socialPublishingService.publishToPlatform(platform, content, campaign, systemToken || undefined);
            
            results[platform] = {
              success: true,
              result,
              contentId: content.id
            };
            
            hasSuccess = true;
            
            if (result && result.messageId) {
              log(`Публикация в ${platform} успешна, messageId: ${result.messageId}`, 'api');
            } else if (result && result.url) {
              log(`Публикация в ${platform} успешна, url: ${result.url}`, 'api');
            } else {
              log(`Публикация в ${platform} успешна, результат без messageId`, 'api');
            }
          } catch (platformError: any) {
            results[platform] = {
              success: false,
              error: platformError.message || 'Неизвестная ошибка',
              contentId: content.id
            };
            
            log(`Ошибка публикации в ${platform}: ${platformError.message}`, 'api');
            
            // Обновляем статус публикации в Directus
            if (content.id) {
              // Если есть системный токен, обновляем статус публикации
              if (systemToken) {
                try {
                  const socialPlatforms = content.socialPlatforms || {};
                  
                  await storage.updateCampaignContent(content.id, {
                    socialPlatforms: {
                      ...socialPlatforms,
                      [platform]: {
                        ...(socialPlatforms[platform] || {}),
                        status: 'failed',
                        error: platformError.message || 'Неизвестная ошибка'
                      }
                    }
                  }, systemToken);
                  
                  log(`Статус публикации обновлен на failed для ${platform}`, 'api');
                } catch (updateError: any) {
                  log(`Ошибка при обновлении статуса публикации: ${updateError.message}`, 'api');
                }
              } else {
                log(`Не удалось обновить статус публикации для ${platform} - нет системного токена`, 'api');
              }
            }
          }
        }
      } catch (error: any) {
        log(`Общая ошибка публикации: ${error.message}`, 'api');
        return res.status(500).json({
          error: 'Ошибка при публикации контента',
          message: error.message,
          details: results
        });
      }
      
      // Возвращаем результат
      if (hasSuccess) {
        return res.status(200).json({
          success: true,
          results
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Не удалось опубликовать контент ни на одной платформе',
          results
        });
      }
    } catch (error: any) {
      log(`Ошибка при публикации контента: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при публикации контента', 
        message: error.message 
      });
    }
  });

  // Публикация контента по ID, с указанием платформ
  app.post('/api/publish/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      const { platforms } = req.body;

      log(`Запрос на ручную публикацию контента ${contentId} в платформы: ${JSON.stringify(platforms)}`, 'api');

      // Проверяем параметры
      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }

      // Обработка двух возможных форматов платформ: массив или объект
      let selectedPlatforms: string[] = [];
      
      if (Array.isArray(platforms)) {
        // Формат массива: ["telegram", "vk"]
        selectedPlatforms = platforms;
      } else if (platforms && typeof platforms === 'object') {
        // Формат объекта: {telegram: true, vk: true, instagram: false}
        selectedPlatforms = Object.entries(platforms)
          .filter(([_, selected]) => selected === true)
          .map(([name]) => name);
      }
      
      // Проверка, что выбрана хотя бы одна платформа
      if (!selectedPlatforms.length) {
        log(`[publishing-routes] Ошибка: не указаны платформы для публикации контента ${contentId}. Переданные данные: ${JSON.stringify(platforms)}`, 'api');
        return res.status(400).json({ error: 'Не указаны платформы для публикации' });
      }
      
      // Заменяем оригинальные platforms на преобразованный массив, чтобы не менять остальной код
      const platformsArray = selectedPlatforms;

      // КРИТИЧЕСКАЯ ЗАЩИТА: Проверяем наличие уже опубликованного контента
      const existingContent = await storage.getCampaignContentById(contentId);
      if (!existingContent) {
        log(`Контент ${contentId} не найден при попытке публикации`, 'api');
        return res.status(404).json({ error: 'Контент не найден' });
      }

      // Проверяем статусы выбранных платформ на предмет уже выполненной публикации
      const alreadyPublishedPlatforms: string[] = [];
      const platformsToPublish: string[] = [];
      
      if (existingContent.socialPlatforms && typeof existingContent.socialPlatforms === 'object') {
        for (const platform of platformsArray) {
          const platformData = existingContent.socialPlatforms[platform];
          
          // Платформа считается уже опубликованной, если есть статус 'published' И postUrl
          if (platformData && platformData.status === 'published' && platformData.postUrl && platformData.postUrl.trim() !== '') {
            alreadyPublishedPlatforms.push(platform);
            log(`БЛОКИРОВКА: Платформа ${platform} уже опубликована (postUrl: ${platformData.postUrl}), пропускаем`, 'api');
          } else {
            platformsToPublish.push(platform);
            
            // Сбрасываем некорректные published статусы без postUrl
            if (platformData && platformData.status === 'published' && (!platformData.postUrl || platformData.postUrl.trim() === '')) {
              log(`ИСПРАВЛЕНИЕ: Сброс некорректного статуса 'published' без postUrl для платформы ${platform}`, 'api');
              try {
                await storage.updateCampaignContent(contentId, {
                  socialPlatforms: {
                    ...existingContent.socialPlatforms,
                    [platform]: {
                      ...(existingContent.socialPlatforms[platform] || {}),
                      status: 'pending',
                      error: null
                    }
                  }
                });
              } catch (updateError: any) {
                log(`Ошибка при сбросе статуса платформы ${platform}: ${updateError.message}`, 'api');
              }
            }
          }
        }
      } else {
        // Если нет данных о платформах, публикуем во все выбранные
        platformsToPublish.push(...platformsArray);
      }

      // Если все выбранные платформы уже опубликованы
      if (platformsToPublish.length === 0) {
        return res.status(409).json({
          error: 'Все выбранные платформы уже опубликованы',
          alreadyPublished: alreadyPublishedPlatforms,
          message: `Контент уже опубликован в: ${alreadyPublishedPlatforms.join(', ')}`
        });
      }

      // Информируем о том, какие платформы будут опубликованы
      if (alreadyPublishedPlatforms.length > 0) {
        log(`Частичная публикация: ${platformsToPublish.join(', ')} (уже опубликовано: ${alreadyPublishedPlatforms.join(', ')})`, 'api');
      }

      // Получаем контент
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        log(`Контент ${contentId} не найден при попытке публикации`, 'api');
        return res.status(404).json({ error: 'Контент не найден' });
      }

      // Получаем кампанию
      const campaign = await storage.getCampaignById(content.campaignId);
      if (!campaign) {
        log(`Кампания ${content.campaignId} не найдена при попытке публикации контента ${contentId}`, 'api');
        return res.status(404).json({ error: `Кампания ${content.campaignId} не найдена` });
      }

      // Получаем админский токен для обновления статуса публикации
      const systemToken = await socialPublishingService.getSystemToken();
      if (!systemToken) {
        log(`Не удалось получить системный токен для публикации контента ${contentId}`, 'api');
      } else {
        log(`Системный токен для публикации контента ${contentId} получен успешно`, 'api');
      }

      // Публикуем контент во все указанные платформы
      const results: Record<string, any> = {};
      let hasSuccess = false;

      try {
        // Устанавливаем статус в pending для всех платформ
        // Создаем socialPlatforms объект, если его нет
        const socialPlatforms = content.socialPlatforms || {};
        
        const updatedPlatforms: Record<string, any> = {};
        
        // Обновляем статус только для платформ, которые нужно опубликовать
        for (const platform of platformsToPublish) {
          updatedPlatforms[platform] = {
            ...(socialPlatforms[platform] || {}),
            status: 'pending',
            error: null
          };
        }
        
        // Обновляем контент через хранилище
        await storage.updateCampaignContent(content.id, {
          socialPlatforms: {
            ...socialPlatforms,
            ...updatedPlatforms
          }
        }, systemToken || undefined);
        
        log(`Статус публикации установлен в pending для контента ${content.id}`, 'api');
        
        // Публикуем ТОЛЬКО на платформы, которые нужно опубликовать
        for (const platformName of platformsToPublish) {
          const platform = platformName as SocialPlatform;
          
          try {
            log(`Публикация контента ${content.id} в ${platform}`, 'api');
            
            // Публикуем контент в выбранную платформу
            const result = await socialPublishingService.publishToPlatform(platform, content, campaign, systemToken || undefined);
            
            results[platform] = {
              success: true,
              result,
              contentId: content.id
            };
            
            hasSuccess = true;
            
            if (result && result.messageId) {
              log(`Публикация ${content.id} в ${platform} успешна, messageId: ${result.messageId}`, 'api');
            } else if (result && result.url) {
              log(`Публикация ${content.id} в ${platform} успешна, url: ${result.url}`, 'api');
            } else {
              log(`Публикация ${content.id} в ${platform} успешна, результат без messageId`, 'api');
            }
          } catch (platformError: any) {
            results[platform] = {
              success: false,
              error: platformError.message || 'Неизвестная ошибка',
              contentId: content.id
            };
            
            log(`Ошибка публикации ${content.id} в ${platform}: ${platformError.message}`, 'api');
            
            // Если есть системный токен, обновляем статус публикации
            if (systemToken) {
              try {
                const socialPlatforms = content.socialPlatforms || {};
                
                await storage.updateCampaignContent(content.id, {
                  socialPlatforms: {
                    ...socialPlatforms,
                    [platform]: {
                      ...(socialPlatforms[platform] || {}),
                      status: 'failed',
                      error: platformError.message || 'Неизвестная ошибка'
                    }
                  }
                }, systemToken);
                
                log(`Статус публикации ${content.id} обновлен на failed для ${platform}`, 'api');
              } catch (updateError: any) {
                log(`Ошибка при обновлении статуса публикации ${content.id}: ${updateError.message}`, 'api');
              }
            } else {
              log(`Не удалось обновить статус публикации ${content.id} для ${platform} - нет системного токена`, 'api');
            }
          }
        }
      } catch (error: any) {
        log(`Общая ошибка публикации ${contentId}: ${error.message}`, 'api');
        return res.status(500).json({
          error: 'Ошибка при публикации контента',
          message: error.message,
          details: results
        });
      }
      
      // Возвращаем результат
      if (hasSuccess) {
        return res.status(200).json({
          success: true,
          results
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Не удалось опубликовать контент ни на одной платформе',
          results
        });
      }
    } catch (error: any) {
      log(`Ошибка при публикации контента с ID ${req.params.contentId}: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при публикации контента', 
        message: error.message 
      });
    }
  });

  // Получение статуса публикации
  app.get('/api/publish/status/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      
      // Проверяем параметры
      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }
      
      // Получаем контент
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Контент не найден' });
      }
      
      // Возвращаем статус публикации по платформам
      return res.status(200).json({ 
        success: true, 
        data: {
          contentId: content.id,
          status: content.status,
          scheduledAt: content.scheduledAt,
          socialPlatforms: content.socialPlatforms || {}
        }
      });
    } catch (error: any) {
      log(`Ошибка при получении статуса публикации: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при получении статуса публикации',
        message: error.message
      });
    }
  });

  // Отмена запланированной публикации
  app.post('/api/publish/cancel/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      const authHeader = req.headers.authorization;
      
      // Проверяем параметры
      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }
      
      // Проверяем наличие заголовка авторизации
      if (!authHeader) {
        log('No authorization header provided for cancel publication', 'api');
        return res.status(401).json({ error: 'Не авторизован: Отсутствует заголовок авторизации' });
      }
      
      // Получаем контент
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Контент не найден' });
      }
      
      // Получаем токен авторизации
      let authToken = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.substring(7);
        
        // Настраиваем временно токен для пользователя, если есть userId в контенте
        if (content.userId) {
          directusApiManager.cacheAuthToken(content.userId, authToken);
        }
      }
      
      // Проверяем, что контент запланирован
      if (content.status !== 'scheduled' || !content.scheduledAt) {
        return res.status(400).json({ error: 'Для этого контента не запланирована публикация' });
      }
      
      // Создаем типизированную копию объекта socialPlatforms
      const typedPlatforms: Record<string, any> = content.socialPlatforms 
        ? JSON.parse(JSON.stringify(content.socialPlatforms)) 
        : {};
      
      // Создаем новый объект для обновленных платформ
      const updatedPlatforms: Record<string, any> = {};
      
      // Обрабатываем каждую платформу
      for (const platform of Object.keys(typedPlatforms)) {
        const platformData = typedPlatforms[platform];
        
        // Проверяем наличие данных и статуса
        if (platformData && typeof platformData === 'object') {
          if (platformData.status === 'scheduled' || platformData.status === 'pending') {
            // Копируем все свойства и изменяем статус
            updatedPlatforms[platform] = {
              ...platformData,
              status: 'cancelled'
            };
          } else {
            // Сохраняем без изменений
            updatedPlatforms[platform] = { ...platformData };
          }
        }
      }
      
      // Обновляем контент через интерфейс хранилища и напрямую через API
      let directUpdateSuccessful = false;
      
      try {
        // Сначала попробуем прямое обновление через API
        if (authToken) {
          log(`Отмена публикации ${contentId} через API напрямую`, 'api');
          
          const directUpdateResponse = await directusApiManager.request({
            url: `/items/campaign_content/${contentId}`,
            method: 'patch',
            data: {
              status: 'draft',
              scheduled_at: null,
              social_platforms: updatedPlatforms
            },
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          log(`Публикация ${contentId} успешно отменена через API напрямую`, 'api');
          directUpdateSuccessful = true;
        }
      } catch (directUpdateError: any) {
        log(`Ошибка при прямом обновлении через API: ${directUpdateError.message}`, 'api');
      }
      
      // Обновляем также через интерфейс хранилища
      try {
        await storage.updateCampaignContent(contentId, {
          status: 'draft', // Возвращаем в статус черновика
          scheduledAt: null, // Убираем планирование
          socialPlatforms: updatedPlatforms
        });
        log(`Публикация ${contentId} отменена через storage`, 'api');
      } catch (storageError: any) {
        // Если прямое обновление не было успешным и произошла ошибка в хранилище,
        // то выбрасываем исключение
        if (!directUpdateSuccessful) {
          throw new Error(`Failed to cancel publication: ${storageError.message}`);
        } else {
          log(`Предупреждение: Ошибка при отмене через storage, но прямое обновление прошло успешно: ${storageError.message}`, 'api');
        }
      }
      
      log(`Публикация ${contentId} полностью отменена`, 'api');
      
      return res.status(200).json({ 
        success: true, 
        message: 'Публикация успешно отменена'
      });
    } catch (error: any) {
      log(`Ошибка при отмене публикации: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при отмене публикации',
        message: error.message
      });
    }
  });
  
  // Получение списка запланированных публикаций
  app.get('/api/publish/scheduled', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const campaignId = req.query.campaignId as string;
      const authHeader = req.headers.authorization;
      
      log(`=== ЗАПРОС ЗАПЛАНИРОВАННЫХ ПУБЛИКАЦИЙ ===`, 'api');
      log(`userId: ${userId}, campaignId: ${campaignId}`, 'api');
      log(`authHeader присутствует: ${!!authHeader}`, 'api');
      
      // Получаем запланированные публикации из базы данных
      let scheduledContent: any[] = [];
      
      // Пытаемся получить токен авторизации
      let authToken: string | null = null;
      let currentUserId: string | null = userId;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.substring(7);
        
        // Проверяем, указан ли userId и пытаемся получить его из токена
        if (!currentUserId && authToken) {
          try {
            // Запрашиваем информацию о пользователе через токен
            const userResponse = await directusApiManager.request({
              // Используется декодирование токена
              method: 'get'
            }, authToken);
            
            if (userResponse?.data?.id) {
              currentUserId = userResponse.data.id;
              log(`Получен userId=${currentUserId} из токена авторизации`, 'api');
            }
          } catch (error: any) {
            log(`Ошибка при получении информации о пользователе: ${error.message}`, 'api');
          }
        }
        
        // Кэшируем токен для пользователя (для последующих запросов)
        if (authToken && currentUserId) {
          directusApiManager.cacheAuthToken(currentUserId, authToken);
          log(`Токен для пользователя ${currentUserId} кэширован`, 'api');
        }
      } else {
        log('No authorization header provided for scheduled content', 'api');
      }
      
      try {
        if (authToken) {
          // Если есть токен авторизации, запрашиваем данные из Directus через улучшенный адаптер
          log(`Запрос запланированных публикаций с токеном авторизации для пользователя ${currentUserId || 'неизвестного'}`, 'api');
          
          if (currentUserId) {
            // Используем новый адаптер с улучшенным механизмом получения токена
            scheduledContent = await directusStorageAdapter.getScheduledContent(currentUserId, campaignId);
            log(`Получено ${scheduledContent.length} запланированных публикаций из улучшенного адаптера для ${currentUserId}`, 'api');
            
            // Если не удалось получить публикации через улучшенный адаптер, используем стандартный метод
            if (scheduledContent.length === 0) {
              log(`Используем стандартное хранилище для получения запланированных публикаций для ${currentUserId}`, 'api');
              scheduledContent = await storage.getScheduledContent(currentUserId, campaignId);
              log(`Получено ${scheduledContent.length} запланированных публикаций из стандартного хранилища для ${currentUserId}`, 'api');
            }
          } else {
            // Если не смогли получить userId из токена, пытаемся получить все запланированные публикации
            // напрямую из API Directus без фильтрации по пользователю
            try {
              log(`Запрос всех запланированных публикаций через API (без фильтрации по userId)`, 'api');
              
              const directusUrl = process.env.DIRECTUS_URL;
              const response = await axios.get(`${directusUrl}/items/campaign_content`, {
                params: {
                  filter: { status: { _in: ['scheduled', 'partial'] } }
                },
                headers: { 'Authorization': `Bearer ${authToken}` }
              });
              
              if (response?.data?.data && Array.isArray(response.data.data)) {
                // Преобразуем формат данных из Directus в наш формат CampaignContent
                scheduledContent = response.data.data.map((item: any) => ({
                  id: item.id,
                  content: item.content,
                  userId: item.user_id,
                  campaignId: item.campaign_id,
                  status: item.status,
                  contentType: item.content_type || "text",
                  title: item.title || null,
                  imageUrl: item.image_url,
                  videoUrl: item.video_url,
                  prompt: item.prompt || "",
                  scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
                  createdAt: new Date(item.created_at),
                  socialPlatforms: item.social_platforms,
                  publishedPlatforms: item.published_platforms || [],
                  keywords: item.keywords || []
                }));
                
                log(`Получено ${scheduledContent.length} запланированных публикаций напрямую через API`, 'api');
              }
            } catch (apiError: any) {
              log(`Ошибка при запросе запланированных публикаций напрямую через API: ${apiError.message}`, 'api');
            }
          }
        } else {
          // Если нет токена, пропускаем запрос к Directus
          log('Пропускаем запрос запланированных публикаций к Directus API из-за отсутствия токена', 'api');
        }
      } catch (dbError: any) {
        log(`Ошибка при получении запланированных публикаций из БД: ${dbError.message}`, 'api');
      }
      
      // Если нет данных через Directus или нет токена, ищем локально запланированные публикации
      if (scheduledContent.length === 0) {
        // Получаем все контенты пользователя и фильтруем по запланированным
        try {
          log(`Попытка поиска локально запланированных публикаций для пользователя ${userId}`, 'api');
          const allContent = await storage.getCampaignContent(userId, campaignId);
          log(`Получено ${allContent.length} единиц контента для поиска запланированных`, 'api');
          
          // ИСПРАВЛЕНО: Упрощенная и более надежная логика фильтрации запланированных постов
          scheduledContent = allContent.filter(content => {
            // Основной критерий: статус 'scheduled' или 'partial'
            if (content.status === 'scheduled' || content.status === 'partial') {
              log(`Найден запланированный пост: ${content.id} (статус: ${content.status})`, 'api');
              return true;
            }
            
            // Дополнительная проверка: есть платформы в состоянии 'pending' или 'scheduled'
            if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
              const hasPendingPlatforms = Object.values(content.socialPlatforms).some(platformData => {
                return platformData && 
                       typeof platformData === 'object' && 
                       ((platformData as any).status === 'pending' || (platformData as any).status === 'scheduled');
              });
              
              if (hasPendingPlatforms) {
                log(`Найден пост с запланированными платформами: ${content.id}`, 'api');
                return true;
              }
            }
            
            return false;
          });
          
          log(`Найдено ${scheduledContent.length} локально запланированных публикаций`, 'api');
        } catch (error: any) {
          log(`Ошибка при поиске локально запланированных публикаций: ${error.message}`, 'api');
        }
      }
      
      // Возвращаем результат, даже если список пустой
      return res.status(200).json({ 
        success: true, 
        data: scheduledContent
      });
    } catch (error: any) {
      log(`Ошибка при получении запланированных публикаций: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при получении запланированных публикаций',
        message: error.message
      });
    }
  });
  
  // Маршрут для обновления контента кампании через публикационный интерфейс
  app.patch('/api/publish/update-content/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const authHeader = req.headers.authorization;
      
      // Проверяем заголовок авторизации
      if (!authHeader) {
        return res.status(401).json({ error: 'Не авторизован: Отсутствует заголовок авторизации' });
      }
      
      let userId = '';
      let token = '';
      
      // Получаем токен авторизации
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        
        try {
          // Пробуем получить информацию о пользователе из токена
          const userInfo = await directusApiManager.request({
            // Используется декодирование токена
            method: 'get'
          }, token);
          
          if (userInfo?.data?.id) {
            userId = userInfo.data.id;
            directusApiManager.cacheAuthToken(userId, token);
          }
        } catch (error) {
          log(`Ошибка получения информации о пользователе: ${error}`, 'api');
        }
      }
      
      // Получаем контент с помощью токена
      let content = await storage.getCampaignContentById(id, token);
      
      // Если контент не найден, возвращаем 404
      if (!content) {
        return res.status(404).json({ error: 'Контент не найден' });
      }
      
      // Используем идентификатор пользователя из контента, если он не указан в обновлениях
      if (!updates.userId && content.userId) {
        updates.userId = content.userId;
      }
      
      // Обновляем контент с передачей токена авторизации
      const updatedContent = await storage.updateCampaignContent(id, updates, token);
      
      return res.status(200).json({
        success: true,
        data: updatedContent
      });
    } catch (error: any) {
      log(`Ошибка при обновлении контента: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при обновлении контента', 
        message: error.message 
      });
    }
  });
  
  // Прямое API для планирования публикаций без использования storage
  app.post('/api/direct-schedule/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      const { scheduledAt, socialPlatforms } = req.body;
      
      log(`Получен запрос на планирование публикации ${contentId}`, 'api');
      const authHeader = req.headers.authorization;
      
      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }
      
      if (!scheduledAt) {
        return res.status(400).json({ error: 'Не указана дата публикации' });
      }
      
      if (!socialPlatforms || typeof socialPlatforms !== 'object') {
        return res.status(400).json({ error: 'Не указаны платформы для публикации' });
      }
      
      if (!authHeader) {
        log('No authorization header provided for direct scheduling', 'api');
        return res.status(401).json({ error: 'Не авторизован: Отсутствует заголовок авторизации' });
      }
      
      let token = '';
      let userId = '';
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        
        try {
          // Получаем информацию о пользователе из токена
          log(`Отправляем запрос к Directus API с токеном: ${token.substring(0, 15)}...`, 'api');
          const userInfo = await directusApiManager.request({
            // Используется декодирование токена
            method: 'get',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (userInfo && userInfo.data && userInfo.data.id) {
            userId = userInfo.data.id;
            log(`Определен userId из токена: ${userId}`, 'api');
            directusApiManager.cacheAuthToken(userId, token);
          }
        } catch (error) {
          log(`Ошибка получения информации о пользователе: ${error}`, 'api');
        }
      }
      
      // Проверяем существование контента и обновляем его через storage
      try {
        // Получаем контент через storage, передаем токен авторизации
        log(`Получаем контент с ID ${contentId} через хранилище, с токеном авторизации`, 'api');
        
        if (!token) {
          log(`Ошибка авторизации: токен не определен при получении контента ${contentId}`, 'api');
          return res.status(401).json({ 
            error: 'Ошибка авторизации', 
            message: 'Для планирования публикации необходимо авторизоваться'
          });
        }
        
        let content = await storage.getCampaignContentById(contentId, token);
        
        if (!content) {
          log(`Контент с ID ${contentId} не найден в базе данных`, 'api');
          
          // Пробуем через прямой API запрос без storage
          try {
            log(`Пробуем получить контент напрямую через API с токеном`, 'api');
            
            const directResponse = await directusApiManager.request({
              url: `/items/campaign_content/${contentId}`,
              method: 'get',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (!directResponse || !directResponse.data || !directResponse.data.data) {
              return res.status(404).json({ 
                error: 'Контент не найден', 
                message: `Контент с ID ${contentId} не найден ни одним из способов`
              });
            }
            
            // Создаем объект контента из прямого ответа API для дальнейшей обработки
            const contentData = directResponse.data.data;
            // Преобразуем имена полей из snake_case в camelCase для совместимости с нашей моделью
            content = {
              id: contentData.id,
              userId: contentData.user_id,
              createdAt: contentData.date_created ? new Date(contentData.date_created) : null,
              campaignId: contentData.campaign_id,
              title: contentData.title,
              content: contentData.content || '',
              contentType: contentData.content_type || 'text',
              imageUrl: contentData.image_url,
              additionalImages: contentData.additional_images,
              status: contentData.status || 'draft',
              scheduledAt: contentData.scheduled_at ? new Date(contentData.scheduled_at) : null,
              socialPlatforms: contentData.social_platforms || {},
              tags: contentData.tags || [],
              sourceId: contentData.source_id,
              sourceType: contentData.source_type,
              metadata: contentData.metadata || {},
              // Дополнительные поля, которые могут быть в Directus (опциональные)
              imagePrompt: contentData.image_prompt
            };
            
            log(`Контент получен через прямой API запрос`, 'api');
          } catch (apiError: any) {
            log(`Ошибка при попытке получить контент через API: ${apiError.message}`, 'api');
            return res.status(404).json({ 
              error: 'Контент не найден', 
              message: `Контент с ID ${contentId} не найден: ${apiError.message}`
            });
          }
        }
        
        // Обновляем контент через прямой API запрос
        try {
          log(`Прямое обновление контента ${contentId} через API для планирования`, 'api');
          
          // ИСПРАВЛЕНИЕ: ПОЛНАЯ ЗАМЕНА ПЛАТФОРМ, А НЕ ОБЪЕДИНЕНИЕ
          // Используем только те платформы, которые пришли в запросе
          // Это позволит корректно удалять неотмеченные платформы
          const mergedSocialPlatforms = { ...socialPlatforms };
          
          log(`КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем только выбранные платформы`, 'api');
          log(`Платформы из запроса: ${Object.keys(socialPlatforms).join(', ')}`, 'api');
          
          // Если поля socialPlatforms пустое или не содержит данных о времени публикации,
          // но указано общее время scheduledAt, применяем это время ко всем платформам
          const scheduledAtDate = new Date(scheduledAt);
          log(`Установлено общее время публикации: ${scheduledAtDate.toISOString()}`, 'api');
          
          // Получаем список всех платформ для публикации
          const allPlatforms = Object.keys(mergedSocialPlatforms);
          
          // Для каждой платформы проверяем наличие своего scheduledAt или scheduled_at
          allPlatforms.forEach(platform => {
            // Проверяем все возможные ключи для времени публикации
            const hasTime = mergedSocialPlatforms[platform] && 
                           (mergedSocialPlatforms[platform].scheduledAt || 
                            mergedSocialPlatforms[platform].scheduled_at);
            
            if (!mergedSocialPlatforms[platform]) {
              // Если платформа указана, но нет данных, создаем объект
              mergedSocialPlatforms[platform] = {
                platform: platform,
                status: 'pending',
                scheduledAt: scheduledAtDate.toISOString(),
                scheduled_at: scheduledAtDate.toISOString() // Добавляем оба формата для совместимости
              };
              log(`Создана новая запись для платформы ${platform} со временем ${scheduledAtDate.toISOString()}`, 'api');
            } 
            else if (!hasTime) {
              // Если у платформы отсутствует время публикации, устанавливаем общее
              mergedSocialPlatforms[platform].scheduledAt = scheduledAtDate.toISOString();
              mergedSocialPlatforms[platform].scheduled_at = scheduledAtDate.toISOString();
              log(`Установлено время для платформы ${platform}: ${scheduledAtDate.toISOString()}`, 'api');
            }
          });
          
          // Добавляем подробное логирование для отладки
          log(`Платформы из запроса: ${JSON.stringify(socialPlatforms)}`, 'api');
          log(`Итоговые платформы с временем публикации: ${JSON.stringify(mergedSocialPlatforms)}`, 'api');
          
          const updateData = {
            status: 'scheduled',
            scheduled_at: scheduledAt, // Основное время публикации (используется только как ориентир)
            social_platforms: mergedSocialPlatforms // Обновленные данные о платформах
          };
          
          // Выполняем запрос к API Directus
          const updateResponse = await directusApiManager.request({
            url: `/items/campaign_content/${contentId}`,
            method: 'patch',
            data: updateData,
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          log(`Планирование контента ${contentId} через API успешно`, 'api');
          
          // Также обновляем через storage для синхронизации кэша
          try {
            await storage.updateCampaignContent(contentId, {
              status: 'scheduled',
              scheduledAt: new Date(scheduledAt),
              socialPlatforms: mergedSocialPlatforms // Используем объединенные платформы для согласованности с API
            }, token);
            
            log(`Контент ${contentId} также обновлен через storage`, 'api');
          } catch (storageError: any) {
            log(`Предупреждение: Не удалось обновить кэш storage для ${contentId}: ${storageError.message}`, 'api');
          }
          
          return res.status(200).json({
            success: true,
            message: 'Публикация успешно запланирована',
            contentId,
            scheduledAt,
            platforms: Object.keys(socialPlatforms)
          });
        } catch (updateError: any) {
          log(`Ошибка при обновлении контента через API: ${updateError.message}`, 'api');
          return res.status(500).json({
            error: 'Ошибка при планировании публикации',
            message: updateError.message
          });
        }
      } catch (error: any) {
        log(`Общая ошибка при планировании публикации: ${error.message}`, 'api');
        return res.status(500).json({
          error: 'Ошибка при планировании публикации',
          message: error.message
        });
      }
    } catch (error: any) {
      log(`Ошибка при планировании публикации: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при планировании публикации', 
        message: error.message 
      });
    }
  });
}