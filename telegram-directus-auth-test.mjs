/**
 * Тестовый скрипт для проверки отправки изображений из Directus в Telegram
 * с авторизацией через кэш токенов Directus
 * 
 * Версия для ES модулей
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

// Настройки Directus
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD;

// Настройки Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// URL изображения для теста
const IMAGE_URL = process.env.TEST_IMAGE_URL || 'https://directus.nplanner.ru/assets/3b34be64-9579-4b1d-b4e2-98d3de5c2a14';

// Хранилище токенов авторизации
const authTokens = {
  directus: null,
  expiresAt: 0
};

// Проверяет, действителен ли токен Directus
function isTokenValid() {
  return authTokens.directus && Date.now() < authTokens.expiresAt;
}

// Получает токен авторизации Directus
async function getDirectusToken() {
  console.log('🔄 Получение токена авторизации Directus...');
  
  // Проверяем, есть ли у нас действующий токен
  if (isTokenValid()) {
    console.log('✅ Используем существующий токен Directus');
    return authTokens.directus;
  }
  
  try {
    // Авторизуемся и получаем новый токен
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      authTokens.directus = response.data.data.access_token;
      authTokens.expiresAt = Date.now() + (response.data.data.expires * 1000 || 3600000);
      
      console.log('✅ Токен Directus успешно получен и сохранен');
      return authTokens.directus;
    } else {
      console.error('❌ Ошибка получения токена Directus: неожиданный формат ответа');
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка при авторизации в Directus:', error.message);
    if (error.response) {
      console.error('Статус ответа:', error.response.status);
      console.error('Данные ответа:', error.response.data);
    }
    return null;
  }
}

// Скачивает изображение с авторизацией
async function downloadImage(imageUrl) {
  console.log(`📥 Скачивание изображения: ${imageUrl.substring(0, 50)}...`);
  
  try {
    // Подготавливаем заголовки запроса
    const headers = {
      'Accept': 'image/*',
      'User-Agent': 'Mozilla/5.0 SMM Planner Bot',
      'Cache-Control': 'no-cache'
    };
    
    // Если URL от Directus, добавляем авторизацию
    if (imageUrl.includes('directus.nplanner.ru')) {
      const token = await getDirectusToken();
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('🔑 Добавлен токен авторизации Directus');
      } else {
        console.warn('⚠️ Не удалось получить токен Directus, продолжаем без авторизации');
      }
    }
    
    // Выполняем запрос с авторизацией
    console.time('⏱️ Время скачивания изображения');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 секунд таймаут
      headers: headers
    });
    console.timeEnd('⏱️ Время скачивания изображения');
    
    // Проверяем полученные данные
    const dataSize = response.data.length;
    if (dataSize === 0) {
      throw new Error('Получен пустой ответ от сервера');
    }
    
    // Определяем тип контента
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    console.log(`✅ Изображение успешно загружено: ${dataSize} байт, тип: ${contentType}`);
    
    return {
      buffer: Buffer.from(response.data),
      contentType: contentType
    };
  } catch (error) {
    console.error('❌ Ошибка при скачивании изображения:', error.message);
    if (error.response) {
      console.error('Статус ответа:', error.response.status);
      console.error('Данные ответа:', error.response.data);
    }
    throw error;
  }
}

// Отправляет изображение в Telegram через FormData
async function sendImageToTelegram(imageBuffer, contentType, caption) {
  console.log('🔄 Подготовка к отправке изображения в Telegram...');
  
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Отсутствуют необходимые параметры TELEGRAM_TOKEN или TELEGRAM_CHAT_ID');
  }
  
  // Создаем временную директорию
  const tempDir = path.join(os.tmpdir(), 'telegram_test');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Генерируем имя для временного файла
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
  const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.${fileExtension}`);
  
  try {
    // Сохраняем изображение во временный файл
    fs.writeFileSync(tempFilePath, imageBuffer);
    console.log(`💾 Изображение сохранено во временный файл: ${tempFilePath} (${fs.statSync(tempFilePath).size} байт)`);
    
    // Создаем FormData
    const formData = new FormData();
    
    // Добавляем параметры
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    
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
    console.log(`🚀 Отправка изображения в Telegram чат: ${TELEGRAM_CHAT_ID}`);
    console.time('⏱️ Время отправки в Telegram');
    
    const baseUrl = 'https://api.telegram.org/bot';
    const response = await axios.post(`${baseUrl}${TELEGRAM_TOKEN}/sendPhoto`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000 // 60 секунд таймаут
    });
    
    console.timeEnd('⏱️ Время отправки в Telegram');
    
    // Закрываем поток чтения
    fileStream.destroy();
    
    // Удаляем временный файл
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`🗑️ Временный файл удален: ${tempFilePath}`);
    } catch (unlinkError) {
      console.warn(`⚠️ Не удалось удалить временный файл: ${unlinkError}`);
    }
    
    // Проверяем результат
    if (response.data && response.data.ok) {
      console.log(`✅ Изображение успешно отправлено в Telegram: message_id=${response.data.result.message_id}`);
      return response.data;
    } else {
      console.error(`❌ Ошибка при отправке изображения в Telegram: ${JSON.stringify(response.data)}`);
      throw new Error(`API вернул ошибку: ${JSON.stringify(response.data)}`);
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
      console.error('Данные ответа:', error.response.data);
    }
    
    throw error;
  }
}

// Запускаем тест
async function runTest() {
  console.log('🧪 Начинаем тест отправки изображения из Directus в Telegram');
  console.log(`🔗 URL изображения: ${IMAGE_URL}`);
  console.log(`📱 Telegram чат: ${TELEGRAM_CHAT_ID}`);
  
  try {
    // Шаг 1: Скачиваем изображение с авторизацией
    const { buffer, contentType } = await downloadImage(IMAGE_URL);
    
    // Шаг 2: Отправляем изображение в Telegram
    const result = await sendImageToTelegram(
      buffer, 
      contentType, 
      'Тестовое изображение с <b>авторизацией</b> Directus 🚀\n\nОтправлено через ESM скрипт'
    );
    
    console.log('✅ Тест успешно завершен!');
    console.log(`📊 Результат: ${JSON.stringify(result.result)}`);
    
    return result;
  } catch (error) {
    console.error('❌ Ошибка при выполнении теста:', error.message);
    throw error;
  }
}

// Запускаем тест
runTest().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});