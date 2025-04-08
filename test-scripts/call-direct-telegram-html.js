/**
 * Скрипт для тестирования прямой отправки HTML-текста в Telegram без дополнительной обработки
 */
const axios = require('axios');
require('dotenv').config();

async function testDirectTelegramHtml() {
  // Получаем переменные окружения
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.error('Ошибка: необходимо указать TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env файле');
    process.exit(1);
  }
  
  // Тестовый HTML-текст
  const testText = `
<b>Жирный текст</b>
<i>Курсивный текст</i>
<u>Подчеркнутый текст</u>
<s>Зачеркнутый текст</s>
<code>Моноширинный текст</code>
<a href="https://example.com">Ссылка на сайт</a>

<b><i>Жирный курсив</i></b>
  `;
  
  try {
    // Отправляем запрос к нашему API-маршруту для прямой отправки в Telegram
    console.log('Отправка запроса к API...');
    const response = await axios.post('http://localhost:3000/api/test/direct-telegram-html', {
      text: testText,
      token,
      chatId
    });
    
    console.log('Ответ:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ Сообщение успешно отправлено с ID:', response.data.message_id);
    } else {
      console.error('❌ Ошибка при отправке:', response.data.error);
    }
  } catch (error) {
    console.error('❌ Ошибка при выполнении запроса:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
  }
}

// Выполняем тест
testDirectTelegramHtml();
