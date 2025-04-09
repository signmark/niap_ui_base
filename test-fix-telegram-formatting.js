/**
 * Тест для исправления форматирования HTML в Telegram
 * Запуск: node test-fix-telegram-formatting.js
 * 
 * Этот скрипт тестирует преобразование HTML из редактора в формат,
 * который корректно отображается в Telegram
 */

import dotenv from 'dotenv';
import axios from 'axios';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен и chat_id из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// HTML из редактора, который нужно отправить в Telegram
const htmlFromEditor = `<p><strong>Дорогие друзья!</strong> 🙌 Вы когда-нибудь задумывались о том, как похудеть без изнурительных диет и мучительных ограничений? Представьте себе <em>рацион</em>, который идеально подходит именно вам – <strong>вкусный</strong>, <u>сбалансированный </u>и при этом эффективный для снижения веса.</p><p>Индивидуальный подход к правильному питанию – вот ключ к успеху! 🔑 Забудьте о скучных диетах, которые заставляют вас чувствовать себя обделенными. Вместо этого наслаждайтесь разнообразными блюдами, специально подобранными с учетом ваших предпочтений, образа жизни и целей.</p><p>Каждый из нас уникален, и наши потребности в питании тоже индивидуальны. Поэтому пришло время отказаться от универсальных подходов и найти свой идеальный рацион. Доверьтесь профессионалам, которые помогут вам разработать план питания, соответствующий вашим вкусам и потребностям. 🍽️</p><p>Поделитесь своим опытом с индивидуальным подходом к питанию в комментариях! Расскажите, что помогло вам достичь успеха и какие советы вы можете дать другим. Вместе мы сможем поддержать друг друга на пути к здоровому образу жизни! 💪</p>`;

/**
 * Усовершенствованный конвертер HTML из редактора в формат Telegram
 * @param {string} html HTML из редактора
 * @returns {string} HTML для Telegram
 */
function improvedHtmlConverter(html) {
  if (!html) return '';
  
  console.log("Исходный HTML:", html.substring(0, 100) + "...");
  
  try {
    // ЭТАП 1: Предварительная обработка данных
    console.log("Начинаем преобразование HTML в формат Telegram...");
    
    // Заменяем все блочные элементы на более простые конструкции с переносами строк
    let processedHtml = html
      // Заменяем параграфы на их содержимое с двойным переносом строки
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
      
      // Заменяем div на их содержимое с переносом строки
      .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
      
      // Заменяем заголовки на жирный текст
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n')
      
      // Заменяем переносы строк br на \n
      .replace(/<br\s*\/?>/gi, '\n');
    
    console.log("После обработки блочных элементов:", processedHtml.substring(0, 100) + "...");
    
    // ЭТАП 2: Специфическая обработка тегов форматирования
    
    // Замена <strong> на <b>
    processedHtml = processedHtml
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>');
    
    // Замена <em> на <i>
    processedHtml = processedHtml
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>');
    
    // Обработка <u> (подчеркнутый текст)
    processedHtml = processedHtml
      .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
    
    // Обработка <s> или <strike> (зачеркнутый текст)
    processedHtml = processedHtml
      .replace(/<(s|strike)[^>]*>([\s\S]*?)<\/\1>/gi, '<s>$2</s>');
    
    // Обработка <code> (моноширинный текст)
    processedHtml = processedHtml
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '<code>$1</code>');
    
    // Обработка <a> (ссылки) - сохраняем только href атрибут
    processedHtml = processedHtml
      .replace(/<a[^>]*href=["'](.*?)["'][^>]*>([\s\S]*?)<\/a>/gi, '<a href="$1">$2</a>');
    
    console.log("После обработки тегов форматирования:", processedHtml.substring(0, 100) + "...");
    
    // ЭТАП 3: Удаление всех оставшихся HTML-тегов
    // Оставляем только поддерживаемые Telegram теги: b, i, u, s, strike, code, pre, a
    processedHtml = processedHtml
      .replace(/<(?!\/?(?:b|i|u|s|strike|code|pre|a)(?:\s|>))[^>]+>/gi, '');
    
    console.log("После удаления неподдерживаемых тегов:", processedHtml.substring(0, 100) + "...");
    
    // ЭТАП 4: Исправляем проблемы с вложенными тегами и незакрытыми тегами
    // В Telegram HTML не поддерживает вложенные теги одного типа
    
    // Проверяем на незакрытые теги
    const tagMatch = processedHtml.match(/<([a-z]+)[^>]*>/ig) || [];
    const closeTagMatch = processedHtml.match(/<\/([a-z]+)[^>]*>/ig) || [];
    
    const openTags = tagMatch.map(tag => tag.match(/<([a-z]+)/i)[1].toLowerCase());
    const closeTags = closeTagMatch.map(tag => tag.match(/<\/([a-z]+)/i)[1].toLowerCase());
    
    console.log(`Открывающих тегов: ${openTags.length}, закрывающих тегов: ${closeTags.length}`);
    
    // Если есть незакрытые теги, добавляем закрывающие
    if (openTags.length > closeTags.length) {
      console.log("Обнаружены незакрытые теги, добавляем закрывающие теги...");
      
      // Создаем стек для отслеживания открытых тегов
      const stack = [];
      for (let i = 0; i < processedHtml.length; i++) {
        if (processedHtml.substring(i, i+1) === '<' &&
            processedHtml.substring(i, i+2) !== '</') {
          // Открывающий тег
          const endTagPos = processedHtml.indexOf('>', i);
          if (endTagPos !== -1) {
            const tag = processedHtml.substring(i+1, endTagPos).split(' ')[0].toLowerCase();
            if (['b', 'i', 'u', 's', 'code', 'pre', 'a'].includes(tag)) {
              stack.push(tag);
            }
          }
        } else if (processedHtml.substring(i, i+2) === '</') {
          // Закрывающий тег
          const endTagPos = processedHtml.indexOf('>', i);
          if (endTagPos !== -1) {
            const tag = processedHtml.substring(i+2, endTagPos).toLowerCase();
            // Ищем в стеке этот тег и удаляем его
            const index = stack.lastIndexOf(tag);
            if (index !== -1) {
              stack.splice(index, 1);
            }
          }
        }
      }
      
      // Добавляем закрывающие теги для всех оставшихся открытых тегов
      for (let i = stack.length - 1; i >= 0; i--) {
        processedHtml += `</${stack[i]}>`;
      }
      
      console.log(`Добавлено ${stack.length} закрывающих тегов`);
    }
    
    console.log("Итоговый HTML для Telegram:", processedHtml.substring(0, 100) + "...");
    return processedHtml;
  } catch (error) {
    console.error("Ошибка при конвертации HTML:", error);
    return html; // В случае ошибки возвращаем исходный HTML
  }
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML для отправки
 */
async function sendToTelegram(html) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("Ошибка: не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID");
    return;
  }
  
  try {
    console.log("Отправляем сообщение в Telegram...");
    
    // Конвертируем HTML в формат Telegram
    const telegramHtml = improvedHtmlConverter(html);
    
    // Отправляем через API Telegram
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    );
    
    if (response.data && response.data.ok) {
      console.log("Сообщение успешно отправлено!");
      console.log("ID сообщения:", response.data.result.message_id);
    } else {
      console.error("Ошибка при отправке:", response.data);
    }
  } catch (error) {
    console.error("Исключение при отправке:", error.message);
    if (error.response) {
      console.error("Данные ответа:", error.response.data);
    }
  }
}

// Запускаем тест
sendToTelegram(htmlFromEditor);