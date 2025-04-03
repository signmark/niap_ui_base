/**
 * Скрипт для проверки работы патча для загрузки изображений Directus с авторизацией
 */
require('dotenv').config();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const FormData = require('form-data');

// Путь к Directus
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD;

// Параметры для Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// URL изображения в Directus для тестирования
const IMAGE_URL = 'https://directus.nplanner.ru/assets/3b34be64-9579-4b1d-b4e2-98d3de5c2a14';

// Получаем токен авторизации Directus
async function getDirectusToken() {
  console.log('🔄 Получение токена авторизации Directus...');
  
  try {
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      console.log('✅ Токен Directus успешно получен');
      return response.data.data.access_token;
    } else {
      console.error('❌ Ошибка получения токена Directus: неожиданный формат ответа');
      console.log(response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка при авторизации в Directus:', error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
    return null;
  }
}

// Скачиваем изображение с авторизацией
async function downloadImage(imageUrl, token) {
  console.log(`🔄 Скачивание изображения: ${imageUrl.substring(0, 50)}...`);
  
  try {
    const headers = {
      'Accept': 'image/*',
      'User-Agent': 'Mozilla/5.0 SMM Planner Bot',
      'Cache-Control': 'no-cache'
    };
    
    // Добавляем токен авторизации, если он есть
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Выполняем запрос
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: headers
    });
    
    // Проверяем, что получили данные
    if (!response.data || response.data.length === 0) {
      throw new Error('Получен пустой ответ от сервера');
    }
    
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

// Отправляем изображение в Telegram
async function sendImageToTelegram(imageBuffer, contentType, caption) {
  console.log('🔄 Подготовка к отправке изображения в Telegram...');
  
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Отсутствуют необходимые параметры TELEGRAM_TOKEN или TELEGRAM_CHAT_ID');
    return null;
  }
  
  // Создаем временную директорию
  const tempDir = path.join(os.tmpdir(), 'telegram_test');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Создаем временный файл
  const timestamp = Date.now();
  const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
  const tempFilePath = path.join(tempDir, `test_${timestamp}.${fileExtension}`);
  
  try {
    // Сохраняем буфер во временный файл
    fs.writeFileSync(tempFilePath, imageBuffer);
    console.log(`💾 Изображение сохранено во временный файл: ${tempFilePath} (${fs.statSync(tempFilePath).size} байт)`);
    
    // Создаем FormData
    const formData = new FormData();
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
    
    // Отправляем в Telegram
    console.log('🚀 Отправка изображения в Telegram...');
    const baseUrl = 'https://api.telegram.org/bot';
    const response = await axios.post(`${baseUrl}${TELEGRAM_TOKEN}/sendPhoto`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Accept': 'application/json'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    // Закрываем поток
    fileStream.destroy();
    
    // Удаляем временный файл
    fs.unlinkSync(tempFilePath);
    console.log('🗑️ Временный файл удален');
    
    // Проверяем результат
    if (response.data && response.data.ok) {
      console.log(`✅ Изображение успешно отправлено: message_id=${response.data.result.message_id}`);
      return response.data;
    } else {
      console.error('❌ Ошибка при отправке:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка при отправке изображения:', error.message);
    
    // Удаляем временный файл в случае ошибки
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('🗑️ Временный файл удален после ошибки');
    }
    
    if (error.response) {
      console.error('Статус ответа:', error.response.status);
      console.error('Данные ответа:', error.response.data);
    }
    
    return null;
  }
}

// Запускаем тест
async function runTest() {
  console.log('🧪 Начинаем тест загрузки изображения Directus с авторизацией');
  
  try {
    // Шаг 1: Получаем токен авторизации Directus
    const directusToken = await getDirectusToken();
    
    if (!directusToken) {
      console.error('❌ Не удалось получить токен Directus, продолжаем без авторизации');
    }
    
    // Шаг 2: Скачиваем изображение с авторизацией
    const { buffer, contentType } = await downloadImage(IMAGE_URL, directusToken);
    
    // Шаг 3: Отправляем изображение в Telegram
    const result = await sendImageToTelegram(buffer, contentType, 'Тестовое изображение с <b>авторизацией</b> Directus 🚀');
    
    if (result) {
      console.log('✅ Тест успешно завершен!');
    } else {
      console.error('❌ Тест не пройден: не удалось отправить изображение в Telegram');
    }
  } catch (error) {
    console.error('❌ Ошибка при выполнении теста:', error.message);
  }
}

// Запускаем тест
runTest();