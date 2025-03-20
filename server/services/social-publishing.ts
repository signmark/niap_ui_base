import axios from 'axios';
import { log } from '../utils/logger';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { storage } from '../storage';

/**
 * Сервис для публикации контента в социальные сети
 */
export class SocialPublishingService {
  /**
   * Получает URL для загрузки фото в ВК
   * @param token Токен доступа к API VK
   * @param groupId ID группы (без знака минус)
   * @returns URL для загрузки или null в случае ошибки
   */
  async getVkPhotoUploadUrl(token: string, groupId: string): Promise<string | null> {
    try {
      const url = `https://api.vk.com/method/photos.getWallUploadServer?group_id=${groupId}&access_token=${token}&v=5.131`;
      
      const response = await axios.get(url);
      log(`Получен ответ на запрос URL для загрузки: ${JSON.stringify(response.data)}`, 'social-publishing');
      
      if (response.data.response && response.data.response.upload_url) {
        const uploadUrl = response.data.response.upload_url;
        log(`Получен URL для загрузки фото: ${uploadUrl}`, 'social-publishing');
        return uploadUrl;
      } else {
        log(`Ошибка при получении URL для загрузки: ${JSON.stringify(response.data)}`, 'social-publishing');
        return null;
      }
    } catch (error: any) {
      log(`Ошибка при получении URL для загрузки фото: ${error.message}`, 'social-publishing');
      return null;
    }
  }
  
  /**
   * Загружает фото на сервер VK
   * @param uploadUrl URL для загрузки
   * @param imageUrl URL изображения для загрузки
   * @returns Объект с результатом загрузки или null в случае ошибки
   */
  async uploadPhotoToVk(uploadUrl: string, imageUrl: string): Promise<any | null> {
    try {
      log(`Начинаем загрузку фото на сервер VK. URL изображения: ${imageUrl}`, 'social-publishing');
      
      // Получаем изображение
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      log(`Изображение успешно получено, размер: ${imageResponse.data.byteLength} байт`, 'social-publishing');
      
      // Создаем форму для загрузки
      const formData = new FormData();
      
      // Создаем Blob из arraybuffer и добавляем в FormData
      const blob = new Blob([imageResponse.data], { type: imageResponse.headers['content-type'] || 'image/jpeg' });
      formData.append('photo', blob, 'image.jpg');
      
      // Отправляем на сервер VK
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      log(`Ответ сервера загрузки VK: ${JSON.stringify(uploadResponse.data)}`, 'social-publishing');
      
      if (uploadResponse.data && uploadResponse.data.server) {
        return {
          server: uploadResponse.data.server,
          photo: uploadResponse.data.photo,
          hash: uploadResponse.data.hash
        };
      } else {
        log(`Некорректный ответ от сервера загрузки VK: ${JSON.stringify(uploadResponse.data)}`, 'social-publishing');
        return null;
      }
    } catch (error: any) {
      log(`Ошибка при загрузке фото на сервер VK: ${error.message}`, 'social-publishing');
      return null;
    }
  }
  
  /**
   * Сохраняет загруженное фото в альбом группы
   * @param token Токен доступа к API VK
   * @param groupId ID группы (без знака минус)
   * @param server Сервер из ответа на загрузку
   * @param photo Строка photo из ответа на загрузку
   * @param hash Хеш из ответа на загрузку
   * @returns Объект с информацией о сохраненном фото или null в случае ошибки
   */
  async savePhotoToVk(token: string, groupId: string, server: number, photo: string, hash: string): Promise<any | null> {
    try {
      // Формируем запрос для сохранения фото
      const urlParams = new URLSearchParams();
      urlParams.append('group_id', groupId);
      urlParams.append('server', server.toString());
      urlParams.append('photo', photo);
      urlParams.append('hash', hash);
      urlParams.append('access_token', token);
      urlParams.append('v', '5.131');
      
      // Отправляем запрос на сохранение
      const saveResponse = await axios.post('https://api.vk.com/method/photos.saveWallPhoto', urlParams, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      log(`Ответ на запрос сохранения фото: ${JSON.stringify(saveResponse.data)}`, 'social-publishing');
      
      if (saveResponse.data.response && saveResponse.data.response.length > 0) {
        const photoObj = saveResponse.data.response[0];
        log(`Фото успешно сохранено, ID: ${photoObj.id}, owner_id: ${photoObj.owner_id}`, 'social-publishing');
        return photoObj;
      } else {
        log(`Ошибка при сохранении фото: ${JSON.stringify(saveResponse.data)}`, 'social-publishing');
        return null;
      }
    } catch (error: any) {
      log(`Ошибка при сохранении фото в VK: ${error.message}`, 'social-publishing');
      return null;
    }
  }

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
    
    // Проверяем, что ID чата в правильном формате
    let formattedChatId = telegramSettings.chatId;
    
    // Если ID чата не начинается с '-', добавляем префикс для группового чата
    if (!formattedChatId.startsWith('-')) {
      formattedChatId = `-${formattedChatId}`;
      log(`ID чата отформатирован с префиксом: ${formattedChatId}`, 'social-publishing');
    }

    try {
      const { token } = telegramSettings;
      log(`Публикация в Telegram. Чат: ${formattedChatId}, Токен: ${token.substring(0, 6)}...`, 'social-publishing');

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

      if (content.contentType === 'text') {
        // Отправка текстового сообщения
        log(`Отправка текстового сообщения в Telegram с HTML`, 'social-publishing');
        response = await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: formattedChatId,
          text,
          parse_mode: 'HTML'
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
          chat_id: formattedChatId, 
          photo: photoUrl,
          caption: truncatedCaption,
          parse_mode: 'HTML'
        });
      } else if ((content.contentType === 'video' || content.contentType === 'video-text') && content.videoUrl) {
        // Отправка видео с подписью
        log(`Отправка видео в Telegram с URL: ${content.videoUrl}`, 'social-publishing');
        response = await axios.post(`${baseUrl}/sendVideo`, {
          chat_id: formattedChatId,
          video: content.videoUrl,
          caption: text,
          parse_mode: 'HTML'
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

      // Более простой подход - используем fs для создания временного файла
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      // Создаем временный файл
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, 'vk_upload_image.jpg');
      
      // Записываем данные изображения во временный файл
      fs.writeFileSync(tempFilePath, Buffer.from(imageResponse.data));
      
      // Создаем form-data для загрузки файла
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Добавляем файл в форму
      formData.append('photo', fs.createReadStream(tempFilePath));
      
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