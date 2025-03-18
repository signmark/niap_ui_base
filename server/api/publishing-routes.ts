import { Express, Request, Response } from 'express';
import { storage } from '../storage';
import { socialPublishingService } from '../services/social-publishing';
import { publishScheduler } from '../services/publish-scheduler';
import { SocialPlatform } from '@shared/schema';
import { log } from '../utils/logger';
import { directusApiManager } from '../directus';

/**
 * Регистрирует маршруты для управления публикациями
 * @param app Express приложение
 */
export function registerPublishingRoutes(app: Express): void {
  // Публикация контента вручную
  app.post('/api/publish/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;
      const { platforms } = req.body;

      // Проверяем параметры
      if (!contentId) {
        return res.status(400).json({ error: 'Не указан ID контента' });
      }

      if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ error: 'Не указаны платформы для публикации' });
      }

      // Получаем контент
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({ error: 'Контент не найден' });
      }

      // Получаем кампанию для настроек социальных сетей
      const campaign = await storage.getCampaign(parseInt(content.campaignId));
      if (!campaign) {
        return res.status(404).json({ error: 'Кампания не найдена' });
      }

      // Настройки социальных сетей
      const socialSettings = campaign.socialMediaSettings || {};

      // Результаты публикации
      const results: Record<string, any> = {};

      // Публикуем в каждую платформу
      for (const platform of platforms) {
        if (!['telegram', 'vk', 'instagram', 'facebook'].includes(platform)) {
          results[platform] = { error: 'Неподдерживаемая платформа' };
          continue;
        }

        // Публикуем контент в платформу
        const result = await socialPublishingService.publishToPlatform(
          content,
          platform as SocialPlatform,
          socialSettings
        );

        // Обновляем статус публикации
        await socialPublishingService.updatePublicationStatus(
          contentId,
          platform as SocialPlatform,
          result
        );

        // Сохраняем результат
        results[platform] = result;
      }

      // Получаем обновленный контент
      const updatedContent = await storage.getCampaignContentById(contentId);
      
      // Возвращаем результат
      return res.status(200).json({ 
        success: true, 
        results,
        content: updatedContent
      });
    } catch (error: any) {
      log(`Ошибка при ручной публикации: ${error.message}`, 'api');
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

      // Возвращаем статус публикации
      return res.status(200).json({ 
        success: true, 
        status: content.status,
        publishedAt: content.publishedAt,
        socialPlatforms: content.socialPlatforms || {}
      });
    } catch (error: any) {
      log(`Ошибка при получении статуса публикации: ${error.message}`, 'api');
      return res.status(500).json({ 
        error: 'Ошибка при получении статуса публикации',
        message: error.message
      });
    }
  });

  // Запуск проверки запланированных публикаций
  app.post('/api/publish/check-scheduled', async (req: Request, res: Response) => {
    try {
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
      
      // Обновляем контент
      await storage.updateCampaignContent(contentId, {
        status: 'draft', // Возвращаем в статус черновика
        scheduledAt: null, // Убираем планирование
        socialPlatforms: updatedPlatforms
      });
      
      log(`Публикация ${contentId} отменена`, 'api');
      
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
      
      if (!userId) {
        return res.status(400).json({ error: 'Не указан ID пользователя' });
      }
      
      // Получаем запланированные публикации из базы данных
      let scheduledContent: any[] = [];
      
      // Пытаемся получить токен авторизации
      let authToken: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.substring(7);
        
        // Кэшируем токен для пользователя (для последующих запросов)
        if (authToken) {
          directusApiManager.cacheAuthToken(userId, authToken);
          log(`Токен для пользователя ${userId} кэширован`, 'api');
        }
      } else {
        log('No authorization header provided for scheduled content', 'api');
      }
      
      try {
        if (authToken) {
          // Если есть токен авторизации, запрашиваем данные из Directus
          log(`Запрос запланированных публикаций с токеном авторизации для пользователя ${userId}`, 'api');
          scheduledContent = await storage.getScheduledContent(userId, campaignId);
          log(`Получено ${scheduledContent.length} запланированных публикаций из БД`, 'api');
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
  
  // Маршрут для обновления контента кампании (включая запланированные публикации)
  app.patch('/api/campaign-content/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const authHeader = req.headers.authorization;
      
      // Проверяем заголовок авторизации
      if (!authHeader) {
        log('No authorization header provided for content update', 'api');
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
          
          if (userInfo && userInfo.data && userInfo.data.id) {
            userId = userInfo.data.id;
            
            // Кэшируем токен для последующих запросов
            directusApiManager.cacheAuthToken(userId, token);
          }
        } catch (error) {
          log(`Ошибка получения информации о пользователе: ${error}`, 'api');
        }
      }
      
      // Получаем контент для проверки прав доступа
      let content;
      
      try {
        // Пробуем получить контент с использованием токена из запроса
        content = await storage.getCampaignContentById(id);
      } catch (error) {
        const fetchError = error as Error;
        log(`Ошибка при получении контента с ID ${id}: ${fetchError.message}`, 'api');
      }
      
      if (!content && userId) {
        // Если контент не найден напрямую, но у нас есть userId, пробуем использовать его
        log(`Пробуем использовать userId: ${userId} для получения контента ${id}`, 'api');
        directusApiManager.cacheAuthToken(userId, token);
        
        try {
          content = await storage.getCampaignContentById(id);
        } catch (error) {
          const secondError = error as Error;
          log(`Вторая попытка получения контента тоже не удалась: ${secondError.message}`, 'api');
        }
      }
      
      if (!content) {
        return res.status(404).json({ error: 'Контент не найден' });
      }
      
      // Если у нас есть userId в content, но он отличается от userId в токене,
      // это значит что пользователь пытается обновить чужой контент - проверка прав здесь
      
      // Обновляем контент - передаем токен в userId контента, если его нет
      if (!updates.userId && content.userId) {
        updates.userId = content.userId;
      }
      
      // Обновляем контент с обновленными данными
      const updatedContent = await storage.updateCampaignContent(id, updates);
      
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
              title: contentData.title || "",
              content: contentData.content || "",
              contentType: contentData.content_type || "text",
              campaignId: contentData.campaign_id || "",
              userId: contentData.user_id || userId,
              createdAt: contentData.created_at ? new Date(contentData.created_at) : new Date(),
              status: contentData.status || "draft",
              imageUrl: contentData.image_url || null,
              videoUrl: contentData.video_url || null,
              imagePrompt: contentData.image_prompt || null,
              keywords: contentData.keywords || null,
              metadata: contentData.metadata || null,
              scheduledAt: contentData.scheduled_at ? new Date(contentData.scheduled_at) : null,
              publishedAt: contentData.published_at ? new Date(contentData.published_at) : null,
              socialPlatforms: contentData.social_platforms || null
            };
            
            log(`Контент ${contentId} найден через прямой API запрос`, 'api');
            // Продолжаем работу, но сообщаем о проблеме с storage
            log(`ВНИМАНИЕ: Контент найден через API, но не через storage. Возможно проблемы с кэшированием.`, 'api');
          } catch (apiError) {
            log(`Не удалось получить контент напрямую через API: ${(apiError as Error).message}`, 'api');
            return res.status(404).json({ 
              error: 'Контент не найден', 
              message: `Контент с ID ${contentId} не найден` 
            });
          }
        }
        
        // Проверяем, что контент определен, иначе создаем пустой объект
        if (!content) {
          log(`ВНИМАНИЕ: Не удалось найти контент с ID ${contentId} всеми возможными способами`, 'api');
          return res.status(404).json({ 
            error: 'Контент не найден', 
            message: `Контент с ID ${contentId} не найден после всех проверок` 
          });
        }
        
        log(`Контент найден: ${contentId}, userId: ${content.userId || 'не указан'}`, 'api');
        
        // Подготавливаем обновления для контента
        const scheduledAtDate = new Date(scheduledAt);
        const updates: any = {
          status: 'scheduled',
          scheduledAt: scheduledAtDate,
          socialPlatforms: socialPlatforms
        };
        
        // Добавляем дату публикации в каждой платформе
        if (socialPlatforms && typeof socialPlatforms === 'object') {
          for (const platform in socialPlatforms) {
            if (socialPlatforms[platform] && typeof socialPlatforms[platform] === 'object') {
              socialPlatforms[platform].scheduledAt = scheduledAtDate.toISOString();
            }
          }
        }
        
        // Если userId из контента не определен, но у нас есть userId из токена, добавляем его
        if (!content.userId && userId) {
          updates.userId = userId;
          // Также добавляем userId в сам контент для логики ниже
          content.userId = userId;
        }
        
        log(`Обновляем контент в базе данных: ${JSON.stringify(updates)}`, 'api');
        
        // Обновляем контент через интерфейс хранилища
        // Напрямую обновляем контент через Directus API
        let updatedContent;
        let directUpdateSuccessful = false;
        
        try {
          // Обновляем через API напрямую, чтобы убедиться, что записи существуют
          log(`Обновление контента через API напрямую`, 'api');
          
          const directUpdateResponse = await directusApiManager.request({
            url: `/items/campaign_content/${contentId}`,
            method: 'patch',
            data: {
              status: 'scheduled',
              scheduled_at: scheduledAtDate.toISOString(),
              social_platforms: socialPlatforms
            },
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          log(`Контент успешно обновлен через API напрямую`, 'api');
          directUpdateSuccessful = true;
        } catch (directUpdateError) {
          // Если запись не найдена, возможно она не существует или у нас устаревший токен
          log(`Ошибка при прямом обновлении через API: ${(directUpdateError as Error).message}`, 'api');
        }
        
        // Пробуем обновить контент через интерфейс хранилища, но только если прямое обновление не прошло успешно
        let storageUpdateSuccessful = false;
        
        try {
          updatedContent = await storage.updateCampaignContent(contentId, updates);
          log(`Контент успешно обновлен через storage: ${updatedContent.id}`, 'api');
          storageUpdateSuccessful = true;
        } catch (storageError) {
          log(`Ошибка при обновлении через storage: ${(storageError as Error).message}`, 'api');
          
          // Если прямое обновление было успешным, используем результат прямого API запроса
          if (directUpdateSuccessful) {
            log(`Используем данные контента из прямого API запроса`, 'api');
            
            // Создаем структуру обновленного контента из имеющихся данных
            updatedContent = {
              ...content,
              ...updates,
              id: contentId
            };
            log(`Создан объект с обновленными данными на основе прямого API запроса`, 'api');
          } else {
            throw new Error('Failed to update campaign content');
          }
        }
        
        // Форматируем данные для ответа с правильной структурой
        const formattedResponse = {
          success: true,
          message: 'Публикация успешно запланирована',
          data: {
            id: contentId,
            scheduledAt: scheduledAtDate.toISOString(),
            status: 'scheduled',
            socialPlatforms: socialPlatforms
          }
        };
        
        // Выводим форматированную дату в лог
        log(`Запланированная дата публикации: ${scheduledAtDate.toISOString()}`, 'api');
        
        return res.status(200).json(formattedResponse);
      } catch (error: any) {
        log(`Ошибка при прямом обновлении: ${error.message}`, 'api');
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