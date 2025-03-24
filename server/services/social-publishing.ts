import axios from 'axios';
import { log } from '../utils/logger';
import { CampaignContent, InsertCampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { storage } from '../storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';

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
    telegramSettings?: SocialMediaSettings['telegram']
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
      log(`Публикация в Telegram. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
      log(`Публикация в Telegram. Чат: ${chatId}, Токен: ${token.substring(0, 6)}...`, 'social-publishing');

      // Правильное форматирование ID чата
      let formattedChatId = chatId;
      if (!chatId.startsWith('-100') && !isNaN(Number(chatId))) {
        formattedChatId = `-100${chatId}`;
        log(`Переформатирован ID чата для Telegram: ${formattedChatId}`, 'social-publishing');
      }

      // Подготовка сообщения с сохранением HTML-форматирования
      let text = content.title ? `<b>${content.title}</b>\n\n` : '';
      
      // Telegram поддерживает только ограниченный набор HTML-тегов
      // Нужно преобразовать HTML-теги к поддерживаемому Telegram формату
      let contentText = content.content
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.*?)<\/p>/g, '$1\n')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '<b>$1</b>\n')
        .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
        .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
        .replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/g, '<a href="$1">$2</a>')
        .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
        .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>');
      
      // Удаляем все оставшиеся неподдерживаемые HTML-теги
      contentText = contentText.replace(/<(?!\/?(b|i|code|pre|s|u|a)(?=>|\s.*>))[^>]*>/g, '');
      
      text += contentText;

      // Добавление хэштегов
      if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
        text += '\n\n' + content.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      log(`Подготовлено сообщение для Telegram: ${text.substring(0, 50)}...`, 'social-publishing');

      // Разные методы API в зависимости от типа контента
      let response;
      const baseUrl = `https://api.telegram.org/bot${token}`;

      // Проверяем доступность изображения
      const hasImage = content.imageUrl && typeof content.imageUrl === 'string' && content.imageUrl.trim() !== '';
      
      // Проверяем доступность видео
      const hasVideo = content.videoUrl && typeof content.videoUrl === 'string' && content.videoUrl.trim() !== '';
      
      // Решение о методе публикации на основе доступности медиа и типа контента
      if (hasImage) {
        // Отправка изображения с подписью
        log(`Отправка изображения в Telegram для типа ${content.contentType} с URL: ${content.imageUrl}`, 'social-publishing');
        
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
          chat_id: formattedChatId, 
          photo: photoUrl,
          caption: truncatedCaption,
          parse_mode: 'HTML'
        });
      } else if (hasVideo) {
        // Отправка видео с подписью
        log(`Отправка видео в Telegram для типа ${content.contentType} с URL: ${content.videoUrl}`, 'social-publishing');
        response = await axios.post(`${baseUrl}/sendVideo`, {
          chat_id: formattedChatId,
          video: content.videoUrl,
          caption: text,
          parse_mode: 'HTML'
        });
      } else if (content.contentType === 'text' || !content.contentType) {
        // Отправка текстового сообщения (по умолчанию)
        log(`Отправка текстового сообщения в Telegram с HTML`, 'social-publishing');
        response = await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: formattedChatId,
          text,
          parse_mode: 'HTML'
        });
      } else {
        // Неподдерживаемый формат - пробуем отправить текст как запасной вариант
        log(`Для типа контента ${content.contentType} не найдены медиа. Отправляем как текст`, 'social-publishing');
        try {
          response = await axios.post(`${baseUrl}/sendMessage`, {
            chat_id: formattedChatId,
            text,
            parse_mode: 'HTML'
          });
        } catch (error) {
          log(`Неподдерживаемый тип контента для Telegram: ${content.contentType}`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Неподдерживаемый тип контента: ${content.contentType}`
          };
        }
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
          postUrl: `https://t.me/c/${formattedChatId.replace('-100', '')}/${message.message_id}`,
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

      // Создаем временный файл на сервере
      const tempFilePath = path.join(os.tmpdir(), `vk_upload_${Date.now()}.jpg`);
      log(`Создаем временный файл: ${tempFilePath}`, 'social-publishing');
      
      // Сохраняем изображение во временный файл
      fs.writeFileSync(tempFilePath, Buffer.from(imageResponse.data));
      
      // Создаем форму для загрузки файла
      const formData = new FormData();
      formData.append('photo', fs.createReadStream(tempFilePath));
      
      // Выполняем запрос на загрузку на сервер ВК
      log(`Загрузка файла на сервер ВК по URL: ${uploadUrl}`, 'social-publishing');
      
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: formData.getHeaders()
      });
      
      // Удаляем временный файл после загрузки
      fs.unlinkSync(tempFilePath);
      log(`Временный файл удален: ${tempFilePath}`, 'social-publishing');
      
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

  /**
   * Публикует контент в VK
   * @param content Контент для публикации
   * @param vkSettings Настройки VK API
   * @returns Результат публикации
   */
  async publishToVk(
    content: CampaignContent,
    vkSettings?: SocialMediaSettings['vk']
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
      
      // Преобразовываем HTML-теги в VK-разметку
      // VK использует разные API для форматирования. Мы можем только переносы строк и эмодзи сохранить
      let contentText = content.content
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.*?)<\/p>/g, '$1\n')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '$1\n');
      
      // Убираем все HTML-теги, но сохраняем их содержимое
      contentText = contentText.replace(/<\/?[^>]+(>|$)/g, '');
      message += contentText;

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
        
        try {
          // Используем правильный подход для загрузки изображения в VK
          log(`Загружаем изображение на сервер VK`, 'social-publishing');
          
          // Шаг 1: Получаем URL сервера для загрузки изображения
          const uploadUrl = await this.getVkPhotoUploadUrl(token, cleanGroupId);
          
          if (!uploadUrl) {
            log(`Не удалось получить URL для загрузки фото, публикуем без изображения`, 'social-publishing');
          } else {
            // Шаг 2: Загружаем фото на сервер VK
            const uploadResult = await this.uploadPhotoToVk(uploadUrl, content.imageUrl);
            
            if (!uploadResult) {
              log(`Ошибка при загрузке фото на сервер VK, публикуем без изображения`, 'social-publishing');
            } else {
              // Шаг 3: Сохраняем фото в альбом группы
              const photo = await this.savePhotoToVk(
                token, 
                cleanGroupId, 
                uploadResult.server, 
                uploadResult.photo, 
                uploadResult.hash
              );
              
              if (photo) {
                // Формируем attachment в нужном формате photo{owner_id}_{photo_id}
                const attachment = `photo${photo.owner_id}_${photo.id}`;
                requestData.attachment = attachment;
                log(`Фото успешно загружено, добавлено в пост: ${attachment}`, 'social-publishing');
              } else {
                log(`Не удалось сохранить фото в альбом VK, публикуем без изображения`, 'social-publishing');
              }
            }
          }
        } catch (error: any) {
          log(`Ошибка при подготовке изображения для VK: ${error.message}`, 'social-publishing');
          log(`Публикуем пост без изображения`, 'social-publishing');
        }
      }

      // Прямой запрос к VK API через form data для избежания ошибки 414 (URI Too Large)
      const apiUrl = 'https://api.vk.com/method/wall.post';
      log(`Отправка запроса к VK API: ${apiUrl}`, 'social-publishing');
      log(`Параметры запроса: ${JSON.stringify(requestData)}`, 'social-publishing');

      // Вместо формы данных отправляем обычный запрос с URL-кодированными данными
      // Новый подход без FormData, который вызывал ошибку require
      const urlEncodedData = new URLSearchParams();
      
      // Добавляем все поля в запрос
      Object.keys(requestData).forEach(key => {
        urlEncodedData.append(key, requestData[key]);
      });
      
      // Отправка запроса как обычная форма
      const response = await axios({
        method: 'post',
        url: apiUrl,
        data: urlEncodedData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
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
    instagramSettings?: SocialMediaSettings['instagram']
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
    facebookSettings?: SocialMediaSettings['facebook']
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
            updateData.published_at = firstPublishedAt.toISOString();
            log(`Обновление поля published_at на ${firstPublishedAt.toISOString()}`, 'social-publishing');
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
        (updateData as any).publishedAt = firstPublishedAt;
        log(`Обновление поля publishedAt на ${firstPublishedAt.toISOString()}`, 'social-publishing');
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