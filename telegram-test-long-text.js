/**
 * Тест отправки длинного текста с изображением в Telegram
 * Проверяет корректность работы telegram-service.ts для текстов >4096 символов
 * 
 * Запуск: node telegram-test-long-text.js
 */

const axios = require('axios');

async function testLongText() {
  try {
    // Генерируем текст длиннее 4096 символов
    let longText = 'Тест длинного текста (>4096 символов)\n\n';
    for (let i = 0; i < 80; i++) {
      longText += `Параграф ${i+1}: Этот текст добавлен для создания очень длинной публикации. `;
      longText += 'Мы проверяем корректность работы алгоритма для текстов длиннее 4096 символов. ';
      longText += 'В этом случае текст должен быть обрезан до 4093 символов и добавлено многоточие.\n\n';
    }

    // ID канала и токен бота Telegram - замените на свои значения
    const telegramToken = 'YOUR_TELEGRAM_BOT_TOKEN';
    const telegramChatId = 'YOUR_TELEGRAM_CHAT_ID';
    const imageUrl = 'https://placehold.co/600x400?text=Long+Text+Test';

    console.log('=== Тест: длинный текст с изображением в Telegram ===');
    console.log(`Длина текста: ${longText.length} символов (должно быть >4096)`);
    console.log('Отправка запроса...');

    // Отправляем запрос к существующему тестовому маршруту приложения
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      text: longText,
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
    console.log('3. ✓ Затем отдельное текстовое сообщение с ОБРЕЗАННЫМ текстом (≤4096 символов)');
    console.log('4. ✓ В конце текста должно быть многоточие "..."');
    console.log('5. ✓ URL должен вести на сообщение с текстом (не на изображение)');
    console.log(`\nПроверьте канал и подтвердите результат. URL: ${response.data.postUrl}`);
    
    // Дополнительная проверка: отправим запрос для получения сообщения и проверим длину текста
    console.log('\nДополнительная проверка:');
    console.log('Длина изначального текста:', longText.length, 'символов');
    console.log('Ожидаемая длина обрезанного текста: не более 4096 символов');
  } catch (error) {
    console.error('Ошибка при тестировании:', error.response?.data || error.message);
  }
}

testLongText();