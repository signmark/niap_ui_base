/**
 * Тест нового сервиса Telegram
 * 
 * Скрипт для тестирования нашего нового сервиса для Telegram
 * Отправляет тестовое сообщение с форматированием в Telegram
 * 
 * Запуск: node telegram-new-service-test.js
 */

import { telegramService } from './server/services/social/telegram-service.js';
import { formatHtmlForTelegram } from './server/utils/telegram-formatter.js';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Получаем данные из .env или из аргументов командной строки
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TEST_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_TEST_CHAT_ID;

// Проверяем, что необходимые параметры заданы
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not found in environment variables');
  console.log('Please set these variables in .env file or pass them as arguments');
  process.exit(1);
}

/**
 * Выводит сообщение в консоль с временной меткой
 */
function log(message) {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Тестирует отправку текста с форматированием в Telegram
 */
async function testSendTextMessage() {
  log('Testing sending text message with formatting...');
  
  // Тестовое сообщение с различными HTML-тегами
  const htmlText = `
<b>Жирный текст</b>
<strong>Тоже жирный</strong>
<i>Курсив</i>
<em>Тоже курсив</em>
<u>Подчеркнутый</u>
<s>Зачеркнутый</s>
<code>Моноширинный шрифт</code>
<pre>Блок кода
с сохранением
переносов строк</pre>
<a href="https://t.me/">Ссылка на Telegram</a>

<b><i>Жирный и курсив</i></b>
<b><i><u>Жирный, курсив и подчеркнутый</u></i></b>

<p>Параграф текста.</p>
<p>Еще один параграф.</p>

<ul>
  <li>Пункт 1</li>
  <li>Пункт 2</li>
  <li>Пункт 3</li>
</ul>

А вот <b>важная информация</b> в середине обычного текста.
  `;
  
  try {
    // Инициализируем сервис Telegram
    telegramService.initialize(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
    
    // Отправляем тестовое сообщение
    const result = await telegramService.sendTextMessage(htmlText);
    
    log(`Message sent successfully!`);
    log(`Message ID: ${result.messageId}`);
    log(`Message URL: ${result.messageUrl}`);
    
    return result;
  } catch (error) {
    log(`Error sending text message: ${error.message}`);
    throw error;
  }
}

/**
 * Тестирует отправку изображения с подписью в Telegram
 */
async function testSendImage() {
  log('Testing sending image with caption...');
  
  // Тестовое изображение
  const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png';
  
  // Подпись к изображению
  const caption = `<b>Логотип Telegram</b>
  
Это <i>тестовое</i> изображение с <b>форматированной</b> подписью.
Проверяем работу <a href="https://telegram.org">HTML-форматирования</a> в подписях к изображениям.`;
  
  try {
    // Отправляем изображение с подписью
    const result = await telegramService.sendImage(imageUrl, caption);
    
    log(`Image sent successfully!`);
    log(`Message ID: ${result.messageId}`);
    log(`Message URL: ${result.messageUrl}`);
    
    return result;
  } catch (error) {
    log(`Error sending image: ${error.message}`);
    throw error;
  }
}

/**
 * Тестирует отправку группы изображений в Telegram
 */
async function testSendMediaGroup() {
  log('Testing sending media group...');
  
  // Массив тестовых изображений
  const imageUrls = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Signal-Logo.svg/600px-Signal-Logo.svg.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/598px-WhatsApp.svg.png'
  ];
  
  // Подпись к первому изображению
  const caption = `<b>Логотипы мессенджеров</b>
  
Тестирование отправки <i>группы изображений</i> с <b>HTML-форматированием</b> в подписи к первому изображению.`;
  
  try {
    // Отправляем группу изображений
    const result = await telegramService.sendMediaGroup(imageUrls, caption);
    
    log(`Media group sent successfully!`);
    log(`Message IDs: ${result.messageIds.join(', ')}`);
    log(`First message URL: ${result.messageUrl}`);
    
    return result;
  } catch (error) {
    log(`Error sending media group: ${error.message}`);
    throw error;
  }
}

/**
 * Тестирует отправку контента с изображением и текстом в Telegram
 */
async function testPublishContent() {
  log('Testing publishing content...');
  
  // Пример контента
  const content = {
    title: 'Тестовая публикация',
    content: `
<p>Это тестовая публикация для проверки работы сервиса Telegram.</p>

<p>Поддерживаются различные <b>HTML-теги</b> для <i>форматирования</i> текста:</p>

<ul>
  <li><b>Жирный текст</b></li>
  <li><i>Курсив</i></li>
  <li><u>Подчеркнутый</u></li>
  <li><s>Зачеркнутый</s></li>
  <li><code>Моноширинный шрифт</code></li>
</ul>

<p>А также <a href="https://telegram.org">ссылки</a> и <b><i>комбинации</i> различных <u>тегов</u></b>.</p>

<p>Проверяем <b>работу</b> с <i>изображениями</i> и <u>форматированием</u> текста.</p>
    `,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Telegram_2019_Logo.svg/800px-Telegram_2019_Logo.svg.png',
    additionalImages: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Telegram_Messenger.png/800px-Telegram_Messenger.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png'
    ]
  };
  
  // Настройки для публикации
  const settings = {
    token: TELEGRAM_BOT_TOKEN,
    chatId: TELEGRAM_CHAT_ID
  };
  
  try {
    // Публикуем контент
    const result = await telegramService.publishContent(content, settings);
    
    log(`Content published successfully!`);
    log(`Message IDs: ${result.messageIds.join(', ')}`);
    log(`Message URL: ${result.messageUrl}`);
    
    return result;
  } catch (error) {
    log(`Error publishing content: ${error.message}`);
    throw error;
  }
}

/**
 * Тестирует форматирование HTML с вложенными тегами
 */
async function testNestedTags() {
  log('Testing complex HTML with nested tags...');
  
  const complexHtml = `
<b>Заголовок</b>

<p>Это <b>важный</b> текст с <i>разными</i> <u>стилями</u> форматирования.</p>

<b>Список вещей:</b>
<ul>
  <li><b>Важный</b> пункт</li>
  <li>Обычный пункт</li>
  <li>Пункт с <i>курсивом</i> и <b>жирным</b> текстом</li>
  <li><s>Зачеркнутый пункт</s> <i>(удален)</i></li>
</ul>

<p>Вложенные теги: <b>жирный <i>жирный и курсив <u>жирный, курсив и подчеркнутый</u></i></b></p>

<p>Теги с <a href="https://t.me/">ссылкой <b>внутри</b></a> и <b>теги <a href="https://telegram.org/">со ссылкой</a> внутри</b>.</p>
  `;
  
  try {
    // Форматируем HTML для Telegram
    const formattedHtml = formatHtmlForTelegram(complexHtml);
    
    log('Formatted HTML:');
    log(formattedHtml);
    
    // Отправляем отформатированный HTML
    const result = await telegramService.sendTextMessage(complexHtml);
    
    log(`Complex HTML message sent successfully!`);
    log(`Message ID: ${result.messageId}`);
    log(`Message URL: ${result.messageUrl}`);
    
    return result;
  } catch (error) {
    log(`Error sending complex HTML: ${error.message}`);
    throw error;
  }
}

/**
 * Запускает все тесты
 */
async function runAllTests() {
  try {
    log('Starting tests for new Telegram service...');
    
    // Инициализируем сервис Telegram
    telegramService.initialize(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
    
    // Тест отправки текстового сообщения
    await testSendTextMessage();
    
    // Тест отправки изображения с подписью
    await testSendImage();
    
    // Тест отправки группы изображений
    await testSendMediaGroup();
    
    // Тест публикации контента
    await testPublishContent();
    
    // Тест сложного HTML с вложенными тегами
    await testNestedTags();
    
    log('All tests completed successfully!');
  } catch (error) {
    log(`Error running tests: ${error.message}`);
    process.exit(1);
  }
}

// Запускаем тесты
runAllTests();