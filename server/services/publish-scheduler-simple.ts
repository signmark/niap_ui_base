import axios from 'axios';
import { log } from '../utils/logger';
import { directusApiManager } from '../directus';
import { publicationLockManager } from './publication-lock-manager';

/**
 * Упрощенный планировщик для отправки webhooks в N8N
 * Все публикации и обновления статусов выполняет N8N
 */
export class PublishScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 30000; // проверяем каждые 30 секунд
  private isProcessing = false;
  
  // Кэш токенов
  private adminTokenCache: string | null = null;
  private adminTokenTimestamp: number = 0;
  private tokenExpirationMs = 30 * 60 * 1000; // 30 минут

  /**
   * Запускает планировщик публикаций
   */
  start() {
    if (this.isRunning) {
      log('⚠️ Планировщик уже запущен', 'scheduler');
      return;
    }

    this.isRunning = true;
    log('✅ Запуск N8N планировщика публикаций', 'scheduler');
    
    // Сразу выполняем первую проверку
    this.checkScheduledContent();
    
    // Устанавливаем интервал для регулярной проверки
    this.intervalId = setInterval(() => {
      this.checkScheduledContent();
    }, this.checkIntervalMs);
    
    log(`✅ N8N планировщик запущен с интервалом ${this.checkIntervalMs}мс`, 'scheduler');
  }

  /**
   * Останавливает планировщик публикаций
   */
  stop() {
    if (!this.isRunning || !this.intervalId) {
      log('Планировщик не запущен', 'scheduler');
      return;
    }

    log('Остановка N8N планировщика', 'scheduler');
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Проверяет запланированный контент и отправляет webhooks в N8N
   */
  private async checkScheduledContent() {
    if (this.isProcessing) {
      log('Предыдущая проверка еще выполняется, пропускаем', 'scheduler');
      return;
    }

    this.isProcessing = true;

    try {
      const token = await this.getAdminToken();
      if (!token) {
        log('❌ Не удалось получить токен администратора', 'scheduler');
        return;
      }

      // Получаем запланированный контент
      const scheduledContent = await this.getScheduledContent(token);
      log(`Найдено ${scheduledContent.length} запланированных элементов контента`, 'scheduler');

      for (const content of scheduledContent) {
        await this.processScheduledContent(content);
      }

    } catch (error) {
      log(`❌ Ошибка при проверке запланированного контента: ${error.message}`, 'scheduler');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Получает токен администратора
   */
  private async getAdminToken(): Promise<string | null> {
    const now = Date.now();
    
    // Проверяем кэш токена
    if (this.adminTokenCache && (now - this.adminTokenTimestamp) < this.tokenExpirationMs) {
      return this.adminTokenCache;
    }

    try {
      const token = await directusApiManager.getAdminToken();
      this.adminTokenCache = token;
      this.adminTokenTimestamp = now;
      log('Токен авторизации для планировщика получен', 'scheduler');
      return token;
    } catch (error) {
      log(`❌ Ошибка получения токена: ${error.message}`, 'scheduler');
      return null;
    }
  }

  /**
   * Получает запланированный контент из Directus
   */
  private async getScheduledContent(token: string): Promise<any[]> {
    try {
      const now = new Date();
      const filter = {
        status: { _eq: 'scheduled' },
        scheduled_at: { _lte: now.toISOString() }
      };

      const response = await axios.get(`${process.env.DIRECTUS_URL}/items/campaign_content`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          filter: JSON.stringify(filter),
          fields: 'id,social_platforms,campaign_id'
        }
      });

      return response.data.data || [];
    } catch (error) {
      log(`❌ Ошибка получения запланированного контента: ${error.message}`, 'scheduler');
      return [];
    }
  }

  /**
   * Обрабатывает запланированный контент - отправляет webhooks в N8N
   */
  private async processScheduledContent(content: any) {
    try {
      const { id: contentId, social_platforms } = content;
      
      if (!social_platforms) {
        log(`Контент ${contentId}: нет настроек платформ`, 'scheduler');
        return;
      }

      // Определяем готовые для публикации платформы
      const readyPlatforms = this.getReadyPlatforms(social_platforms);
      
      if (readyPlatforms.length === 0) {
        log(`Контент ${contentId}: нет готовых платформ для публикации`, 'scheduler');
        return;
      }

      log(`Контент ${contentId}: отправка в N8N для платформ: ${readyPlatforms.join(', ')}`, 'scheduler');

      // Отправляем webhook для каждой платформы
      for (const platform of readyPlatforms) {
        await this.publishToSocialMedia(contentId, platform);
      }

    } catch (error) {
      log(`❌ Ошибка обработки контента ${content.id}: ${error.message}`, 'scheduler');
    }
  }

  /**
   * Определяет платформы готовые для публикации
   */
  private getReadyPlatforms(socialPlatforms: any): string[] {
    const readyPlatforms: string[] = [];
    
    for (const [platform, settings] of Object.entries(socialPlatforms)) {
      if (this.isPlatformReady(settings)) {
        readyPlatforms.push(platform);
      }
    }
    
    return readyPlatforms;
  }

  /**
   * Проверяет готовность платформы к публикации
   */
  private isPlatformReady(platformSettings: any): boolean {
    if (!platformSettings || typeof platformSettings !== 'object') {
      return false;
    }

    // Платформа должна быть выбрана и не опубликована
    return platformSettings.selected === true && 
           (!platformSettings.status || platformSettings.status === 'pending');
  }

  /**
   * Отправляет webhook в N8N для публикации
   */
  private async publishToSocialMedia(contentId: string, platform: string): Promise<boolean> {
    const webhookUrl = `${process.env.N8N_URL}/webhook/publish-${platform}`;
    
    try {
      log(`[scheduler] Отправка ${platform}: contentId=${contentId}`, 'scheduler');
      
      const response = await axios.post(webhookUrl, {
        contentId,
        platform
      }, { timeout: 10000 });

      if (response.status === 200) {
        log(`✅ N8N принял задачу ${platform}: contentId=${contentId}`, 'scheduler');
        return true;
      }
      return false;
      
    } catch (error) {
      log(`❌ Ошибка webhook ${platform}: ${error.message}`, 'scheduler');
      return false;
    }
  }

  /**
   * Публикация с показом результата (для API эндпоинта)
   */
  async publishContent(contentId: string, selectedPlatforms: string[]): Promise<{success: boolean, message: string}> {
    const results = [];
    
    for (const platform of selectedPlatforms) {
      // Проверяем блокировку для предотвращения дублирования
      const lockAcquired = await publicationLockManager.acquireLock(contentId, platform);
      if (!lockAcquired) {
        log(`🔒 PublishContent: Блокировка уже установлена для ${contentId}:${platform}, пропускаем`, 'scheduler');
        results.push({platform, success: false, reason: 'blocked'});
        continue;
      }

      try {
        const success = await this.publishToSocialMedia(contentId, platform);
        results.push({platform, success});
        
        // Освобождаем блокировку после публикации
        await publicationLockManager.releaseLock(contentId, platform);
      } catch (error) {
        // Освобождаем блокировку при ошибке
        await publicationLockManager.releaseLock(contentId, platform);
        results.push({platform, success: false, error: error.message});
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
      return {
        success: true, 
        message: `Контент успешно отправлен на публикацию на ${totalCount} платформах`
      };
    } else if (successCount > 0) {
      return {
        success: true,
        message: `Контент отправлен на публикацию для ${successCount} из ${totalCount} платформ`
      };
    } else {
      return {
        success: false,
        message: 'Ошибка отправки во все платформы'
      };
    }
  }
}

// Синглтон экземпляр планировщика
export const publishScheduler = new PublishScheduler();