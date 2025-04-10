/**
 * Скрипт для тестирования отправки HTML-форматированного текста в Telegram
 * с использованием оптимизированного метода из TelegramService
 */
const axios = require('axios');
require('dotenv').config();

async function testRawHtmlTelegram() {
  // Получаем переменные окружения
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.error('Ошибка: необходимо указать TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env файле');
    process.exit(1);
  }
  
  // Тестовый HTML-текст с включением всех поддерживаемых тегов
  const testText = `
<b>Жирный текст</b>
<i>Курсивный текст</i>
<u>Подчеркнутый текст</u>
<s>Зачеркнутый текст</s>
<code>Моноширинный текст</code>
<a href="https://example.com">Ссылка на сайт</a>

<b><i>Вложенные теги: жирный курсив</i></b>
<b><u>Вложенные теги: жирный подчеркнутый</u></b>
<i><s>Вложенные теги: курсив зачеркнутый</s></i>

Пример с эмодзи: 🎉 🚀 🔥

<pre>
Блок кода
с сохранением
    форматирования
</pre>

<b>Списки:</b>
• Пункт 1
• Пункт 2
• Пункт 3
`;
  
  try {
    // Отправляем запрос к нашему API-маршруту
    console.log('Отправка запроса к API /api/test/raw-html-telegram...');
    const response = await axios.post('http://localhost:3000/api/test/raw-html-telegram', {
      text: testText,
      token,
      chatId
    });
    
    console.log('Ответ:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ Сообщение успешно отправлено!');
      console.log(`📝 ID сообщения: ${response.data.message_id}`);
      console.log(`🔗 URL сообщения: ${response.data.message_url}`);
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
testRawHtmlTelegram();
