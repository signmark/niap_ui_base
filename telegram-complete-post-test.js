/**
 * Тест для проверки отправки полного поста в Telegram с изображением и форматированием
 * Скрипт проверяет все аспекты публикации: текст, HTML-форматирование, эмодзи и изображения
 * 
 * Запуск: node telegram-complete-post-test.js
 */
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { processHtmlForTelegram } = require('./shared/telegram-html-processor');

// Настройки Telegram из .env
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Функция для вывода сообщений с временной меткой
function log(message) {
  const timestamp = new Date().toLocaleTimeString('ru-RU');
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Отправляет изображение с HTML-подписью в Telegram
 * @param {string} imageUrl URL изображения или путь к локальному файлу
 * @param {string} caption HTML-текст подписи (должен быть < 1024 символов)
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithHtmlCaption(imageUrl, caption) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('Отсутствуют настройки Telegram (TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID)');
    return { success: false, error: 'Missing Telegram settings' };
  }

  log(`Отправка изображения с HTML-подписью (${caption.length} символов) в Telegram`);
  
  try {
    // Определяем, это локальный файл или URL
    let imageData;
    let isLocalFile = false;
    
    if (imageUrl.startsWith('http')) {
      // Внешний URL - скачиваем файл
      log(`Скачивание изображения с URL: ${imageUrl}`);
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      imageData = Buffer.from(response.data, 'binary');
    } else {
      // Локальный файл - читаем
      log(`Чтение локального файла: ${imageUrl}`);
      isLocalFile = true;
      imageData = fs.readFileSync(imageUrl);
    }
    
    // Формируем данные для отправки
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('parse_mode', 'HTML');
    formData.append('caption', caption);
    
    // Добавляем файл изображения с правильным именем
    const fileName = isLocalFile ? imageUrl.split('/').pop() : 'image.jpg';
    formData.append('photo', new Blob([imageData]), fileName);
    
    // Отправляем запрос к API Telegram
    const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const response = await axios.post(apiUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`Изображение успешно отправлено, message_id: ${messageId}`);
      
      return {
        success: true,
        messageId,
        result: response.data.result
      };
    } else {
      log(`Ошибка при отправке изображения: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data?.description || 'Unknown error',
        data: response.data
      };
    }
  } catch (error) {
    log(`Исключение при отправке изображения: ${error.message}`);
    if (error.response) {
      log(`Статус: ${error.response.status}, данные: ${JSON.stringify(error.response.data)}`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Отправляет изображение с большим HTML-текстом в Telegram
 * Если текст больше MAX_CAPTION_LENGTH, отправляет его отдельным сообщением
 * @param {string} imageUrl URL изображения
 * @param {string} html HTML-текст
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithLongText(imageUrl, html) {
  const MAX_CAPTION_LENGTH = 1024; // Максимальная длина подписи в Telegram
  
  try {
    if (html.length <= MAX_CAPTION_LENGTH) {
      log(`Текст подходит для подписи (${html.length} <= ${MAX_CAPTION_LENGTH}), отправляем с изображением`);
      return await sendImageWithHtmlCaption(imageUrl, html);
    } else {
      log(`Текст слишком длинный для подписи (${html.length} > ${MAX_CAPTION_LENGTH}), отправляем раздельно`);
      
      // Отправляем изображение с коротким заголовком
      const title = html.match(/<b>(.*?)<\/b>/i);
      const shortCaption = title ? title[0] : '';
      
      log(`Отправка изображения с коротким заголовком: "${shortCaption}"`);
      const imageResult = await sendImageWithHtmlCaption(imageUrl, shortCaption);
      
      if (!imageResult.success) {
        return imageResult;
      }
      
      // Отправляем полный текст отдельным сообщением
      log(`Отправка полного текста отдельным сообщением`);
      const textResult = await sendHtmlMessage(html);
      
      return {
        success: true,
        imageMessageId: imageResult.messageId,
        textMessageId: textResult.messageId,
        result: [imageResult.result, textResult.result]
      };
    }
  } catch (error) {
    log(`Ошибка при отправке изображения с текстом: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('Отсутствуют настройки Telegram (TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID)');
    return { success: false, error: 'Missing Telegram settings' };
  }
  
  try {
    // Убедимся, что HTML-теги правильно обработаны
    const processedHtml = processHtmlForTelegram(html, { debug: true });
    
    log(`Отправка HTML-сообщения в Telegram (${processedHtml.length} символов)`);
    log(`Начало текста: ${processedHtml.substring(0, Math.min(50, processedHtml.length))}...`);
    
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: processedHtml,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`Сообщение успешно отправлено, message_id: ${messageId}`);
      
      return {
        success: true,
        messageId,
        result: response.data.result
      };
    } else {
      log(`Ошибка при отправке сообщения: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data?.description || 'Unknown error',
        data: response.data
      };
    }
  } catch (error) {
    log(`Исключение при отправке сообщения: ${error.message}`);
    if (error.response) {
      log(`Статус: ${error.response.status}, данные: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Тестирует отправку полного поста из контента как на скриншоте
 */
async function testCompletePost() {
  log('Начало теста отправки полного поста в Telegram');
  
  // HTML-текст поста с форматированием как на скриншоте
  const postHTML = `<b>Перекусить</b>

В ходе предыдущего обсуждения мы рассмотрели причины, по которым завтрак является наиболее важным приемом пищи, и его влияние на уровень энергии, метаболизм и контроль аппетита. 😊 В настоящее время целесообразно проанализировать роль перекусов, поскольку они могут как способствовать поддержанию здоровья 🌱, так и незаметно наносить вред фигуре и самочувствию. 🍕

Перекусы помогают избежать резких колебаний уровня сахара в крови, поддерживают энергетический баланс и предотвращают чрезмерное чувство голода, которое зачастую приводит к переедания во время основных приемов пищи. 🍑 Следует, однако, понимать, что не все перекусы одинаково полезны. ⚠️ К нежелательным перекусам относятся сладости, булочки, печенье, чипсы и прочие продукты фастфуда. 🍔 Они вызывают быстрое повышение уровня сахара в крови, обеспечивая кратковременный прилив энергии, но столь же стремительно приводят к усталости, усилению аппетита и накоплению жировых отложений. 😫

Полезными перекусами являются те, которые обеспечивают чувство сытости, стабильный энергетический баланс и способствуют поддержанию здоровья. 🍏`;

  // URL изображения для публикации
  const imageUrl = './attached_assets/image_1740326731298.png';
  
  // Отправляем пост с изображением
  const result = await sendImageWithLongText(imageUrl, postHTML);
  
  if (result.success) {
    log('Тест успешно завершен');
  } else {
    log(`Тест завершен с ошибкой: ${result.error}`);
  }
}

// Запускаем тестирование
testCompletePost();