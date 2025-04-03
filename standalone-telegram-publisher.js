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

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');

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
   * Выводит сообщение в консоль, если включен режим подробного логирования
   * @param {string} message Сообщение для логирования
   * @param {string} level Уровень логирования (log, warn, error)
   */
  log(message, level = 'log') {
    if (this.verbose) {
      console[level](message);
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
      
      // Если URL от Directus, добавляем авторизацию
      if (imageUrl.includes('directus')) {
        const token = await this.getDirectusToken();
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          this.log('🔑 Добавлен токен авторизации для Directus');
        } else {
          this.log('⚠️ Не удалось получить токен Directus, продолжаем без авторизации', 'warn');
        }
      }
      
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
    } catch (error) {
      this.log(`❌ Ошибка при скачивании изображения: ${error.message}`, 'error');
      
      if (error.response) {
        this.log(`📊 Статус ответа: ${error.response.status}`, 'error');
        
        if (error.response.status === 401) {
          this.log('🔒 Ошибка авторизации (401 Unauthorized). Проверьте токен Directus.', 'error');
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
      
      const baseUrl = 'https://api.telegram.org/bot';
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
      
      // Шаг 1: Скачиваем изображение с авторизацией
      const { buffer, contentType } = await this.downloadImage(imageUrl);
      
      // Шаг 2: Отправляем изображение в Telegram
      const result = await this.sendImageToTelegram(buffer, contentType, chatId, caption, token);
      
      return result;
    } catch (error) {
      this.log(`❌ Ошибка в процессе отправки изображения: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Экспортируем класс
module.exports = TelegramPublisher;

// Если скрипт запущен напрямую, запускаем тестовый пример
if (require.main === module) {
  // Функция для тестирования
  async function runTest() {
    // Параметры для теста
    const IMAGE_URL = process.env.TEST_IMAGE_URL || 'https://directus.nplanner.ru/assets/3b34be64-9579-4b1d-b4e2-98d3de5c2a14';
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
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
        'Тестовое изображение с <b>авторизацией</b> Directus 🚀',
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