/**
 * Тестовый скрипт для проверки HTML-форматирования в Telegram сообщениях
 * Проверяет корректность отображения различных HTML-тегов
 */
import { config } from 'dotenv';
import axios from 'axios';

config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Функция для тестирования HTML форматирования в Telegram
async function testHtmlFormatting() {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Ошибка: не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в .env файле');
      return;
    }
    
    // Текст с различными HTML-тегами для тестирования
    const testText = `
<b>Жирный текст</b>
<i>Курсивный текст</i>
<u>Подчеркнутый текст</u>
<s>Зачеркнутый текст</s>
<code>Моноширинный текст для кода</code>
<a href="https://example.com">Ссылка на сайт</a>

Комбинированное форматирование:
<b><i>Жирный курсив</i></b>
<b><u>Жирный подчеркнутый</u></b>
<i><s>Курсивный зачеркнутый</s></i>

<b>Заголовок статьи</b>

<i>Описание и важные детали об этой интересной статье. Могут быть разные аспекты, которые нужно выделить.</i>

Основной текст статьи, несколько абзацев обычного текста.
В котором могут быть <b>выделенные части</b> и <i>важные моменты</i>.

<a href="https://t.me/ya_delayu_moschno">Наш канал</a>
`;
    
    console.log(`Отправка HTML-форматированного сообщения в чат: ${TELEGRAM_CHAT_ID}`);
    
    // Отправка сообщения с HTML-форматированием
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: testText,
      parse_mode: 'HTML'
    });
    
    if (response.status === 200 && response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      console.log(`Сообщение успешно отправлено, ID: ${messageId}`);
      
      // Получаем информацию о чате для определения username
      const chatInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`;
      const chatResponse = await axios.post(chatInfoUrl, { chat_id: TELEGRAM_CHAT_ID });
      
      if (chatResponse.status === 200 && chatResponse.data && chatResponse.data.ok) {
        const chatInfo = chatResponse.data.result;
        const chatUsername = chatInfo.username;
        
        // Формируем URL сообщения с использованием username
        const messageUrl = chatUsername 
          ? `https://t.me/${chatUsername}/${messageId}`
          : `https://t.me/c/${TELEGRAM_CHAT_ID.replace('-100', '')}/${messageId}`;
        
        console.log('=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ HTML-ФОРМАТИРОВАНИЯ ===');
        console.log(`ID сообщения: ${messageId}`);
        console.log(`URL сообщения: ${messageUrl}`);
        console.log(`Имя канала: ${chatInfo.title}`);
        console.log(`Username канала: ${chatUsername || 'не указан'}`);
        console.log('Для просмотра HTML-форматирования перейдите по URL сообщения');
        
        return {
          success: true,
          messageId,
          messageUrl,
          chatInfo
        };
      } else {
        console.error('Ошибка при получении информации о чате:', chatResponse.data);
        return { success: false, error: 'Ошибка получения информации о чате' };
      }
    } else {
      console.error('Ошибка при отправке сообщения:', response.data);
      return { success: false, error: 'Ошибка отправки сообщения' };
    }
  } catch (error) {
    console.error('Исключение при выполнении теста:', error.message);
    return { success: false, error: error.message };
  }
}

// Запуск тестирования
testHtmlFormatting()
  .then(result => {
    if (result.success) {
      console.log('Тест успешно завершен!');
    } else {
      console.log('Тест завершился с ошибкой:', result.error);
    }
  })
  .catch(error => {
    console.error('Неожиданная ошибка при выполнении теста:', error.message);
  });