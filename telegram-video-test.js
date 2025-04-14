/**
 * Тестовый скрипт для проверки отправки видео в Telegram
 * Запустите: node telegram-video-test.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Укажите здесь токен вашего бота и ID чата для тестирования
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TEST_VIDEO_PATH = './test-image.png'; // Для начала используем маленький файл как тест

// Определения функций
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Получает локальный путь к видео или URL
 * @returns {Promise<string>} Путь к тестовому видео
 */
async function getVideoPath() {
  // Проверяем существование файла
  if (!fs.existsSync(TEST_VIDEO_PATH)) {
    log(`Тестовый файл не найден: ${TEST_VIDEO_PATH}`);
    
    // Создаем маленький тестовый PNG файл (1x1 пиксель)
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const imageBuffer = Buffer.from(base64Image, 'base64');
    fs.writeFileSync(TEST_VIDEO_PATH, imageBuffer);
    
    log(`Создан тестовый файл: ${TEST_VIDEO_PATH}`);
  }
  
  return TEST_VIDEO_PATH;
}

/**
 * Отправляет видео в Telegram
 * @param {string} filePath Путь к видео файлу
 * @param {string} caption Подпись к видео (опционально)
 * @returns {Promise<any>} Результат отправки
 */
async function sendVideoToTelegram(filePath, caption = 'Тестовое видео') {
  try {
    log(`Отправка файла ${filePath} в Telegram`);
    
    // Проверяем наличие токена и ID чата
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      log('Ошибка: не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
      return { success: false, error: 'Необходимо указать TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID' };
    }
    
    // Читаем файл
    const fileBuffer = fs.readFileSync(filePath);
    log(`Файл прочитан, размер: ${fileBuffer.length} байт`);
    
    // Подготавливаем данные формы
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('disable_notification', 'false');
    
    // Определяем тип файла и добавляем в форму
    // Для тестов: всегда добавляем как видео
    formData.append('video', fileBuffer, { filename: path.basename(filePath) });
    
    // Отправляем запрос
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );
    
    if (response.status === 200 && response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`Файл успешно отправлен, message_id: ${messageId}`);
      
      // Определяем URL публикации
      let postUrl;
      if (TELEGRAM_CHAT_ID.startsWith('@')) {
        // Для публичных каналов и групп с username
        const username = TELEGRAM_CHAT_ID.substring(1);
        postUrl = `https://t.me/${username}/${messageId}`;
      } else if (TELEGRAM_CHAT_ID.startsWith('-100')) {
        // Для приватных каналов и супергрупп
        const channelId = TELEGRAM_CHAT_ID.substring(4);
        postUrl = `https://t.me/c/${channelId}/${messageId}`;
      } else if (TELEGRAM_CHAT_ID.startsWith('-')) {
        // Для групп
        postUrl = `https://t.me/c/${TELEGRAM_CHAT_ID.substring(1)}/${messageId}`;
      } else {
        // Для персональных чатов (не будет работать как ссылка)
        postUrl = `https://t.me/c/${TELEGRAM_CHAT_ID}/${messageId}`;
      }
      
      return { 
        success: true, 
        messageId, 
        postUrl,
        response: response.data
      };
    } else {
      log(`Ошибка при отправке файла: ${JSON.stringify(response.data)}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    log(`Исключение при отправке файла: ${error.message}`);
    
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
      return { success: false, error: error.response.data };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Тестирует отправку файла из локального хранилища
 */
async function testLocalFile() {
  try {
    log('=== ТЕСТ: Отправка локального файла в Telegram ===');
    
    const videoPath = await getVideoPath();
    const result = await sendVideoToTelegram(videoPath, 'Тестовое видео из локального файла');
    
    if (result.success) {
      log(`Результат: ${JSON.stringify(result, null, 2)}`);
      log(`URL публикации: ${result.postUrl}`);
      return result;
    } else {
      log(`Ошибка: ${JSON.stringify(result.error, null, 2)}`);
      return result;
    }
  } catch (error) {
    log(`Ошибка при выполнении теста: ${error.message}`);
    return { success: false, error };
  }
}

/**
 * Запускает проверку отображения веб-страницы с видео из Telegram
 * @param {string} messageUrl URL сообщения в Telegram
 */
async function testEmbedVideo(messageUrl) {
  try {
    log(`=== ТЕСТ: Проверка встраивания видео из Telegram ===`);
    log(`URL сообщения: ${messageUrl}`);
    
    // Сообщаем пользователю, где проверить отображение
    log(`Для проверки отображения видео, откройте браузер и перейдите по ссылке:`);
    log(messageUrl);
    
    return { success: true, messageUrl };
  } catch (error) {
    log(`Ошибка при проверке встраивания видео: ${error.message}`);
    return { success: false, error };
  }
}

/**
 * Пытается получить информацию о чате Telegram
 */
async function getChatInfo() {
  try {
    log('=== ТЕСТ: Получение информации о чате Telegram ===');
    
    // Проверяем наличие токена и ID чата
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      log('Ошибка: не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
      return { success: false, error: 'Необходимо указать TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID' };
    }
    
    // Отправляем запрос на получение информации о чате
    const response = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`,
      {
        params: {
          chat_id: TELEGRAM_CHAT_ID
        }
      }
    );
    
    if (response.status === 200 && response.data && response.data.ok) {
      const chatInfo = response.data.result;
      log(`Информация о чате получена:`);
      log(JSON.stringify(chatInfo, null, 2));
      
      return { success: true, chatInfo };
    } else {
      log(`Ошибка при получении информации о чате: ${JSON.stringify(response.data)}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    log(`Исключение при получении информации о чате: ${error.message}`);
    
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
      return { success: false, error: error.response.data };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Получаем информацию о чате для проверки конфигурации
    const chatInfoResult = await getChatInfo();
    
    if (!chatInfoResult.success) {
      log('Не удалось получить информацию о чате. Проверьте токен и ID чата.');
      process.exit(1);
    }
    
    // Отправляем тестовое видео
    const result = await testLocalFile();
    
    if (result.success) {
      // Проверяем встраивание видео
      await testEmbedVideo(result.postUrl);
    }
  } catch (error) {
    log(`Ошибка при выполнении тестов: ${error.message}`);
  }
}

// Запускаем основную функцию
main().catch(error => {
  log(`Необработанное исключение: ${error.message}`);
});