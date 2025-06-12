import { telegramService } from './telegram-service';
import { vkService } from './vk-service';
import { instagramService } from './instagram-service';
import { facebookSocialService } from './facebook';
import { log } from '../../utils/logger';
import { publishScheduler } from '../publish-scheduler';
import fetch from 'node-fetch';

/**
 * Единый сервис для публикации контента в различные социальные сети
 */
export class SocialPublishingService {
  /**
   * Получает токен для доступа к API
   * Делегирует получение токена модулю publishScheduler
   * 
   * @returns {Promise<string|null>} Токен для авторизации запросов к API
   */
  public async getSystemToken(): Promise<string | null> {
    return await publishScheduler.getSystemToken();
  }
  /**
   * Публикует контент в выбранную социальную платформу
   * @param content Контент для публикации
   * @param platform Социальная платформа
   * @param settings Настройки социальных сетей
   * @returns Результат публикации
   */
  public async publishToPlatform(
    platform: string,
    content: any,
    campaign: any,
    authToken?: string
  ): Promise<any> {
    log(`Публикация контента в ${platform}`, 'social-publishing');
    
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
        
        // Сбрасываем некорректные published статусы без postUrl
        if (platformData.status === 'published' && (!platformData.postUrl || platformData.postUrl.trim() === '')) {
          log(`ИСПРАВЛЕНИЕ: Сброс некорректного статуса 'published' без postUrl для платформы ${platform}`, 'social-publishing');
        }
      }
      
      // Получаем настройки социальных сетей из объекта кампании
      const settings = campaign.socialMediaSettings || campaign.settings || {};
      
      // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Все публикации только через n8n webhooks
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
    const webhookUrls = {
      'vk': 'https://n8n.nplanner.ru/webhook/publish-vk',
      'telegram': 'https://n8n.nplanner.ru/webhook/publish-telegram', 
      'instagram': 'https://n8n.nplanner.ru/webhook/publish-instagram'
    };

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

      const result = await response.json();
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
   * Обновляет статус публикации контента в социальной сети
   * @param contentId ID контента
   * @param platform Социальная платформа
   * @param publicationResult Результат публикации
   * @returns Обновленный контент или null в случае ошибки
   */
  public async updatePublicationStatus(
    contentId: string, 
    platform: SocialPlatform, 
    publicationResult: SocialPublication
  ) {
    switch (platform) {
      case 'telegram':
        return await telegramService.updatePublicationStatus(contentId, platform, publicationResult);
      
      case 'vk':
        return await vkService.updatePublicationStatus(contentId, platform, publicationResult);
      
      case 'instagram':
        return await instagramService.updatePublicationStatus(contentId, platform, publicationResult);
      
      case 'facebook':
        // Добавлен специальный обработчик для Facebook
        log(`Вызов специального обработчика для Facebook`, 'social-publishing');
        return await facebookSocialService.updatePublicationStatus(contentId, platform, publicationResult);
      
      default:
        log(`Платформа ${platform} не поддерживается для обновления статуса`, 'social-publishing');
        return null;
    }
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const socialPublishingService = new SocialPublishingService();