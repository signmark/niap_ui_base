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
    log(`Начинаем публикацию в Telegram. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
    
    if (!telegramSettings?.token || !telegramSettings?.chatId) {
      log(`Ошибка публикации в Telegram: отсутствуют настройки (токен или ID чата)`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Telegram (токен или ID чата)'
      };
    }

    try {
      const { token, chatId } = telegramSettings;
      log(`Публикация в Telegram. Чат: ${chatId}, Токен: ${token.substring(0, 6)}...`, 'social-publishing');

      // Подготовка сообщения
      let text = content.title ? `*${content.title}*\n\n` : '';
      text += content.content;

      // Добавление хэштегов
      if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
        text += '\n\n' + content.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      log(`Подготовлено сообщение для Telegram: ${text.substring(0, 50)}...`, 'social-publishing');

      // Разные методы API в зависимости от типа контента
      let response;
      const baseUrl = `https://api.telegram.org/bot${token}`;

      if (content.contentType === 'text') {
        // Отправка текстового сообщения
        log(`Отправка текстового сообщения в Telegram`, 'social-publishing');
        response = await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        });
      } else if ((content.contentType === 'text-image' || content.imageUrl) && content.imageUrl) {
        // Отправка изображения с подписью
        log(`Отправка изображения в Telegram с URL: ${content.imageUrl}`, 'social-publishing');
        // Проверяем формат URL изображения для Telegram
        let photoUrl = content.imageUrl;
        // Если URL не начинается с http, добавляем базовый URL сервера
        if (photoUrl && !photoUrl.startsWith('http')) {
          const baseAppUrl = process.env.BASE_URL || 'https://nplanner.replit.app';
          photoUrl = `${baseAppUrl}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
          log(`Изменен URL изображения для Telegram: ${photoUrl}`, 'social-publishing');
        }
        
        // Ограничиваем длину подписи, так как Telegram имеет ограничение
        const maxCaptionLength = 1024;
        const truncatedCaption = text.length > maxCaptionLength ? 
          text.substring(0, maxCaptionLength - 3) + '...' : 
          text;

        response = await axios.post(`${baseUrl}/sendPhoto`, {
          chat_id: chatId, 
          photo: photoUrl,
          caption: truncatedCaption,
          parse_mode: 'Markdown'
        });
      } else if ((content.contentType === 'video' || content.contentType === 'video-text') && content.videoUrl) {
        // Отправка видео с подписью
        log(`Отправка видео в Telegram с URL: ${content.videoUrl}`, 'social-publishing');
        response = await axios.post(`${baseUrl}/sendVideo`, {
          chat_id: chatId,
          video: content.videoUrl,
          caption: text,
          parse_mode: 'Markdown'
        });
      } else {
        // Неподдерживаемый тип контента
        log(`Неподдерживаемый тип контента для Telegram: ${content.contentType}`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Неподдерживаемый тип контента: ${content.contentType}`
        };
      }

      log(`Получен ответ от Telegram API: ${JSON.stringify(response.data)}`, 'social-publishing');

      // Обработка успешного ответа
      if (response.data.ok) {
        const message = response.data.result;
        log(`Успешная публикация в Telegram. Message ID: ${message.message_id}`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postId: message.message_id.toString(),
          postUrl: `https://t.me/c/${chatId.replace('-100', '')}/${message.message_id}`,
          userId: content.userId // Добавляем userId из контента
        };
      } else {
        log(`Ошибка в ответе Telegram API: ${response.data.description}`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Telegram API вернул ошибку: ${response.data.description}`,
          userId: content.userId // Добавляем userId из контента
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в Telegram: ${error.message}`,
        userId: content.userId // Добавляем userId из контента
      };
    }
  }

  /**
   * Публикует контент в VK
   * @param content Контент для публикации
   * @param vkSettings Настройки VK API
   * @returns Результат публикации
   */
  /**
   * Получает URL для загрузки фотографии в VK
   * @param token Токен доступа VK
   * @param groupId ID группы
   * @returns URL для загрузки фото или null в случае ошибки
   */
  private async getVkPhotoUploadUrl(token: string, groupId: string): Promise<string | null> {
    try {
      const params = {
        group_id: groupId, // ID группы без минуса
        access_token: token,
        v: '5.131'
      };

      // API метод для получения адреса сервера
      const response = await axios({
        method: 'get',
        url: 'https://api.vk.com/method/photos.getWallUploadServer',
        params
      });

      log(`Получен ответ для загрузки фото: ${JSON.stringify(response.data)}`, 'social-publishing');

      if (response.data.response && response.data.response.upload_url) {
        log(`Получен URL для загрузки фото: ${response.data.response.upload_url}`, 'social-publishing');
        return response.data.response.upload_url;
      } else if (response.data.error) {
        log(`Ошибка при получении URL для загрузки: ${JSON.stringify(response.data.error)}`, 'social-publishing');
        return null;
      }
      
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
      // Скачиваем изображение
      log(`Скачивание изображения с URL: ${imageUrl}`, 'social-publishing');
      const imageResponse = await axios({
        method: 'get',
        url: imageUrl,
        responseType: 'arraybuffer'
      });

      // Создаем FormData для отправки файла
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('photo', Buffer.from(imageResponse.data), 'image.jpg');
      
      // Загружаем на сервер VK
      log(`Загрузка фото на сервер VK по URL: ${uploadUrl}`, 'social-publishing');
      const uploadResponse = await axios({
        method: 'post',
        url: uploadUrl,
        data: formData,
        headers: formData.getHeaders()
      });

      log(`Ответ от сервера загрузки VK: ${JSON.stringify(uploadResponse.data)}`, 'social-publishing');
      return uploadResponse.data;
    } catch (error: any) {
      log(`Ошибка при загрузке фото на сервер VK: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке загрузки: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
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
      const params = {
        group_id: groupId, // ID группы без минуса
        server,
        photo: photoData,
        hash,
        access_token: token,
        v: '5.131'
      };

      // API метод для сохранения фото
      const response = await axios({
        method: 'post',
        url: 'https://api.vk.com/method/photos.saveWallPhoto',
        params
      });

      log(`Ответ от VK API при сохранении фото: ${JSON.stringify(response.data)}`, 'social-publishing');

      if (response.data.response && response.data.response.length > 0) {
        const photo = response.data.response[0];
        log(`Фото успешно сохранено в VK, ID: ${photo.id}`, 'social-publishing');
        return photo;
      } else if (response.data.error) {
        log(`Ошибка при сохранении фото: ${JSON.stringify(response.data.error)}`, 'social-publishing');
        return null;
      }
      
      return null;
    } catch (error: any) {
      log(`Ошибка при сохранении фото в VK: ${error.message}`, 'social-publishing');
      return null;
    }
  }

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
      log(`Публикация в VK. Группа: ${groupId}, Токен: ${token.substring(0, 6)}...`, 'social-publishing');

      // Подготовка сообщения
      let message = content.title ? `${content.title}\n\n` : '';
      message += content.content;

      // Добавление хэштегов
      if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
        message += '\n\n' + content.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }

      log(`Подготовлено сообщение для VK: ${message.substring(0, 50)}...`, 'social-publishing');

      // Обработка ID группы - удаляем префикс "club" если он есть
      let cleanGroupId = groupId;
      if (cleanGroupId.startsWith('club')) {
        cleanGroupId = cleanGroupId.replace('club', '');
        log(`Очищен ID группы от префикса 'club': ${cleanGroupId}`, 'social-publishing');
      }
      
      // Параметры для запроса публикации
      const requestData: any = {
        owner_id: `-${cleanGroupId}`, // Отрицательный ID для групп/сообществ
        from_group: 1, // Публикация от имени группы
        message: message,
        access_token: token,
        v: '5.131' // версия API
      };

      // Обработка прикрепленного изображения, если оно есть
      let attachments = '';
      if (content.imageUrl) {
        log(`Контент содержит изображение: ${content.imageUrl}`, 'social-publishing');
        
        // Получаем URL для загрузки фото
        const uploadUrl = await this.getVkPhotoUploadUrl(token, cleanGroupId);
        if (uploadUrl) {
          // Загружаем фото на сервер VK
          const uploadedPhoto = await this.uploadPhotoToVk(uploadUrl, content.imageUrl);
          
          if (uploadedPhoto && uploadedPhoto.server && uploadedPhoto.photo && uploadedPhoto.hash) {
            // Сохраняем фото в альбоме группы
            const savedPhoto = await this.savePhotoToVk(
              token, 
              cleanGroupId, 
              uploadedPhoto.server, 
              uploadedPhoto.photo, 
              uploadedPhoto.hash
            );
            
            if (savedPhoto) {
              // Формируем строку вложений для публикации
              attachments = `photo${savedPhoto.owner_id}_${savedPhoto.id}`;
              log(`Подготовлено вложение: ${attachments}`, 'social-publishing');
              requestData.attachments = attachments;
            } else {
              log(`Не удалось сохранить фото. Публикуем без изображения.`, 'social-publishing');
            }
          } else {
            log(`Не удалось загрузить фото. Публикуем без изображения.`, 'social-publishing');
          }
        } else {
          log(`Не удалось получить URL для загрузки фото. Публикуем без изображения.`, 'social-publishing');
        }
      }

      // Прямой запрос к VK API через form data для избежания ошибки 414 (URI Too Large)
      const apiUrl = 'https://api.vk.com/method/wall.post';
      log(`Отправка запроса к VK API: ${apiUrl}`, 'social-publishing');
      log(`Параметры запроса: ${JSON.stringify(requestData)}`, 'social-publishing');

      // Преобразуем объект в форму для отправки
      const FormData = require('form-data');
      const form = new FormData();
      
      // Добавляем все поля в форму
      Object.keys(requestData).forEach(key => {
        form.append(key, requestData[key]);
      });
      
      // Отправка запроса как form data вместо params в URL
      const response = await axios({
        method: 'post',
        url: apiUrl,
        data: form,
        headers: form.getHeaders()
      });

      log(`Получен ответ от VK API: ${JSON.stringify(response.data)}`, 'social-publishing');

      if (response.data.response && response.data.response.post_id) {
        log(`Успешная публикация в VK. Post ID: ${response.data.response.post_id}`, 'social-publishing');
        // Используем тот же очищенный ID группы для формирования URL поста
        return {
          platform: 'vk',
          status: 'published',
          publishedAt: new Date(),
          postId: response.data.response.post_id.toString(),
          postUrl: `https://vk.com/wall-${cleanGroupId}_${response.data.response.post_id}`,
          userId: content.userId // Добавляем userId из контента
        };
      } else if (response.data.error) {
        log(`Ошибка VK API: ${JSON.stringify(response.data.error)}`, 'social-publishing');
        return {
          platform: 'vk',
          status: 'failed',
          publishedAt: null,
          error: `VK API вернул ошибку: Код ${response.data.error.error_code} - ${response.data.error.error_msg}`,
          userId: content.userId // Добавляем userId из контента
        };
      } else {
        log(`Неизвестный формат ответа от VK API: ${JSON.stringify(response.data)}`, 'social-publishing');
        return {
          platform: 'vk',
          status: 'failed',
          publishedAt: null,
          error: `Неизвестный формат ответа от VK API: ${JSON.stringify(response.data)}`,
          userId: content.userId // Добавляем userId из контента
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации в VK: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'vk',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в VK: ${error.message}`,
        userId: content.userId // Добавляем userId из контента
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
      
      // Добавляем userId в publicationResult из content, если такой информации еще нет
      if (!publicationResult.userId && content.userId) {
        publicationResult.userId = content.userId;
        log(`Добавлен userId в publicationResult: ${content.userId}`, 'social-publishing');
      }

      // Создаем или обновляем статус публикации
      const socialPlatforms = content.socialPlatforms || {};
      
      // Используем безопасное приведение типов для предотвращения ошибок TypeScript
      const typedSocialPlatforms = socialPlatforms as Record<string, SocialPublication>;
      typedSocialPlatforms[platform] = publicationResult;

      // Обновляем статус в базе данных
      // Строим объект обновления, включая только существующие поля
      const updateObject: any = {
        socialPlatforms: typedSocialPlatforms,
        // Если все платформы опубликованы, обновляем статус контента
        status: this.checkAllPlatformsPublished(typedSocialPlatforms) ? 'published' : content.status
      };
      
      // Обновляем контент в базе данных
      await storage.updateCampaignContent(contentId, updateObject);

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