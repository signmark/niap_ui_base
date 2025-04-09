/**
 * Скрипт для отправки в Telegram вашего HTML-контента
 * Запуск: node publish-content-from-html.js
 */

import axios from 'axios';

// Настройки Telegram API
const telegramToken = '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
const chatId = '-1002302366310';

// HTML-контент, который вы предоставили ранее
const html = `<p><em>В ходе предыдущего обсуждения мы разобрали, почему завтрак – это король дня, и как он влияет на нашу энергию, метаболизм и контроль аппетита. 👑 Сегодня пришло время осветить тему перекусов – этих маленьких, но важных спутников нашего дня. 🍭</em></p>

<p><strong>Перекусы могут быть как союзниками в деле поддержания здоровья и стройности 💪, так и коварными врагами, незаметно подрывающими наши усилия. 😈</strong> Правильные перекусы помогают избежать резких скачков сахара в крови, обеспечивают стабильный приток энергии и не позволяют голоду взять верх, что часто приводит к переедания на основных приемах пищи. ⏱️ <strong>Но не все перекусы одинаково полезны – есть те, что лучше обходить стороной! ☝️</strong></p>

<p>Сладости, булочки, печенье, чипсы и прочие соблазны фастфуда могут подарить лишь мимолетный прилив сил, а после – упадок энергии, усиление аппетита и лишние сантиметры на талии. 😩 <em>Истинно полезные перекусы – это те, что надолго утоляют голод, дарят заряд бодрости и снабжают организм ценными питательными веществами. 🥗</em> Орехи, ягоды, фрукты, овощи с хумусом, яйца, греческий йогурт, творог, цельнозерновые хлебцы с авокадо или ореховой пастой – вот настоящие друзья стройной фигуры и хорошего самочувствия! 🥜🍓🥑</p>

<p><strong>Вот несколько золотых правил грамотного перекуса: 📝</strong></p>

<ul>
<li>Выбирайте перекусы с белком, полезными жирами и клетчаткой – они дольше сохраняют чувство сытости и поддерживают метаболизм. 💪</li>
<li>Прислушивайтесь к своему телу – перекусывайте, только когда действительно голодны, а не по привычке или от скуки. 🤔</li>
<li>Контролируйте порции – горсть орехов полезна, но целый пакет уже перебор. 🥜</li>
</ul>

<p>Если вы стремитесь разобраться в тонкостях правильного питания, избавиться от вредных привычек и выстроить идеальную систему питания для себя, присоединяйтесь к нашему марафону в Телеграме! 📲</p>`;

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} text Текст с HTML-разметкой
 * @returns {string} Текст с исправленными незакрытыми тегами
 */
function fixUnclosedTags(text) {
  // Стек для отслеживания открытых тегов
  const tagStack = [];
  
  // Регулярное выражение для поиска открывающих и закрывающих тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  // Находим все теги в тексте
  let match;
  let lastIndex = 0;
  let result = '';
  
  while ((match = tagRegex.exec(text)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosingTag = fullTag.startsWith('</');
    
    // Добавляем текст до текущего тега
    result += text.substring(lastIndex, match.index);
    lastIndex = match.index + fullTag.length;
    
    if (isClosingTag) {
      // Если это закрывающий тег, проверяем, соответствует ли он последнему открытому тегу
      if (tagStack.length > 0) {
        const lastOpenTag = tagStack[tagStack.length - 1];
        if (lastOpenTag === tagName) {
          // Тег правильно закрыт, удаляем его из стека
          tagStack.pop();
          result += fullTag;
        } else {
          // Закрывающий тег не соответствует последнему открытому
          // Добавляем закрывающие теги для всех открытых тегов до соответствующего
          let found = false;
          for (let i = tagStack.length - 1; i >= 0; i--) {
            if (tagStack[i] === tagName) {
              found = true;
              // Закрываем все промежуточные теги
              for (let j = tagStack.length - 1; j >= i; j--) {
                result += `</${tagStack[j]}>`;
                tagStack.pop();
              }
              break;
            }
          }
          
          if (!found) {
            // Если соответствующий открывающий тег не найден, игнорируем закрывающий тег
            console.log(`Игнорирую закрывающий тег </${tagName}>, для которого нет открывающего`);
          } else {
            // Добавляем текущий закрывающий тег
            result += fullTag;
          }
        }
      } else {
        // Если стек пуст, значит это закрывающий тег без открывающего
        console.log(`Игнорирую закрывающий тег </${tagName}>, для которого нет открывающего`);
      }
    } else {
      // Открывающий тег, добавляем в стек
      tagStack.push(tagName);
      result += fullTag;
    }
  }
  
  // Добавляем оставшийся текст
  result += text.substring(lastIndex);
  
  // Закрываем все оставшиеся открытые теги в обратном порядке (LIFO)
  for (let i = tagStack.length - 1; i >= 0; i--) {
    result += `</${tagStack[i]}>`;
  }
  
  return result;
}

/**
 * Преобразует HTML из редактора в формат Telegram
 * @param {string} html HTML из редактора
 * @returns {string} HTML, готовый для отправки в Telegram
 */
function formatHtmlForTelegram(html) {
  console.log('Начинаю обработку HTML для Telegram...');
  
  // 1. Сначала обрабатываем блочные элементы
  let result = html
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/g, '$1\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<ul[^>]*>/g, '\n')
    .replace(/<\/ul>/g, '\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/g, '• $1\n');
  
  // 2. Преобразуем форматирующие теги
  result = result
    .replace(/<strong>([\s\S]*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<em>([\s\S]*?)<\/em>/g, '<i>$1</i>')
    .replace(/<b>([\s\S]*?)<\/b>/g, '<b>$1</b>')
    .replace(/<i>([\s\S]*?)<\/i>/g, '<i>$1</i>')
    .replace(/<u>([\s\S]*?)<\/u>/g, '<u>$1</u>')
    .replace(/<s>([\s\S]*?)<\/s>/g, '<s>$1</s>')
    .replace(/<strike>([\s\S]*?)<\/strike>/g, '<s>$1</s>');
  
  // 3. Удаляем все оставшиеся HTML-теги
  result = result.replace(/<(?!\/?b>|\/?i>|\/?u>|\/?s>|\/?a(?:\s[^>]*)?>)[^>]*>/g, '');
  
  // 4. Исправляем незакрытые теги
  result = fixUnclosedTags(result);
  
  // 5. Нормализуем переносы строк
  result = result
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
  
  console.log('HTML обработан и готов к отправке.');
  return result;
}

/**
 * Отправляет ваш контент в Telegram
 */
async function sendToTelegram() {
  try {
    console.log('=== Отправка HTML-контента в Telegram ===');
    
    // Форматируем HTML для Telegram
    const formattedHtml = formatHtmlForTelegram(html);
    
    // Выводим первые 200 символов для проверки
    console.log('\nФорматированный HTML (первые 200 символов):');
    console.log(formattedHtml.substring(0, 200) + '...');
    
    // Отправляем сообщение в Telegram
    const response = await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      chat_id: chatId,
      text: formattedHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
    
    if (response.data && response.data.ok) {
      console.log('\n✅ Сообщение успешно отправлено!');
      console.log(`ID сообщения: ${response.data.result.message_id}`);
      
      // Получаем URL сообщения
      try {
        const chatInfo = await axios.post(
          `https://api.telegram.org/bot${telegramToken}/getChat`,
          { chat_id: chatId }
        );
        
        if (chatInfo.data.ok) {
          let messageUrl;
          if (chatInfo.data.result.username) {
            messageUrl = `https://t.me/${chatInfo.data.result.username}/${response.data.result.message_id}`;
            console.log(`Канал: ${chatInfo.data.result.username}`);
          } else {
            const formattedChatId = chatId.startsWith('-100') ? chatId.substring(4) : chatId;
            messageUrl = `https://t.me/c/${formattedChatId}/${response.data.result.message_id}`;
            console.log('Приватный канал');
          }
          console.log(`URL сообщения: ${messageUrl}`);
        }
      } catch (error) {
        console.error('Ошибка при получении URL сообщения:', error.message);
      }
      
      return response.data;
    } else {
      console.error('\n❌ Ошибка при отправке:', response.data);
      throw new Error(`Ошибка Telegram API: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('\n❌ Ошибка при отправке:', error.message);
    if (error.response) {
      console.error('Данные ошибки:', error.response.data);
    }
    throw error;
  }
}

// Запускаем отправку
sendToTelegram()
  .then(() => console.log('\n=== Публикация успешно завершена ==='))
  .catch(error => console.error('\n⚠️ Публикация завершена с ошибкой:', error.message));