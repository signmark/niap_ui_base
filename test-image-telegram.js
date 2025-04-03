/**
 * Тестовый скрипт для отправки изображений из Directus в Telegram
 * При запуске пытается скачать тестовое изображение из Directus с авторизацией
 * и отправить его в тестовый Telegram чат.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Параметры для тестирования
const TEST_IMAGE_URL = 'https://directus.nplanner.ru/assets/5f4bccd0-cafa-40d7-8f52-df6a45514dcc';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL || 'lbrspb@gmail.com';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD || '';

// Функция для безопасного логирования без раскрытия конфиденциальных данных
function log(message, level = 'log') {
  const now = new Date().toLocaleTimeString();
  const prefix = `[${now}] [telegram-test] `;
  
  if (level === 'error') {
    console.error(prefix + message);
  } else if (level === 'warn') {
    console.warn(prefix + message);
  } else {
    console.log(prefix + message);
  }
}

// Функция для получения токена авторизации Directus
async function getDirectusToken() {
  if (!DIRECTUS_EMAIL || !DIRECTUS_PASSWORD) {
    log('DIRECTUS_EMAIL или DIRECTUS_PASSWORD не указаны!', 'error');
    return null;
  }
  
  try {
    log('Получение токена Directus...');
    const response = await axios.post('https://directus.nplanner.ru/auth/login', {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('Токен Directus успешно получен');
      return response.data.data.access_token;
    } else {
      log('Неожиданный формат ответа от Directus API', 'error');
      return null;
    }
  } catch (error) {
    log(`Ошибка получения токена Directus: ${error.message}`, 'error');
    return null;
  }
}

// Функция для создания временного файла
function createTempFile(extension = 'tmp') {
  const tempDir = os.tmpdir();
  const randomName = crypto.randomBytes(16).toString('hex');
  return path.join(tempDir, `${randomName}.${extension}`);
}

// Функция для скачивания изображения с поддержкой авторизации Directus
async function downloadImage(imageUrl, directusToken = null) {
  try {
    log(`Скачивание изображения с URL: ${imageUrl}`);
    
    const options = {
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'image/*',
        'Cache-Control': 'no-cache'
      }
    };
    
    // Если есть токен Directus и URL содержит directus.nplanner.ru, добавляем токен
    if (directusToken && imageUrl.includes('directus.nplanner.ru')) {
      options.headers['Authorization'] = `Bearer ${directusToken}`;
      log('Добавлен токен авторизации для Directus');
    }
    
    const response = await axios(options);
    
    if (response.status !== 200) {
      throw new Error(`Неуспешный статус ответа: ${response.status}`);
    }
    
    // Определяем MIME-тип из заголовков
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    // Определяем расширение файла из MIME-типа
    const extensionMap = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    
    const extension = extensionMap[contentType] || 'jpg';
    
    // Создаем временный файл и сохраняем изображение
    const tempFilePath = createTempFile(extension);
    fs.writeFileSync(tempFilePath, response.data);
    
    log(`Изображение успешно скачано и сохранено во временный файл: ${tempFilePath}`);
    
    return {
      path: tempFilePath,
      contentType,
      buffer: response.data
    };
  } catch (error) {
    log(`Ошибка при скачивании изображения: ${error.message}`, 'error');
    throw error;
  }
}

// Функция для отправки изображения в Telegram с использованием FormData
async function sendImageToTelegram(imagePath, chatId, caption, token) {
  try {
    if (!token) {
      throw new Error('Токен Telegram не указан');
    }
    
    if (!chatId) {
      throw new Error('ID чата Telegram не указан');
    }
    
    log(`Отправка изображения в Telegram, chat_id: ${chatId}`);
    
    // Создаем FormData для multipart/form-data запроса
    const form = new FormData();
    form.append('chat_id', chatId);
    
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }
    
    // Добавляем файл изображения
    form.append('photo', fs.createReadStream(imagePath));
    
    // Отправляем запрос к Telegram API
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    if (response.data && response.data.ok) {
      log('Изображение успешно отправлено в Telegram');
      return response.data;
    } else {
      log(`Ошибка при отправке изображения в Telegram: ${JSON.stringify(response.data)}`, 'error');
      throw new Error(`Telegram API вернул ошибку: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    log(`Ошибка при отправке изображения в Telegram: ${error.message}`, 'error');
    throw error;
  } finally {
    // Удаляем временный файл в любом случае
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
        log(`Временный файл ${imagePath} удален`);
      } catch (unlinkError) {
        log(`Ошибка при удалении временного файла: ${unlinkError.message}`, 'warn');
      }
    }
  }
}

// Полная функция для загрузки изображения из URL и отправки в Telegram
async function uploadTelegramImageFromUrl(imageUrl, chatId, caption, token) {
  let directusToken = null;
  let tempImageInfo = null;
  
  try {
    // Если URL содержит directus.nplanner.ru, получаем токен авторизации
    if (imageUrl.includes('directus.nplanner.ru')) {
      directusToken = await getDirectusToken();
      if (!directusToken) {
        log('Не удалось получить токен Directus, попытка скачать без авторизации', 'warn');
      }
    }
    
    // Скачиваем изображение во временный файл
    tempImageInfo = await downloadImage(imageUrl, directusToken);
    
    // Отправляем изображение в Telegram
    const result = await sendImageToTelegram(tempImageInfo.path, chatId, caption, token);
    
    return result;
  } catch (error) {
    log(`Ошибка в процессе uploadTelegramImageFromUrl: ${error.message}`, 'error');
    throw error;
  }
}

// Главная функция для запуска тестирования
async function runTest() {
  try {
    log('Запуск тестирования отправки изображения из Directus в Telegram');
    
    if (!TELEGRAM_TOKEN) {
      log('TELEGRAM_BOT_TOKEN не указан в переменных окружения', 'error');
      return;
    }
    
    if (!TELEGRAM_CHAT_ID) {
      log('TELEGRAM_CHAT_ID не указан в переменных окружения', 'error');
      return;
    }
    
    const result = await uploadTelegramImageFromUrl(
      TEST_IMAGE_URL,
      TELEGRAM_CHAT_ID,
      'Тестовое сообщение для проверки отправки изображений из Directus в Telegram',
      TELEGRAM_TOKEN
    );
    
    log(`Результат отправки: ${JSON.stringify(result)}`);
    log('Тестирование завершено успешно');
  } catch (error) {
    log(`Ошибка при тестировании: ${error.message}`, 'error');
  }
}

// Запускаем тест, если скрипт запущен напрямую
if (require.main === module) {
  runTest();
}

// Экспортируем функции для использования в других модулях
module.exports = {
  uploadTelegramImageFromUrl,
  getDirectusToken,
  downloadImage,
  sendImageToTelegram
};