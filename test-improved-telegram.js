/**
 * Тест для проверки улучшенного TelegramService
 * Позволяет тестировать различные сценарии отправки HTML-форматированного текста в Telegram
 * 
 * Запуск: node test-improved-telegram.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { telegramService } from './server/services/social/telegram-service.js';
import { fixUnclosedTags } from './server/utils/telegram-formatter.js';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен и ID чата из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Выводит информацию в консоль с временной меткой
 * @param {string} message Сообщение для вывода
 */
function log(message) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  console.log(`${timeStr} [test] ${message}`);
}

/**
 * Основная функция для тестирования
 */
async function runTest() {
  try {
    log('Запуск теста улучшенного TelegramService...');

    // Проверяем наличие необходимых переменных окружения
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      log('Ошибка: Не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в переменных окружения');
      process.exit(1);
    }

    // Инициализируем TelegramService
    telegramService.initialize(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
    log(`Инициализирован TelegramService с токеном (${TELEGRAM_BOT_TOKEN.substring(0, 8)}...) и ID чата: ${TELEGRAM_CHAT_ID}`);
    
    // Получаем информацию о чате
    const chatInfo = await telegramService.getChatInfo();
    log(`Информация о чате: ID=${chatInfo.id}, Username=${chatInfo.username || 'отсутствует'}, Type=${chatInfo.type}`);

    // Тест 1: Отправка простого HTML-сообщения
    log('\nТест 1: Отправка простого HTML-сообщения');
    const simpleHtml = `<b>Тестовое сообщение</b>\n\n<i>Курсив</i> и <u>подчеркнутый</u> текст для проверки базового HTML.`;
    const simpleResult = await telegramService.sendRawHtmlToTelegram(simpleHtml);
    log(`Результат: ${simpleResult.success ? 'Успешно' : 'Ошибка'}`);
    log(`ID сообщения: ${simpleResult.messageId}`);
    log(`URL сообщения: ${simpleResult.messageUrl}`);

    // Тест 2: Отправка HTML с абзацами
    log('\nТест 2: Отправка HTML с абзацами');
    const paragraphHtml = `<b>Заголовок</b>\n\n<p>Первый абзац текста с <b>жирным</b> форматированием.</p>\n\n<p>Второй абзац с <i>курсивным</i> форматированием.</p>\n\n<p>Третий абзац с <u>подчеркнутым</u> текстом.</p>`;
    const paragraphResult = await telegramService.sendRawHtmlToTelegram(paragraphHtml);
    log(`Результат: ${paragraphResult.success ? 'Успешно' : 'Ошибка'}`);
    log(`ID сообщения: ${paragraphResult.messageId}`);
    log(`URL сообщения: ${paragraphResult.messageUrl}`);

    // Тест 3: Отправка HTML с незакрытыми тегами
    log('\nТест 3: Отправка HTML с незакрытыми тегами');
    const unclosedHtml = `<b>Тест с незакрытыми тегами\n\n<i>Это курсивный текст без закрывающего тега\n\n<u>Подчеркнутый текст тоже без закрывающего тега\n\nОбычный текст в конце.`;
    const unclosedResult = await telegramService.sendRawHtmlToTelegram(unclosedHtml);
    log(`Результат: ${unclosedResult.success ? 'Успешно' : 'Ошибка'}`);
    log(`ID сообщения: ${unclosedResult.messageId}`);
    log(`URL сообщения: ${unclosedResult.messageUrl}`);

    // Тест 4: Отправка изображения с HTML-подписью
    log('\nТест 4: Отправка изображения с HTML-подписью');
    const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';
    const imageCaption = '<b>Тестовое изображение</b>\n\nПодпись с <i>форматированием</i> и <u>подчеркиванием</u>.';
    const imageResult = await telegramService.sendImage(imageUrl, imageCaption);
    log(`Результат: ${imageResult.success ? 'Успешно' : 'Ошибка'}`);
    log(`ID сообщения: ${imageResult.messageId}`);
    log(`URL сообщения: ${imageResult.messageUrl}`);

    log('\nТестирование завершено!');
  } catch (error) {
    log(`Ошибка при выполнении теста: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Детали ошибки API: ${JSON.stringify(error.response.data)}`);
    }
    console.error(error.stack);
  }
}

// Запускаем тест
runTest();