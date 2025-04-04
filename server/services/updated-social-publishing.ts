/**
 * Исправленная версия сервиса публикации в социальные сети
 * с поддержкой загрузки изображений из Directus
 */

import axios from 'axios';
import { CampaignContent } from '../types/campaignContent';
import { SocialMediaSettings, SocialPlatform, SocialPublication } from '../types/socialMedia';
import { getTelegramPublisher } from './telegram-publisher-bridge';
import { directusApiManager } from '../directus';
import { storage } from '../storage';
import { directusCrud } from '../services/directus-crud';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs';
import os from 'os';

type StoredImage = {
  id: string;
  storage: string;
};

/**
 * Сервис для публикации контента в социальные сети
 */
class SocialPublishingService {
  private telegramPublisherCache: any | null = null;

  constructor() {
    console.log('Инициализация сервиса публикации в социальные сети (исправленная версия)');
  }

  /**
   * Инициализирует издателя Telegram
   */
  private async initTelegramPublisher() {
    try {
      // Проверяем, есть ли доступ к переменным окружения для Directus
      const directusEmail = process.env.DIRECTUS_EMAIL;
      const directusPassword = process.env.DIRECTUS_PASSWORD;
      const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
      
      if (!directusEmail || !directusPassword) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют учетные данные Directus в переменных окружения!');
        console.error('Необходимы DIRECTUS_EMAIL и DIRECTUS_PASSWORD для работы с изображениями Directus');
      }
      
      // Инициализируем только один раз
      if (!this.telegramPublisherCache) {
        console.log('Инициализация Telegram Publisher');
        console.log(`Используем Directus URL: ${directusUrl}`);
        console.log(`Наличие учетных данных Directus: ${!!directusEmail && !!directusPassword}`);
        
        this.telegramPublisherCache = await getTelegramPublisher({
          verbose: true,
          directusEmail,
          directusPassword,
          directusUrl
        });
        
        console.log('Telegram Publisher успешно инициализирован');
      } else {
        console.log('Используем существующий экземпляр Telegram Publisher');
      }
      
      return this.telegramPublisherCache;
    } catch (error) {
      console.error('КРИТИЧЕСКАЯ ОШИБКА при инициализации Telegram Publisher:', error);
      
      // Пробуем переинициализировать в случае ошибки
      console.log('Попытка переинициализации Telegram Publisher...');
      this.telegramPublisherCache = null;
      
      try {
        this.telegramPublisherCache = await getTelegramPublisher({
          verbose: true,
          directusEmail: process.env.DIRECTUS_EMAIL,
          directusPassword: process.env.DIRECTUS_PASSWORD,
          directusUrl: process.env.DIRECTUS_URL || 'https://db.nplanner.ru'
        });
        console.log('Повторная инициализация Telegram Publisher успешна');
        return this.telegramPublisherCache;
      } catch (retryError) {
        console.error('Повторная инициализация Telegram Publisher не удалась:', retryError);
        throw new Error(`Невозможно инициализировать Telegram Publisher: ${error.message || 'Неизвестная ошибка'}`);
      }
    }
  }

  async publishToPlatform(content: CampaignContent, platform: string, socialSettings: any): Promise<any> {
    try {
      console.log(`Публикация в ${platform}...`);
      
      // Проверяем поддерживаемые платформы
      if (!['telegram', 'vk', 'instagram', 'facebook'].includes(platform)) {
        return {
          platform,
          status: 'error',
          publishedAt: null,
          error: `Неподдерживаемая платформа: ${platform}`,
          userId: null
        };
      }
      
      // Получаем настройки платформы
      const settings = socialSettings || {};
      
      // Проверяем настройки платформы
      if (!settings[platform]) {
        return {
          platform,
          status: 'error',
          publishedAt: null,
          error: `Отсутствуют настройки для платформы ${platform}`,
          userId: null
        };
      }
      
      // Публикуем в соответствующую платформу
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
          platform,
          status: 'error',
          publishedAt: null,
          error: `Неподдерживаемая платформа: ${platform}`,
          userId: null
        };
      }
    } catch (error) {
      console.error(`Ошибка при публикации в ${platform}:`, error);
      return {
        platform,
        status: 'error',
        publishedAt: null,
        error: `Ошибка: ${error.message || error}`,
        userId: null
      };
    }
  }
  
  async updatePublicationStatus(contentId: string, platform: string, result: any): Promise<void> {
    try {
      // Получаем текущий контент
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        console.error(`Не удалось найти контент с ID ${contentId} для обновления статуса публикации`);
        return;
      }
      
      // Инициализируем socialPlatforms, если он отсутствует
      const socialPlatforms = content.socialPlatforms || {};
      
      // Обновляем статус для указанной платформы
      socialPlatforms[platform] = {
        status: result.status,
        publishedAt: result.publishedAt,
        error: result.error,
        userId: result.userId,
        postId: result.postId,
        postUrl: result.postUrl
      };
      
      // Проверяем, все ли платформы опубликованы
      const allPublished = Object.values(socialPlatforms).every(p => p.status === 'published');
      const hasErrors = Object.values(socialPlatforms).some(p => p.status === 'error');
      
      // Определяем общий статус контента
      let status = content.status;
      if (allPublished) {
        status = 'published';
      } else if (hasErrors) {
        status = 'error';
      }
      
      // Обновляем контент
      await storage.updateCampaignContent(contentId, {
        status,
        socialPlatforms
      });
      
      console.log(`Статус публикации для контента ${contentId} в ${platform} обновлен на ${result.status}`);
    } catch (error) {
      console.error(`Ошибка при обновлении статуса публикации:`, error);
    }
  }
  
  /**
   * Возвращает полную информацию о контенте для конкретной платформы
   * (добавляя процессинг текста для социальных сетей, находя ID медиа и т.д.)
   * @param content Исходный контент
   * @param platform Платформа
   * @returns Подготовленный для публикации контент
   */
  processContentForPlatform(content: CampaignContent, platform: string): any {
    try {
      // Базовая проверка
      if (!content || !platform) return null;
      
      // Текст контента
      let text = content.text || '';
      
      // Подготовленный объект
      const processedContent = {
        id: content.id,
        campaignId: content.campaignId,
        text: content.text,
        processedText: text, // Изначально без изменений
        primaryImage: content.primary_image,
        additionalImages: content.additional_images || [],
        platform
      };
      
      // Форматируем текст для конкретной платформы
      switch (platform) {
      case 'telegram':
        // Для Telegram поддерживаем HTML разметку
        processedContent.processedText = this.formatTextForTelegram(text);
        break;
      case 'vk':
        // Для VK просто оставляем текст как есть
        break;
      case 'instagram':
        // Для Instagram ограничиваем длину до 2200 символов
        if (text.length > 2200) {
          processedContent.processedText = text.substring(0, 2197) + '...';
        }
        break;
      case 'facebook':
        // Для Facebook оставляем текст как есть
        break;
      }
      
      return processedContent;
    } catch (error) {
      console.error(`Ошибка при подготовке контента для ${platform}:`, error);
      return null;
    }
  }
  
  /**
   * Форматирует текст для публикации в Telegram
   * @param text Исходный текст
   * @returns Отформатированный текст с HTML-разметкой
   */
  formatTextForTelegram(text: string): string {
    if (!text) return '';
    
    // Для Telegram поддерживается ограниченный набор HTML-тегов:
    // <b>, <i>, <u>, <s>, <code>, <pre>, <a href=""> (без дополнительных атрибутов)
    
    // Заменяем специальные символы на HTML-сущности
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Восстанавливаем поддерживаемые теги
    formatted = formatted
      .replace(/&lt;b&gt;/g, '<b>')
      .replace(/&lt;\/b&gt;/g, '</b>')
      .replace(/&lt;i&gt;/g, '<i>')
      .replace(/&lt;\/i&gt;/g, '</i>')
      .replace(/&lt;u&gt;/g, '<u>')
      .replace(/&lt;\/u&gt;/g, '</u>')
      .replace(/&lt;s&gt;/g, '<s>')
      .replace(/&lt;\/s&gt;/g, '</s>')
      .replace(/&lt;code&gt;/g, '<code>')
      .replace(/&lt;\/code&gt;/g, '</code>')
      .replace(/&lt;pre&gt;/g, '<pre>')
      .replace(/&lt;\/pre&gt;/g, '</pre>');
    
    // Восстанавливаем теги ссылок с атрибутом href
    const linkRegex = /&lt;a\s+href=["'](.*?)["']&gt;(.*?)&lt;\/a&gt;/g;
    formatted = formatted.replace(linkRegex, '<a href="$1">$2</a>');
    
    return formatted;
  }
  
  /**
   * Загружает изображение из URL в память
   * @param imageUrl URL изображения
   * @returns Buffer с данными изображения и тип контента
   */
  async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      console.log(`Скачивание изображения: ${imageUrl}`);
      
      // Определяем, не является ли URL локальным файлом
      if (imageUrl.startsWith('file://')) {
        const filePath = imageUrl.replace('file://', '');
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          const contentType = this.getContentTypeFromExtension(path.extname(filePath));
          return { buffer, contentType };
        } else {
          throw new Error(`Локальный файл не найден: ${filePath}`);
        }
      }
      
      // Скачиваем изображение
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer'
      });
      
      // Определяем тип контента
      const contentType = response.headers['content-type'] || 'image/jpeg';
      
      return {
        buffer: Buffer.from(response.data),
        contentType
      };
    } catch (error) {
      console.error('Ошибка при скачивании изображения:', error);
      return null;
    }
  }
  
  /**
   * Определяет тип контента по расширению файла
   * @param extension Расширение файла (с точкой)
   * @returns MIME-тип
   */
  getContentTypeFromExtension(extension: string): string {
    switch (extension.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
    }
  }
  
  /**
   * Извлекает URL или ID изображения из контента
   * @param content Объект контента
   * @returns URL или ID изображения
   */
  getImageFromContent(content: CampaignContent): string | null {
    try {
      // Проверяем наличие основного изображения
      if (content.primary_image) {
        // Если это строка (URL), возвращаем её
        if (typeof content.primary_image === 'string') {
          return content.primary_image;
        }
        
        // Если это объект с ID, возвращаем ID
        if (typeof content.primary_image === 'object' && content.primary_image.id) {
          return content.primary_image.id;
        }
        
        // Если это объект со storage, формируем URL для Directus
        if (typeof content.primary_image === 'object' && content.primary_image.storage) {
          const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
          return `${directusUrl}/assets/${content.primary_image.id}`;
        }
      }
      
      // Проверяем наличие дополнительных изображений
      if (content.additional_images && Array.isArray(content.additional_images) && content.additional_images.length > 0) {
        const firstImage = content.additional_images[0];
        
        // Если это строка (URL), возвращаем её
        if (typeof firstImage === 'string') {
          return firstImage;
        }
        
        // Если это объект с ID, возвращаем ID
        if (typeof firstImage === 'object' && firstImage.id) {
          return firstImage.id;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка при извлечении изображения из контента:', error);
      return null;
    }
  }
  
  /**
   * Преобразует ID изображения в полный URL
   * @param imageId ID изображения в Directus
   * @returns Полный URL к изображению
   */
  getImageUrlFromId(imageId: string): string {
    const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
    return `${directusUrl}/assets/${imageId}`;
  }
  
  /**
   * Заменяет временные URL FAL.AI на прямые URL к изображению
   * @param {string} url URL изображения
   * @returns {string} Исправленный URL
   */
  fixImageUrl(url: string): string {
    // Для URL из Directus
    if (url.includes('/assets/')) {
      const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
      
      // Если URL уже содержит полный путь к Directus
      if (url.startsWith('http')) {
        return url;
      }
      
      // Если это относительный путь к ассету
      if (url.startsWith('/assets/')) {
        return `${directusUrl}${url}`;
      }
      
      // Если это только ID ассета
      return `${directusUrl}/assets/${url}`;
    }
    
    // Для URL из FAL.AI
    if (url.includes('https://fal-cdn') || url.includes('queue.fal.ai')) {
      return url.replace(/\/[^/]+\/[^/]+\/[^/]+\/queue\.fal\.ai\/([^/]+)/, '$1');
    }
    
    return url;
  }
  
  /**
   * Метод для загрузки изображения в Telegram и получения file_id
   * @param {string} imageUrl URL изображения для загрузки
   * @param {string} token Токен бота Telegram
   * @returns {Promise<string|null>} file_id загруженного изображения или null в случае ошибки
   */
  async uploadImageToTelegram(imageUrl: string, token: string): Promise<string | null> {
    try {
      console.log(`Загрузка изображения в Telegram: ${imageUrl}`);
      
      // Скачиваем изображение
      const imageInfo = await this.downloadImage(imageUrl);
      if (!imageInfo) {
        console.error('Не удалось скачать изображение');
        return null;
      }
      
      // Создаем временный файл для изображения
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const extension = imageInfo.contentType.split('/')[1] || 'jpg';
      const tempFilePath = path.join(tempDir, `telegram_${Date.now()}.${extension}`);
      
      // Записываем буфер во временный файл
      fs.writeFileSync(tempFilePath, imageInfo.buffer);
      console.log(`Создан временный файл: ${tempFilePath}`);
      
      // Создаем FormData для отправки
      const formData = new FormData();
      formData.append('chat_id', process.env.TELEGRAM_DEV_CHAT_ID || '123456789'); // Используем тестовый чат
      formData.append('photo', fs.createReadStream(tempFilePath));
      
      // Отправляем запрос в Telegram API
      const response = await axios.post(
        `https://api.telegram.org/bot${token}/sendPhoto`,
        formData,
        {
          headers: {
            ...formData.getHeaders()
          }
        }
      );
      
      // Удаляем временный файл
      fs.unlinkSync(tempFilePath);
      console.log('Временный файл удален');
      
      // Проверяем ответ от Telegram API
      if (response.data && response.data.ok) {
        const fileId = response.data.result.photo[0].file_id;
        console.log(`Изображение успешно загружено в Telegram, file_id: ${fileId}`);
        return fileId;
      } else {
        console.error('Ошибка при загрузке изображения в Telegram:', response.data);
        return null;
      }
    } catch (error) {
      console.error('Ошибка при загрузке изображения в Telegram:', error);
      return null;
    }
  }

  /**
   * Отправляет изображение в Telegram
   * Исправленная версия с поддержкой загрузки из Directus и расширенной диагностикой
   * @param {string} imageUrl URL изображения
   * @param {string} chatId ID чата Telegram
   * @param {string} caption Подпись к изображению
   * @param {string} token Токен бота Telegram
   * @returns {Promise<Object>} Результат отправки
   */
  /**
   * Загружает изображение из URL и отправляет его в Telegram
   * Совершенно новая реализация с прямой загрузкой через FormData
   * @param imageUrl URL изображения 
   * @param chatId ID чата Telegram
   * @param caption Текст подписи к изображению
   * @param token Токен бота Telegram
   * @returns Результат API Telegram
   */
  /**
   * Загружает изображение из URL и отправляет его в Telegram
   * с использованием специализированного класса TelegramPublisher
   * @param imageUrl URL изображения для загрузки
   * @param chatId ID чата для отправки
   * @param caption Текст подписи к изображению
   * @param token Токен Telegram API
   * @returns Ответ от Telegram API
   */
  public async uploadTelegramImageFromUrl(
    imageUrl: string,
    chatId: string,
    caption: string,
    token: string
  ): Promise<any> {
    console.log('[TELEGRAM] Начало загрузки и отправки изображения в Telegram через TelegramPublisher...');
    console.log(`[TELEGRAM] URL изображения: ${imageUrl.substring(0, 50)}...`);
    console.log(`[TELEGRAM] ID чата: ${chatId}`);
    
    try {
      // Проверяем исходные параметры
      if (!imageUrl) {
        console.error('ОШИБКА: Пустой URL изображения для отправки в Telegram');
        return {
          ok: false,
          description: 'Ошибка: URL изображения не указан',
          error: 'IMAGE_URL_EMPTY'
        };
      }
      
      if (!chatId) {
        console.error('ОШИБКА: Пустой ID чата Telegram');
        return {
          ok: false,
          description: 'Ошибка: ID чата не указан',
          error: 'CHAT_ID_EMPTY'
        };
      }
      
      if (!token) {
        console.error('ОШИБКА: Пустой токен бота Telegram');
        return {
          ok: false,
          description: 'Ошибка: Токен бота не указан',
          error: 'TOKEN_EMPTY'
        };
      }
      
      // Проверяем, не является ли URL заглушкой или ошибочным URL
      if (
        imageUrl.includes('НЕИЗОБРАЖЕНИЕ') || 
        imageUrl.includes('queue.fal.ai') ||
        imageUrl.includes('placeholder') ||
        imageUrl.includes('error-image')
      ) {
        console.error(`ОШИБКА: Обнаружен некорректный URL изображения: ${imageUrl}`);
        return {
          ok: false,
          description: 'Ошибка: Некорректный URL изображения (обнаружен шаблон ошибки)',
          error: 'INVALID_IMAGE_URL'
        };
      }
      
      // Инициализируем TelegramPublisher через наш мост
      console.log('[TELEGRAM] Инициализация TelegramPublisher через мост...');
      
      try {
        // Используем наш новый мост для отправки изображения
        const telegramPublisher = await this.initTelegramPublisher();
        if (!telegramPublisher) {
          throw new Error('Не удалось инициализировать TelegramPublisher');
        }
        
        console.log('[TELEGRAM] TelegramPublisher успешно инициализирован, отправляем изображение...');
        
        // Отправляем изображение через TelegramPublisher
        const result = await telegramPublisher.sendDirectusImageToTelegram(
          imageUrl,
          chatId,
          caption,
          token
        );
        
        console.log('[TELEGRAM] Изображение успешно отправлено через TelegramPublisher');
        return result;
      } catch (error: any) {
        console.error('[TELEGRAM] Ошибка при работе с TelegramPublisher:', error.message);
        
        // Возвращаем информацию об ошибке в стандартном формате
        return {
          ok: false,
          description: `Ошибка отправки изображения через TelegramPublisher: ${error.message}`,
          error: 'TELEGRAM_PUBLISHER_ERROR'
        };
      }
    } catch (error: any) {
      console.error('[TELEGRAM] КРИТИЧЕСКАЯ ОШИБКА при отправке изображения:', error.message);
      console.error('[TELEGRAM] Стек вызовов:', error.stack);
      
      // Попытка безопасно сериализовать ошибку
      let errorMessage = 'Неизвестная ошибка';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error);
        } catch (jsonError) {
          errorMessage = 'Ошибка не может быть сериализована';
        }
      }
      
      return {
        ok: false,
        description: `Ошибка при отправке изображения: ${errorMessage}`,
        error: errorMessage
      };
    }
  }

  /**
   * Публикует контент в Telegram
   * @param content Контент для публикации
   * @param telegramSettings Настройки Telegram
   * @returns Результат публикации
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings: SocialMediaSettings
  ): Promise<SocialPublication> {
    try {
      console.log(`Публикация контента #${content.id} в Telegram`);

      // Проверяем наличие необходимых настроек
      if (!telegramSettings?.token || !telegramSettings?.chatId) {
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: 'Отсутствуют настройки Telegram (токен или ID чата)',
          userId: telegramSettings?.chatId || null
        };
      }

      // Предобработка контента
      const { text, imageUrl } = this.preprocessContent(content);
      
      // Проверка на пустой текст и установка значения по умолчанию
      const safeText = text && text.trim() ? text : "📷 Новая публикация";
      
      // Форматируем текст для Telegram (с поддержкой HTML)
      const formattedText = this.addHtmlFormatting(safeText);
      
      console.log(`Отправка в Telegram. Текст: "${safeText.substring(0, 50)}", Изображение: ${!!imageUrl}`);
      
      // Если есть изображение, отправляем с ним, иначе просто текст
      let result;
      
      if (imageUrl) {
        // Отправка контента с изображением
        result = await this.uploadTelegramImageFromUrl(
          imageUrl,
          telegramSettings.chatId,
          formattedText,
          telegramSettings.token
        );
      } else {
        // Отправка только текстового сообщения
        const apiUrl = `https://api.telegram.org/bot${telegramSettings.token}/sendMessage`;
        const response = await axios.post(apiUrl, {
          chat_id: telegramSettings.chatId,
          text: formattedText,
          parse_mode: 'HTML'
        });
        result = response.data;
      }

      // Проверяем результат с дополнительной диагностикой
      console.log('Полный результат отправки Telegram:', JSON.stringify(result));
      
      if (result && result.ok === true) {
        console.log('✅ Успешная публикация в Telegram, message_id:', result.result?.message_id);
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          error: null,
          userId: telegramSettings.chatId,
          postId: result.result?.message_id?.toString() || null,
          postUrl: null // В Telegram нет прямой ссылки на сообщение
        };
      } else {
        console.error('❌ Ошибка публикации в Telegram:', 
          result?.description || (result?.error_code ? `Код ${result.error_code}` : 'Неизвестная ошибка'));
        
        // Дополнительная проверка на формат chat_id - попробуем исправить и повторить запрос
        if (result?.error_code === 400 && telegramSettings.chatId && 
            telegramSettings.chatId.startsWith('-100') && telegramSettings.chatId.length > 4) {
          
          // Пробуем отправить с исправленным ID чата (без префикса -100)
          const cleanedChatId = telegramSettings.chatId.substring(4);
          console.log(`🔄 Повторная попытка с ID чата без префикса -100: "${cleanedChatId}"`);
          
          let retryResult;
          if (imageUrl) {
            // Повторная отправка с изображением
            retryResult = await this.uploadTelegramImageFromUrl(
              imageUrl,
              cleanedChatId,
              formattedText,
              telegramSettings.token
            );
          } else {
            // Повторная отправка текста
            const apiUrl = `https://api.telegram.org/bot${telegramSettings.token}/sendMessage`;
            const response = await axios.post(apiUrl, {
              chat_id: cleanedChatId,
              text: formattedText,
              parse_mode: 'HTML'
            });
            retryResult = response.data;
          }
          
          if (retryResult && retryResult.ok === true) {
            console.log('🎉 Успешная публикация в Telegram с исправленным chat_id, message_id:', 
              retryResult.result?.message_id);
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              error: null,
              userId: cleanedChatId, // Запоминаем исправленный ID для будущих публикаций
              postId: retryResult.result?.message_id?.toString() || null,
              postUrl: null
            };
          }
        }
        
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: result?.description || (result?.error_code ? `Код ошибки: ${result.error_code}` : 'Неизвестная ошибка при публикации в Telegram'),
          userId: telegramSettings.chatId
        };
      }
    } catch (error) {
      console.error('Ошибка при публикации в Telegram:', error);
      return {
        platform: 'telegram',
        status: 'error',
        publishedAt: null,
        error: `Ошибка: ${error.message || error}`,
        userId: telegramSettings?.chatId || null
      };
    }
  }

  /**
   * Предобработка контента для публикации
   */
  private preprocessContent(content: CampaignContent): { text: string; imageUrl: string | null } {
    try {
      // Текст контента
      let text = content.text || '';

      // Ищем URL изображения
      let imageUrl = null;

      // Проверяем primary_image
      if (content.primary_image && typeof content.primary_image === 'string') {
        imageUrl = content.primary_image;
      } else if (
        content.primary_image && 
        typeof content.primary_image === 'object' && 
        content.primary_image.id
      ) {
        // Формируем URL для изображения из Directus
        const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
        imageUrl = `${directusUrl}/assets/${content.primary_image.id}`;
      }

      // Если нет основного изображения, проверяем additional_images
      if (!imageUrl && content.additional_images && Array.isArray(content.additional_images) && content.additional_images.length > 0) {
        const firstImage = content.additional_images[0];
        if (typeof firstImage === 'string') {
          imageUrl = firstImage;
        } else if (firstImage && typeof firstImage === 'object' && firstImage.id) {
          const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
          imageUrl = `${directusUrl}/assets/${firstImage.id}`;
        }
      }

      // Предобработка текста
      text = this.preprocessText(text);

      return { text, imageUrl };
    } catch (error) {
      console.error('Ошибка при предобработке контента:', error);
      return { text: content.text || '', imageUrl: null };
    }
  }

  /**
   * Предобработка текста
   */
  private preprocessText(text: string): string {
    // Обрежем длинный текст если необходимо
    const maxLength = 4000; // Максимальная длина сообщения в Telegram
    if (text.length > maxLength) {
      text = text.substring(0, maxLength - 3) + '...';
    }
    return text;
  }

  /**
   * Добавляет HTML-форматирование для Telegram с сохранением абзацев и переносов строк
   * @param text Исходный текст
   * @returns Текст с HTML-форматированием для Telegram
   */
  private addHtmlFormatting(text: string): string {
    if (!text) return '';
    
    try {
      // В Telegram для HTML формата используются следующие теги:
      // <b>bold</b>, <i>italic</i>, <u>underline</u>, <s>strikethrough</s>
      // <code>mono</code>, <pre>pre</pre>, <a href="http://example.com/">link</a>
      
      // 1. Экранируем спец. символы HTML, кроме тех, что уже в тегах форматирования
      const escapedText = this.escapeHtmlSpecialChars(text);
      
      // 2. Улучшенная обработка переносов строк и абзацев для Telegram
      // - Двойной перенос строк (пустая строка между абзацами) заменяем на два переноса
      // - Одиночные переносы строк оставляем как есть
      let formattedText = escapedText.replace(/\n\s*\n/g, '\n\n');
      
      // 3. Заменяем URL на гиперссылки для Telegram
      // Регулярное выражение для выделения URL в тексте
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      formattedText = formattedText.replace(urlRegex, '<a href="$1">$1</a>');
      
      // 4. Разбиваем текст на абзацы и добавляем форматирование первой строки каждого абзаца как заголовка
      // (если пользователь хочет особо выделить начало абзаца)
      if (formattedText.includes('\n\n')) {
        const paragraphs = formattedText.split('\n\n');
        for (let i = 0; i < paragraphs.length; i++) {
          const paragraph = paragraphs[i];
          const lines = paragraph.split('\n');
          
          // Если первая строка абзаца начинается с '#', форматируем как заголовок
          if (lines[0].startsWith('#')) {
            lines[0] = '<b>' + lines[0].substring(1).trim() + '</b>';
            paragraphs[i] = lines.join('\n');
          }
        }
        formattedText = paragraphs.join('\n\n');
      }
      
      // 5. Обработка выделений:
      // *курсив* -> <i>курсив</i>
      formattedText = formattedText.replace(/\*([^*\n]+)\*/g, '<i>$1</i>');
      
      // **жирный** -> <b>жирный</b>
      formattedText = formattedText.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
      
      // __подчеркнутый__ -> <u>подчеркнутый</u>
      formattedText = formattedText.replace(/\_\_([^_\n]+)\_\_/g, '<u>$1</u>');
      
      // ~~зачеркнутый~~ -> <s>зачеркнутый</s>
      formattedText = formattedText.replace(/\~\~([^~\n]+)\~\~/g, '<s>$1</s>');
      
      return formattedText;
    } catch (error) {
      console.error('Ошибка при форматировании текста для Telegram:', error);
      return text; // В случае ошибки возвращаем исходный текст
    }
  }
  
  /**
   * Экранирует специальные символы HTML
   * @param text Исходный текст
   * @returns Текст с экранированными символами
   */
  private escapeHtmlSpecialChars(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async publishToInstagram(
    content: CampaignContent,
    instagramSettings: SocialMediaSettings
  ): Promise<SocialPublication> {
    try {
      console.log(`Публикация контента #${content.id} в Instagram`);
      
      // Временная заглушка, так как интеграция с Instagram находится в процессе доработки
      return {
        platform: 'instagram',
        status: 'error',
        publishedAt: null,
        error: 'Интеграция с Instagram находится в процессе доработки',
        userId: instagramSettings?.businessId || null
      };
    } catch (error) {
      console.error('Ошибка при публикации в Instagram:', error);
      return {
        platform: 'instagram',
        status: 'error',
        publishedAt: null,
        error: `Ошибка: ${error.message || error}`,
        userId: instagramSettings?.businessId || null
      };
    }
  }

  async publishToFacebook(
    content: CampaignContent,
    facebookSettings: SocialMediaSettings
  ): Promise<SocialPublication> {
    try {
      console.log(`Публикация контента #${content.id} в Facebook`);
      
      // Временная заглушка, так как интеграция с Facebook находится в процессе доработки
      return {
        platform: 'facebook',
        status: 'error',
        publishedAt: null,
        error: 'Интеграция с Facebook находится в процессе доработки',
        userId: facebookSettings?.pageId || null
      };
    } catch (error) {
      console.error('Ошибка при публикации в Facebook:', error);
      return {
        platform: 'facebook',
        status: 'error',
        publishedAt: null,
        error: `Ошибка: ${error.message || error}`,
        userId: facebookSettings?.pageId || null
      };
    }
  }

  async publishToVk(
    content: CampaignContent,
    vkSettings: SocialMediaSettings
  ): Promise<SocialPublication> {
    try {
      console.log(`Публикация контента #${content.id} в ВКонтакте`);
      
      // Временная заглушка, так как интеграция с ВКонтакте находится в процессе доработки
      return {
        platform: 'vk',
        status: 'error',
        publishedAt: null,
        error: 'Интеграция с ВКонтакте находится в процессе доработки',
        userId: vkSettings?.groupId || null
      };
    } catch (error) {
      console.error('Ошибка при публикации в ВКонтакте:', error);
      return {
        platform: 'vk',
        status: 'error',
        publishedAt: null,
        error: `Ошибка: ${error.message || error}`,
        userId: vkSettings?.groupId || null
      };
    }
  }
}

export const socialPublishingService = new SocialPublishingService();