/**
 * Тест для проверки обработки HTML-списков в Telegram
 * Скрипт проверяет корректное отображение списков ul/li в сообщениях Telegram
 * 
 * Запуск: node telegram-html-lists-test.js
 */

// Импортируем необходимые модули
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
import { log } from './server/utils/logger.js';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен и ID чата из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Тестовые случаи
const testHtml = `
<p><strong>В ходе предыдущей дискуссии</strong> <em>мы рассмотрели причины</em>, по которым завтрак является наиважнейшим приемом пищи, и его влияние на энергетический баланс, метаболические процессы и контроль аппетита. 🌞</p>

<p>В настоящий момент представляется целесообразным проанализировать роль перекусов, поскольку они могут как благоприятно воздействовать на состояние здоровья 🏋️‍♀️, так и незаметно наносить вред фигуре и самочувствию. 🍕</p>

<p><strong>Следует, однако, осознавать, что не все перекусы одинаково полезны. ⚠️</strong> К нежелательным перекусам относятся кондитерские изделия, выпечка, чипсы и прочие продукты фастфуда. 🍩</p>

<p><em>Полезными перекусами являются те, которые обеспечивают чувство насыщения, стабильный энергетический баланс и поступление питательных веществ. 🥗</em></p>

<p><strong>Рекомендации по правильному перекусыванию: 📝</strong></p>

<ul>
    <li>Отдавайте предпочтение перекусам, содержащим белок, полезные жиры и клетчатку – они дольше обеспечивают чувство насыщения и поддерживают обмен веществ. 💪</li>
    <li>Не употребляйте пищу автоматически – перекус необходим, если вы действительно испытываете легкое чувство голода, а не просто по привычке или от скуки. 🤔</li>
    <li>Контролируйте размер порции – умеренное количество орехов полезно, но если съесть полпакета, это уже станет полноценным приемом пищи. 🥜</li>
</ul>

<p>Если вы стремитесь разобраться в вопросах здорового питания, присоединяйтесь к нашему марафону на нашем телеграм-канале. 📲</p>`;

/**
 * Преобразует стандартные HTML-теги в теги, поддерживаемые Telegram
 * @param {string} html HTML-текст для преобразования
 * @returns {string} Преобразованный HTML-текст
 */
function formatForTelegram(html) {
  let formatted = html
    // Замена стандартных тегов на поддерживаемые Telegram
    .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<b>(.*?)<\/b>/g, '<b>$1</b>')
    .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
    .replace(/<i>(.*?)<\/i>/g, '<i>$1</i>')
    .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
    .replace(/<s>(.*?)<\/s>/g, '<s>$1</s>')
    .replace(/<del>(.*?)<\/del>/g, '<s>$1</s>')
    .replace(/<code>(.*?)<\/code>/g, '<code>$1</code>')
    .replace(/<pre>(.*?)<\/pre>/g, '<pre>$1</pre>')
    .replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/g, '<a href="$1">$2</a>');
  
  // Обработка списков
  formatted = formatted.replace(/<ul>([\s\S]*?)<\/ul>/g, function(match, listContent) {
    const items = listContent.match(/<li>([\s\S]*?)<\/li>/g);
    if (!items) return match;
    
    return items.map(item => {
      const content = item.replace(/<li>([\s\S]*?)<\/li>/, '$1').trim();
      return `• ${content}\n`;
    }).join('');
  });
  
  // Удаление параграфов (заменяем на новую строку)
  formatted = formatted.replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n');
  
  // Удаление всех оставшихся HTML-тегов
  formatted = formatted.replace(/<[^>]*>/g, '');
  
  // Удаление лишних переносов строк
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  return formatted.trim();
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error('Не заданы токен бота или ID чата в переменных окружения');
    }
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    // Форматируем HTML для Telegram
    const formattedText = formatForTelegram(html);
    
    const params = {
      chat_id: TELEGRAM_CHAT_ID,
      text: formattedText,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    
    log(`Отправка HTML-сообщения в Telegram...`, 'test');
    const response = await axios.post(url, params);
    
    if (response.data.ok) {
      const messageId = response.data.result.message_id;
      let messageUrl = '';
      
      // Если ID чата начинается с -100, это канал или супергруппа
      if (String(TELEGRAM_CHAT_ID).startsWith('-100')) {
        const chatId = String(TELEGRAM_CHAT_ID).replace('-100', '');
        messageUrl = `https://t.me/c/${chatId}/${messageId}`;
      } else {
        // Получаем информацию о чате для создания URL
        const chatInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`;
        const chatInfoParams = { chat_id: TELEGRAM_CHAT_ID };
        const chatInfoResponse = await axios.post(chatInfoUrl, chatInfoParams);
        
        if (chatInfoResponse.data.ok && chatInfoResponse.data.result.username) {
          messageUrl = `https://t.me/${chatInfoResponse.data.result.username}/${messageId}`;
        }
      }
      
      log(`Сообщение успешно отправлено в Telegram, ID: ${messageId}`, 'test');
      log(`URL сообщения: ${messageUrl}`, 'test');
      
      return {
        success: true,
        messageId,
        messageUrl,
        result: response.data.result
      };
    } else {
      throw new Error(`Telegram API error: ${response.data.description}`);
    }
  } catch (error) {
    log(`Ошибка при отправке HTML в Telegram: ${error.message}`, 'test');
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Отправляет запрос к API приложения для публикации HTML в Telegram
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат публикации
 */
async function testAppAPI(html) {
  try {
    // URL API приложения (использует существующий маршрут raw-html-telegram)
    const apiUrl = 'http://localhost:5000/api/test/raw-html-telegram';
    
    // Данные для отправки
    const payload = {
      text: html,
      autoFixHtml: true
    };
    
    log(`Отправка запроса к API приложения...`, 'test');
    const response = await axios.post(apiUrl, payload);
    
    log(`Ответ от API: ${JSON.stringify(response.data)}`, 'test');
    
    return response.data;
  } catch (error) {
    log(`Ошибка при обращении к API приложения: ${error.message}`, 'test');
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Основная функция для проведения тестов
 */
async function runTests() {
  try {
    console.log('\n========== ТЕСТ ОБРАБОТКИ HTML-СПИСКОВ В TELEGRAM ==========\n');
    
    // Прямая отправка HTML через Telegram Bot API
    console.log('\n----- Тест 1: Прямая отправка через Telegram Bot API -----\n');
    const directResult = await sendHtmlMessage(testHtml);
    
    if (directResult.success) {
      console.log(`✅ Тест 1 успешно выполнен. URL сообщения: ${directResult.messageUrl}`);
    } else {
      console.log(`❌ Тест 1 не выполнен: ${directResult.error}`);
    }
    
    // Небольшая пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Отправка через API приложения
    console.log('\n----- Тест 2: Отправка через API приложения -----\n');
    const apiResult = await testAppAPI(testHtml);
    
    if (apiResult.success) {
      console.log(`✅ Тест 2 успешно выполнен. URL сообщения: ${apiResult.postUrl || apiResult.messageUrl}`);
    } else {
      console.log(`❌ Тест 2 не выполнен: ${apiResult.error}`);
    }
    
    console.log('\n========== ТЕСТЫ ЗАВЕРШЕНЫ ==========\n');
  } catch (error) {
    console.error('Ошибка в процессе выполнения тестов:', error);
  }
}

// Запускаем тесты
runTests();