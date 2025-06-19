import axios from 'axios';
import { log } from '../utils/logger';
import { storage } from '../storage';
import { socialPublishingService } from './social/index';
import { directusCrud } from './directus-crud';

/**
 * Исправленный класс для планирования и выполнения автоматической публикации контента
 * с поддержкой индивидуального времени публикации для каждой платформы через N8N
 */
export class PublishScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 30000; // проверяем каждые 30 секунд
  private isProcessing = false;
  private adminTokenCache: string | null = null;
  private adminTokenTimestamp: number = 0;
  private tokenExpirationMs = 30 * 60 * 1000; // 30 минут

  /**
   * Запускает планировщик публикаций
   */
  start() {
    if (this.isRunning) {
      log('⚠️ Планировщик уже запущен, пропускаем повторный запуск', 'scheduler');
      return;
    }

    this.isRunning = true;
    log('✅ Запуск планировщика публикаций с поддержкой индивидуального времени платформ', 'scheduler');
    
    // Сразу выполняем первую проверку
    this.checkScheduledContent();
    
    // Устанавливаем интервал для регулярной проверки
    this.intervalId = setInterval(() => {
      this.checkScheduledContent();
    }, this.checkIntervalMs);
    
    log(`✅ Планировщик запущен с интервалом ${this.checkIntervalMs}мс`, 'scheduler');
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
    this.isProcessing = false;
  }

  /**
   * Получает системный токен для доступа к API
   */
  public async getSystemToken(): Promise<string | null> {
    try {
      // Проверяем кэшированный токен
      const now = Date.now();
      if (this.adminTokenCache && 
          (now - this.adminTokenTimestamp < this.tokenExpirationMs)) {
        return this.adminTokenCache;
      }

      // Получаем новый токен
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (email && password) {
        try {
          const directusUrl = process.env.DIRECTUS_URL;
          const authResponse = await axios.post(`${directusUrl}/auth/login`, {
            email,
            password
          });
          
          if (authResponse.data?.data?.access_token) {
            this.adminTokenCache = authResponse.data.data.access_token;
            this.adminTokenTimestamp = now;
            log('Успешно получен новый токен администратора для планировщика', 'scheduler');
            return authResponse.data.data.access_token;
          }
        } catch (error: any) {
          log(`Ошибка при авторизации планировщика: ${error.message}`, 'scheduler');
        }
      }

      log('Не удалось получить действительный токен для планировщика', 'scheduler');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении системного токена: ${error.message}`, 'scheduler');
      return null;
    }
  }

  /**
   * Проверяет и публикует запланированный контент с учетом индивидуального времени платформ
   */
  async checkScheduledContent() {
    try {
      if (this.isProcessing) {
        return;
      }
      
      this.isProcessing = true;
      
      // Получаем системный токен
      const authToken = await this.getSystemToken();
      if (!authToken) {
        return;
      }
      
      // Получаем весь контент для проверки времени публикации платформ
      const directusUrl = process.env.DIRECTUS_URL;
      if (!directusUrl) {
        log('DIRECTUS_URL не настроен в переменных окружения', 'scheduler');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      };

      const currentTime = new Date();
      const currentTimeISO = currentTime.toISOString();
      
      // Получаем только контент со статусом 'scheduled'
      const response = await axios.get(`${directusUrl}/items/campaign_content`, {
        headers,
        params: {
          filter: JSON.stringify({
            _and: [
              {
                status: {
                  _eq: 'scheduled'
                }
              },
              {
                social_platforms: {
                  _nnull: true
                }
              }
            ]
          }),
          limit: 100
        }
      });

      const allContent = response?.data?.data || [];
      
      if (allContent.length === 0) {
        return;
      }
      const contentToPublish = [];

      // Проверяем каждый контент на готовность к публикации
      for (const content of allContent) {
        // Поддерживаем оба формата: social_platforms и socialPlatforms
        const platformsData = content.social_platforms || content.socialPlatforms;
        if (!platformsData) continue;

        let platforms = platformsData;
        if (typeof platforms === 'string') {
          try {
            platforms = JSON.parse(platforms);
          } catch (e) {
            continue;
          }
        }

        // Быстрая проверка: есть ли хотя бы одна неопубликованная платформа
        const hasUnpublishedPlatforms = Object.values(platforms).some((platformData: any) => 
          !(platformData.status === 'published' && platformData.postUrl)
        );
        
        if (!hasUnpublishedPlatforms) {
          // Все платформы уже опубликованы, пропускаем этот контент
          continue;
        }

        const readyPlatforms = [];

        // Проверяем каждую платформу на готовность к публикации
        for (const [platformName, platformData] of Object.entries(platforms)) {
          const data = platformData as any;
          
          // Пропускаем уже опубликованные платформы
          if (data.status === 'published' && data.postUrl) {
            continue;
          }

          // Проверяем время публикации для платформы
          let shouldPublish = false;

          if (data.scheduledAt || data.scheduled_at) {
            // У платформы есть свое время публикации
            const platformTime = new Date(data.scheduledAt || data.scheduled_at);
            if (platformTime <= currentTime) {
              shouldPublish = true;
            }
          } else if (content.scheduled_at) {
            // Используем общее время контента
            const contentTime = new Date(content.scheduled_at);
            if (contentTime <= currentTime) {
              shouldPublish = true;
            }
          } else if (data.status === 'pending') {
            // Платформа в статусе pending без времени - публикуем немедленно
            shouldPublish = true;
          } else if (data.status === 'failed') {
            // Повторная попытка для failed публикаций через 5 минут
            const failedTime = data.updatedAt ? new Date(data.updatedAt) : new Date(0);
            const retryTime = new Date(failedTime.getTime() + 5 * 60 * 1000); // +5 минут
            if (currentTime >= retryTime) {
              shouldPublish = true;
              log(`Повторная попытка публикации в ${platformName} для контента ${content.id}`, 'scheduler');
            }
          }

          if (shouldPublish) {
            readyPlatforms.push(platformName);
          }
        }

        if (readyPlatforms.length > 0) {
          contentToPublish.push({
            content,
            platforms: readyPlatforms
          });
        }
      }

      if (contentToPublish.length > 0) {
        log(`Найдено ${contentToPublish.length} контентов готовых к публикации`, 'scheduler');
        
        // Отправляем уведомление в UI о найденном запланированном контенте
        try {
          const { broadcastNotification } = await import('../index');
          broadcastNotification('scheduled_content_found', {
            count: contentToPublish.length,
            message: `Найдено ${contentToPublish.length} контентов готовых к публикации`
          });
        } catch (error) {
          // Игнорируем ошибки уведомлений
        }
      }

      // Публикуем контент асинхронно через N8N
      for (const item of contentToPublish) {
        await this.publishContentToPlatforms(item.content, item.platforms, authToken);
      }

    } catch (error: any) {
      log(`Ошибка при проверке запланированных публикаций: ${error.message}`, 'scheduler');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Публикует контент в указанные платформы через N8N
   */
  private async publishContentToPlatforms(content: any, platforms: string[], authToken: string) {
    // Создаем промисы для параллельной публикации через N8N
    const publishPromises = platforms.map(async (platform) => {
      try {

        // Маппинг платформ на N8N webhook endpoints
        const webhookMap: Record<string, string> = {
          'telegram': 'publish-telegram',
          'vk': 'publish-vk',
          'instagram': 'publish-instagram', 
          'facebook': 'publish-facebook'
        };

        const platformString = platform.toLowerCase();
        const webhookName = webhookMap[platformString] || `publish-${platformString}`;

        // Формируем URL для N8N webhook
        const n8nBaseUrl = process.env.N8N_URL;
        if (!n8nBaseUrl) {
          throw new Error('N8N_URL не настроен в переменных окружения');
        }

        const baseUrl = n8nBaseUrl.endsWith('/') ? n8nBaseUrl.slice(0, -1) : n8nBaseUrl;
        const webhookUrl = baseUrl.includes('/webhook') 
          ? `${baseUrl}/${webhookName}`
          : `${baseUrl}/webhook/${webhookName}`;

        // Отправляем запрос на N8N webhook
        log(`Отправка контента ${content.id} в ${platform} через N8N webhook`, 'scheduler');
        
        await axios.post(webhookUrl, {
          contentId: content.id,
          platform: platformString
        }, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        log(`Контент ${content.id} успешно отправлен в ${platform}`, 'scheduler');
        
        // Отправляем уведомление в UI об успешной отправке
        try {
          const { broadcastNotification } = await import('../index');
          broadcastNotification('content_published', {
            contentId: content.id,
            platform: platform,
            message: `Контент успешно опубликован в ${platform}`
          });
        } catch (error) {
          // Игнорируем ошибки уведомлений
        }
        
        return { platform, success: true };

      } catch (error: any) {
        return { platform, success: false, error: error.message };
      }
    });

    // Выполняем все публикации параллельно и показываем результат
    await Promise.allSettled(publishPromises);

    // Обновляем общий статус контента
    await this.updateContentStatus(content.id, authToken);
  }

  /**
   * Обновляет общий статус контента на основе статусов всех платформ
   */
  private async updateContentStatus(contentId: string, authToken: string) {
    try {
      // Получаем актуальные данные контента
      const freshContent = await storage.getCampaignContentById(contentId, authToken);
      if (!freshContent?.social_platforms) return;

      let platforms = freshContent.social_platforms;
      if (typeof platforms === 'string') {
        platforms = JSON.parse(platforms);
      }

      const allPlatforms = Object.keys(platforms);
      const publishedCount = Object.values(platforms).filter((data: any) => 
        data.status === 'published' && data.postUrl
      ).length;

      // Определяем новый статус
      let newStatus = freshContent.status;
      if (publishedCount === allPlatforms.length) {
        newStatus = 'published';
      } else if (publishedCount > 0) {
        newStatus = 'partially_published';
      }

      // Обновляем статус если он изменился
      if (newStatus !== freshContent.status) {
        const updateData: any = { status: newStatus };
        if (newStatus === 'published') {
          updateData.published_at = new Date();
        }

        await storage.updateCampaignContent(contentId, updateData, authToken);
        log(`Статус контента ${contentId} обновлен на '${newStatus}'`, 'scheduler');
      }

    } catch (error: any) {
      log(`Ошибка при обновлении статуса контента ${contentId}: ${error.message}`, 'scheduler');
    }
  }
}

// Создаем единственный экземпляр планировщика
let publishSchedulerInstance: PublishScheduler | null = null;

export function getPublishScheduler(): PublishScheduler {
  if (!publishSchedulerInstance) {
    publishSchedulerInstance = new PublishScheduler();
    log('✅ Планировщик публикаций инициализирован через синглтон', 'scheduler');
  }
  return publishSchedulerInstance;
}