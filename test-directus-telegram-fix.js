/**
 * Тестовый скрипт для проверки загрузки изображений из Directus с авторизацией
 * и отправки в Telegram
 */
require('dotenv').config();
const { downloadDirectusImage, uploadImageToTelegram, sendDirectusImageToTelegram } = require('./server/services/social-publishing-fix');

// Параметры для тестирования
const directusUrl = 'https://directus.nplanner.ru/assets/3b34be64-9579-4b1d-b4e2-98d3de5c2a14'; // Замените на ваш URL
const telegramToken = process.env.TELEGRAM_TOKEN; // Токен из .env
const telegramChatId = process.env.TELEGRAM_CHAT_ID; // ID чата из .env

// Прямой тест с полным процессом
async function testFullProcess() {
  try {
    console.log('🧪 Начинаем тестирование полного процесса отправки изображения из Directus в Telegram');
    
    // Проверяем, что у нас есть все необходимые параметры
    if (!telegramToken || !telegramChatId) {
      console.error('❌ Отсутствуют необходимые параметры (TELEGRAM_TOKEN, TELEGRAM_CHAT_ID) в .env файле');
      return;
    }
    
    console.log(`📤 Отправляем изображение: ${directusUrl} в Telegram чат: ${telegramChatId}`);
    
    const result = await sendDirectusImageToTelegram(
      directusUrl,
      telegramChatId,
      'Тестовое изображение с авторизацией Directus 🚀',
      telegramToken
    );
    
    console.log('✅ Изображение успешно отправлено!');
    console.log(`🆔 ID сообщения: ${result.result.message_id}`);
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    if (error.response) {
      console.error('📊 Статус ответа:', error.response.status);
      console.error('📝 Данные ответа:', error.response.data);
    }
  }
}

// Запускаем тест
testFullProcess().catch(err => {
  console.error('❌ Неожиданная ошибка:', err);
});