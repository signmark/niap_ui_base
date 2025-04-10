/**
 * Тест для проверки форматирования списков в Telegram
 * Скрипт отправляет HTML-текст со списками в Telegram с предварительной обработкой
 * 
 * Запуск: node telegram-lists-test.js
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Telegram API токен и ID чата из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

/**
 * Выводит сообщение в консоль с временной меткой
 * @param {string} message Сообщение для вывода
 */
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Преобразует HTML-списки в обычный текст с маркерами для Telegram
 * Telegram не поддерживает HTML списки, поэтому нужно преобразовать их в обычный текст
 * @param {string} html HTML-текст для обработки
 * @returns {string} Обработанный HTML-текст с преобразованными списками
 */
function processLists(html) {
  // Найти и преобразовать все маркированные списки (<ul><li>текст</li></ul>)
  // Заменяем <ul> на ничего, <li> на • с отступом
  let processedHtml = html;
  
  // Перед началом обработки структурированных списков - сначала обрабатываем весь сложный HTML внутри элементов списка
  processedHtml = processedHtml.replace(/<li>(.*?)<\/li>/gs, (match, content) => {
    // Вложенные теги внутри <li> обрабатываем отдельно
    let processedContent = content
      // Обработка параграфов внутри <li>
      .replace(/<p>(.*?)<\/p>/g, '$1')
      // Преобразование <em> в <i>
      .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
      // Преобразование <strong> в <b>
      .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
      // Удаление других ненужных тегов
      .replace(/<\/?span[^>]*>/g, '')
      // Удаляем лишние пробелы
      .trim();
      
    return `<li>${processedContent}</li>`;
  });
  
  // Сохраняем оригинальные отступы и пробелы в HTML перед заменой списков
  const indentMap = new Map();
  
  // Находим и сохраняем отступы перед списками
  const indentRegex = /(\s*)<(ul|ol)[^>]*>/g;
  let indentMatch;
  while ((indentMatch = indentRegex.exec(processedHtml)) !== null) {
    const position = indentMatch.index;
    const indent = indentMatch[1] || ''; // Пробелы перед тегом списка
    indentMap.set(position, indent);
  }
  
  // Обработка неупорядоченных списков (буллеты) с сохранением отступов
  processedHtml = processedHtml.replace(/(\s*)<ul>(.*?)<\/ul>/gs, (match, indent, listContent) => {
    // Заменяем каждый <li> на строку с маркером •
    const formattedList = listContent
      .replace(/<li>(.*?)<\/li>/g, `\n${indent}• $1`)
      .trim() + '\n\n';
    
    return `${indent}\n${formattedList}`;
  });
  
  // Обработка упорядоченных списков (с цифрами) с сохранением отступов
  processedHtml = processedHtml.replace(/(\s*)<ol>(.*?)<\/ol>/gs, (match, indent, listContent) => {
    const items = listContent.match(/<li>(.*?)<\/li>/g);
    if (!items) return match;
    
    let numberedList = `\n`;
    items.forEach((item, index) => {
      // Извлекаем содержимое между <li> и </li>
      const content = item.replace(/<li>(.*?)<\/li>/, '$1');
      numberedList += `${indent}${index + 1}. ${content}\n`;
    });
    
    return `${indent}\n${numberedList.trim()}\n\n`;
  });
  
  // Удаляем лишние переносы строк после обработки списков
  processedHtml = processedHtml
    // Заменяем множественные переносы строк на не более двух
    .replace(/\n{3,}/g, '\n\n')
    // Убираем лишние пробелы перед маркерами списков (но не отступы)
    .replace(/(\s+)•/g, (match, spaces) => {
      // Если в пробелах есть перенос строки, оставляем только его и один уровень отступа
      if (spaces.includes('\n')) {
        return '\n      •';
      }
      return match;
    })
    .replace(/(\s+)(\d+)\./g, (match, spaces, num) => {
      // Если в пробелах есть перенос строки, оставляем только его и один уровень отступа
      if (spaces.includes('\n')) {
        return '\n      ' + num + '.';
      }
      return match;
    });
  
  // Обработка параграфов, чтобы они не мешали спискам
  processedHtml = processedHtml
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
    // Убираем лишние переносы строк
    .replace(/\n{3,}/g, '\n\n');
  
  return processedHtml;
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} message Сообщение для отправки
 * @returns {Promise<Object>} Результат отправки
 */
async function sendTelegramMessage(message) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_notification: false
      }
    );
    
    return response.data;
  } catch (error) {
    log(`Ошибка при отправке сообщения в Telegram: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Тестирует обработку HTML-списков и отправку в Telegram
 * @returns {Promise<void>}
 */
async function testListFormatting() {
  // Тестовый HTML-контент со списками
  const testHtml = `<p>Это пример контента со списками для Telegram.</p>
  
  <p><b>Маркированный список:</b></p>
  <ul>
    <li>Первый пункт маркированного списка</li>
    <li>Второй пункт с <b>жирным</b> текстом</li>
    <li>Третий пункт с <i>курсивом</i> и <a href="https://telegram.org">ссылкой</a></li>
  </ul>
  
  <p><b>Нумерованный список:</b></p>
  <ol>
    <li>Шаг первый - <b>важно</b></li>
    <li>Шаг второй - <i>обратите внимание</i></li>
    <li>Шаг третий - подробнее на <a href="https://example.com">сайте</a></li>
  </ol>
  
  <p>Текст после списков. Проверяем, как работает форматирование.</p>`;
  
  log('Исходный HTML:');
  log(testHtml);
  
  // Обрабатываем HTML-списки
  const processedHtml = processLists(testHtml);
  
  log('\nОбработанный HTML:');
  log(processedHtml);
  
  // Отправляем обработанный HTML в Telegram
  log('\nОтправка в Telegram...');
  const result = await sendTelegramMessage(processedHtml);
  
  log(`\nСообщение успешно отправлено! ID сообщения: ${result.result.message_id}`);
  
  // Возвращаем ссылку на сообщение
  const chatUsername = TELEGRAM_CHAT_ID.startsWith('-100') 
    ? '' // Для приватных чатов нет username
    : '@test_channel'; // Замените на username вашего публичного канала
  
  if (chatUsername) {
    log(`Ссылка на сообщение: https://t.me/${chatUsername.replace('@', '')}/${result.result.message_id}`);
  } else {
    log('Сообщение отправлено в приватный чат, ссылка недоступна');
  }
}

// Запускаем тест
testListFormatting()
  .then(() => log('Тест завершен успешно!'))
  .catch(error => log(`Ошибка выполнения теста: ${error.message}`));