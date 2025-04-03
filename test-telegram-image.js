// Простой скрипт для тестирования загрузки изображения из Directus и отправки в Telegram
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');

// Конфигурация 
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "YOUR_TELEGRAM_TOKEN"; // Подставьте ваш токен
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "YOUR_CHAT_ID"; // Подставьте ID чата
const IMAGE_URL = process.env.IMAGE_URL || "https://your-directus-url/assets/YOUR_IMAGE_UUID"; // URL изображения из Directus

async function downloadAndSendImageToTelegram() {
  console.log(`Начинаем загрузку изображения из: ${IMAGE_URL}`);
  
  try {
    // Создаем временную директорию
    const tempDir = path.join(os.tmpdir(), 'telegram_test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Генерируем имя для временного файла
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.jpg`);
    
    console.log(`Скачиваем изображение во временный файл: ${tempFilePath}`);
    
    // Скачиваем изображение
    const response = await axios.get(IMAGE_URL, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 Test Script'
      }
    });
    
    // Проверяем размер файла
    const dataSize = response.data.length;
    if (dataSize === 0) {
      throw new Error(`Скачан пустой файл (0 байт)`);
    }
    
    console.log(`Скачано ${dataSize} байт`);
    
    // Сохраняем файл
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    console.log(`Файл сохранен, размер: ${fs.statSync(tempFilePath).size} байт`);
    
    // Готовим FormData для отправки
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('caption', 'Тестовое изображение из Directus');
    formData.append('parse_mode', 'HTML');
    
    // Добавляем файл
    const fileStream = fs.createReadStream(tempFilePath);
    formData.append('photo', fileStream, { filename: `image_${timestamp}.jpg` });
    
    // Отправляем запрос
    console.log(`Отправляем изображение в Telegram...`);
    const uploadResponse = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, 
      formData, 
      {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000
      }
    );
    
    // Закрываем поток чтения файла
    fileStream.destroy();
    
    // Удаляем временный файл
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`Временный файл удален`);
    } catch (err) {
      console.error(`Ошибка при удалении временного файла: ${err.message}`);
    }
    
    // Проверяем результат
    if (uploadResponse.data && uploadResponse.data.ok) {
      console.log(`✅ Успех! Сообщение отправлено с ID: ${uploadResponse.data.result.message_id}`);
      console.log(JSON.stringify(uploadResponse.data, null, 2));
      return uploadResponse.data;
    } else {
      console.error(`❌ Ошибка при отправке: ${JSON.stringify(uploadResponse.data)}`);
      throw new Error(`API вернул ошибку: ${JSON.stringify(uploadResponse.data)}`);
    }
    
  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
    if (error.response) {
      console.error(`Детали ошибки: ${JSON.stringify(error.response.data || {})}`);
    }
    throw error;
  }
}

// Запускаем функцию
downloadAndSendImageToTelegram()
  .then(() => console.log(`Скрипт выполнен успешно`))
  .catch(err => console.error(`Скрипт завершился с ошибкой: ${err.message}`));