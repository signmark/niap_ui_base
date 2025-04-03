// Минимальный скрипт для тестирования отправки в Telegram
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import FormData from 'form-data';

// Параметры из командной строки или по умолчанию
const TELEGRAM_TOKEN = "7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU";
const TELEGRAM_CHAT_ID = "-1002302366310";
const IMAGE_URL = "https://picsum.photos/200/300"; // Меньшее изображение

async function sendImageToTelegram() {
  try {
    console.log("Загружаем изображение...");
    
    // Создаем временный файл
    const tempDir = path.join(os.tmpdir(), 'telegram_test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `test_image_${Date.now()}.jpg`);
    
    // Скачиваем изображение
    const imageResponse = await axios.get(IMAGE_URL, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    // Сохраняем во временный файл
    fs.writeFileSync(tempFile, Buffer.from(imageResponse.data));
    console.log(`Изображение сохранено: ${tempFile} (${imageResponse.data.length} байт)`);
    
    // Создаем формдату
    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('caption', 'Тестовое изображение');
    
    // Добавляем файл
    const fileStream = fs.createReadStream(tempFile);
    form.append('photo', fileStream);
    
    // Отправляем запрос в Telegram
    console.log("Отправляем запрос в Telegram...");
    const result = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        timeout: 15000
      }
    );
    
    // Закрываем стрим
    fileStream.destroy();
    
    // Удаляем временный файл
    fs.unlinkSync(tempFile);
    
    console.log("Результат:");
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