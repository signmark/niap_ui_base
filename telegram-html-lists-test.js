/**
 * Тест форматирования списков для Telegram с использованием функций из telegram-formatter.js
 * Запуск: node telegram-html-lists-test.js
 */

// Импортируем необходимые модули
import axios from 'axios';
import dotenv from 'dotenv';
import { formatHtmlForTelegram } from './server/utils/telegram-formatter.js';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен Telegram из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Тестовый HTML-контент с вложенными списками
const testHtml = `
<p><strong>Важный список продуктов:</strong></p>
<ul>
  <li>Молочные продукты:
    <ul>
      <li>Молоко</li>
      <li>Сыр <strong>твердый</strong></li>
      <li>Йогурт <em>натуральный</em></li>
    </ul>
  </li>
  <li>Фрукты:
    <ul>
      <li>Яблоки <strong>зеленые</strong></li>
      <li>Бананы <em>спелые</em></li>
      <li>Апельсины
        <ul>
          <li>Крупные</li>
          <li>Сочные</li>
        </ul>
      </li>
    </ul>
  </li>
  <li>Овощи - разные виды:
    <ul>
      <li>Помидоры</li>
      <li>Огурцы</li>
      <li>Перец</li>
    </ul>
  </li>
</ul>
<p>Не забудьте про <strong>хлеб</strong> и <em>воду</em>!</p>
`;

// Форматированный HTML для Telegram
const formattedHtml = formatHtmlForTelegram(testHtml);

// Выводим результат
console.log('=== ORIGINAL HTML ===');
console.log(testHtml);
console.log('\n=== FORMATTED HTML FOR TELEGRAM ===');
console.log(formattedHtml);

// Расширенная функция для обработки HTML перед отправкой в Telegram
function processTelegramHtml(html) {
  // Сначала обработаем p-теги
  let result = html
    .replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1\n\n')
    .replace(/<\/?p[^>]*>/g, ''); // Удаляем любые незакрытые или оставшиеся p теги
  
  // Обработаем ul/li теги
  // Заменяем ul/li на простые символы для списка
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
  
  // Обработаем strong/em теги (заменяем на b/i)
  result = result
    .replace(/<strong>([\s\S]*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<em>([\s\S]*?)<\/em>/g, '<i>$1</i>');
  
  // Удаляем все остальные HTML теги кроме тех, что поддерживает Telegram
  result = result.replace(/<(?!\/?(b|i|u|s|code|pre|a)(?=>|\s.*>))[^>]*>/g, '');
  
  return result;
}

// Функция для отправки текста в Telegram напрямую
async function sendToTelegram(html) {
  try {
    console.log(`Отправка сообщения в Telegram на канал ${chatId}`);
    console.log(`Token начинается с: ${token ? token.substring(0, 8) + '...' : 'отсутствует'}`);
    
    // Предобработка HTML - обрабатываем все теги
    const processedHtml = processTelegramHtml(html);
    
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    // Печать исходного HTML перед отправкой
    console.log('Исходный HTML перед отправкой:');
    console.log(html.substring(0, 500) + (html.length > 500 ? '...' : ''));
    
    // Печать обработанного HTML
    console.log('Обработанный HTML после удаления p тегов:');
    console.log(processedHtml.substring(0, 500) + (processedHtml.length > 500 ? '...' : ''));
    
    // Печать HTML тегов в обработанном сообщении
    const htmlTags = (processedHtml.match(/<[^>]+>/g) || []).slice(0, 10);
    console.log('HTML теги в обработанном сообщении:');
    console.log(htmlTags.join(', '));
    
    const params = {
      chat_id: chatId,
      text: processedHtml,  // Используем обработанный HTML
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    
    const response = await axios.post(url, params);
    
    console.log('Ответ от Telegram API:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.ok) {
      console.log(`Сообщение успешно отправлено с ID: ${response.data.result.message_id}`);
      
      // Генерируем URL сообщения, если у канала есть имя пользователя
      if (chatId.startsWith('@')) {
        const username = chatId.substring(1);
        console.log(`URL сообщения: https://t.me/${username}/${response.data.result.message_id}`);
      } else if (chatId.startsWith('-100')) {
        const channelId = chatId.substring(4);
        console.log(`URL сообщения (для приватного канала): https://t.me/c/${channelId}/${response.data.result.message_id}`);
      }
      
      return response.data.result;
    } else {
      console.error(`Ошибка отправки: ${response.data.description}`);
      return null;
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

// Основная функция
async function main() {
  if (!token || !chatId) {
    console.error('Не найдены переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    return;
  }
  
  // Сперва отправляем пример поста пользователя
  console.log('\n=== ОТПРАВКА ПРИМЕРА ПОСТА ПОЛЬЗОВАТЕЛЯ ===');
  const userPost = `<p><strong>Цифровые продукты:</strong> основы создания и продвижения</p>
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
<p>Эффективная монетизация возможна через подписку, разовые продажи или смешанную модель.</p>`;
  await sendToTelegram(userPost);
  
  // Затем отправляем форматированный HTML
  console.log('\n=== ОТПРАВКА ФОРМАТИРОВАННОГО HTML ===');
  await sendToTelegram(formattedHtml);
}

// Запускаем основную функцию
main().catch(console.error);