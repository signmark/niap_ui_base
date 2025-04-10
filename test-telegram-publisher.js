/**
 * Скрипт для тестирования новой реализации публикации в Telegram
 * Запуск: node test-telegram-publisher.js
 */

// Импортируем модуль с новой реализацией публикации
const telegramPublisher = require('./server/utils/telegram-publisher');
const log = require('./server/utils/logger');

/**
 * Тестовый контент с HTML разметкой и изображениями
 */
const testContent = {
  id: 'test-content-' + Date.now(),
  title: '🚀 Тестирование новой реализации Telegram',
  content: `
<p>Это <strong>тестовое сообщение</strong> для проверки новой реализации <em>публикации в Telegram</em>.</p>

<ul>
  <li>Поддержка HTML-форматирования</li>
  <li>Отправка <u>изображений</u> отдельно при необходимости</li>
  <li>Обрезка контента по <s>длине</s></li>
</ul>

<p>А также <b>прямые теги</b> <i>Telegram</i>.</p>

<p>Ссылка на <a href="https://telegram.org">сайт Telegram</a></p>
  `,
  imageUrl: 'https://telegram.org/file/464001774/10fd9/XIuom9LJtN4.186626/51d4fc6b48d2d89660',
  additionalImages: [
    'https://telegram.org/file/464001103/1/bI7nLZtp7n0.44306/574fccc6a1096667e4',
    'https://telegram.org/file/464001639/1105c/B6cTGpFia9Y.79264/b0867a108ee565116a'
  ]
};

// Загружаем настройки Telegram из переменных окружения
const telegramSettings = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID
};

/**
 * Запускает тест публикации в Telegram
 */
async function runTest() {
  log('Запуск теста новой реализации публикации в Telegram', 'test');
  
  // Проверяем наличие настроек
  if (!telegramSettings.token || !telegramSettings.chatId) {
    log('Ошибка: не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в переменных окружения', 'test');
    process.exit(1);
  }
  
  try {
    // Тестируем обработку HTML
    const formattedText = telegramPublisher.processContentForTelegram(testContent.content);
    log(`Результат форматирования HTML (${formattedText.length} символов):\n${formattedText}`, 'test');
    
    // Тестируем полную публикацию
    log('Публикация тестового контента в Telegram...', 'test');
    const result = await telegramPublisher.publishToTelegram(testContent, telegramSettings);
    
    // Выводим результат
    log('Результат публикации:', 'test');
    log(JSON.stringify(result, null, 2), 'test');
    
    if (result.status === 'published') {
      log(`Контент успешно опубликован! URL: ${result.postUrl}`, 'test');
    } else {
      log(`Ошибка публикации: ${result.error}`, 'test');
    }
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`, 'test');
  }
}

// Запускаем тест
runTest().catch(err => {
  log(`Неожиданная ошибка: ${err.message}`, 'test');
});