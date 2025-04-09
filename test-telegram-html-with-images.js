/**
 * Тест отправки HTML-сообщения с изображениями в Telegram
 * Проверяет форматирование HTML и отправку изображений с подписями
 */

import axios from 'axios';

// HTML-сообщение с форматированием для тестирования
const htmlMessage = `
<b>Тестирование новой реализации Telegram</b>

<i>Это сообщение содержит различные HTML-элементы:</i>

• <b>Жирный текст</b>
• <i>Курсивный текст</i>
• <u>Подчеркнутый текст</u>
• <s>Зачеркнутый текст</s>
• <code>Моноширинный текст</code>

<b>Список возможностей:</b>
• Поддержка <b>вложенных <i>тегов</i></b>
• Корректная обработка <u>форматирования</u>
• Изображения с HTML-подписями
• Группы изображений
• Автоматическое разделение длинных сообщений

Telegram также может отображать <a href="https://t.me/ya_delayu_moschno">ссылки</a>.
`;

// URL изображений для тестирования
const imageUrl = 'https://i.imgur.com/KPHvs0K.jpeg';
const additionalImages = [
  'https://i.imgur.com/OqbtbOL.jpeg',
  'https://i.imgur.com/5yeBVeM.jpeg'
];

// Функция для тестирования отправки HTML-текста в Telegram
async function testSendHtmlMessage() {
  try {
    console.log('Тестирование отправки HTML-сообщения в Telegram...');
    
    const response = await axios.post('http://localhost:5000/api/test/raw-html-telegram', {
      text: htmlMessage
    });
    
    console.log('Результат отправки HTML-сообщения:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке HTML-сообщения:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    throw error;
  }
}

// Функция для тестирования отправки изображения с HTML-подписью
async function testSendImageWithCaption() {
  try {
    console.log('Тестирование отправки изображения с HTML-подписью...');
    
    const response = await axios.post('http://localhost:5000/api/test/optimized-platform-publish', {
      content: htmlMessage,
      imageUrl: imageUrl
    });
    
    console.log('Результат отправки изображения с HTML-подписью:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке изображения с HTML-подписью:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    throw error;
  }
}

// Функция для тестирования отправки группы изображений с HTML-подписью
async function testSendMediaGroup() {
  try {
    console.log('Тестирование отправки группы изображений с HTML-подписью...');
    
    const response = await axios.post('http://localhost:5000/api/test/optimized-platform-publish', {
      content: htmlMessage,
      imageUrl: imageUrl,
      additionalImages: additionalImages
    });
    
    console.log('Результат отправки группы изображений с HTML-подписью:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке группы изображений с HTML-подписью:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    throw error;
  }
}

// Запускаем все тесты последовательно
async function runTests() {
  try {
    console.log('==== ТЕСТИРОВАНИЕ TELEGRAM HTML С ИЗОБРАЖЕНИЯМИ ====\n');
    
    // Тест 1: Отправка HTML-сообщения
    await testSendHtmlMessage();
    console.log('\n--------------------------------------------------\n');
    
    // Тест 2: Отправка изображения с HTML-подписью
    await testSendImageWithCaption();
    console.log('\n--------------------------------------------------\n');
    
    // Тест 3: Отправка группы изображений с HTML-подписью
    await testSendMediaGroup();
    
    console.log('\n==== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО УСПЕШНО ====');
  } catch (error) {
    console.error('\n==== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО С ОШИБКАМИ ====');
  }
}

// Запускаем тесты
runTests();