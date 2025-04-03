import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from '../logging';
import { SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/types';
import { CampaignContent } from '@shared/schema';

/**
 * Сервис для публикации контента в социальные сети
 */
export class SocialPublishingService {
  /**
   * Обрабатывает URL изображения в зависимости от платформы
   * @param imageUrl URL изображения
   * @param platform Название социальной платформы
   * @returns Обработанный URL для доступа к изображению
   */
  private processImageUrl(imageUrl: string, platform: string): string {
    try {
      // Базовая проверка валидности URL
      if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        log(`⚠️ Невалидный URL изображения: ${imageUrl}`, 'social-publishing');
        return '';
      }

      // Убираем лишние пробелы
      const trimmedUrl = imageUrl.trim();

      // Проверяем, является ли URL относительным и начинается с "/"
      if (trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) {
        // Для относительных URL добавляем базовый домен
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const absoluteUrl = `${baseUrl}${trimmedUrl}`;
        log(`🔄 Преобразован относительный URL в абсолютный: ${trimmedUrl} -> ${absoluteUrl}`, 'social-publishing');
        return absoluteUrl;
      }

      // Проверяем, является ли URL относительным и не начинается с протокола
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('/')) {
        // Для относительных URL добавляем базовый домен и слеш
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const absoluteUrl = `${baseUrl}/${trimmedUrl}`;
        log(`🔄 Преобразован относительный URL (без слеша) в абсолютный: ${trimmedUrl} -> ${absoluteUrl}`, 'social-publishing');
        return absoluteUrl;
      }

      // Проверяем, является ли URL локальным для нашего приложения
      const isLocalUrl = trimmedUrl.includes('localhost:') || 
                         trimmedUrl.includes('127.0.0.1') || 
                         (process.env.APP_URL && trimmedUrl.includes(process.env.APP_URL));

      // Для локальных URL используем проксирование
      if (isLocalUrl) {
        // Получаем путь из URL
        const urlObj = new URL(trimmedUrl);
        const proxyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/proxy-image?url=${encodeURIComponent(trimmedUrl)}`;
        log(`🔄 Проксирование локального URL: ${trimmedUrl} -> ${proxyUrl}`, 'social-publishing');
        return proxyUrl;
      }

      // Для проксирования файлов из Directus
      if (trimmedUrl.includes('/assets/') || trimmedUrl.includes('/files/')) {
        const proxyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/proxy-image?url=${encodeURIComponent(trimmedUrl)}`;
        log(`🔄 Проксирование Directus URL: ${trimmedUrl} -> ${proxyUrl}`, 'social-publishing');
        return proxyUrl;
      }

      // Для прямых URL к изображениям
      return trimmedUrl;
    } catch (error: any) {
      log(`⚠️ Ошибка при обработке URL изображения: ${error.message}`, 'social-publishing');
      return imageUrl; // Возвращаем исходный URL в случае ошибки
    }
  }

  /**
   * Форматирует HTML контент для социальной платформы
   * @param htmlContent HTML контент для форматирования
   * @param platform Целевая платформа
   * @returns Форматированный контент
   */
  private formatHtmlContent(htmlContent: string, platform: 'telegram' | 'vk' | 'facebook' | 'instagram'): string {
    if (!htmlContent) return '';
    
    try {
      let formattedContent = htmlContent;
      
      // Удаляем пробелы в начале и конце
      formattedContent = formattedContent.trim();
      
      // Заменяем двойные переводы строк на одинарные для всех платформ
      formattedContent = formattedContent.replace(/[\r\n]{3,}/g, '\n\n');

      switch (platform) {
        case 'telegram':
          // Telegram поддерживает HTML-теги, поэтому мы сохраняем их
          // Но проверяем закрытие всех открытых тегов
          const openTags = (formattedContent.match(/<[^\/][^>]*>/g) || []).length;
          const closeTags = (formattedContent.match(/<\/[^>]*>/g) || []).length;
          
          if (openTags > closeTags) {
            log(`⚠️ Предупреждение: В HTML для Telegram есть незакрытые теги (открыто: ${openTags}, закрыто: ${closeTags})`, 'social-publishing');
          }
          
          // Сохраняем структуру текста с переносами строк
          formattedContent = formattedContent.replace(/\n/g, '\n');
          break;
          
        case 'vk':
          // VK не поддерживает HTML, преобразуем только основные теги
          formattedContent = formattedContent
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<b>(.*?)<\/b>/gi, '$1')
            .replace(/<strong>(.*?)<\/strong>/gi, '$1')
            .replace(/<i>(.*?)<\/i>/gi, '$1')
            .replace(/<em>(.*?)<\/em>/gi, '$1')
            .replace(/<h[1-6]>(.*?)<\/h[1-6]>/gi, '$1\n')
            .replace(/<ul>(.*?)<\/ul>/gi, '$1\n')
            .replace(/<li>(.*?)<\/li>/gi, '• $1\n')
            .replace(/<ol>(.*?)<\/ol>/gi, '$1\n')
            .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
            .replace(/<[^>]*>/g, ''); // Удаляем все оставшиеся HTML-теги
          
          // Сохраняем структуру текста с переносами строк
          formattedContent = formattedContent.replace(/\n{3,}/g, '\n\n');
          break;
          
        case 'facebook':
        case 'instagram':
          // Facebook и Instagram не поддерживают HTML, удаляем все теги
          formattedContent = formattedContent
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<h[1-6]>(.*?)<\/h[1-6]>/gi, '$1\n')
            .replace(/<li>(.*?)<\/li>/gi, '• $1\n')
            .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2')
            .replace(/<[^>]*>/g, ''); // Удаляем все HTML-теги
          
          // Удаляем лишние пробелы и переносы строк
          formattedContent = formattedContent.replace(/\n{3,}/g, '\n\n');
          break;
      }
      
      // Финальная очистка от лишних переносов в начале и конце
      return formattedContent.trim();
    } catch (error: any) {
      log(`⚠️ Ошибка при форматировании HTML для ${platform}: ${error.message}`, 'social-publishing');
      // В случае ошибки возвращаем исходный контент
      return htmlContent;
    }
  }
  
  /**
   * Обрабатывает дополнительные изображения из контента для разных платформ
   * @param content Контент публикации
   * @param platform Социальная платформа
   * @returns Контент с обработанными дополнительными изображениями
   */
  private processAdditionalImages(content: CampaignContent, platform: string): CampaignContent {
    const processedContent = { ...content };
    
    try {
      // Проверяем наличие дополнительных изображений
      if (!content.additionalImages) {
        return processedContent;
      }
      
      // Если additionalImages - строка, пытаемся распарсить как JSON
      if (typeof content.additionalImages === 'string') {
        try {
          const parsedImages = JSON.parse(content.additionalImages);
          if (Array.isArray(parsedImages)) {
            processedContent.additionalImages = parsedImages;
            log(`📷 Успешно распарсили дополнительные изображения из JSON строки: ${parsedImages.length} шт.`, 'social-publishing');
          } else {
            // Если это не массив, создаем массив с одним элементом
            processedContent.additionalImages = [content.additionalImages];
            log(`📷 Строка дополнительных изображений не является массивом, создан массив с 1 элементом`, 'social-publishing');
          }
        } catch (jsonError) {
          // Если не удалось распарсить как JSON, считаем это одиночным URL
          processedContent.additionalImages = [content.additionalImages];
          log(`📷 Не удалось распарсить JSON для additionalImages, используем как одиночный URL`, 'social-publishing');
        }
      } else if (Array.isArray(content.additionalImages)) {
        // Если это уже массив, оставляем как есть
        processedContent.additionalImages = content.additionalImages;
        log(`📷 Дополнительные изображения уже являются массивом: ${content.additionalImages.length} шт.`, 'social-publishing');
      } else {
        // Если это неизвестный формат, конвертируем в пустой массив
        processedContent.additionalImages = [];
        log(`⚠️ Неизвестный формат дополнительных изображений, используем пустой массив`, 'social-publishing');
      }
      
      // Фильтруем пустые URL
      processedContent.additionalImages = (processedContent.additionalImages as string[]).filter(url => 
        url && typeof url === 'string' && url.trim() !== '');
      
      log(`📷 После обработки получено ${(processedContent.additionalImages as string[]).length} дополнительных изображений`, 'social-publishing');
      
      return processedContent;
    } catch (error: any) {
      log(`⚠️ Ошибка при обработке дополнительных изображений: ${error.message}`, 'social-publishing');
      // В случае ошибки возвращаем исходный контент
      return content;
    }
  }

  /**
   * Загружает и отправляет изображение в Telegram через локальный файл
   * @param imageUrl URL изображения
   * @param chatId ID чата Telegram
   * @param caption Подпись к изображению
   * @param token Токен Telegram API
   * @param baseUrl Базовый URL Telegram API
   * @returns Ответ от Telegram API
   */
  private async uploadTelegramImageFromUrl(
    imageUrl: string, 
    chatId: string, 
    caption: string, 
    token: string,
    baseUrl: string
  ): Promise<any> {
    try {
      // ШАГ 1: Логирование входных параметров
      log(`🔴 [TG: ШАГ 1] НАЧАЛО процесса отправки изображения в Telegram`, 'social-publishing');
      log(`🔴 [TG: ШАГ 1] Исходный URL изображения: ${imageUrl}`, 'social-publishing');
      log(`🔴 [TG: ШАГ 1] ID чата Telegram: ${chatId}`, 'social-publishing');
      log(`🔴 [TG: ШАГ 1] Длина подписи: ${caption.length} символов`, 'social-publishing');
      log(`🔴 [TG: ШАГ 1] Токен (первые 8 символов): ${token.substring(0, 8)}...`, 'social-publishing');
      log(`🔴 [TG: ШАГ 1] URL API Telegram: ${baseUrl}`, 'social-publishing');
      
      // ШАГ 2: Обработка изображения через прокси
      log(`🟠 [TG: ШАГ 2] Обработка URL изображения...`, 'social-publishing');
      
      // ВСЕГДА используем проксированный URL для скачивания
      // Применяем универсальную функцию обработки URL
      const proxyImageUrl = this.processImageUrl(imageUrl, 'telegram');
      log(`🟠 [TG: ШАГ 2] Сформирован URL для скачивания: ${proxyImageUrl}`, 'social-publishing');
      
      // ШАГ 3: Проксированный URL уже готов к использованию
      log(`🟡 [TG: ШАГ 3] Прокси URL готов к использованию, дальнейшей обработки не требуется`, 'social-publishing');
      
      // ШАГ 4: Скачивание изображения
      log(`🟢 [TG: ШАГ 4] Начинаем скачивание изображения с URL: ${proxyImageUrl}`, 'social-publishing');
      
      // Задаем заголовки для скачивания
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
      };
      
      log(`🟢 [TG: ШАГ 4] Используем следующие HTTP заголовки для скачивания: ${JSON.stringify(headers)}`, 'social-publishing');
      
      // Скачиваем изображение
      let imageResponse;
      try {
        log(`🟢 [TG: ШАГ 4] Выполняем HTTP GET запрос для скачивания...`, 'social-publishing');
        imageResponse = await axios({
          method: 'get',
          url: proxyImageUrl,
          responseType: 'arraybuffer',
          headers: headers,
          timeout: 30000, // 30 секунд таймаут
          maxContentLength: 50 * 1024 * 1024, // 50 MB
          validateStatus: function (status) {
            return status >= 200 && status < 500;
          }
        });
        
        log(`🟢 [TG: ШАГ 4] HTTP GET запрос выполнен, статус: ${imageResponse.status}`, 'social-publishing');
      } catch (downloadError: any) {
        log(`🟢 [TG: ШАГ 4] КРИТИЧЕСКАЯ ОШИБКА при скачивании: ${downloadError.message}`, 'social-publishing');
        throw new Error(`Не удалось скачать изображение: ${downloadError.message}`);
      }
      
      // Проверяем успешность загрузки
      log(`🟢 [TG: ШАГ 4] Проверяем статус HTTP ответа: ${imageResponse.status}`, 'social-publishing');
      if (imageResponse.status >= 400) {
        log(`🟢 [TG: ШАГ 4] ОШИБКА: Получен HTTP статус ${imageResponse.status}`, 'social-publishing');
        throw new Error(`Не удалось загрузить изображение, статус HTTP: ${imageResponse.status}`);
      }
      
      // Проверяем размер скачанных данных
      const dataSize = imageResponse.data.length;
      log(`🟢 [TG: ШАГ 4] Размер скачанных данных: ${dataSize} байт`, 'social-publishing');
      
      if (dataSize === 0) {
        log(`🟢 [TG: ШАГ 4] ОШИБКА: Скачан пустой файл (0 байт)`, 'social-publishing');
        throw new Error('Скачанный файл имеет нулевой размер');
      }
      
      if (dataSize < 100) {
        log(`🟢 [TG: ШАГ 4] ПРЕДУПРЕЖДЕНИЕ: Очень маленький размер файла (${dataSize} байт)`, 'social-publishing');
      }
      
      // ШАГ 5: Сохранение во временный файл
      log(`🔵 [TG: ШАГ 5] Сохраняем скачанные данные во временный файл...`, 'social-publishing');
      
      // Создаем временную директорию, если её нет
      const tempDir = path.join(os.tmpdir(), 'telegram_uploads');
      try {
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
          log(`🔵 [TG: ШАГ 5] Создана временная директория: ${tempDir}`, 'social-publishing');
        } else {
          log(`🔵 [TG: ШАГ 5] Временная директория уже существует: ${tempDir}`, 'social-publishing');
        }
      } catch (mkdirError: any) {
        log(`🔵 [TG: ШАГ 5] ОШИБКА при создании временной директории: ${mkdirError.message}`, 'social-publishing');
        log(`🔵 [TG: ШАГ 5] Используем корневую временную директорию`, 'social-publishing');
      }
    
      // Генерируем уникальное имя файла
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 10);
      const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.jpg`);
      
      // Сохраняем изображение во временный файл
      fs.writeFileSync(tempFilePath, Buffer.from(imageResponse.data));
      log(`💾 Создан временный файл: ${tempFilePath}, размер: ${fs.statSync(tempFilePath).size} байт`, 'social-publishing');
      
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
      
      // Добавляем файл изображения в форму
      const fileStream = fs.createReadStream(tempFilePath);
      formData.append('photo', fileStream, { filename: `image_${timestamp}.jpg` });
      
      log(`📤 Отправляем файл в Telegram API через multipart/form-data`, 'social-publishing');
      
      try {
        // Отправляем запрос в Telegram API
        const response = await axios.post(`${baseUrl}/sendPhoto`, formData, {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30000 // увеличиваем таймаут до 30 секунд
        });
        
        log(`✅ Успешный ответ от Telegram API: ${JSON.stringify(response.data)}`, 'social-publishing');
        return response.data;
      } catch (uploadError: any) {
        log(`❌ Ошибка при отправке изображения в Telegram API: ${uploadError.message}`, 'social-publishing');
        if (uploadError.response) {
          log(`📄 Данные ответа при ошибке: ${JSON.stringify(uploadError.response.data)}`, 'social-publishing');
        }
        throw uploadError;
      } finally {
        // Закрываем стрим чтения файла
        fileStream.destroy();
        
        // Удаляем временный файл
        try {
          fs.unlinkSync(tempFilePath);
          log(`🗑️ Временный файл удален: ${tempFilePath}`, 'social-publishing');
        } catch (deleteError: any) {
          log(`⚠️ Ошибка при удалении временного файла: ${deleteError.message}`, 'social-publishing');
        }
      }
    } catch (error: any) {
      log(`❌ Общая ошибка в процессе загрузки изображения в Telegram: ${error.message}`, 'social-publishing');
      throw error;
    }
  }

  /**
   * Получает системный токен для администраторской аутентификации
   * @returns Админский токен для запросов к системным ресурсам
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      // Здесь должна быть логика получения токена администратора
      // Обычно это реализуется через DirectusAuthManager или аналогичный сервис
      return null;
    } catch (error: any) {
      log(`⚠️ Ошибка при получении системного токена: ${error.message}`, 'social-publishing');
      return null;
    }
  }
}