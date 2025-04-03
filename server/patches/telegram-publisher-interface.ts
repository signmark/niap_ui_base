/**
 * Интерфейс для взаимодействия с TelegramPublisher
 * Обертка над standalone-telegram-publisher.js
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';

/**
 * Безопасное логирование объектов (с обработкой циклических ссылок)
 * @param obj Объект для логирования
 * @returns Безопасная строка для логирования
 */
function safeStringify(obj: any): string {
  try {
    // Обработка циклических ссылок
    const cache: any[] = [];
    const str = JSON.stringify(obj, function(key, value) {
      if (typeof value === 'object' && value !== null) {
        // Обнаружение циклических ссылок
        if (cache.indexOf(value) !== -1) {
          return '[Циклическая ссылка]';
        }
        cache.push(value);
      }
      return value;
    }, 2);
    return str || String(obj);
  } catch (error) {
    return `[Невозможно преобразовать объект: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

interface TelegramPublisherOptions {
  verbose?: boolean;
  directusEmail?: string;
  directusPassword?: string;
  directusUrl?: string;
}

class TelegramPublisher {
  private options: TelegramPublisherOptions;
  private tokenCache: { token: string | null; expires: number } = { token: null, expires: 0 };
  
  constructor(options: TelegramPublisherOptions = {}) {
    this.options = {
      verbose: options.verbose || false,
      directusEmail: options.directusEmail || process.env.DIRECTUS_EMAIL,
      directusPassword: options.directusPassword || process.env.DIRECTUS_PASSWORD,
      directusUrl: options.directusUrl || process.env.DIRECTUS_URL || 'https://db.nplanner.ru'
    };
    
    this.log('TelegramPublisher инициализирован с параметрами:', safeStringify({
      verbose: this.options.verbose,
      directusUrl: this.options.directusUrl,
      hasCredentials: !!(this.options.directusEmail && this.options.directusPassword)
    }));
  }
  
  /**
   * Выводит сообщение в консоль, если включен режим подробного логирования
   */
  private log(message: string, ...args: any[]): void {
    if (this.options.verbose) {
      console.log(`[TelegramPublisher] ${message}`, ...args);
    }
  }
  
  /**
   * Проверяет, не истек ли срок действия токена
   */
  private isTokenValid(): boolean {
    const now = Date.now();
    const isValid = !!this.tokenCache.token && now < this.tokenCache.expires;
    
    // Если токен почти истек (осталось меньше 1 минуты), считаем его невалидным
    if (isValid && (this.tokenCache.expires - now < 60 * 1000)) {
      console.log('[TelegramPublisher] Токен Directus скоро истечет, необходимо обновить');
      return false;
    }
    
    return isValid;
  }
  
  /**
   * Получает токен авторизации Directus
   */
  private async getDirectusToken(): Promise<string | null> {
    try {
      if (this.isTokenValid()) {
        console.log('[TelegramPublisher] Используем кэшированный токен Directus');
        this.log('Используем кэшированный токен Directus');
        return this.tokenCache.token;
      }
      
      console.log('[TelegramPublisher] Запрашиваем новый токен Directus');
      this.log('Запрашиваем новый токен Directus');
      
      if (!this.options.directusEmail || !this.options.directusPassword) {
        console.error('[TelegramPublisher] Ошибка: Отсутствуют учетные данные для Directus');
        this.log('Ошибка: Отсутствуют учетные данные для Directus');
        return null;
      }
      
      // Формируем URL для запроса токена
      const authUrl = `${this.options.directusUrl}/auth/login`;
      console.log(`[TelegramPublisher] URL для авторизации: ${authUrl}`);
      
      // Делаем запрос с увеличенным таймаутом
      const response = await axios.post(authUrl, {
        email: this.options.directusEmail,
        password: this.options.directusPassword
      }, {
        timeout: 15000 // 15 секунд таймаут
      });
      
      if (response.data && response.data.data && response.data.data.access_token) {
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 минут
        this.tokenCache = {
          token: response.data.data.access_token,
          expires: expiresAt
        };
        console.log(`[TelegramPublisher] Получен новый токен Directus, действителен до ${new Date(expiresAt).toISOString()}`);
        this.log('Получен новый токен Directus (срок действия 15 минут)');
        return this.tokenCache.token;
      } else {
        console.error('[TelegramPublisher] Ошибка: Не удалось получить токен из ответа API');
        console.error('[TelegramPublisher] Ответ API:', safeStringify(response.data));
        this.log('Ошибка: Не удалось получить токен из ответа API');
        return null;
      }
    } catch (error) {
      console.error('[TelegramPublisher] Ошибка при получении токена Directus:', safeStringify(error));
      
      // Расширенное логирование ошибок
      if (axios.isAxiosError(error)) {
        console.error(`[TelegramPublisher] Статус ошибки Axios: ${error.response?.status}`);
        console.error(`[TelegramPublisher] Данные ответа: ${safeStringify(error.response?.data)}`);
        console.error(`[TelegramPublisher] URL запроса: ${error.config?.url}`);
        console.error(`[TelegramPublisher] Метод запроса: ${error.config?.method}`);
      }
      
      this.log('Ошибка при получении токена Directus:', safeStringify(error));
      return null;
    }
  }
  
  /**
   * Скачивает изображение с авторизацией (если это URL Directus)
   */
  private async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      console.log(`[TelegramPublisher] Скачивание изображения: ${imageUrl}`);
      this.log(`Скачивание изображения: ${imageUrl}`);
      
      // Проверяем корректность URL
      if (!imageUrl) {
        console.error('[TelegramPublisher] Пустой URL изображения');
        return null;
      }
      
      // Проверяем, не содержит ли URL признаки placeholder-изображения
      if (imageUrl.includes('placeholder') || 
          imageUrl.includes('placehold.co') || 
          imageUrl.includes('НЕИЗОБРАЖЕНИЙ') ||
          imageUrl.includes('Image+Error')) {
        console.error(`[TelegramPublisher] URL содержит признаки placeholder-изображения: ${imageUrl}`);
        return null;
      }
      
      let headers = {};
      
      // Проверяем, является ли URL адресом к ресурсу Directus
      const directusUrl = this.options.directusUrl || '';
      const isDirectusAsset = imageUrl.includes('/assets/') && 
                             (directusUrl && imageUrl.includes(directusUrl) || imageUrl.includes('db.nplanner.ru'));
      
      if (isDirectusAsset) {
        console.log(`[TelegramPublisher] Обнаружен URL Directus, добавляем авторизацию`);
        const token = await this.getDirectusToken();
        if (token) {
          headers = { Authorization: `Bearer ${token}` };
          console.log('[TelegramPublisher] Получен и добавлен токен для Directus');
          this.log('Добавлены заголовки авторизации для Directus');
        } else {
          console.error('[TelegramPublisher] Не удалось получить токен для Directus');
        }
      }
      
      // Скачиваем изображение с таймаутом
      console.log(`[TelegramPublisher] Отправка запроса на скачивание`);
      const response = await axios.get(imageUrl, {
        headers,
        responseType: 'arraybuffer',
        timeout: 20000, // 20 секунд таймаут
        maxContentLength: 10 * 1024 * 1024 // 10 МБ максимальный размер
      });
      
      // Проверяем наличие данных в ответе
      if (!response.data || response.data.length === 0) {
        console.error('[TelegramPublisher] Получен пустой ответ от сервера');
        return null;
      }
      
      // Определяем тип контента
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const buffer = Buffer.from(response.data);
      
      console.log(`[TelegramPublisher] Изображение успешно скачано (${buffer.length} байт), тип контента: ${contentType}`);
      this.log(`Изображение скачано, тип контента: ${contentType}, размер: ${buffer.length} байт`);
      
      return {
        buffer,
        contentType
      };
    } catch (error) {
      console.error('[TelegramPublisher] Ошибка при скачивании изображения:', safeStringify(error));
      this.log('Ошибка при скачивании изображения:', safeStringify(error));
      
      // Добавляем подробную информацию об ошибке
      if (axios.isAxiosError(error)) {
        console.error(`[TelegramPublisher] Axios ошибка: ${error.message}`);
        console.error(`[TelegramPublisher] URL: ${error.config?.url}`);
        console.error(`[TelegramPublisher] Статус: ${error.response?.status}`);
        console.error(`[TelegramPublisher] Данные: ${safeStringify(error.response?.data)}`);
      }
      
      return null;
    }
  }
  
  /**
   * Отправляет изображение в Telegram
   */
  private async sendImageToTelegram(
    imageBuffer: Buffer, 
    contentType: string, 
    chatId: string, 
    caption: string, 
    token: string
  ): Promise<any> {
    let tempFilePath = '';
    try {
      console.log(`[TelegramPublisher] Отправка изображения в Telegram: ${contentType} -> ${chatId}, размер буфера: ${imageBuffer.length} байт`);
      this.log(`Отправка изображения в Telegram: ${contentType} -> ${chatId}`);
      
      // Проверяем наличие необходимых параметров
      if (!imageBuffer || imageBuffer.length === 0) {
        console.error('[TelegramPublisher] Пустой буфер изображения');
        return {
          ok: false,
          description: 'Пустой буфер изображения'
        };
      }
      
      if (!chatId) {
        console.error('[TelegramPublisher] Отсутствует ID чата');
        return {
          ok: false,
          description: 'Отсутствует ID чата'
        };
      }
      
      if (!token) {
        console.error('[TelegramPublisher] Отсутствует токен бота');
        return {
          ok: false,
          description: 'Отсутствует токен бота'
        };
      }
      
      // Создаем временный файл для изображения
      const tempDir = os.tmpdir();
      const extension = contentType.split('/')[1] || 'jpg';
      tempFilePath = path.join(tempDir, `telegram_image_${Date.now()}.${extension}`);
      console.log(`[TelegramPublisher] Создаем временный файл: ${tempFilePath}`);
      
      // Записываем буфер во временный файл
      fs.writeFileSync(tempFilePath, imageBuffer);
      console.log(`[TelegramPublisher] Файл создан, размер: ${fs.statSync(tempFilePath).size} байт`);
      this.log(`Создан временный файл: ${tempFilePath}`);
      
      // Проверяем, что файл действительно создан и имеет размер
      if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
        console.error('[TelegramPublisher] Ошибка создания временного файла');
        return {
          ok: false,
          description: 'Ошибка создания временного файла'
        };
      }
      
      // Создаем FormData для отправки
      console.log(`[TelegramPublisher] Подготовка FormData для отправки`);
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', fs.createReadStream(tempFilePath));
      
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }
      
      // Отправляем запрос в Telegram API
      console.log(`[TelegramPublisher] Отправка запроса в Telegram API: chat_id=${chatId}`);
      const response = await axios.post(
        `https://api.telegram.org/bot${token}/sendPhoto`,
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          // Увеличиваем таймаут для больших файлов
          timeout: 30000
        }
      );
      
      console.log(`[TelegramPublisher] Ответ Telegram API: ${JSON.stringify(response.data)}`);
      
      // Удаляем временный файл
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`[TelegramPublisher] Временный файл удален: ${tempFilePath}`);
        this.log('Временный файл удален');
      }
      
      return response.data;
    } catch (error) {
      console.error('[TelegramPublisher] Критическая ошибка при отправке изображения в Telegram:', safeStringify(error));
      this.log('Ошибка при отправке изображения в Telegram:', safeStringify(error));
      
      // Удаляем временный файл в случае ошибки
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`[TelegramPublisher] Временный файл удален после ошибки: ${tempFilePath}`);
        } catch (cleanupError) {
          console.error(`[TelegramPublisher] Ошибка при удалении временного файла:`, cleanupError);
        }
      }
      
      return {
        ok: false,
        description: `Ошибка при отправке изображения: ${error instanceof Error ? error.message : safeStringify(error)}`
      };
    }
  }
  
  /**
   * Полный процесс отправки изображения из Directus в Telegram
   */
  public async sendDirectusImageToTelegram(
    imageUrl: string, 
    chatId: string, 
    caption: string, 
    token: string
  ): Promise<any> {
    try {
      console.log(`[TelegramPublisher] Начинаем процесс отправки изображения в Telegram: ${imageUrl} -> ${chatId}`);
      this.log(`Начинаем процесс отправки изображения в Telegram: ${imageUrl} -> ${chatId}`);
      
      // Проверяем наличие необходимых параметров
      if (!imageUrl) {
        console.error('[TelegramPublisher] Отсутствует URL изображения');
        return {
          ok: false,
          description: 'Отсутствует URL изображения'
        };
      }
      
      if (!chatId) {
        console.error('[TelegramPublisher] Отсутствует ID чата');
        return {
          ok: false,
          description: 'Отсутствует ID чата'
        };
      }
      
      if (!token) {
        console.error('[TelegramPublisher] Отсутствует токен бота');
        return {
          ok: false,
          description: 'Отсутствует токен бота'
        };
      }
      
      // Проверяем, не является ли URL placeholder-изображением
      if (imageUrl.includes('placehold.co') || 
          imageUrl.includes('placeholder') || 
          imageUrl.includes('Image+Error') ||
          imageUrl.includes('НЕИЗОБРАЖЕНИЙ')) {
        console.error(`[TelegramPublisher] Обнаружено placeholder-изображение: ${imageUrl}. Публикация отменена.`);
        this.log(`Обнаружено placeholder-изображение: ${imageUrl}. Публикация отменена.`);
        return {
          ok: false,
          description: 'Обнаружено placeholder-изображение. Публикация отменена.'
        };
      }
      
      // Скачиваем изображение
      console.log(`[TelegramPublisher] Скачивание изображения: ${imageUrl}`);
      const imageInfo = await this.downloadImage(imageUrl);
      
      if (!imageInfo) {
        console.error('[TelegramPublisher] Не удалось скачать изображение');
        return {
          ok: false,
          description: 'Не удалось скачать изображение'
        };
      }
      
      console.log(`[TelegramPublisher] Изображение успешно скачано, размер: ${imageInfo.buffer.length} байт`);
      
      // Отправляем изображение в Telegram
      console.log(`[TelegramPublisher] Отправка изображения в Telegram: ${chatId}`);
      const result = await this.sendImageToTelegram(
        imageInfo.buffer,
        imageInfo.contentType,
        chatId,
        caption,
        token
      );
      
      // Проверяем результат отправки и подробно логируем
      console.log(`[TelegramPublisher] Результат отправки в Telegram:`, JSON.stringify(result));
      
      if (result && result.ok === true) {
        console.log(`[TelegramPublisher] Изображение успешно отправлено в чат ${chatId}, message_id: ${result.result?.message_id}`);
        return result;
      } else {
        console.error(`[TelegramPublisher] Ошибка отправки в Telegram: ${result?.description || 'Неизвестная ошибка'}`);
        return {
          ok: false,
          description: result?.description || 'Неизвестная ошибка при отправке в Telegram API'
        };
      }
    } catch (error) {
      console.error('[TelegramPublisher] Критическая ошибка в процессе отправки изображения:', safeStringify(error));
      this.log('Ошибка в процессе отправки изображения:', safeStringify(error));
      return {
        ok: false,
        description: `Глобальная ошибка: ${error instanceof Error ? error.message : safeStringify(error)}`
      };
    }
  }
}

/**
 * Создает и возвращает экземпляр TelegramPublisher с расширенной обработкой ошибок
 * @param options Настройки для инициализации TelegramPublisher
 * @returns Экземпляр TelegramPublisher или null в случае критической ошибки
 */
export async function getTelegramPublisher(options: TelegramPublisherOptions = {}): Promise<TelegramPublisher> {
  try {
    // Проверяем обязательные переменные среды
    if (!process.env.DIRECTUS_EMAIL || !process.env.DIRECTUS_PASSWORD) {
      console.error('[TelegramPublisher] КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют учетные данные Directus (DIRECTUS_EMAIL, DIRECTUS_PASSWORD)');
      console.error('[TelegramPublisher] Убедитесь, что переменные среды DIRECTUS_EMAIL и DIRECTUS_PASSWORD установлены');
      
      // В случае отсутствия учетных данных все равно создаем экземпляр, 
      // но с предупреждением (авторизация будет попытка авторизации из параметров)
      console.warn('[TelegramPublisher] Создание экземпляра без учетных данных Directus. Некоторые функции могут быть недоступны.');
    }
    
    // Установка URLs с значениями по умолчанию, если не указаны
    const directusUrl = options.directusUrl || process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
    
    // Создаем экземпляр с подробным логированием
    const publisher = new TelegramPublisher({
      ...options,
      directusUrl,
      verbose: options.verbose !== undefined ? options.verbose : true  // По умолчанию включаем подробное логирование
    });
    
    console.log('[TelegramPublisher] Экземпляр успешно создан');
    return publisher;
  } catch (error) {
    console.error('[TelegramPublisher] КРИТИЧЕСКАЯ ОШИБКА при создании экземпляра:', 
      error instanceof Error ? error.message : safeStringify(error));
    
    // В случае ошибки, все равно пытаемся создать экземпляр с минимальными параметрами
    // чтобы не блокировать работу всего приложения
    console.warn('[TelegramPublisher] Создание резервного экземпляра с минимальными параметрами');
    return new TelegramPublisher({
      verbose: true
    });
  }
}