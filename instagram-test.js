/**
 * Скрипт для тестирования публикации в Instagram через тестовый API
 * Использует прямые запросы к Instagram Graph API через наш тестовый маршрут
 * 
 * Этот скрипт упрощает отладку интеграции с Instagram, обходя промежуточные слои
 * 
 * Запуск: node instagram-test.js
 */

const axios = require('axios');
const fs = require('fs');

// Настройки для теста Instagram
const INSTAGRAM_TEST_SETTINGS = {
  // Адрес тестового API
  apiUrl: 'http://localhost:5000/api/test-instagram/instagram-post',
  
  // Параметры для тестового поста
  testPost: {
    caption: 'Тестовая публикация в Instagram через API ✓\nПроверка работы интеграции #test #api #instagram',
    imageUrl: 'https://loremflickr.com/1080/1080/nature', // Тестовое изображение из loremflickr
    videoUrl: null, // Можно указать URL видео вместо изображения
  }
};

/**
 * Сохраняет логи в файл
 * @param {string} message Сообщение для записи
 */
function log(message) {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  console.log(message);
  fs.appendFileSync('instagram-test.log', logMessage);
}

/**
 * Запускает тестовую публикацию в Instagram
 */
async function testInstagramPost() {
  try {
    log('Начинаем тестирование публикации в Instagram...');
    
    // Запрашиваем ввод токена и businessAccountId от пользователя
    const token = process.env.INSTAGRAM_TOKEN || prompt('Введите Instagram access token: ');
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || prompt('Введите Instagram business account ID: ');
    
    if (!token || !businessAccountId) {
      log('Ошибка: Требуются token и businessAccountId для тестирования');
      return;
    }
    
    // Подготавливаем данные для запроса
    const requestData = {
      token,
      businessAccountId,
      ...INSTAGRAM_TEST_SETTINGS.testPost
    };
    
    log(`Отправка тестового запроса на ${INSTAGRAM_TEST_SETTINGS.apiUrl}`);
    log(`Параметры запроса: ${JSON.stringify({
      ...INSTAGRAM_TEST_SETTINGS.testPost,
      token: 'скрыт',
      businessAccountId
    })}`);
    
    // Отправляем запрос к тестовому API
    const response = await axios.post(INSTAGRAM_TEST_SETTINGS.apiUrl, requestData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000 // увеличенный таймаут для обработки медиа
    });
    
    // Проверяем результат
    if (response.data && response.data.success) {
      log('Публикация успешно размещена в Instagram!');
      log(`ID медиа: ${response.data.mediaId}`);
      log(`Постоянная ссылка: ${response.data.permalink}`);
    } else {
      log('Ошибка при публикации:');
      log(JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    log('Произошла ошибка при выполнении теста:');
    if (error.response) {
      log(`Статус ошибки: ${error.response.status}`);
      log(`Данные ошибки: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      log(`Ошибка: ${error.message}`);
    }
  }
}

// Функция для ввода пользовательских данных (простая имитация)
function prompt(question) {
  console.log(`\n${question}`);
  return ''; // В реальном сценарии здесь был бы код для ожидания ввода пользователя
}

// Запускаем тест
testInstagramPost();