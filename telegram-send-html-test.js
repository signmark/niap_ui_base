/**
 * Прямое тестирование отправки HTML-сообщений в Telegram
 * 
 * ВАЖНО: Для запуска скрипта нужны переменные окружения:
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_CHAT_ID
 */

import { telegramService } from './server/services/social/telegram-service.js';
import 'dotenv/config';

// Проверяем наличие необходимых переменных окружения
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
  console.error('⚠️ Необходимо установить переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  process.exit(1);
}

// Набор тестовых примеров HTML для отправки
const testCases = [
  {
    name: 'Базовое форматирование',
    html: '<b>Жирный текст</b>\n<i>Курсив</i>\n<u>Подчеркнутый</u>\n<a href="https://telegram.org">Ссылка на Telegram</a>'
  },
  {
    name: 'Параграфы преобразуются в переносы строк',
    html: '<p>Первый параграф</p><p>Второй параграф</p><p>Третий параграф с <b>жирным</b> текстом</p>'
  },
  {
    name: 'Списки преобразуются в маркированные строки',
    html: '<ul><li>Пункт 1</li><li>Пункт 2</li><li>Пункт 3 с <i>курсивом</i></li></ul>'
  },
  {
    name: 'Вложенные списки с отступами',
    html: '<ul><li>Пункт 1</li><li>Пункт 2<ul><li>Подпункт 2.1</li><li>Подпункт 2.2</li></ul></li><li>Пункт 3</li></ul>'
  },
  {
    name: 'Автоматическое закрытие тегов',
    html: '<b>Незакрытый жирный <i>и курсив'
  }
];

/**
 * Отправляет HTML в Telegram
 * @param {string} html HTML для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendToTelegram(html) {
  // Инициализируем сервис с токеном и ID чата
  telegramService.initialize(
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_CHAT_ID
  );
  
  // Форматируем и отправляем сообщение
  const formattedHtml = telegramService.standardizeTelegramTags(html);
  return await telegramService.sendTextMessage(formattedHtml);
}

/**
 * Запускает все тесты
 */
async function runTests() {
  console.log('='.repeat(80));
  console.log('ТЕСТИРОВАНИЕ ОТПРАВКИ HTML В TELEGRAM');
  console.log('='.repeat(80));
  console.log();
  console.log(`Используется бот-токен: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 8)}...`);
  console.log(`Используется ID чата: ${process.env.TELEGRAM_CHAT_ID}`);
  console.log('-'.repeat(80));
  console.log();

  for (const [index, testCase] of testCases.entries()) {
    console.log(`Тест #${index + 1}: ${testCase.name}`);
    console.log('Исходный HTML:     ', testCase.html);
    try {
      const formattedHtml = telegramService.standardizeTelegramTags(testCase.html);
      console.log('Форматированный HTML:', formattedHtml);
      
      const result = await sendToTelegram(testCase.html);
      console.log(`Результат: ✅ Сообщение отправлено (ID: ${result.messageId})`);
      
      if (result.messageUrl) {
        console.log(`Ссылка на сообщение: ${result.messageUrl}`);
      }
    } catch (error) {
      console.log(`Результат: ❌ Ошибка: ${error.message}`);
    }
    console.log('-'.repeat(80));
    
    // Делаем паузу между сообщениями, чтобы не превысить лимиты API Telegram
    if (index < testCases.length - 1) {
      console.log('Пауза перед следующей отправкой...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Запуск тестов
runTests().catch(error => {
  console.error('Ошибка при выполнении тестов:', error);
  process.exit(1);
});