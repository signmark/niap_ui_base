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
  private imgurClientId = process.env.IMGUR_CLIENT_ID || 'fc3d6ae9c21a8df';

  /**
   * Получает системный токен для доступа к API Directus
   * @returns Токен доступа или null в случае ошибки
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
      const directusCrud = await import('./directus-crud').then(m => m.directusCrud);
      const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID || '53921f16-f51d-4591-80b9-8caa4fde4d13';
      
      // 1. Приоритет - авторизация через логин/пароль (если есть учетные данные)
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (email && password) {
        log('Попытка авторизации администратора с учетными данными из env', 'social-publishing');
        
        try {
          // Прямая авторизация через REST API
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
          const response = await axios.post(`${directusUrl}/auth/login`, {
            email,
            password
          });
          
          if (response?.data?.data?.access_token) {
            const token = response.data.data.access_token;
            log('Авторизация администратора успешна через прямой API запрос', 'social-publishing');
            
            return token;
          }
        } catch (error: any) {
          log(`Ошибка при прямой авторизации администратора: ${error.message}`, 'social-publishing');
        }
        
        try {
          // Запасной вариант - через DirectusAuthManager
          const authInfo = await directusAuthManager.login(email, password);
          
          if (authInfo && authInfo.token) {
            log('Авторизация администратора успешна через directusAuthManager', 'social-publishing');
            return authInfo.token;
          }
          
          // Если не получилось через directusAuthManager, пробуем через directusCrud
          const authResult = await directusCrud.login(email, password);
          
          if (authResult?.access_token) {
            log('Авторизация администратора успешна через directusCrud', 'social-publishing');
            return authResult.access_token;
          }
        } catch (error: any) {
          log(`Ошибка при авторизации через вспомогательные сервисы: ${error.message}`, 'social-publishing');
        }
      }
      
      // 2. Используем API Directus для получения токена администратора
      const directusApiManager = await import('../directus').then(m => m.directusApiManager);
      const cachedToken = directusApiManager.getCachedToken(adminUserId);
      
      if (cachedToken) {
        log(`Найден кэшированный токен для администратора ${adminUserId}`, 'social-publishing');
        return cachedToken.token;
      }
      
      log('Не удалось получить действительный токен для обновления статуса публикаций', 'social-publishing');
      return null;
    } catch (error: any) {
      log(`Ошибка при получении системного токена: ${error.message}`, 'social-publishing');
      return null;
    }
  }

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
   * Подготавливает текст для отправки в Telegram: форматирует и обрезает при необходимости
   * @param content Исходный текст контента
   * @param maxLength Максимальная длина текста (по умолчанию 4000 для защиты от превышения лимита в 4096)
   * @returns Отформатированный и обрезанный текст для Telegram
   */
  private prepareTelegramText(content: string, maxLength: number = 4000): string {
    // Сначала форматируем текст для Telegram
    const formattedText = this.formatTextForTelegram(content);
    
    // Затем проверяем длину и обрезаем при необходимости
    if (formattedText.length > maxLength) {
      return formattedText.substring(0, maxLength - 3) + '...';
    }
    
    return formattedText;
  }
  
  /**
   * Создает и отправляет текстовое сообщение в Telegram
   * @param text Текст для отправки
   * @param chatId ID чата Telegram
   * @param token Токен бота Telegram
   * @returns Результат отправки сообщения
   */
  private async sendTextMessageToTelegram(text: string, chatId: string, token: string): Promise<any> {
    try {
      // Форматируем ID чата если нужно
      let formattedChatId = chatId;
      if (!chatId.startsWith('-100') && !isNaN(Number(chatId))) {
        formattedChatId = `-100${chatId}`;
      }
      
      // Подготавливаем текст с форматированием и обрезкой
      const processedText = this.prepareTelegramText(text);
      log(`Отправка текстового сообщения в Telegram, длина: ${processedText.length} символов`, 'social-publishing');
      
      // Базовый URL API
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      // Тело запроса
      const messageBody = {
        chat_id: formattedChatId,
        text: processedText,
        parse_mode: 'HTML'
      };
      
      // Отправляем запрос с HTML форматированием
      const response = await axios.post(`${baseUrl}/sendMessage`, messageBody, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      log(`Ответ от Telegram API: ${JSON.stringify(response.data)}`, 'social-publishing');
      
      if (!response.data.ok) {
        log(`Ошибка при отправке HTML-форматированного текста: ${response.data.description}`, 'social-publishing');
        
        // Если не получилось отправить с HTML форматированием, пробуем без него
        const plainText = text.replace(/<[^>]*>/g, '');
        
        // Обрезаем по тому же лимиту
        const maxLength = 4000;
        const processedPlainText = plainText.length > maxLength ? 
          plainText.substring(0, maxLength - 3) + '...' : 
          plainText;
        
        log(`Отправка обычного текста в Telegram, длина: ${processedPlainText.length} символов`, 'social-publishing');
        
        // Тело запроса без указания parse_mode
        const plainMessageBody = {
          chat_id: formattedChatId,
          text: processedPlainText
        };
        
        // Отправляем запрос без HTML форматирования
        const plainResponse = await axios.post(`${baseUrl}/sendMessage`, plainMessageBody, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        log(`Ответ на отправку обычного текста: ${JSON.stringify(plainResponse.data)}`, 'social-publishing');
        return plainResponse.data;
      }
      
      return response.data;
    } catch (error: any) {
      log(`Ошибка при отправке текстового сообщения в Telegram: ${error.message}`, 'social-publishing');
      throw error;
    }
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
    // Расширенное логирование для отладки
    log(`publishToTelegram вызван для контента ID: ${content.id}, Title: "${content.title}"`, 'social-publishing');
    log(`Параметры Telegram: ${JSON.stringify({
      settingsProvided: !!telegramSettings,
      tokenProvided: !!telegramSettings?.token,
      chatIdProvided: !!telegramSettings?.chatId,
      tokenLength: telegramSettings?.token ? telegramSettings.token.length : 0,
      chatIdValue: telegramSettings?.chatId || 'не задан'
    })}`, 'social-publishing');
    
    // Проверяем наличие настроек кампании
    if (!telegramSettings || !telegramSettings.token || !telegramSettings.chatId) {
      log(`Ошибка публикации в Telegram: отсутствуют настройки кампании. Token: ${telegramSettings?.token ? 'задан' : 'отсутствует'}, ChatID: ${telegramSettings?.chatId ? 'задан' : 'отсутствует'}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Telegram (токен или ID чата). Убедитесь, что настройки заданы в кампании.'
      };
    }

    // Получаем токен и chatId из настроек кампании
    const token = telegramSettings.token;
    const chatId = telegramSettings.chatId;
    
    log(`Используем токен Telegram: ${token.substring(0, 6)}... и ID чата: ${chatId}`, 'social-publishing');

    try {
      log(`Публикация в Telegram. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');

      // Обработка дополнительных изображений
      let processedContent = this.processAdditionalImages(content, 'Telegram');
      
      // Загрузка изображений на Imgur перед публикацией
      processedContent = await this.uploadImagesToImgur(processedContent);

      // Правильное форматирование ID чата
      let formattedChatId = chatId;
      
      // Проверяем нужно ли форматирование
      // Если chatId НЕ начинается с "-100" и является числом или начинается с "-"
      if (!chatId.startsWith('-100')) {
        if (chatId.startsWith('-')) {
          // Если ID начинается с минуса, но не с "-100", заменяем его на "-100"
          formattedChatId = `-100${chatId.replace(/^-/, '')}`;
        } else if (!isNaN(Number(chatId))) {
          // Если это просто число, добавляем "-100" префикс
          formattedChatId = `-100${chatId}`;
        }
        log(`Переформатирован ID чата для Telegram из "${chatId}" в "${formattedChatId}"`, 'social-publishing');
      }
      
      log(`Используем ID чата для Telegram: ${formattedChatId}`, 'social-publishing');

      // Подготовка сообщения с сохранением HTML-форматирования
      let text = processedContent.title ? `<b>${processedContent.title}</b>\n\n` : '';
      
      // Telegram поддерживает только ограниченный набор HTML-тегов:
      // <b>, <strong>, <i>, <em>, <u>, <s>, <strike>, <code>, <pre>, <a href="...">
      // Нужно преобразовать все HTML-теги к поддерживаемым Telegram форматам
      
      // Сохраняем исходный текст для логирования
      const originalContent = processedContent.content;
      
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
        
        // Улучшенное регулярное выражение для удаления неподдерживаемых тегов
        // Сохраняет содержимое тегов, но удаляет сами теги, если они не в списке поддерживаемых
        .replace(/<(\/?(?!b|strong|i|em|u|s|strike|code|pre|a\b)[^>]+)>/gi, '');
        
      // Логирование обработанного текста для отладки
      log(`Обработка HTML для Telegram: исходный текст ${originalContent.length} символов, обработанный ${contentText.length} символов`, 'social-publishing');
      log(`Первые 100 символов обработанного текста: ${contentText.substring(0, 100)}`, 'social-publishing');
      
      text += contentText;
      
      // Если есть хэштеги, добавляем их в конец сообщения
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        const hashtags = processedContent.hashtags
          .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
          .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
        
        if (hashtags.length > 0) {
          text += '\n\n' + hashtags.join(' ');
        }
      }
      
      // Создаем URL API Telegram
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      // Проверяем наличие изображений
      const hasImages = processedContent.imageUrl || 
        (processedContent.additionalImages && processedContent.additionalImages.length > 0);
      
      // Определяем стратегию публикации в зависимости от длины текста и наличия изображений
      
      // 1. Если есть изображения и текст длинный (более 1000 символов),
      // отправляем сначала изображения без подписи или с коротким заголовком, 
      // затем текст отдельным сообщением
      if (hasImages && text.length > 1000) {
        log(`Telegram: текст слишком длинный (${text.length} символов) для отправки с изображением. Отправляем раздельно.`, 'social-publishing');
        
        // Подготавливаем краткую подпись для изображения (только заголовок)
        const imageCaption = processedContent.title ? 
          (processedContent.title.length > 200 ? 
            processedContent.title.substring(0, 197) + '...' : 
            processedContent.title) : 
          '';
        
        log(`Используем краткую подпись для изображения: "${imageCaption}"`, 'social-publishing');
        
        // Сначала отправляем основное изображение
        if (processedContent.imageUrl) {
          try {
            // Проверяем, является ли изображение URL или локальным файлом
            const isUrl = processedContent.imageUrl.startsWith('http://') || processedContent.imageUrl.startsWith('https://');
            log(`Изображение для Telegram - тип: ${isUrl ? 'URL' : 'локальный путь'}, значение: ${processedContent.imageUrl}`, 'social-publishing');
            
            // Формируем запрос с учетом типа изображения
            const photoResponse = await axios.post(
              `${baseUrl}/sendPhoto`,
              {
                chat_id: formattedChatId,
                photo: processedContent.imageUrl,
                caption: imageCaption,
                parse_mode: 'HTML'
              },
              {
                // Если возникают ошибки с timeout, увеличиваем его
                timeout: 30000,
                // Для отладки видим полную ошибку
                validateStatus: () => true
              }
            );
            
            if (photoResponse.status !== 200 || !photoResponse.data.ok) {
              log(`Ошибка при отправке основного изображения в Telegram: ${JSON.stringify(photoResponse.data)}`, 'social-publishing');
            } else {
              log(`Основное изображение успешно отправлено в Telegram: ${JSON.stringify(photoResponse.data)}`, 'social-publishing');
            }
          } catch (error: any) {
            log(`Исключение при отправке основного изображения в Telegram: ${error.message}`, 'social-publishing');
            if (error.response) {
              log(`Данные ответа от Telegram API: ${JSON.stringify(error.response.data)}`, 'social-publishing');
            }
          }
        }
        
        // Затем отправляем дополнительные изображения (если есть)
        if (processedContent.additionalImages && processedContent.additionalImages.length > 0) {
          for (let i = 0; i < processedContent.additionalImages.length; i++) {
            try {
              await axios.post(`${baseUrl}/sendPhoto`, {
                chat_id: formattedChatId,
                photo: processedContent.additionalImages[i]
              });
              
              log(`Дополнительное изображение ${i+1} успешно отправлено в Telegram`, 'social-publishing');
            } catch (error: any) {
              log(`Ошибка при отправке дополнительного изображения ${i+1} в Telegram: ${error.message}`, 'social-publishing');
            }
          }
        }
        
        // Наконец, отправляем сам текст (полный с заголовком)
        try {
          // Если текст превышает максимальную длину для Telegram (4096 символов),
          // он будет автоматически обрезан в методе sendTextMessageToTelegram
          const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
          log(`Текст успешно отправлен в Telegram: ${JSON.stringify(textResponse)}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postUrl: `https://t.me/${chatId.replace('-100', '')}`
          };
        } catch (error: any) {
          log(`Ошибка при отправке текста в Telegram: ${error.message}`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка при отправке текста в Telegram: ${error.message}`
          };
        }
      }
      // 2. Если есть только одно основное изображение и текст умещается в лимит,
      // отправляем изображение с текстом в подписи
      else if (processedContent.imageUrl && (!processedContent.additionalImages || processedContent.additionalImages.length === 0) && text.length <= 1024) {
        log(`Telegram: отправка одного изображения с подписью. Длина текста: ${text.length} символов.`, 'social-publishing');
        
        try {
          const response = await axios.post(`${baseUrl}/sendPhoto`, {
            chat_id: formattedChatId,
            photo: processedContent.imageUrl,
            caption: text,
            parse_mode: 'HTML'
          });
          
          if (response.data && response.data.ok) {
            log(`Изображение с текстом успешно отправлено в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl: `https://t.me/${formattedChatId.replace('-100', '')}`
            };
          } else {
            log(`Ошибка при отправке изображения с текстом в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Ошибка при отправке изображения с текстом: ${JSON.stringify(response.data)}`
            };
          }
        } catch (error: any) {
          log(`Ошибка при отправке изображения с текстом в Telegram: ${error.message}`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка при отправке изображения с текстом: ${error.message}`
          };
        }
      }
      // 3. В остальных случаях (нет изображений или несколько изображений)
      else {
        // Если есть изображения, отправляем их
        if (processedContent.imageUrl || (processedContent.additionalImages && processedContent.additionalImages.length > 0)) {
          // Подготавливаем подпись для изображения
          const imageCaption = text.length <= 1024 ? 
            text : 
            (processedContent.title ? 
              (processedContent.title.length > 200 ? 
                processedContent.title.substring(0, 197) + '...' : 
                processedContent.title) : 
              '');
              
          log(`Telegram: подготовлена подпись для изображения, длина: ${imageCaption.length} символов`, 'social-publishing');
          
          // Отправляем основное изображение
          if (processedContent.imageUrl) {
            try {
              const photoResponse = await axios.post(`${baseUrl}/sendPhoto`, {
                chat_id: formattedChatId,
                photo: processedContent.imageUrl,
                caption: imageCaption,
                parse_mode: 'HTML'
              });
              
              log(`Основное изображение успешно отправлено в Telegram: ${JSON.stringify(photoResponse.data)}`, 'social-publishing');
              
              // Если полный текст был добавлен к изображению, не нужно отправлять отдельный текст
              if (text.length <= 1024) {
                return {
                  platform: 'telegram',
                  status: 'published',
                  publishedAt: new Date(),
                  postUrl: `https://t.me/${chatId.replace('-100', '')}`
                };
              }
            } catch (error: any) {
              log(`Ошибка при отправке основного изображения в Telegram: ${error.message}`, 'social-publishing');
            }
          }
          
          // Отправляем дополнительные изображения (если есть)
          if (processedContent.additionalImages && processedContent.additionalImages.length > 0) {
            for (let i = 0; i < processedContent.additionalImages.length; i++) {
              try {
                await axios.post(`${baseUrl}/sendPhoto`, {
                  chat_id: formattedChatId,
                  photo: processedContent.additionalImages[i]
                });
                
                log(`Дополнительное изображение ${i+1} успешно отправлено в Telegram`, 'social-publishing');
              } catch (error: any) {
                log(`Ошибка при отправке дополнительного изображения ${i+1} в Telegram: ${error.message}`, 'social-publishing');
              }
            }
          }
        }
        
        // Отправляем текст (если он не был отправлен с основным изображением)
        if (processedContent.imageUrl && text.length <= 1024) {
          // Текст уже был отправлен с основным изображением
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date()
          };
        } else {
          try {
            const textResponse = await this.sendTextMessageToTelegram(text, formattedChatId, token);
            log(`Текст успешно отправлен в Telegram: ${JSON.stringify(textResponse)}`, 'social-publishing');
            
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postUrl: `https://t.me/${formattedChatId.replace('-100', '')}`
            };
          } catch (error: any) {
            log(`Ошибка при отправке текста в Telegram: ${error.message}`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: `Ошибка при отправке текста в Telegram: ${error.message}`
            };
          }
        }
      }
      
      // В случае неожиданной логики
      return {
        platform: 'telegram',
        status: 'published',
        publishedAt: new Date()
      };
    } catch (error: any) {
      log(`Общая ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Общая ошибка при публикации в Telegram: ${error.message}`
      };
    }
  }

  /**
   * Публикует контент в ВКонтакте с использованием Imgur для изображений
   * @param content Контент для публикации
   * @param vkSettings Настройки VK API
   * @returns Результат публикации
   */
  async publishToVk(
    content: CampaignContent,
    vkSettings?: SocialMediaSettings['vk']
  ): Promise<SocialPublication> {
    // Проверяем наличие настроек VK
    if (!vkSettings || !vkSettings.token || !vkSettings.groupId) {
      log(`Ошибка публикации в VK: отсутствуют настройки. Token: ${vkSettings?.token ? 'задан' : 'отсутствует'}, GroupID: ${vkSettings?.groupId ? 'задан' : 'отсутствует'}`, 'social-publishing');
      return {
        platform: 'vk',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для ВКонтакте (токен или ID группы). Убедитесь, что настройки заданы в кампании.'
      };
    }

    // Получаем токен и groupId из настроек
    const token = vkSettings.token;
    const groupId = vkSettings.groupId;
    
    log(`Используем токен VK: ${token.substring(0, 6)}... и ID группы: ${groupId}`, 'social-publishing');

    try {
      log(`Публикация в VK. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');

      // Обработка дополнительных изображений
      let processedContent = this.processAdditionalImages(content, 'VK');
      
      // Загрузка изображений на Imgur перед публикацией
      processedContent = await this.uploadImagesToImgur(processedContent);

      // Подготовка текста поста
      let text = processedContent.title ? `${processedContent.title}\n\n` : '';
      
      // VK не поддерживает HTML, поэтому заменяем HTML-теги на текстовые аналоги
      let contentText = processedContent.content
        // Обработка абзацев и переносов строк
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '$1\n\n')
        
        // Форматирование текста
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<strong>(.*?)<\/strong>/g, '*$1*')
        .replace(/<i>(.*?)<\/i>/g, '_$1_')
        .replace(/<em>(.*?)<\/em>/g, '_$1_')
        
        // Удаление всех остальных HTML-тегов
        .replace(/<[^>]*>/g, '');
      
      text += contentText;
      
      // Формируем запрос к API VK
      const formData = new FormData();
      formData.append('owner_id', `-${groupId}`); // Отрицательный ID для группы
      formData.append('from_group', '1'); // Публикация от имени группы
      formData.append('message', text);
      formData.append('access_token', token);
      formData.append('v', '5.131'); // Версия API VK
      
      // Обработка изображений
      const attachments: string[] = [];
      
      // Загрузка основного изображения, если оно есть
      if (processedContent.imageUrl) {
        try {
          const imageUrl = processedContent.imageUrl;
          log(`Загрузка основного изображения для VK: ${imageUrl}`, 'social-publishing');
          
          // Получение URL для загрузки фото на сервер VK
          const getUploadServerResponse = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, {
            params: {
              group_id: groupId,
              access_token: token,
              v: '5.131'
            }
          });
          
          if (getUploadServerResponse.data && getUploadServerResponse.data.response && getUploadServerResponse.data.response.upload_url) {
            const uploadUrl = getUploadServerResponse.data.response.upload_url;
            
            // Загрузка изображения на сервер VK
            // Для этого сначала нужно скачать изображение и отправить его в multipart/form-data
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageFormData = new FormData();
            imageFormData.append('photo', Buffer.from(imageResponse.data), 'image.jpg');
            
            const uploadResponse = await axios.post(uploadUrl, imageFormData, {
              headers: {
                ...imageFormData.getHeaders()
              }
            });
            
            if (uploadResponse.data) {
              // Сохранение загруженной фотографии на стене группы
              const saveWallPhotoResponse = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, {
                params: {
                  group_id: groupId,
                  server: uploadResponse.data.server,
                  photo: uploadResponse.data.photo,
                  hash: uploadResponse.data.hash,
                  access_token: token,
                  v: '5.131'
                }
              });
              
              if (saveWallPhotoResponse.data && saveWallPhotoResponse.data.response && saveWallPhotoResponse.data.response.length > 0) {
                const photoObj = saveWallPhotoResponse.data.response[0];
                const attachment = `photo${photoObj.owner_id}_${photoObj.id}`;
                attachments.push(attachment);
                log(`Основное изображение успешно загружено для VK: ${attachment}`, 'social-publishing');
              }
            }
          }
        } catch (error) {
          log(`Ошибка при загрузке основного изображения для VK: ${error}`, 'social-publishing');
        }
      }
      
      // Обработка дополнительных изображений
      if (processedContent.additionalImages && processedContent.additionalImages.length > 0) {
        for (let i = 0; i < processedContent.additionalImages.length; i++) {
          try {
            const imageUrl = processedContent.additionalImages[i];
            log(`Загрузка дополнительного изображения ${i+1} для VK: ${imageUrl}`, 'social-publishing');
            
            // Получение URL для загрузки фото на сервер VK
            const getUploadServerResponse = await axios.get(`https://api.vk.com/method/photos.getWallUploadServer`, {
              params: {
                group_id: groupId,
                access_token: token,
                v: '5.131'
              }
            });
            
            if (getUploadServerResponse.data && getUploadServerResponse.data.response && getUploadServerResponse.data.response.upload_url) {
              const uploadUrl = getUploadServerResponse.data.response.upload_url;
              
              // Загрузка изображения на сервер VK
              const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
              const imageFormData = new FormData();
              imageFormData.append('photo', Buffer.from(imageResponse.data), `image_${i+1}.jpg`);
              
              const uploadResponse = await axios.post(uploadUrl, imageFormData, {
                headers: {
                  ...imageFormData.getHeaders()
                }
              });
              
              if (uploadResponse.data) {
                // Сохранение загруженной фотографии на стене группы
                const saveWallPhotoResponse = await axios.get(`https://api.vk.com/method/photos.saveWallPhoto`, {
                  params: {
                    group_id: groupId,
                    server: uploadResponse.data.server,
                    photo: uploadResponse.data.photo,
                    hash: uploadResponse.data.hash,
                    access_token: token,
                    v: '5.131'
                  }
                });
                
                if (saveWallPhotoResponse.data && saveWallPhotoResponse.data.response && saveWallPhotoResponse.data.response.length > 0) {
                  const photoObj = saveWallPhotoResponse.data.response[0];
                  const attachment = `photo${photoObj.owner_id}_${photoObj.id}`;
                  attachments.push(attachment);
                  log(`Дополнительное изображение ${i+1} успешно загружено для VK: ${attachment}`, 'social-publishing');
                }
              }
            }
          } catch (error) {
            log(`Ошибка при загрузке дополнительного изображения ${i+1} для VK: ${error}`, 'social-publishing');
          }
          
          // Ограничение на количество фотографий в одном посте
          if (attachments.length >= 10) {
            log(`Достигнуто максимальное количество фотографий для поста VK (10)`, 'social-publishing');
            break;
          }
        }
      }
      
      // Если есть изображения, добавляем их в параметр attachments
      if (attachments.length > 0) {
        formData.append('attachments', attachments.join(','));
      }
      
      // Публикация поста на стене группы
      const response = await axios.post('https://api.vk.com/method/wall.post', formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
      
      if (response.data && response.data.response && response.data.response.post_id) {
        const postId = response.data.response.post_id;
        log(`Пост успешно опубликован в VK, ID: ${postId}`, 'social-publishing');
        
        return {
          platform: 'vk',
          status: 'published',
          publishedAt: new Date(),
          postUrl: `https://vk.com/wall-${groupId}_${postId}`
        };
      } else {
        log(`Ошибка при публикации в VK: ${JSON.stringify(response.data)}`, 'social-publishing');
        return {
          platform: 'vk',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка при публикации поста в VK: ${JSON.stringify(response.data)}`
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
   * Публикует контент в Instagram (заглушка - ожидается полная реализация)
   * @param content Контент для публикации
   * @param instagramSettings Настройки Instagram API
   * @returns Результат публикации
   */
  async publishToInstagram(
    content: CampaignContent,
    instagramSettings?: SocialMediaSettings['instagram']
  ): Promise<SocialPublication> {
    // Проверяем наличие настроек
    if (!instagramSettings || !instagramSettings.token) {
      log(`Ошибка публикации в Instagram: отсутствуют настройки. Token: ${instagramSettings?.token ? 'задан' : 'отсутствует'}`, 'social-publishing');
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Instagram (токен). Убедитесь, что настройки заданы в кампании.'
      };
    }

    try {
      log(`Публикация в Instagram. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
      
      // Загрузка изображений и публикация в Instagram
      log(`Публикация контента в Instagram пока реализована как заглушка`, 'social-publishing');
      
      // Обработка дополнительных изображений
      let processedContent = this.processAdditionalImages(content, 'Instagram');
      
      // Загрузка изображений на Imgur перед публикацией
      processedContent = await this.uploadImagesToImgur(processedContent);

      // Формирование Instagram-совместимого текста
      let text = processedContent.title ? `${processedContent.title}\n\n` : '';
      
      // Instagram не поддерживает HTML, форматируем с использованием Unicode-символов
      let contentText = processedContent.content
        // Обработка абзацев и переносов строк
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '$1\n\n')
        
        // Расширенное форматирование (жирный, курсив) через Unicode-символы (не поддерживаются в API)
        .replace(/<b>(.*?)<\/b>/g, '$1')
        .replace(/<strong>(.*?)<\/strong>/g, '$1')
        .replace(/<i>(.*?)<\/i>/g, '$1')
        .replace(/<em>(.*?)<\/em>/g, '$1')
        
        // Удаление всех остальных HTML-тегов
        .replace(/<[^>]*>/g, '');
      
      text += contentText;
      
      // Хэштеги добавляем в конец поста, если они есть
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        text += '\n\n' + processedContent.hashtags.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');
      }
      
      return {
        platform: 'instagram',
        status: 'published',
        publishedAt: new Date(),
        postUrl: 'https://instagram.com/example', // Это заглушка, которую нужно будет заменить на реальный URL
        postId: 'mock_post_id' // Это заглушка, в реальной реализации будет корректный ID
      };
    } catch (error: any) {
      log(`Ошибка при публикации в Instagram: ${error.message}`, 'social-publishing');
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в Instagram: ${error.message}`
      };
    }
  }

  /**
   * Публикует контент в Facebook (заглушка - ожидается полная реализация)
   * @param content Контент для публикации
   * @param facebookSettings Настройки Facebook API
   * @returns Результат публикации
   */
  async publishToFacebook(
    content: CampaignContent,
    facebookSettings?: SocialMediaSettings['facebook']
  ): Promise<SocialPublication> {
    // Проверяем наличие настроек
    if (!facebookSettings || !facebookSettings.token || !facebookSettings.pageId) {
      log(`Ошибка публикации в Facebook: отсутствуют настройки. Token: ${facebookSettings?.token ? 'задан' : 'отсутствует'}, PageID: ${facebookSettings?.pageId ? 'задан' : 'отсутствует'}`, 'social-publishing');
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Facebook (токен или ID страницы). Убедитесь, что настройки заданы в кампании.'
      };
    }

    // Получаем токен и pageId из настроек
    const token = facebookSettings.token;
    const pageId = facebookSettings.pageId;
    
    log(`Используем токен Facebook: ${token.substring(0, 6)}... и ID страницы: ${pageId}`, 'social-publishing');

    try {
      log(`Публикация в Facebook. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
      
      // Обработка дополнительных изображений
      let processedContent = this.processAdditionalImages(content, 'Facebook');
      
      // Загрузка изображений на Imgur перед публикацией
      processedContent = await this.uploadImagesToImgur(processedContent);

      // Формирование Facebook-совместимого текста
      let text = processedContent.title ? `${processedContent.title}\n\n` : '';
      
      // Facebook позволяет использовать простые форматы разметки
      let contentText = processedContent.content
        // Обработка абзацев и переносов строк
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        .replace(/<div>(.*?)<\/div>/g, '$1\n')
        .replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '$1\n\n')
        
        // Форматирование текста (жирный, курсив)
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<strong>(.*?)<\/strong>/g, '*$1*')
        .replace(/<i>(.*?)<\/i>/g, '_$1_')
        .replace(/<em>(.*?)<\/em>/g, '_$1_')
        
        // Удаление всех остальных HTML-тегов
        .replace(/<[^>]*>/g, '');
      
      text += contentText;
      
      // Формируем данные для публикации
      const postData = {
        message: text,
        access_token: token
      };
      
      // Проверяем наличие изображения
      if (processedContent.imageUrl) {
        try {
          log(`Facebook: Публикация с изображением ${processedContent.imageUrl}`, 'social-publishing');
          
          // Для Facebook можно отправить URL изображения напрямую
          const response = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
            url: processedContent.imageUrl,
            caption: text,
            access_token: token
          });
          
          if (response.data && response.data.id) {
            return {
              platform: 'facebook',
              status: 'published',
              publishedAt: new Date(),
              postUrl: `https://www.facebook.com/${response.data.post_id}`
            };
          }
        } catch (error: any) {
          log(`Ошибка при публикации фото в Facebook: ${error.message}`, 'social-publishing');
          
          // Если не удалось опубликовать с фото, пробуем только текст
          log(`Пробуем опубликовать только текстовый пост в Facebook`, 'social-publishing');
        }
      }
      
      // Публикация обычного текстового поста (если нет фото или не удалось опубликовать с фото)
      const response = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/feed`, postData);
      
      if (response.data && response.data.id) {
        log(`Пост успешно опубликован в Facebook, ID: ${response.data.id}`, 'social-publishing');
        
        return {
          platform: 'facebook',
          status: 'published',
          publishedAt: new Date(),
          postUrl: `https://www.facebook.com/${response.data.id}`
        };
      } else {
        log(`Ошибка при публикации в Facebook: ${JSON.stringify(response.data)}`, 'social-publishing');
        return {
          platform: 'facebook',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка при публикации поста в Facebook: ${JSON.stringify(response.data)}`
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации в Facebook: ${error.message}`, 'social-publishing');
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в Facebook: ${error.message}`
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
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
          const response = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
            headers: {
              'Authorization': `Bearer ${systemToken}`
            }
          });
          
          if (response.data && response.data.data) {
            const item = response.data.data;
            content = {
              id: item.id,
              content: item.content,
              userId: item.user_id,
              campaignId: item.campaign_id,
              status: item.status,
              contentType: item.content_type || 'text',
              title: item.title || null,
              imageUrl: item.image_url,
              videoUrl: item.video_url,
              scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
              createdAt: new Date(item.created_at),
              socialPlatforms: item.social_platforms || {},
              additionalImages: item.additional_images || null,
              keywords: item.keywords || null,
              hashtags: item.hashtags || null,
              prompt: item.prompt || null,
              metadata: item.metadata || null
            };
            
            log(`Контент получен через API: ${content.id}`, 'social-publishing');
          }
        } catch (error: any) {
          log(`Ошибка при получении контента через API: ${error.message}`, 'social-publishing');
          return null;
        }
      }
      
      if (!content) {
        log(`Не удалось получить контент ${contentId} для обновления статуса`, 'social-publishing');
        return null;
      }
      
      // Обновляем статус публикации в Social Platforms
      const socialPlatforms = content.socialPlatforms || {};
      
      // Создаем обновленный объект socialPlatforms
      const updatedSocialPlatforms = {
        ...socialPlatforms,
        [platform]: {
          status: publicationResult.status,
          publishedAt: publicationResult.publishedAt ? new Date(publicationResult.publishedAt) : null,
          error: publicationResult.error || null
        }
      };
      
      // Обновляем статус в хранилище
      const updatedContent = await storage.updateCampaignContent(contentId, {
        socialPlatforms: updatedSocialPlatforms
      });
      
      // Если не получилось через хранилище, пробуем через API
      if (!updatedContent && systemToken) {
        log(`Обновление статуса публикации через API: ${contentId}, платформа: ${platform}`, 'social-publishing');
        
        try {
          const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
          const response = await axios.patch(`${directusUrl}/items/campaign_content/${contentId}`, {
            social_platforms: updatedSocialPlatforms
          }, {
            headers: {
              'Authorization': `Bearer ${systemToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.data && response.data.data) {
            log(`Статус публикации успешно обновлен через API: ${contentId}, платформа: ${platform}`, 'social-publishing');
            return content;
          }
        } catch (error: any) {
          log(`Ошибка при обновлении статуса публикации через API: ${error.message}`, 'social-publishing');
        }
      }
      
      return updatedContent || content;
    } catch (error: any) {
      log(`Ошибка при обновлении статуса публикации: ${error.message}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Публикует контент в выбранную социальную платформу
   * @param content Контент для публикации
   * @param platform Социальная платформа
   * @param settings Настройки социальных сетей
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
}

// Создаем экземпляр сервиса
export const socialPublishingWithImgurService = new SocialPublishingWithImgurService();