import axios from 'axios';
import { log } from '../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { storage } from '../storage';

/**
 * Сервис для публикации контента в социальные сети
 */
export class SocialPublishingService {
  /**
   * Публикует контент в Telegram
   * @param content Контент для публикации
   * @param telegramSettings Настройки Telegram API
   * @returns Результат публикации
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings: SocialMediaSettings['telegram']
  ): Promise<SocialPublication> {
    if (!telegramSettings?.token || !telegramSettings?.chatId) {
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Telegram (токен или ID чата)'
      };
    }

    try {
      const { token, chatId } = telegramSettings;

      // Подготовка сообщения
      let text = content.title ? `*${content.title}*\n\n` : '';
      text += content.content;

      // Добавление хэштегов
      if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
        text += '\n\n' + content.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }

      // Разные методы API в зависимости от типа контента
      let response;
      const baseUrl = `https://api.telegram.org/bot${token}`;

      if (content.contentType === 'text') {
        // Отправка текстового сообщения
        response = await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        });
      } else if (content.contentType === 'text-image' && content.imageUrl) {
        // Отправка изображения с подписью
        response = await axios.post(`${baseUrl}/sendPhoto`, {
          chat_id: chatId, 
          photo: content.imageUrl,
          caption: text,
          parse_mode: 'Markdown'
        });
      } else if ((content.contentType === 'video' || content.contentType === 'video-text') && content.videoUrl) {
        // Отправка видео с подписью
        response = await axios.post(`${baseUrl}/sendVideo`, {
          chat_id: chatId,
          video: content.videoUrl,
          caption: text,
          parse_mode: 'Markdown'
        });
      } else {
        // Неподдерживаемый тип контента
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Неподдерживаемый тип контента: ${content.contentType}`
        };
      }

      // Обработка успешного ответа
      if (response.data.ok) {
        const message = response.data.result;
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postId: message.message_id.toString(),
          postUrl: `https://t.me/c/${chatId.replace('-100', '')}/${message.message_id}`
        };
      } else {
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Telegram API вернул ошибку: ${response.data.description}`
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в Telegram: ${error.message}`
      };
    }
  }

  /**
   * Публикует контент в VK
   * @param content Контент для публикации
   * @param vkSettings Настройки VK API
   * @returns Результат публикации
   */
  async publishToVk(
    content: CampaignContent,
    vkSettings: SocialMediaSettings['vk']
  ): Promise<SocialPublication> {
    if (!vkSettings?.token || !vkSettings?.groupId) {
      return {
        platform: 'vk',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для VK (токен или ID группы)'
      };
    }

    try {
      const { token, groupId } = vkSettings;
      let attachments = '';

      // Подготовка сообщения
      let message = content.title ? `${content.title}\n\n` : '';
      message += content.content;

      // Добавление хэштегов
      if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
        message += '\n\n' + content.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }

      // Здесь должна быть логика загрузки изображений/видео на сервера ВК
      // В этой реализации мы просто указываем, что требуется дополнительная работа

      const params = new URLSearchParams({
        access_token: token,
        owner_id: `-${groupId}`, // минус для сообществ
        message,
        attachments,
        v: '5.131' // версия API
      });

      const response = await axios.post('https://api.vk.com/method/wall.post', params);

      if (response.data.response && response.data.response.post_id) {
        return {
          platform: 'vk',
          status: 'published',
          publishedAt: new Date(),
          postId: response.data.response.post_id.toString(),
          postUrl: `https://vk.com/wall-${groupId}_${response.data.response.post_id}`
        };
      } else {
        return {
          platform: 'vk',
          status: 'failed',
          publishedAt: null,
          error: `VK API вернул ошибку: ${JSON.stringify(response.data.error)}`
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации в VK: ${error.message}`, 'social-publishing');
      return {
        platform: 'vk',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в VK: ${error.message}`
      };
    }
  }

  /**
   * Публикует контент в Instagram
   * @param content Контент для публикации
   * @param instagramSettings Настройки Instagram API
   * @returns Результат публикации
   */
  async publishToInstagram(
    content: CampaignContent,
    instagramSettings: SocialMediaSettings['instagram']
  ): Promise<SocialPublication> {
    // Публикация в Instagram требует использования Facebook Graph API
    // Здесь упрощенная реализация для демонстрации
    return {
      platform: 'instagram',
      status: 'failed',
      publishedAt: null,
      error: 'Публикация в Instagram не реализована в данной версии'
    };
  }

  /**
   * Публикует контент в Facebook
   * @param content Контент для публикации
   * @param facebookSettings Настройки Facebook API
   * @returns Результат публикации
   */
  async publishToFacebook(
    content: CampaignContent,
    facebookSettings: SocialMediaSettings['facebook']
  ): Promise<SocialPublication> {
    // Публикация в Facebook требует использования Facebook Graph API
    // Здесь упрощенная реализация для демонстрации
    return {
      platform: 'facebook',
      status: 'failed',
      publishedAt: null,
      error: 'Публикация в Facebook не реализована в данной версии'
    };
  }

  /**
   * Публикует контент в указанную социальную платформу
   * @param content Контент для публикации
   * @param platform Социальная платформа
   * @param settings Настройки для социальных сетей
   * @returns Результат публикации
   */
  async publishToPlatform(
    content: CampaignContent,
    platform: SocialPlatform,
    settings: SocialMediaSettings
  ): Promise<SocialPublication> {
    log(`Публикация контента "${content.title}" в ${platform}`, 'social-publishing');

    switch (platform) {
      case 'telegram':
        return await this.publishToTelegram(content, settings.telegram);
      case 'vk':
        return await this.publishToVk(content, settings.vk);
      case 'instagram':
        return await this.publishToInstagram(content, settings.instagram);
      case 'facebook':
        return await this.publishToFacebook(content, settings.facebook);
      default:
        return {
          platform: platform as SocialPlatform,
          status: 'failed',
          publishedAt: null,
          error: `Неподдерживаемая платформа: ${platform}`
        };
    }
  }

  /**
   * Обновляет статус публикации контента в базе данных
   * @param contentId ID контента
   * @param platform Платформа
   * @param publicationResult Результат публикации
   */
  async updatePublicationStatus(
    contentId: string,
    platform: SocialPlatform,
    publicationResult: SocialPublication
  ): Promise<void> {
    try {
      // Получаем текущие данные о контенте
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        log(`Не удалось найти контент с ID ${contentId}`, 'social-publishing');
        return;
      }

      // Создаем или обновляем статус публикации
      const socialPlatforms = content.socialPlatforms || {};
      socialPlatforms[platform] = publicationResult;

      // Обновляем статус в базе данных
      await storage.updateCampaignContent(contentId, {
        socialPlatforms,
        // Если все платформы опубликованы, обновляем статус контента
        status: this.checkAllPlatformsPublished(socialPlatforms) ? 'published' : content.status,
        // Если это первая успешная публикация, устанавливаем дату публикации
        publishedAt: publicationResult.status === 'published' && !content.publishedAt ? 
          new Date() : content.publishedAt
      });

      log(
        `Статус публикации в ${platform} обновлен: ${publicationResult.status}`,
        'social-publishing'
      );
    } catch (error: any) {
      log(
        `Ошибка при обновлении статуса публикации: ${error.message}`,
        'social-publishing'
      );
    }
  }

  /**
   * Проверяет, все ли платформы опубликованы
   * @param socialPlatforms Статусы публикаций по платформам
   * @returns true, если все платформы опубликованы
   */
  private checkAllPlatformsPublished(socialPlatforms: Record<string, SocialPublication>): boolean {
    // Если платформ нет, то считаем, что все опубликовано
    if (Object.keys(socialPlatforms).length === 0) {
      return true;
    }

    // Проверяем, что хотя бы одна платформа не опубликована
    return Object.values(socialPlatforms).every(
      platform => platform.status === 'published'
    );
  }
}

export const socialPublishingService = new SocialPublishingService();