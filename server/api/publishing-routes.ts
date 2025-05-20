import { Express, Request, Response } from 'express';
import axios from 'axios';
import { storage } from '../storage';
import { socialPublishingService } from '../services/social/index';

// Не используем старый сервис, заменив его на новый модульный
import { publishScheduler } from '../services/publish-scheduler';
// Используем тип как строку, так как его нет в shared/schema
type SocialPlatform = 'telegram' | 'vk' | 'instagram' | 'facebook';
import { log } from '../utils/logger';
import { directusApiManager } from '../directus';
import { directusStorageAdapter } from '../services/directus';

/**
 * Регистрирует маршруты для управления публикациями
 * @param app Express приложение
 */
export function registerPublishingRoutes(app: Express): void {
  console.log('[publishing-routes] Регистрация маршрутов управления публикациями...');
  
  // Специальный маршрут для запуска проверки запланированных публикаций
  // Важно: этот маршрут должен быть определен ДО маршрута с параметром :contentId
  app.all('/api/publish/check-scheduled', async (req: Request, res: Response) => {
    try {
      log('Запрос на проверку запланированных публикаций', 'api');
      
      // Проверяем запланированные публикации немедленно
      publishScheduler.checkScheduledContent()
        .then(() => {
          log('Проверка запланированных публикаций завершена', 'api');
        })
        .catch((error) => {
          log(`Ошибка при проверке запланированных публикаций: ${error.message}`, 'api');
        });

      // Возвращаем успешный результат не дожидаясь завершения проверки
      return res.status(200).json({ 
        success: true, 
        message: 'Проверка запланированных публикаций запущена'
      });
    } catch (error: any) {
      log(`Ошибка при запуске проверки публикаций: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при запуске проверки публикаций',
        message: error.message
      });
    }
  });
  
  // Управление глобальным флагом отключения публикаций
  // Важно: этот маршрут должен быть определен ДО маршрута с параметром :contentId
  app.all('/api/publish/toggle-publishing', async (req: Request, res: Response) => {
    try {
      const enable = req.query.enable === 'true';
      
      if (enable) {
        publishScheduler.disablePublishing = false;
        log('Глобальный флаг публикаций ВКЛЮЧЕН. Контент будет публиковаться в соцсети.', 'api');
      } else {
        publishScheduler.disablePublishing = true;
        log('Глобальный флаг публикаций ОТКЛЮЧЕН. Контент будет помечаться как опубликованный без фактической публикации!', 'api');
      }
      
      return res.status(200).json({
        success: true,
        publishing: !publishScheduler.disablePublishing,
        message: publishScheduler.disablePublishing 
          ? 'Публикации отключены. Контент будет помечаться как опубликованный без фактической публикации!' 
          : 'Публикации включены. Контент будет публиковаться в соцсети.'
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
        const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
        
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
      
      // Добавляем ID в список для предотвращения повторной обработки
      // Используем публичный метод для добавления в processedContentIds
      publishScheduler.addProcessedContentId(contentId);
      log(`ID ${contentId} добавлен в список обработанных записей`, 'api');
      
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
      
      // Очищаем кэш обработанных ID контента
      publishScheduler.clearProcessedContentIds();
      
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
          
          // Обновляем статус только для выбранных платформ
          for (const platform of platformsArray) {
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
        
        // Публикуем на каждую платформу
        for (const platformName of platformsArray) {
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

  // Новый маршрут для прямой публикации контента без промежуточной проверки
  app.post('/api/publish-direct/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      const { platforms, userId } = req.body;
      
      // Получаем токен из заголовка авторизации
      const token = req.headers.authorization?.replace('Bearer ', '') || '';
      
      log(`Запрос на прямую публикацию контента ${contentId}`, 'api');
      
      // Проверяем наличие необходимых параметров
      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }
      
      if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ error: 'Не выбраны платформы для публикации' });
      }
      
      // Импортируем необходимые службы
      const { directusCrud } = await import('../services/directus-crud');
      const { directusAuthManager } = await import('../services/directus-auth-manager');
      const { SocialPublishingService } = await import('../services/social-publishing');
      
      // Получаем админский токен для надежной публикации
      let adminToken;
      try {
        adminToken = await directusAuthManager.getAdminToken();
        log(`Получен токен администратора для публикации`, 'api');
      } catch (error: any) {
        log(`Не удалось получить токен администратора: ${error.message}`, 'api');
      }
      
      // Используем токен администратора или пользовательский токен
      const authToken = adminToken || token;
      
      if (!authToken) {
        return res.status(401).json({ error: 'Не удалось получить токен авторизации' });
      }
      
      // Получаем контент
      try {
        // Получаем контент через DirectusCrud
        log(`Получаем контент ${contentId}`, 'api');
        const content = await directusCrud.read('campaign_content', contentId, { authToken });
        
        if (!content) {
          log(`Контент ${contentId} не найден при публикации`, 'api', 'error');
          return res.status(404).json({ error: 'Контент не найден' });
        }
        
        log(`Контент ${contentId} успешно получен: ${content.title || '(без названия)'}`, 'api');
        
        // Получаем настройки кампании
        const campaignId = content.campaign || content.campaign_id;
        if (!campaignId) {
          log(`ID кампании не найден в контенте ${contentId}`, 'api', 'error');
          return res.status(400).json({ error: 'ID кампании не найден в контенте' });
        }
        
        const campaign = await directusCrud.read('campaigns', campaignId, { authToken });
        if (!campaign) {
          log(`Кампания ${campaignId} не найдена при публикации`, 'api', 'error');
          return res.status(404).json({ error: 'Кампания не найдена' });
        }
        
        // Получаем настройки социальных сетей
        const settings = campaign.socialMediaSettings || {};
        
        // Создаем экземпляр сервиса для публикации
        const publishingService = new SocialPublishingService(authService);
        
        // Выполняем публикацию на каждую платформу
        const results: Record<string, any> = {};
        
        for (const platform of platforms) {
          try {
            log(`Начинаем публикацию на платформу ${platform}`, 'api');
            
            // Публикуем на выбранную платформу напрямую
            const result = await publishingService.publishToPlatform(
              platform, 
              content, 
              campaign
            );
            
            results[platform] = { success: true, data: result };
            log(`Успешная публикация на ${platform}`, 'api');
          } catch (platformError: any) {
            log(`Ошибка при публикации на ${platform}: ${platformError.message}`, 'api', 'error');
            results[platform] = { 
              success: false, 
              error: platformError.message 
            };
          }
        }
        
        // Возвращаем результаты публикации
        return res.status(200).json({
          contentId,
          results,
          message: 'Публикация обработана'
        });
        
      } catch (contentError: any) {
        log(`Ошибка при публикации контента: ${contentError.message}`, 'api', 'error');
        return res.status(500).json({ error: contentError.message });
      }
      
    } catch (error: any) {
      log(`Ошибка при обработке запроса на публикацию: ${error.message}`, 'api', 'error');
      return res.status(500).json({ error: error.message });
    }
  });
  
  // Маршрут для упрощенной публикации контента
  app.post('/api/publish-simple/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      const { platforms, userId, immediate = true } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '') || 
                    req.body.token || 
                    req.query.token as string || 
                    (req.cookies?.auth_token as string);
      
      log(`Запрос на публикацию контента ${contentId} через простой API`, 'api');
      
      // Проверяем наличие необходимых параметров
      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }
      
      if (!token) {
        return res.status(401).json({ error: 'Не предоставлен токен авторизации' });
      }
      
      // Получаем системный токен для публикации
      let systemToken = null;
      try {
        // Получаем системный токен напрямую из сервиса публикации
        systemToken = await socialPublishingService.getSystemToken();
        log(`Системный токен для публикации получен: ${systemToken ? 'успешно' : 'не удалось получить'}`, 'api');
      } catch (error: any) {
        log(`Ошибка при получении системного токена: ${error.message}`, 'api');
      }
      
      // Если не получили системный токен, используем пользовательский
      const authToken = systemToken || token;
      
      // Получаем контент напрямую через DirectusCrud
      const directusCrud = await import('../services/directus-crud').then(m => m.directusCrud);
      const content: any = await directusCrud.read('campaign_content', contentId, { authToken });
      
      if (!content) {
        log(`Контент ${contentId} не найден при попытке публикации`, 'api');
        return res.status(404).json({ error: 'Контент не найден' });
      }
      
      // Получаем настройки кампании
      const campaignId = content.campaign || content.campaign_id;
      if (!campaignId) {
        log(`ID кампании не найден в контенте ${contentId}`, 'api');
        return res.status(400).json({ error: 'ID кампании не найден в контенте' });
      }
      
      const campaign: any = await directusCrud.read('campaigns', campaignId, { authToken });
      if (!campaign) {
        log(`Кампания ${campaignId} не найдена при попытке публикации контента`, 'api');
        return res.status(404).json({ error: `Кампания не найдена` });
      }
      
      // Обрабатываем платформы для публикации
      let platformsArray: string[] = [];
      if (Array.isArray(platforms)) {
        platformsArray = platforms;
      } else if (platforms && typeof platforms === 'object') {
        platformsArray = Object.entries(platforms)
          .filter(([_, selected]) => selected === true)
          .map(([name]) => name);
      }
      
      if (!platformsArray.length) {
        return res.status(400).json({ error: 'Не указаны платформы для публикации' });
      }
      
      // Результаты публикации
      const results: Record<string, any> = {};
      let hasSuccess = false;
      
      // Поочередно публикуем контент на каждую платформу
      for (const platformName of platformsArray) {
        const platform = platformName as SocialPlatform;
        
        try {
          log(`Публикация контента ${contentId} в ${platform}`, 'api');
          
          // Обновляем статус на pending только для выбранной платформы
          const socialPlatforms = content.social_platforms || {};
          socialPlatforms[platform] = {
            ...(socialPlatforms[platform] || {}),
            status: 'pending',
            error: null
          };
          
          // Сохраняем обновленный статус
          await directusCrud.updateItem('campaign_content', contentId, {
            social_platforms: socialPlatforms
          }, { authToken: token });
          
          // Публикуем контент в выбранную платформу
          const result = await socialPublishingService.publishToPlatform(platform, content, campaign, token);
          
          results[platform] = {
            success: true,
            result,
            contentId
          };
          
          hasSuccess = true;
          
          // Обновляем статус после публикации
          if (result) {
            const updatedPlatforms = { ...socialPlatforms };
            updatedPlatforms[platform] = {
              ...(updatedPlatforms[platform] || {}),
              status: 'published',
              postId: result.messageId || null,
              postUrl: result.url || null,
              publishedAt: new Date().toISOString(),
              userId
            };
            
            await directusCrud.updateItem('campaign_content', contentId, {
              social_platforms: updatedPlatforms,
              status: immediate ? 'published' : content.status,
              published_at: immediate ? new Date().toISOString() : content.published_at
            }, token);
            
            log(`Публикация ${contentId} в ${platform} успешна`, 'api');
          }
        } catch (error: any) {
          results[platform] = {
            success: false,
            error: error.message || 'Неизвестная ошибка',
            contentId
          };
          
          log(`Ошибка публикации в ${platform}: ${error.message}`, 'api');
          
          // Обновляем статус на failed
          try {
            const socialPlatforms = content.social_platforms || {};
            socialPlatforms[platform] = {
              ...(socialPlatforms[platform] || {}),
              status: 'failed',
              error: error.message || 'Неизвестная ошибка'
            };
            
            await directusCrud.updateItem('campaign_content', contentId, {
              social_platforms: socialPlatforms
            }, token);
          } catch (updateError: any) {
            log(`Ошибка при обновлении статуса публикации: ${updateError.message}`, 'api');
          }
        }
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
  
  // Основной маршрут публикации контента по ID, с указанием платформ
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

      // Получаем пользовательский и системный токены для надежного получения контента
      const userId = req.body.userId || req.query.userId || (req.headers['user-id'] as string);
      const userToken = req.headers.authorization?.replace('Bearer ', '') || 
                       (req.query.token as string) || 
                       (req.cookies?.auth_token as string);
                       
      // Получаем системный токен для публикации
      let systemToken = null;
      try {
        // Получаем системный токен напрямую из сервиса публикации
        systemToken = await socialPublishingService.getSystemToken();
        log(`Системный токен для публикации получен: ${systemToken ? 'успешно' : 'не удалось получить'}`, 'api');
      } catch (error: any) {
        log(`Ошибка при получении системного токена: ${error.message}`, 'api');
      }
      
      log(`Попытка получения контента ${contentId} с токенами. User ID: ${userId}`, 'api');
      
      // Получение системного токена для запросов к Directus
      let systemAuthToken = await socialPublishingService.getSystemToken();
      
      // Получаем контент, пробуя разные токены
      let content = null;
      let errors = [];
      
      // Попытка 1: С пользовательским токеном
      try {
        if (userToken) {
          log(`Получение контента ${contentId} с пользовательским токеном`, 'api');
          content = await storage.getCampaignContentById(contentId, userToken);
          if (content) {
            log(`Контент ${contentId} успешно получен с пользовательским токеном`, 'api');
          }
        }
      } catch (error: any) {
        errors.push(`Ошибка при получении контента с пользовательским токеном: ${error.message}`);
        log(`Ошибка при получении контента ${contentId} с пользовательским токеном: ${error.message}`, 'api');
      }
      
      // Попытка 2: С системным токеном
      if (!content && systemAuthToken) {
        try {
          log(`Получение контента ${contentId} с системным токеном`, 'api');
          content = await storage.getCampaignContentById(contentId, systemAuthToken);
          if (content) {
            log(`Контент ${contentId} успешно получен с системным токеном`, 'api');
          }
        } catch (error: any) {
          errors.push(`Ошибка при получении контента с системным токеном: ${error.message}`);
          log(`Ошибка при получении контента ${contentId} с системным токеном: ${error.message}`, 'api');
        }
      }
      
      // Попытка 3: Без токена (последний вариант)
      if (!content) {
        try {
          log(`Получение контента ${contentId} без токена`, 'api');
          content = await storage.getCampaignContentById(contentId);
          if (content) {
            log(`Контент ${contentId} успешно получен без токена`, 'api');
          }
        } catch (error: any) {
          errors.push(`Ошибка при получении контента без токена: ${error.message}`);
          log(`Ошибка при получении контента ${contentId} без токена: ${error.message}`, 'api');
        }
      }
      
      // Проверяем наличие контента после всех попыток
      if (!content) {
        log(`Контент ${contentId} не найден при попытке публикации после всех попыток`, 'api');
        return res.status(404).json({ 
          error: 'Контент не найден',
          details: errors.length > 0 ? errors : undefined 
        });
      }

      // Получаем кампанию
      const campaign = await storage.getCampaignById(content.campaignId);
      if (!campaign) {
        log(`Кампания ${content.campaignId} не найдена при попытке публикации контента ${contentId}`, 'api');
        return res.status(404).json({ error: `Кампания ${content.campaignId} не найдена` });
      }

      // Используем системный токен, полученный ранее
      const authToken = systemToken || userToken;
      
      if (!authToken) {
        log(`Не удалось получить токен для публикации контента ${contentId}`, 'api');
        return res.status(401).json({ error: 'Ошибка авторизации: не удалось получить действительный токен' });
      } else {
        log(`Токен для публикации контента ${contentId} получен успешно`, 'api');
      }

      // Публикуем контент во все указанные платформы
      const results: Record<string, any> = {};
      let hasSuccess = false;

      try {
        // Устанавливаем статус в pending для всех платформ
        // Создаем socialPlatforms объект, если его нет
        const socialPlatforms = content.socialPlatforms || {};
        
        const updatedPlatforms: Record<string, any> = {};
        
        // Обновляем статус только для выбранных платформ
        for (const platform of platformsArray) {
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
        }, authToken);
        
        log(`Статус публикации установлен в pending для контента ${content.id}`, 'api');
        
        // Публикуем на каждую платформу
        for (const platformName of platformsArray) {
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
              url: '/users/me',
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
              
              const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
              const response = await axios.get(`${directusUrl}/items/campaign_content`, {
                params: {
                  filter: { status: { _eq: 'scheduled' } }
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
          
          // Фильтруем только те, у которых статус scheduled или есть socialPlatforms с pending/scheduled
          scheduledContent = allContent.filter(content => {
            // Проверяем статус
            if (content.status === 'scheduled' && content.scheduledAt) return true;
            
            // Проверяем socialPlatforms
            if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
              for (const platform of Object.keys(content.socialPlatforms)) {
                const platformData = content.socialPlatforms[platform];
                if (platformData && 
                   (platformData.status === 'pending' || platformData.status === 'scheduled') && 
                    platformData.scheduledAt) {
                  return true;
                }
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
            url: '/users/me',
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
            url: '/users/me',
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
          
          // Формируем данные для обновления
          // Сохраняем все существующие платформы, которые могли быть, но не указаны в текущем запросе
          const existingSocialPlatforms = content.socialPlatforms || {};
          
          // Объединяем существующие и новые данные о платформах
          const mergedSocialPlatforms = { ...existingSocialPlatforms };
          
          // Обновляем значения для платформ из запроса
          Object.entries(socialPlatforms).forEach(([platform, data]) => {
            mergedSocialPlatforms[platform] = data;
          });
          
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
          log(`Существующие платформы: ${JSON.stringify(existingSocialPlatforms)}`, 'api');
          log(`Новые платформы из запроса: ${JSON.stringify(socialPlatforms)}`, 'api');
          log(`Объединенные платформы с временем публикации: ${JSON.stringify(mergedSocialPlatforms)}`, 'api');
          
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