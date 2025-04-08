/**
 * Тест для проверки сложных вложенных списков в Telegram
 * Этот скрипт проверяет корректность обработки вложенных и комбинированных списков
 * 
 * Запуск: node telegram-complex-lists-test.js
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
 * Преобразует HTML-контент в совместимый с Telegram формат
 * Telegram поддерживает только ограниченный набор тегов: <b>, <i>, <u>, <s>, <a>, <code>, <pre>
 * @param {string} html HTML-текст для обработки
 * @returns {string} Обработанный HTML-текст, совместимый с Telegram
 */
function processLists(html) {
  // Предварительная обработка - удаление нестандартных тегов
  let processedHtml = html;
  
  // Сначала заменяем заголовки на жирный текст 
  processedHtml = processedHtml
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g, '<b>$1</b>\n\n')
    // Удаляем div, section и другие блочные элементы
    .replace(/<(div|section|article|header|footer|nav|aside)[^>]*>/g, '')
    .replace(/<\/(div|section|article|header|footer|nav|aside)>/g, '\n');
  
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
  
  // Полная обработка вложенных списков - мы обрабатываем их рекурсивно
  // Сначала вложенные (дочерние) списки, затем родительские
  
  // Обрабатываем вложенные списки с помощью дополнительных отступов
  // Обрабатываем неупорядоченные списки внутри элементов списка
  processedHtml = processedHtml.replace(/<li>.*?<ul>(.*?)<\/ul>.*?<\/li>/gs, (match, nestedListContent) => {
    const nestedItems = nestedListContent.match(/<li>(.*?)<\/li>/gs);
    if (!nestedItems) return match;
    
    let formattedNestedList = '';
    nestedItems.forEach(item => {
      const content = item.replace(/<li>(.*?)<\/li>/, '$1').trim();
      formattedNestedList += `\n          • ${content}`;
    });
    
    // Заменяем вложенный список на обработанный текст с маркерами
    return match.replace(/<ul>.*?<\/ul>/s, formattedNestedList);
  });
  
  // Обрабатываем вложенные нумерованные списки
  processedHtml = processedHtml.replace(/<li>.*?<ol>(.*?)<\/ol>.*?<\/li>/gs, (match, nestedListContent) => {
    const nestedItems = nestedListContent.match(/<li>(.*?)<\/li>/gs);
    if (!nestedItems) return match;
    
    let formattedNestedList = '';
    nestedItems.forEach((item, index) => {
      const content = item.replace(/<li>(.*?)<\/li>/, '$1').trim();
      formattedNestedList += `\n          ${index + 1}. ${content}`;
    });
    
    // Заменяем вложенный список на обработанный текст с нумерацией
    return match.replace(/<ol>.*?<\/ol>/s, formattedNestedList);
  });
  
  // Теперь обрабатываем корневые списки
  
  // Обработка неупорядоченных списков (буллеты)
  processedHtml = processedHtml.replace(/<ul>(.*?)<\/ul>/gs, (match, listContent) => {
    // Заменяем каждый <li> на строку с маркером •
    const formattedList = listContent
      .replace(/<li>(.*?)<\/li>/gs, (liMatch, liContent) => {
        // Проверяем, есть ли внутри уже обработанные вложенные списки
        if (liContent.includes('•') || liContent.includes('1.')) {
          return `\n      • ${liContent.replace(/^\s+/, '')}`;
        }
        return `\n      • ${liContent}`;
      })
      .trim() + '\n\n';
    
    return formattedList;
  });
  
  // Обработка упорядоченных списков (с цифрами)
  processedHtml = processedHtml.replace(/<ol>(.*?)<\/ol>/gs, (match, listContent) => {
    const items = listContent.match(/<li>(.*?)<\/li>/gs);
    if (!items) return match;
    
    let numberedList = '';
    items.forEach((item, index) => {
      // Извлекаем содержимое между <li> и </li>
      const liContent = item.replace(/<li>(.*?)<\/li>/s, '$1');
      // Проверяем, есть ли внутри уже обработанные вложенные списки
      if (liContent.includes('•') || liContent.includes('1.')) {
        numberedList += `\n      ${index + 1}. ${liContent.replace(/^\s+/, '')}`;
      } else {
        numberedList += `\n      ${index + 1}. ${liContent}`;
      }
    });
    
    return numberedList.trim() + '\n\n';
  });
  
  // Удаляем все оставшиеся теги от списков, которые могли не обработаться
  processedHtml = processedHtml
    .replace(/<\/?[uo]l>|<\/?li>/g, '')
    
    // Преобразуем стандартные форматы текста в Telegram-совместимые
    .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
    .replace(/<del>(.*?)<\/del>/g, '<s>$1</s>')
    .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>')
    
    // Обработка параграфов
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
    
    // Удаляем все оставшиеся неподдерживаемые теги, но сохраняем их содержимое
    .replace(/<(?!b|\/b|i|\/i|u|\/u|s|\/s|code|\/code|pre|\/pre|a|\/a)[^>]+>/g, '')
    
    // Заменяем множественные переносы строк на не более двух
    .replace(/\n{3,}/g, '\n\n')
    
    // Очищаем пробелы в начале и конце
    .trim();
  
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
 * Тестирует обработку сложных HTML-списков и отправку в Telegram
 * @returns {Promise<void>}
 */
async function testComplexListFormatting() {
  // Сложный тестовый HTML-контент с вложенными и комбинированными списками
  const testHtml = `<p><b>Комплексный тест обработки списков</b></p>

<p>Этот тест проверяет обработку сложных и вложенных списков.</p>

<h3>Смешанные списки с разной разметкой</h3>

<ul>
  <li><strong>Первый пункт</strong> с <em>выделенным</em> текстом</li>
  <li>Пункт со <a href="https://example.com">ссылкой</a> и <b>жирным</b> текстом
    <ul>
      <li>Вложенный подпункт 1</li>
      <li>Вложенный подпункт 2 с <i>курсивом</i></li>
    </ul>
  </li>
  <li><p>Пункт с параграфом внутри</p></li>
</ul>

<p>Текст между списками.</p>

<ol>
  <li>Первый <b>нумерованный</b> пункт</li>
  <li>Второй нумерованный пункт
    <ol>
      <li>Вложенный нумерованный подпункт A</li>
      <li>Вложенный нумерованный подпункт B</li>
    </ol>
  </li>
  <li>Третий пункт с <code>кодом</code></li>
</ol>

<p>А теперь очень сложный случай - комбинированные списки:</p>

<ul>
  <li>Маркированный список, который содержит:
    <ol>
      <li>Нумерованный подпункт 1</li>
      <li>Нумерованный подпункт 2</li>
    </ol>
  </li>
  <li>Еще один пункт маркированного списка</li>
</ul>

<p>Финальный параграф после всех списков.</p>`;
  
  log('Исходный сложный HTML:');
  log(testHtml);
  
  // Обрабатываем HTML-списки
  const processedHtml = processLists(testHtml);
  
  log('\nОбработанный HTML:');
  log(processedHtml);
  
  // Отправляем обработанный HTML в Telegram
  log('\nОтправка в Telegram...');
  
  try {
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
  } catch (error) {
    log(`\nОШИБКА: Не удалось отправить сообщение: ${error.message}`);
    
    // Если ошибка связана с разбором HTML, пробуем упростить списки еще сильнее
    if (error.response && error.response.data && error.response.data.description && 
        error.response.data.description.includes('Can\'t parse entities')) {
      
      log('\nОбнаружена ошибка с HTML-разметкой, пробуем с дополнительной обработкой...');
      
      // Более агрессивная обработка - удаляем вложенные списки полностью
      let simplifiedHtml = processedHtml
        // Заменяем все оставшиеся HTML-теги списков
        .replace(/<\/?[uo]l>|<\/?li>/g, '')
        // Убираем лишние переносы строк
        .replace(/\n{3,}/g, '\n\n');
      
      log('\nУпрощенный HTML:');
      log(simplifiedHtml);
      
      // Пробуем отправить упрощенную версию
      try {
        const retryResult = await sendTelegramMessage(simplifiedHtml);
        log(`\nУпрощенное сообщение успешно отправлено! ID сообщения: ${retryResult.result.message_id}`);
      } catch (retryError) {
        log(`\nФатальная ошибка: Не удалось отправить даже упрощенную версию: ${retryError.message}`);
      }
    }
  }
}

// Запускаем тест
testComplexListFormatting()
  .then(() => log('Тест завершен!'))
  .catch(error => log(`Ошибка выполнения теста: ${error.message}`));