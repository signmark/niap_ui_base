/**
 * Скрипт для прямого тестирования отправки HTML-сообщений в Telegram
 * Запуск: node telegram-direct-html-test.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Получаем тестовые примеры HTML
const testCases = require('./telegram-html-test-cases');

// Получаем токен и chatId из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Выводит сообщение в консоль с временной меткой
 * @param {string} message Сообщение для вывода
 */
function log(message) {
  const now = new Date();
  const timestamp = `[${now.toLocaleTimeString()}]`;
  console.log(`${timestamp} ${message}`);
}

/**
 * Проверяет, что необходимые переменные окружения установлены
 * @returns {boolean} Результат проверки
 */
function checkEnvVariables() {
  if (!TELEGRAM_BOT_TOKEN) {
    log('⚠️ Ошибка: Не установлена переменная окружения TELEGRAM_BOT_TOKEN');
    log('Установите переменную в файле .env или через командную строку');
    return false;
  }

  if (!TELEGRAM_CHAT_ID) {
    log('⚠️ Ошибка: Не установлена переменная окружения TELEGRAM_CHAT_ID');
    log('Установите переменную в файле .env или через командную строку');
    return false;
  }

  return true;
}

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixUnclosedTags(html) {
  // Стек для отслеживания открытых тегов
  const openTags = [];
  // Регулярное выражение для поиска тегов
  const regex = /<\/?([a-z]+)[^>]*>/gi;
  
  // Заменяем теги, отслеживая открытые/закрытые
  html = html.replace(regex, (match, tagName) => {
    // Пропускаем самозакрывающиеся теги
    if (match.endsWith('/>')) {
      return match;
    }
    
    // Проверяем, открывающий или закрывающий тег
    if (match.startsWith('</')) {
      // Закрывающий тег
      if (openTags.length > 0 && openTags[openTags.length - 1].toLowerCase() === tagName.toLowerCase()) {
        openTags.pop(); // Удаляем последний открытый тег из стека
      }
      return match;
    } else {
      // Открывающий тег
      openTags.push(tagName);
      return match;
    }
  });
  
  // Закрываем оставшиеся открытые теги в обратном порядке
  while (openTags.length > 0) {
    const tag = openTags.pop();
    html += `</${tag}>`;
  }
  
  return html;
}

/**
 * Форматирует HTML для отправки в Telegram
 * @param {string} html HTML для форматирования
 * @returns {string} Отформатированный HTML
 */
function formatHtmlForTelegram(html) {
  // Исправляем незакрытые теги
  html = fixUnclosedTags(html);
  
  // Заменяем неподдерживаемые теги на поддерживаемые
  html = html.replace(/<(\/?)h[1-6]>/gi, '<$1b>');
  html = html.replace(/<(\/?)strong>/gi, '<$1b>');
  html = html.replace(/<(\/?)em>/gi, '<$1i>');

  // Удаляем неподдерживаемые теги, сохраняя их содержимое
  html = html.replace(/<\/?div[^>]*>/gi, '');
  html = html.replace(/<\/?span[^>]*>/gi, '');
  html = html.replace(/<\/?p[^>]*>/gi, '\\n');
  
  // Форматируем списки
  html = html.replace(/<\/?ul[^>]*>/gi, '');
  html = html.replace(/<\/?ol[^>]*>/gi, '');
  html = html.replace(/<li[^>]*>/gi, '• ');
  html = html.replace(/<\/li>/gi, '\\n');
  
  // Удаляем атрибуты из тегов, кроме href в ссылках
  html = html.replace(/<([bi])(?:\s+[^>]*)?>/gi, '<$1>');
  html = html.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>/gi, '<a href="$1">');
  
  // Заменяем множественные переносы строк
  html = html.replace(/\\n\\n+/g, '\\n\\n');
  
  return html;
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  // Форматируем HTML для Telegram
  const formattedHtml = formatHtmlForTelegram(html);
  
  log(`Отправка HTML в Telegram: ${formattedHtml.substring(0, 50)}${formattedHtml.length > 50 ? '...' : ''}`);
  
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: formattedHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    );
    
    log(`Сообщение успешно отправлено. Message ID: ${response.data.result.message_id}`);
    return response.data;
  } catch (error) {
    log(`⚠️ Ошибка при отправке сообщения: ${error.message}`);
    if (error.response) {
      log(`Статус ответа: ${error.response.status}`);
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Запускает все тесты последовательно
 */
async function runAllTests() {
  // Проверяем наличие необходимых переменных окружения
  if (!checkEnvVariables()) {
    return;
  }
  
  log('Начало тестирования прямой отправки HTML в Telegram');
  
  try {
    // Тестирование простого HTML
    log('1. Тест: Простой HTML');
    await sendHtmlMessage(testCases.basicHtml);
    
    // Пауза между запросами, чтобы не превысить лимиты API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тестирование списков
    log('2. Тест: HTML со списками');
    await sendHtmlMessage(testCases.listHtml);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тестирование вложенных списков
    log('3. Тест: HTML с вложенными списками');
    await sendHtmlMessage(testCases.nestedListHtml);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тестирование эмодзи
    log('4. Тест: HTML с эмодзи');
    await sendHtmlMessage(testCases.emojiHtml);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тестирование ссылок
    log('5. Тест: HTML со ссылками');
    await sendHtmlMessage(testCases.linksHtml);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тестирование сложного HTML
    log('6. Тест: Комплексный HTML');
    await sendHtmlMessage(testCases.complexHtml);
    
    log('✅ Все тесты успешно выполнены');
  } catch (error) {
    log(`⚠️ Ошибка при выполнении тестов: ${error.message}`);
  }
}

// Запуск тестов
runAllTests();