/**
 * Тест отправки поста с изображением из скриншота пользователя
 * Скрипт отправляет пост с правильным форматированием, сохраняя эмодзи и структуру текста
 * 
 * Запуск: node telegram-screenshot-post-test.js
 */

import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { processHtmlForTelegram } from './shared/telegram-html-processor.js';

// Основные константы
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

// Путь к скриншоту пользователя
const SCREENSHOT_PATH = './attached_assets/Screenshot_2025-04-08-20-10-31-328_org.telegram.messenger.jpg';

// Текст поста, точно соответствующий примеру на скриншоте (без лишних переносов строк)
const postText = `
<b>Перекусить</b>

В ходе предыдущего обсуждения мы рассмотрели причины, по которым завтрак является наиболее важным приемом пищи, и его влияние на уровень энергии, метаболизм и контроль аппетита. 🌞 В настоящее время целесообразно проанализировать роль перекусов, поскольку они могут как способствовать поддержанию здоровья 🏋️‍♀️, так и незаметно наносить вред фигуре и самочувствию. 🍕

Перекусы помогают избежать резких колебаний уровня сахара в крови, поддерживают энергетический баланс и предотвращают чрезмерное чувство голода, которое зачастую приводит к переедания во время основных приемов пищи. ⏰ Следует, однако, понимать, что не все перекусы одинаково полезны. ⚠️ К нежелательным перекусам относятся сладости, булочки, печенье, чипсы и прочие продукты фастфуда. 🍩 Они вызывают быстрое повышение уровня сахара в крови, обеспечивая кратковременный прилив энергии, но столь же стремительно приводят к усталости, усилению аппетита и накоплению жировых отложений. 😩

Полезными перекусами являются те, которые обеспечивают чувство сытости, стабильный энергетический баланс и поступление питательных веществ. 🥗 К ним можно отнести орехи, ягоды, фрукты, овощи с хумусом, яйца, греческий йогурт, творог, цельнозерновые хлебцы с авокадо или ореховой пастой. 🥜🍓🥑

Рекомендации по правильному перекусыванию: 📝

• Выбирайте перекусы, содержащие белок, полезные жиры и клетчатку – они дольше обеспечивают чувство сытости и поддерживают обмен веществ. 💪
• Не употребляйте пищу автоматически – перекус необходим, если вы действительно испытываете легкое чувство голода, а не просто по привычке или от скуки. 🤔
• Контролируйте размер порции – горсть орехов полезна, но если съесть полпакета, это уже станет полноценным приемом пищи. 🥜

Если вы стремитесь разобраться в вопросах питания, избавиться от вредных привычек и выстроить комфортную систему питания, присоединяйтесь к нашему марафону на нашем телеграм-канале.
`;

/**
 * Выводит сообщение в консоль с временной меткой
 * @param {string} message Сообщение
 */
function log(message) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ru-RU');
  console.log(`[${timeStr}] ${message}`);
}

/**
 * Отправляет сам скриншот как наглядный пример для сравнения
 * @returns {Promise<object>} Результат отправки
 */
async function sendOriginalScreenshot() {
  try {
    log('Отправка оригинального скриншота для сравнения');
    
    if (!fs.existsSync(SCREENSHOT_PATH)) {
      throw new Error(`Скриншот не найден: ${SCREENSHOT_PATH}`);
    }
    
    const baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    
    // Формируем chatId в нужном формате
    let formattedChatId = TELEGRAM_CHAT_ID;
    if (!TELEGRAM_CHAT_ID.startsWith('-100') && !isNaN(Number(TELEGRAM_CHAT_ID)) && !TELEGRAM_CHAT_ID.startsWith('@')) {
      formattedChatId = `-100${TELEGRAM_CHAT_ID}`;
    }
    
    // Создание FormData для отправки изображения
    const formData = new FormData();
    formData.append('chat_id', formattedChatId);
    formData.append('caption', 'Оригинальный скриншот для сравнения');
    formData.append('photo', fs.createReadStream(SCREENSHOT_PATH));
    
    const response = await axios.post(`${baseUrl}/sendPhoto`, formData, {
      headers: formData.getHeaders()
    });
    
    if (response.data && response.data.ok) {
      log(`Скриншот успешно отправлен, message_id: ${response.data.result.message_id}`);
      return response.data;
    } else {
      throw new Error(`Telegram API вернул ошибку: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    log(`Ошибка отправки скриншота: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Отправляет изображение с подписью в Telegram
 * @param {string} imagePath Путь к изображению
 * @param {string} caption Текст подписи
 * @returns {Promise<object>} Результат отправки
 */
async function sendPhotoWithCaption(imagePath, caption) {
  try {
    log('Отправка изображения с подписью в Telegram');
    
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Изображение не найдено: ${imagePath}`);
    }
    
    const baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    
    // Формируем chatId в нужном формате
    let formattedChatId = TELEGRAM_CHAT_ID;
    if (!TELEGRAM_CHAT_ID.startsWith('-100') && !isNaN(Number(TELEGRAM_CHAT_ID)) && !TELEGRAM_CHAT_ID.startsWith('@')) {
      formattedChatId = `-100${TELEGRAM_CHAT_ID}`;
    }
    
    // Создание FormData для отправки изображения
    const formData = new FormData();
    formData.append('chat_id', formattedChatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('photo', fs.createReadStream(imagePath));
    
    const response = await axios.post(`${baseUrl}/sendPhoto`, formData, {
      headers: formData.getHeaders()
    });
    
    if (response.data && response.data.ok) {
      log(`Изображение успешно отправлено, message_id: ${response.data.result.message_id}`);
      return response.data;
    } else {
      throw new Error(`Telegram API вернул ошибку: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    log(`Ошибка отправки изображения: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Отправляет текстовое сообщение в Telegram
 * @param {string} text HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendTextMessage(text) {
  try {
    log('Отправка текстового сообщения в Telegram');
    
    const baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    
    // Формируем chatId в нужном формате
    let formattedChatId = TELEGRAM_CHAT_ID;
    if (!TELEGRAM_CHAT_ID.startsWith('-100') && !isNaN(Number(TELEGRAM_CHAT_ID)) && !TELEGRAM_CHAT_ID.startsWith('@')) {
      formattedChatId = `-100${TELEGRAM_CHAT_ID}`;
    }
    
    const response = await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: formattedChatId,
      text: text,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      log(`Сообщение успешно отправлено, message_id: ${response.data.result.message_id}`);
      return response.data;
    } else {
      throw new Error(`Telegram API вернул ошибку: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    log(`Ошибка отправки сообщения: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Основная функция для выполнения теста
 */
async function runTest() {
  try {
    log('Начало теста отправки поста из скриншота пользователя');
    
    // Сначала отправляем оригинальный скриншот для сравнения
    await sendOriginalScreenshot();
    
    // Делаем небольшую паузу
    log('Пауза 1 секунда перед отправкой воссозданного поста...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Подготавливаем текст с помощью нашего HTML-процессора
    log('Обработка текста поста');
    const processedHtml = processHtmlForTelegram(postText, { debug: true });
    
    // Выбираем изображение о здоровых перекусах
    const foodImagePath = './attached_assets/image_1740326731298.png';
    
    // Проверяем длину обработанного текста
    if (processedHtml.length <= 1024) {
      // Если текст подходит для отправки как подпись к изображению
      log('Текст подходит для отправки как подпись к изображению');
      await sendPhotoWithCaption(foodImagePath, processedHtml);
    } else {
      // Если текст слишком длинный для подписи
      log('Текст слишком длинный для подписи, отправляем отдельно');
      
      // Сначала отправляем изображение с коротким заголовком
      const shortCaption = '<b>Перекусить</b>\n\nПолезные и вредные перекусы';
      await sendPhotoWithCaption(foodImagePath, shortCaption);
      
      // Затем отправляем полный текст
      await sendTextMessage(processedHtml);
    }
    
    log('Тест успешно завершен');
  } catch (error) {
    log(`Ошибка выполнения теста: ${error.message}`);
    process.exit(1);
  }
}

// Запуск теста
runTest();