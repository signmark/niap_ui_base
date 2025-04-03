/**
 * Тестовый скрипт для немедленной отправки изображения в Telegram
 * с использованием обновленного метода
 */

import axios from 'axios';

// Конфигурация для тестирования
const TEST_IMAGE_URL = 'https://directus.nplanner.ru/assets/ff600e9b-106b-47cf-8158-9e608224bf94';
const TEST_CAPTION = 'Тестовое сообщение отправлено в ' + new Date().toLocaleString();

// Функция для логирования
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

async function testPostToTelegram() {
  try {
    log('Начинаем тестовую отправку в Telegram...');
    
    // Вызываем API для отправки в Telegram
    const response = await axios.post('http://localhost:5000/api/social-test/telegram', {
      imageUrl: TEST_IMAGE_URL,
      text: TEST_CAPTION
    });
    
    if (response.data.success) {
      log('УСПЕХ! Изображение успешно отправлено в Telegram');
      log(`Данные ответа: ${JSON.stringify(response.data.result, null, 2)}`);
    } else {
      log(`ОШИБКА! Не удалось отправить изображение: ${response.data.error}`);
    }
  } catch (error) {
    log(`КРИТИЧЕСКАЯ ОШИБКА! ${error.message}`);
    
    if (error.response) {
      log(`Статус ошибки: ${error.response.status}`);
      log(`Данные ошибки: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Запускаем тест
log('Запуск тестового скрипта для отправки в Telegram');
testPostToTelegram().then(() => {
  log('Тестирование завершено');
}).catch(error => {
  log(`Необработанная ошибка: ${error.message}`);
});