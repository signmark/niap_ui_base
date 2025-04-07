/**
 * Тест отправки форматированного текста в Telegram
 * Проверяет корректность отображения HTML-форматирования
 * 
 * Запуск: node test-telegram-formatting.cjs
 */

const axios = require('axios');
require('dotenv').config();

// Настройки Telegram
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Данные для тестирования форматирования в Telegram
const testCases = [
  {
    name: "Базовое форматирование",
    text: "<b>Жирный текст</b>\n<i>Курсивный текст</i>\n<u>Подчеркнутый текст</u>\n<s>Зачеркнутый текст</s>\n<code>Моноширинный текст для кода</code>\n<a href='https://example.com'>Ссылка на сайт</a>",
  },
  {
    name: "Комбинированное форматирование",
    text: "Комбинированное форматирование:\n<b><i>Жирный курсив</i></b>\n<b><u>Жирный подчеркнутый</u></b>\n<i><s>Курсивный зачеркнутый</s></i>",
  },
  {
    name: "Подсознание наизнанку (точное воспроизведение со скриншота)",
    text: "<b>Подсознание наизнанку</b>\n<b>Жирный текст</b>\n<i>Курсивный текст</i>\n<u>Подчеркнутый текст</u>\n<s>Зачеркнутый текст</s>\n<code>Моноширинный текст для кода</code>\n<a href='https://example.com'>Ссылка на сайт</a>\n\nКомбинированное форматирование:\n<b><i>Жирный курсив</i></b>\n<b><u>Жирный подчеркнутый</u></b>\n<i><s>Курсивный зачеркнутый</s></i>\n\n<b>Заголовок статьи</b>\n\n<i>Описание и важные детали об этой интересной статье. Могут быть разные аспекты, которые нужно выделить.</i>\n\nОсновной текст статьи, несколько абзацев обычного текста.\nВ котором могут быть <b>выделенные части</b> и <i>важные моменты</i>.\n\n<a href='https://t.me/your_channel'>Наш канал</a>\n\n👍 1",
  },
  {
    name: "Незакрытые теги (должны автоматически закрываться)",
    text: "<b>Жирный текст <i>курсив <u>подчеркнутый",
  }
];

// Проверка наличия переменных окружения
if (!token || !chatId) {
  console.error("ОШИБКА: Необходимо задать переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID");
  process.exit(1);
}

// Функция для отправки сообщения в Telegram через API приложения
async function sendToTelegram(text) {
  try {
    // Для тестирования используем тестовый API-маршрут
    const response = await axios.post('http://localhost:3000/api/test/telegram-post', {
      text,
      token,
      chatId
    });
    
    console.log(`✓ Сообщение успешно отправлено!`);
    
    if (response.data.postUrl) {
      console.log(`URL сообщения: ${response.data.postUrl}`);
    }
    
    return {
      success: true,
      url: response.data.postUrl,
      messageId: response.data.messageId
    };
  } catch (error) {
    console.error(`✗ Ошибка при отправке: ${error.message}`);
    if (error.response) {
      console.error(`  Статус: ${error.response.status}`);
      console.error(`  Данные: ${JSON.stringify(error.response.data)}`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// Функция для запуска всех тестов
async function runTests() {
  console.log('=== ТЕСТИРОВАНИЕ HTML-ФОРМАТИРОВАНИЯ В TELEGRAM ===\n');
  
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`\n[ТЕСТ ${i + 1}] ${test.name}`);
    console.log(`Текст: ${test.text.substring(0, 100)}${test.text.length > 100 ? '...' : ''}`);
    
    // Отправляем сообщение
    const result = await sendToTelegram(test.text);
    
    if (result.success) {
      console.log(`✓ ТЕСТ ${i + 1} ПРОЙДЕН!`);
      successful++;
    } else {
      console.log(`✗ ТЕСТ ${i + 1} ПРОВАЛЕН: ${result.error}`);
      failed++;
    }
    
    // Пауза между запросами
    if (i < testCases.length - 1) {
      console.log('Ожидание 2 секунды перед следующим тестом...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===');
  console.log(`✓ Успешно: ${successful}`);
  console.log(`✗ Провалено: ${failed}`);
  console.log(`Всего тестов: ${testCases.length}`);
}

// Запускаем тесты
console.log('Запуск тестирования HTML-форматирования в Telegram...');
runTests().catch(error => {
  console.error('Критическая ошибка при выполнении тестов:', error);
});