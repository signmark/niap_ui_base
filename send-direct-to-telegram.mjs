/**
 * Скрипт для прямой отправки HTML-сообщения в Telegram с использованием очистителя HTML
 * Запуск: node send-direct-to-telegram.mjs
 */

import axios from 'axios';
import { cleanHtmlForTelegram } from './server/utils/telegram-html-cleaner-new.js';

// Пример HTML-контента для публикации
const htmlContent = `<p><strong>Разработка сбалансированного и индивидуализированного рациона питания</strong> – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <em>инновационному онлайн-сервису для составления персонализированных планов питания</em> эта задача стала значительно проще.</p>

<p>Наш сервис использует <strong>передовые алгоритмы анализа данных</strong> для создания идеального рациона, полностью соответствующего вашим индивидуальным потребностям. Независимо от ваших целей – снижение веса, наращивание мышечной массы или поддержание здорового баланса – наш сервис поможет их достичь <em>максимально эффективным и безопасным способом</em>.</p>

<p>Одно из <strong>ключевых преимуществ нашего сервиса</strong> – возможность для медицинских специалистов, таких как врачи и диетологи, осуществлять <em>удаленный мониторинг питания своих клиентов в режиме реального времени</em>. Это позволяет отслеживать прогресс, своевременно корректировать рацион и предоставлять рекомендации, экономя время и ресурсы.</p>

<p>Мы приглашаем вас опробовать наш сервис и убедиться в его эффективности. Будем рады получить вашу <strong>обратную связь и отзывы</strong>, которые помогут нам продолжать совершенствовать наше предложение. Вместе мы сделаем путь к здоровому образу жизни более простым и увлекательным.</p>`;

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  try {
    // Получаем токен и ID чата из переменных окружения
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) {
      throw new Error('Необходимо указать TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменных окружения');
    }
    
    console.log('=== ИСХОДНЫЙ HTML ===');
    console.log(html);
    
    // Очищаем HTML для Telegram
    const cleanedHtml = cleanHtmlForTelegram(html);
    
    console.log('\n=== ОЧИЩЕННЫЙ HTML ДЛЯ TELEGRAM ===');
    console.log(cleanedHtml);
    
    // Отправляем сообщение в Telegram
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: cleanedHtml,
        parse_mode: 'HTML'
      }
    );
    
    console.log('\n=== ОТВЕТ ОТ API TELEGRAM ===');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error.message);
    if (error.response) {
      console.error('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

// Запускаем отправку
sendHtmlMessage(htmlContent);