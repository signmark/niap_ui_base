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
    platformInput: SocialPlatform | any,
    content: CampaignContent,
    campaign: any,
    authToken?: string
  ): Promise<SocialPublication & { messageId?: string | null, url?: string | null }> {
    // Нормализуем имя платформы - объект преобразуем в строку
    const platform = typeof platformInput === 'string' 
      ? platformInput as SocialPlatform
      : (platformInput && platformInput.toString ? platformInput.toString() : String(platformInput));
      
    log(`Публикация контента в ${platform} (тип: ${typeof platform})`, 'social-publishing');
    
    try {
      // Получаем настройки социальных сетей из объекта кампании
      const settings = campaign.socialMediaSettings || campaign.settings || {};
      
      // Выбираем соответствующий сервис в зависимости от платформы
      // ИСПРАВЛЕНО: Порядок параметров должен соответствовать сигнатуре метода
      // Параметры должны быть: контент, строка с названием платформы, настройки
      switch (platform as SocialPlatform) {
        case 'telegram':
          log(`Вызов telegramService.publishToPlatform с платформой как строкой: "${platform}"`, 'social-publishing');
          return await telegramService.publishToPlatform(content, 'telegram' as SocialPlatform, settings);
        
        case 'vk':
          log(`Вызов vkService.publishToPlatform с платформой как строкой: "${platform}"`, 'social-publishing');
          return await vkService.publishToPlatform(content, 'vk' as SocialPlatform, settings);
        
        case 'instagram':
          log(`Вызов instagramService.publishToPlatform с платформой как строкой: "${platform}"`, 'social-publishing');
          return await instagramService.publishToPlatform(content, 'instagram' as SocialPlatform, settings);
        
        // Для остальных платформ возвращаем ошибку
        default:
          log(`Платформа ${platform} не поддерживается`, 'social-publishing');
          return {
            platform,
            status: 'failed',
            publishedAt: null,
            error: `Platform ${platform} is not supported yet`
          };
      }
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
   * Обновляет статус публикации контента в социальной сети
   * @param contentId ID контента
   * @param platform Социальная платформа
   * @param publicationResult Результат публикации
   * @returns Обновленный контент или null в случае ошибки
   */
  public async updatePublicationStatus(
    contentId: string, 
    platformInput: SocialPlatform | any, 
    publicationResult: SocialPublication
  ) {
    // Нормализуем имя платформы - объект преобразуем в строку
    const platform = typeof platformInput === 'string' 
      ? platformInput as SocialPlatform
      : (platformInput && platformInput.toString ? platformInput.toString() : String(platformInput));
      
    log(`Обновление статуса публикации для платформы ${platform} (тип: ${typeof platform})`, 'social-publishing');
    
    // ИСПРАВЛЕНО: Обработка строковой платформы и безопасное приведение к типу
    switch (platform as SocialPlatform) {
      case 'telegram':
        log(`Вызов telegramService.updatePublicationStatus с платформой как строкой: "telegram"`, 'social-publishing');
        return await telegramService.updatePublicationStatus(contentId, 'telegram' as SocialPlatform, publicationResult);
      
      case 'vk':
        log(`Вызов vkService.updatePublicationStatus с платформой как строкой: "vk"`, 'social-publishing');
        return await vkService.updatePublicationStatus(contentId, 'vk' as SocialPlatform, publicationResult);
      
      case 'instagram':
        log(`Вызов instagramService.updatePublicationStatus с платформой как строкой: "instagram"`, 'social-publishing');
        return await instagramService.updatePublicationStatus(contentId, 'instagram' as SocialPlatform, publicationResult);
      
      default:
        log(`Платформа ${platform} не поддерживается для обновления статуса`, 'social-publishing');
        return null;
    }
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const socialPublishingService = new SocialPublishingService();