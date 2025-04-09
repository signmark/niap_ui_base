/**
 * Скрипт для тестирования отправки поста с HTML-форматированием в Telegram
 * Использует исправленную функцию standardizeTelegramTags из telegram-service.js
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен и chatId из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Форматирует HTML для Telegram
 */
function processTelegramHtml(html) {
  // Сначала обработаем p-теги
  let result = html
    .replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1\n\n')
    .replace(/<\/?p[^>]*>/g, ''); // Удаляем любые незакрытые или оставшиеся p теги
  
  // Обрабатываем вложенные списки
  result = result.replace(/<ul>([\s\S]*?)<\/ul>/g, function(match, listContent) {
    // Заменяем каждый li элемент на строку с маркером
    const formattedList = listContent
      .replace(/<li>([\s\S]*?)<\/li>/g, '\n• $1')
      .replace(/<\/?li[^>]*>/g, '') // Удаляем любые незакрытые li теги
      .trim();
    
    return '\n' + formattedList + '\n';
  });
  
  // Удаляем любые оставшиеся ul/li теги
  result = result
    .replace(/<\/?ul[^>]*>/g, '')
    .replace(/<\/?li[^>]*>/g, '');
    
  // Заменяем стандартные HTML-теги на Telegram-совместимые
  result = result
    .replace(/<strong>([\s\S]*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<em>([\s\S]*?)<\/em>/g, '<i>$1</i>');
    
  // Удаляем другие HTML-теги, которые не поддерживаются в Telegram
  result = result
    .replace(/<(?!\/?(b|i|u|s|code|pre|a)(?=>|\s.*>))[^>]*>/g, '');
  
  return result;
}

/**
 * Отправляет сообщение с HTML-форматированием в Telegram
 */
async function sendTelegramHtmlMessage(html) {
  try {
    console.log('Отправка сообщения в Telegram');
    
    const processedHtml = processTelegramHtml(html);
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    console.log('Исходный HTML:');
    console.log(html.substring(0, 300) + (html.length > 300 ? '...' : ''));
    
    console.log('\nОбработанный HTML:');
    console.log(processedHtml.substring(0, 300) + (processedHtml.length > 300 ? '...' : ''));
    
    const params = {
      chat_id: TELEGRAM_CHAT_ID,
      text: processedHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    
    const response = await axios.post(url, params);
    
    if (response.data.ok) {
      const messageId = response.data.result.message_id;
      console.log(`\nСообщение успешно отправлено с ID: ${messageId}`);
      
      // Генерируем URL сообщения для приватного канала
      if (TELEGRAM_CHAT_ID.startsWith('-100')) {
        const channelId = TELEGRAM_CHAT_ID.substring(4);
        console.log(`URL сообщения: https://t.me/c/${channelId}/${messageId}`);
      }
      
      return response.data.result;
    } else {
      throw new Error(`Telegram API error: ${response.data.description}`);
    }
  } catch (error) {
    console.error('Ошибка при отправке сообщения:');
    console.error(error.message);
    if (error.response) {
      console.error('Ответ сервера:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Основная функция
 */
async function main() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Не найдены переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    return;
  }
  
  // Тестовый HTML пост с заголовком, списками и форматированием
  const testPost = `
<p><strong>Цифровые продукты:</strong> основы создания и продвижения</p>
<p>Цифровой продукт — это электронный товар, созданный для удовлетворения потребностей пользователя. Для успешного запуска необходимо:</p>
<ul>
  <li>Определить целевую аудиторию</li>
  <li>Создать ценностное предложение</li>
  <li>Разработать прототип</li>
  <li>Провести тестирование</li>
  <li>Настроить каналы продвижения</li>
</ul>
<p>Примеры цифровых продуктов:</p>
<ul>
  <li><strong>Приложения:</strong> мобильные и веб-сервисы</li>
  <li><strong>Информационные товары:</strong> курсы, книги, чек-листы</li>
  <li><strong>Доступ к данным:</strong> API, базы данных</li>
</ul>
<p>Эффективная монетизация возможна через подписку, разовые продажи или смешанную модель.</p>
  `;
  
  await sendTelegramHtmlMessage(testPost);
}

// Запускаем основную функцию
main().catch(console.error);