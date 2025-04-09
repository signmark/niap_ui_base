/**
 * Продвинутые тесты форматирования HTML для Telegram
 * Этот скрипт демонстрирует поддержку сложных случаев форматирования HTML и их отправку в Telegram
 * 
 * Запуск: node telegram-format-advanced-test.js
 */

import dotenv from 'dotenv';
import axios from 'axios';
import { colors } from './server/utils/colors.js';

dotenv.config();

// Получаем учетные данные из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Выводит заголовок теста
 * @param {string} title Название теста
 */
function printHeader(title) {
  console.log(`\n${colors.blue}======== ${title} ========${colors.reset}`);
}

/**
 * Выводит результаты теста
 * @param {string} name Название теста
 * @param {boolean} success Успешен ли тест
 * @param {object} result Результат выполнения
 */
function printResult(name, success, result) {
  console.log(`\n${colors.blue}=== Тест: ${name} ===${colors.reset}`);
  console.log(`Статус: ${success ? colors.green + '✓ ПРОЙДЕН' : colors.red + '✗ ПРОВАЛЕН'}${colors.reset}`);
  console.log(`\nРезультат отправки:`);
  if (result.ok) {
    console.log(`Сообщение отправлено: ID: ${result.result.message_id}`);
    console.log(`Текст сообщения: ${result.result.text || '(сложное сообщение)'}`);
  } else {
    console.log(`${colors.red}Ошибка:${colors.reset} ${result.description || JSON.stringify(result)}`);
  }
}

/**
 * Форматирует HTML для соответствия требованиям Telegram
 * @param {string} html Исходный HTML
 * @returns {string} Отформатированный HTML для Telegram
 */
function formatHtmlForTelegram(html) {
  if (!html) return '';
  
  let result = html;
  
  // Удаляем неподдерживаемые теги и их содержимое
  const unsupportedBlockTags = ['ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'font'];
  for (const tag of unsupportedBlockTags) {
    // Удаляем открывающие и закрывающие теги, оставляя содержимое
    result = result.replace(new RegExp(`<${tag}[^>]*>`, 'gi'), '');
    result = result.replace(new RegExp(`</${tag}>`, 'gi'), '');
  }
  
  // Обрабатываем блочные элементы
  result = result.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n');
  result = result.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n');
  result = result.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '$1\n');
  
  // Обрабатываем списки
  result = result.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  
  // Исправляем незакрытые теги
  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code', 'pre', 'a'];
  const stack = [];
  
  // Находим все теги
  result = result.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    // Преобразование эквивалентных тегов
    if (tagName.toLowerCase() === 'strong') tagName = 'b';
    if (tagName.toLowerCase() === 'em') tagName = 'i';
    if (tagName.toLowerCase() === 'strike') tagName = 's';
    
    // Если тег не поддерживается, удаляем его
    if (!allowedTags.includes(tagName.toLowerCase())) {
      return '';
    }
    
    // Если это закрывающий тег
    if (match.startsWith('</')) {
      if (stack.length > 0 && stack[stack.length - 1] === tagName.toLowerCase()) {
        stack.pop(); // Удаляем из стека
        return match; // Возвращаем закрывающий тег
      }
      return ''; // Удаляем несоответствующий закрывающий тег
    } 
    // Если это открывающий тег
    else {
      // Если тег a, сохраняем только href
      if (tagName.toLowerCase() === 'a') {
        const hrefMatch = match.match(/href=["']([^"']*)["']/i);
        if (hrefMatch) {
          stack.push('a');
          return `<a href="${hrefMatch[1]}">`;
        }
        return ''; // Если нет href, удаляем тег
      }
      
      // Для других поддерживаемых тегов, сохраняем только имя тега
      stack.push(tagName.toLowerCase());
      return `<${tagName.toLowerCase()}>`;
    }
  });
  
  // Закрываем все оставшиеся открытые теги
  while (stack.length > 0) {
    const tag = stack.pop();
    result += `</${tag}>`;
  }
  
  // Удаляем лишние пробелы и переносы
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст сообщения
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  try {
    // Форматируем HTML перед отправкой
    const formattedHtml = formatHtmlForTelegram(html);
    console.log(`${colors.yellow}Отправляемый текст:${colors.reset} ${formattedHtml}`);
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: formattedHtml,
      parse_mode: 'HTML'
    });
    return response.data;
  } catch (error) {
    console.error(`${colors.red}Ошибка при отправке сообщения:${colors.reset}`, error.response?.data || error.message);
    return error.response?.data || { ok: false, description: error.message };
  }
}

/**
 * Тестирует вложенное форматирование в Telegram
 */
async function testNestedFormatting() {
  const html = `<b>Проверка вложенного форматирования</b>

<b>Жирный текст с <i>курсивом внутри</i> и снова жирный</b>
<i>Курсив с <b>жирным внутри</b> и снова курсив</i>
<u>Подчеркнутый с <b>жирным</b> и <i>курсивом</i> внутри</u>
<b><i><u>Все форматирование сразу</u></i></b>`;

  const result = await sendHtmlMessage(html);
  printResult('Вложенное форматирование', result.ok === true, result);
  return result.ok === true;
}

/**
 * Тестирует сложные списки в Telegram
 */
async function testComplexLists() {
  const html = `<b>Проверка сложных списков</b>

<ul>
  <li><b>Первый пункт с жирным</b></li>
  <li><i>Второй пункт с курсивом</i></li>
  <li><u>Третий пункт с подчеркиванием</u></li>
  <li><b>Четвёртый пункт</b> с <i>различным</i> <u>форматированием</u></li>
</ul>

<ol>
  <li>Нумерованный список становится маркированным</li>
  <li>Второй пункт нумерованного списка</li>
</ol>`;

  const result = await sendHtmlMessage(html);
  printResult('Сложные списки', result.ok === true, result);
  return result.ok === true;
}

/**
 * Тестирует обработку блочных элементов в Telegram
 */
async function testBlockElements() {
  const html = `<b>Проверка блочных элементов</b>

<p>Параграф 1 с <b>жирным</b> форматированием.</p>
<p>Параграф 2 с <i>курсивным</i> форматированием.</p>

<div>Блок 1 без форматирования</div>
<div>Блок 2 с <b>жирным</b> форматированием</div>

<blockquote>Цитата с <i>курсивом</i> и <u>подчеркиванием</u></blockquote>

<pre>Программный код с сохранением
  форматирования и    пробелов
</pre>`;

  const result = await sendHtmlMessage(html);
  printResult('Блочные элементы', result.ok === true, result);
  return result.ok === true;
}

/**
 * Тестирует ссылки и специальные символы в Telegram
 */
async function testLinksAndSymbols() {
  const html = `<b>Проверка ссылок и специальных символов</b>

🔗 <a href="https://example.com">Обычная ссылка</a>
🌐 <a href="https://telegram.org">Ссылка на Telegram</a>

⚠️ Символы и эмодзи сохраняются: 👍 🎉 ⭐ 💡
✓ Успех! ✗ Ошибка! ⚠️ Предупреждение!`;

  const result = await sendHtmlMessage(html);
  printResult('Ссылки и специальные символы', result.ok === true, result);
  return result.ok === true;
}

/**
 * Тестирует корректность обработки незакрытых тегов
 */
async function testUnclosedTags() {
  const html = `<b>Проверка исправления незакрытых тегов

<b>Этот тег должен быть закрыт автоматически

<i>Этот курсив тоже должен быть закрыт

<b>Вложенные <i>незакрытые</i> теги

<a href="https://example.com">Незакрытая ссылка

Обычный текст в конце сообщения`;

  const result = await sendHtmlMessage(html);
  printResult('Незакрытые теги', result.ok === true, result);
  return result.ok === true;
}

/**
 * Тестирует обработку неподдерживаемых тегов в Telegram
 */
async function testUnsupportedTags() {
  const html = `<b>Проверка удаления неподдерживаемых тегов</b>

<h1>Заголовок H1</h1>
<h2>Заголовок H2</h2>
<span style="color: red;">Текст с цветом</span>
<font color="blue">Цветной текст</font>

<b>Поддерживаемые теги сохраняются:</b>
<i>Курсив</i> и <u>подчеркивание</u>`;

  const result = await sendHtmlMessage(html);
  printResult('Неподдерживаемые теги', result.ok === true, result);
  return result.ok === true;
}

/**
 * Тестирует эскейпинг специальных символов в Telegram
 */
async function testEscaping() {
  const html = `<b>Проверка эскейпинга специальных символов</b>

Символы &lt; и &gt; должны отображаться как < и >
Символ &amp; должен отображаться как &

Код HTML: &lt;b&gt;текст&lt;/b&gt;`;

  const result = await sendHtmlMessage(html);
  printResult('Эскейпинг символов', result.ok === true, result);
  return result.ok === true;
}

/**
 * Запускает все тесты
 */
async function runAllTests() {
  printHeader('ПРОДВИНУТЫЕ ТЕСТЫ ФОРМАТИРОВАНИЯ HTML ДЛЯ TELEGRAM');
  
  // Проверка наличия токена и chat ID
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log(`${colors.red}Ошибка: Отсутствуют необходимые переменные окружения${colors.reset}`);
    console.log(`TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? 'Установлен' : 'Отсутствует'}`);
    console.log(`TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID ? 'Установлен' : 'Отсутствует'}`);
    return false;
  }
  
  try {
    console.log(`${colors.yellow}Запуск тестов продвинутого форматирования...${colors.reset}`);
    
    let success = true;
    
    // Тест 1: Вложенное форматирование
    const test1 = await testNestedFormatting();
    success = success && test1;
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 2: Сложные списки
    const test2 = await testComplexLists();
    success = success && test2;
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 3: Блочные элементы
    const test3 = await testBlockElements();
    success = success && test3;
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 4: Ссылки и специальные символы
    const test4 = await testLinksAndSymbols();
    success = success && test4;
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 5: Незакрытые теги
    const test5 = await testUnclosedTags();
    success = success && test5;
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 6: Неподдерживаемые теги
    const test6 = await testUnsupportedTags();
    success = success && test6;
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 7: Эскейпинг символов
    const test7 = await testEscaping();
    success = success && test7;
    
    // Итоги тестирования
    printHeader('ИТОГИ ТЕСТИРОВАНИЯ');
    
    if (success) {
      console.log(`${colors.green}✓ Все тесты продвинутого форматирования успешно пройдены${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Некоторые тесты не пройдены${colors.reset}`);
    }
    
    return success;
  } catch (error) {
    console.error(`${colors.red}Критическая ошибка при выполнении тестов:${colors.reset}`, error);
    return false;
  }
}

// Запускаем тесты
runAllTests();