import axios from 'axios';
import { log } from '../utils/logger';
import { storage } from '../storage';
import { socialPublishingService } from './social/index';
import { detectEnvironment } from '../utils/environment-detector';

interface CampaignContent {
  id: string;
  title: string;
  content: string;
  status: string;
  campaignId: string;
  scheduledAt?: Date;
  socialPlatforms?: any;
}

/**
 * Класс для планирования и выполнения автоматической публикации контента
 */
export class PublishScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 20000; // проверяем каждые 20 секунд
  private processedContentIds = new Set<string>();
  public disablePublishing = false;
  private isProcessing = false;
  private processingStartTime: number = 0;
  private verboseLogging = false;
  private adminTokenCache: string | null = null;
  private adminTokenTimestamp: number = 0;
  private tokenExpirationMs = 30 * 60 * 1000; // 30 минут для токена

  /**
   * Запускает планировщик публикаций
   */
  start() {
    if (this.isRunning) {
      log('Планировщик уже запущен', 'scheduler');
      return;
    }

    this.isRunning = true;
    log('Запуск планировщика публикаций', 'scheduler');

    this.intervalId = setInterval(() => {
      this.checkScheduledContent().catch(error => {
        log(`Ошибка в планировщике: ${error.message}`, 'scheduler');
      });
    }, this.checkIntervalMs);
  }

  /**
   * Останавливает планировщик публикаций
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    log('Планировщик публикаций остановлен', 'scheduler');
  }

  /**
   * Получает токен для доступа к API с автоматическим определением окружения
   */
  public async getSystemToken(): Promise<string | null> {
    try {
      const config = detectEnvironment();
      
      // Проверяем кэш
      const now = Date.now();
      if (this.adminTokenCache && (now - this.adminTokenTimestamp < this.tokenExpirationMs)) {
        return this.adminTokenCache;
      }

      log(`Авторизация для окружения: ${config.environment}`, 'scheduler');
      
      const response = await axios.post(`${config.directusUrl}/auth/login`, {
        email: config.adminEmail,
        password: config.adminPassword
      });
      
      if (response?.data?.data?.access_token) {
        const token = response.data.data.access_token;
        log('Авторизация успешна', 'scheduler');
        
        // Сохраняем токен в кэше
        this.adminTokenCache = token;
        this.adminTokenTimestamp = now;
        
        return token;
      }
      
      log('Не удалось получить токен авторизации', 'scheduler');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении системного токена: ${error.message}`, 'scheduler');
      return null;
    }
  }

  /**
   * Проверяет и публикует запланированный контент
   */
  async checkScheduledContent() {
    try {
      if (this.isProcessing) {
        const processingDuration = Date.now() - this.processingStartTime;
        if (processingDuration < 60000) {
          return;
        } else {
          this.isProcessing = false;
        }
      }
      
      this.isProcessing = true;
      this.processingStartTime = Date.now();
      
      if (this.disablePublishing) {
        return;
      }
      
      const authToken = await this.getSystemToken();
      if (!authToken) {
        return;
      }
      
      const config = detectEnvironment();
      let scheduledContent: CampaignContent[] = [];
      
      try {
        log(`Проверка запланированного контента в ${config.directusUrl}`, 'scheduler');
        
        const response = await axios.get(`${config.directusUrl}/items/campaign_content`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            'filter[status][_eq]': 'scheduled',
            'fields': '*',
            'limit': -1
          }
        });

        scheduledContent = response?.data?.data || [];
        
        if (scheduledContent.length === 0) {
          return;
        }

        log(`Найдено ${scheduledContent.length} запланированных публикаций`, 'scheduler');

        for (const content of scheduledContent) {
          await this.processScheduledContent(content, authToken);
        }
        
      } catch (error: any) {
        log(`Ошибка при получении запланированного контента: ${error.message}`, 'scheduler');
      } finally {
        this.isProcessing = false;
      }
      
    } catch (error: any) {
      log(`Ошибка в checkScheduledContent: ${error.message}`, 'scheduler');
      this.isProcessing = false;
    }
  }

  /**
   * Обрабатывает один элемент запланированного контента
   */
  private async processScheduledContent(content: CampaignContent, authToken: string) {
    try {
      if (!content.socialPlatforms) {
        return;
      }

      let platforms;
      try {
        platforms = typeof content.socialPlatforms === 'string' ? 
          JSON.parse(content.socialPlatforms) : content.socialPlatforms;
      } catch (e) {
        return;
      }

      const selectedPlatforms = Object.entries(platforms).filter(([_, data]: [string, any]) => 
        data.selected === true && data.status === 'pending'
      );

      if (selectedPlatforms.length === 0) {
        return;
      }

      log(`Публикация контента ${content.id}: "${content.title}"`, 'scheduler');
      
      // Получаем данные кампании
      const campaign = await storage.getCampaignById(content.campaignId);
      if (!campaign) {
        log(`Кампания ${content.campaignId} не найдена`, 'scheduler');
        return;
      }

      // Публикуем в каждую выбранную платформу
      for (const [platform] of selectedPlatforms) {
        try {
          log(`Публикация в ${platform}`, 'scheduler');
          
          const result = await socialPublishingService.publishToPlatform(
            platform as any, 
            content, 
            campaign, 
            authToken
          );
          
          if (result && result.status === 'published') {
            log(`Успешная публикация в ${platform}`, 'scheduler');
          }
          
        } catch (error: any) {
          log(`Ошибка публикации в ${platform}: ${error.message}`, 'scheduler');
        }
      }
      
    } catch (error: any) {
      log(`Ошибка при обработке контента ${content.id}: ${error.message}`, 'scheduler');
    }
  }

  /**
   * Публикует контент в социальные сети
   */
  async publishContent(content: CampaignContent, authToken?: string) {
    try {
      const systemToken = authToken || await this.getSystemToken();
      if (!systemToken) {
        throw new Error('Не удалось получить токен авторизации');
      }

      const campaign = await storage.getCampaignById(content.campaignId);
      if (!campaign) {
        throw new Error(`Кампания ${content.campaignId} не найдена`);
      }

      if (!content.socialPlatforms) {
        throw new Error('Не указаны платформы для публикации');
      }

      let platforms;
      try {
        platforms = typeof content.socialPlatforms === 'string' ? 
          JSON.parse(content.socialPlatforms) : content.socialPlatforms;
      } catch (e) {
        throw new Error('Ошибка при парсинге данных платформ');
      }

      const results: Record<string, any> = {};
      
      for (const [platform, data] of Object.entries(platforms)) {
        const platformData = data as any;
        
        if (platformData.selected && platformData.status === 'pending') {
          try {
            log(`Публикация контента в ${platform}`, 'scheduler');
            
            const result = await socialPublishingService.publishToPlatform(
              platform as any,
              content,
              campaign,
              systemToken
            );
            
            results[platform] = {
              success: true,
              result
            };
            
          } catch (error: any) {
            log(`Ошибка публикации в ${platform}: ${error.message}`, 'scheduler');
            results[platform] = {
              success: false,
              error: error.message
            };
          }
        }
      }
      
      return results;
      
    } catch (error: any) {
      log(`Ошибка при публикации контента: ${error.message}`, 'scheduler');
      throw error;
    }
  }

  /**
   * Очищает кэш обработанных ID
   */
  clearProcessedContentIds() {
    this.processedContentIds.clear();
    log('Кэш обработанных ID очищен', 'scheduler');
  }

  /**
   * Добавляет ID в список обработанных
   */
  addProcessedContentId(contentId: string) {
    this.processedContentIds.add(contentId);
  }

  /**
   * Очищает кэш токена
   */
  clearTokenCache() {
    this.adminTokenCache = null;
    this.adminTokenTimestamp = 0;
    log('Кэш токена очищен', 'scheduler');
  }
}

function getSchedulerInstance(): PublishScheduler {
  return new PublishScheduler();
}

function startSchedulerOnce(): PublishScheduler {
  const scheduler = getSchedulerInstance();
  scheduler.start();
  return scheduler;
}

export const publishScheduler = startSchedulerOnce();