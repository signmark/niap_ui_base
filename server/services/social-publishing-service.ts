import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { getOptimizedImagePath } from './cdn-service';

// Типы поддерживаемых социальных платформ
export type SocialPlatform = 'telegram' | 'vk' | 'instagram' | 'facebook';

// Интерфейс результата публикации
export interface PublishResult {
  success: boolean;
  platformId: SocialPlatform;
  messageId?: string | number;
  url?: string;
  error?: string;
}

/**
 * Сервис для публикации контента в социальные сети
 */
export class SocialPublishingService {
  private telegramToken: string;
  private telegramChatId: string;
  private vkToken: string;
  private vkGroupId: string;
  
  constructor() {
    // Инициализация из переменных окружения
    this.telegramToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID || '';
    this.vkToken = process.env.VK_TOKEN || '';
    this.vkGroupId = process.env.VK_GROUP_ID || '';
    
    // Логирование статуса подключения к соцсетям
    if (this.telegramToken && this.telegramChatId) {
      logger.info('[SocialPublishing] Telegram publishing is available');
    } else {
      logger.warn('[SocialPublishing] Telegram publishing is not available. Missing credentials.');
    }
    
    if (this.vkToken && this.vkGroupId) {
      logger.info('[SocialPublishing] VK publishing is available');
    } else {
      logger.warn('[SocialPublishing] VK publishing is not available. Missing credentials.');
    }
  }
  
  /**
   * Публикует контент в указанную социальную сеть
   * 
   * @param platform Социальная платформа для публикации
   * @param content Объект с текстом и медиа для публикации
   * @returns Результат публикации
   */
  async publishContent(
    platform: SocialPlatform,
    content: {
      text: string;
      image?: string | null;
      additionalImages?: (string | null)[];
      video?: string | null;
    }
  ): Promise<PublishResult> {
    try {
      logger.info(`[SocialPublishing] Publishing to ${platform}`);
      
      switch (platform) {
        case 'telegram':
          return await this.publishToTelegram(content);
        case 'vk':
          return await this.publishToVk(content);
        case 'instagram':
          return await this.publishToInstagram(content);
        case 'facebook':
          return await this.publishToFacebook(content);
        default:
          return {
            success: false,
            platformId: platform,
            error: `Платформа ${platform} не поддерживается`
          };
      }
    } catch (error) {
      logger.error(`[SocialPublishing] Error publishing to ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        platformId: platform,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }
  
  /**
   * Публикует контент в Telegram
   * 
   * @param content Объект с текстом и медиа для публикации
   * @returns Результат публикации
   */
  private async publishToTelegram(content: {
    text: string;
    image?: string | null;
    additionalImages?: (string | null)[];
    video?: string | null;
  }): Promise<PublishResult> {
    if (!this.telegramToken || !this.telegramChatId) {
      logger.error('[SocialPublishing] Telegram credentials not set');
      return {
        success: false,
        platformId: 'telegram',
        error: 'Не настроены учетные данные Telegram. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID'
      };
    }
    
    try {
      // Определяем тип публикации на основе наличия медиафайлов
      if (content.image) {
        // Если есть изображение, отправляем его с подписью
        const localPath = getOptimizedImagePath(content.image, 1280); // Оптимизируем для публикации
        
        // Если есть дополнительные изображения, отправляем медиагруппу
        if (content.additionalImages && content.additionalImages.length > 0) {
          // Создаем массив всех изображений (основное + дополнительные)
          const allImages = [content.image, ...content.additionalImages];
          
          // Фильтруем null и undefined значения
          const validImages = allImages.filter(Boolean) as string[];
          
          if (validImages.length > 1) {
            return await this.publishMediaGroupToTelegram(validImages, content.text);
          }
        }
        
        // Если только одно изображение, отправляем с текстом
        const form = new FormData();
        form.append('chat_id', this.telegramChatId);
        form.append('photo', fs.createReadStream(localPath));
        
        // Telegram API ограничивает подпись 1024 символами
        if (content.text.length > 1024) {
          // Отправляем отдельно фото и отдельно текст
          const photoResponse = await axios.post(
            `https://api.telegram.org/bot${this.telegramToken}/sendPhoto`,
            form,
            { headers: form.getHeaders() }
          );
          
          const textResponse = await axios.post(
            `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
            {
              chat_id: this.telegramChatId,
              text: content.text,
              parse_mode: 'HTML'
            }
          );
          
          return {
            success: true,
            platformId: 'telegram',
            messageId: photoResponse.data.result.message_id
          };
        } else {
          // Текст помещается в подпись к фото
          form.append('caption', content.text);
          form.append('parse_mode', 'HTML');
          
          const response = await axios.post(
            `https://api.telegram.org/bot${this.telegramToken}/sendPhoto`,
            form,
            { headers: form.getHeaders() }
          );
          
          return {
            success: true,
            platformId: 'telegram',
            messageId: response.data.result.message_id
          };
        }
      } else if (content.video) {
        // Если есть видео, отправляем его с подписью
        const localPath = content.video.startsWith('/') 
          ? path.join(process.cwd(), content.video) 
          : content.video;
          
        const form = new FormData();
        form.append('chat_id', this.telegramChatId);
        form.append('video', fs.createReadStream(localPath));
        
        // Telegram API ограничивает подпись 1024 символами
        if (content.text.length <= 1024) {
          form.append('caption', content.text);
          form.append('parse_mode', 'HTML');
        }
        
        const response = await axios.post(
          `https://api.telegram.org/bot${this.telegramToken}/sendVideo`,
          form,
          { headers: form.getHeaders() }
        );
        
        // Если текст не помещается в подпись, отправляем отдельным сообщением
        if (content.text.length > 1024) {
          await axios.post(
            `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
            {
              chat_id: this.telegramChatId,
              text: content.text,
              parse_mode: 'HTML'
            }
          );
        }
        
        return {
          success: true,
          platformId: 'telegram',
          messageId: response.data.result.message_id
        };
      } else {
        // Если нет медиафайлов, отправляем только текст
        const response = await axios.post(
          `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
          {
            chat_id: this.telegramChatId,
            text: content.text,
            parse_mode: 'HTML'
          }
        );
        
        return {
          success: true,
          platformId: 'telegram',
          messageId: response.data.result.message_id
        };
      }
    } catch (error) {
      logger.error(`[SocialPublishing] Telegram publishing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (axios.isAxiosError(error) && error.response) {
        logger.error(`[SocialPublishing] Telegram API response: ${JSON.stringify(error.response.data)}`);
        return {
          success: false,
          platformId: 'telegram',
          error: `Ошибка API Telegram: ${JSON.stringify(error.response.data)}`
        };
      }
      
      return {
        success: false,
        platformId: 'telegram',
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }
  
  /**
   * Публикует группу медиафайлов в Telegram
   * 
   * @param images Массив путей к изображениям
   * @param text Текст публикации (будет отправлен отдельным сообщением)
   * @returns Результат публикации
   */
  private async publishMediaGroupToTelegram(images: string[], text: string): Promise<PublishResult> {
    try {
      // Максимальное количество фото в медиагруппе - 10
      const limitedImages = images.slice(0, 10);
      
      // Создаем массив InputMediaPhoto
      const media = limitedImages.map((image, index) => {
        // Оптимизируем изображение
        const localPath = getOptimizedImagePath(image, 1280);
        
        return {
          type: 'photo',
          media: `attach://photo${index}`,
          // Добавляем подпись только к первому фото и только если текст не слишком длинный
          ...(index === 0 && text.length <= 1024 ? { 
            caption: text,
            parse_mode: 'HTML'
          } : {})
        };
      });
      
      // Создаем FormData для отправки
      const form = new FormData();
      form.append('chat_id', this.telegramChatId);
      form.append('media', JSON.stringify(media));
      
      // Добавляем файлы
      limitedImages.forEach((image, index) => {
        const localPath = getOptimizedImagePath(image, 1280);
        form.append(`photo${index}`, fs.createReadStream(localPath));
      });
      
      // Отправляем группу медиафайлов
      const response = await axios.post(
        `https://api.telegram.org/bot${this.telegramToken}/sendMediaGroup`,
        form,
        { headers: form.getHeaders() }
      );
      
      // Если текст слишком длинный или не помещается в подпись, отправляем отдельным сообщением
      if (text.length > 1024) {
        await axios.post(
          `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
          {
            chat_id: this.telegramChatId,
            text: text,
            parse_mode: 'HTML'
          }
        );
      }
      
      return {
        success: true,
        platformId: 'telegram',
        messageId: response.data.result[0].message_id
      };
    } catch (error) {
      logger.error(`[SocialPublishing] Telegram media group publishing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (axios.isAxiosError(error) && error.response) {
        logger.error(`[SocialPublishing] Telegram API response: ${JSON.stringify(error.response.data)}`);
        return {
          success: false,
          platformId: 'telegram',
          error: `Ошибка API Telegram: ${JSON.stringify(error.response.data)}`
        };
      }
      
      return {
        success: false,
        platformId: 'telegram',
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }
  
  /**
   * Публикует контент в ВКонтакте
   * 
   * @param content Объект с текстом и медиа для публикации
   * @returns Результат публикации
   */
  private async publishToVk(content: {
    text: string;
    image?: string | null;
    additionalImages?: (string | null)[];
    video?: string | null;
  }): Promise<PublishResult> {
    if (!this.vkToken || !this.vkGroupId) {
      logger.error('[SocialPublishing] VK credentials not set');
      return {
        success: false,
        platformId: 'vk',
        error: 'Не настроены учетные данные ВКонтакте. Проверьте переменные окружения VK_TOKEN и VK_GROUP_ID'
      };
    }
    
    try {
      // Базовые параметры для публикации
      const params = {
        owner_id: `-${this.vkGroupId}`, // Минус означает ID группы, а не пользователя
        from_group: 1, // Публикация от имени группы
        message: content.text,
        access_token: this.vkToken,
        v: '5.131' // Версия API
      };
      
      // Если есть изображения, сначала загружаем их на сервер ВК
      let attachments = '';
      
      if (content.image) {
        // Создаем массив всех изображений (основное + дополнительные)
        const allImages = content.additionalImages ? 
          [content.image, ...content.additionalImages] : 
          [content.image];
        
        // Фильтруем null и undefined значения
        const validImages = allImages.filter(Boolean) as string[];
        
        // Загружаем изображения на сервер ВК и формируем строку вложений
        if (validImages.length > 0) {
          // Получаем URL для загрузки фотографий
          const uploadUrlResponse = await axios.get(
            `https://api.vk.com/method/photos.getWallUploadServer`, 
            { params: { access_token: this.vkToken, group_id: this.vkGroupId, v: '5.131' } }
          );
          
          const uploadUrl = uploadUrlResponse.data.response.upload_url;
          
          // Загружаем изображения и сохраняем их в ВК
          const photoAttachments = await Promise.all(
            validImages.map(async (image) => {
              // Оптимизируем изображение
              const localPath = getOptimizedImagePath(image, 1280);
              
              // Создаем FormData для загрузки
              const formData = new FormData();
              formData.append('photo', fs.createReadStream(localPath));
              
              // Загружаем на сервер ВК
              const uploadResponse = await axios.post(
                uploadUrl, 
                formData,
                { headers: formData.getHeaders() }
              );
              
              // Сохраняем фотографию в альбоме
              const saveResponse = await axios.get(
                `https://api.vk.com/method/photos.saveWallPhoto`, 
                { 
                  params: { 
                    access_token: this.vkToken, 
                    group_id: this.vkGroupId,
                    v: '5.131',
                    server: uploadResponse.data.server,
                    photo: uploadResponse.data.photo,
                    hash: uploadResponse.data.hash
                  } 
                }
              );
              
              // Формируем строку вложения для этой фотографии
              const photo = saveResponse.data.response[0];
              return `photo${photo.owner_id}_${photo.id}`;
            })
          );
          
          // Формируем строку вложений
          attachments = photoAttachments.join(',');
        }
      }
      
      // Если есть видео, добавляем его к вложениям
      if (content.video) {
        // Здесь нужно реализовать загрузку видео в ВК
        // Это достаточно сложный процесс, который требует дополнительных API-вызовов
        logger.warn('[SocialPublishing] VK video upload not implemented yet');
      }
      
      // Публикуем запись на стену группы
      const response = await axios.get(
        `https://api.vk.com/method/wall.post`,
        { 
          params: { 
            ...params,
            attachments
          } 
        }
      );
      
      return {
        success: true,
        platformId: 'vk',
        messageId: response.data.response.post_id,
        url: `https://vk.com/wall-${this.vkGroupId}_${response.data.response.post_id}`
      };
    } catch (error) {
      logger.error(`[SocialPublishing] VK publishing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (axios.isAxiosError(error) && error.response) {
        logger.error(`[SocialPublishing] VK API response: ${JSON.stringify(error.response.data)}`);
        return {
          success: false,
          platformId: 'vk',
          error: `Ошибка API ВКонтакте: ${JSON.stringify(error.response.data)}`
        };
      }
      
      return {
        success: false,
        platformId: 'vk',
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }
  
  /**
   * Публикует контент в Instagram
   * 
   * @param content Объект с текстом и медиа для публикации
   * @returns Результат публикации
   */
  private async publishToInstagram(content: {
    text: string;
    image?: string | null;
    additionalImages?: (string | null)[];
    video?: string | null;
  }): Promise<PublishResult> {
    // Этот метод будет реализован позже, когда будут доступны соответствующие API-ключи
    logger.warn('[SocialPublishing] Instagram publishing not implemented yet');
    return {
      success: false,
      platformId: 'instagram',
      error: 'Публикация в Instagram пока не реализована'
    };
  }
  
  /**
   * Публикует контент в Facebook
   * 
   * @param content Объект с текстом и медиа для публикации
   * @returns Результат публикации
   */
  private async publishToFacebook(content: {
    text: string;
    image?: string | null;
    additionalImages?: (string | null)[];
    video?: string | null;
  }): Promise<PublishResult> {
    // Этот метод будет реализован позже, когда будут доступны соответствующие API-ключи
    logger.warn('[SocialPublishing] Facebook publishing not implemented yet');
    return {
      success: false,
      platformId: 'facebook',
      error: 'Публикация в Facebook пока не реализована'
    };
  }
}

// Создаем и экспортируем единственный экземпляр сервиса
export const socialPublishingService = new SocialPublishingService();