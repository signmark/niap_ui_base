import axios from 'axios';
import { log } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '../../shared/types';

export class SocialPublishingService {
  /**
   * Загружает изображение из URL и отправляет его в Telegram
   * @param imageUrl URL изображения для загрузки
   * @param chatId ID чата для отправки
   * @param caption Текст подписи к изображению
   * @param token Токен Telegram API
   * @param baseUrl Базовый URL Telegram API
   * @returns Ответ от Telegram API
   */
  private async uploadTelegramImageFromUrl(
    imageUrl: string,
    chatId: string,
    caption: string,
    token: string,
    baseUrl = 'https://api.telegram.org/bot'
  ): Promise<any> {
    try {
      log(`Загрузка изображения в Telegram из URL: ${imageUrl.substring(0, 100)}...`, 'social-publishing');
      
      // Создаем временную директорию, если она не существует
      const tempDir = path.join(os.tmpdir(), 'telegram_uploads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Генерируем уникальное имя для временного файла
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 10);
      const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.jpg`);
      
      // Скачиваем изображение во временный файл
      log(`Скачивание изображения во временный файл: ${tempFilePath}`, 'social-publishing');
      
      try {
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'Accept': 'image/*',
            'User-Agent': 'Mozilla/5.0 SMM Planner Bot'
          }
        });
        
        // Проверяем размер полученного файла
        const dataSize = response.data.length;
        if (dataSize === 0) {
          throw new Error(`Скачан пустой файл (0 байт) с URL: ${imageUrl}`);
        }
        
        // Сохраняем файл на диск
        fs.writeFileSync(tempFilePath, Buffer.from(response.data));
        log(`Изображение сохранено во временный файл, размер: ${fs.statSync(tempFilePath).size} байт`, 'social-publishing');
        
        // Создаем FormData для отправки изображения
        const formData = new FormData();
        
        // Добавляем основные параметры
        formData.append('chat_id', chatId);
        
        // Если есть подпись, добавляем её и формат разметки
        if (caption) {
          formData.append('caption', caption);
          formData.append('parse_mode', 'HTML');
        }
        
        // Добавляем файл изображения
        const fileStream = fs.createReadStream(tempFilePath);
        formData.append('photo', fileStream, { filename: `image_${timestamp}.jpg` });
        
        // Отправляем запрос в Telegram API
        log(`Отправка изображения в Telegram чат: ${chatId}`, 'social-publishing');
        const uploadResponse = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30000
        });
        
        // Закрываем поток чтения файла
        fileStream.destroy();
        
        // Удаляем временный файл
        try {
          fs.unlinkSync(tempFilePath);
          log(`Временный файл удален: ${tempFilePath}`, 'social-publishing');
        } catch (unlinkError) {
          log(`Не удалось удалить временный файл: ${unlinkError}`, 'social-publishing');
        }
        
        // Проверяем успешность отправки
        if (uploadResponse.data && uploadResponse.data.ok) {
          log(`Изображение успешно отправлено в Telegram: message_id=${uploadResponse.data.result.message_id}`, 'social-publishing');
          return uploadResponse.data;
        } else {
          log(`Ошибка при отправке изображения в Telegram: ${JSON.stringify(uploadResponse.data)}`, 'social-publishing');
          throw new Error(`API вернул ошибку: ${JSON.stringify(uploadResponse.data)}`);
        }
        
      } catch (downloadError: any) {
        // Если временный файл был создан, удаляем его
        if (fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
            log(`Временный файл удален после ошибки: ${tempFilePath}`, 'social-publishing');
          } catch (e) {
            // Игнорируем ошибки при очистке
          }
        }
        
        // Логируем и пробрасываем ошибку выше
        log(`Ошибка при скачивании/отправке изображения: ${downloadError.message}`, 'social-publishing');
        if (downloadError.response) {
          log(`Данные ответа при ошибке: ${JSON.stringify(downloadError.response.data)}`, 'social-publishing');
        }
        throw downloadError;
      }
      
    } catch (error: any) {
      log(`Общая ошибка при загрузке изображения в Telegram: ${error.message}`, 'social-publishing');
      throw error;
    }
  }

  /**
   * Форматирует HTML контент с сохранением абзацев и переносов строк
   * @param htmlContent Исходный HTML-контент с форматированием
   * @param platform Платформа для которой выполняется форматирование (влияет на поддерживаемые теги)
   * @returns Отформатированный текст с сохранением структуры
   */
  private formatHtmlContent(htmlContent: string, platform: 'telegram' | 'vk' | 'facebook' | 'instagram'): string {
    // Для пустого контента возвращаем пустую строку
    if (!htmlContent) return '';
    
    let formattedContent = htmlContent;
    
    // Заменяем <br> на \n
    formattedContent = formattedContent.replace(/<br\s*\/?>/gi, '\n');
    
    // Заменяем </p><p> на двойной перенос строки
    formattedContent = formattedContent.replace(/<\/p>\s*<p>/gi, '\n\n');
    
    // Удаляем остальные HTML-теги, кроме разрешенных для соответствующей платформы
    if (platform === 'telegram') {
      // Telegram поддерживает базовые HTML-теги: <b>, <i>, <u>, <s>, <a>, <code>, <pre>
      // Удаляем все остальные теги
      formattedContent = formattedContent.replace(/<(?!\/?(b|i|u|s|a|code|pre)(\s[^>]*)?)[^>]*>/gi, '');
    } else if (platform === 'vk') {
      // ВКонтакте не поддерживает HTML, только разметку через спец. символы
      // Заменяем базовые теги на специальные символы
      formattedContent = formattedContent
        .replace(/<b>(.*?)<\/b>/gi, '*$1*')  // Жирный
        .replace(/<i>(.*?)<\/i>/gi, '_$1_')  // Курсив
        .replace(/<u>(.*?)<\/u>/gi, '$1')    // Подчеркнутый - не поддерживается, удаляем
        .replace(/<s>(.*?)<\/s>/gi, '$1')    // Зачеркнутый - не поддерживается, удаляем
        // Сохраняем ссылки в виде [текст|ссылка]
        .replace(/<a\s+href=["'](.*?)["'].*?>(.*?)<\/a>/gi, '[$2|$1]')
        // Удаляем остальные теги
        .replace(/<[^>]*>/gi, '');
    } else {
      // Для других платформ просто удаляем все теги
      formattedContent = formattedContent.replace(/<[^>]*>/gi, '');
    }
    
    // Декодируем HTML-сущности
    formattedContent = formattedContent
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    
    return formattedContent;
  }

  /**
   * Преобразует URL изображения в полный URL, обрабатывая разные форматы (UUID Directus, относительные пути)
   * @param imageUrl Исходный URL изображения 
   * @param platform Название платформы для логирования
   * @returns Полный URL изображения, готовый для использования API социальных сетей
   */
  private processImageUrl(imageUrl: string, platform: string): string {
    if (!imageUrl) return '';
    
    try {
      // Вариант 1: URL уже содержит полный путь с http/https
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        log(`[${platform}] Изображение уже имеет полный URL: ${imageUrl.substring(0, 50)}...`, 'social-publishing');
        
        // Проверяем, относится ли URL к Directus
        if (imageUrl.includes('/assets/')) {
          log(`[${platform}] URL относится к Directus, преобразуем в формат для прямого доступа`, 'social-publishing');
          
          // Находим UUID изображения
          const uuidMatch = imageUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
          
          if (uuidMatch && uuidMatch[1]) {
            const fileUuid = uuidMatch[1];
            // Преобразуем в прокси-URL для скачивания
            const proxyUrl = `/api/proxy/image/${fileUuid}`;
            
            // Получаем полный URL сервера (baseUrl) на основе текущего запроса
            // В данном случае используем переменную с базовым URL сервера
            const baseUrl = process.env.SERVER_URL || 'http://localhost:3000'; // В продакшене должен быть указан внешний URL
            
            const fullProxyUrl = `${baseUrl}${proxyUrl}`;
            log(`[${platform}] Преобразованный URL для загрузки: ${fullProxyUrl}`, 'social-publishing');
            
            return fullProxyUrl;
          }
        }
        
        return imageUrl;
      }
      
      // Вариант 2: URL - это UUID изображения из Directus
      const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      if (uuidRegex.test(imageUrl)) {
        log(`[${platform}] URL является UUID изображения Directus: ${imageUrl}`, 'social-publishing');
        
        // Преобразуем в прокси-URL для скачивания
        const proxyUrl = `/api/proxy/image/${imageUrl}`;
        
        // Получаем полный URL сервера
        const baseUrl = process.env.SERVER_URL || 'http://localhost:3000';
        
        const fullProxyUrl = `${baseUrl}${proxyUrl}`;
        log(`[${platform}] Преобразованный URL для UUID: ${fullProxyUrl}`, 'social-publishing');
        
        return fullProxyUrl;
      }
      
      // Вариант 3: URL - относительный путь на сервере
      if (imageUrl.startsWith('/')) {
        log(`[${platform}] URL является относительным путем: ${imageUrl}`, 'social-publishing');
        
        // Получаем полный URL сервера
        const baseUrl = process.env.SERVER_URL || 'http://localhost:3000';
        
        const fullUrl = `${baseUrl}${imageUrl}`;
        log(`[${platform}] Преобразованный URL для относительного пути: ${fullUrl}`, 'social-publishing');
        
        return fullUrl;
      }
      
      // Если ничего не подошло, возвращаем оригинальный URL
      log(`[${platform}] Не удалось определить формат URL, возвращаем оригинальный: ${imageUrl}`, 'social-publishing');
      return imageUrl;
      
    } catch (error: any) {
      log(`[${platform}] Ошибка при обработке URL изображения: ${error.message}`, 'social-publishing');
      return imageUrl;
    }
  }

  /**
   * Обрабатывает поле дополнительных изображений в контенте, проверяя и преобразуя его при необходимости
   * @param content Контент, содержащий дополнительные изображения
   * @param platform Название социальной платформы (для логирования)
   * @returns Обновленный контент с обработанным полем additionalImages
   */
  private processAdditionalImages(content: CampaignContent, platform: string): CampaignContent {
    if (!content) return content;
    
    try {
      // Проверяем есть ли поле additionalImages в контенте
      if (!content.additionalImages) {
        log(`[${platform}] Поле additionalImages отсутствует в контенте`, 'social-publishing');
        // Возвращаем контент без изменений
        return content;
      }
      
      log(`[${platform}] Обработка поля additionalImages, тип: ${typeof content.additionalImages}`, 'social-publishing');
      
      let processedAdditionalImages;
      
      // Обрабатываем поле additionalImages в зависимости от его типа
      if (typeof content.additionalImages === 'string') {
        try {
          // Если это строка, пробуем распарсить как JSON
          const parsedImages = JSON.parse(content.additionalImages);
          
          if (Array.isArray(parsedImages)) {
            // Если это массив - обрабатываем каждый элемент
            log(`[${platform}] additionalImages распарсен как массив с ${parsedImages.length} элементами`, 'social-publishing');
            
            processedAdditionalImages = parsedImages.map(item => {
              if (typeof item === 'string') {
                return this.processImageUrl(item, platform);
              } else if (typeof item === 'object' && item.url) {
                return this.processImageUrl(item.url, platform);
              }
              return item;
            });
          } else if (typeof parsedImages === 'object') {
            // Если это объект, проверяем наличие поля url
            log(`[${platform}] additionalImages распарсен как объект`, 'social-publishing');
            
            if (parsedImages.url) {
              processedAdditionalImages = [this.processImageUrl(parsedImages.url, platform)];
            } else {
              // Преобразуем объект в массив, если там нет поля url
              processedAdditionalImages = Object.values(parsedImages)
                .filter(val => val && (typeof val === 'string' || (typeof val === 'object' && val.url)))
                .map(item => {
                  if (typeof item === 'string') {
                    return this.processImageUrl(item, platform);
                  } else if (typeof item === 'object' && item.url) {
                    return this.processImageUrl(item.url, platform);
                  }
                  return item;
                });
            }
          }
        } catch (parseError) {
          // Если не удалось распарсить как JSON, считаем это просто строкой
          log(`[${platform}] Не удалось распарсить additionalImages как JSON: ${parseError.message}`, 'social-publishing');
          processedAdditionalImages = [this.processImageUrl(content.additionalImages as string, platform)];
        }
      } else if (Array.isArray(content.additionalImages)) {
        // Если это уже массив, просто обрабатываем каждый элемент
        log(`[${platform}] additionalImages уже является массивом с ${content.additionalImages.length} элементами`, 'social-publishing');
        
        processedAdditionalImages = content.additionalImages.map(item => {
          if (typeof item === 'string') {
            return this.processImageUrl(item, platform);
          } else if (typeof item === 'object' && item.url) {
            return this.processImageUrl(item.url, platform);
          }
          return item;
        });
      } else if (typeof content.additionalImages === 'object') {
        // Если это объект, проверяем наличие поля url
        log(`[${platform}] additionalImages является объектом`, 'social-publishing');
        
        if ((content.additionalImages as any).url) {
          processedAdditionalImages = [this.processImageUrl((content.additionalImages as any).url, platform)];
        } else {
          // Преобразуем объект в массив
          processedAdditionalImages = Object.values(content.additionalImages as object)
            .filter(val => val && (typeof val === 'string' || (typeof val === 'object' && (val as any).url)))
            .map(item => {
              if (typeof item === 'string') {
                return this.processImageUrl(item, platform);
              } else if (typeof item === 'object' && (item as any).url) {
                return this.processImageUrl((item as any).url, platform);
              }
              return item;
            });
        }
      }
      
      // Проверяем результат и обновляем контент
      if (processedAdditionalImages) {
        log(`[${platform}] Обработано ${Array.isArray(processedAdditionalImages) ? processedAdditionalImages.length : 0} дополнительных изображений`, 'social-publishing');
        
        // Создаем копию контента для обновления
        const updatedContent = { ...content };
        updatedContent.additionalImages = processedAdditionalImages;
        
        return updatedContent;
      }
      
      // Если что-то пошло не так, возвращаем исходный контент
      log(`[${platform}] Не удалось обработать additionalImages, возвращаем исходный контент`, 'social-publishing');
      return content;
      
    } catch (error: any) {
      log(`[${platform}] Ошибка при обработке additionalImages: ${error.message}`, 'social-publishing');
      return content;
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
    telegramSettings?: SocialMediaSettings['telegram']
  ): Promise<SocialPublication> {
    log(`▶️ Начата публикация в Telegram. Контент ID: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
    log(`▶️ Настройки для публикации в Telegram: chatId=${telegramSettings?.chatId ? telegramSettings.chatId.substring(0, 6) + '...' : 'не задан'}, token=${telegramSettings?.token ? telegramSettings.token.substring(0, 6) + '...' : 'не задан'}`, 'social-publishing');
    
    if (!telegramSettings?.token || !telegramSettings?.chatId) {
      log(`❌ ОШИБКА: Отсутствуют настройки для Telegram (token=${!!telegramSettings?.token}, chatId=${!!telegramSettings?.chatId})`, 'social-publishing');
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

      // Обрабатываем поле additionalImages в контенте
      content = this.processAdditionalImages(content, 'telegram');
      
      // Форматируем HTML-контент для Telegram с сохранением структуры
      const formattedText = this.formatHtmlContent(content.content, 'telegram');
      log(`Форматированный текст для Telegram: длина ${formattedText.length} символов`, 'social-publishing');
      
      // Публикация в зависимости от типа контента
      if (content.contentType === 'text') {
        log(`Публикация текстового контента в Telegram (ID: ${content.id})`, 'social-publishing');
        
        // Базовый URL для API Telegram
        const baseUrl = 'https://api.telegram.org/bot';
        
        // Отправляем текстовый контент с форматированием HTML
        const response = await axios.post(`${baseUrl}${token}/sendMessage`, {
          chat_id: chatId,
          text: formattedText,
          parse_mode: 'HTML',
          disable_web_page_preview: false // Разрешаем предпросмотр веб-страниц в ссылках
        });
        
        log(`Успешная публикация в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
        
        // Получаем URL поста из ответа API
        const messageId = response.data.result.message_id;
        // Формируем URL поста в Telegram (формат t.me/c/channelid/messageid)
        const postUrl = chatId.startsWith('@')
          ? `https://t.me/${chatId.substring(1)}`
          : chatId.startsWith('-100')
            ? `https://t.me/c/${chatId.substring(4)}/${messageId}`
            : null;
            
        log(`URL поста в Telegram: ${postUrl}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          publishedUrl: postUrl,
          postId: messageId?.toString() || null
        };
      } 
      else if (content.contentType === 'image') {
        log(`Публикация изображения в Telegram (ID: ${content.id})`, 'social-publishing');
        
        // Проверка наличия изображения
        if (!content.imageUrl) {
          log(`Ошибка: Отсутствует URL изображения для публикации в Telegram`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: 'Отсутствует URL изображения'
          };
        }
        
        // Обрабатываем URL изображения для проксирования через наш сервер
        const processedImageUrl = this.processImageUrl(content.imageUrl, 'telegram');
        log(`Обработанный URL изображения для Telegram: ${processedImageUrl}`, 'social-publishing');
        
        // Базовый URL для API Telegram
        const baseUrl = 'https://api.telegram.org/bot';
        
        try {
          // Отправляем изображение с подписью
          const response = await this.uploadTelegramImageFromUrl(
            processedImageUrl,
            chatId,
            formattedText, // Используем форматированный HTML-текст как подпись
            token,
            baseUrl
          );
          
          log(`Успешная публикация изображения в Telegram: ${JSON.stringify(response)}`, 'social-publishing');
          
          // Получаем данные о публикации из ответа API
          const messageId = response.result.message_id;
          
          // Формируем URL поста в Telegram (формат t.me/c/channelid/messageid)
          const postUrl = chatId.startsWith('@')
            ? `https://t.me/${chatId.substring(1)}`
            : chatId.startsWith('-100')
              ? `https://t.me/c/${chatId.substring(4)}/${messageId}`
              : null;
              
          log(`URL поста с изображением в Telegram: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            publishedUrl: postUrl,
            postId: messageId?.toString() || null
          };
        } catch (uploadError: any) {
          log(`Ошибка при загрузке изображения в Telegram: ${uploadError.message}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка загрузки изображения: ${uploadError.message}`
          };
        }
      }
      else if (content.contentType === 'carousel') {
        log(`Публикация карусели в Telegram (ID: ${content.id})`, 'social-publishing');
        
        // Проверяем наличие основного изображения или дополнительных изображений
        if (!content.imageUrl && (!content.additionalImages || content.additionalImages.length === 0)) {
          log(`Ошибка: Отсутствуют изображения для карусели в Telegram`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: 'Отсутствуют изображения для карусели'
          };
        }
        
        // Собираем все URL изображений
        const imageUrls: string[] = [];
        
        // Добавляем основное изображение, если оно есть
        if (content.imageUrl) {
          imageUrls.push(this.processImageUrl(content.imageUrl, 'telegram'));
        }
        
        // Добавляем дополнительные изображения
        if (content.additionalImages && Array.isArray(content.additionalImages) && content.additionalImages.length > 0) {
          content.additionalImages.forEach((imgUrl) => {
            if (typeof imgUrl === 'string' && imgUrl.trim()) {
              imageUrls.push(this.processImageUrl(imgUrl, 'telegram'));
            } else if (typeof imgUrl === 'object' && imgUrl.url) {
              imageUrls.push(this.processImageUrl(imgUrl.url, 'telegram'));
            }
          });
        }
        
        log(`Всего изображений для карусели в Telegram: ${imageUrls.length}`, 'social-publishing');
        
        if (imageUrls.length === 0) {
          log(`Ошибка: После обработки не найдено валидных URL изображений для карусели`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: 'Нет валидных URL изображений для карусели'
          };
        }
        
        // Для Telegram карусель отправляется как группа изображений через sendMediaGroup
        // Формируем массив медиа-объектов
        const mediaObjects = imageUrls.map((url, index) => {
          return {
            type: 'photo',
            media: url,
            caption: index === 0 ? formattedText : '', // Подпись только для первого изображения
            parse_mode: 'HTML'
          };
        });
        
        log(`Медиа-объекты для Telegram: ${JSON.stringify(mediaObjects)}`, 'social-publishing');
        
        // Создаем временные файлы для каждого изображения
        const tempFiles: string[] = [];
        const mediaItems = [];
        
        try {
          // Создаем временную директорию
          const tempDir = path.join(os.tmpdir(), 'telegram_carousel');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Скачиваем каждое изображение во временный файл
          for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 10);
            const tempFilePath = path.join(tempDir, `telegram_carousel_${i}_${timestamp}_${randomString}.jpg`);
            
            // Скачиваем изображение
            log(`Скачивание изображения ${i+1}/${imageUrls.length} для карусели: ${url.substring(0, 100)}...`, 'social-publishing');
            const response = await axios.get(url, {
              responseType: 'arraybuffer',
              timeout: 30000,
              headers: {
                'Accept': 'image/*',
                'User-Agent': 'Mozilla/5.0 SMM Planner Bot'
              }
            });
            
            // Проверяем размер
            const dataSize = response.data.length;
            if (dataSize === 0) {
              log(`ОШИБКА: Скачан пустой файл (0 байт) для изображения ${i+1}`, 'social-publishing');
              continue; // Пропускаем это изображение
            }
            
            // Сохраняем файл
            fs.writeFileSync(tempFilePath, Buffer.from(response.data));
            log(`Сохранено изображение ${i+1} во временный файл: ${tempFilePath}`, 'social-publishing');
            tempFiles.push(tempFilePath);
            
            // Создаем FormData для каждого изображения
            const formData = new FormData();
            formData.append('chat_id', chatId);
            
            // Первое изображение с подписью, остальные без
            if (i === 0) {
              formData.append('caption', formattedText);
              formData.append('parse_mode', 'HTML');
            }
            
            // Добавляем файл
            const fileStream = fs.createReadStream(tempFilePath);
            formData.append('photo', fileStream, { filename: `image_${timestamp}_${i}.jpg` });
            
            // Отправляем изображение в Telegram
            try {
              const baseUrl = 'https://api.telegram.org/bot';
              const uploadResponse = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
                headers: {
                  ...formData.getHeaders(),
                  'Accept': 'application/json'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 30000
              });
              
              fileStream.destroy(); // Закрываем стрим
              
              log(`Успешно отправлено изображение ${i+1} в Telegram`, 'social-publishing');
              
              // Добавляем полученное медиа-ID в массив для формирования группы
              mediaItems.push({
                index: i,
                messageId: uploadResponse.data.result.message_id
              });
            } catch (uploadError: any) {
              fileStream.destroy(); // Обязательно закрываем стрим при ошибке
              log(`Ошибка при отправке изображения ${i+1} в Telegram: ${uploadError.message}`, 'social-publishing');
              if (uploadError.response) {
                log(`Данные ошибки: ${JSON.stringify(uploadError.response.data)}`, 'social-publishing');
              }
            }
          }
          
          // Удаляем временные файлы
          tempFiles.forEach(file => {
            try {
              fs.unlinkSync(file);
              log(`Удален временный файл: ${file}`, 'social-publishing');
            } catch (unlinkError) {
              log(`Ошибка при удалении временного файла: ${unlinkError}`, 'social-publishing');
            }
          });
          
          // Проверяем, успешно ли загружены какие-либо изображения
          if (mediaItems.length === 0) {
            log(`Ошибка: Не удалось отправить ни одно изображение для карусели`, 'social-publishing');
            return {
              platform: 'telegram',
              status: 'failed',
              publishedAt: null,
              error: 'Не удалось отправить ни одно изображение для карусели'
            };
          }
          
          // Сортируем медиа-элементы по индексу
          mediaItems.sort((a, b) => a.index - b.index);
          
          // Формируем URL первого поста для возврата
          // Формируем URL поста в Telegram (формат t.me/c/channelid/messageid)
          const firstMessageId = mediaItems[0]?.messageId;
          const postUrl = chatId.startsWith('@')
            ? `https://t.me/${chatId.substring(1)}`
            : chatId.startsWith('-100')
              ? `https://t.me/c/${chatId.substring(4)}/${firstMessageId}`
              : null;
              
          log(`URL первого изображения карусели в Telegram: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            publishedUrl: postUrl,
            postId: firstMessageId?.toString() || null
          };
          
        } catch (carouselError: any) {
          log(`Ошибка при публикации карусели в Telegram: ${carouselError.message}`, 'social-publishing');
          
          // Удаляем все временные файлы
          tempFiles.forEach(file => {
            try {
              if (fs.existsSync(file)) {
                fs.unlinkSync(file);
              }
            } catch (e) {
              // Игнорируем ошибки при очистке
            }
          });
          
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка публикации карусели: ${carouselError.message}`
          };
        }
      }
      
      // Если тип контента не поддерживается
      log(`Неподдерживаемый тип контента для Telegram: ${content.contentType}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Неподдерживаемый тип контента: ${content.contentType}`
      };
    } catch (error: any) {
      log(`Общая ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка публикации: ${error.message}`
      };
    }
  }
}