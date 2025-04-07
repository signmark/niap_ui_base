/**
 * Тестовый скрипт для проверки HTML форматирования в Telegram через API нашего приложения
 * Запуск: node test-app-telegram-api.js
 */
import axios from 'axios';
import { config } from 'dotenv';

config();

// Получаем настройки из .env
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Основная функция теста
 */
async function testTelegramHtmlFormatting() {
  console.log('=== Тест HTML форматирования в Telegram через наш API ===\n');
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('ERROR: Не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в .env');
    process.exit(1);
  }
  
  // Текст с незакрытыми HTML тегами
  const testHtml = `<b>Тестовый заголовок с незакрытым тегом
  
<i>Подзаголовок с курсивом тоже незакрытый

<u>Подчёркнутый текст без закрытия

Этот тест проверяет автоматическое закрытие HTML-тегов в Telegram.
Должен работать корректно через основной код TelegramService.`;

  try {
    console.log('Используем тестовый API нашего приложения: /api/test/telegram-post');
    console.log('\nТестовый HTML текст с незакрытыми тегами:');
    console.log('--------------------------------------------------');
    console.log(testHtml);
    console.log('--------------------------------------------------\n');
    
    console.log('Отправляем запрос к нашему API...');
    
    // Отправляем запрос к нашему API (порт 8080)
    const response = await axios.post('http://localhost:8080/api/test/telegram-post', {
      text: testHtml,
      chatId: TELEGRAM_CHAT_ID,
      token: TELEGRAM_BOT_TOKEN
    });
    
    console.log(`Ответ API (статус ${response.status}):`);
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.success) {
      console.log('\n✅ УСПЕХ: Сообщение с HTML разметкой успешно отправлено через наш API!');
      if (response.data.data && response.data.data.url) {
        console.log(`URL сообщения: ${response.data.data.url}`);
      }
    } else {
      console.log('\n❌ ОШИБКА: Не удалось отправить сообщение через наш API');
      console.log('Описание ошибки:', response.data.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    console.error('\n❌ ОШИБКА при выполнении запроса:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.status, error.response.data);
    }
  }
}

// Запускаем тест
testTelegramHtmlFormatting();