/**
 * Тест отправки среднего текста с изображением в Telegram
 * Проверяет корректность работы telegram-service.ts для текстов >1024 и ≤4096 символов
 * 
 * Запуск: node telegram-test-medium-text.js
 */

const axios = require('axios');

async function testMediumText() {
  try {
    // Генерируем текст длиннее 1024 символов, но короче 4096
    let mediumText = 'Тест среднего текста (>1024 символов)\n\n';
    for (let i = 0; i < 15; i++) {
      mediumText += `Параграф ${i+1}: Этот текст добавлен для увеличения длины публикации. `;
      mediumText += 'Мы проверяем правильность работы алгоритма для текстов длиннее 1024 символов. ';
      mediumText += 'В этом случае текст должен отправляться отдельным сообщением после изображения.\n\n';
    }

    // ID канала и токен бота Telegram - замените на свои значения
    const telegramToken = 'YOUR_TELEGRAM_BOT_TOKEN';
    const telegramChatId = 'YOUR_TELEGRAM_CHAT_ID';
    const imageUrl = 'https://placehold.co/600x400?text=Medium+Text+Test';

    console.log('=== Тест: средний текст с изображением в Telegram ===');
    console.log(`Длина текста: ${mediumText.length} символов (должно быть >1024)`);
    console.log('Отправка запроса...');

    // Отправляем запрос к существующему тестовому маршруту приложения
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      text: mediumText,
      chatId: telegramChatId,
      token: telegramToken,
      imageUrl: imageUrl
    });

    console.log('\nРезультат:');
    console.log(`Статус: ${response.data.status}`);
    console.log(`URL публикации: ${response.data.postUrl}`);
    console.log(`Platform: ${response.data.platform}`);
    console.log(`Message ID: ${response.data.messageId}`);

    console.log('\nОжидаемый результат:');
    console.log('1. ✓ В канале Telegram должны появиться ДВА сообщения');
    console.log('2. ✓ Сначала изображение БЕЗ подписи');
    console.log('3. ✓ Затем отдельное текстовое сообщение с полным текстом');
    console.log('4. ✓ URL должен вести на сообщение с текстом (не на изображение)');
    console.log(`\nПроверьте канал и подтвердите результат. URL: ${response.data.postUrl}`);
  } catch (error) {
    console.error('Ошибка при тестировании:', error.response?.data || error.message);
  }
}

testMediumText();