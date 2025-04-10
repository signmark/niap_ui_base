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
      let settings: any = {};
      
      // Подробные логи для отладки
      log(`Структура объекта campaign: ${JSON.stringify(campaign).substring(0, 200)}`, 'social-publishing');
      
      if (campaign) {
        if (campaign.socialMediaSettings) {
          settings = campaign.socialMediaSettings;
          log(`Найдены настройки в campaign.socialMediaSettings`, 'social-publishing');
        } else if (campaign.settings) {
          settings = campaign.settings;
          log(`Найдены настройки в campaign.settings`, 'social-publishing');
        } else if (typeof campaign === 'object') {
          // Пытаемся найти настройки в объекте напрямую
          if (campaign.telegram || campaign.vk || campaign.instagram) {
            settings = campaign;
            log(`Найдены настройки напрямую в объекте campaign`, 'social-publishing');
          }
        }
      }
      
      log(`Полученные настройки социальных сетей: ${JSON.stringify(settings).substring(0, 200)}`, 'social-publishing');
      
      // Проверяем настройки для конкретной платформы
      let platformSettings: any = null;
      
      switch (platform as SocialPlatform) {
        case 'telegram':
          // Проверяем различные варианты размещения настроек
          if (settings.telegram) {
            platformSettings = settings.telegram;
          } else if (settings.telegram_bot_token && settings.telegram_chat_id) {
            platformSettings = settings;
          }
          
          log(`Настройки для Telegram: ${JSON.stringify(platformSettings || 'не найдены')}`, 'social-publishing');
          
          if (!platformSettings || (!platformSettings.token && !platformSettings.telegram_bot_token)) {
            log(`Отсутствуют настройки для Telegram`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Missing Telegram settings`
            };
          }
          
          log(`Вызов telegramService.publishToPlatform с платформой как строкой: "${platform}"`, 'social-publishing');
          return await telegramService.publishToPlatform(content, 'telegram' as SocialPlatform, platformSettings);
        
        case 'vk':
          // Проверяем различные варианты размещения настроек
          if (settings.vk) {
            platformSettings = settings.vk;
          } else if (settings.vk_access_token && settings.vk_group_id) {
            platformSettings = settings;
          }
          
          log(`Настройки для VK: ${JSON.stringify(platformSettings || 'не найдены')}`, 'social-publishing');
          
          if (!platformSettings) {
            log(`Отсутствуют настройки для VK`, 'social-publishing');
            return {
              platform: 'vk',
              status: 'failed',
              publishedAt: null,
              error: `Missing VK settings`
            };
          }
          
          log(`Вызов vkService.publishToPlatform с платформой как строкой: "${platform}"`, 'social-publishing');
          return await vkService.publishToPlatform(content, 'vk' as SocialPlatform, platformSettings);
        
        case 'instagram':
          // Проверяем различные варианты размещения настроек
          if (settings.instagram) {
            platformSettings = settings.instagram;
          } else if (settings.instagram_access_token || settings.instagram_business_account_id) {
            platformSettings = settings;
          }
          
          log(`Настройки для Instagram: ${JSON.stringify(platformSettings || 'не найдены')}`, 'social-publishing');
          
          if (!platformSettings) {
            log(`Отсутствуют настройки для Instagram`, 'social-publishing');
            return {
              platform: 'instagram',
              status: 'failed',
              publishedAt: null,
              error: `Missing Instagram settings`
            };
          }
          
          log(`Вызов instagramService.publishToPlatform с платформой как строкой: "${platform}"`, 'social-publishing');
          return await instagramService.publishToPlatform(content, 'instagram' as SocialPlatform, platformSettings);
        
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