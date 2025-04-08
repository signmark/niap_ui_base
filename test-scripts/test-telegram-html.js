/**
 * Тестовый скрипт для прямой проверки HTML-форматирования в Telegram
 */
const axios = require('axios');
require('dotenv').config();

async function sendFormattedMessage() {
  // Укажите токен и chatId из вашей кампании или используйте переменные окружения
  const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
  const chatId = process.env.TELEGRAM_CHAT_ID || 'YOUR_TELEGRAM_CHAT_ID';
  
  // Тестовое сообщение с HTML-форматированием
  const message = `
<b>Заголовок жирным текстом</b>

<i>Курсивный текст</i> и <u>подчеркнутый текст</u>

<b><i>Жирный курсив</i></b> и <s>зачеркнутый</s>

<a href="https://example.com">Ссылка на сайт</a>

<code>Моноширинный текст</code>
  `;
  
  console.log(`Отправляем тестовое сообщение с HTML-форматированием:`);
  console.log(message);
  
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'  // Важный параметр для включения HTML-форматирования
    });
    
    console.log('Ответ от Telegram API:', response.data);
    if (response.data.ok) {
      console.log('Сообщение успешно отправлено с ID:', response.data.result.message_id);
    } else {
      console.error('Ошибка при отправке:', response.data.description);
    }
  } catch (error) {
    console.error('Ошибка при выполнении запроса:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
  }
}

// Запускаем тест
sendFormattedMessage();
