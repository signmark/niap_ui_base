import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { telegramService } from './telegram-service';
import { vkService } from './vk-service';
import { instagramService } from './instagram-service';
import { log } from '../../utils/logger';
import { publishScheduler } from '../publish-scheduler';

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
    platform: SocialPlatform | string,
    content: CampaignContent,
    campaign: any,
    authToken?: string
  ): Promise<SocialPublication & { messageId?: string | null, url?: string | null }> {
    // Убедимся, что платформа - строка, а не объект
    const platformString = typeof platform === 'object' ? 
      (platform.toString ? platform.toString() : JSON.stringify(platform)) : 
      platform as string;
    
    log(`Публикация контента в социальную сеть: ${platformString}`, 'social-publishing');
    
    try {
      // Проверяем, что campaign - это объект с настройками, а не обертка { settings: ... }
      let settings;
      
      if (campaign?.settings || campaign?.socialMediaSettings) {
        // Если передали обычный объект campaign с вложенными настройками
        settings = campaign?.socialMediaSettings || campaign?.settings || {};
        log(`Используем настройки из объекта campaign`, 'social-publishing');
      } else if (campaign) {
        // Если передали сами настройки напрямую
        settings = campaign;
        log(`Используем переданные напрямую настройки`, 'social-publishing');
      } else {
        // Если ничего не передали
        settings = {};
        log(`Настройки не найдены`, 'social-publishing');
      }
      
      // Выбираем соответствующий сервис в зависимости от платформы
      switch (platformString) {
        case 'telegram':
          return await telegramService.publishToPlatform(content, platformString as any, settings);
        
        case 'vk':
          return await vkService.publishToPlatform(content, platformString as any, settings);
        
        case 'instagram':
          return await instagramService.publishToPlatform(content, platformString as any, settings);
        
        // Для остальных платформ возвращаем ошибку
        default:
          log(`Платформа ${platformString} не поддерживается`, 'social-publishing');
          return {
            platform: platformString as any,
            status: 'failed',
            publishedAt: null,
            error: `Platform ${platformString} is not supported yet`
          };
      }
    } catch (error) {
      log(`Ошибка при публикации в ${platformString}: ${error}`, 'social-publishing');
      return {
        platform: platformString as any,
        status: 'failed',
        publishedAt: null,
        error: `Error: ${error instanceof Error ? error.message : String(error)}`
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
      
      default:
        log(`Платформа ${platform} не поддерживается для обновления статуса`, 'social-publishing');
        return null;
    }
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const socialPublishingService = new SocialPublishingService();