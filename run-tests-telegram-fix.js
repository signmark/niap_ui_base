/**
 * Скрипт для тестирования исправленной версии форматирования HTML в Telegram
 * Запуск: node run-tests-telegram-fix.js
 */

import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен и chat_id из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Пример HTML для теста - это ваш реальный пример с форматированием
const exampleHtml = `<p><strong>Дорогие друзья!</strong> 🙌 Вы когда-нибудь задумывались о том, как похудеть без изнурительных диет и мучительных ограничений? Представьте себе <em>рацион</em>, который идеально подходит именно вам – <strong>вкусный</strong>, <u>сбалансированный </u>и при этом эффективный для снижения веса.</p><p>Индивидуальный подход к правильному питанию – вот ключ к успеху! 🔑 Забудьте о скучных диетах, которые заставляют вас чувствовать себя обделенными. Вместо этого наслаждайтесь разнообразными блюдами, специально подобранными с учетом ваших предпочтений, образа жизни и целей.</p><p>Каждый из нас уникален, и наши потребности в питании тоже индивидуальны. Поэтому пришло время отказаться от универсальных подходов и найти свой идеальный рацион. Доверьтесь профессионалам, которые помогут вам разработать план питания, соответствующий вашим вкусам и потребностям. 🍽️</p><p>Поделитесь своим опытом с индивидуальным подходом к питанию в комментариях! Расскажите, что помогло вам достичь успеха и какие советы вы можете дать другим. Вместе мы сможем поддержать друг друга на пути к здоровому образу жизни! 💪</p>`;

/**
 * Преобразует HTML из редактора в формат Telegram 
 * Эта функция - упрощенная версия основного конвертера
 */
function convertEditorHtmlToTelegram(html) {
  if (!html) return '';
  
  console.log(`Исходный HTML: ${html.substring(0, 100)}...`);
  
  try {
    // 1. Обработка блочных элементов
    let result = html
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n');
    
    console.log(`После обработки блочных элементов: ${result.substring(0, 100)}...`);
    
    // 2. Обработка форматирования текста
    result = result
      // Стандартные HTML-теги форматирования текста
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
      .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>')
      .replace(/<(s|strike|del)[^>]*>([\s\S]*?)<\/\1>/gi, '<s>$2</s>')
      
      // Обработка span с inline-стилями
      .replace(/<span[^>]*?style\s*=\s*["'][^"']*?font-style\s*:\s*italic[^"']*?["'][^>]*>([\s\S]*?)<\/span>/gi, '<i>$1</i>')
      .replace(/<span[^>]*?style\s*=\s*["'][^"']*?font-weight\s*:\s*(bold|[6-9]00)[^"']*?["'][^>]*>([\s\S]*?)<\/span>/gi, '<b>$2</b>')
      .replace(/<span[^>]*?style\s*=\s*["'][^"']*?text-decoration\s*:\s*underline[^"']*?["'][^>]*>([\s\S]*?)<\/span>/gi, '<u>$1</u>')
      .replace(/<span[^>]*?style\s*=\s*["'][^"']*?text-decoration\s*:\s*line-through[^"']*?["'][^>]*>([\s\S]*?)<\/span>/gi, '<s>$1</s>');
    
    console.log(`После обработки форматирования: ${result.substring(0, 100)}...`);
    
    // 3. Удаление всех остальных HTML-тегов
    result = result.replace(/<(?!\/?(?:b|i|u|s|code|pre|a)(?:\s|>))[^>]+>/gi, '');
    
    console.log(`После удаления остальных тегов: ${result.substring(0, 100)}...`);
    
    // 4. Проверка и исправление незакрытых тегов
    const tagStack = [];
    const processedResult = [];
    let inTag = false;
    let currentTag = '';
    let isClosing = false;
    
    for (let i = 0; i < result.length; i++) {
      const char = result[i];
      processedResult.push(char);
      
      if (char === '<' && result[i+1] !== '/') {
        // Открывающий тег
        inTag = true;
        currentTag = '';
        isClosing = false;
      } else if (char === '<' && result[i+1] === '/') {
        // Закрывающий тег
        inTag = true;
        currentTag = '';
        isClosing = true;
      } else if (char === '>' && inTag) {
        // Конец тега
        inTag = false;
        
        if (isClosing) {
          // Это закрывающий тег - проверяем соответствие
          const tagName = currentTag.replace('/', '').trim();
          if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
            // Правильно закрыт - удаляем из стека
            tagStack.pop();
          }
        } else {
          // Это открывающий тег - добавляем в стек
          const tagName = currentTag.split(' ')[0];
          if (['b', 'i', 'u', 's', 'code', 'pre', 'a'].includes(tagName)) {
            tagStack.push(tagName);
          }
        }
      } else if (inTag) {
        // Собираем имя тега
        currentTag += char;
      }
    }
    
    // Закрываем все оставшиеся открытые теги
    for (let i = tagStack.length - 1; i >= 0; i--) {
      processedResult.push(`</${tagStack[i]}>`);
      console.log(`Добавлен закрывающий тег: </${tagStack[i]}>`);
    }
    
    const finalResult = processedResult.join('');
    console.log(`Итоговый HTML: ${finalResult.substring(0, 100)}...`);
    
    return finalResult;
  } catch (error) {
    console.error(`Ошибка при преобразовании HTML: ${error.message}`);
    return html; // В случае ошибки возвращаем исходный HTML
  }
}

/**
 * Отправляет отформатированный HTML в Telegram
 */
async function sendFormattedHtmlToTelegram(html) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Ошибка: не заданы переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    return;
  }
  
  try {
    console.log('📤 Отправка форматированного HTML в Telegram...');
    
    // Преобразуем HTML из редактора в формат Telegram
    const telegramHtml = convertEditorHtmlToTelegram(html);
    
    // Отправляем запрос к API Telegram
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
      console.log('✅ Сообщение успешно отправлено в Telegram!');
      console.log(`📊 ID сообщения: ${response.data.result.message_id}`);
      return response.data;
    } else {
      console.error('❌ Ошибка при отправке в Telegram:', response.data);
      return response.data;
    }
  } catch (error) {
    console.error('❌ Исключение при отправке в Telegram:', error.message);
    if (error.response) {
      console.error('📊 Данные ответа:', error.response.data);
    }
    throw error;
  }
}

/**
 * Запускает тестирование форматирования HTML для Telegram
 */
async function runTest() {
  console.log('=== Тестирование улучшенного форматирования HTML для Telegram ===');
  
  try {
    // Тестируем пример с реальным форматированием
    console.log('\n📋 Тестирование реального примера с форматированием...');
    await sendFormattedHtmlToTelegram(exampleHtml);
    
    console.log('\n✅ Тестирование завершено успешно!');
  } catch (error) {
    console.error('\n❌ Тестирование завершено с ошибками:', error.message);
  }
}

// Запускаем тест
runTest();