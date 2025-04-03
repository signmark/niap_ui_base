// Модифицированный тестовый скрипт для отправки изображений из Directus в Telegram
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import FormData from 'form-data';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Параметры
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1002302366310";
const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://directus.nplanner.ru";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || ""; // Токен для авторизации в Directus

// Универсальная функция для отправки изображения в Telegram
async function sendDirectusImageToTelegram(imageUrl, chatId, caption, token) {
  try {
    console.log(`[ОТПРАВКА] Отправка изображения в Telegram: ${imageUrl}`);
    
    // Создаем временный файл
    const tempDir = path.join(os.tmpdir(), 'telegram_upload');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `telegram_upload_${Date.now()}.jpg`);
    
    // Определяем, нужна ли авторизация Directus
    const isDirectusUrl = imageUrl.includes("directus") || imageUrl.includes("/assets/");
    const headers = {
      'Accept': 'image/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Cache-Control': 'no-cache'
    };
    
    if (isDirectusUrl && DIRECTUS_TOKEN) {
      console.log('[ОТПРАВКА] 🔑 Добавлен заголовок авторизации для Directus');
      headers['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
    }
    
    // Скачиваем изображение
    console.log('[ОТПРАВКА] ⬇️ Скачиваем изображение...');
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: headers
    });
    
    // Проверяем, что скачался не пустой файл
    const dataSize = imageResponse.data.length;
    if (dataSize === 0) {
      throw new Error('[ОТПРАВКА] ❌ Скачан пустой файл (0 байт)');
    }
    
    console.log(`[ОТПРАВКА] ✅ Скачано ${dataSize} байт`);
    
    // Сохраняем во временный файл
    fs.writeFileSync(tempFile, Buffer.from(imageResponse.data));
    console.log(`[ОТПРАВКА] 💾 Изображение сохранено: ${tempFile}`);
    
    // Создаем FormData для отправки
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption || 'Изображение');
    form.append('parse_mode', 'HTML');
    
    // Добавляем файл как поток
    const fileStream = fs.createReadStream(tempFile);
    form.append('photo', fileStream, { filename: `image_${Date.now()}.jpg` });
    
    // Отправляем запрос в Telegram
    console.log("[ОТПРАВКА] 📤 Отправляем в Telegram API...");
    const telegramUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
    
    const result = await axios.post(
      telegramUrl,
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        timeout: 20000,
        maxBodyLength: 20 * 1024 * 1024 // 20MB
      }
    );
    
    // Закрываем поток файла
    fileStream.destroy();
    
    // Удаляем временный файл
    try {
      fs.unlinkSync(tempFile);
      console.log(`[ОТПРАВКА] 🗑️ Временный файл удален: ${tempFile}`);
    } catch (err) {
      console.error(`[ОТПРАВКА] ⚠️ Ошибка при удалении файла: ${err.message}`);
    }
    
    console.log("[ОТПРАВКА] ✅ Изображение успешно отправлено в Telegram");
    return result.data;
  } catch (error) {
    console.error(`[ОТПРАВКА] ❌ Ошибка: ${error.message}`);
    
    if (error.response) {
      console.error(`[ОТПРАВКА] Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

// Пример использования
async function testSend() {
  try {
    // Проверяем на доступность токенов
    if (!TELEGRAM_TOKEN) {
      console.error("❌ Отсутствует TELEGRAM_BOT_TOKEN. Установите его в переменных окружения.");
      return;
    }
    
    if (!TELEGRAM_CHAT_ID) {
      console.error("❌ Отсутствует TELEGRAM_CHAT_ID. Установите его в переменных окружения.");
      return;
    }
    
    // Тестовое изображение
    const imageUrl = process.argv[2] || "https://picsum.photos/300/200";
    const caption = "Тестовое сообщение через улучшенный интерфейс";
    
    console.log(`🧪 Запуск тестовой отправки изображения: ${imageUrl}`);
    const result = await sendDirectusImageToTelegram(
      imageUrl,
      TELEGRAM_CHAT_ID,
      caption,
      TELEGRAM_TOKEN
    );
    
    console.log("✅ Результат успешной отправки:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`❌ Тест не пройден: ${error.message}`);
  }
}

// Запускаем тест
testSend();