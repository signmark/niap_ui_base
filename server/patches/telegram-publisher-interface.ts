/**
 * Интерфейс для взаимодействия с TelegramPublisher
 * Обертка над standalone-telegram-publisher.js
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';

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
    
    this.log('TelegramPublisher инициализирован с параметрами:', JSON.stringify({
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
    return !!this.tokenCache.token && Date.now() < this.tokenCache.expires;
  }
  
  /**
   * Получает токен авторизации Directus
   */
  private async getDirectusToken(): Promise<string | null> {
    try {
      if (this.isTokenValid()) {
        this.log('Используем кэшированный токен Directus');
        return this.tokenCache.token;
      }
      
      this.log('Запрашиваем новый токен Directus');
      
      if (!this.options.directusEmail || !this.options.directusPassword) {
        this.log('Ошибка: Отсутствуют учетные данные для Directus');
        return null;
      }
      
      const response = await axios.post(`${this.options.directusUrl}/auth/login`, {
        email: this.options.directusEmail,
        password: this.options.directusPassword
      });
      
      if (response.data && response.data.data && response.data.data.access_token) {
        this.tokenCache = {
          token: response.data.data.access_token,
          // Устанавливаем срок действия токена на 15 минут
          expires: Date.now() + 15 * 60 * 1000
        };
        this.log('Получен новый токен Directus (срок действия 15 минут)');
        return this.tokenCache.token;
      } else {
        this.log('Ошибка: Не удалось получить токен из ответа API');
        return null;
      }
    } catch (error) {
      this.log('Ошибка при получении токена Directus:', error);
      return null;
    }
  }
  
  /**
   * Скачивает изображение с авторизацией (если это URL Directus)
   */
  private async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      this.log(`Скачивание изображения: ${imageUrl}`);
      
      let headers = {};
      
      // Проверяем, является ли URL адресом к ресурсу Directus
      if (imageUrl.includes('/assets/') && imageUrl.includes(this.options.directusUrl)) {
        const token = await this.getDirectusToken();
        if (token) {
          headers = { Authorization: `Bearer ${token}` };
          this.log('Добавлены заголовки авторизации для Directus');
        }
      }
      
      // Скачиваем изображение
      const response = await axios.get(imageUrl, {
        headers,
        responseType: 'arraybuffer'
      });
      
      // Определяем тип контента
      const contentType = response.headers['content-type'] || 'image/jpeg';
      this.log(`Изображение скачано, тип контента: ${contentType}`);
      
      return {
        buffer: Buffer.from(response.data),
        contentType
      };
    } catch (error) {
      this.log('Ошибка при скачивании изображения:', error);
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
    try {
      this.log(`Отправка изображения в Telegram: ${contentType} -> ${chatId}`);
      
      // Создаем временный файл для изображения
      const tempDir = os.tmpdir();
      const extension = contentType.split('/')[1] || 'jpg';
      const tempFilePath = path.join(tempDir, `telegram_image_${Date.now()}.${extension}`);
      
      // Записываем буфер во временный файл
      fs.writeFileSync(tempFilePath, imageBuffer);
      this.log(`Создан временный файл: ${tempFilePath}`);
      
      // Создаем FormData для отправки
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', fs.createReadStream(tempFilePath));
      
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }
      
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
      this.log('Временный файл удален');
      
      return response.data;
    } catch (error) {
      this.log('Ошибка при отправке изображения в Telegram:', error);
      return {
        ok: false,
        description: `Ошибка при отправке изображения: ${error.message || error}`
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
      this.log(`Начинаем процесс отправки изображения в Telegram: ${imageUrl} -> ${chatId}`);
      
      // Скачиваем изображение
      const imageInfo = await this.downloadImage(imageUrl);
      
      if (!imageInfo) {
        return {
          ok: false,
          description: 'Не удалось скачать изображение'
        };
      }
      
      // Отправляем изображение в Telegram
      const result = await this.sendImageToTelegram(
        imageInfo.buffer,
        imageInfo.contentType,
        chatId,
        caption,
        token
      );
      
      return result;
    } catch (error) {
      this.log('Ошибка в процессе отправки изображения:', error);
      return {
        ok: false,
        description: `Глобальная ошибка: ${error.message || error}`
      };
    }
  }
}

/**
 * Создает и возвращает экземпляр TelegramPublisher
 */
export async function getTelegramPublisher(options: TelegramPublisherOptions = {}): Promise<TelegramPublisher> {
  return new TelegramPublisher(options);
}