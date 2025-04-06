import axios from 'axios';
import { log } from '../utils/logger';
import { CampaignContent, InsertCampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { storage } from '../storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';
import { imgurUploaderService } from './imgur-uploader';

/**
 * Сервис для публикации контента в социальные сети с поддержкой Imgur для изображений
 */
export class SocialPublishingWithImgurService {

  /**
   * Форматирует текст для публикации в Telegram с учетом поддерживаемых HTML-тегов
   * @param content Исходный текст контента
   * @returns Отформатированный текст для Telegram с поддержкой HTML
   */
  private formatTextForTelegram(content: string): string {
    // Telegram поддерживает только ограниченный набор HTML-тегов:
    // <b>, <strong>, <i>, <em>, <u>, <s>, <strike>, <code>, <pre>, <a href="...">
    return content
      // Обрабатываем блочные элементы для правильных переносов
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<div>(.*?)<\/div>/g, '$1\n')
      .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '<b>$1</b>\n\n')
      
      // Стандартизируем теги форматирования
      .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
      .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
      .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
      
      // Приводим ссылки к простому формату href
      .replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/g, '<a href="$1">$2</a>')
      
      // Удаляем все прочие неподдерживаемые теги (но сохраняем их содержимое)
      .replace(/<(?!\/?(b|strong|i|em|u|s|strike|code|pre|a)(?=>|\s.*>))\/?.*?>/gi, '');
  }

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
   * Загружает изображения на Imgur для использования в социальных сетях
   * @param content Контент с изображениями для загрузки
   * @returns Контент с обновленными URLs изображений, загруженных на Imgur
   */
  private async uploadImagesToImgur(content: CampaignContent): Promise<CampaignContent> {
    const updatedContent = { ...content };
    
    try {
      log(`Начинаем загрузку изображений на Imgur для контента: ${content.id}`, 'social-publishing');
      
      // Загружаем основное изображение, если оно есть
      if (updatedContent.imageUrl && typeof updatedContent.imageUrl === 'string' && updatedContent.imageUrl.trim() !== '') {
        log(`Загрузка основного изображения на Imgur: ${updatedContent.imageUrl}`, 'social-publishing');
        
        // Если URL не начинается с http, добавляем базовый URL сервера
        let originalImageUrl = updatedContent.imageUrl;
        if (!originalImageUrl.startsWith('http')) {
          const baseAppUrl = process.env.BASE_URL || 'https://nplanner.replit.app';
          originalImageUrl = `${baseAppUrl}${originalImageUrl.startsWith('/') ? '' : '/'}${originalImageUrl}`;
          log(`Изменен URL основного изображения для загрузки: ${originalImageUrl}`, 'social-publishing');
        }
        
        const imgurUrl = await imgurUploaderService.uploadImageFromUrl(originalImageUrl);
        if (imgurUrl) {
          log(`Основное изображение успешно загружено на Imgur: ${imgurUrl}`, 'social-publishing');
          updatedContent.imageUrl = imgurUrl;
        } else {
          log(`Не удалось загрузить основное изображение на Imgur, оставляем оригинальный URL`, 'social-publishing');
        }
      }
      
      // Загружаем дополнительные изображения
      if (updatedContent.additionalImages && Array.isArray(updatedContent.additionalImages) && updatedContent.additionalImages.length > 0) {
        log(`Загрузка ${updatedContent.additionalImages.length} дополнительных изображений на Imgur`, 'social-publishing');
        
        const imgurUrls: string[] = [];
        
        for (let i = 0; i < updatedContent.additionalImages.length; i++) {
          const additionalImage = updatedContent.additionalImages[i];
          
          if (additionalImage && typeof additionalImage === 'string' && additionalImage.trim() !== '') {
            // Если URL не начинается с http, добавляем базовый URL сервера
            let originalImageUrl = additionalImage;
            if (!originalImageUrl.startsWith('http')) {
              const baseAppUrl = process.env.BASE_URL || 'https://nplanner.replit.app';
              originalImageUrl = `${baseAppUrl}${originalImageUrl.startsWith('/') ? '' : '/'}${originalImageUrl}`;
              log(`Изменен URL дополнительного изображения ${i+1} для загрузки: ${originalImageUrl}`, 'social-publishing');
            }
            
            const imgurUrl = await imgurUploaderService.uploadImageFromUrl(originalImageUrl);
            if (imgurUrl) {
              log(`Дополнительное изображение ${i+1} успешно загружено на Imgur: ${imgurUrl}`, 'social-publishing');
              imgurUrls.push(imgurUrl);
            } else {
              log(`Не удалось загрузить дополнительное изображение ${i+1} на Imgur, сохраняем оригинальный URL`, 'social-publishing');
              imgurUrls.push(originalImageUrl);
            }
          }
        }
        
        updatedContent.additionalImages = imgurUrls;
        log(`Завершена загрузка дополнительных изображений на Imgur, всего: ${imgurUrls.length}`, 'social-publishing');
      }
      
      return updatedContent;
    } catch (error) {
      log(`Ошибка при загрузке изображений на Imgur: ${error}`, 'social-publishing');
      return content; // Возвращаем оригинальный контент в случае ошибки
    }
  }

  /**
   * Публикует контент в Telegram с использованием Imgur для изображений
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

      // Обработка дополнительных изображений
      let processedContent = this.processAdditionalImages(content, 'Telegram');
      
      // Загрузка изображений на Imgur перед публикацией
      processedContent = await this.uploadImagesToImgur(processedContent);

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
      let contentText = processedContent.content
        // Обрабатываем блочные элементы для правильных переносов
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '<b>$1</b>\n\n')
        
        // Стандартизируем теги форматирования
        .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
        .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
        .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
        
        // Приводим ссылки к простому формату href
        .replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/g, '<a href="$1">$2</a>')
        
        // Удаляем все прочие неподдерживаемые теги (но сохраняем их содержимое)
        .replace(/<(?!\/?(b|strong|i|em|u|s|strike|code|pre|a)(?=>|\s.*>))\/?.*?>/gi, '');
      
      log(`Обработанный HTML для Telegram: ${contentText.substring(0, 100)}...`, 'social-publishing');
      
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
        images.push(processedContent.imageUrl);
      }
      
      // Добавляем дополнительные изображения
      if (processedContent.additionalImages && Array.isArray(processedContent.additionalImages)) {
        for (const additionalImage of processedContent.additionalImages) {
          if (additionalImage && typeof additionalImage === 'string' && additionalImage.trim() !== '') {
            images.push(additionalImage);
            log(`Добавлено дополнительное изображение в массив для Telegram: ${additionalImage}`, 'social-publishing');
          }
        }
        
        log(`Всего подготовлено ${images.length} изображений для Telegram`, 'social-publishing');
      }
      
      // Проверяем доступность видео
      const hasVideo = content.videoUrl && typeof content.videoUrl === 'string' && content.videoUrl.trim() !== '';
      
      // Telegram имеет разные ограничения для разных типов сообщений:
      // - 4096 символов для обычного текста (без медиа)
      // - 1024 символа для подписи к медиа (фото, видео)
      const maxCaptionLength = 1024; // Лимит для подписи к медиа
      const maxTextLength = 4096;    // Лимит для обычного текстового сообщения
      
      // Подготавливаем текст для разных сценариев
      const truncatedCaption = text.length > maxCaptionLength ? 
        text.substring(0, maxCaptionLength - 3) + '...' : 
        text;
      
      const truncatedText = text.length > maxTextLength ? 
        text.substring(0, maxTextLength - 3) + '...' : 
        text;
      
      // Флаг для определения, нужно ли отправлять текст отдельным сообщением
      let needSeparateTextMessage = false;
      
      // Для изображений с длинным текстом > 1024 символов отправляем текст отдельно
      if ((images.length > 0 || hasVideo) && text.length > maxCaptionLength) {
        needSeparateTextMessage = true;
        log(`Telegram: текст (${text.length} символов) превышает ограничение подписи ${maxCaptionLength} символов, будет отправлен отдельным сообщением`, 'social-publishing');
      }
      
      // Решение о методе публикации на основе доступности медиа и типа контента
      if (images.length > 1) {
        // Отправка группы изображений (медиагруппы) через sendMediaGroup
        log(`Отправка медиагруппы в Telegram с ${images.length} изображениями через API sendMediaGroup`, 'social-publishing');
        
        // Формируем массив объектов медиа для API Telegram
        const mediaGroup = images.map((url, index) => ({
          type: 'photo',
          media: url,
          // Добавляем подпись только к первому изображению, и только если не нужно отправлять текст отдельным сообщением
          ...(index === 0 && !needSeparateTextMessage ? { caption: truncatedCaption, parse_mode: 'HTML' } : {})
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
        
        // Если нужно отправить текст отдельным сообщением, отправляем изображение без подписи
        const photoRequestBody = {
          chat_id: formattedChatId, 
          photo: images[0],
          // Если текст длинный и будет отправлен отдельно - не добавляем подпись к фото
          ...(needSeparateTextMessage ? {} : { caption: truncatedCaption, parse_mode: 'HTML' })
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
          // Если текст длинный и будет отправлен отдельно - не добавляем подпись к видео
          ...(needSeparateTextMessage ? {} : { caption: truncatedCaption, parse_mode: 'HTML' })
        };
        
        log(`Отправляем запрос видео к Telegram API: ${JSON.stringify(videoRequestBody)}`, 'social-publishing');
        
        response = await axios.post(`${baseUrl}/sendVideo`, videoRequestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (content.contentType === 'text' || !content.contentType) {
        // Отправка текстового сообщения (по умолчанию)
        log(`Отправка текстового сообщения в Telegram с HTML`, 'social-publishing');
        
        // Здесь добавлено использование truncatedCaption вместо text!
        // Это решает проблему с отправкой больших текстов
        const messageRequestBody = {
          chat_id: formattedChatId,
          text: truncatedCaption, // Используем обрезанный текст вместо полного
          parse_mode: 'HTML'
        };
        
        log(`Отправляем текстовый запрос к Telegram API (длина текста: ${truncatedCaption.length} символов)`, 'social-publishing');
        
        response = await axios.post(`${baseUrl}/sendMessage`, messageRequestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Неподдерживаемый формат - пробуем отправить текст как запасной вариант
        log(`Для типа контента ${content.contentType} не найдены медиа. Отправляем как текст`, 'social-publishing');
        try {
          // Используем truncatedCaption также и для резервного варианта отправки текста
          const fallbackMessageBody = {
            chat_id: formattedChatId,
            text: truncatedCaption,
            parse_mode: 'HTML'
          };
          
          log(`Отправляем fallback-текстовый запрос к Telegram API (длина текста: ${truncatedCaption.length} символов)`, 'social-publishing');
          
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
      
      // Отправляем текст отдельным сообщением, если нужно
      if (needSeparateTextMessage && response.data.ok) {
        try {
          log(`Отправка отдельного текстового сообщения после медиа в Telegram`, 'social-publishing');
          
          // Формируем текст с помощью метода форматирования для Telegram
          const formattedText = this.formatTextForTelegram(content.content || '');
          
          const textMessageBody = {
            chat_id: formattedChatId,
            text: formattedText,
            parse_mode: 'HTML'
          };
          
          // Отправляем отдельное текстовое сообщение
          const textResponse = await axios.post(`${baseUrl}/sendMessage`, textMessageBody, {
            headers: { 'Content-Type': 'application/json' }
          });
          
          log(`Ответ на отдельное текстовое сообщение: ${JSON.stringify(textResponse.data)}`, 'social-publishing');
          
          // Если не удалось отправить текст - это не критично, основное медиа уже отправлено
          if (!textResponse.data.ok) {
            log(`Не удалось отправить отдельное текстовое сообщение: ${textResponse.data.description}`, 'social-publishing');
          }
        } catch (error: any) {
          // Логируем ошибку, но не прерываем основной процесс, т.к. медиа уже отправлено
          log(`Ошибка при отправке отдельного текстового сообщения: ${error.message}`, 'social-publishing');
        }
      }

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
        // Обработка ошибок в ответе API
        log(`Ошибка публикации в Telegram: ${response.data.description}`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка API Telegram: ${response.data.description}`
        };
      }
    } catch (error: any) {
      // Обработка исключений при запросе
      log(`Исключение при публикации в Telegram: ${error.message}`, 'social-publishing');
      let errorMessage = `Ошибка публикации в Telegram: ${error.message}`;
      
      // Дополнительное логирование для ошибок в ответе API
      if (error.response && error.response.data) {
        log(`Данные ответа при ошибке Telegram: ${JSON.stringify(error.response.data)}`, 'social-publishing');
        errorMessage = `Ошибка Telegram API: ${error.response.data.description || error.message}`;
        
        // Добавляем детальную информацию для проблем с длиной текста
        if (error.response.data.description && error.response.data.description.includes('message is too long')) {
          log(`Ошибка длины сообщения в Telegram. Длина текста слишком большая, макс: 4096`, 'social-publishing');
          errorMessage = `Сообщение слишком длинное для Telegram (превышен лимит в 4096 символов)`;
        }
        // Добавляем проверку для ошибки длины подписи к фото/видео
        else if (error.response.data.description && error.response.data.description.includes('caption is too long')) {
          log(`Ошибка длины подписи в Telegram. Длина подписи слишком большая, макс: 1024`, 'social-publishing');
          errorMessage = `Подпись к медиа слишком длинная для Telegram (превышен лимит в 1024 символов)`;
          
          // Попробуем отправить медиа без подписи, а затем текст отдельным сообщением
          try {
            log(`Повторная попытка отправки без подписи`, 'social-publishing');
            
            // Определяем тип запроса (фото или видео) по наличию соответствующих полей в контенте
            const hasImage = content.imageUrl && typeof content.imageUrl === 'string' && content.imageUrl.trim() !== '';
            const hasVideo = content.videoUrl && typeof content.videoUrl === 'string' && content.videoUrl.trim() !== '';
            
            if (hasImage) {
              // Отправляем фото без подписи
              // Получаем chatId и API URL из контекста
              const telegramChatId = telegramSettings?.chatId || '';
              let formattedChatId = telegramChatId;
              if (!telegramChatId.startsWith('-100') && !isNaN(Number(telegramChatId))) {
                formattedChatId = `-100${telegramChatId}`;
              }
              
              const telegramApiBaseUrl = `https://api.telegram.org/bot${telegramSettings?.token || ''}`;
              
              const photoRequestBody = {
                chat_id: formattedChatId,
                photo: content.imageUrl
              };
              
              log(`Отправка фото без подписи: ${JSON.stringify(photoRequestBody)}`, 'social-publishing');
              const photoResponse = await axios.post(`${telegramApiBaseUrl}/sendPhoto`, photoRequestBody, {
                headers: { 'Content-Type': 'application/json' }
              });
              
              if (photoResponse.data.ok) {
                // Отправляем текст отдельным сообщением
                // Формируем текстовое сообщение с помощью метода форматирования для Telegram
                const formattedText = this.formatTextForTelegram(content.content || '');
                
                const textMessageBody = {
                  chat_id: formattedChatId,
                  text: formattedText,
                  parse_mode: 'HTML'
                };
                
                const textResponse = await axios.post(`${telegramApiBaseUrl}/sendMessage`, textMessageBody, {
                  headers: { 'Content-Type': 'application/json' }
                });
                
                // Если фото отправилось успешно, считаем публикацию успешной
                // даже если текст не удалось отправить
                const message = photoResponse.data.result;
                log(`Успешная публикация в Telegram после разделения. Message ID: ${message.message_id}`, 'social-publishing');
                return {
                  platform: 'telegram',
                  status: 'published',
                  publishedAt: new Date(),
                  postId: message.message_id.toString(),
                  postUrl: `https://t.me/c/${formattedChatId.replace('-100', '')}/${message.message_id}`,
                  userId: content.userId
                };
              }
            } else if (hasVideo) {
              // Аналогичная логика для видео
              // Получаем настройки для Telegram
              const telegramChatId = telegramSettings?.chatId || '';
              let formattedChatId = telegramChatId;
              
              // Форматируем ID чата, если он числовой и не начинается с '-100'
              if (!telegramChatId.startsWith('-100') && !isNaN(Number(telegramChatId))) {
                formattedChatId = `-100${telegramChatId}`;
              }
              
              const telegramApiBaseUrl = `https://api.telegram.org/bot${telegramSettings?.token || ''}`;
              
              const videoRequestBody = {
                chat_id: formattedChatId,
                video: content.videoUrl
              };
              
              log(`Отправка видео без подписи: ${JSON.stringify(videoRequestBody)}`, 'social-publishing');
              const videoResponse = await axios.post(`${telegramApiBaseUrl}/sendVideo`, videoRequestBody, {
                headers: { 'Content-Type': 'application/json' }
              });
              
              if (videoResponse.data.ok) {
                // Отправляем текст отдельным сообщением
                // Формируем текстовое сообщение с помощью метода форматирования для Telegram
                const formattedText = this.formatTextForTelegram(content.content || '');
                
                const textMessageBody = {
                  chat_id: formattedChatId,
                  text: formattedText,
                  parse_mode: 'HTML'
                };
                
                const textResponse = await axios.post(`${telegramApiBaseUrl}/sendMessage`, textMessageBody, {
                  headers: { 'Content-Type': 'application/json' }
                });
                
                // Если видео отправилось успешно, считаем публикацию успешной
                const message = videoResponse.data.result;
                log(`Успешная публикация в Telegram после разделения. Message ID: ${message.message_id}`, 'social-publishing');
                return {
                  platform: 'telegram',
                  status: 'published',
                  publishedAt: new Date(),
                  postId: message.message_id.toString(),
                  postUrl: `https://t.me/c/${formattedChatId.replace('-100', '')}/${message.message_id}`,
                  userId: content.userId
                };
              }
            }
          } catch (retryError: any) {
            log(`Ошибка при повторной попытке: ${retryError.message}`, 'social-publishing');
            errorMessage += ` (повторная попытка также не удалась: ${retryError.message})`;
          }
        }
      }
      
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: errorMessage
      };
    }
  }
}

// Создаем экземпляр сервиса
export const socialPublishingWithImgurService = new SocialPublishingWithImgurService();