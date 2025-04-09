/**
 * Специальный тест для проверки обработки блоков форматирования без отдельных параграфов
 * Запуск: node test-formatting-blocks.js
 */

import dotenv from 'dotenv';
import axios from 'axios';
import { cleanHtmlForTelegram } from './server/utils/telegram-html-cleaner-new.js';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен и ID чата из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Ошибка: Не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в переменных окружения');
    return { success: false, error: 'Отсутствуют настройки Telegram' };
  }
  
  try {
    // Подготавливаем HTML для отправки
    const processedHtml = cleanHtmlForTelegram(html);
    console.log('Подготовленный HTML для отправки:', processedHtml);
    
    // Отправляем сообщение через Telegram Bot API
    const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await axios.post(apiUrl, {
      chat_id: TELEGRAM_CHAT_ID,
      text: processedHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: true
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
 * Тестирует форматирование блоков с разными тегами без параграфов между ними
 */
async function testFormattingBlocks() {
  // Тест с обычными тегами форматирования без разделительных параграфов
  const simpleBlockTest = `<i>Мини тест </i><b>Для проверки </b><u>Форматирования</u>`;
  
  console.log('===== ТЕСТ ФОРМАТИРОВАНИЯ ПРОСТЫХ БЛОКОВ =====');
  console.log('Исходный HTML:', simpleBlockTest);
  
  // Тест с более сложной структурой
  const complexBlockTest = `
    <i>Курсивный текст</i>
    <b>Жирный текст</b>
    <u>Подчеркнутый текст</u>
    <s>Зачеркнутый текст</s>
    <a href="https://example.com">Ссылка</a>
    <i>Еще <b>один</b> <u>тест</u></i>
  `;
  
  console.log('\n===== ТЕСТ ФОРМАТИРОВАНИЯ СЛОЖНЫХ БЛОКОВ =====');
  console.log('Исходный HTML:', complexBlockTest);
  
  // Отправляем простой тест
  console.log('\nОтправка простого теста...');
  const simpleResult = await sendHtmlMessage(simpleBlockTest);
  
  if (simpleResult.success) {
    console.log(`Простой тест успешно отправлен! ID: ${simpleResult.message_id}, URL: ${simpleResult.url}`);
  } else {
    console.error(`Ошибка отправки простого теста: ${simpleResult.error}`);
  }
  
  // Отправляем сложный тест
  console.log('\nОтправка сложного теста...');
  const complexResult = await sendHtmlMessage(complexBlockTest);
  
  if (complexResult.success) {
    console.log(`Сложный тест успешно отправлен! ID: ${complexResult.message_id}, URL: ${complexResult.url}`);
  } else {
    console.error(`Ошибка отправки сложного теста: ${complexResult.error}`);
  }
}

// Запускаем тест
testFormattingBlocks().catch(error => {
  console.error('Ошибка в основном процессе:', error);
});