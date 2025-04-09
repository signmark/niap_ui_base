/**
 * Скрипт для тестирования маршрутов API форматирования HTML для Telegram
 * Запуск: node telegram-html-test-routes.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Базовый URL API
const API_BASE_URL = 'http://localhost:3000/api/test';

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
 * Тестирует маршрут /api/test/telegram/format-html
 * @param {string} html HTML-текст для форматирования
 * @returns {Promise<object>} Результат форматирования
 */
async function testFormatHtml(html) {
  log('Тестирование форматирования HTML для Telegram');
  try {
    const response = await axios.post(`${API_BASE_URL}/telegram/format-html`, { html });
    log(`Запрос успешно выполнен. Статус: ${response.status}`);
    return response.data;
  } catch (error) {
    log(`Ошибка при тестировании форматирования HTML: ${error.message}`);
    if (error.response) {
      log(`Статус ответа: ${error.response.status}`);
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Тестирует маршрут /api/test/telegram/format-lists
 * @param {string} html HTML-текст со списками для форматирования
 * @returns {Promise<object>} Результат форматирования списков
 */
async function testFormatLists(html) {
  log('Тестирование форматирования списков для Telegram');
  try {
    const response = await axios.post(`${API_BASE_URL}/telegram/format-lists`, { html });
    log(`Запрос успешно выполнен. Статус: ${response.status}`);
    return response.data;
  } catch (error) {
    log(`Ошибка при тестировании форматирования списков: ${error.message}`);
    if (error.response) {
      log(`Статус ответа: ${error.response.status}`);
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Тестирует маршрут /api/test/telegram/format-emoji
 * @param {string} html HTML-текст с эмодзи для форматирования
 * @returns {Promise<object>} Результат форматирования с эмодзи
 */
async function testFormatEmoji(html) {
  log('Тестирование форматирования с эмодзи для Telegram');
  try {
    const response = await axios.post(`${API_BASE_URL}/telegram/format-emoji`, { html });
    log(`Запрос успешно выполнен. Статус: ${response.status}`);
    return response.data;
  } catch (error) {
    log(`Ошибка при тестировании форматирования с эмодзи: ${error.message}`);
    if (error.response) {
      log(`Статус ответа: ${error.response.status}`);
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Тестирует маршрут /api/test/telegram/fix-unclosed-tags
 * @param {string} html HTML-текст с незакрытыми тегами для исправления
 * @returns {Promise<object>} Результат исправления незакрытых тегов
 */
async function testFixUnclosedTags(html) {
  log('Тестирование исправления незакрытых тегов для Telegram');
  try {
    const response = await axios.post(`${API_BASE_URL}/telegram/fix-unclosed-tags`, { html });
    log(`Запрос успешно выполнен. Статус: ${response.status}`);
    return response.data;
  } catch (error) {
    log(`Ошибка при тестировании исправления незакрытых тегов: ${error.message}`);
    if (error.response) {
      log(`Статус ответа: ${error.response.status}`);
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Тестирует маршрут /api/test/status
 * @returns {Promise<object>} Информация о доступных тестовых маршрутах
 */
async function testApiStatus() {
  log('Проверка доступности тестовых API');
  try {
    const response = await axios.get(`${API_BASE_URL}/status`);
    log(`Запрос успешно выполнен. Статус: ${response.status}`);
    return response.data;
  } catch (error) {
    log(`Ошибка при проверке доступности API: ${error.message}`);
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
  try {
    // Загружаем тестовые примеры из отдельного файла
    const testCases = require('./telegram-html-test-cases');

    // Проверка доступности API
    const apiStatus = await testApiStatus();
    log(`Доступные маршруты API: ${apiStatus.availableRoutes.length}`);
    console.log(JSON.stringify(apiStatus, null, 2));

    // Тестирование форматирования HTML
    const formatHtmlResult = await testFormatHtml(testCases.basicHtml);
    log('Результат форматирования базового HTML:');
    console.log(JSON.stringify(formatHtmlResult, null, 2));

    // Тестирование форматирования списков
    const formatListsResult = await testFormatLists(testCases.nestedListHtml);
    log('Результат форматирования вложенных списков:');
    console.log(JSON.stringify(formatListsResult, null, 2));

    // Тестирование форматирования с эмодзи
    const formatEmojiResult = await testFormatEmoji(testCases.emojiHtml);
    log('Результат форматирования с эмодзи:');
    console.log(JSON.stringify(formatEmojiResult, null, 2));

    // Тестирование исправления незакрытых тегов
    const fixUnclosedTagsResult = await testFixUnclosedTags(testCases.unclosedTagsHtml);
    
    // Тестирование сложного HTML
    log('Тестирование комплексного HTML:');
    const complexHtmlResult = await testFormatHtml(testCases.complexHtml);
    console.log(JSON.stringify(complexHtmlResult, null, 2));
    
    // Тестирование HTML с неподдерживаемыми тегами
    log('Тестирование HTML с неподдерживаемыми тегами:');
    const unsupportedTagsResult = await testFormatHtml(testCases.unsupportedTagsHtml);
    console.log(JSON.stringify(unsupportedTagsResult, null, 2));

    log('Результат исправления незакрытых тегов:');
    console.log(JSON.stringify(fixUnclosedTagsResult, null, 2));

    log('Все тесты успешно выполнены');
  } catch (error) {
    log(`Ошибка при выполнении тестов: ${error.message}`);
  }
}

// Запуск тестов
runAllTests();