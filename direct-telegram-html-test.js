/**
 * Прямой тест отправки HTML-сообщения в Telegram с использованием токена из секретов
 * Запуск: node direct-telegram-html-test.js
 */

import dotenv from 'dotenv';
import axios from 'axios';
import { formatHtmlForTelegram } from './server/utils/telegram-content-processor.js';
import { cleanHtmlForTelegram } from './server/utils/telegram-html-cleaner-new.js';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен и ID чата из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixUnclosedTags(html) {
  const openTags = [];
  const regex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  let processedHTML = html.replace(regex, match => {
    if (match.startsWith('</')) {
      // Закрывающий тег
      const tagName = match.match(/<\/([a-z][a-z0-9]*)\b[^>]*>/i)[1].toLowerCase();
      
      // Проверяем, есть ли такой открывающий тег
      const lastOpenTagIndex = openTags.lastIndexOf(tagName);
      
      if (lastOpenTagIndex !== -1) {
        // Удаляем тег из списка открытых
        openTags.splice(lastOpenTagIndex, 1);
        return match; // Возвращаем тег как есть
      } else {
        // Закрывающий тег без соответствующего открывающего - удаляем
        return '';
      }
    } else {
      // Открывающий тег
      const tagMatch = match.match(/<([a-z][a-z0-9]*)\b[^>]*>/i);
      if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();
        
        // Добавляем в список открытых, если это не самозакрывающийся тег
        if (!match.endsWith('/>') && !['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
          openTags.push(tagName);
        }
      }
      return match; // Возвращаем тег как есть
    }
  });
  
  // Закрываем оставшиеся открытые теги в обратном порядке
  for (let i = openTags.length - 1; i >= 0; i--) {
    processedHTML += `</${openTags[i]}>`;
  }
  
  return processedHTML;
}

/**
 * Преобразует span с inline стилями в поддерживаемые Telegram HTML теги
 * @param {string} html HTML-текст из редактора
 * @returns {string} HTML-текст совместимый с Telegram
 */
function convertEditorToTelegram(html) {
  if (!html) return '';
  
  // Исправляем незакрытые теги
  let cleanedHtml = fixUnclosedTags(html);
  
  // Используем новый алгоритм очистки HTML
  return cleanHtmlForTelegram(cleanedHtml);
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @param {boolean} autoFix Автоматически исправлять незакрытые теги
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html, autoFix = true) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Ошибка: Не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в переменных окружения');
    return { success: false, error: 'Отсутствуют настройки Telegram' };
  }
  
  try {
    // Подготавливаем HTML для отправки
    const processedHtml = autoFix ? convertEditorToTelegram(html) : html;
    console.log('Подготовленный HTML для отправки:', processedHtml);
    
    // Отправляем сообщение через Telegram Bot API
    const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await axios.post(apiUrl, {
      chat_id: TELEGRAM_CHAT_ID,
      text: processedHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
    
    console.log('Ответ API Telegram:', response.data);
    
    if (response.data && response.data.ok) {
      return { 
        success: true, 
        message_id: response.data.result.message_id,
        url: `https://t.me/c/${TELEGRAM_CHAT_ID.replace('-100', '')}/${response.data.result.message_id}`
      };
    } else {
      return { success: false, error: response.data.description || 'Неизвестная ошибка API Telegram' };
    }
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error.message);
    console.error('Полная ошибка:', error.response?.data || error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет контент из Directus в Telegram
 */
async function sendContentToTelegram() {
  // Пример HTML из редактора Directus с различными элементами форматирования
  const htmlContent = `
<h1>Тестирование форматирования для Telegram</h1>

<p>Это текст с <strong>жирным</strong> начертанием и <em>курсивом</em>.</p>

<p>Можно использовать <u>подчеркнутый</u> текст и даже <s>зачеркнутый</s>.</p>

<p>А еще у нас есть <a href="https://t.me/test_channel">ссылка на канал</a>.</p>

<ul>
  <li>Первый пункт списка</li>
  <li>Второй пункт с <strong>выделением</strong></li>
  <li>Третий пункт с <a href="https://example.com">ссылкой</a></li>
</ul>

<p>Также доступны переносы строк</p>

<p>Обратите внимание, что для красивого оформления:</p>
<p>• Текст с <b>жирным начертанием</b> хорошо читается</p>
<p>• <i>Курсивом</i> выделяют важные моменты</p>
<p>• <u>Подчеркивание</u> используется для заголовков</p>

<p>А в конце можно добавить <a href="https://t.me/test_channel">ссылку на наш канал</a> для общения с подписчиками.</p>
`;

  console.log('Отправка тестового HTML-сообщения в Telegram...');
  
  const result = await sendHtmlMessage(htmlContent);
  
  if (result.success) {
    console.log(`Сообщение успешно отправлено! ID: ${result.message_id}, URL: ${result.url}`);
  } else {
    console.error(`Ошибка отправки: ${result.error}`);
  }
}

// Запускаем отправку
sendContentToTelegram().catch(error => {
  console.error('Ошибка в основном процессе:', error);
});