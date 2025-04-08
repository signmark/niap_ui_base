/**
 * Прямой тест отправки HTML-сообщения с изображением в Telegram с использованием токена из переменных окружения
 * Запуск: node telegram-direct-test.js
 */

import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import dotenv from 'dotenv';
import process from 'process';
import path from 'path';
import { fileURLToPath } from 'url';

// Инициализация dotenv
dotenv.config();

// Получение переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_TEST_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_TEST_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

// ID контента для тестирования
const CONTENT_ID = process.argv[2] || '094bb372-d8ae-4759-8d0e-1c6c63391a04';

// Параметры тестового сообщения
const testCaption = `<b>🔥 Тестирование HTML-форматирования в Telegram</b>

<i>Устали публиковать контент вручную?</i> Хотите сэкономить время и силы?

Тогда <b>автопостинг</b> - <u>именно то, что вам нужно</u>! 

✅ Забудьте о рутинной работе и наслаждайтесь автоматизацией публикаций в Telegram, ВКонтакте, Instagram и других соцсетях.

Просто загрузите контент, задайте расписание и наслаждайтесь результатами! Ваши посты будут публиковаться точно в срок, без опозданий и ошибок.

Экономьте время, повышайте эффективность и наслаждайтесь преимуществами автопостинга. Попробуйте прямо сейчас и убедитесь сами!

<a href="https://example.com">Узнать больше</a>`;

// Локальный путь к тестовому изображению
// const TEST_IMAGE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-image.jpg');

/**
 * Выводит сообщение в консоль с временной меткой
 */
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixHtmlForTelegram(html) {
  if (!html) return '';
  
  try {
    // Заменяем блочные элементы на текст с переносами строк
    let fixedHtml = html
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n')
      .replace(/<br\s*\/?>/gi, '\n');
    
    // Приводим HTML-теги к поддерживаемым в Telegram форматам
    fixedHtml = fixedHtml
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
      .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
      .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '<s>$1</s>')
      .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '<s>$1</s>');
      
    // Удаляем все остальные неподдерживаемые теги
    const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
    const unsupportedTagPattern = new RegExp(`<\\/?(?!${supportedTags.join('|')}\\b)[^>]+>`, 'gi');
    fixedHtml = fixedHtml.replace(unsupportedTagPattern, '');
    
    // Обработка тегов ссылок
    fixedHtml = fixedHtml.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/g, '<a href="$1">$2</a>');
    
    // Убираем лишние переносы строк (более 2 подряд)
    fixedHtml = fixedHtml.replace(/\n{3,}/g, '\n\n');
    
    return fixedHtml;
  } catch (error) {
    log(`Ошибка при исправлении HTML: ${error}`);
    return html.replace(/<[^>]*>/g, ''); // Удаляем все теги при ошибке
  }
}

/**
 * Отправляет текстовое сообщение с HTML-форматированием в Telegram
 * @param {string} html HTML-форматированный текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendTextMessage(html) {
  log(`Отправка HTML-сообщения в Telegram...`);
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log(`❌ Ошибка: Отсутствуют настройки Telegram (токен или ID чата)`);
    log(`Токен: ${TELEGRAM_BOT_TOKEN ? 'задан' : 'отсутствует'}, Chat ID: ${TELEGRAM_CHAT_ID ? 'задан' : 'отсутствует'}`);
    throw new Error('Отсутствуют настройки Telegram (токен или ID чата)');
  }
  
  try {
    // Исправляем HTML для Telegram
    const fixedHtml = fixHtmlForTelegram(html);
    
    log(`Исходный HTML (${html.length} символов): ${html.substring(0, 100)}...`);
    log(`Исправленный HTML (${fixedHtml.length} символов): ${fixedHtml.substring(0, 100)}...`);
    
    // Отправляем запрос напрямую к API Telegram
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: fixedHtml,
      parse_mode: 'HTML'
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true // Всегда возвращаем ответ, даже если это ошибка
    });
    
    // Расширенное логирование ответа
    log(`Ответ от Telegram API (sendMessage): статус ${response.status}`);
    
    if (response.status === 200 && response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      let messageUrl = formatTelegramUrl(messageId);
      
      log(`✅ Сообщение успешно отправлено в Telegram с ID: ${messageId}`);
      log(`URL сообщения: ${messageUrl}`);
      
      return {
        success: true,
        messageId,
        messageUrl,
        result: response.data.result
      };
    } else {
      const errorMessage = response.data?.description || 'Неизвестная ошибка';
      log(`❌ Ошибка при отправке HTML-сообщения в Telegram: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        status: response.status,
        data: response.data
      };
    }
  } catch (error) {
    log(`❌ Исключение при отправке HTML-сообщения в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Отправляет изображение с HTML-подписью в Telegram
 * @param {string} imageUrl URL изображения или путь к локальному файлу
 * @param {string} caption HTML-форматированная подпись
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithCaption(imageUrl, caption) {
  log(`Отправка изображения с HTML-подписью в Telegram...`);
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log(`❌ Ошибка: Отсутствуют настройки Telegram (токен или ID чата)`);
    log(`Токен: ${TELEGRAM_BOT_TOKEN ? 'задан' : 'отсутствует'}, Chat ID: ${TELEGRAM_CHAT_ID ? 'задан' : 'отсутствует'}`);
    throw new Error('Отсутствуют настройки Telegram (токен или ID чата)');
  }
  
  try {
    // Исправляем HTML для Telegram
    const fixedCaption = fixHtmlForTelegram(caption);
    
    log(`Исправленный HTML для подписи (${fixedCaption.length} символов): ${fixedCaption.substring(0, 100)}...`);
    
    // Обрезаем подпись до 1024 символов (лимит Telegram)
    const finalCaption = fixedCaption.length > 1024 
      ? fixedCaption.substring(0, 1021) + '...' 
      : fixedCaption;
    
    // Подготавливаем FormData
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('parse_mode', 'HTML');
    formData.append('caption', finalCaption);
    
    // URL изображения или локальный файл
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      log(`Используем изображение по URL: ${imageUrl}`);
      
      // Для URL изображения, отправляем URL напрямую
      // Для простоты мы не будем загружать изображение, а просто передадим URL
      formData.append('photo', imageUrl);
    } else {
      log(`Используем локальное изображение: ${imageUrl}`);
      
      // Для локального файла, добавляем его содержимое в formData
      formData.append('photo', fs.createReadStream(imageUrl));
    }
    
    // Отправка запроса
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const response = await axios.post(url, formData, { 
      headers: formData.getHeaders(),
      validateStatus: () => true // Всегда возвращаем ответ, даже если это ошибка
    });
    
    // Расширенное логирование ответа
    log(`Ответ от Telegram API (sendPhoto): статус ${response.status}`);
    
    if (response.status === 200 && response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      let messageUrl = formatTelegramUrl(messageId);
      
      log(`✅ Изображение с HTML-подписью успешно отправлено в Telegram с ID: ${messageId}`);
      log(`URL сообщения: ${messageUrl}`);
      
      return {
        success: true,
        messageId,
        messageUrl,
        result: response.data.result
      };
    } else {
      const errorMessage = response.data?.description || 'Неизвестная ошибка';
      log(`❌ Ошибка при отправке изображения с HTML-подписью в Telegram: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        status: response.status,
        data: response.data
      };
    }
  } catch (error) {
    log(`❌ Исключение при отправке изображения с HTML-подписью в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Форматирует URL для Telegram сообщения
 * @param {number|string} messageId ID сообщения
 * @returns {string} URL сообщения
 */
function formatTelegramUrl(messageId) {
  let chatId = TELEGRAM_CHAT_ID;
  let url = '';
  
  if (chatId.startsWith('@')) {
    // Для публичных каналов с username (@channel)
    url = `https://t.me/${chatId.substring(1)}/${messageId}`;
  } else if (chatId.startsWith('-100')) {
    // Для приватных каналов и супергрупп
    const channelId = chatId.substring(4);
    url = `https://t.me/c/${channelId}/${messageId}`;
  } else if (chatId.startsWith('-')) {
    // Для обычных групп
    const groupId = chatId.substring(1);
    url = `https://t.me/c/${groupId}/${messageId}`;
  } else {
    // Для личных чатов или если не удается определить формат
    url = `https://t.me/c/${chatId}/${messageId}`;
  }
  
  return url;
}

/**
 * Получает данные контента с сервера по ID
 * @param {string} contentId ID контента
 * @returns {Promise<object|null>} Данные контента или null в случае ошибки
 */
async function getContentData(contentId) {
  try {
    log(`Получение данных контента ${contentId} напрямую через API приложения...`);
    
    const response = await axios.get(`http://localhost:3000/api/campaign-content/${contentId}`);
    
    if (response.data && response.data.data) {
      log(`✅ Данные контента успешно получены`);
      return response.data.data;
    } else {
      log(`❌ Ошибка получения данных контента: Неверный формат ответа`);
      return null;
    }
  } catch (error) {
    log(`❌ Ошибка получения данных контента: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Основная функция
 */
async function main() {
  log('=== Начало прямого теста отправки в Telegram ===');
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log(`❌ Ошибка: Отсутствуют переменные окружения для Telegram.`);
    log(`TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? '✅ Задан' : '❌ Отсутствует'}`);
    log(`TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID ? '✅ Задан' : '❌ Отсутствует'}`);
    return;
  }
  
  log(`Тест будет выполнен с использованием следующих настроек:`);
  log(`- Токен бота: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
  log(`- ID чата: ${TELEGRAM_CHAT_ID}`);
  
  // Тест 1: Отправка текстового сообщения с HTML-форматированием
  log('\n=== Тест 1: Отправка текстового сообщения с HTML-форматированием ===');
  try {
    const textResult = await sendTextMessage(testCaption);
    if (textResult.success) {
      log(`✅ Тест 1 пройден успешно: Текстовое сообщение отправлено`);
    } else {
      log(`❌ Тест 1 завершился с ошибкой: ${textResult.error}`);
    }
  } catch (error) {
    log(`❌ Тест 1 завершился с исключением: ${error.message}`);
  }
  
  // Тест 2: Отправка изображения с HTML-подписью
  log('\n=== Тест 2: Отправка изображения с HTML-подписью ===');
  
  // Используем изображение с демонстрационного сайта
  const demoImageUrl = 'https://img.freepik.com/free-photo/business-concept-with-graphic-holography_23-2149160935.jpg';
  
  try {
    const imageResult = await sendImageWithCaption(demoImageUrl, testCaption);
    if (imageResult.success) {
      log(`✅ Тест 2 пройден успешно: Изображение с HTML-подписью отправлено`);
    } else {
      log(`❌ Тест 2 завершился с ошибкой: ${imageResult.error}`);
    }
  } catch (error) {
    log(`❌ Тест 2 завершился с исключением: ${error.message}`);
  }
  
  // Финальный отчет
  log('\n=== Завершение тестирования ===');
}

// Запуск скрипта
try {
  main().catch(error => {
    log(`❌ Критическая ошибка при выполнении скрипта: ${error.message}`);
    if (error.stack) {
      log(error.stack);
    }
  });
} catch (error) {
  log(`❌ Критическая ошибка при инициализации скрипта: ${error.message}`);
  if (error.stack) {
    log(error.stack);
  }
}