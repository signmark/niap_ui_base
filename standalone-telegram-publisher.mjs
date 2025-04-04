/**
 * Самостоятельный класс для публикации изображений в Telegram
 * с поддержкой авторизации при доступе к Directus
 * Адаптировано для ES модулей
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

// Настройки Directus по умолчанию - можно перезаписать в конструкторе
const DEFAULT_DIRECTUS_URL = 'https://directus.nplanner.ru';

class TelegramPublisher {
  constructor(options = {}) {
    // Настройки Directus
    this.directusUrl = options.directusUrl || process.env.DIRECTUS_URL || DEFAULT_DIRECTUS_URL;
    this.directusEmail = options.directusEmail || process.env.DIRECTUS_EMAIL;
    this.directusPassword = options.directusPassword || process.env.DIRECTUS_PASSWORD;
    
    // Токен авторизации и его срок действия
    this.directusToken = null;
    this.tokenExpiration = null;
    
    // Временная директория для файлов
    this.tempDir = options.tempDir || path.join(os.tmpdir(), 'telegram_uploads');
    
    // Настройки логирования
    this.verbose = options.verbose !== undefined ? options.verbose : true;
    
    // Создаем временную директорию, если её нет
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
  
  /**
   * Выводит сообщение в консоль и записывает в файл логов
   * @param {string} message Сообщение для логирования
   * @param {string} level Уровень логирования (log, warn, error)
   */
  log(message, level = 'log') {
    // Всегда выводим в консоль, независимо от режима verbose
    console[level](message);
    
    // Выводим специальные отметки для важных логов
    if (level === 'error' || message.includes('ОТПРАВЛЯЕМЫЙ ЗАПРОС') || message.includes('chat_id')) {
      try {
        const logMessage = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
        console[level](`TELEGRAM_DEBUG: ${logMessage}`);
      } catch (e) {
        console.error('Ошибка записи лога:', e);
      }
    }
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
    this.log('🔄 Получение токена авторизации Directus...');
    
    // Проверяем, есть ли у нас действующий токен
    if (this.isTokenValid()) {
      this.log('✅ Используем существующий токен Directus');
      return this.directusToken;
    }
    
    try {
      // Проверяем, настроены ли учетные данные
      if (!this.directusEmail || !this.directusPassword) {
        this.log('⚠️ Отсутствуют учетные данные Directus (email/password)', 'warn');
        return null;
      }
      
      // Авторизуемся в Directus
      const response = await axios.post(`${this.directusUrl}/auth/login`, {
        email: this.directusEmail,
        password: this.directusPassword
      });
      
      // Проверяем ответ и сохраняем токен
      if (response.data && response.data.data && response.data.data.access_token) {
        this.directusToken = response.data.data.access_token;
        this.tokenExpiration = Date.now() + (response.data.data.expires * 1000 || 3600000);
        
        this.log('✅ Токен Directus успешно получен и сохранен');
        return this.directusToken;
      } else {
        this.log('❌ Ошибка получения токена Directus: неожиданный формат ответа', 'error');
        return null;
      }
    } catch (error) {
      this.log(`❌ Ошибка при авторизации в Directus: ${error.message}`, 'error');
      
      if (error.response) {
        this.log(`📊 Статус ответа: ${error.response.status}`, 'error');
        this.log(`📝 Данные ответа: ${JSON.stringify(error.response.data)}`, 'error');
      }
      
      return null;
    }
  }
  
  /**
   * Скачивает изображение с авторизацией (если это URL Directus)
   * @param {string} imageUrl URL изображения для скачивания
   * @returns {Promise<Object>} Объект с буфером изображения и типом контента
   */
  async downloadImage(imageUrl) {
    this.log(`📥 Скачивание изображения: ${imageUrl.substring(0, 100)}...`);
    
    try {
      // Подготавливаем заголовки запроса
      const headers = {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 SMM Planner Bot',
        'Cache-Control': 'no-cache'
      };
      
      // Определяем, является ли URL ссылкой на Directus
      const isDirectusUrl = imageUrl.includes('directus') || imageUrl.includes('/assets/');
      
      // Если это Directus URL, используем прокси-сервис для загрузки с авторизацией
      if (isDirectusUrl) {
        this.log('🔄 Обнаружена ссылка на Directus, используем прокси-сервис...');
        
        // Проверка и преобразование URL для прокси
        const originalUrl = imageUrl;
        let proxyUrl = imageUrl;
        
        // Если URL уже содержит домен Directus, используем его как есть
        if (imageUrl.includes('https://') || imageUrl.includes('http://')) {
          // Создаем URL для прокси-сервиса
          const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
          proxyUrl = `${baseUrl}/api/proxy-file?url=${encodeURIComponent(imageUrl)}`;
        } else {
          // Если URL - относительный путь или ID, преобразуем его в полный URL Directus
          const directusUrl = this.directusUrl || 'https://directus.nplanner.ru';
          
          // Если URL начинается с /assets/, добавляем только домен
          if (imageUrl.startsWith('/assets/')) {
            const fullDirectusUrl = `${directusUrl}${imageUrl}`;
            // Создаем URL для прокси-сервиса
            const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
            proxyUrl = `${baseUrl}/api/proxy-file?url=${encodeURIComponent(fullDirectusUrl)}`;
          } else {
            // Иначе предполагаем, что это ID ассета
            const fullDirectusUrl = `${directusUrl}/assets/${imageUrl}`;
            // Создаем URL для прокси-сервиса
            const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
            proxyUrl = `${baseUrl}/api/proxy-file?url=${encodeURIComponent(fullDirectusUrl)}`;
          }
        }
        
        this.log(`🔄 Преобразовано в прокси URL: ${proxyUrl}`);
        
        // Используем прокси для загрузки с авторизацией
        const response = await axios.get(proxyUrl, {
          responseType: 'arraybuffer',
          timeout: 60000 // 60 секунд таймаут
        });
        
        // Проверяем полученные данные
        const dataSize = response.data.length;
        if (dataSize === 0) {
          throw new Error('Получен пустой ответ от прокси-сервера');
        }
        
        // Определяем тип контента
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        this.log(`✅ Изображение успешно загружено через прокси: ${dataSize} байт, тип: ${contentType}`);
        
        return {
          buffer: Buffer.from(response.data),
          contentType: contentType
        };
      } else {
        // Если URL не от Directus, используем прямую загрузку
        this.log('🔄 Обычная ссылка, загружаем напрямую...');
        
        // Выполняем запрос для скачивания
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 60000, // 60 секунд таймаут
          headers: headers
        });
        
        // Проверяем полученные данные
        const dataSize = response.data.length;
        if (dataSize === 0) {
          throw new Error('Получен пустой ответ от сервера');
        }
        
        // Определяем тип контента
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        this.log(`✅ Изображение успешно загружено: ${dataSize} байт, тип: ${contentType}`);
        
        return {
          buffer: Buffer.from(response.data),
          contentType: contentType
        };
      }
    } catch (error) {
      this.log(`❌ Ошибка при скачивании изображения: ${error.message}`, 'error');
      
      if (error.response) {
        this.log(`📊 Статус ответа: ${error.response.status}`, 'error');
        
        if (error.response.status === 401 || error.response.status === 403) {
          this.log('🔒 Ошибка авторизации (401/403). Используйте прокси-сервис для доступа к файлам Directus.', 'error');
        }
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
    this.log('🔄 Подготовка к отправке изображения в Telegram...');
    
    // Проверяем необходимые параметры
    if (!token) {
      throw new Error('Не указан токен бота Telegram');
    }
    
    if (!chatId) {
      throw new Error('Не указан ID чата Telegram');
    }
    
    // Генерируем уникальное имя для временного файла
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
    const tempFilePath = path.join(this.tempDir, `telegram_${timestamp}_${randomString}.${fileExtension}`);
    
    try {
      // Сохраняем изображение во временный файл
      fs.writeFileSync(tempFilePath, imageBuffer);
      this.log(`💾 Изображение сохранено во временный файл: ${tempFilePath} (${fs.statSync(tempFilePath).size} байт)`);
      
      // Создаем FormData для отправки
      const formData = new FormData();
      
      // Добавляем параметры
      formData.append('chat_id', chatId);
      
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }
      
      // Добавляем файл
      const fileStream = fs.createReadStream(tempFilePath);
      formData.append('photo', fileStream, { 
        filename: `image_${timestamp}.${fileExtension}`,
        contentType: contentType
      });
      
      // Отправляем запрос в Telegram API
      this.log(`🚀 Отправка изображения в Telegram чат: ${chatId}`);
      
      // Используем ID чата как есть, без модификаций
      // Telegram API принимает ID в формате, который предоставил пользователь
      this.log(`ℹ️ Используем ID чата как есть: ${chatId}`);
      
      // Всегда передаем чат ID как строку для избежания проблем с большими числами
      formData.append('chat_id', chatId.toString());
      
      const baseUrl = 'https://api.telegram.org/bot';
      this.log(`🔍 Полный URL для запроса: ${baseUrl}${token.substring(0, 8)}...}/sendPhoto с chat_id=${chatId}`);
      
      // Логируем детали запроса и структуру FormData
      const formDataEntries = [];
      formData.getBuffer().toString().split('\r\n').forEach(line => {
        if (line && !line.includes('Content-Type: image/') && !line.includes('filename=')) {
          formDataEntries.push(line);
        }
      });
      console.log('==== ОТПРАВЛЯЕМЫЙ ЗАПРОС В TELEGRAM ====');
      console.log(`URL: ${baseUrl}${token.substring(0, 8)}...}/sendPhoto`);
      console.log(`Chat ID: ${chatId} (тип: ${typeof chatId})`); 
      console.log(`Заголовки: ${JSON.stringify(formData.getHeaders(), null, 2)}`);
      console.log(`Данные FormData: ${formDataEntries.join('\n')}`);
      console.log('=======================================');
      
      const response = await axios.post(`${baseUrl}${token}/sendPhoto`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000 // 60 секунд таймаут
      });
      
      // Закрываем поток чтения файла
      fileStream.destroy();
      
      // Удаляем временный файл
      try {
        fs.unlinkSync(tempFilePath);
        this.log(`🗑️ Временный файл удален: ${tempFilePath}`);
      } catch (unlinkError) {
        this.log(`⚠️ Не удалось удалить временный файл: ${unlinkError}`, 'warn');
      }
      
      // Проверяем успешность отправки
      if (response.data && response.data.ok) {
        this.log(`✅ Изображение успешно отправлено в Telegram: message_id=${response.data.result.message_id}`);
        return response.data;
      } else {
        this.log(`❌ Ошибка при отправке изображения в Telegram: ${JSON.stringify(response.data)}`, 'error');
        throw new Error(`API вернул ошибку: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      // Если временный файл был создан, удаляем его
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          this.log(`🗑️ Временный файл удален после ошибки: ${tempFilePath}`);
        } catch (e) {
          // Игнорируем ошибки при очистке
        }
      }
      
      this.log(`❌ Ошибка при отправке изображения в Telegram: ${error.message}`, 'error');
      
      if (error.response) {
        this.log(`📊 Статус ответа: ${error.response.status}`, 'error');
        this.log(`📝 Данные ответа: ${JSON.stringify(error.response.data)}`, 'error');
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
      this.log('🧪 Начинаем процесс отправки изображения в Telegram');
      
      // Используем ID чата без изменений, так как пользователь всегда вводит правильный ID
      this.log(`📊 Используем chat_id: ${chatId} без модификаций`);
      
      try {
        // Шаг 1: Скачиваем изображение с авторизацией
        this.log(`📥 Скачивание изображения для отправки в Telegram`);
        const { buffer, contentType } = await this.downloadImage(imageUrl);
        
        // Шаг 2: Отправляем изображение с ID чата как есть
        try {
          this.log(`🚀 Отправка с ID чата: ${chatId}`);
          const result = await this.sendImageToTelegram(buffer, contentType, chatId, caption, token);
          return result;
        } catch (chatError) {
          // Обрабатываем ошибки отправки
          
          // Если ID не обрабатывался или обе попытки не удались, проверяем код ошибки
          if (chatError.response && chatError.response.status === 400) {
            this.log(`🔍 Ошибка 400 от API Telegram: ${JSON.stringify(chatError.response.data || {})}`, 'error');
            
            // Возвращаем пользовательское сообщение об ошибке вместо общего исключения
            return {
              ok: false,
              description: `Ошибка API Telegram: ${chatError.response.data?.description || 'Неверный запрос'}`,
              error_code: chatError.response.data?.error_code || 400,
              parameters: chatError.response.data?.parameters || {}
            };
          }
          
          // Пробрасываем ошибку дальше
          throw chatError;
        }
      } catch (error) {
        this.log(`❌ Ошибка при подготовке и отправке изображения: ${error.message}`, 'error');
        
        // Проверяем, есть ли информация о типе ошибки
        if (error.response) {
          this.log(`📊 HTTP статус ошибки: ${error.response.status}`, 'error');
          this.log(`📄 Ответ сервера: ${JSON.stringify(error.response.data || {})}`, 'error');
          
          // Возвращаем информативное сообщение об ошибке
          return {
            ok: false,
            description: `Ошибка HTTP ${error.response.status}: ${error.response.data?.description || error.message}`,
            error_code: error.response.status,
            parameters: error.response.data?.parameters || {}
          };
        }
        
        // Для других типов ошибок
        return {
          ok: false,
          description: `Ошибка при отправке изображения: ${error.message}`,
          error_code: error.code || 500
        };
      }
    } catch (fatalError) {
      this.log(`💥 Критическая ошибка в процессе отправки изображения: ${fatalError.message}`, 'error');
      
      // Возвращаем стандартный формат ответа для обработки на уровне API
      return {
        ok: false,
        description: `Критическая ошибка: ${fatalError.message}`,
        error_code: fatalError.code || 500
      };
    }
  }
}

// Экспортируем класс для ES модулей
export default TelegramPublisher;