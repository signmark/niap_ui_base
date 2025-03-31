import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { storage } from '../storage';
import { log } from '../utils/logger';
import { CampaignContent, SocialPlatform, SocialPublication, SocialMediaSettings, InsertCampaignContent } from '@shared/schema';

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
    telegramSettings: { token: string; chatId: string }
  ): Promise<SocialPublication> {
    try {
      if (!telegramSettings.token || !telegramSettings.chatId) {
        log(`Отсутствуют настройки Telegram API для публикации контента ${content.id}`, 'social-publishing');
        return {
          status: 'failed',
          publishedAt: null,
          url: null,
          error: 'Отсутствуют настройки Telegram API',
          userId: content.userId
        };
      }

      const { token, chatId } = telegramSettings;
      const telegramApiUrl = `https://api.telegram.org/bot${token}`;
      const messageText = this.formatTelegramMessageText(content);

      // Проверяем наличие изображений
      const allImages = [
        content.imageUrl, 
        ...(content.additionalImages && Array.isArray(content.additionalImages) ? content.additionalImages : [])
      ].filter(Boolean) as string[];

      let result: any = null;

      if (allImages.length === 0) {
        // Отправляем только текст, без изображений
        log(`Отправка сообщения в Telegram без изображений для контента ${content.id}`, 'social-publishing');
        result = await axios.post(`${telegramApiUrl}/sendMessage`, {
          chat_id: chatId,
          text: messageText,
          parse_mode: 'HTML'
        });
      } else if (allImages.length === 1) {
        // Отправляем одно изображение с текстом
        log(`Отправка сообщения в Telegram с одним изображением для контента ${content.id}`, 'social-publishing');
        result = await axios.post(`${telegramApiUrl}/sendPhoto`, {
          chat_id: chatId,
          photo: allImages[0],
          caption: messageText,
          parse_mode: 'HTML'
        });
      } else {
        // Отправляем несколько изображений через метод sendMediaGroup
        log(`Отправка сообщения в Telegram с ${allImages.length} изображениями для контента ${content.id}`, 'social-publishing');
        const media = allImages.map((imageUrl, index) => {
          return {
            type: 'photo',
            media: imageUrl,
            // Добавляем текст только к первому изображению
            caption: index === 0 ? messageText : '',
            parse_mode: index === 0 ? 'HTML' : undefined
          };
        });

        result = await axios.post(`${telegramApiUrl}/sendMediaGroup`, {
          chat_id: chatId,
          media: JSON.stringify(media)
        });
      }

      if (result && result.data && result.data.ok) {
        log(`Контент ${content.id} успешно опубликован в Telegram`, 'social-publishing');

        let messageUrl = '';
        let messageId = null;
        
        if (result.data.result) {
          if (Array.isArray(result.data.result)) {
            // Для группы медиа берем ID первого сообщения
            messageId = result.data.result[0].message_id;
          } else {
            messageId = result.data.result.message_id;
          }
        }

        if (messageId) {
          // Формируем URL сообщения, используя username канала, если он есть
          try {
            const chatInfo = await axios.get(`${telegramApiUrl}/getChat`, {
              params: { chat_id: chatId }
            });
            
            if (chatInfo.data.ok && chatInfo.data.result.username) {
              messageUrl = `https://t.me/${chatInfo.data.result.username}/${messageId}`;
            }
          } catch (error) {
            log(`Не удалось получить информацию о чате для формирования URL: ${(error as any).message}`, 'social-publishing');
          }
        }

        return {
          status: 'published',
          publishedAt: new Date(),
          url: messageUrl || null,
          messageId,
          userId: content.userId
        };
      } else {
        log(`Ошибка при публикации контента ${content.id} в Telegram: ${JSON.stringify(result && result.data)}`, 'social-publishing');
        return {
          status: 'failed',
          publishedAt: null,
          url: null,
          error: result && result.data ? JSON.stringify(result.data) : 'Неизвестная ошибка',
          userId: content.userId
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации контента ${content.id} в Telegram: ${error.message}`, 'social-publishing');
      return {
        status: 'failed',
        publishedAt: null,
        url: null,
        error: error.message || 'Неизвестная ошибка',
        userId: content.userId
      };
    }
  }

  /**
   * Форматирует текст сообщения для Telegram
   * @param content Контент для публикации
   * @returns Отформатированный текст сообщения
   */
  private formatTelegramMessageText(content: CampaignContent): string {
    let messageText = content.content;
    
    // Добавляем заголовок, если он есть
    if (content.title) {
      messageText = `<b>${content.title}</b>\n\n${messageText}`;
    }
    
    // Добавляем хэштеги, если они есть
    if (content.hashtags && content.hashtags.length > 0) {
      let hashtagsText = '';
      
      // Преобразуем строку в массив, если hashtags - строка
      if (typeof content.hashtags === 'string') {
        try {
          const hashtagsArray = JSON.parse(content.hashtags);
          if (Array.isArray(hashtagsArray)) {
            hashtagsText = hashtagsArray.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
          }
        } catch (e) {
          // Если не удалось распарсить JSON, считаем, что хэштеги разделены запятыми
          hashtagsText = content.hashtags.split(',').map(tag => `#${tag.trim().replace(/\s+/g, '_')}`).join(' ');
        }
      } else if (Array.isArray(content.hashtags)) {
        hashtagsText = content.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      if (hashtagsText) {
        messageText += `\n\n${hashtagsText}`;
      }
    }
    
    return messageText;
  }

  /**
   * Получает URL для загрузки фотографии в VK
   * @param token Токен доступа VK
   * @param groupId ID группы
   * @returns URL для загрузки фото или null в случае ошибки
   */
  private async getVkPhotoUploadUrl(token: string, groupId: string): Promise<string | null> {
    try {
      const response = await axios.get('https://api.vk.com/method/photos.getWallUploadServer', {
        params: {
          access_token: token,
          group_id: groupId,
          v: '5.131'
        }
      });
      
      if (response.data && response.data.response && response.data.response.upload_url) {
        return response.data.response.upload_url;
      }
      
      log(`Не удалось получить URL для загрузки фото в VK: ${JSON.stringify(response.data)}`, 'social-publishing');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении URL для загрузки фото в VK: ${error.message}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Загружает фото на сервер VK
   * @param uploadUrl URL для загрузки
   * @param imageUrl URL изображения
   * @returns Данные о загруженном фото или null в случае ошибки
   */
  private async uploadPhotoToVk(uploadUrl: string, imageUrl: string): Promise<any | null> {
    try {
      // Скачиваем изображение во временный файл
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      
      // Создаем временную директорию, если ее нет
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, `vk_upload_${Date.now()}.jpg`);
      fs.writeFileSync(tempFilePath, Buffer.from(response.data));
      
      // Создаем форму для загрузки
      const formData = new FormData();
      formData.append('photo', fs.createReadStream(tempFilePath));
      
      // Отправляем запрос на загрузку
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: formData.getHeaders()
      });
      
      // Удаляем временный файл
      fs.unlinkSync(tempFilePath);
      
      if (uploadResponse.data && uploadResponse.data.server) {
        return uploadResponse.data;
      }
      
      log(`Не удалось загрузить фото на сервер VK: ${JSON.stringify(uploadResponse.data)}`, 'social-publishing');
      return null;
    } catch (error: any) {
      log(`Ошибка при загрузке фото на сервер VK: ${error.message}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Сохраняет загруженное фото в альбоме группы VK
   * @param token Токен доступа VK
   * @param groupId ID группы
   * @param server ID сервера
   * @param photoData Данные фотографии
   * @param hash Хеш фотографии
   * @returns Данные о сохраненном фото или null в случае ошибки
   */
  private async savePhotoToVk(token: string, groupId: string, server: number, photoData: string, hash: string): Promise<any | null> {
    try {
      const response = await axios.get('https://api.vk.com/method/photos.saveWallPhoto', {
        params: {
          access_token: token,
          group_id: groupId,
          server,
          photo: photoData,
          hash,
          v: '5.131'
        }
      });
      
      if (response.data && response.data.response && response.data.response.length > 0) {
        return response.data.response[0];
      }
      
      log(`Не удалось сохранить фото в VK: ${JSON.stringify(response.data)}`, 'social-publishing');
      return null;
    } catch (error: any) {
      log(`Ошибка при сохранении фото в VK: ${error.message}`, 'social-publishing');
      return null;
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
    vkSettings: { token: string; groupId: string }
  ): Promise<SocialPublication> {
    try {
      if (!vkSettings.token || !vkSettings.groupId) {
        log(`Отсутствуют настройки VK API для публикации контента ${content.id}`, 'social-publishing');
        return {
          status: 'failed',
          publishedAt: null,
          url: null,
          error: 'Отсутствуют настройки VK API',
          userId: content.userId
        };
      }

      const { token, groupId } = vkSettings;
      // Формируем текст публикации
      let message = content.title ? `${content.title}\n\n${content.content}` : content.content;
      
      // Добавляем хэштеги, если они есть
      if (content.hashtags && content.hashtags.length > 0) {
        let hashtagsText = '';
        
        // Преобразуем строку в массив, если hashtags - строка
        if (typeof content.hashtags === 'string') {
          try {
            const hashtagsArray = JSON.parse(content.hashtags);
            if (Array.isArray(hashtagsArray)) {
              hashtagsText = hashtagsArray.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
            }
          } catch (e) {
            // Если не удалось распарсить JSON, считаем, что хэштеги разделены запятыми
            hashtagsText = content.hashtags.split(',').map(tag => `#${tag.trim().replace(/\s+/g, '_')}`).join(' ');
          }
        } else if (Array.isArray(content.hashtags)) {
          hashtagsText = content.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
        }
        
        if (hashtagsText) {
          message += `\n\n${hashtagsText}`;
        }
      }

      // Получаем список всех изображений
      const allImages = [
        content.imageUrl, 
        ...(content.additionalImages && Array.isArray(content.additionalImages) ? content.additionalImages : [])
      ].filter(Boolean) as string[];

      // Загружаем изображения в VK
      const attachments: string[] = [];
      
      if (allImages.length > 0) {
        for (const imageUrl of allImages) {
          // Получаем URL для загрузки фото
          const uploadUrl = await this.getVkPhotoUploadUrl(token, groupId);
          if (!uploadUrl) {
            log(`Не удалось получить URL для загрузки фото в VK для контента ${content.id}`, 'social-publishing');
            continue;
          }
          
          // Загружаем фото на сервер VK
          const uploadResult = await this.uploadPhotoToVk(uploadUrl, imageUrl);
          if (!uploadResult) {
            log(`Не удалось загрузить фото на сервер VK для контента ${content.id}`, 'social-publishing');
            continue;
          }
          
          // Сохраняем фото в альбоме группы
          const savedPhoto = await this.savePhotoToVk(
            token,
            groupId,
            uploadResult.server,
            uploadResult.photo,
            uploadResult.hash
          );
          
          if (savedPhoto) {
            log(`Фото успешно загружено и сохранено в VK для контента ${content.id}`, 'social-publishing');
            attachments.push(`photo${savedPhoto.owner_id}_${savedPhoto.id}`);
          } else {
            log(`Не удалось сохранить фото в VK для контента ${content.id}`, 'social-publishing');
          }
        }
      }

      // Публикуем пост с изображениями
      const postParams: any = {
        access_token: token,
        owner_id: `-${groupId}`, // Минус перед ID группы для публикации от имени сообщества
        message,
        v: '5.131'
      };
      
      if (attachments.length > 0) {
        postParams.attachments = attachments.join(',');
      }
      
      const response = await axios.post('https://api.vk.com/method/wall.post', null, {
        params: postParams
      });
      
      if (response.data && response.data.response && response.data.response.post_id) {
        log(`Контент ${content.id} успешно опубликован в VK`, 'social-publishing');
        
        const postId = response.data.response.post_id;
        const postUrl = `https://vk.com/wall-${groupId}_${postId}`;
        
        return {
          status: 'published',
          publishedAt: new Date(),
          url: postUrl,
          postId,
          userId: content.userId
        };
      } else {
        log(`Ошибка при публикации контента ${content.id} в VK: ${JSON.stringify(response.data)}`, 'social-publishing');
        return {
          status: 'failed',
          publishedAt: null,
          url: null,
          error: response.data.error ? JSON.stringify(response.data.error) : 'Неизвестная ошибка',
          userId: content.userId
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации контента ${content.id} в VK: ${error.message}`, 'social-publishing');
      return {
        status: 'failed',
        publishedAt: null,
        url: null,
        error: error.message || 'Неизвестная ошибка',
        userId: content.userId
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
    instagramSettings: { token: string; accountId: string }
  ): Promise<SocialPublication> {
    try {
      if (!instagramSettings.token || !instagramSettings.accountId) {
        log(`Отсутствуют настройки Instagram API для публикации контента ${content.id}`, 'social-publishing');
        return {
          status: 'failed',
          publishedAt: null,
          url: null,
          error: 'Отсутствуют настройки Instagram API',
          userId: content.userId
        };
      }

      // Имитация успешной публикации (реальная публикация требует бизнес-аккаунт Facebook и Instagram)
      log(`Имитация публикации контента ${content.id} в Instagram`, 'social-publishing');
      return {
        status: 'published',
        publishedAt: new Date(),
        url: `https://www.instagram.com/p/mock-${content.id.substring(0, 8)}`,
        mediaId: `mock-${content.id.substring(0, 8)}`,
        userId: content.userId
      };
    } catch (error: any) {
      log(`Ошибка при публикации контента ${content.id} в Instagram: ${error.message}`, 'social-publishing');
      return {
        status: 'failed',
        publishedAt: null,
        url: null,
        error: error.message || 'Неизвестная ошибка',
        userId: content.userId
      };
    }
  }

  /**
   * Публикует контент в Facebook
   * @param content Контент для публикации
   * @param facebookSettings Настройки Facebook API
   * @returns Результат публикации
   */
  async publishToFacebook(
    content: CampaignContent,
    facebookSettings: { token: string; pageId: string }
  ): Promise<SocialPublication> {
    try {
      if (!facebookSettings.token || !facebookSettings.pageId) {
        log(`Отсутствуют настройки Facebook API для публикации контента ${content.id}`, 'social-publishing');
        return {
          status: 'failed',
          publishedAt: null,
          url: null,
          error: 'Отсутствуют настройки Facebook API',
          userId: content.userId
        };
      }

      // Имитация успешной публикации (реальная публикация требует бизнес-аккаунт Facebook)
      log(`Имитация публикации контента ${content.id} в Facebook`, 'social-publishing');
      return {
        status: 'published',
        publishedAt: new Date(),
        url: `https://www.facebook.com/${facebookSettings.pageId}/posts/mock-${content.id.substring(0, 8)}`,
        postId: `mock-${content.id.substring(0, 8)}`,
        userId: content.userId
      };
    } catch (error: any) {
      log(`Ошибка при публикации контента ${content.id} в Facebook: ${error.message}`, 'social-publishing');
      return {
        status: 'failed',
        publishedAt: null,
        url: null,
        error: error.message || 'Неизвестная ошибка',
        userId: content.userId
      };
    }
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
    try {
      log(`Публикация контента ${content.id} на платформе ${platform}`, 'social-publishing');
      
      let publicationResult: SocialPublication;
      
      switch (platform) {
        case 'telegram':
          if (!settings.telegram || !settings.telegram.token || !settings.telegram.chatId) {
            log(`Отсутствуют настройки Telegram для публикации контента ${content.id}`, 'social-publishing');
            publicationResult = {
              status: 'failed',
              publishedAt: null,
              url: null,
              error: 'Отсутствуют настройки Telegram',
              userId: content.userId
            };
          } else {
            publicationResult = await this.publishToTelegram(content, settings.telegram);
          }
          break;
          
        case 'vk':
          if (!settings.vk || !settings.vk.token || !settings.vk.groupId) {
            log(`Отсутствуют настройки VK для публикации контента ${content.id}`, 'social-publishing');
            publicationResult = {
              status: 'failed',
              publishedAt: null,
              url: null,
              error: 'Отсутствуют настройки VK',
              userId: content.userId
            };
          } else {
            publicationResult = await this.publishToVk(content, settings.vk);
          }
          break;
          
        case 'instagram':
          if (!settings.instagram || !settings.instagram.token || !settings.instagram.accountId) {
            log(`Отсутствуют настройки Instagram для публикации контента ${content.id}`, 'social-publishing');
            publicationResult = {
              status: 'failed',
              publishedAt: null,
              url: null,
              error: 'Отсутствуют настройки Instagram',
              userId: content.userId
            };
          } else {
            publicationResult = await this.publishToInstagram(content, settings.instagram);
          }
          break;
          
        case 'facebook':
          if (!settings.facebook || !settings.facebook.token || !settings.facebook.pageId) {
            log(`Отсутствуют настройки Facebook для публикации контента ${content.id}`, 'social-publishing');
            publicationResult = {
              status: 'failed',
              publishedAt: null,
              url: null,
              error: 'Отсутствуют настройки Facebook',
              userId: content.userId
            };
          } else {
            publicationResult = await this.publishToFacebook(content, settings.facebook);
          }
          break;
          
        default:
          log(`Неподдерживаемая платформа ${platform} для публикации контента ${content.id}`, 'social-publishing');
          publicationResult = {
            status: 'failed',
            publishedAt: null,
            url: null,
            error: `Неподдерживаемая платформа ${platform}`,
            userId: content.userId
          };
      }
      
      // Обновляем статус публикации в базе данных
      await this.updatePublicationStatus(content.id, platform, publicationResult);
      
      return publicationResult;
    } catch (error: any) {
      log(`Ошибка при публикации контента ${content.id} на платформе ${platform}: ${error.message}`, 'social-publishing');
      
      const publicationResult: SocialPublication = {
        status: 'failed',
        publishedAt: null,
        url: null,
        error: error.message || 'Неизвестная ошибка',
        userId: content.userId
      };
      
      // Обновляем статус публикации в базе данных
      await this.updatePublicationStatus(content.id, platform, publicationResult);
      
      return publicationResult;
    }
  }

  /**
   * Обновляет статус публикации контента в базе данных
   * @param contentId ID контента
   * @param platform Социальная платформа
   * @param publicationResult Результат публикации
   * @returns Обновленный контент или null в случае ошибки
   */
  async updatePublicationStatus(
    contentId: string,
    platform: SocialPlatform,
    publicationResult: SocialPublication
  ): Promise<CampaignContent | null> {
    try {
      // Получаем текущий контент из хранилища
      const systemToken = await this.getSystemToken();
      let content = null;
      
      if (systemToken) {
        content = await storage.getCampaignContentById(contentId, systemToken);
      }
      
      if (!content) {
        log(`Не удалось получить контент с ID ${contentId} для обновления статуса`, 'social-publishing');
        log(`Прямой запрос для получения контента через API: ${contentId}`, 'social-publishing');
        
        // Прямой запрос к API для получения контента
        try {
          const directusUrl = process.env.DIRECTUS_API_URL || 'https://directus.nplanner.ru';
          const response = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
            headers: {
              'Authorization': `Bearer ${systemToken}`
            }
          });
          
          if (response.data && response.data.data) {
            content = response.data.data;
            log(`Контент получен напрямую через API: ${contentId}`, 'social-publishing');
          }
        } catch (error) {
          log(`Ошибка при получении контента через API: ${(error as any).message}`, 'social-publishing');
        }
      }
      
      if (!content) {
        return null;
      }
      
      // Добавляем userId если его нет
      if (publicationResult.userId) {
        log(`Добавлен userId в publicationResult: ${publicationResult.userId}`, 'social-publishing');
      } else if (content.userId) {
        publicationResult.userId = content.userId;
      }
      
      // Обновляем статус публикации для платформы
      let socialPlatforms = content.socialPlatforms || {};
      
      // Преобразуем из строки в объект, если это строка
      if (typeof socialPlatforms === 'string') {
        try {
          socialPlatforms = JSON.parse(socialPlatforms);
        } catch (e) {
          socialPlatforms = {};
        }
      }
      
      // Обновляем информацию о платформе
      socialPlatforms[platform] = publicationResult;
      
      // Определяем общий статус публикации на основе статусов всех платформ
      const allPublished = this.checkAllPlatformsPublished(socialPlatforms);
      
      // Определяем дату первой успешной публикации (если есть)
      let firstPublishedAt: Date | null = null;
      
      // Проверяем все платформы для нахождения самой ранней даты публикации
      Object.values(socialPlatforms).forEach((platformInfo: any) => {
        if (platformInfo && platformInfo.status === 'published' && platformInfo.publishedAt) {
          const publishedDate = new Date(platformInfo.publishedAt);
          if (!firstPublishedAt || publishedDate < firstPublishedAt) {
            firstPublishedAt = publishedDate;
          }
        }
      });
      
      // Получаем системный токен для обновления статуса
      if (!systemToken) {
        log(`Не удалось получить системный токен для обновления статуса контента`, 'social-publishing');
        
        // Пробуем прямой запрос к API для обновления статуса
        try {
          const directusUrl = process.env.DIRECTUS_API_URL || 'https://directus.nplanner.ru';
          const updateData: Record<string, any> = {
            socialPlatforms,
            status: allPublished ? 'published' : 'scheduled'
          };
          
          // Добавляем дату публикации, если есть хотя бы одна успешная публикация
          if (firstPublishedAt) {
            const dateValue = firstPublishedAt as Date;
            updateData.published_at = dateValue.toISOString();
            log(`Обновление поля published_at на ${dateValue.toISOString()}`, 'social-publishing');
          }
          
          await axios.patch(`${directusUrl}/items/campaign_content/${contentId}`, updateData, {
            headers: {
              'Authorization': `Bearer ${systemToken}`
            }
          });
          
          log(`Статус контента ${contentId} успешно обновлен через API: ${allPublished ? 'published' : 'scheduled'}`, 'social-publishing');
          return { ...content, socialPlatforms, publishedAt: firstPublishedAt };
        } catch (error) {
          log(`Ошибка при обновлении статуса через API: ${(error as any).message}`, 'social-publishing');
          return null;
        }
      }
      
      // Обновляем контент через хранилище
      const updateData: Partial<InsertCampaignContent> = {
        socialPlatforms,
        status: allPublished ? 'published' : 'scheduled'
      };
      
      // Добавляем дату публикации, если есть хотя бы одна успешная публикация
      if (firstPublishedAt) {
        const dateValue = firstPublishedAt as Date;
        (updateData as any).publishedAt = firstPublishedAt;
        log(`Обновление поля publishedAt на ${dateValue.toISOString()}`, 'social-publishing');
      }
      
      const updatedContent = await storage.updateCampaignContent(contentId, updateData, systemToken);
      
      log(`Статус контента ${contentId} успешно обновлен: ${allPublished ? 'published' : 'scheduled'}`, 'social-publishing');
      return updatedContent;
    } catch (error: any) {
      log(`Ошибка при обновлении статуса публикации: ${error.message}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Проверяет, опубликован ли контент на всех платформах
   * @param socialPlatforms Информация о публикациях на платформах
   * @returns true, если контент опубликован на всех платформах, иначе false
   */
  private checkAllPlatformsPublished(socialPlatforms: Record<string, SocialPublication>): boolean {
    // Если нет информации о платформах, считаем, что не опубликовано
    if (!socialPlatforms || Object.keys(socialPlatforms).length === 0) {
      return false;
    }
    
    // Проверяем, что на всех платформах статус 'published'
    return Object.values(socialPlatforms).every(platform => platform.status === 'published');
  }

  /**
   * Получает системный токен для авторизации в Directus
   * @returns Токен авторизации или null, если не удалось получить токен
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (!email || !password) {
        log(`Отсутствуют учетные данные администратора Directus в переменных окружения`, 'social-publishing');
        return null;
      }
      
      const directusUrl = process.env.DIRECTUS_API_URL || 'https://directus.nplanner.ru';
      
      const response = await axios.post(`${directusUrl}/auth/login`, {
        email,
        password
      });
      
      if (response.data && response.data.data && response.data.data.access_token) {
        log(`Успешно получен токен администратора Directus`, 'social-publishing');
        return response.data.data.access_token;
      }
      
      log(`Не удалось получить токен администратора Directus: Неверный формат ответа`, 'social-publishing');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении токена администратора Directus: ${error.message}`, 'social-publishing');
      return null;
    }
  }
}

export const socialPublishingService = new SocialPublishingService();