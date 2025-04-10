/**
 * Индексный файл для тестовых маршрутов API
 */

const express = require('express');
const router = express.Router();

// Импортируем тестовые маршруты
const telegramTestRoutes = require('./telegram-test-routes');
const telegramNewCleanerRoutes = require('./telegram-new-cleaner-test');

// Регистрируем все тестовые маршруты
router.use('/', telegramTestRoutes);
router.use('/', telegramNewCleanerRoutes);

// Маршрут для проверки доступности тестовых API
router.get('/status', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Тестовые API маршруты работают',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      { method: 'POST', path: '/api/test/telegram/format-html', description: 'Форматирование HTML для Telegram' },
      { method: 'POST', path: '/api/test/telegram/format-lists', description: 'Обработка списков в HTML для Telegram' },
      { method: 'POST', path: '/api/test/telegram/format-emoji', description: 'Обработка эмодзи в HTML для Telegram' },
      { method: 'POST', path: '/api/test/telegram/fix-unclosed-tags', description: 'Исправление незакрытых тегов HTML' },
      { method: 'POST', path: '/api/test/fix-html', description: 'Исправление HTML-разметки (существующий маршрут)' },
      { method: 'POST', path: '/api/test/telegram/clean-html', description: 'Новый очиститель HTML для Telegram' },
      { method: 'POST', path: '/api/test/telegram/send-with-new-cleaner', description: 'Отправка сообщения с новым очистителем HTML' }
    ]
  });
});

module.exports = router;