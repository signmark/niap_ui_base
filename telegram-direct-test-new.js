/**
 * Прямой тест отправки HTML-сообщения в Telegram с новым очистителем HTML
 * Запуск: node telegram-direct-test-new.js
 */

require('dotenv').config();
const axios = require('axios');
const { cleanHtmlForTelegram } = require('./server/utils/telegram-html-cleaner-new');

// Получаем секреты из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Проверка наличия всех необходимых секретов
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('\x1b[31mОшибка: Отсутствуют необходимые переменные окружения\x1b[0m');
  console.log(`TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? 'Установлен' : 'Отсутствует'}`);
  console.log(`TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID ? 'Установлен' : 'Отсутствует'}`);
  process.exit(1);
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @param {boolean} cleaned Очищен ли текст заранее
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html, cleaned = false) {
  try {
    // Если текст еще не очищен, очищаем его
    const textToSend = cleaned ? html : cleanHtmlForTelegram(html);
    
    console.log('\x1b[33mОтправляемый текст:\x1b[0m', textToSend);
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: textToSend,
      parse_mode: 'HTML'
    };
    
    const response = await axios.post(url, payload);
    console.log('\x1b[32mОтправка успешна:\x1b[0m', response.data.ok);
    return response.data;
  } catch (error) {
    console.error('\x1b[31mОшибка при отправке сообщения:\x1b[0m', error.response?.data || error.message);
    return error.response?.data || { ok: false, description: error.message };
  }
}

/**
 * Запускает тест с реальным случаем, которому нужна очистка
 */
async function runTest() {
  console.log('\x1b[36m===== ТЕСТ НОВОГО ОЧИСТИТЕЛЯ HTML ДЛЯ TELEGRAM =====\x1b[0m');
  
  const originalHtml = `<p><strong>Разработка сбалансированного и индивидуализированного рациона питания</strong> – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <em>инновационному онлайн-сервису для составления персонализированных планов питания</em> эта задача стала значительно проще.</p>

<p>Наш сервис использует <strong>передовые алгоритмы анализа данных</strong> для создания идеального рациона, полностью соответствующего вашим индивидуальным потребностям. Независимо от ваших целей – снижение веса, наращивание мышечной массы или поддержание здорового баланса – наш сервис поможет их достичь <em>максимально эффективным и безопасным способом</em>.</p>

<p>Одно из <strong>ключевых преимуществ нашего сервиса</strong> – возможность для медицинских специалистов, таких как врачи и диетологи, осуществлять <em>удаленный мониторинг питания своих клиентов в режиме реального времени</em>. Это позволяет отслеживать прогресс, своевременно корректировать рацион и предоставлять рекомендации, экономя время и ресурсы.</p>

<p>Мы приглашаем вас опробовать наш сервис и убедиться в его эффективности. Будем рады получить вашу <strong>обратную связь и отзывы</strong>, которые помогут нам продолжать совершенствовать наше предложение. Вместе мы сделаем путь к здоровому образу жизни более простым и увлекательным.</p>`;
  
  console.log('\x1b[36m----- Исходный HTML -----\x1b[0m');
  console.log(originalHtml);
  
  console.log('\x1b[36m----- Очищенный HTML -----\x1b[0m');
  const cleanedHtml = cleanHtmlForTelegram(originalHtml);
  console.log(cleanedHtml);
  
  console.log('\x1b[36m----- Отправка сообщения в Telegram -----\x1b[0m');
  const result = await sendHtmlMessage(originalHtml);
  
  if (result.ok) {
    console.log('\x1b[32mТест успешно пройден!\x1b[0m');
  } else {
    console.error('\x1b[31mТест провален!\x1b[0m');
  }
}

// Запускаем тест
runTest();