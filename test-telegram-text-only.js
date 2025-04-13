/**
 * Скрипт для проверки отправки только текстовых сообщений в Telegram
 * ВАЖНО: Проверяется корректность формирования URL с обязательным message_id
 */

const axios = require('axios');

// Функция для логирования
function log(message) {
  console.log(message);
}

/**
 * Отправляет тестовое текстовое сообщение через API приложения
 * @returns {Promise<object>} Результат публикации
 */
async function testTextOnlyPost() {
  try {
    const testContent = {
      id: 'test-id',
      title: 'Тестовый пост для Telegram (только текст)',
      content: 'Это тестовое сообщение без изображений. Проверяем, что URL формируется корректно с message_id.',
      contentType: 'text',
      imageUrl: null, // Специально не указываем изображение
      additionalImages: [], // Пустой массив дополнительных изображений
      status: 'draft',
      userId: 'test-user',
      campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
      socialPlatforms: ['telegram'],
      createdAt: new Date(),
      hashtags: [],
      links: [],
      metadata: {}
    };

    const chatId = '-1002302366310';

    // Используем тестовый маршрут 
    const response = await axios.post('http://localhost:5000/api/test/telegram-post', {
      content: testContent,
      chatId: chatId
    });

    if (response.data.success) {
      log('✅ Текстовое сообщение успешно отправлено!');
      
      // Проверяем, что в ответе есть messageId и messageUrl
      if (response.data.messageId) {
        log(`ID сообщения: ${response.data.messageId}`);
      } else {
        log('❌ ОШИБКА: messageId отсутствует в ответе API!');
      }
      
      if (response.data.messageUrl) {
        log(`URL сообщения: ${response.data.messageUrl}`);
        
        // Дополнительно проверяем, что URL содержит message_id
        if (!response.data.messageUrl.includes('/' + response.data.messageId)) {
          log('❌ КРИТИЧЕСКАЯ ОШИБКА: URL не содержит message_id!');
        }
      } else {
        log('❌ ОШИБКА: messageUrl отсутствует в ответе API!');
      }
      
      return response.data;
    } else {
      log(`❌ Ошибка при отправке текстового сообщения: ${response.data.error || 'Неизвестная ошибка'}`);
      return response.data;
    }
  } catch (error) {
    log(`❌ Исключение при выполнении теста: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Запускаем тест
testTextOnlyPost()
  .then(result => {
    log(`\nРезультат теста: ${result.success ? 'УСПЕШНО' : 'НЕУСПЕШНО'}`);
    if (!result.success) {
      log(`Ошибка: ${result.error}`);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(error => {
    log(`\nНепредвиденная ошибка: ${error}`);
    process.exit(1);
  });