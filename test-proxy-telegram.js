// Тестовый скрипт для проксирования и отправки изображений в Telegram
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import FormData from 'form-data';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Параметры
const TELEGRAM_TOKEN = "7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU";
const TELEGRAM_CHAT_ID = "-1002302366310";

// Если указан оригинальный URL и ID файла из Directus, заменяем его на прокси URL
function convertToProxyUrl(originalUrl) {
  // Проверяем, является ли URL путем к активу в Directus
  if (originalUrl.includes('/assets/')) {
    // Извлекаем ID файла из URL
    const assetIdMatch = originalUrl.match(/\/assets\/([a-f0-9-]+)/i);
    if (assetIdMatch && assetIdMatch[1]) {
      const fileId = assetIdMatch[1];
      
      // Используем прокси, если он настроен, или прямой URL с токеном
      const API_PROXY = process.env.API_PROXY || "https://direct.nplanner.ru";
      return `${API_PROXY}/proxy/assets/${fileId}`;
    }
  }
  
  // Если URL не соответствует формату Directus или ID не найден, возвращаем исходный URL
  return originalUrl;
}

// Принимаем URL или ID изображения из командной строки
const args = process.argv.slice(2);
let IMAGE_URL = args[0] || "https://picsum.photos/300/200";

// Проверяем, не является ли переданный параметр UUID
const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
if (uuidRegex.test(IMAGE_URL)) {
  // Если это UUID, формируем URL для прокси
  IMAGE_URL = convertToProxyUrl(`https://directus.nplanner.ru/assets/${IMAGE_URL}`);
  console.log(`Обнаружен UUID изображения. URL прокси: ${IMAGE_URL}`);
} else if (IMAGE_URL.includes('directus.nplanner.ru/assets/')) {
  // Если это прямая ссылка на Directus, конвертируем ее в прокси URL
  IMAGE_URL = convertToProxyUrl(IMAGE_URL);
  console.log(`Ссылка на Directus преобразована в прокси URL: ${IMAGE_URL}`);
}

async function sendImageToTelegram() {
  try {
    console.log(`Загружаем изображение из: ${IMAGE_URL}`);
    
    // Создаем временный файл
    const tempDir = path.join(os.tmpdir(), 'telegram_test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `test_image_${Date.now()}.jpg`);
    
    // Скачиваем изображение с расширенными заголовками
    console.log(`Отправляем запрос для скачивания...`);
    const imageResponse = await axios.get(IMAGE_URL, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cache-Control': 'no-cache'
      }
    });
    
    // Проверяем размер скачанных данных
    const dataSize = imageResponse.data.length;
    if (dataSize === 0) {
      throw new Error(`Скачан пустой файл (0 байт)`);
    }
    
    // Сохраняем во временный файл
    fs.writeFileSync(tempFile, Buffer.from(imageResponse.data));
    console.log(`Изображение сохранено: ${tempFile} (${dataSize} байт)`);
    
    // Создаем FormData для отправки
    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('caption', 'Изображение через прокси');
    form.append('parse_mode', 'HTML');
    
    // Добавляем файл
    const fileStream = fs.createReadStream(tempFile);
    form.append('photo', fileStream, { filename: `image_${Date.now()}.jpg` });
    
    // Отправляем запрос в Telegram
    console.log("Отправляем запрос в Telegram API...");
    const result = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        timeout: 20000
      }
    );
    
    // Закрываем поток чтения файла
    fileStream.destroy();
    
    // Удаляем временный файл
    try {
      fs.unlinkSync(tempFile);
      console.log(`Временный файл удален: ${tempFile}`);
    } catch (err) {
      console.error(`Ошибка при удалении файла: ${err.message}`);
    }
    
    console.log("Результат отправки:");
    console.log(JSON.stringify(result.data, null, 2));
    
    return result.data;
  } catch (error) {
    console.error(`Ошибка: ${error.message}`);
    if (error.response) {
      console.error(`Статус ответа: ${error.response.status}`);
      console.error(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Запускаем
sendImageToTelegram()
  .then(() => console.log("Готово!"))
  .catch(err => console.error(`Ошибка: ${err}`));