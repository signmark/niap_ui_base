import { telegramService } from './telegram-service';
import { vkService } from './vk-service';
import { instagramService } from './instagram-service';
import { facebookSocialService } from './facebook';
import { YouTubeService } from '../social-platforms/youtube-service';
import { log } from '../../utils/logger';
import { getPublishScheduler } from '../publish-scheduler';
import fetch from 'node-fetch';

/**
 * Единый сервис для публикации контента в различные социальные сети
 */
export class SocialPublishingService {
  /**
   * Получает токен для доступа к API
   * Использует статический токен из переменных окружения
   * 
   * @returns {Promise<string|null>} Токен для авторизации запросов к API
   */
  public async getSystemToken(): Promise<string | null> {
    return process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_ADMIN_TOKEN || null;
  }
  /**
   * Публикует контент в выбранную социальную платформу
   * @param content Контент для публикации
   * @param platform Социальная платформа
   * @param settings Настройки социальных сетей
   * @returns Результат публикации
   */
  public async publishToPlatform(
    content: any,
    platform: string,
    campaign: any,
    authToken?: string
  ): Promise<any> {
    log(`Публикация контента ${content.id} в ${platform}`, 'social-publishing');
    
    try {
      // КРИТИЧЕСКАЯ ЗАЩИТА: Проверяем, не опубликована ли уже платформа
      if (content.socialPlatforms && content.socialPlatforms[platform]) {
        const platformData = content.socialPlatforms[platform];
        
        // Если статус published И есть postUrl - блокируем повторную публикацию
        if (platformData.status === 'published' && platformData.postUrl && platformData.postUrl.trim() !== '') {
          log(`БЛОКИРОВКА ДУБЛИРОВАНИЯ: Платформа ${platform} уже опубликована (postUrl: ${platformData.postUrl})`, 'social-publishing');
          return {
            platform,
            status: 'published',
            publishedAt: platformData.publishedAt || new Date().toISOString(),
            messageId: platformData.messageId || null,
            url: platformData.postUrl,
            error: null
          };
        }
        
        // Умная обработка quota_exceeded для YouTube - проверяем, не обновились ли квоты
        if (platform === 'youtube' && platformData.status === 'quota_exceeded') {
          const quotaExceededTime = platformData.updatedAt ? new Date(platformData.updatedAt) : null;
          let shouldResetQuota = false;
          
          if (quotaExceededTime) {
            // YouTube квоты обновляются в полночь PT
            const nowPT = new Date();
            const ptOffset = -8 * 60; // Pacific Time offset in minutes
            const ptTime = new Date(nowPT.getTime() + ptOffset * 60000);
            
            const quotaPTTime = new Date(quotaExceededTime.getTime() + ptOffset * 60000);
            const daysDiff = Math.floor((ptTime.getTime() - quotaPTTime.getTime()) / (24 * 60 * 60 * 1000));
            
            if (daysDiff >= 1) {
              shouldResetQuota = true;
              log(`YouTube квоты обновились, сбрасываем quota_exceeded для ${content.id}`, 'social-publishing');
            }
          } else {
            shouldResetQuota = true;
            log(`Сбрасываем старый quota_exceeded статус без даты для ${content.id}`, 'social-publishing');
          }
          
          if (!shouldResetQuota) {
            log(`БЛОКИРОВКА ДУБЛИРОВАНИЯ: Платформа ${platform} квота превышена (квоты еще не обновились)`, 'social-publishing');
            return {
              platform,
              status: 'quota_exceeded',
              publishedAt: platformData.publishedAt || new Date().toISOString(),
              messageId: platformData.messageId || null,
              url: platformData.postUrl,
              error: 'YouTube API quota exceeded - waiting for daily reset'
            };
          }
          // Если квоты обновились, продолжаем публикацию
          log(`Квоты YouTube обновились, пробуем повторную публикацию для ${content.id}`, 'social-publishing');
        }
        
        // Сбрасываем некорректные published статусы без postUrl
        if (platformData.status === 'published' && (!platformData.postUrl || platformData.postUrl.trim() === '')) {
          log(`ИСПРАВЛЕНИЕ: Сброс некорректного статуса 'published' без postUrl для платформы ${platform}`, 'social-publishing');
        }
      }
      
      // Получаем настройки социальных сетей из объекта кампании
      const settings = campaign.social_media_settings || campaign.socialMediaSettings || campaign.settings || {};
      log(`Настройки для ${platform}: ${JSON.stringify(settings[platform])}`, 'social-publishing');
      
      // ВСЕ платформы (ВК, Telegram, Instagram, Facebook, YouTube) идут через n8n webhook
      // Убираем все прямые публикации - только единый подход через N8N
      return await this.publishThroughN8nWebhook(content, platform, settings);
    } catch (error) {
      log(`Ошибка при публикации в ${platform}: ${error}`, 'social-publishing');
      return {
        platform,
        status: 'failed',
        publishedAt: null,
        error: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Публикует контент через n8n webhook (ЕДИНСТВЕННЫЙ способ публикации)
   */
  private async publishThroughN8nWebhook(content: any, platform: string, settings: any): Promise<any> {
    // Используем только N8N_URL из переменных окружения
    const baseN8nUrl = process.env.N8N_URL;
    if (!baseN8nUrl) {
      throw new Error('N8N_URL не настроен в переменных окружения');
    }
    
    // Проверяем тип контента для Instagram Stories
    const isStory = content.content_type === 'story' || 
                   (content.metadata && (
                     (typeof content.metadata === 'string' && content.metadata.includes('storyType')) ||
                     (typeof content.metadata === 'object' && content.metadata.storyType)
                   ));
    
    log(`🎬 ДЕТАЛЬНАЯ ПРОВЕРКА STORIES: Контент ${content.id}`, 'social-publishing');
    log(`  - content.content_type: ${content.content_type}`, 'social-publishing');
    log(`  - content.metadata: ${JSON.stringify(content.metadata)}`, 'social-publishing');
    log(`  - isStory результат: ${isStory}`, 'social-publishing');
    
    const webhookUrls = {
      'vk': `${baseN8nUrl}/webhook/publish-vk`,
      'telegram': `${baseN8nUrl}/webhook/publish-telegram`, 
      'instagram': isStory ? `${baseN8nUrl}/webhook/publish-stories` : `${baseN8nUrl}/webhook/publish-instagram`,
      'facebook': `${baseN8nUrl}/webhook/publish-facebook`,
      'youtube': `${baseN8nUrl}/webhook/publish-youtube`
    };
    
    log(`🎬 WEBHOOK ВЫБОР: ${platform} -> ${webhookUrls[platform as keyof typeof webhookUrls]}`, 'social-publishing');

    const webhookUrl = webhookUrls[platform as keyof typeof webhookUrls];
    
    if (!webhookUrl) {
      log(`Платформа ${platform} не поддерживается через n8n webhook`, 'social-publishing');
      return {
        platform,
        status: 'failed',
        publishedAt: null,
        error: `Platform ${platform} webhook not configured`
      };
    }

    try {
      log(`WEBHOOK ПУБЛИКАЦИЯ: Отправка запроса в ${platform} через n8n: ${webhookUrl}`, 'social-publishing');
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          contentId: content.id,
          platform: platform,
          settings: settings
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(`WEBHOOK ОШИБКА: ${platform} webhook вернул ${response.status}: ${errorText}`, 'social-publishing');
        return {
          platform,
          status: 'failed',
          publishedAt: null,
          error: `Webhook error: ${response.status} - ${errorText}`
        };
      }

      const result: any = await response.json();
      log(`WEBHOOK УСПЕХ: ${platform} вернул результат: ${JSON.stringify(result)}`, 'social-publishing');
      
      return {
        platform,
        status: result.success ? 'published' : 'failed',
        publishedAt: result.success ? new Date() : null,
        postUrl: result.postUrl || result.url || null,
        messageId: result.messageId || null,
        error: result.success ? null : (result.error || 'Unknown webhook error')
      };

    } catch (error: any) {
      log(`WEBHOOK ИСКЛЮЧЕНИЕ: ${platform} - ${error.message}`, 'social-publishing');
      return {
        platform,
        status: 'failed',
        publishedAt: null,
        error: `Webhook exception: ${error.message}`
      };
    }
  }

  /**
   * КРИТИЧЕСКОЕ УПРОЩЕНИЕ: n8n сам обновляет статус и postUrl после публикации
   * Этот метод больше не нужен для ВК, Telegram, Instagram
   * @param contentId ID контента
   * @param platform Социальная платформа  
   * @param publicationResult Результат публикации
   * @returns Обновленный контент или null в случае ошибки
   */
  public async updatePublicationStatus(
    contentId: string, 
    platform: string, 
    publicationResult: any
  ) {
    // ТОЛЬКО Facebook публикуется напрямую и требует обновления статуса
    // ВК, Telegram, Instagram: n8n сам обновляет статус и postUrl в базе
    if (platform === 'facebook') {
      return await facebookSocialService.updatePublicationStatus(contentId, platform, publicationResult);
    }
    
    // Для остальных платформ возвращаем результат как есть - n8n все сделает сам
    log(`N8N АВТООБНОВЛЕНИЕ: Платформа ${platform} - статус и postUrl обновит n8n`, 'social-publishing');
    return publicationResult;
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const socialPublishingService = new SocialPublishingService();