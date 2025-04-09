/**
 * Прямой тест отправки HTML-сообщения в Telegram с использованием токена из секретов
 * Запуск: node direct-telegram-html-test.js
 */

import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен и chat_id из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Пример HTML-текста с курсивом из скриншота
const htmlExample = `<p>Разработка сбалансированного и индивидуализированного рациона питания – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <span style="font-style: italic">инновационному онлайн-сервису для составления персонализированных планов питания</span> эта задача стала значительно проще.</p>

<p>Наш сервис использует передовые алгоритмы анализа данных для создания идеального рациона, полностью соответствующего вашим индивидуальным потребностям. Независимо от ваших целей – снижение веса, наращивание мышечной массы или поддержание здорового баланса – наш сервис поможет их достичь <span style="font-style: italic">максимально эффективным и безопасным способом</span>.</p>

<p>Одно из ключевых преимуществ нашего сервиса – возможность для медицинских специалистов, таких как врачи и диетологи, осуществлять удаленный мониторинг питания своих клиентов в режиме реального времени. Это позволяет отслеживать прогресс, своевременно корректировать рацион и предоставлять рекомендации, экономя время и ресурсы.</p>

<p>Мы приглашаем вас опробовать наш сервис и убедиться в его эффективности. Будем рады получить вашу обратную связь и отзывы, которые помогут нам продолжать совершенствовать наше предложение. Вместе мы сделаем путь к здоровому образу жизни более простым и увлекательным.</p>`;

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
      if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
        // Совпадает с последним открытым тегом - добавляем его
        result += fullTag;
        openTags.pop();
      } else {
        // Закрывающий тег без соответствующего открывающего - пропускаем
        console.log(`Пропущен закрывающий тег без соответствующего открывающего: ${fullTag}`);
      }
    } else if (!fullTag.endsWith('/>')) {
      // Открывающий тег - добавляем его и помещаем в стек
      result += fullTag;
      openTags.push(tagName);
    } else {
      // Самозакрывающийся тег - просто добавляем
      result += fullTag;
    }
  }
  
  // Добавляем оставшийся текст
  result += html.substring(lastIndex);
  
  // Закрываем все незакрытые теги
  for (let i = openTags.length - 1; i >= 0; i--) {
    result += `</${openTags[i]}>`;
    console.log(`Добавлен закрывающий тег для незакрытого тега: </${openTags[i]}>`);
  }
  
  return result;
}

/**
 * Преобразует span с inline стилями в поддерживаемые Telegram HTML теги
 * @param {string} html HTML-текст из редактора
 * @returns {string} HTML-текст совместимый с Telegram
 */
function convertEditorToTelegram(html) {
  if (!html) return '';
  
  // Преобразуем inline стили в теги
  let result = html
    // Курсив
    .replace(/<span[^>]*?style\s*=\s*["'][^"']*?font-style\s*:\s*italic[^"']*?["'][^>]*>(.*?)<\/span>/gi, '<i>$1</i>')
    
    // Жирный
    .replace(/<span[^>]*?style\s*=\s*["'][^"']*?font-weight\s*:\s*(bold|[6-9]00)[^"']*?["'][^>]*>(.*?)<\/span>/gi, '<b>$2</b>')
    
    // Преобразуем стандартные HTML теги в поддерживаемые форматы
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<b>$1</b>')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '<i>$1</i>')
    
    // Преобразуем блочные элементы
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
    .replace(/<br\s*\/?>/gi, '\n');
    
  // Удаляем все неподдерживаемые теги
  result = result.replace(/<(?!b|i|u|s|code|pre|a\b)[^>]+>/gi, '');
  
  return result;
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @param {boolean} autoFix Автоматически исправлять незакрытые теги
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html, autoFix = true) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Ошибка: не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в .env файле');
    process.exit(1);
  }
  
  try {
    console.log(`📤 Отправка HTML-сообщения в Telegram`);
    console.log(`📝 Длина исходного HTML: ${html.length} символов`);
    
    // Предварительная подготовка HTML
    let processedHtml = html;
    
    // Конвертируем HTML из редактора в поддерживаемый Telegram формат
    processedHtml = convertEditorToTelegram(processedHtml);
    
    // Если включено автоисправление, исправляем незакрытые теги
    if (autoFix) {
      processedHtml = fixUnclosedTags(processedHtml);
    }
    
    console.log(`✏️ Подготовленный HTML (первые 200 символов):`);
    console.log(processedHtml.substring(0, 200) + '...');
    
    // Отправляем сообщение через API Telegram
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: processedHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    );
    
    if (response.data && response.data.ok) {
      console.log(`✅ Сообщение успешно отправлено!`);
      console.log(`📊 ID сообщения: ${response.data.result.message_id}`);
      return response.data;
    } else {
      console.error(`❌ Ошибка при отправке:`, response.data);
      return response.data;
    }
  } catch (error) {
    console.error(`❌ Исключение при отправке:`, error.message);
    if (error.response) {
      console.error(`📊 Данные ответа:`, error.response.data);
    }
    throw error;
  }
}

/**
 * Отправляет контент из Directus в Telegram
 */
async function sendContentToTelegram() {
  console.log('=== Тест отправки HTML в Telegram ===');
  
  // Отправляем пример из скриншота
  try {
    console.log('\n🔄 Тестирование примера из скриншота...');
    await sendHtmlMessage(htmlExample);
    
    // Пауза между сообщениями для избежания ограничений API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Создаем еще один тест с разными форматами
    const testContent = `
<b>Тест форматирования Telegram</b>

<i>Текст курсивом</i>
<b>Текст жирным</b>
<u>Подчеркнутый текст</u>
<s>Зачеркнутый текст</s>
<code>Моноширинный текст</code>

<b><i>Комбинированный текст</i></b>

Разрыв
Строки

• Пункт списка 1
• Пункт списка 2
  • Вложенный пункт списка

<a href="https://telegram.org">Ссылка</a>

<span style="font-style: italic">Текст со стилем курсива из редактора</span>
`;
    
    console.log('\n🔄 Тестирование различных форматов...');
    await sendHtmlMessage(testContent);
    
    console.log('\n✅ Тестирование завершено успешно!');
  } catch (error) {
    console.error('\n❌ Тестирование завершено с ошибками!');
  }
}

// Запускаем тест
sendContentToTelegram();