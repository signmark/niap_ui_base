/**
 * Тест отправки короткого текста с изображением в Telegram
 * Проверяет корректность работы telegram-service.ts для текстов ≤1024 символов
 * 
 * Запуск: node telegram-test-short-text.js
 */

const axios = require('axios');

async function testShortText() {
  try {
    // Тестовое содержимое: короткий текст и изображение
    const content = {
      title: 'Тест: короткий текст с изображением',
      content: 'Это короткий текст с длиной менее 1024 символов, который должен отправиться как подпись к изображению.',
      imageUrl: 'https://placehold.co/600x400?text=Test+Image'
    };

    // ID канала и токен бота Telegram - замените на свои значения
    const telegramToken = 'YOUR_TELEGRAM_BOT_TOKEN';
    const telegramChatId = 'YOUR_TELEGRAM_CHAT_ID';

    console.log('=== Тест: короткий текст с изображением в Telegram ===');
    console.log(`Длина текста: ${(content.title + '\n\n' + content.content).length} символов`);
    console.log('Отправка запроса...');

    // Отправляем запрос к существующему тестовому маршруту приложения
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      text: content.title + '\n\n' + content.content,
      chatId: telegramChatId,
      token: telegramToken,
      imageUrl: content.imageUrl
    });

    console.log('\nРезультат:');
    console.log(`Статус: ${response.data.status}`);
    console.log(`URL публикации: ${response.data.postUrl}`);
    console.log(`Platform: ${response.data.platform}`);
    console.log(`Message ID: ${response.data.messageId}`);

    console.log('\nОжидаемый результат:');
    console.log('1. ✓ В канале Telegram должно появиться ОДНО сообщение');
    console.log('2. ✓ Изображение должно содержать текст как подпись');
    console.log('3. ✓ URL должен вести именно на это сообщение с изображением и текстом');
    console.log(`\nПроверьте канал и подтвердите результат. URL: ${response.data.postUrl}`);
  } catch (error) {
    console.error('Ошибка при тестировании:', error.response?.data || error.message);
  }
}

testShortText();