/**
 * Самостоятельный ESM модуль для публикации изображений в Telegram
 * с поддержкой авторизации при доступе к Directus
 */

import { config } from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

// Инициализация dotenv
config();

// Базовые настройки
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD;

export class TelegramPublisher {
  constructor() {
    this.directusToken = null;
    this.tokenExpiration = null;
  }
  
  /**
   * Проверяет, не истек ли срок действия токена
   * @returns {boolean} true если токен действителен, false если истек или не установлен
   */
  isTokenValid() {
    return this.directusToken && this.tokenExpiration && Date.now() < this.tokenExpiration;
  }
  
  /**
   * Получает токен авторизации Directus
   * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
   */
  async getDirectusToken() {
    console.log('🔄 Получение токена авторизации Directus...');
    
    // Если у нас уже есть действующий токен, возвращаем его
    if (this.isTokenValid()) {
      console.log('✅ Используем существующий токен Directus');
      return this.directusToken;
    }
    
    try {
      const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
        email: DIRECTUS_EMAIL,
        password: DIRECTUS_PASSWORD
      });
      
      if (response.data && response.data.data && response.data.data.access_token) {
        this.directusToken = response.data.data.access_token;
        // Устанавливаем срок действия токена (обычно 1 час)
        this.tokenExpiration = Date.now() + (response.data.data.expires * 1000 || 3600000);
        
        console.log('✅ Токен Directus успешно получен и сохранен');
        return this.directusToken;
      } else {
        console.error('❌ Ошибка получения токена Directus: неожиданный формат ответа');
        return null;
      }
    } catch (error) {
      console.error('❌ Ошибка при авторизации в Directus:', error.message);
      return null;
    }
  }
  
  /**
   * Скачивает изображение с авторизацией (если это URL Directus)
   * @param {string} imageUrl URL изображения для скачивания
   * @returns {Promise<Object>} Объект с буфером изображения и типом контента
   */
  async downloadImage(imageUrl) {
    console.log(`📥 Скачивание изображения: ${imageUrl.substring(0, 50)}...`);
    
    try {
      // Подготавливаем заголовки с авторизацией
      const headers = {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 SMM Planner Bot',
        'Cache-Control': 'no-cache'
      };
      
      // Если это URL Directus, добавляем токен авторизации
      if (imageUrl.includes('directus.nplanner.ru')) {
        const token = await this.getDirectusToken();
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          console.log('🔑 Добавлен токен авторизации для Directus');
        } else {
          console.warn('⚠️ Не удалось получить токен Directus, продолжаем без авторизации');
        }
      }
      
      // Скачиваем изображение
      console.time('⏱️ Скачивание изображения');
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000, // 60 секунд таймаут
        headers: headers
      });
      console.timeEnd('⏱️ Скачивание изображения');
      
      // Проверяем, что получили данные
      if (!response.data || response.data.length === 0) {
        throw new Error('Получен пустой ответ от сервера');
      }
      
      // Определяем тип контента
      const contentType = response.headers['content-type'] || 'image/jpeg';
      
      console.log(`✅ Изображение успешно загружено: ${response.data.length} байт, тип: ${contentType}`);
      
      return {
        buffer: Buffer.from(response.data),
        contentType: contentType
      };
    } catch (error) {
      console.error('❌ Ошибка при скачивании изображения:', error.message);
      
      if (error.response) {
        console.error('Статус ответа:', error.response.status);
      }
      
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
   * @returns {Promise<Object>} Результат отправки
   */
  async sendImageToTelegram(imageBuffer, contentType, chatId, caption, token) {
    console.log('🔄 Подготовка к отправке изображения в Telegram...');
    
    // Создаем временную директорию
    const tempDir = path.join(os.tmpdir(), 'telegram_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Генерируем уникальное имя для временного файла
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
    const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.${fileExtension}`);
    
    try {
      // Сохраняем буфер во временный файл
      fs.writeFileSync(tempFilePath, imageBuffer);
      console.log(`💾 Изображение сохранено во временный файл: ${tempFilePath} (${fs.statSync(tempFilePath).size} байт)`);
      
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
      formData.append('photo', fileStream, { 
        filename: `image_${timestamp}.${fileExtension}`,
        contentType: contentType
      });
      
      // Отправляем запрос в Telegram API
      console.log(`🚀 Отправка изображения в Telegram чат: ${chatId}`);
      console.time('⏱️ Время отправки в Telegram');
      
      const baseUrl = 'https://api.telegram.org/bot';
      const uploadResponse = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000 // 60 секунд таймаут
      });
      
      console.timeEnd('⏱️ Время отправки в Telegram');
      
      // Закрываем поток чтения файла
      fileStream.destroy();
      
      // Удаляем временный файл
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`🗑️ Временный файл удален: ${tempFilePath}`);
      } catch (unlinkError) {
        console.warn(`⚠️ Не удалось удалить временный файл: ${unlinkError}`);
      }
      
      // Проверяем успешность отправки
      if (uploadResponse.data && uploadResponse.data.ok) {
        console.log(`✅ Изображение успешно отправлено в Telegram: message_id=${uploadResponse.data.result.message_id}`);
        return uploadResponse.data;
      } else {
        console.error(`❌ Ошибка при отправке изображения в Telegram: ${JSON.stringify(uploadResponse.data)}`);
        throw new Error(`API вернул ошибку: ${JSON.stringify(uploadResponse.data)}`);
      }
    } catch (error) {
      // Если временный файл был создан, удаляем его
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`🗑️ Временный файл удален после ошибки: ${tempFilePath}`);
        } catch (e) {
          // Игнорируем ошибки при очистке
        }
      }
      
      console.error('❌ Ошибка при отправке изображения в Telegram:', error.message);
      
      if (error.response) {
        console.error('Статус ответа:', error.response.status);
        console.error('Данные ответа:', JSON.stringify(error.response.data));
      }
      
      throw error;
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
      console.log('🧪 Начинаем процесс отправки изображения из Directus в Telegram');
      
      // Шаг 1: Скачиваем изображение с авторизацией
      const { buffer, contentType } = await this.downloadImage(imageUrl);
      
      // Шаг 2: Отправляем изображение в Telegram
      const result = await this.sendImageToTelegram(buffer, contentType, chatId, caption, token);
      
      return result;
    } catch (error) {
      console.error('❌ Ошибка в процессе отправки изображения:', error.message);
      throw error;
    }
  }
}

// Если скрипт запущен напрямую, запускаем тестовый пример
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Параметры для тестирования
  const IMAGE_URL = process.env.TEST_IMAGE_URL || 'https://directus.nplanner.ru/assets/3b34be64-9579-4b1d-b4e2-98d3de5c2a14'; 
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  
  // Функция для запуска теста
  async function runTest() {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('❌ Отсутствуют необходимые параметры TELEGRAM_TOKEN или TELEGRAM_CHAT_ID');
      return;
    }
    
    const publisher = new TelegramPublisher();
    
    try {
      console.log(`📤 Отправляем изображение: ${IMAGE_URL} в Telegram чат: ${TELEGRAM_CHAT_ID}`);
      
      const result = await publisher.sendDirectusImageToTelegram(
        IMAGE_URL,
        TELEGRAM_CHAT_ID,
        'Тестовое изображение с <b>авторизацией</b> Directus 🚀 [ESM версия]',
        TELEGRAM_TOKEN
      );
      
      console.log('✅ Изображение успешно отправлено!');
      console.log(`🆔 ID сообщения: ${result.result.message_id}`);
    } catch (error) {
      console.error('❌ Ошибка при тестировании:', error.message);
    }
  }
  
  // Запускаем тест
  runTest().catch(err => {
    console.error('❌ Неожиданная ошибка:', err);
  });
}