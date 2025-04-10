/**
 * Комплексный тест для проверки отправки изображений с HTML-форматированным 
 * текстом в Telegram с разными стратегиями в зависимости от длины текста
 * 
 * Запуск: node telegram-image-html-test.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import FormData from 'form-data';

// Загружаем переменные окружения
dotenv.config();

// Настройки из переменных окружения
const TELEGRAM_TOKEN = process.env.TELEGRAM_TEST_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_TEST_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

// Проверяем наличие настроек
if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Ошибка: Отсутствуют настройки для Telegram (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)');
  process.exit(1);
}

// Константы
const SMALL_TEXT_THRESHOLD = 1000; // Порог для определения "маленького" текста

/**
 * Выводит сообщение в консоль с временной меткой
 * @param {string} message Сообщение
 */
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Исправляет незакрытые HTML-теги и преобразует HTML в формат, совместимый с Telegram
 * @param {string} html HTML-текст
 * @returns {string} Исправленный HTML-текст
 */
function fixHtmlForTelegram(html) {
  if (!html) return '';
  
  // Список тегов, поддерживаемых Telegram
  const supportedTags = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'pre', 'a'];
  
  // Преобразует некоторые неподдерживаемые теги в поддерживаемые аналоги
  let processedHtml = html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '<b>$1</b>') // h1-h6 -> b
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n') // p -> текст с переводами строк
    .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n') // div -> текст с переводом строки
    .replace(/<br\s*\/?>/gi, '\n') // br -> перевод строки
    .replace(/<hr\s*\/?>/gi, '\n———\n'); // hr -> линия из символов
  
  // Удаляем все неподдерживаемые теги, но сохраняем их содержимое
  const unsupportedTagsRegex = new RegExp(`<(?!\/?(${supportedTags.join('|')})[\\s>])[^>]*>`, 'gi');
  processedHtml = processedHtml.replace(unsupportedTagsRegex, '');
  
  // Стандартизируем поддерживаемые теги
  processedHtml = processedHtml
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<b>$1</b>')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '<i>$1</i>')
    .replace(/<strike[^>]*>(.*?)<\/strike>/gi, '<s>$1</s>')
    .replace(/<del[^>]*>(.*?)<\/del>/gi, '<s>$1</s>');
  
  // Стек для отслеживания открытых тегов
  const openTags = [];
  
  // Регулярное выражение для поиска всех тегов (открывающих и закрывающих)
  const tagRegex = /<\/?([a-z][a-z0-9]*)[^>]*>/gi;
  let match;
  let processedText = '';
  let lastIndex = 0;
  
  // Отслеживаем открытые и закрытые теги
  while ((match = tagRegex.exec(processedHtml)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    
    // Добавляем текст между тегами
    processedText += processedHtml.substring(lastIndex, match.index);
    lastIndex = match.index + fullTag.length;
    
    if (supportedTags.includes(tagName)) {
      if (!isClosing) {
        // Открывающий тег
        openTags.push(tagName);
        processedText += fullTag;
      } else {
        // Закрывающий тег
        if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
          // Корректный закрывающий тег
          openTags.pop();
          processedText += fullTag;
        } else {
          // Неправильный порядок закрывающих тегов - пропускаем
        }
      }
    }
  }
  
  // Добавляем оставшийся текст
  processedText += processedHtml.substring(lastIndex);
  
  // Закрываем оставшиеся открытые теги в обратном порядке
  for (let i = openTags.length - 1; i >= 0; i--) {
    processedText += `</${openTags[i]}>`;
  }
  
  return processedText;
}

/**
 * Отправляет изображение с HTML-подписью в Telegram
 * @param {string} imageUrl URL изображения
 * @param {string} caption HTML-подпись к изображению
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithHtmlCaption(imageUrl, caption) {
  try {
    log(`Отправка изображения с HTML-подписью: ${imageUrl}`);
    log(`Подпись (${caption.length} символов): ${caption.substring(0, 100)}...`);
    
    // Исправляем HTML в подписи
    const fixedCaption = fixHtmlForTelegram(caption);
    log(`Исправленная подпись: ${fixedCaption.substring(0, 100)}...`);
    
    // Отправляем через Telegram API
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        photo: imageUrl,
        caption: fixedCaption,
        parse_mode: 'HTML'
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`Изображение с подписью успешно отправлено. Message ID: ${messageId}`);
      
      // Формируем URL сообщения
      let formattedChatId = TELEGRAM_CHAT_ID;
      if (TELEGRAM_CHAT_ID.startsWith('-100')) {
        // Убираем первые 4 символа (-100) для формирования URL
        formattedChatId = TELEGRAM_CHAT_ID.substring(4);
      }
      const messageUrl = `https://t.me/c/${formattedChatId}/${messageId}`;
      log(`URL сообщения: ${messageUrl}`);
      
      return {
        success: true,
        messageId,
        messageUrl,
        result: response.data.result
      };
    } else {
      log(`Ошибка при отправке изображения: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data?.description || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`Исключение при отправке изображения: ${error.message}`);
    if (error.response) {
      log(`Ответ от API: ${JSON.stringify(error.response.data)}`);
      return {
        success: false,
        error: error.response.data?.description || error.message
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Отправляет изображение без подписи в Telegram
 * @param {string} imageUrl URL изображения
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithoutCaption(imageUrl) {
  try {
    log(`Отправка изображения без подписи: ${imageUrl}`);
    
    // Отправляем через Telegram API
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        photo: imageUrl
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`Изображение успешно отправлено. Message ID: ${messageId}`);
      
      // Формируем URL сообщения
      let formattedChatId = TELEGRAM_CHAT_ID;
      if (TELEGRAM_CHAT_ID.startsWith('-100')) {
        // Убираем первые 4 символа (-100) для формирования URL
        formattedChatId = TELEGRAM_CHAT_ID.substring(4);
      }
      const messageUrl = `https://t.me/c/${formattedChatId}/${messageId}`;
      log(`URL сообщения: ${messageUrl}`);
      
      return {
        success: true,
        messageId,
        messageUrl,
        result: response.data.result
      };
    } else {
      log(`Ошибка при отправке изображения: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data?.description || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`Исключение при отправке изображения: ${error.message}`);
    if (error.response) {
      log(`Ответ от API: ${JSON.stringify(error.response.data)}`);
      return {
        success: false,
        error: error.response.data?.description || error.message
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Отправляет HTML-текст в Telegram
 * @param {string} html HTML-текст
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  try {
    log(`Отправка HTML-текста (${html.length} символов): ${html.substring(0, 100)}...`);
    
    // Исправляем HTML-теги
    const fixedHtml = fixHtmlForTelegram(html);
    log(`Исправленный HTML: ${fixedHtml.substring(0, 100)}...`);
    
    // Отправляем через Telegram API
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: fixedHtml,
        parse_mode: 'HTML'
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`HTML-текст успешно отправлен. Message ID: ${messageId}`);
      
      // Формируем URL сообщения
      let formattedChatId = TELEGRAM_CHAT_ID;
      if (TELEGRAM_CHAT_ID.startsWith('-100')) {
        // Убираем первые 4 символа (-100) для формирования URL
        formattedChatId = TELEGRAM_CHAT_ID.substring(4);
      }
      const messageUrl = `https://t.me/c/${formattedChatId}/${messageId}`;
      log(`URL сообщения: ${messageUrl}`);
      
      return {
        success: true,
        messageId,
        messageUrl,
        result: response.data.result
      };
    } else {
      log(`Ошибка при отправке HTML-текста: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data?.description || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`Исключение при отправке HTML-текста: ${error.message}`);
    if (error.response) {
      log(`Ответ от API: ${JSON.stringify(error.response.data)}`);
      return {
        success: false,
        error: error.response.data?.description || error.message
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Отправляет изображение с HTML-текстом в Telegram, используя разные стратегии в зависимости от длины текста
 * @param {string} imageUrl URL изображения
 * @param {string} html HTML-текст
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithHtmlText(imageUrl, html) {
  log(`Отправка изображения с HTML-текстом, используя логику с порогом в ${SMALL_TEXT_THRESHOLD} символов`);
  log(`Длина текста: ${html.length} символов`);
  
  if (html.length <= SMALL_TEXT_THRESHOLD) {
    // Короткий текст - отправляем как подпись к изображению
    log(`Текст короткий (${html.length} <= ${SMALL_TEXT_THRESHOLD}), отправляем как подпись к изображению`);
    return await sendImageWithHtmlCaption(imageUrl, html);
  } else {
    // Длинный текст - отправляем изображение без подписи, а затем текст отдельным сообщением
    log(`Текст длинный (${html.length} > ${SMALL_TEXT_THRESHOLD}), отправляем изображение и текст отдельно`);
    
    // Сначала отправляем изображение
    const imageResult = await sendImageWithoutCaption(imageUrl);
    
    // Затем отправляем текст
    const textResult = await sendHtmlMessage(html);
    
    // Возвращаем комбинированный результат
    return {
      success: imageResult.success && textResult.success,
      imageResult,
      textResult,
      messageIds: [imageResult.messageId, textResult.messageId].filter(Boolean),
      messageUrls: [imageResult.messageUrl, textResult.messageUrl].filter(Boolean)
    };
  }
}

/**
 * Запускает тесты с разными вариантами изображений и текстов
 */
async function runTests() {
  log('=== Запуск тестов отправки изображений с HTML-текстом в Telegram ===');
  
  // Тестовые данные
  const testImageUrl = 'https://i.ibb.co/RT55ybv/1744101904073-307934231.png';
  const randomImageUrl = 'https://picsum.photos/800/600?random=1';
  
  const smallHtml = `<p>🔥 <em>Устали публиковать контент вручную</em>? Хотите сэкономить время и силы?</p><p>Тогда <strong>автопостинг </strong>- <u>именно то, что вам нужно</u>!</p>`;
  
  const longHtml = `<p>🔥 <em>Устали публиковать контент вручную</em>? Хотите сэкономить время и силы?</p><p>Тогда <strong>автопостинг </strong>- <u>именно то, что вам нужно</u>! 💻 Забудьте о рутинной работе и наслаждайтесь автоматизацией публикаций в Telegram, ВКонтакте, Instagram и других соцсетях.</p><p>Просто загрузите контент, задайте расписание и наслаждайтесь результатами! Ваши посты будут публиковаться точно в срок, без опозданий и ошибок. 🕰️</p><p>Экономьте время, повышайте эффективность и наслаждайтесь преимуществами автопостинга. Попробуйте прямо сейчас и убедитесь сами! 🚀</p>
  <p>Автопостинг позволяет вам:</p>
  <ul>
    <li><strong>Экономить время</strong> - настройте расписание один раз и забудьте о рутине</li>
    <li><strong>Повысить точность</strong> - публикации выходят строго по заданному времени</li>
    <li><strong>Работать с несколькими платформами</strong> - одновременная публикация в Telegram, ВКонтакте, Instagram и других сетях</li>
    <li><strong>Анализировать эффективность</strong> - отслеживайте статистику и оптимизируйте контент</li>
  </ul>
  <p>Начните пользоваться автопостингом уже сегодня и увидите результаты уже через несколько дней! Ваши подписчики оценят регулярность и качество публикаций.</p>`;
  
  // Тест 1: Короткий текст с изображением (должен отправиться как одно сообщение с подписью)
  log('\n--- Тест 1: Короткий текст с изображением ---');
  await sendImageWithHtmlText(testImageUrl, smallHtml);
  
  // Тест 2: Длинный текст с изображением (должны отправиться отдельно: сначала изображение, затем текст)
  log('\n--- Тест 2: Длинный текст с изображением ---');
  await sendImageWithHtmlText(randomImageUrl, longHtml);
  
  // Тест 3: Граничный случай - текст ровно на пороге
  log('\n--- Тест 3: Текст на пороге ---');
  const thresholdText = 'A'.repeat(SMALL_TEXT_THRESHOLD);
  await sendImageWithHtmlText(testImageUrl, thresholdText);
  
  log('\n=== Тестирование завершено ===');
}

// Запускаем тесты
runTests()
  .then(() => {
    log('Тесты успешно выполнены');
  })
  .catch(error => {
    log(`Ошибка при выполнении тестов: ${error.message}`);
    if (error.stack) {
      log(error.stack);
    }
  });

export {};