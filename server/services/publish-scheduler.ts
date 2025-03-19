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
   * Получает системный токен для доступа к API
   * Пытается авторизоваться с системными учетными данными или использовать текущий валидный токен
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      // Попытка использовать системные учетные данные из переменных окружения
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID;
      
      if (email && password) {
        log('Попытка авторизации с системными учетными данными', 'scheduler');
        
        try {
          const response = await directusApiManager.request({
            url: '/auth/login',
            method: 'post',
            data: {
              email,
              password
            }
          });
          
          if (response?.data?.data?.access_token) {
            const token = response.data.data.access_token;
            log('Получен новый системный токен', 'scheduler');
            
            // Кэшируем токен для администратора, если его ID указан
            if (adminUserId) {
              directusApiManager.cacheAuthToken(adminUserId, token, 3600); // 1 час
              log(`Токен кэширован для администратора ${adminUserId}`, 'scheduler');
            }
            
            return token;
          }
        } catch (error: any) {
          log(`Ошибка при получении системного токена: ${error.message}`, 'scheduler');
        }
      }
      
      // Если администратор указан, попробуем получить токен из кэша
      if (adminUserId) {
        const cachedToken = directusApiManager.getCachedToken(adminUserId);
        if (cachedToken) {
          log(`Найден кэшированный токен для администратора ${adminUserId}`, 'scheduler');
          return cachedToken.token;
        }
      }
      
      return null;
    } catch (error: any) {
      log(`Ошибка при получении системного токена: ${error.message}`, 'scheduler');
      return null;
    }
  }

  async checkScheduledContent() {
    try {
      log('Проверка запланированных публикаций', 'scheduler');
      
      // Пытаемся получить системный токен для доступа к API
      const systemToken = await this.getSystemToken();
      if (systemToken) {
        log('Используем системный токен для получения запланированных публикаций', 'scheduler');
      } else {
        log('Системный токен не найден, будет использован анонимный доступ', 'scheduler');
      }
      
      // Пытаемся получить запланированные публикации
      let scheduledContent: CampaignContent[] = [];
      
      // Пробуем получить запланированные публикации через новый адаптер
      try {
        // Идентификатор администратора из .env
        const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID;
        if (adminUserId) {
          log(`Поиск запланированных публикаций через учетную запись администратора ID: ${adminUserId}`, 'scheduler');
          const adminContent = await directusStorageAdapter.getScheduledContent(adminUserId);
          scheduledContent = [...scheduledContent, ...adminContent];
        }
      } catch (error: any) {
        log(`Ошибка при получении публикаций через адаптер: ${error.message}`, 'scheduler');
      }
      
      // Если ничего не нашли через адаптер, попробуем прямой запрос с системным токеном
      if (scheduledContent.length === 0 && systemToken) {
        try {
          log('Попытка получения публикаций напрямую через API с системным токеном', 'scheduler');
          
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
          }, systemToken);
          
          if (response?.data?.data) {
            const items = response.data.data;
            log(`Получено ${items.length} запланированных публикаций через прямой запрос API`, 'scheduler');
            
            scheduledContent = items.map((item: any) => ({
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
          }
        } catch (error: any) {
          log(`Ошибка при прямом запросе к API: ${error.message}`, 'scheduler');
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