// Тестовый скрипт для скачивания изображения из Directus
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

// Принимаем URL из командной строки
const args = process.argv.slice(2);
let IMAGE_URL = args[0] || "https://picsum.photos/300/200";

// Получаем токен Directus из .env
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "";

async function downloadImage() {
  try {
    console.log(`Загружаем изображение из: ${IMAGE_URL}`);
    
    // Создаем временный файл
    const tempDir = path.join(os.tmpdir(), 'telegram_test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `test_image_${Date.now()}.jpg`);
    
    // Подготавливаем заголовки
    const headers = {
      'Accept': 'image/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Cache-Control': 'no-cache'
    };
    
    // Добавляем токен авторизации Directus, если URL от Directus
    if (IMAGE_URL.includes('directus') && DIRECTUS_TOKEN) {
      console.log(`✅ Добавляем токен авторизации Directus: ${DIRECTUS_TOKEN.substring(0, 10)}...`);
      headers['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
    }
    
    console.log(`🔄 Отправляем запрос на скачивание с заголовками:`, headers);
    
    // Скачиваем изображение с заголовками
    console.time('Время скачивания');
    const imageResponse = await axios.get(IMAGE_URL, {
      responseType: 'arraybuffer',
      timeout: 30000, // увеличенный таймаут
      headers: headers
    });
    console.timeEnd('Время скачивания');
    
    // Проверяем размер скачанных данных
    const dataSize = imageResponse.data.length;
    if (dataSize === 0) {
      throw new Error(`Скачан пустой файл (0 байт)`);
    }
    
    console.log(`📥 Получены данные изображения: ${dataSize} байт`);
    console.log(`📄 Тип контента: ${imageResponse.headers['content-type']}`);
    
    // Сохраняем во временный файл
    fs.writeFileSync(tempFile, Buffer.from(imageResponse.data));
    console.log(`💾 Изображение сохранено: ${tempFile} (${dataSize} байт)`);
    
    return {
      tempFile,
      contentType: imageResponse.headers['content-type'] || 'image/jpeg',
      dataSize
    };
  } catch (error) {
    console.error(`❌ Ошибка при скачивании изображения: ${error.message}`);
    if (error.response) {
      console.error(`📊 Статус ответа: ${error.response.status}`);
      console.error(`📝 Данные ответа:`, error.response.data);
    }
    throw error;
  }
}

async function sendToTelegram(imageInfo) {
  try {
    console.log(`📤 Подготовка к отправке в Telegram...`);
    
    // Создаем FormData для отправки
    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('caption', `Изображение из Directus (${imageInfo.dataSize} байт)`);
    form.append('parse_mode', 'HTML');
    
    // Добавляем файл
    console.log(`📎 Прикрепляем файл ${imageInfo.tempFile}`);
    const fileStream = fs.createReadStream(imageInfo.tempFile);
    form.append('photo', fileStream, { 
      filename: `image_${Date.now()}.jpg`,
      contentType: imageInfo.contentType 
    });
    
    // Отправляем запрос в Telegram
    console.log(`🚀 Отправляем запрос в Telegram API...`);
    console.time('Время отправки');
    
    const result = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        timeout: 30000 // увеличенный таймаут
      }
    );
    
    console.timeEnd('Время отправки');
    
    // Закрываем поток чтения файла
    fileStream.destroy();
    
    console.log(`✅ Результат отправки:`, JSON.stringify(result.data, null, 2));
    
    return result.data;
  } catch (error) {
    console.error(`❌ Ошибка при отправке в Telegram: ${error.message}`);
    if (error.response) {
      console.error(`📊 Статус ответа: ${error.response.status}`);
      console.error(`📝 Данные ответа:`, error.response.data);
    }
    throw error;
  } finally {
    // Удаляем временный файл
    try {
      if (imageInfo && imageInfo.tempFile && fs.existsSync(imageInfo.tempFile)) {
        fs.unlinkSync(imageInfo.tempFile);
        console.log(`🗑️ Временный файл удален: ${imageInfo.tempFile}`);
      }
    } catch (err) {
      console.error(`⚠️ Ошибка при удалении файла: ${err.message}`);
    }
  }
}

// Запускаем
async function main() {
  console.log(`🔄 Начинаем обработку изображения: ${IMAGE_URL}`);
  try {
    const imageInfo = await downloadImage();
    await sendToTelegram(imageInfo);
    console.log(`✅ Операция завершена успешно!`);
  } catch (err) {
    console.error(`❌ Ошибка при выполнении: ${err}`);
  }
}

main();