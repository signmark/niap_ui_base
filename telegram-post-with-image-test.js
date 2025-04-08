/**
 * Тест отправки поста о перекусах с изображением в Telegram
 * с правильным форматированием и без лишних переносов строк
 * 
 * Запуск: node telegram-post-with-image-test.js
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { processHtmlForTelegram } from './shared/telegram-html-processor.js';

// Основные константы
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

// Пример изображения для тестирования (путь к локальному изображению)
let TEST_IMAGE_PATH = './attached_assets/image_1740326731298.png';

// Тестовый пост о перекусах с правильным форматированием
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
 * Отправляет изображение с подписью в Telegram
 * @param {string} imagePath Путь к изображению
 * @param {string} caption Текст подписи (HTML-форматирование)
 * @returns {Promise<object>} Результат отправки
 */
async function sendPhotoWithCaption(imagePath, caption) {
  try {
    log('Отправка изображения с подписью в Telegram');
    
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
 * Проверяет, можно ли отправить текст как подпись к изображению
 * Telegram ограничивает подписи примерно до 1024 символов
 * @param {string} text Текст для проверки
 * @returns {boolean} true, если текст подходит как подпись
 */
function isTextSuitableForCaption(text) {
  // Telegram ограничивает подписи примерно до 1024 символов
  return text.length <= 1024;
}

/**
 * Разделяет длинный текст на части, если он не подходит для подписи
 * @param {string} text Исходный текст
 * @returns {string[]} Массив частей текста
 */
function splitTextToParts(text) {
  const MAX_LENGTH = 4000; // Максимальная длина сообщения в Telegram
  const parts = [];
  
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      parts.push(remaining);
      break;
    }
    
    // Ищем хорошую точку разделения - конец абзаца или предложения
    let splitPoint = remaining.substring(0, MAX_LENGTH).lastIndexOf('\n\n');
    if (splitPoint === -1 || splitPoint < MAX_LENGTH / 2) {
      splitPoint = remaining.substring(0, MAX_LENGTH).lastIndexOf('. ');
    }
    if (splitPoint === -1 || splitPoint < MAX_LENGTH / 2) {
      splitPoint = MAX_LENGTH - 1;
    }
    
    parts.push(remaining.substring(0, splitPoint + 1));
    remaining = remaining.substring(splitPoint + 1);
  }
  
  return parts;
}

/**
 * Отправляет текстовое сообщение в Telegram
 * @param {string} text HTML-текст
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
    log('Начало теста отправки поста о перекусах с изображением');
    
    // Проверяем существование файла изображения
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      log(`Ошибка: Изображение не найдено по пути ${TEST_IMAGE_PATH}`);
      // Ищем другое изображение в папке attached_assets
      const assetsDir = './attached_assets';
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const imageFiles = files.filter(file => 
          /\.(jpg|jpeg|png|gif)$/i.test(file) && file.includes('image_')
        );
        
        if (imageFiles.length > 0) {
          const alternativeImage = path.join(assetsDir, imageFiles[0]);
          log(`Найдено альтернативное изображение: ${alternativeImage}`);
          TEST_IMAGE_PATH = alternativeImage;
        } else {
          throw new Error('Не удалось найти подходящее изображение');
        }
      } else {
        throw new Error('Папка с ресурсами не найдена');
      }
    }
    
    // Обрабатываем текст с помощью нашего HTML-процессора
    log('Обработка текста поста');
    const processedHtml = processHtmlForTelegram(postText, { debug: true });
    
    // Проверяем, подходит ли текст для отправки как подпись к изображению
    if (isTextSuitableForCaption(processedHtml)) {
      // Если текст достаточно короткий, отправляем его как подпись к изображению
      log('Текст подходит для отправки как подпись к изображению');
      await sendPhotoWithCaption(TEST_IMAGE_PATH, processedHtml);
    } else {
      // Если текст слишком длинный для подписи, сначала отправляем изображение,
      // затем отправляем текст как отдельное сообщение
      log('Текст слишком длинный для подписи, отправляем его отдельно');
      
      // Отправляем изображение без подписи или с короткой подписью
      const shortCaption = '<b>Перекусить</b>\n\nПолезные и вредные перекусы';
      await sendPhotoWithCaption(TEST_IMAGE_PATH, shortCaption);
      
      // Разделяем длинный текст на части, если необходимо
      const textParts = splitTextToParts(processedHtml);
      
      // Отправляем каждую часть текста
      for (let i = 0; i < textParts.length; i++) {
        log(`Отправка части текста ${i + 1} из ${textParts.length}`);
        await sendTextMessage(textParts[i]);
        
        // Делаем паузу между отправками, чтобы избежать ограничений API
        if (i < textParts.length - 1) {
          log('Пауза 1 секунда перед отправкой следующей части...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    log('Тест завершен успешно');
  } catch (error) {
    log(`Ошибка выполнения теста: ${error.message}`);
    process.exit(1);
  }
}

// Запуск теста
runTest();