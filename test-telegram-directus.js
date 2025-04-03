// Тестовый скрипт для отправки изображений из Directus в Telegram
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import FormData from 'form-data';

// Параметры
const TELEGRAM_TOKEN = "7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU";
const TELEGRAM_CHAT_ID = "-1002302366310";

// Принимаем URL или ID изображения из командной строки
const args = process.argv.slice(2);
let IMAGE_URL = args[0] || "https://picsum.photos/300/200";

// Проверяем, не является ли переданный параметр UUID 
const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
if (uuidRegex.test(IMAGE_URL)) {
  // Если это UUID, формируем полный URL для Directus
  const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://api.example.com"; // Замените на URL вашего Directus
  IMAGE_URL = `${DIRECTUS_URL}/assets/${IMAGE_URL}`;
  console.log(`Обнаружен UUID изображения Directus. Полный URL: ${IMAGE_URL}`);
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
    form.append('caption', 'Изображение из Directus');
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
      console.error(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Запускаем
sendImageToTelegram()
  .then(() => console.log("Готово!"))
  .catch(err => console.error(`Ошибка: ${err}`));