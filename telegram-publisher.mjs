/**
 * Самостоятельный класс для публикации изображений в Telegram
 * с поддержкой авторизации при доступе к Directus
 * 
 * Для работы скрипта нужно установить в Node.js среде:
 * - axios
 * - form-data
 * 
 * Использование:
 * const publisher = new TelegramPublisher();
 * await publisher.sendDirectusImageToTelegram(imageUrl, chatId, caption, token);
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { createWriteStream } from 'fs';

export default class TelegramPublisher {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.directusEmail = options.directusEmail || process.env.DIRECTUS_EMAIL;
    this.directusPassword = options.directusPassword || process.env.DIRECTUS_PASSWORD;
    this.directusUrl = options.directusUrl || process.env.DIRECTUS_URL || 'http://localhost:8055';
    
    this.directusToken = null;
    this.tokenExpiration = null;
    
    this.log('TelegramPublisher инициализирован');
  }

  /**
   * Выводит сообщение в консоль, если включен режим подробного логирования
   * @param {string} message Сообщение для логирования
   * @param {string} level Уровень логирования (log, warn, error)
   */
  log(message, level = 'log') {
    if (this.verbose || level === 'error') {
      console[level](`[TelegramPublisher] ${message}`);
    }
  }

  /**
   * Проверяет, не истек ли срок действия токена
   * @returns {boolean} true если токен действителен, false если истек или не установлен
   */
  isTokenValid() {
    if (!this.directusToken || !this.tokenExpiration) {
      return false;
    }
    
    // Проверяем, не истек ли срок действия токена (с запасом в 60 секунд)
    return this.tokenExpiration > Date.now() + 60000;
  }

  /**
   * Получает токен авторизации Directus
   * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
   */
  async getDirectusToken() {
    try {
      // Если у нас уже есть действующий токен, возвращаем его
      if (this.isTokenValid()) {
        this.log('Используем существующий токен Directus');
        return this.directusToken;
      }
      
      if (!this.directusEmail || !this.directusPassword) {
        this.log('Отсутствуют учетные данные Directus', 'error');
        return null;
      }
      
      this.log(`Получение токена Directus для ${this.directusEmail}...`);
      
      const response = await axios.post(`${this.directusUrl}/auth/login`, {
        email: this.directusEmail,
        password: this.directusPassword
      });
      
      if (response.data && response.data.data && response.data.data.access_token) {
        this.directusToken = response.data.data.access_token;
        
        // Устанавливаем срок истечения токена (обычно 15 минут)
        // Если в ответе есть expires, используем его, иначе устанавливаем 15 минут
        const expiresIn = response.data.data.expires || 900000; // 15 минут в миллисекундах
        this.tokenExpiration = Date.now() + expiresIn;
        
        this.log(`Токен Directus получен, действителен до ${new Date(this.tokenExpiration).toISOString()}`);
        return this.directusToken;
      } else {
        this.log('Не удалось получить токен Directus: неверный формат ответа', 'error');
        return null;
      }
    } catch (error) {
      this.log(`Ошибка при получении токена Directus: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Генерирует путь к временному файлу
   * @param {string} extension Расширение файла
   * @returns {string} Путь к временному файлу
   */
  generateTempFilePath(extension = 'jpg') {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return path.join(os.tmpdir(), `telegram_${timestamp}_${randomString}.${extension}`);
  }

  /**
   * Скачивает изображение с авторизацией (если это URL Directus)
   * @param {string} imageUrl URL изображения для скачивания
   * @returns {Promise<Object>} Объект с буфером изображения и типом контента
   */
  async downloadImage(imageUrl) {
    try {
      this.log(`Скачивание изображения: ${imageUrl}`);
      
      // Проверяем, является ли URL ссылкой на Directus
      const isDirectusUrl = imageUrl.includes(this.directusUrl) || 
                           imageUrl.includes('/assets/') || 
                           !imageUrl.startsWith('http');
      
      let headers = {};
      
      // Если это URL Directus, добавляем заголовок авторизации
      if (isDirectusUrl) {
        const token = await this.getDirectusToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
          this.log('Используем токен авторизации для доступа к изображению Directus');
        }
      }
      
      // Создаем временный файл для сохранения изображения
      const tempFilePath = this.generateTempFilePath();
      
      // Скачиваем изображение
      const response = await axios({
        url: imageUrl,
        method: 'GET',
        responseType: 'stream',
        headers
      });
      
      const contentType = response.headers['content-type'];
      const writer = createWriteStream(tempFilePath);
      
      await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      // Читаем изображение в буфер
      const buffer = fs.readFileSync(tempFilePath);
      
      this.log(`Изображение скачано успешно: ${buffer.length} байт, тип: ${contentType}`);
      
      return { buffer, contentType, tempFilePath };
    } catch (error) {
      this.log(`Ошибка при скачивании изображения: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Отправляет изображение в Telegram
   * @param {Buffer} imageBuffer Буфер с данными изображения
   * @param {string} contentType MIME-тип изображения
   * @param {string} chatId ID чата Telegram для отправки
   * @param {string} caption Подпись к изображению
   * @param {string} token Токен бота Telegram
   * @param {string|null} tempFilePath Путь к временному файлу изображения, если есть
   * @returns {Promise<Object>} Результат отправки
   */
  async sendImageToTelegram(imageBuffer, contentType, chatId, caption, token, tempFilePath = null) {
    let localTempFile = tempFilePath;
    
    try {
      this.log(`Отправка изображения в Telegram для чата ${chatId}, размер: ${imageBuffer.length} байт`);
      
      // Если не предоставлен путь к временному файлу, создаем новый
      if (!localTempFile) {
        localTempFile = this.generateTempFilePath();
        fs.writeFileSync(localTempFile, imageBuffer);
        this.log(`Создан временный файл: ${localTempFile}`);
      }
      
      // Создаем форму для отправки
      const form = new FormData();
      form.append('chat_id', chatId);
      
      if (caption) {
        form.append('caption', caption);
        form.append('parse_mode', 'HTML');
      }
      
      // Добавляем файл с изображением
      form.append('photo', fs.createReadStream(localTempFile), {
        filename: path.basename(localTempFile),
        contentType: contentType || 'image/jpeg'
      });
      
      // Отправляем запрос в Telegram API
      const response = await axios.post(
        `https://api.telegram.org/bot${token}/sendPhoto`,
        form,
        {
          headers: {
            ...form.getHeaders()
          }
        }
      );
      
      this.log(`Изображение успешно отправлено в Telegram, ID сообщения: ${response.data?.result?.message_id}`);
      
      return response.data;
    } catch (error) {
      this.log(`Ошибка при отправке изображения в Telegram: ${error.message}`, 'error');
      return {
        ok: false,
        description: error.message,
        error: error
      };
    } finally {
      // Удаляем временный файл
      if (localTempFile) {
        try {
          fs.unlinkSync(localTempFile);
          this.log(`Временный файл удален: ${localTempFile}`);
        } catch (unlinkError) {
          this.log(`Не удалось удалить временный файл: ${unlinkError.message}`, 'warn');
        }
      }
    }
  }

  /**
   * Полный процесс отправки изображения из Directus в Telegram
   * @param {string} imageUrl URL изображения (может быть ссылкой на Directus)
   * @param {string} chatId ID чата Telegram
   * @param {string} caption Подпись к изображению (поддерживает HTML)
   * @param {string} token Токен бота Telegram
   * @returns {Promise<Object>} Результат отправки
   */
  async sendDirectusImageToTelegram(imageUrl, chatId, caption, token) {
    try {
      // Скачиваем изображение
      const { buffer, contentType, tempFilePath } = await this.downloadImage(imageUrl);
      
      // Отправляем изображение в Telegram
      return await this.sendImageToTelegram(buffer, contentType, chatId, caption, token, tempFilePath);
    } catch (error) {
      this.log(`Ошибка при отправке изображения из Directus в Telegram: ${error.message}`, 'error');
      return {
        ok: false,
        description: error.message,
        error: error
      };
    }
  }
}