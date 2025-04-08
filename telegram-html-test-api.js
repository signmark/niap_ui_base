/**
 * Тестовый скрипт для проверки HTML-форматирования в Telegram через API сервера
 * 
 * Этот скрипт отправляет HTTP запросы к API приложения для тестирования формирования
 * и отправки HTML-форматированных сообщений в Telegram.
 * 
 * Запуск: node telegram-html-test-api.js
 */

const axios = require('axios');

// Настройки для тестирования
const API_BASE_URL = 'http://localhost:5000/api/test';
const TEST_HTML = '<b>Жирный текст</b> и <i>курсив</i>, а также <u>подчеркнутый</u> с <a href="https://t.me">ссылкой</a>.';
const COMPLEX_HTML = `<b>Заголовок жирным</b>

<i>Курсивный подзаголовок с <a href="https://example.com">ссылкой</a></i>

Обычный текст и <code>моноширинный шрифт</code> для кода.

<u>Подчеркнутый список</u>:
• Первый пункт
• Второй <b>жирный</b> пункт
• Третий <i>курсивный</i> пункт

<b><i>Жирный и курсивный одновременно!</i></b>

<a href="https://telegram.org">Посетите сайт Telegram</a>`;

// Примеры текста с незакрытыми тегами
const UNCLOSED_TAG_HTML = `<b>Тест с незакрытым тегом жирного текста и <i>курсива`;

/**
 * Отправляет HTML-текст через API приложения напрямую
 * @param {string} html HTML-текст для отправки
 * @param {boolean} autoFixHtml Включить автоисправление тегов
 * @returns {Promise<object>} Результат отправки сообщения
 */
async function sendHtmlToTelegram(html, autoFixHtml = true) {
  try {
    console.log(`Отправка HTML через API: ${html.substring(0, 50)}${html.length > 50 ? '...' : ''}`);
    
    const response = await axios.post(`${API_BASE_URL}/raw-html-telegram`, {
      text: html,
      autoFixHtml: autoFixHtml
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке HTML через API:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    throw error;
  }
}

/**
 * Отправляет HTML-текст с изображением через API приложения
 * @param {string} html HTML-текст для отправки
 * @param {string} imageUrl URL изображения для отправки
 * @returns {Promise<object>} Результат отправки сообщения
 */
async function sendHtmlWithImage(html, imageUrl) {
  try {
    console.log(`Отправка HTML с изображением через API: ${html.substring(0, 50)}${html.length > 50 ? '...' : ''}`);
    console.log(`Изображение: ${imageUrl}`);
    
    const response = await axios.post(`${API_BASE_URL}/optimized-platform-publish`, {
      content: html,
      imageUrl: imageUrl
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке HTML с изображением через API:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    throw error;
  }
}

/**
 * Запускает все тесты
 */
async function runAllTests() {
  try {
    console.log('=== Начало тестирования HTML-форматирования в Telegram ===\n');
    
    // Тест 1: Простой HTML текст
    console.log('Тест 1: Простой HTML текст');
    const result1 = await sendHtmlToTelegram(TEST_HTML);
    console.log('Результат:', result1.success ? 'Успешно' : 'Ошибка');
    console.log('URL сообщения:', result1.messageUrl || 'Нет URL');
    console.log();
    
    // Тест 2: Комплексный HTML текст
    console.log('Тест 2: Комплексный HTML текст');
    const result2 = await sendHtmlToTelegram(COMPLEX_HTML);
    console.log('Результат:', result2.success ? 'Успешно' : 'Ошибка');
    console.log('URL сообщения:', result2.messageUrl || 'Нет URL');
    console.log();
    
    // Тест 3: HTML с незакрытыми тегами
    console.log('Тест 3: HTML с незакрытыми тегами');
    const result3 = await sendHtmlToTelegram(UNCLOSED_TAG_HTML);
    console.log('Результат:', result3.success ? 'Успешно' : 'Ошибка');
    console.log('URL сообщения:', result3.messageUrl || 'Нет URL');
    console.log();
    
    // Тест 4: HTML с изображением
    console.log('Тест 4: HTML с изображением');
    const imageUrl = 'https://i.imgur.com/dkIX5D7.jpeg'; // Пример URL изображения
    const result4 = await sendHtmlWithImage(COMPLEX_HTML, imageUrl);
    console.log('Результат:', result4.success ? 'Успешно' : 'Ошибка');
    console.log('URL сообщения:', result4.postUrl || 'Нет URL');
    console.log();
    
    console.log('=== Завершение тестирования HTML-форматирования в Telegram ===');
    
  } catch (error) {
    console.error('Ошибка при выполнении тестов:', error.message);
  }
}

// Запускаем все тесты
runAllTests();