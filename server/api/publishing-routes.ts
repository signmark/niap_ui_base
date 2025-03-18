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
      
      // Проверяем наличие заголовка авторизации
      if (!authHeader) {
        log('No authorization header provided for scheduled content', 'api');
      }
      
      // Получаем запланированные публикации
      // Если есть authHeader, мы передаем token напрямую в storage
      let scheduledContent: any[] = [];
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Настраиваем временно токен для пользователя
        directusApiManager.cacheAuthToken(userId, token);
        
        scheduledContent = await storage.getScheduledContent(userId, campaignId);
      } else {
        scheduledContent = await storage.getScheduledContent(userId, campaignId);
      }
      
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
        // Получаем контент через storage
        log(`Получаем контент с ID ${contentId} через хранилище`, 'api');
        const content = await storage.getCampaignContentById(contentId);
        
        if (!content) {
          log(`Контент с ID ${contentId} не найден в базе данных`, 'api');
          return res.status(404).json({ error: 'Контент не найден' });
        }
        
        log(`Контент найден: ${contentId}, userId: ${content.userId}`, 'api');
        
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
        }
        
        log(`Обновляем контент в базе данных: ${JSON.stringify(updates)}`, 'api');
        
        // Обновляем контент через интерфейс хранилища
        const updatedContent = await storage.updateCampaignContent(contentId, updates);
        
        if (updatedContent) {
          log(`Контент успешно обновлен в базе данных: ${updatedContent.id}`, 'api');
          
          // Форматируем данные для ответа с правильной структурой
          const formattedResponse = {
            success: true,
            message: 'Публикация успешно запланирована',
            data: {
              id: updatedContent.id,
              scheduledAt: updatedContent.scheduledAt,
              status: updatedContent.status,
              socialPlatforms: updatedContent.socialPlatforms
            }
          };
          
          // Выводим форматированную дату в лог
          const formattedDate = updatedContent.scheduledAt 
            ? new Date(updatedContent.scheduledAt).toISOString() 
            : 'не задана';
          log(`Запланированная дата публикации: ${formattedDate}`, 'api');
          
          return res.status(200).json(formattedResponse);
        } else {
          throw new Error('Неизвестная ошибка при обновлении контента в Directus');
        }
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