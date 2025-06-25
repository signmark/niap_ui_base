import axios from 'axios';
import { log } from '../utils/logger';
import { storage } from '../storage';
import { socialPublishingService } from './social/index';
import { directusCrud } from './directus-crud';
import { publicationLockManager } from './publication-lock-manager';

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
  
  // Кэш для предотвращения повторной публикации
  private processedContentCache = new Map<string, Set<string>>(); // contentId -> Set<platform>
  private cacheCleanupInterval = 10 * 60 * 1000; // очищаем кэш каждые 10 минут
  private lastCacheCleanup = Date.now();

  /**
   * Очищает кэш обработанного контента
   */
  private cleanupCache() {
    const now = Date.now();
    if (now - this.lastCacheCleanup > this.cacheCleanupInterval) {
      this.processedContentCache.clear();
      this.lastCacheCleanup = now;
      log('Кэш обработанного контента очищен', 'scheduler');
    }
  }

  /**
   * Принудительно очищает кэш для конкретного контента
   */
  public clearContentCache(contentId: string) {
    this.processedContentCache.delete(contentId);
    log(`Кэш очищен для контента ${contentId}`, 'scheduler');
  }

  /**
   * Проверяет, была ли уже обработана публикация для данной платформы
   */
  private isAlreadyProcessed(contentId: string, platform: string): boolean {
    const platformSet = this.processedContentCache.get(contentId);
    return platformSet ? platformSet.has(platform) : false;
  }

  /**
   * Отмечает контент как обработанный для данной платформы
   */
  private markAsProcessed(contentId: string, platform: string) {
    let platformSet = this.processedContentCache.get(contentId);
    if (!platformSet) {
      platformSet = new Set();
      this.processedContentCache.set(contentId, platformSet);
    }
    platformSet.add(platform);
  }

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
      const { adminTokenManager } = await import('./admin-token-manager');
      return await adminTokenManager.getAdminToken();
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
      
      // Очищаем кэш при необходимости
      this.cleanupCache();
      
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
      
      // Получаем контент со статусами 'scheduled' и 'partial' для обработки
      log(`Планировщик: Отправляем запрос к ${directusUrl}/items/campaign_content с токеном ${authToken.substring(0, 10)}...`, 'scheduler');
      
      let allContent: any[] = [];
      
      try {
        const response = await axios.get(`${directusUrl}/items/campaign_content`, {
          headers,
          params: {
            filter: JSON.stringify({
              status: {
                _in: ['scheduled', 'partial']
              }
            }),
            limit: 100
          }
        });

        log(`Планировщик: Получен ответ от Directus. Статус: ${response.status}`, 'scheduler');

        allContent = response?.data?.data || [];
        
        log(`Планировщик: Найдено ${allContent.length} контентов для обработки (scheduled/partial)`, 'scheduler');
        
        if (allContent.length > 0) {
          log(`Планировщик: Статусы найденного контента: ${allContent.map((c: any) => c.status).join(', ')}`, 'scheduler');
        }
        
        if (allContent.length === 0) {
          return;
        }

        // Отправляем уведомление о начале обработки
        try {
          const { broadcastNotification } = await import('../index');
          broadcastNotification('scheduler_processing_start', {
            count: allContent.length,
            message: `Начинаем обработку ${allContent.length} контентов для публикации`
          });
        } catch (error) {
          // Игнорируем ошибки уведомлений
        }

        let processedCount = 0;
        let publishedCount = 0;

        // Обрабатываем каждый контент для определения неопубликованных платформ
        for (const content of allContent) {
          log(`Планировщик: Обрабатываем контент ${content.id} (статус: ${content.status})`, 'scheduler');
          processedCount++;
          
          // Получаем данные платформ
          const platformsData = content.social_platforms || content.socialPlatforms;
          if (!platformsData) {
            log(`Планировщик: Пропускаем контент ${content.id} - нет данных платформ`, 'scheduler');
            continue;
          }

          let platforms = platformsData;
          if (typeof platforms === 'string') {
            try {
              platforms = JSON.parse(platforms);
            } catch (e) {
              log(`Планировщик: Ошибка парсинга JSON для контента ${content.id}`, 'scheduler');
              continue;
            }
          }
          
          // Определяем платформы готовые к публикации с учетом времени
          const readyPlatforms = [];
          log(`Планировщик: Анализируем платформы для контента ${content.id}: ${Object.keys(platforms).join(', ')}`, 'scheduler');
          
          for (const [platformName, platformData] of Object.entries(platforms)) {
            const data = platformData as any;
            log(`Планировщик: Платформа ${platformName} - статус: ${data.status}, enabled: ${data.enabled}`, 'scheduler');
            
            // Пропускаем уже опубликованные платформы (строгая проверка)
            if (data.status === 'published' && data.postUrl && data.postUrl.trim() !== '') {
              continue;
            }
            
            // Пропускаем платформы с критическими ошибками, но разрешаем повторные попытки для failed
            if (data.error && data.error.includes('CRITICAL')) {
              continue;
            }

            // КРИТИЧЕСКАЯ ЗАЩИТА: Проверяем кэш на предмет повторной обработки
            if (this.isAlreadyProcessed(content.id, platformName)) {
              log(`Планировщик: Платформа ${platformName} для контента ${content.id} уже обрабатывается, пропускаем`, 'scheduler');
              continue;
            }

            // ОТКЛЮЧЕНА БЛОКИРОВКА ДЛЯ ПЛАНИРОВЩИКА - блокировки только для ручной публикации
            // Планировщик должен работать свободно по расписанию

            // Проверяем время публикации для платформы
            let shouldPublish = false;

            // Проверяем индивидуальное время платформы (приоритет)
            if (data.scheduledAt || data.scheduled_at) {
              const platformTime = new Date(data.scheduledAt || data.scheduled_at);
              if (platformTime <= currentTime) {
                shouldPublish = true;
                log(`Планировщик: Платформа ${platformName} готова по индивидуальному времени - ${platformTime.toISOString()} <= ${currentTime.toISOString()}`, 'scheduler');
              } else {
                log(`Планировщик: Платформа ${platformName} ждет своего времени - ${platformTime.toISOString()} > ${currentTime.toISOString()}`, 'scheduler');
              }
            } 
            // Проверяем общее время контента (если нет индивидуального)
            else if (content.scheduled_at) {
              const contentTime = new Date(content.scheduled_at);
              if (contentTime <= currentTime) {
                shouldPublish = true;
                log(`Планировщик: Платформа ${platformName} готова по общему времени - ${contentTime.toISOString()} <= ${currentTime.toISOString()}`, 'scheduler');
              } else {
                log(`Планировщик: Платформа ${platformName} ждет общего времени контента - ${contentTime.toISOString()} > ${currentTime.toISOString()}`, 'scheduler');
              }
            } 
            // Для контента со статусом partial - публикуем сразу (повторная попытка)
            else if (content.status === 'partial') {
              shouldPublish = true;
              log(`Планировщик: Платформа ${platformName} - немедленная публикация (статус partial)`, 'scheduler');
            }
            // Платформа в статусе pending или failed без времени - публикуем сразу
            else if (data.status === 'pending' || data.status === 'failed') {
              shouldPublish = true;
              log(`Планировщик: Платформа ${platformName} - немедленная публикация (статус ${data.status})`, 'scheduler');
            }

            if (shouldPublish) {
              // Отмечаем платформу как обрабатываемую ПЕРЕД добавлением в очередь
              this.markAsProcessed(content.id, platformName);
              readyPlatforms.push(platformName);
              log(`Планировщик: Платформа ${platformName} добавлена в очередь публикации для контента ${content.id}`, 'scheduler');
            }
          }

          if (readyPlatforms.length > 0) {
            log(`Планировщик: Контент ${content.id} готов к публикации в: ${readyPlatforms.join(', ')}`, 'scheduler');
            
            // Отправляем в готовые платформы через N8N
            await this.publishContentToPlatforms(content, readyPlatforms, authToken);
            publishedCount++;
          } else {
            log(`Планировщик: Контент ${content.id} - нет платформ готовых к публикации в данный момент`, 'scheduler');
          }
        }

        // Отправляем итоговое уведомление
        try {
          const { broadcastNotification } = await import('../index');
          broadcastNotification('scheduler_processing_complete', {
            processedCount,
            publishedCount,
            message: `Обработка завершена: ${publishedCount} из ${processedCount} публикаций запущено`
          });
        } catch (error) {
          // Игнорируем ошибки уведомлений
        }
        
      } catch (error: any) {
        log(`Планировщик: Ошибка запроса к Directus API: ${error.message}`, 'scheduler');
        if (error.response) {
          log(`Планировщик: Статус ошибки: ${error.response.status}, Данные: ${JSON.stringify(error.response.data)}`, 'scheduler');
        }
        return;
      }
      
    } catch (error: any) {
      log(`Ошибка при проверке запланированных публикаций: ${error.message}`, 'scheduler');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Публикует контент в указанные платформы через прямые сервисы или N8N
   */
  private async publishContentToPlatforms(content: any, platforms: string[], authToken: string) {
    // Создаем промисы для параллельной публикации
    const publishPromises = platforms.map(async (platform) => {
      try {
        // YouTube публикуется напрямую через API, остальные через N8N
        if (platform.toLowerCase() === 'youtube') {
          return await this.publishToYouTubeDirect(content, authToken);
        } else {
          return await this.publishThroughN8nWebhook(content, platform);
        }
      } catch (error: any) {
        log(`Ошибка публикации ${content.id} в ${platform}: ${error.message}`, 'scheduler');
        return { platform, success: false, error: error.message };
      }
    });

    // Выполняем все публикации параллельно и показываем результат
    await Promise.allSettled(publishPromises);

    // Обновляем общий статус контента
    await this.updateContentStatus(content.id, authToken);
  }

  /**
   * Публикует контент в YouTube напрямую через API
   */
  private async publishToYouTubeDirect(content: any, authToken: string) {
    try {
      log(`Планировщик: Прямая публикация в YouTube для контента ${content.id}`, 'scheduler');
      
      // Получаем данные кампании
      const campaign = await this.getCampaignData(content.campaign_id, authToken);
      if (!campaign) {
        throw new Error('Не удалось получить данные кампании');
      }

      // Используем социальный сервис для публикации
      const { socialPublishingService } = await import('./social/index');
      const result = await socialPublishingService.publishToPlatform('youtube', content, campaign.social_media_settings, authToken);

      if (result.status === 'published') {
        log(`YouTube публикация успешна для контента ${content.id}: ${result.postUrl}`, 'scheduler');
        
        // Отправляем уведомление
        try {
          const { broadcastNotification } = await import('../index');
          broadcastNotification('content_published', {
            contentId: content.id,
            platform: 'youtube',
            message: 'Успешно опубликовано в YouTube'
          });
        } catch (error) {
          // Игнорируем ошибки уведомлений
        }
        
        return { platform: 'youtube', success: true };
      } else {
        throw new Error(result.error || 'Неизвестная ошибка YouTube API');
      }

    } catch (error: any) {
      log(`Ошибка прямой публикации YouTube ${content.id}: ${error.message}`, 'scheduler');
      return { platform: 'youtube', success: false, error: error.message };
    }
  }

  /**
   * Публикует контент через N8N webhook
   */
  private async publishThroughN8nWebhook(content: any, platform: string) {
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

    log(`🔄 Планировщик: Отправляем запрос в N8N для публикации контента ${content.id} в ${platform}`, 'scheduler');
    log(`🔗 Планировщик: URL webhook: ${webhookUrl}`, 'scheduler');
    
    await axios.post(webhookUrl, {
      contentId: content.id,
      platform: platformString,
      source: 'scheduler',
      timestamp: new Date().toISOString()
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    log(`Контент ${content.id} успешно отправлен в N8N для ${platform}`, 'scheduler');
    
    // Отправляем уведомление в UI
    try {
      const { broadcastNotification } = await import('../index');
      const platformNames: Record<string, string> = {
        'instagram': 'Instagram',
        'facebook': 'Facebook', 
        'vk': 'ВКонтакте',
        'telegram': 'Telegram'
      };
      const platformName = platformNames[platform.toLowerCase()] || platform;
      
      broadcastNotification('content_published', {
        contentId: content.id,
        platform: platform,
        message: `Отправлено в N8N для публикации в ${platformName}`
      });
    } catch (error) {
      // Игнорируем ошибки уведомлений
    }
    
    return { platform, success: true };
  }

  /**
   * Получает данные кампании
   */
  private async getCampaignData(campaignId: string, authToken: string) {
    try {
      const response = await axios.get(`${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          fields: 'id,name,social_media_settings'
        }
      });
      log(`Получены данные кампании ${campaignId}: ${JSON.stringify(response.data.data)}`, 'scheduler');
      return response.data.data;
    } catch (error: any) {
      log(`Ошибка получения данных кампании ${campaignId}: ${error.message}`, 'scheduler');
      return null;
    }
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