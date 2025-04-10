/**
 * Тест отправки сообщения в Telegram с прямыми HTML-тегами Telegram
 * Запуск: node direct-send-telegram-tags.js
 */

import dotenv from 'dotenv';
import axios from 'axios';

// Загружаем переменные окружения
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Пример текста с прямыми тегами Telegram
const telegramDirectHtml = `<b>Дорогие друзья!</b> 🙌 Вы когда-нибудь задумывались о том, как похудеть без изнурительных диет и мучительных ограничений? Представьте себе <i>рацион</i>, который идеально подходит именно вам – <b>вкусный</b>, <u>сбалансированный </u>и при этом эффективный для снижения веса.

Индивидуальный подход к правильному питанию – вот ключ к успеху! 🔑 Забудьте о скучных диетах, которые заставляют вас чувствовать себя обделенными. Вместо этого наслаждайтесь разнообразными блюдами, специально подобранными с учетом ваших предпочтений, образа жизни и целей.

Каждый из нас уникален, и наши потребности в питании тоже индивидуальны. Поэтому пришло время отказаться от универсальных подходов и найти свой идеальный рацион. Доверьтесь профессионалам, которые помогут вам разработать план питания, соответствующий вашим вкусам и потребностям. 🍽️

Поделитесь своим опытом с индивидуальным подходом к питанию в комментариях! Расскажите, что помогло вам достичь успеха и какие советы вы можете дать другим. Вместе мы сможем поддержать друг друга на пути к здоровому образу жизни! 💪`;

/**
 * Функция для проверки и сохранения незакрытых тегов
 * @param {string} html HTML-текст для проверки
 * @returns {string} Исправленный HTML-текст
 */
function checkAndFixTags(html) {
  const tagStack = [];
  let result = '';
  
  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    
    // Проверяем начало открывающего тега
    if (char === '<' && html[i+1] !== '/') {
      // Ищем конец тега
      const endTagPos = html.indexOf('>', i);
      if (endTagPos !== -1) {
        const tagContent = html.substring(i+1, endTagPos);
        const tagName = tagContent.split(' ')[0];
        
        // Проверяем, является ли это поддерживаемым тегом
        if (['b', 'i', 'u', 's', 'code', 'pre', 'a'].includes(tagName)) {
          tagStack.push(tagName);
        }
      }
    }
    // Проверяем начало закрывающего тега
    else if (char === '<' && html[i+1] === '/') {
      // Ищем конец тега
      const endTagPos = html.indexOf('>', i);
      if (endTagPos !== -1) {
        const tagName = html.substring(i+2, endTagPos);
        
        // Проверяем, соответствует ли закрывающий тег последнему открывающему
        if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
          tagStack.pop();
        }
      }
    }
    
    result += char;
  }
  
  // Если остались незакрытые теги, закрываем их
  if (tagStack.length > 0) {
    console.log(`Обнаружены незакрытые теги: ${tagStack.join(', ')}`);
    
    // Закрываем теги в обратном порядке
    for (let i = tagStack.length - 1; i >= 0; i--) {
      result += `</${tagStack[i]}>`;
      console.log(`Добавлен закрывающий тег: </${tagStack[i]}>`);
    }
  }
  
  return result;
}

/**
 * Отправляет сообщение в Telegram с прямыми HTML-тегами
 */
async function sendDirectTagsToTelegram() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Ошибка: не заданы переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    process.exit(1);
  }
  
  try {
    console.log('Отправка сообщения с прямыми HTML-тегами Telegram...');
    
    // Проверяем и исправляем незакрытые теги
    const checkedHtml = checkAndFixTags(telegramDirectHtml);
    
    // Отправляем запрос
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: checkedHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    );
    
    if (response.data && response.data.ok) {
      console.log('Сообщение успешно отправлено!');
      console.log(`ID сообщения: ${response.data.result.message_id}`);
    } else {
      console.error('Ошибка при отправке:', response.data);
    }
  } catch (error) {
    console.error('Исключение при отправке:', error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
  }
}

// Запускаем тест
sendDirectTagsToTelegram();