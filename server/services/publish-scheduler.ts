import { log } from '../utils/logger';
import { storage } from '../storage';
import { socialPublishingService } from './social-publishing';
import { CampaignContent, SocialPlatform } from '@shared/schema';
import { directusStorageAdapter } from './directus';
import { directusApiManager } from '../directus';

/**
 * Класс для планирования и выполнения автоматической публикации контента
 */
export class PublishScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 60000; // проверяем каждую минуту

  /**
   * Запускает планировщик публикаций
   */
  start() {
    if (this.isRunning) {
      log('Планировщик публикаций уже запущен', 'scheduler');
      return;
    }

    log('Запуск планировщика публикаций', 'scheduler');
    this.isRunning = true;
    
    // Немедленно выполняем первую проверку
    this.checkScheduledContent();

    // Устанавливаем интервал для регулярных проверок
    this.intervalId = setInterval(() => {
      this.checkScheduledContent();
    }, this.checkIntervalMs);
  }

  /**
   * Останавливает планировщик публикаций
   */
  stop() {
    if (!this.isRunning || !this.intervalId) {
      log('Планировщик публикаций не запущен', 'scheduler');
      return;
    }

    log('Остановка планировщика публикаций', 'scheduler');
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Получает действующие токены пользователей для доступа к API
   * Просматривает все сессии в директусе и возвращает массив действующих токенов
   */
  private async getUserTokens(): Promise<string[]> {
    try {
      // Получаем все активные сессии в директусе из кэша directusAuthManager
      const { directusAuthManager } = require('./directus-auth-manager');
      const availableTokens: string[] = [];
      
      if (directusAuthManager) {
        // Если имеется доступ к менеджеру авторизации, используем его для получения сессий
        log('Получение токенов из менеджера авторизации', 'scheduler');
        
        // Проверяем наличие метода для доступа к сессиям
        if (typeof directusAuthManager.getAllActiveTokens === 'function') {
          const tokens = directusAuthManager.getAllActiveTokens();
          if (tokens && tokens.length > 0) {
            log(`Получено ${tokens.length} активных токенов из менеджера авторизации`, 'scheduler');
            availableTokens.push(...tokens);
          }
        } else {
          // Если метода нет, проверяем кэш directusApiManager
          log('Метод getAllActiveTokens не найден, проверяем кэш directusApiManager', 'scheduler');
          
          // Получаем токены из кэша directusApiManager
          if (directusApiManager['authTokenCache']) {
            const cache = directusApiManager['authTokenCache'];
            for (const userId in cache) {
              if (cache[userId] && cache[userId].token && cache[userId].expiresAt > Date.now()) {
                log(`Найден действующий токен для пользователя ${userId}`, 'scheduler');
                availableTokens.push(cache[userId].token);
              }
            }
          }
        }
      }
      
      // Если токены не найдены через кэш, пробуем use-fallback через хранилище
      if (availableTokens.length === 0) {
        log('Токены не найдены в кэше, проверяем хранилище', 'scheduler');
        
        // Получаем список всех пользователей, для которых сохранены токены
        // Примечание: этот метод требуется реализовать в storage
        // const userIds = await storage.getAllUserIds();
        
        // Для простоты используем явно указанных пользователей из кода
        const userIds = ['53921f16-f51d-4591-80b9-8caa4fde4d13']; // Здесь можно указать ID активных пользователей
        
        for (const userId of userIds) {
          try {
            const tokenInfo = await storage.getUserTokenInfo(userId);
            if (tokenInfo && tokenInfo.token) {
              log(`Найден токен для пользователя ${userId} в хранилище`, 'scheduler');
              availableTokens.push(tokenInfo.token);
            }
          } catch (error) {
            log(`Ошибка при получении токена для пользователя ${userId}: ${error.message}`, 'scheduler');
          }
        }
      }
      
      return availableTokens;
    } catch (error: any) {
      log(`Ошибка при получении токенов пользователей: ${error.message}`, 'scheduler');
      return [];
    }
  }

  async checkScheduledContent() {
    try {
      log('Проверка запланированных публикаций', 'scheduler');
      
      // Получаем токены всех активных пользователей
      const userTokens = await this.getUserTokens();
      if (userTokens.length > 0) {
        log(`Найдено ${userTokens.length} действующих токенов пользователей`, 'scheduler');
      } else {
        log('Действующие токены пользователей не найдены', 'scheduler');
      }
      
      // Пытаемся получить запланированные публикации
      let scheduledContent: CampaignContent[] = [];
      
      // Если у нас есть токены пользователей, пробуем получить запланированные публикации
      if (userTokens.length > 0) {
        // Пробуем получить запланированные публикации через API с токенами пользователей
        for (const token of userTokens) {
          try {
            log('Поиск запланированных публикаций через API с токеном пользователя', 'scheduler');
            
            const response = await directusApiManager.request({
              url: '/items/campaign_content',
              method: 'get',
              params: {
                filter: {
                  status: {
                    _eq: 'scheduled'
                  },
                  scheduled_at: {
                    _nnull: true
                  }
                },
                sort: ['scheduled_at']
              }
            }, token);
            
            if (response?.data?.data) {
              const items = response.data.data;
              log(`Получено ${items.length} запланированных публикаций через API с токеном пользователя`, 'scheduler');
              
              const contentItems = items.map((item: any) => ({
                id: item.id,
                content: item.content,
                userId: item.user_id,
                campaignId: item.campaign_id,
                status: item.status,
                contentType: item.content_type || "text",
                title: item.title || null,
                imageUrl: item.image_url,
                videoUrl: item.video_url,
                scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
                createdAt: new Date(item.created_at),
                socialPlatforms: item.social_platforms
              }));
              
              scheduledContent = [...scheduledContent, ...contentItems];
              break; // Если успешно получили данные, выходим из цикла
            }
          } catch (error: any) {
            log(`Ошибка при запросе с токеном пользователя: ${error.message}`, 'scheduler');
            // Продолжаем с следующим токеном
          }
        }
      }
      
      // Если ничего не нашли через API, пробуем через адаптер хранилища
      if (scheduledContent.length === 0) {
        try {
          // Пробуем с явно указанным ID пользователя
          const userId = '53921f16-f51d-4591-80b9-8caa4fde4d13'; // Используем ID текущего пользователя
          log(`Поиск запланированных публикаций через адаптер хранилища для пользователя ID: ${userId}`, 'scheduler');
          const userContent = await directusStorageAdapter.getScheduledContent(userId);
          scheduledContent = [...scheduledContent, ...userContent];
        } catch (error: any) {
          log(`Ошибка при получении публикаций через адаптер: ${error.message}`, 'scheduler');
        }
      }
      
      // В последнюю очередь, если все еще нет данных, используем стандартное хранилище
      if (scheduledContent.length === 0) {
        log('Попытка получения запланированных публикаций через стандартное хранилище', 'scheduler');
        const storageContent = await storage.getScheduledContent();
        scheduledContent = [...scheduledContent, ...storageContent];
      }
      
      if (scheduledContent.length === 0) {
        log('Запланированные публикации не найдены', 'scheduler');
        return;
      }

      log(`Найдено ${scheduledContent.length} запланированных публикаций`, 'scheduler');

      // Текущее время
      const now = new Date();

      // Фильтруем контент, который пора публиковать
      const contentToPublish = scheduledContent.filter(content => {
        if (!content.scheduledAt) return false;
        
        const scheduledTime = new Date(content.scheduledAt);
        return scheduledTime <= now;
      });

      log(`Готово к публикации ${contentToPublish.length} элементов контента`, 'scheduler');

      // Публикуем каждый элемент контента
      for (const content of contentToPublish) {
        await this.publishContent(content);
      }
    } catch (error: any) {
      log(`Ошибка при проверке запланированных публикаций: ${error.message}`, 'scheduler');
    }
  }

  /**
   * Публикует контент в выбранные социальные сети
   * @param content Контент для публикации
   */
  async publishContent(content: CampaignContent) {
    try {
      if (!content.id || !content.campaignId) {
        log(`Контент с ID ${content.id} не содержит необходимой информации`, 'scheduler');
        return;
      }

      log(`Публикация контента ${content.id}: "${content.title}"`, 'scheduler');

      // Получаем данные кампании для настроек социальных сетей
      const campaign = await storage.getCampaign(parseInt(content.campaignId));
      if (!campaign) {
        log(`Кампания с ID ${content.campaignId} не найдена`, 'scheduler');
        return;
      }

      // Настройки социальных сетей
      const socialSettings = campaign.socialMediaSettings || {};

      // Проверяем, в какие платформы нужно публиковать
      const socialPlatforms = content.socialPlatforms || {};
      const platformsToPublish = Object.keys(socialPlatforms) as SocialPlatform[];

      if (platformsToPublish.length === 0) {
        log(`Для контента ${content.id} не указаны платформы`, 'scheduler');
        
        // Обновляем статус - не передаем publishedAt напрямую, это внутреннее поле контента
        await storage.updateCampaignContent(content.id, {
          status: 'published'
        });
        
        return;
      }

      // Публикуем в каждую платформу
      for (const platform of platformsToPublish) {
        // Проверяем, существует ли объект социальных платформ и платформа в нём
        const platformStatus = socialPlatforms && typeof socialPlatforms === 'object' 
          ? (socialPlatforms as Record<string, any>)[platform]?.status
          : undefined;
          
        // Пропускаем уже опубликованные
        if (platformStatus === 'published') {
          log(`Контент ${content.id} уже опубликован в ${platform}`, 'scheduler');
          continue;
        }

        // Публикуем контент в платформу
        const result = await socialPublishingService.publishToPlatform(
          content,
          platform,
          socialSettings
        );

        // Обновляем статус публикации
        await socialPublishingService.updatePublicationStatus(
          content.id,
          platform,
          result
        );

        // Логируем результат
        if (result.status === 'published') {
          log(`Контент ${content.id} успешно опубликован в ${platform}`, 'scheduler');
        } else {
          log(`Ошибка при публикации контента ${content.id} в ${platform}: ${result.error}`, 'scheduler');
        }
      }
    } catch (error: any) {
      log(`Ошибка при публикации контента ${content.id}: ${error.message}`, 'scheduler');
    }
  }
}

export const publishScheduler = new PublishScheduler();