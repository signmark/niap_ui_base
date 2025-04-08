/**
 * Прямой тест отправки HTML-сообщения в Telegram с использованием токена из секретов
 * Запуск: node direct-telegram-html-test.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Настройки Telegram из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CONTENT_ID = '094bb372-d8ae-4759-8d0e-1c6c63391a04';

// Проверяем наличие токена и ID чата
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Ошибка: не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
  process.exit(1);
}

// Примеры HTML-текста для тестирования
const UNCLOSED_TAG_HTML = `<b>Тест с незакрытым тегом жирного текста и <i>курсива
Этот текст должен отправиться после автоматического исправления тегов.
<u>Еще один незакрытый тег`;

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixUnclosedTags(html) {
  if (!html) return '';
  
  // Список поддерживаемых Telegram тегов
  const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
  
  // Стек для отслеживания открытых тегов
  const openTags = [];
  
  // Регулярное выражение для поиска тегов (открывающих и закрывающих)
  const tagRegex = /<\/?([a-z]+)(?:\s+[^>]*)?\/?>/gi;
  
  // Находим все теги в тексте
  let lastIndex = 0;
  let result = '';
  let match;
  
  while ((match = tagRegex.exec(html)) !== null) {
    // Добавляем текст до текущего тега
    result += html.substring(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
    
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    
    // Пропускаем теги, которые не поддерживаются Telegram
    if (!supportedTags.includes(tagName)) {
      continue;
    }
    
    // Проверяем, открывающий или закрывающий тег
    if (fullTag.startsWith('</')) {
      // Закрывающий тег
      const lastOpenTagIndex = openTags.lastIndexOf(tagName);
      if (lastOpenTagIndex !== -1) {
        // Если нашли соответствующий открывающий тег, удаляем его из стека
        openTags.splice(lastOpenTagIndex, 1);
        result += fullTag;
      }
    } else {
      // Открывающий тег
      openTags.push(tagName);
      result += fullTag;
    }
  }
  
  // Добавляем оставшийся текст
  result += html.substring(lastIndex);
  
  // Закрываем все незакрытые теги в обратном порядке
  for (let i = openTags.length - 1; i >= 0; i--) {
    result += `</${openTags[i]}>`;
  }
  
  return result;
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @param {boolean} autoFix Автоматически исправлять незакрытые теги
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html, autoFix = true) {
  try {
    const textToSend = autoFix ? fixUnclosedTags(html) : html;
    console.log(`\nОтправка HTML-сообщения ${autoFix ? '(с автоисправлением)' : ''}:`);
    console.log(textToSend);
    
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: textToSend,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      console.log('✅ Сообщение успешно отправлено в Telegram');
      console.log(`ID сообщения: ${response.data.result.message_id}`);
      return response.data;
    } else {
      console.log('❌ Ошибка при отправке сообщения:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка при отправке HTML-сообщения:', error.message);
    if (error.response && error.response.data) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
    }
    return null;
  }
}

/**
 * Отправляет контент из Directus в Telegram
 */
async function sendContentToTelegram() {
  try {
    console.log(`Отправка контента ID: ${CONTENT_ID} в Telegram`);
    
    // Прямые тестовые сообщения для тестирования форматирования
    console.log('\n=== Тест #1: Отправка текста с незакрытыми тегами (с автоисправлением) ===');
    const result1 = await sendHtmlMessage(UNCLOSED_TAG_HTML, true);
    
    console.log('\n=== Тест #2: Отправка текста с незакрытыми тегами (без автоисправления) ===');
    try {
      const result2 = await sendHtmlMessage(UNCLOSED_TAG_HTML, false);
      console.log('Результат:', result2?.ok ? 'Успешно' : 'Ошибка');
    } catch (error) {
      console.error('Ошибка при отправке без автоисправления:', error.message);
    }
    
    console.log('\n=== Тест #3: Отправка сложного HTML-форматирования ===');
    const complexHtml = `
<b>Заголовок</b>

<i>Курсивный текст с <a href="https://example.com">ссылкой</a></i>

Обычный текст и <code>моноширинный код</code>.

<u>Подчеркнутый список</u>:
• Первый пункт
• Второй <b>жирный</b> пункт
• Третий <i>курсивный</i> пункт

<b><i>Жирный и курсивный одновременно!</i></b>
`;
    const result3 = await sendHtmlMessage(complexHtml, true);
    console.log('Результат:', result3?.ok ? 'Успешно' : 'Ошибка');
    
  } catch (error) {
    console.error('Ошибка при отправке контента в Telegram:', error.message);
  }
}

// Запуск скрипта
console.log('=== Начало теста отправки HTML-сообщений в Telegram ===');
console.log(`Бот: ${TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.substring(0, 10) + '...' : 'Не указан'}`);
console.log(`Чат ID: ${TELEGRAM_CHAT_ID}`);

sendContentToTelegram()
  .then(() => {
    console.log('\n=== Завершение теста отправки HTML-сообщений в Telegram ===');
  })
  .catch(error => {
    console.error('Критическая ошибка:', error.message);
  });