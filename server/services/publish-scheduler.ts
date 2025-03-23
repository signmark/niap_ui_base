import axios from 'axios';
import { log } from '../utils/logger';
import { storage } from '../storage';
import { socialPublishingService } from './social-publishing';
import { CampaignContent, SocialPlatform, Campaign } from '@shared/schema';
import { directusStorageAdapter } from './directus';
import { directusApiManager } from '../directus';
import { directusCrud } from './directus-crud';
import { checkTokenExtractionRequest } from './token-extractor';

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
   * Получает токен для доступа к API
   * Приоритеты получения токена:
   * 1. Авторизация через логин/пароль (admin)
   * 2. Активные сессии пользователей из кэша
   * 3. Статический токен из переменных окружения
   * 4. Сохраненный токен из хранилища
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      // Загружаем менеджер авторизации
      const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
      const directusCrud = await import('./directus-crud').then(m => m.directusCrud);
      const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID || '53921f16-f51d-4591-80b9-8caa4fde4d13';
      
      // 1. Приоритет - авторизация через логин/пароль (если есть учетные данные)
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (email && password) {
        log('Попытка авторизации администратора с учетными данными из env', 'scheduler');
        
        try {
          // Прямая авторизация через REST API
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
          const response = await axios.post(`${directusUrl}/auth/login`, {
            email,
            password
          });
          
          if (response?.data?.data?.access_token) {
            const token = response.data.data.access_token;
            log('Авторизация администратора успешна через прямой API запрос', 'scheduler');
            
            // Сохраняем токен в кэше
            directusApiManager.cacheAuthToken(adminUserId, token, 3600); // 1 час
            
            // Пробуем сохранить в DirectusAuthManager
            try {
              directusAuthManager.login(email, password)
                .then(() => log('Сессия администратора добавлена в DirectusAuthManager', 'scheduler'))
                .catch(e => log(`Не удалось добавить сессию в DirectusAuthManager: ${e.message}`, 'scheduler'));
            } catch (e: any) {
              log(`Ошибка при сохранении сессии: ${e.message}`, 'scheduler');
            }
            
            return token;
          }
        } catch (error: any) {
          log(`Ошибка при прямой авторизации администратора: ${error.message}`, 'scheduler');
          if (error.response?.data?.errors) {
            log(`Детали ошибки: ${JSON.stringify(error.response.data.errors)}`, 'scheduler');
          }
        }
        
        try {
          // Запасной вариант - используем метод для авторизации через DirectusAuthManager
          const authInfo = await directusAuthManager.login(email, password);
          
          if (authInfo && authInfo.token) {
            log('Авторизация администратора успешна через directusAuthManager', 'scheduler');
            return authInfo.token;
          }
          
          // Если не получилось через directusAuthManager, пробуем через directusCrud
          const authResult = await directusCrud.login(email, password);
          
          if (authResult?.access_token) {
            log('Авторизация администратора успешна через directusCrud', 'scheduler');
            return authResult.access_token;
          }
        } catch (error: any) {
          log(`Ошибка при авторизации через вспомогательные сервисы: ${error.message}`, 'scheduler');
        }
      }
      
      // 2. Проверяем, есть ли активные сессии пользователей
      const sessions = directusAuthManager.getAllActiveSessions();
      
      if (sessions.length > 0) {
        // Используем токен первого активного пользователя
        const firstSession = sessions[0];
        log(`Использование токена пользователя ${firstSession.userId} из активной сессии`, 'scheduler');
        
        // Проверяем валидность токена
        try {
          const testResponse = await directusApiManager.request({
            url: '/users/me',
            method: 'get'
          }, firstSession.token);
          
          if (testResponse?.data?.data) {
            log(`Токен активной сессии пользователя ${firstSession.userId} валиден`, 'scheduler');
            return firstSession.token;
          }
        } catch (error: any) {
          log(`Токен активной сессии недействителен: ${error.message}`, 'scheduler');
        }
      }
      
      // 3. Если не получилось через сессии, проверяем статический токен
      const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
      if (adminToken) {
        log('Проверка статического токена администратора из переменных окружения', 'scheduler');
        
        // Проверяем валидность токена
        try {
          const testResponse = await directusApiManager.request({
            url: '/users/me',
            method: 'get'
          }, adminToken);
          
          if (testResponse?.data?.data) {
            log('Статический токен администратора валиден', 'scheduler');
            return adminToken;
          }
        } catch (error: any) {
          log(`Статический токен недействителен: ${error.message}`, 'scheduler');
        }
      }
      
      // 4. Пробуем получить токен из кэша
      const cachedToken = directusApiManager.getCachedToken(adminUserId);
      if (cachedToken) {
        log(`Найден кэшированный токен для администратора ${adminUserId}`, 'scheduler');
        
        // Проверяем валидность токена
        try {
          const testResponse = await directusApiManager.request({
            url: '/users/me',
            method: 'get'
          }, cachedToken.token);
          
          if (testResponse?.data?.data) {
            log('Кэшированный токен администратора валиден', 'scheduler');
            return cachedToken.token;
          }
        } catch (error: any) {
          log(`Кэшированный токен недействителен: ${error.message}`, 'scheduler');
        }
      }
      
      // 5. В последнюю очередь, ищем токен в хранилище
      try {
        const tokenInfo = await storage.getUserTokenInfo(adminUserId);
        if (tokenInfo && tokenInfo.token) {
          log(`Найден токен для администратора ${adminUserId} в хранилище`, 'scheduler');
          
          // Проверяем валидность токена
          try {
            const testResponse = await directusApiManager.request({
              url: '/users/me',
              method: 'get'
            }, tokenInfo.token);
            
            if (testResponse?.data?.data) {
              log('Токен из хранилища валиден', 'scheduler');
              return tokenInfo.token;
            }
          } catch (error: any) {
            log(`Токен из хранилища недействителен: ${error.message}`, 'scheduler');
          }
        }
      } catch (error: any) {
        log(`Ошибка при получении токена из хранилища: ${error.message}`, 'scheduler');
      }
      
      log('Не удалось получить действительный токен для планировщика', 'scheduler');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении системного токена: ${error.message}`, 'scheduler');
      return null;
    }
  }

  async checkScheduledContent() {
    try {
      log('Проверка запланированных публикаций', 'scheduler');
      
      // Проверяем запросы на извлечение токена
      checkTokenExtractionRequest();
      
      // Получаем системный токен для доступа ко всем публикациям
      const systemToken = await this.getSystemToken();
      
      // Пытаемся получить запланированные публикации
      let scheduledContent: CampaignContent[] = [];
      
      if (systemToken) {
        log('Поиск запланированных публикаций через API с системным токеном', 'scheduler');
        
        try {
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
            log(`Получено ${items.length} запланированных публикаций через API с системным токеном`, 'scheduler');
            
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
          }
        } catch (error: any) {
          log(`Ошибка при запросе с системным токеном: ${error.message}`, 'scheduler');
          console.error('Directus API Error:', JSON.stringify(error.response || error, null, 2));
          
          if (error.response?.data) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            console.error('Response status:', error.response.status);
          }
        }
      } else {
        log('Системный токен не найден, запланированные публикации не могут быть обработаны', 'scheduler');
      }
      
      // Если ничего не нашли через API с системным токеном, пробуем через адаптер хранилища
      if (scheduledContent.length === 0 && systemToken) {
        try {
          log('Поиск запланированных публикаций через адаптер хранилища с системным токеном', 'scheduler');
          const allContent = await directusCrud.list('campaign_content', {
            authToken: systemToken,
            filter: {
              status: {
                _eq: 'scheduled'
              },
              scheduled_at: {
                _nnull: true
              }
            },
            sort: ['scheduled_at']
          });
          
          if (allContent && Array.isArray(allContent) && allContent.length > 0) {
            log(`Получено ${allContent.length} запланированных публикаций через CRUD интерфейс`, 'scheduler');
            
            const contentItems = allContent.map((item: any) => ({
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
          }
        } catch (error: any) {
          log(`Ошибка при получении публикаций через CRUD интерфейс: ${error.message}`, 'scheduler');
        }
      }
      
      // В последнюю очередь, если все еще нет данных, пробуем стандартное хранилище
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

      // Получаем системный токен для доступа к API
      const systemToken = await this.getSystemToken();
      
      // Получаем данные кампании для настроек социальных сетей
      let campaign: Campaign | undefined;
      
      // Пробуем с системным токеном через directusCrud
      if (systemToken) {
        try {
          const campaignData = await directusCrud.getById('user_campaigns', content.campaignId, {
            authToken: systemToken
          });
          
          if (campaignData) {
            campaign = {
              id: parseInt(campaignData.id),
              name: campaignData.name,
              userId: campaignData.user_id,
              socialMediaSettings: campaignData.social_media_settings || {},
              createdAt: campaignData.created_at ? new Date(campaignData.created_at) : null,
              description: campaignData.description || null,
              status: campaignData.status || 'active',
              trendAnalysisSettings: campaignData.trend_analysis_settings || {},
              updatedAt: campaignData.updated_at ? new Date(campaignData.updated_at) : null
            } as Campaign;
          }
        } catch (error: any) {
          log(`Ошибка при получении кампании через CRUD: ${error.message}`, 'scheduler');
        }
      }
      
      // Если не получилось через CRUD, используем стандартное хранилище
      if (!campaign) {
        campaign = await storage.getCampaign(parseInt(content.campaignId));
      }
      
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