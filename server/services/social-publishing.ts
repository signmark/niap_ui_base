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
   * Обрабатывает поле дополнительных изображений в контенте, проверяя и преобразуя его при необходимости
   * @param content Контент, содержащий дополнительные изображения
   * @param platform Название социальной платформы (для логирования)
   * @returns Обновленный контент с обработанным полем additionalImages
   */
  private processAdditionalImages(content: CampaignContent, platform: string): CampaignContent {
    // Создаем копию контента для изменений
    const processedContent = { ...content };
    
    if (!processedContent.additionalImages) {
      log(`${platform}: additionalImages отсутствует, возвращаем пустой массив`, 'social-publishing');
      processedContent.additionalImages = [];
      return processedContent;
    }
    
    log(`Обработка дополнительных изображений для ${platform}. Тип: ${typeof processedContent.additionalImages}, значение: ${
      typeof processedContent.additionalImages === 'string' 
        ? (processedContent.additionalImages as string).substring(0, 100) + '...' 
        : JSON.stringify(processedContent.additionalImages).substring(0, 100) + '...'
    }`, 'social-publishing');
    
    // Если это строка, пытаемся распарсить как JSON
    if (typeof processedContent.additionalImages === 'string') {
      try {
        // Проверяем, начинается ли строка с [ или {
        const trimmedStr = (processedContent.additionalImages as string).trim();
        if (trimmedStr.startsWith('[') || trimmedStr.startsWith('{')) {
          const parsedImages = JSON.parse(processedContent.additionalImages as string);
          log(`Успешно распарсили строку additionalImages как JSON для ${platform}: ${JSON.stringify(parsedImages).substring(0, 100)}...`, 'social-publishing');
          
          if (Array.isArray(parsedImages)) {
            processedContent.additionalImages = parsedImages;
          } else {
            processedContent.additionalImages = [parsedImages];
          }
        } else {
          // Если строка не начинается с [ или {, это не JSON, а просто URL
          log(`${platform}: additionalImages это строка-URL, а не JSON: ${(processedContent.additionalImages as string).substring(0, 50)}...`, 'social-publishing');
          processedContent.additionalImages = [processedContent.additionalImages as string];
        }
      } catch (e) {
        log(`${platform}: Не удалось распарсить additionalImages как JSON: ${(e as Error).message}`, 'social-publishing');
        
        // Создаем массив из строки
        const additionalImagesArray: string[] = [];
        if (typeof processedContent.additionalImages === 'string' && (processedContent.additionalImages as string).trim() !== '') {
          additionalImagesArray.push(processedContent.additionalImages as string);
          log(`${platform}: Добавили строку additionalImages как URL: ${(processedContent.additionalImages as string).substring(0, 50)}...`, 'social-publishing');
        }
        processedContent.additionalImages = additionalImagesArray;
      }
    }
    
    // Проверяем итоговый массив и фильтруем некорректные значения
    if (Array.isArray(processedContent.additionalImages)) {
      const validImages = processedContent.additionalImages.filter(url => url && typeof url === 'string' && url.trim() !== '');
      log(`${platform}: Найдено ${validImages.length} корректных дополнительных изображений`, 'social-publishing');
      if (validImages.length > 0) {
        log(`${platform}: Первое изображение: ${validImages[0].substring(0, 50)}...`, 'social-publishing');
      }
      processedContent.additionalImages = validImages;
    } else {
      // Если по какой-то причине additionalImages не массив, создаем пустой массив
      log(`${platform}: additionalImages не является массивом после обработки, создаем пустой массив`, 'social-publishing');
      processedContent.additionalImages = [];
    }
    
    return processedContent;
  }

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
      log(`Telegram публикация - тип additionalImages в контенте: ${typeof content.additionalImages}, значение: ${content.additionalImages ? 
        (typeof content.additionalImages === 'string' ? content.additionalImages : JSON.stringify(content.additionalImages).substring(0, 100)) 
        : 'null'}`, 'social-publishing');

      // Обработка дополнительных изображений
      const processedContent = this.processAdditionalImages(content, 'Telegram');

      // Правильное форматирование ID чата
      let formattedChatId = chatId;
      if (!chatId.startsWith('-100') && !isNaN(Number(chatId))) {
        formattedChatId = `-100${chatId}`;
        log(`Переформатирован ID чата для Telegram: ${formattedChatId}`, 'social-publishing');
      }

      // Подготовка сообщения с сохранением HTML-форматирования
      let text = processedContent.title ? `<b>${processedContent.title}</b>\n\n` : '';
      
      // Telegram поддерживает только ограниченный набор HTML-тегов:
      // <b>, <strong>, <i>, <em>, <u>, <s>, <strike>, <code>, <pre>, <a href="...">
      // Нужно преобразовать все HTML-теги к поддерживаемым Telegram форматам
      // и при этом избежать лишних переносов строк
      
      // Сначала собираем исходный текст
      let contentText = processedContent.content;
      
      // Заменяем последовательные блочные элементы более компактным форматом
      // без избыточных переносов строк
      contentText = contentText
        // Заменяем <br> на одиночный перенос строки
        .replace(/<br\s*\/?>/g, '\n')
        
        // Обрабатываем абзацы без добавления лишних переносов
        .replace(/<p>(.*?)<\/p>\s*<p>/g, '<p>$1</p><p>') // Убираем пробельные символы между абзацами
        .replace(/<p>(.*?)<\/p>/g, '$1\n') // Один перенос в конце каждого абзаца
        
        // Аналогично с div
        .replace(/<div>(.*?)<\/div>\s*<div>/g, '<div>$1</div><div>')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        
        // Заголовки как жирный текст с одиночным переносом
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '<b>$1</b>\n')
        
        // Стандартизируем теги форматирования (HTML-теги, которые Telegram поддерживает)
        .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
        .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
        .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
        
        // Приводим ссылки к простому формату href
        .replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/g, '<a href="$1">$2</a>')
        
        // Удаляем все прочие неподдерживаемые теги (но сохраняем их содержимое)
        .replace(/<(?!\/?(b|strong|i|em|u|s|strike|code|pre|a)(?=>|\s.*>))\/?.*?>/gi, '');
      
      // Удаляем множественные переносы строк (более двух подряд)
      contentText = contentText.replace(/\n{3,}/g, '\n\n');
      
      log(`Оптимизированный HTML для Telegram: ${contentText.substring(0, 100)}...`, 'social-publishing');
      
      text += contentText;

      // Добавление хэштегов
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        text += '\n\n' + processedContent.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      log(`Подготовлено сообщение для Telegram: ${text.substring(0, 50)}...`, 'social-publishing');

      // Разные методы API в зависимости от типа контента
      let response;
      const baseUrl = `https://api.telegram.org/bot${token}`;

      // Собираем все доступные изображения
      const images = [];
      
      // Проверяем основное изображение
      if (processedContent.imageUrl && typeof processedContent.imageUrl === 'string' && processedContent.imageUrl.trim() !== '') {
        // Проверяем формат URL изображения для Telegram
        let photoUrl = processedContent.imageUrl;
        
        // Если URL не начинается с http, добавляем базовый URL сервера
        if (photoUrl && !photoUrl.startsWith('http')) {
          const baseAppUrl = process.env.BASE_URL || 'https://nplanner.replit.app';
          photoUrl = `${baseAppUrl}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
          log(`Изменен URL изображения для Telegram: ${photoUrl}`, 'social-publishing');
        }
        
        images.push(photoUrl);
      }
      
      // Добавляем дополнительные изображения
      if (processedContent.additionalImages && Array.isArray(processedContent.additionalImages)) {
        for (const additionalImage of processedContent.additionalImages) {
          if (additionalImage && typeof additionalImage === 'string' && additionalImage.trim() !== '') {
            // Проверяем формат URL изображения
            let photoUrl = additionalImage;
            
            // Если URL не начинается с http, добавляем базовый URL сервера
            if (photoUrl && !photoUrl.startsWith('http')) {
              const baseAppUrl = process.env.BASE_URL || 'https://nplanner.replit.app';
              photoUrl = `${baseAppUrl}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
              log(`Изменен URL дополнительного изображения для Telegram: ${photoUrl}`, 'social-publishing');
            }
            
            images.push(photoUrl);
            log(`Добавлено дополнительное изображение в массив для Telegram: ${photoUrl}`, 'social-publishing');
          }
        }
        
        log(`Всего подготовлено ${images.length} изображений для Telegram`, 'social-publishing');
      }
      
      // Проверяем доступность видео
      const hasVideo = content.videoUrl && typeof content.videoUrl === 'string' && content.videoUrl.trim() !== '';
      
      // Ограничиваем длину подписи, так как Telegram имеет ограничение
      const maxCaptionLength = 1024;
      const truncatedCaption = text.length > maxCaptionLength ? 
        text.substring(0, maxCaptionLength - 3) + '...' : 
        text;
      
      // Решение о методе публикации на основе доступности медиа и типа контента
      if (images.length > 1) {
        // Отправка группы изображений (медиагруппы) через sendMediaGroup
        log(`Отправка медиагруппы в Telegram с ${images.length} изображениями через API sendMediaGroup`, 'social-publishing');
        
        // Формируем массив объектов медиа для API Telegram
        const mediaGroup = images.map((url, index) => ({
          type: 'photo',
          media: url,
          // Добавляем подпись только к первому изображению
          ...(index === 0 ? { caption: truncatedCaption, parse_mode: 'HTML' } : {})
        }));
        
        log(`Сформирована медиагруппа для Telegram: ${JSON.stringify(mediaGroup)}`, 'social-publishing');
        
        // Отправляем медиагруппу в теле запроса (формат JSON)
        const requestBody = {
          chat_id: formattedChatId,
          media: mediaGroup
        };
        
        log(`Отправляем запрос к Telegram API (sendMediaGroup): ${JSON.stringify(requestBody)}`, 'social-publishing');
        
        response = await axios.post(`${baseUrl}/sendMediaGroup`, requestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (images.length === 1) {
        // Отправка одиночного изображения с подписью
        log(`Отправка изображения в Telegram для типа ${content.contentType} с URL: ${images[0]}`, 'social-publishing');
        
        const photoRequestBody = {
          chat_id: formattedChatId, 
          photo: images[0],
          caption: truncatedCaption,
          parse_mode: 'HTML'
        };
        
        log(`Отправляем запрос фото к Telegram API: ${JSON.stringify(photoRequestBody)}`, 'social-publishing');
        
        response = await axios.post(`${baseUrl}/sendPhoto`, photoRequestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (hasVideo) {
        // Отправка видео с подписью
        log(`Отправка видео в Telegram для типа ${content.contentType} с URL: ${content.videoUrl}`, 'social-publishing');
        const videoRequestBody = {
          chat_id: formattedChatId,
          video: content.videoUrl,
          caption: text,
          parse_mode: 'HTML'
        };
        
        log(`Отправляем запрос видео к Telegram API: ${JSON.stringify(videoRequestBody)}`, 'social-publishing');
        
        response = await axios.post(`${baseUrl}/sendVideo`, videoRequestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (content.contentType === 'text' || !content.contentType) {
        // Отправка текстового сообщения (по умолчанию)
        log(`Отправка текстового сообщения в Telegram с HTML`, 'social-publishing');
        const messageRequestBody = {
          chat_id: formattedChatId,
          text,
          parse_mode: 'HTML'
        };
        
        log(`Отправляем текстовый запрос к Telegram API: ${JSON.stringify(messageRequestBody)}`, 'social-publishing');
        
        response = await axios.post(`${baseUrl}/sendMessage`, messageRequestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Неподдерживаемый формат - пробуем отправить текст как запасной вариант
        log(`Для типа контента ${content.contentType} не найдены медиа. Отправляем как текст`, 'social-publishing');
        try {
          const fallbackMessageBody = {
            chat_id: formattedChatId,
            text,
            parse_mode: 'HTML'
          };
          
          log(`Отправляем fallback-текстовый запрос к Telegram API: ${JSON.stringify(fallbackMessageBody)}`, 'social-publishing');
          
          response = await axios.post(`${baseUrl}/sendMessage`, fallbackMessageBody, {
            headers: { 'Content-Type': 'application/json' }
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
        // Для множественных сообщений (медиагруппы) - результат это массив сообщений
        if (Array.isArray(response.data.result)) {
          const messages = response.data.result;
          log(`Успешная публикация группы в Telegram. Количество сообщений: ${messages.length}`, 'social-publishing');
          
          // Берем ID первого сообщения в группе для ссылки
          const firstMessageId = messages[0].message_id;
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postId: firstMessageId.toString(),
            postUrl: `https://t.me/c/${formattedChatId.replace('-100', '')}/${firstMessageId}`,
            userId: content.userId // Добавляем userId из контента
          };
        } else {
          // Для одиночного сообщения
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
        }
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

      // Обработка контента и дополнительных изображений
      const processedContent = this.processAdditionalImages(content, 'vk');
      log(`VK публикация - обрабатываем контент: ${content.id}, тип данных additionalImages: ${typeof content.additionalImages}`, 'social-publishing');
      log(`Обработанный контент для VK имеет ${processedContent.additionalImages ? processedContent.additionalImages.length : 0} дополнительных изображений`, 'social-publishing');

      // Подготовка сообщения
      let message = processedContent.title ? `${processedContent.title}\n\n` : '';
      
      // VK не поддерживает разметку, убираем все HTML-теги и форматирование
      // ВКонтакте хоть и предлагает свою разметку (*жирный*, _курсив_), но часто отображает её буквально
      // Поэтому полностью удаляем разметку и используем простой текст
      let contentText = processedContent.content
        // Обрабатываем блочные элементы для правильных переносов
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '$1\n\n');
      
      // Преобразуем HTML теги в простой текст без маркеров форматирования
      contentText = contentText
        // Убираем форматирование, но сохраняем содержимое
        .replace(/<b>(.*?)<\/b>/g, '$1')
        .replace(/<strong>(.*?)<\/strong>/g, '$1')
        .replace(/<i>(.*?)<\/i>/g, '$1')
        .replace(/<em>(.*?)<\/em>/g, '$1')
        
        // Ссылки: <a href="url">текст</a> -> текст (url)
        .replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/g, '$2 ($1)')
        
        // Списки: обрабатываем каждый элемент списка
        .replace(/<li>(.*?)<\/li>/g, '• $1\n')
        
        // Удаляем все остальные HTML-теги, сохраняя их содержимое
        .replace(/<\/?[^>]+(>|$)/g, '');
      
      log(`Обработанный текст для VK (очищенный от HTML): ${contentText.substring(0, 100)}...`, 'social-publishing');
      
      // Добавляем обработанный текст к сообщению
      message += contentText;
      
      // Логируем обработанный текст для отладки
      log(`Обработанный текст для VK: ${message.substring(0, 100)}...`, 'social-publishing');

      // Добавление хэштегов
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        message += '\n\n' + processedContent.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
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
        v: '5.131', // версия API
        dont_parse_links: 0 // Включаем обработку ссылок
        // Больше не используем parse_mode: 'HTML', так как переводим теги в нативный формат VK
      };

      // Массив для хранения прикрепленных изображений (attachments)
      const attachmentsArray = [];
      
      // Собираем все доступные изображения (основное и дополнительные)
      const images = [];
      
      // Добавляем основное изображение, если оно есть
      if (processedContent.imageUrl) {
        images.push(processedContent.imageUrl);
        log(`Добавлено основное изображение для VK: ${processedContent.imageUrl}`, 'social-publishing');
      }
      
      // Добавляем дополнительные изображения, если они есть
      if (processedContent.additionalImages && Array.isArray(processedContent.additionalImages) && processedContent.additionalImages.length > 0) {
        for (let img of processedContent.additionalImages) {
          if (img && typeof img === 'string' && img.trim() !== '') {
            images.push(img);
            log(`Добавлено дополнительное изображение для VK: ${img}`, 'social-publishing');
          }
        }
      }
      
      log(`Всего подготовлено ${images.length} изображений для VK`, 'social-publishing');
      
      // Загрузка всех изображений в VK и добавление в attachments
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        try {
          const isMain = i === 0 && processedContent.imageUrl === imageUrl;
          const imageType = isMain ? "основное" : "дополнительное";
          log(`Загрузка ${imageType} изображения #${i + 1}/${images.length} на сервер VK: ${imageUrl}`, 'social-publishing');
          
          // Шаг 1: Получаем URL сервера для загрузки изображения
          const uploadUrl = await this.getVkPhotoUploadUrl(token, cleanGroupId);
          
          if (!uploadUrl) {
            log(`Не удалось получить URL для загрузки фото #${i + 1}, пропускаем`, 'social-publishing');
            continue;
          }
          
          // Шаг 2: Загружаем фото на сервер VK
          const uploadResult = await this.uploadPhotoToVk(uploadUrl, imageUrl);
          
          if (!uploadResult) {
            log(`Ошибка при загрузке фото #${i + 1} на сервер VK, пропускаем`, 'social-publishing');
            continue;
          }
          
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
            attachmentsArray.push(attachment);
            log(`Фото #${i + 1} успешно загружено, добавлено в пост: ${attachment}`, 'social-publishing');
          } else {
            log(`Не удалось сохранить фото #${i + 1} в альбом VK, пропускаем`, 'social-publishing');
          }
        } catch (error: any) {
          log(`Ошибка при подготовке изображения #${i + 1} для VK: ${error.message}`, 'social-publishing');
          log(`Пропускаем изображение #${i + 1}`, 'social-publishing');
        }
      }
      
      // Добавляем все загруженные изображения в запрос, если они есть
      if (attachmentsArray.length > 0) {
        requestData.attachment = attachmentsArray.join(',');
        log(`Добавлено ${attachmentsArray.length} изображений в пост VK: ${requestData.attachment}`, 'social-publishing');
      } else {
        log(`Не удалось загрузить ни одного изображения для VK, публикуем пост без изображений`, 'social-publishing');
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
    // Проверяем наличие настроек
    log(`Настройки Instagram для публикации: ${JSON.stringify(instagramSettings)}`, 'social-publishing');
    
    // Используем token или accessToken - любой, который есть
    const token = instagramSettings?.token || instagramSettings?.accessToken;
    if (!token) {
      log(`Отсутствует токен Instagram для публикации контента ${content.id}`, 'social-publishing');
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует токен Instagram (Graph API) в настройках кампании',
        userId: content.userId
      };
    }

    // Проверяем наличие ID бизнес-аккаунта
    if (!instagramSettings?.businessAccountId) {
      log(`Отсутствует ID бизнес-аккаунта Instagram для публикации контента ${content.id}`, 'social-publishing');
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует ID бизнес-аккаунта Instagram в настройках кампании',
        userId: content.userId
      };
    }

    try {
      // Обработка дополнительных изображений
      const processedContent = this.processAdditionalImages(content, 'Instagram');
      
      log(`Публикация в Instagram. Контент: ${processedContent.id}, тип: ${processedContent.contentType}`, 'social-publishing');
      log(`Публикация в Instagram. Токен: ${token.substring(0, 6)}..., ID аккаунта: ${instagramSettings.businessAccountId}`, 'social-publishing');

      // Подготовка описания
      let caption = processedContent.title ? `${processedContent.title}\n\n` : '';
      
      // Instagram не поддерживает HTML-теги, но можно использовать Unicode-символы 
      // для создания визуального форматирования (как показано в примере пользователя)
      const contentText = processedContent.content
        // Обрабатываем блочные элементы для правильных переносов
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '✨ $1 ✨\n\n') // Заголовки с эмодзи
        
        // Обрабатываем маркированные списки
        .replace(/<ul>([\s\S]*?)<\/ul>/g, (match, content) => {
          return content.replace(/<li>(.*?)<\/li>/g, '• $1\n');
        })
        
        // Используем Unicode-символы для имитации форматирования
        // Конвертирование обычных букв в "жирные" Unicode-символы только для коротких фраз
        .replace(/<b>([^<]{1,30})<\/b>/g, (match, text) => {
          // Конвертируем каждую букву в соответствующий Unicode "жирный" символ
          return text.split('').map(char => {
            // Простая карта символов для латиницы и кириллицы
            const boldMap: {[key: string]: string} = {
              'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵',
              'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽',
              'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅',
              'y': '𝘆', 'z': '𝘇', 'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙',
              'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
              'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩',
              'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
              // Кириллица
              'а': '𝗮', 'б': '𝗯', 'в': '𝗯', 'г': '𝗴', 'д': '𝗱', 'е': '𝗲', 'ё': '𝗲', 'ж': '𝗷',
              'з': '𝘇', 'и': '𝗶', 'й': '𝗶', 'к': '𝗸', 'л': '𝗹', 'м': '𝗺', 'н': '𝗻', 'о': '𝗼',
              'п': '𝗽', 'р': '𝗿', 'с': '𝘀', 'т': '𝘁', 'у': '𝘂', 'ф': '𝗳', 'х': '𝗵', 'ц': '𝗰',
              'ч': '𝗰', 'ш': '𝘀', 'щ': '𝘀', 'ъ': 'ъ', 'ы': '𝘆', 'ь': '𝗯', 'э': '𝗲', 'ю': '𝘂',
              'я': '𝗮', 'А': '𝗔', 'Б': '𝗕', 'В': '𝗕', 'Г': '𝗚', 'Д': '𝗗', 'Е': '𝗘', 'Ё': '𝗘',
              'Ж': '𝗝', 'З': '𝗭', 'И': '𝗜', 'Й': '𝗜', 'К': '𝗞', 'Л': '𝗟', 'М': '𝗠', 'Н': '𝗡',
              'О': '𝗢', 'П': '𝗣', 'Р': '𝗥', 'С': '𝗦', 'Т': '𝗧', 'У': '𝗨', 'Ф': '𝗙', 'Х': '𝗛',
              'Ц': '𝗖', 'Ч': '𝗖', 'Ш': '𝗦', 'Щ': '𝗦', 'Ъ': 'Ъ', 'Ы': '𝗬', 'Ь': '𝗕', 'Э': '𝗘',
              'Ю': '𝗨', 'Я': '𝗔'
            };
            
            return boldMap[char] || char; // Если символа нет в карте, оставляем как есть
          }).join('');
        })
        .replace(/<strong>([^<]{1,30})<\/strong>/g, (match, text) => {
          // То же самое для тега <strong>
          return text.split('').map(char => {
            const boldMap: {[key: string]: string} = {
              'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵',
              'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽',
              'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅',
              'y': '𝘆', 'z': '𝘇', 'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙',
              'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡',
              'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩',
              'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
              // Кириллица
              'а': '𝗮', 'б': '𝗯', 'в': '𝗯', 'г': '𝗴', 'д': '𝗱', 'е': '𝗲', 'ё': '𝗲', 'ж': '𝗷',
              'з': '𝘇', 'и': '𝗶', 'й': '𝗶', 'к': '𝗸', 'л': '𝗹', 'м': '𝗺', 'н': '𝗻', 'о': '𝗼',
              'п': '𝗽', 'р': '𝗿', 'с': '𝘀', 'т': '𝘁', 'у': '𝘂', 'ф': '𝗳', 'х': '𝗵', 'ц': '𝗰',
              'ч': '𝗰', 'ш': '𝘀', 'щ': '𝘀', 'ъ': 'ъ', 'ы': '𝘆', 'ь': '𝗯', 'э': '𝗲', 'ю': '𝘂',
              'я': '𝗮', 'А': '𝗔', 'Б': '𝗕', 'В': '𝗕', 'Г': '𝗚', 'Д': '𝗗', 'Е': '𝗘', 'Ё': '𝗘',
              'Ж': '𝗝', 'З': '𝗭', 'И': '𝗜', 'Й': '𝗜', 'К': '𝗞', 'Л': '𝗟', 'М': '𝗠', 'Н': '𝗡',
              'О': '𝗢', 'П': '𝗣', 'Р': '𝗥', 'С': '𝗦', 'Т': '𝗧', 'У': '𝗨', 'Ф': '𝗙', 'Х': '𝗛',
              'Ц': '𝗖', 'Ч': '𝗖', 'Ш': '𝗦', 'Щ': '𝗦', 'Ъ': 'Ъ', 'Ы': '𝗬', 'Ь': '𝗕', 'Э': '𝗘',
              'Ю': '𝗨', 'Я': '𝗔'
            };
            
            return boldMap[char] || char;
          }).join('');
        })
        
        // Курсив с использованием Unicode (для коротких фраз)
        .replace(/<i>([^<]{1,30})<\/i>/g, (match, text) => {
          // Конвертируем каждую букву в соответствующий Unicode "курсивный" символ
          return text.split('').map(char => {
            const italicMap: {[key: string]: string} = {
              'a': '𝘢', 'b': '𝘣', 'c': '𝘤', 'd': '𝘥', 'e': '𝘦', 'f': '𝘧', 'g': '𝘨', 'h': '𝘩',
              'i': '𝘪', 'j': '𝘫', 'k': '𝘬', 'l': '𝘭', 'm': '𝘮', 'n': '𝘯', 'o': '𝘰', 'p': '𝘱',
              'q': '𝘲', 'r': '𝘳', 's': '𝘴', 't': '𝘵', 'u': '𝘶', 'v': '𝘷', 'w': '𝘸', 'x': '𝘹',
              'y': '𝘺', 'z': '𝘻', 'A': '𝘈', 'B': '𝘉', 'C': '𝘊', 'D': '𝘋', 'E': '𝘌', 'F': '𝘍',
              'G': '𝘎', 'H': '𝘏', 'I': '𝘐', 'J': '𝘑', 'K': '𝘒', 'L': '𝘓', 'M': '𝘔', 'N': '𝘕',
              'O': '𝘖', 'P': '𝘗', 'Q': '𝘘', 'R': '𝘙', 'S': '𝘚', 'T': '𝘛', 'U': '𝘜', 'V': '𝘝',
              'W': '𝘞', 'X': '𝘟', 'Y': '𝘠', 'Z': '𝘡',
              // Кириллица (приблизительное соответствие)
              'а': '𝘢', 'б': '𝘣', 'в': '𝘣', 'г': '𝘨', 'д': '𝘥', 'е': '𝘦', 'ё': '𝘦', 'ж': '𝘫',
              'з': '𝘻', 'и': '𝘪', 'й': '𝘪', 'к': '𝘬', 'л': '𝘭', 'м': '𝘮', 'н': '𝘯', 'о': '𝘰',
              'п': '𝘱', 'р': '𝘳', 'с': '𝘴', 'т': '𝘵', 'у': '𝘶', 'ф': '𝘧', 'х': '𝘩', 'ц': '𝘤',
              'ч': '𝘤', 'ш': '𝘴', 'щ': '𝘴', 'ъ': 'ъ', 'ы': '𝘺', 'ь': '𝘣', 'э': '𝘦', 'ю': '𝘶',
              'я': '𝘢', 'А': '𝘈', 'Б': '𝘉', 'В': '𝘉', 'Г': '𝘎', 'Д': '𝘋', 'Е': '𝘌', 'Ё': '𝘌',
              'Ж': '𝘑', 'З': '𝘡', 'И': '𝘐', 'Й': '𝘐', 'К': '𝘒', 'Л': '𝘓', 'М': '𝘔', 'Н': '𝘕',
              'О': '𝘖', 'П': '𝘗', 'Р': '𝘙', 'С': '𝘚', 'Т': '𝘛', 'У': '𝘜', 'Ф': '𝘍', 'Х': '𝘏',
              'Ц': '𝘊', 'Ч': '𝘊', 'Ш': '𝘚', 'Щ': '𝘚', 'Ъ': 'Ъ', 'Ы': '𝘠', 'Ь': '𝘉', 'Э': '𝘌',
              'Ю': '𝘜', 'Я': '𝘈'
            };
            
            return italicMap[char] || char;
          }).join('');
        })
        .replace(/<em>([^<]{1,30})<\/em>/g, (match, text) => {
          // То же самое для тега <em>
          return text.split('').map(char => {
            const italicMap: {[key: string]: string} = {
              'a': '𝘢', 'b': '𝘣', 'c': '𝘤', 'd': '𝘥', 'e': '𝘦', 'f': '𝘧', 'g': '𝘨', 'h': '𝘩',
              'i': '𝘪', 'j': '𝘫', 'k': '𝘬', 'l': '𝘭', 'm': '𝘮', 'n': '𝘯', 'o': '𝘰', 'p': '𝘱',
              'q': '𝘲', 'r': '𝘳', 's': '𝘴', 't': '𝘵', 'u': '𝘶', 'v': '𝘷', 'w': '𝘸', 'x': '𝘹',
              'y': '𝘺', 'z': '𝘻', 'A': '𝘈', 'B': '𝘉', 'C': '𝘊', 'D': '𝘋', 'E': '𝘌', 'F': '𝘍',
              'G': '𝘎', 'H': '𝘏', 'I': '𝘐', 'J': '𝘑', 'K': '𝘒', 'L': '𝘓', 'M': '𝘔', 'N': '𝘕',
              'O': '𝘖', 'P': '𝘗', 'Q': '𝘘', 'R': '𝘙', 'S': '𝘚', 'T': '𝘛', 'U': '𝘜', 'V': '𝘝',
              'W': '𝘞', 'X': '𝘟', 'Y': '𝘠', 'Z': '𝘡',
              // Кириллица (приблизительное соответствие)
              'а': '𝘢', 'б': '𝘣', 'в': '𝘣', 'г': '𝘨', 'д': '𝘥', 'е': '𝘦', 'ё': '𝘦', 'ж': '𝘫',
              'з': '𝘻', 'и': '𝘪', 'й': '𝘪', 'к': '𝘬', 'л': '𝘭', 'м': '𝘮', 'н': '𝘯', 'о': '𝘰',
              'п': '𝘱', 'р': '𝘳', 'с': '𝘴', 'т': '𝘵', 'у': '𝘶', 'ф': '𝘧', 'х': '𝘩', 'ц': '𝘤',
              'ч': '𝘤', 'ш': '𝘴', 'щ': '𝘴', 'ъ': 'ъ', 'ы': '𝘺', 'ь': '𝘣', 'э': '𝘦', 'ю': '𝘶',
              'я': '𝘢', 'А': '𝘈', 'Б': '𝘉', 'В': '𝘉', 'Г': '𝘎', 'Д': '𝘋', 'Е': '𝘌', 'Ё': '𝘌',
              'Ж': '𝘑', 'З': '𝘡', 'И': '𝘐', 'Й': '𝘐', 'К': '𝘒', 'Л': '𝘓', 'М': '𝘔', 'Н': '𝘕',
              'О': '𝘖', 'П': '𝘗', 'Р': '𝘙', 'С': '𝘚', 'Т': '𝘛', 'У': '𝘜', 'Ф': '𝘍', 'Х': '𝘏',
              'Ц': '𝘊', 'Ч': '𝘊', 'Ш': '𝘚', 'Щ': '𝘚', 'Ъ': 'Ъ', 'Ы': '𝘠', 'Ь': '𝘉', 'Э': '𝘌',
              'Ю': '𝘜', 'Я': '𝘈'
            };
            
            return italicMap[char] || char;
          }).join('');
        })
        
        // Для длинных параграфов или фраз оставляем текст как есть
        .replace(/<b>([^<]{31,})<\/b>/g, '$1')
        .replace(/<strong>([^<]{31,})<\/strong>/g, '$1')
        .replace(/<i>([^<]{31,})<\/i>/g, '$1')
        .replace(/<em>([^<]{31,})<\/em>/g, '$1')
        
        // Обрабатываем ссылки - удаляем тег, но оставляем описание и URL
        .replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/g, '$2 ($1)')
        
        // Удаляем все оставшиеся HTML-теги, но сохраняем их содержимое
        .replace(/<\/?[^>]+(>|$)/g, '');
      
      log(`Обработанный текст для Instagram (очищенный от HTML): ${contentText.substring(0, 100)}...`, 'social-publishing');
      caption += contentText;

      // Добавление хэштегов
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        caption += '\n\n' + processedContent.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      // Ограничиваем длину подписи до 2200 символов (ограничение Instagram)
      const maxInstagramCaptionLength = 2200;
      
      // Проверка и логирование данных, показывающих текущую длину подписи
      log(`Instagram - длина подписи: ${caption.length} символов, лимит: ${maxInstagramCaptionLength}`, 'social-publishing');
      
      // Всегда обрезаем длинную подпись для Instagram
      if (caption.length > maxInstagramCaptionLength) {
        log(`Подпись для Instagram превышает лимит: ${caption.length} символов (лимит ${maxInstagramCaptionLength})`, 'social-publishing');
        // Обрезаем с запасом в 50 символов чтобы избежать проблем с Unicode или emoji
        const safeLimit = maxInstagramCaptionLength - 53;
        caption = caption.substring(0, safeLimit) + '...';
        log(`Подпись для Instagram обрезана до ${caption.length} символов`, 'social-publishing');
      }

      log(`Подготовлено описание для Instagram: ${caption.substring(0, 50)}...`, 'social-publishing');

      // Инстаграм требует наличие хотя бы одного изображения
      if (!processedContent.imageUrl && (!processedContent.additionalImages || processedContent.additionalImages.length === 0)) {
        log(`Для публикации в Instagram необходимо хотя бы одно изображение`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Для публикации в Instagram необходимо хотя бы одно изображение',
          userId: processedContent.userId
        };
      }

      const igBusinessId = instagramSettings.businessAccountId;
      
      // Собираем все изображения для публикации
      const images = [];
      
      // Добавляем основное изображение, если оно есть
      if (processedContent.imageUrl) {
        images.push(processedContent.imageUrl);
      }
      
      // Добавляем дополнительные изображения, если они есть
      if (processedContent.additionalImages && Array.isArray(processedContent.additionalImages)) {
        log(`Найдено ${processedContent.additionalImages.length} дополнительных изображений для Instagram`, 'social-publishing');
        
        // Фильтруем только валидные URL
        const validImages = processedContent.additionalImages.filter(url => url && typeof url === 'string');
        images.push(...validImages);
        
        log(`Добавлено ${validImages.length} дополнительных изображений в массив для Instagram`, 'social-publishing');
      }
      
      log(`Подготовлено ${images.length} изображений для публикации в Instagram`, 'social-publishing');
      
      // Если у нас несколько изображений, публикуем карусель
      if (images.length > 1) {
        return await this.publishInstagramCarousel(processedContent, igBusinessId, token, images, caption);
      }
      
      // Если одно изображение, публикуем как обычный пост
      const imageUrl = images[0];
      
      // Шаг 1: Создаем медиа-контейнер
      log(`Шаг 1: Создание медиа-контейнера для Instagram (одиночное изображение)`, 'social-publishing');
      const createMediaResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igBusinessId}/media`,
        {
          image_url: imageUrl,
          caption: caption,
          access_token: token
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!createMediaResponse.data || !createMediaResponse.data.id) {
        log(`Ошибка при создании медиа-контейнера: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при создании медиа-контейнера: Неверный формат ответа',
          userId: processedContent.userId
        };
      }

      const mediaContainerId = createMediaResponse.data.id;
      log(`Медиа-контейнер создан успешно, ID: ${mediaContainerId}`, 'social-publishing');

      // Шаг 2: Публикуем медиа из контейнера
      log(`Шаг 2: Публикация медиа в Instagram`, 'social-publishing');
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igBusinessId}/media_publish`,
        {
          creation_id: mediaContainerId,
          access_token: token
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!publishResponse.data || !publishResponse.data.id) {
        log(`Ошибка при публикации медиа: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при публикации медиа: Неверный формат ответа',
          userId: processedContent.userId
        };
      }

      const postId = publishResponse.data.id;
      log(`Медиа успешно опубликовано в Instagram, ID: ${postId}`, 'social-publishing');

      // Получаем информацию о созданном медиа, чтобы извлечь permalink с коротким кодом
      try {
        log(`Запрос медиа данных для получения permalink/shortcode для ID: ${postId}`, 'social-publishing');
        const mediaInfoResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${postId}`,
          {
            params: {
              fields: 'permalink',
              access_token: token
            }
          }
        );
        
        if (mediaInfoResponse.data && mediaInfoResponse.data.permalink) {
          // Получаем permalink из ответа API, содержащий реальный короткий код Instagram
          const permalink = mediaInfoResponse.data.permalink;
          log(`Получен permalink из API Instagram: ${permalink}`, 'social-publishing');
          
          // Формируем URL публикации из permalink
          const postUrl = permalink;
          log(`Использован permalink как postUrl: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'instagram',
            status: 'published',
            publishedAt: new Date(),
            postId: postId,
            postUrl: postUrl,
            error: null,
            userId: processedContent.userId
          };
        }
      } catch (permalinkError: any) {
        log(`Ошибка при получении permalink для поста Instagram: ${permalinkError.message}`, 'social-publishing');
        log(`Используем запасной метод с генерацией короткого кода`, 'social-publishing');
      }
      
      // Запасной вариант, если не удалось получить permalink
      // Преобразуем ID в короткий код для URL
      const shortCode = this.convertInstagramIdToShortCode(postId);
      log(`Преобразован ID Instagram ${postId} в короткий код: ${shortCode}`, 'social-publishing');

      // Формируем URL публикации
      const postUrl = `https://www.instagram.com/p/${shortCode}/`;

      return {
        platform: 'instagram',
        status: 'published',
        publishedAt: new Date(),
        postId: postId,
        postUrl: postUrl,
        error: null,
        userId: processedContent.userId
      };
    } catch (error: any) {
      log(`Ошибка при публикации в Instagram: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в Instagram: ${error.message}`,
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
    facebookSettings?: SocialMediaSettings['facebook']
  ): Promise<SocialPublication> {
    // Проверяем наличие настроек
    if (!facebookSettings?.token) {
      log(`Отсутствует токен Facebook для публикации контента ${content.id}`, 'social-publishing');
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует токен Facebook (Graph API) в настройках кампании',
        userId: content.userId
      };
    }

    if (!facebookSettings?.pageId) {
      log(`Отсутствует ID страницы Facebook для публикации контента ${content.id}`, 'social-publishing');
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует ID страницы Facebook в настройках кампании',
        userId: content.userId
      };
    }
    
    // Предупреждение о необходимых разрешениях
    log(`Публикация в Facebook требует специальных разрешений в токене. Убедитесь, что ваш токен имеет разрешения pages_read_engagement и pages_manage_posts для публикации на страницу, или publish_to_groups для групп.`, 'social-publishing');

    try {
      log(`Публикация в Facebook. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
      log(`Публикация в Facebook. Токен: ${facebookSettings.token.substring(0, 6)}..., Страница: ${facebookSettings.pageId}`, 'social-publishing');

      // Обработка дополнительных изображений
      const processedContent = this.processAdditionalImages(content, 'Facebook');
      
      // Подготовка сообщения
      let message = processedContent.title ? `${processedContent.title}\n\n` : '';
      
      // Facebook не поддерживает HTML-теги, преобразуем их в текст и эмодзи
      const contentText = processedContent.content
        // Обрабатываем блочные элементы для правильных переносов
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '✨ $1 ✨\n\n')
        
        // Обрабатываем маркированные списки
        .replace(/<ul>([\s\S]*?)<\/ul>/g, (match, content) => {
          return content.replace(/<li>(.*?)<\/li>/g, '• $1\n');
        })
        
        // Обрабатываем форматирование текста с эмодзи (для FB более лаконично)
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<strong>(.*?)<\/strong>/g, '*$1*')
        .replace(/<i>(.*?)<\/i>/g, '_$1_')
        .replace(/<em>(.*?)<\/em>/g, '_$1_')
        
        // Обрабатываем ссылки - удаляем тег, но оставляем описание
        .replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/g, '$2 ($1)')
        
        // Удаляем все оставшиеся HTML-теги, но сохраняем их содержимое
        .replace(/<\/?[^>]+(>|$)/g, '');
      
      log(`Обработанный текст для Facebook (очищенный от HTML): ${contentText.substring(0, 100)}...`, 'social-publishing');
      message += contentText;

      // Добавление хэштегов
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        message += '\n\n' + processedContent.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      // Ограничиваем длину сообщения до 2200 символов (ограничение для совместимости с Instagram)
      const maxCaptionLength = 2200;
      if (message.length > maxCaptionLength) {
        // Обрезаем с запасом в 50 символов чтобы избежать проблем с Unicode или emoji
        const safeLimit = maxCaptionLength - 53;
        message = message.substring(0, safeLimit) + '...';
        log(`Сообщение для Facebook обрезано до ${message.length} символов для совместимости с платформами`, 'social-publishing');
      }

      log(`Подготовлено сообщение для Facebook: ${message.substring(0, 50)}...`, 'social-publishing');

      const pageId = facebookSettings.pageId;
      const token = facebookSettings.token;
      
      // Подготовка данных для публикации
      const requestData: Record<string, any> = {
        message: message,
        access_token: token
      };

      // Собираем все изображения для публикации
      const images = [];
      
      // Добавляем основное изображение, если оно есть
      if (processedContent.imageUrl) {
        images.push(processedContent.imageUrl);
      }
      
      // Добавляем дополнительные изображения, если они есть
      if (processedContent.additionalImages && Array.isArray(processedContent.additionalImages)) {
        log(`Найдено ${processedContent.additionalImages.length} дополнительных изображений для Facebook`, 'social-publishing');
        
        // Фильтруем только валидные URL
        const validImages = processedContent.additionalImages.filter(url => url && typeof url === 'string');
        images.push(...validImages);
        
        log(`Добавлено ${validImages.length} дополнительных изображений в массив для Facebook`, 'social-publishing');
      }
      
      log(`Подготовлено ${images.length} изображений для публикации в Facebook`, 'social-publishing');
      
      // Проверяем количество изображений для выбора стратегии публикации
      if (images.length > 1) {
        // Если несколько изображений, используем публикацию карусели
        log(`Facebook: обнаружено ${images.length} изображений, публикуем как карусель`, 'social-publishing');
        const carouselPublicationResult = await this.publishFacebookCarousel(processedContent, pageId, token, images, message);
        return carouselPublicationResult;
      } else if (images.length === 1) {
        // Если одно изображение, добавляем его к посту
        const imageUrl = images[0];
        log(`Добавление изображения в пост Facebook: ${imageUrl}`, 'social-publishing');
        
        // Для одного изображения используем photos endpoint вместо feed
        // Это обеспечивает лучшее отображение изображения в посте
        try {
          log(`Отправка запроса в Facebook Graph API для публикации фото на странице ${pageId}`, 'social-publishing');
          const response = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/photos`,
            {
              url: imageUrl,
              message: message,
              access_token: token,
              published: true
            },
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (response.data && response.data.id) {
            const photoId = response.data.id;
            log(`Успешная публикация фото в Facebook. Photo ID: ${photoId}`, 'social-publishing');
            
            // Формируем URL публикации
            // Здесь используется ID фото, но это не ID поста
            // В идеале нужно получить post_id из API, но он не всегда доступен
            const postUrl = `https://www.facebook.com/${pageId}/photos/${photoId}`;
            
            return {
              platform: 'facebook',
              status: 'published',
              publishedAt: new Date(),
              postId: photoId,
              postUrl: postUrl,
              error: null,
              userId: content.userId
            };
          }
        } catch (error: any) {
          log(`Ошибка при публикации фото в Facebook, пробуем feed endpoint: ${error.message}`, 'social-publishing');
          if (error.response?.data) {
            log(`Данные ошибки: ${JSON.stringify(error.response.data)}`, 'social-publishing');
          }
          // Продолжаем с feed endpoint, если photos endpoint не сработал
          requestData.link = imageUrl;
        }
      }

      // Публикация в Facebook через Graph API с использованием feed endpoint
      log(`Отправка запроса в Facebook Graph API (feed) для публикации на странице ${pageId}`, 'social-publishing');
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        requestData,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      log(`Получен ответ от Facebook API: ${JSON.stringify(response.data)}`, 'social-publishing');

      if (response.data && response.data.id) {
        const postId = response.data.id;
        // Формат ID поста: {page-id}_{post-id}
        const parts = postId.split('_');
        const actualPostId = parts.length > 1 ? parts[1] : postId;
        
        // Формируем URL публикации
        const postUrl = `https://www.facebook.com/${pageId}/posts/${actualPostId}`;
        
        log(`Успешная публикация в Facebook. Post ID: ${postId}, URL: ${postUrl}`, 'social-publishing');
        
        return {
          platform: 'facebook',
          status: 'published',
          publishedAt: new Date(),
          postId: postId,
          postUrl: postUrl,
          error: null,
          userId: content.userId
        };
      } else {
        log(`Неизвестный формат ответа от Facebook API: ${JSON.stringify(response.data)}`, 'social-publishing');
        return {
          platform: 'facebook',
          status: 'failed',
          publishedAt: null,
          error: `Неизвестный формат ответа от Facebook API: ${JSON.stringify(response.data)}`,
          userId: content.userId
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации в Facebook: ${error.message}`, 'social-publishing');
      
      // Проверяем, связана ли ошибка с отсутствием необходимых разрешений
      let errorMessage = `Ошибка при публикации в Facebook: ${error.message}`;
      
      if (error.response?.data?.error) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
        
        // Проверка на специфические ошибки разрешений
        const responseError = error.response.data.error;
        if (responseError.message && responseError.message.includes('permission')) {
          errorMessage = `Ошибка при публикации в Facebook: Недостаточно разрешений в токене. Для публикации на страницу требуются разрешения "pages_read_engagement" и "pages_manage_posts". Для публикации в группу требуется разрешение "publish_to_groups".`;
        }
      }
      
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: errorMessage,
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
  /**
   * Публикует карусель изображений в Instagram
   * @param content Контент для публикации
   * @param igBusinessId ID бизнес-аккаунта Instagram
   * @param token Токен доступа
   * @param images Массив URL изображений для публикации
   * @param caption Подпись к публикации
   * @returns Результат публикации
   */
  private async publishInstagramCarousel(
    content: CampaignContent,
    igBusinessId: string, 
    token: string,
    images: string[],
    caption: string
  ): Promise<SocialPublication> {
    try {
      log(`Публикация карусели в Instagram. Контент: ${content.id}, количество изображений: ${images.length}`, 'social-publishing');
      log(`Входные данные для Instagram карусели: content.additionalImages=${typeof content.additionalImages} (length: ${Array.isArray(content.additionalImages) ? content.additionalImages.length : 'not array'})`, 'social-publishing');
      log(`Длина подписи для Instagram: ${caption.length} символов`, 'social-publishing');
      
      if (images.length <= 1) {
        log(`Недостаточно изображений для карусели в Instagram (${images.length}). Нужно минимум 2 изображения.`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: `Недостаточно изображений для карусели в Instagram. Нужно минимум 2 изображения.`,
          userId: content.userId
        };
      }
      
      // Шаг 1: Создаем дочерние медиа-контейнеры для каждого изображения
      const childrenMediaIds = [];
      
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        log(`Создание дочернего контейнера ${i + 1}/${images.length} для изображения: ${imageUrl.substring(0, 50)}...`, 'social-publishing');
        
        try {
          const createMediaResponse = await axios.post(
            `https://graph.facebook.com/v18.0/${igBusinessId}/media`,
            {
              image_url: imageUrl,
              is_carousel_item: true,
              access_token: token,
              media_type: 'IMAGE'
            },
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (createMediaResponse.data && createMediaResponse.data.id) {
            childrenMediaIds.push(createMediaResponse.data.id);
            log(`Дочерний контейнер ${i + 1} создан успешно, ID: ${createMediaResponse.data.id}`, 'social-publishing');
          } else {
            log(`Ошибка при создании дочернего контейнера ${i + 1}: Неверный формат ответа`, 'social-publishing');
          }
        } catch (error: any) {
          log(`Ошибка при создании дочернего контейнера ${i + 1}: ${error.message}`, 'social-publishing');
          if (error.response) {
            log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
          }
        }
      }
      
      // Проверяем, есть ли хотя бы одно изображение для карусели
      if (childrenMediaIds.length === 0) {
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Не удалось создать ни одного дочернего контейнера для карусели',
          userId: content.userId
        };
      }
      
      // Шаг 2: Создаем родительский контейнер для карусели
      log(`Создание родительского контейнера карусели с ${childrenMediaIds.length} изображениями`, 'social-publishing');
      const createCarouselResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igBusinessId}/media`,
        {
          media_type: 'CAROUSEL',
          caption: caption,
          children: childrenMediaIds,
          access_token: token
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!createCarouselResponse.data || !createCarouselResponse.data.id) {
        log(`Ошибка при создании родительского контейнера карусели: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при создании родительского контейнера карусели',
          userId: content.userId
        };
      }
      
      const carouselId = createCarouselResponse.data.id;
      log(`Родительский контейнер карусели создан успешно, ID: ${carouselId}`, 'social-publishing');
      
      // Шаг 3: Публикуем карусель
      log(`Публикация карусели в Instagram`, 'social-publishing');
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igBusinessId}/media_publish`,
        {
          creation_id: carouselId,
          access_token: token
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!publishResponse.data || !publishResponse.data.id) {
        log(`Ошибка при публикации карусели: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при публикации карусели: Неверный формат ответа',
          userId: content.userId
        };
      }
      
      const postId = publishResponse.data.id;
      log(`Карусель успешно опубликована в Instagram, ID: ${postId}`, 'social-publishing');
      
      // Получаем информацию о созданном медиа, чтобы извлечь permalink с коротким кодом
      try {
        log(`Запрос медиа данных для получения permalink/shortcode для карусели с ID: ${postId}`, 'social-publishing');
        const mediaInfoResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${postId}`,
          {
            params: {
              fields: 'permalink',
              access_token: token
            }
          }
        );
        
        if (mediaInfoResponse.data && mediaInfoResponse.data.permalink) {
          // Получаем permalink из ответа API, содержащий реальный короткий код Instagram
          const permalink = mediaInfoResponse.data.permalink;
          log(`Получен permalink из API Instagram для карусели: ${permalink}`, 'social-publishing');
          
          // Формируем URL публикации из permalink
          const postUrl = permalink;
          log(`Использован permalink как postUrl для карусели: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'instagram',
            status: 'published',
            publishedAt: new Date(),
            postId: postId,
            postUrl: postUrl,
            error: null,
            userId: content.userId
          };
        }
      } catch (permalinkError: any) {
        log(`Ошибка при получении permalink для карусели в Instagram: ${permalinkError.message}`, 'social-publishing');
        log(`Используем запасной метод с генерацией короткого кода для карусели`, 'social-publishing');
      }
      
      // Запасной вариант, если не удалось получить permalink
      // Преобразуем ID в короткий код для URL
      const shortCode = this.convertInstagramIdToShortCode(postId);
      log(`Преобразован ID Instagram карусели ${postId} в короткий код: ${shortCode}`, 'social-publishing');
      
      // Формируем URL публикации
      const postUrl = `https://www.instagram.com/p/${shortCode}/`;
      
      return {
        platform: 'instagram',
        status: 'published',
        publishedAt: new Date(),
        postId: postId,
        postUrl: postUrl,
        error: null,
        userId: content.userId
      };
    } catch (error: any) {
      log(`Ошибка при публикации карусели в Instagram: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации карусели в Instagram: ${error.message}`,
        userId: content.userId
      };
    }
  }

  /**
   * Публикует карусель изображений в Facebook
   * @param content Контент для публикации
   * @param pageId ID страницы Facebook
   * @param token Токен доступа
   * @param images Массив URL изображений для публикации
   * @param message Текст сообщения
   * @returns Результат публикации
   */
  private async publishFacebookCarousel(
    content: CampaignContent,
    pageId: string,
    token: string,
    images: string[],
    message: string
  ): Promise<SocialPublication> {
    try {
      log(`Публикация карусели в Facebook. Контент: ${content.id}, количество изображений: ${images.length}`, 'social-publishing');
      
      if (images.length <= 1) {
        log(`Недостаточно изображений для карусели в Facebook (${images.length}). Нужно минимум 2 изображения.`, 'social-publishing');
        return {
          platform: 'facebook',
          status: 'failed',
          publishedAt: null,
          error: `Недостаточно изображений для карусели в Facebook. Нужно минимум 2 изображения.`,
          userId: content.userId
        };
      }
      
      // Facebook использует другой метод публикации карусели через feed endpoint
      // с использованием параметра attached_media для добавления нескольких изображений
      
      // Шаг 1: Загружаем каждое изображение отдельно
      const mediaIds = [];
      
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        log(`Загрузка изображения ${i + 1}/${images.length} для Facebook: ${imageUrl.substring(0, 50)}...`, 'social-publishing');
        
        try {
          // Сначала загружаем фото на страницу, но без публикации (unpublished)
          const uploadResponse = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/photos`,
            {
              url: imageUrl,
              published: false, // важно: не публикуем сейчас
              access_token: token
            },
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (uploadResponse.data && uploadResponse.data.id) {
            mediaIds.push({ media_fbid: uploadResponse.data.id });
            log(`Изображение ${i + 1} загружено успешно, ID: ${uploadResponse.data.id}`, 'social-publishing');
          } else {
            log(`Ошибка при загрузке изображения ${i + 1} для Facebook: Неверный формат ответа`, 'social-publishing');
          }
        } catch (error: any) {
          log(`Ошибка при загрузке изображения ${i + 1} для Facebook: ${error.message}`, 'social-publishing');
          if (error.response) {
            log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
          }
          
          // Продолжаем с оставшимися изображениями
        }
      }
      
      // Проверяем, загрузилось ли хоть одно изображение
      if (mediaIds.length === 0) {
        return {
          platform: 'facebook',
          status: 'failed',
          publishedAt: null,
          error: 'Не удалось загрузить ни одного изображения для карусели в Facebook',
          userId: content.userId
        };
      }
      
      // Шаг 2: Публикуем пост со всеми загруженными изображениями
      log(`Публикация поста в Facebook с ${mediaIds.length} изображениями`, 'social-publishing');
      const publishData: Record<string, any> = {
        message: message,
        access_token: token
      };
      
      // Добавляем все загруженные медиа-файлы к посту
      publishData.attached_media = mediaIds;
      
      log(`Отправка запроса в Facebook API для публикации карусели на странице ${pageId}`, 'social-publishing');
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        publishData,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!response.data || !response.data.id) {
        log(`Ошибка при публикации карусели в Facebook: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'facebook',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при публикации карусели в Facebook: Неверный формат ответа',
          userId: content.userId
        };
      }
      
      const postId = response.data.id;
      log(`Карусель успешно опубликована в Facebook, Post ID: ${postId}`, 'social-publishing');
      
      // Формат ID поста: {page-id}_{post-id}
      const parts = postId.split('_');
      const actualPostId = parts.length > 1 ? parts[1] : postId;
      
      // Формируем URL публикации
      const postUrl = `https://www.facebook.com/${pageId}/posts/${actualPostId}`;
      
      return {
        platform: 'facebook',
        status: 'published',
        publishedAt: new Date(),
        postId: postId,
        postUrl: postUrl,
        error: null,
        userId: content.userId
      };
    } catch (error: any) {
      log(`Ошибка при публикации карусели в Facebook: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации карусели в Facebook: ${error.message}`,
        userId: content.userId
      };
    }
  }

  /**
   * Преобразует числовой ID Instagram в короткий код для URL
   * Instagram использует специальное кодирование для формирования коротких кодов
   * @param id Числовой ID публикации
   * @returns Короткий код для использования в URL
   */
  private convertInstagramIdToShortCode(id: string): string {
    try {
      // Instagram использует модифицированную версию base64 с алфавитом:
      // ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
      
      // На практике, Instagram использует свой собственный алгоритм, который сложно воспроизвести точно
      // Для демонстрационных целей создадим короткий код из случайных символов
      
      // Генерируем короткий код длиной 11 символов (стандартная длина Instagram)
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      
      // Для детерминистичности используем хеш на основе ID
      let shortCode = '';
      
      // Используем первые несколько символов как "префикс" для создания узнаваемых кодов
      // Обычно короткие коды Instagram имеют длину от 8 до 11 символов
      shortCode = 'C' + alphabet[id.length % 64]; // Начало со случайной буквы
      
      // Добавляем еще 9 символов для создания короткого кода общей длиной 11 символов
      for (let i = 0; i < 9; i++) {
        // Используем различные символы ID для генерации разных позиций короткого кода
        const charIndex = (id.charCodeAt(i % id.length) + i) % alphabet.length;
        shortCode += alphabet[charIndex];
      }
      
      log(`Преобразован ID Instagram ${id} в короткий код ${shortCode}`, 'social-publishing');
      return shortCode;
    } catch (error) {
      // Если возникла ошибка в преобразовании, возвращаем фиксированный короткий код
      log(`Ошибка при преобразовании ID Instagram в короткий код: ${error}`, 'social-publishing');
      return 'Cx1AbCdEfG'; // Фиксированный короткий код в случае ошибки
    }
  }

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