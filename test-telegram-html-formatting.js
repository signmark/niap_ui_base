/**
 * Тест отправки форматированного текста в Telegram
 * Проверяет корректность отображения HTML-форматирования
 * 
 * Запуск: node test-telegram-html-formatting.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Данные для тестирования форматирования в Telegram
const testCases = [
  {
    name: "Пример #1: Базовое форматирование (жирный, курсив, подчеркнутый, зачеркнутый)",
    text: "<b>Жирный текст</b>\n<i>Курсивный текст</i>\n<u>Подчеркнутый текст</u>\n<s>Зачеркнутый текст</s>\n<code>Моноширинный текст для кода</code>\n<a href='https://example.com'>Ссылка на сайт</a>",
  },
  {
    name: "Пример #2: Комбинированное форматирование",
    text: "Комбинированное форматирование:\n<b><i>Жирный курсив</i></b>\n<b><u>Жирный подчеркнутый</u></b>\n<i><s>Курсивный зачеркнутый</s></i>",
  },
  {
    name: "Пример #3: Формат публикации статьи",
    text: "<b>Заголовок статьи</b>\n\n<i>Описание и важные детали об этой интересной статье. Могут быть разные аспекты, которые нужно выделить.</i>\n\nОсновной текст статьи, несколько абзацев обычного текста.\nВ котором могут быть <b>выделенные части</b> и <i>важные моменты</i>.\n\n<a href='https://t.me/your_channel'>Наш канал</a>\n\n👍 1",
  },
  {
    name: "Пример #4: Подсознание наизнанку (точное воспроизведение со скриншота)",
    text: "<b>Подсознание наизнанку</b>\n<b>Жирный текст</b>\n<i>Курсивный текст</i>\n<u>Подчеркнутый текст</u>\n<s>Зачеркнутый текст</s>\n<code>Моноширинный текст для кода</code>\n<a href='https://example.com'>Ссылка на сайт</a>\n\nКомбинированное форматирование:\n<b><i>Жирный курсив</i></b>\n<b><u>Жирный подчеркнутый</u></b>\n<i><s>Курсивный зачеркнутый</s></i>\n\n<b>Заголовок статьи</b>\n\n<i>Описание и важные детали об этой интересной статье. Могут быть разные аспекты, которые нужно выделить.</i>\n\nОсновной текст статьи, несколько абзацев обычного текста.\nВ котором могут быть <b>выделенные части</b> и <i>важные моменты</i>.\n\n<a href='https://t.me/your_channel'>Наш канал</a>\n\n👍 1",
  },
  {
    name: "Пример #5: Незакрытые теги (должны автоматически закрываться)",
    text: "<b>Жирный текст <i>курсив <u>подчеркнутый",
  },
  {
    name: "Пример #6: Маркировочный список",
    text: "<b>Список дел:</b>\n• Пункт первый\n• Пункт второй\n• <i>Выделенный пункт</i>\n• <s>Выполненная задача</s>",
  },
  {
    name: "Пример #7: Ссылки",
    text: "<b>Полезные ссылки:</b>\n\n<a href='https://core.telegram.org/bots/api'>Документация Telegram Bot API</a>\n\n<a href='https://github.com/'>GitHub</a>",
  },
  {
    name: "Пример #8: Сложное форматирование с кодом",
    text: "<b>Пример кода:</b>\n<code>function testFormatting() {\n  console.log('Hello, World!');\n}</code>\n\nРезультат: <i>Выполнено успешно</i>",
  }
];

// Функция для отправки текста через API приложения
async function sendMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.error("ОШИБКА: Не найдены переменные окружения TELEGRAM_BOT_TOKEN и/или TELEGRAM_CHAT_ID");
    console.error("Установите их в файле .env или передайте через переменные окружения");
    process.exit(1);
  }
  
  console.log(`Отправка сообщения в чат ${chatId}`);
  
  try {
    // Вызываем тестовый API-метод нашего приложения
    const response = await axios.post('http://localhost:3000/api/test/telegram-post', {
      text: text,
      token: token,
      chatId: chatId
    });
    
    if (response.data && response.data.success) {
      console.log(`✅ Сообщение успешно отправлено!`);
      if (response.data.postUrl) {
        console.log(`🔗 URL сообщения: ${response.data.postUrl}`);
      }
      return {
        success: true,
        messageId: response.data.messageId,
        postUrl: response.data.postUrl
      };
    } else {
      console.error(`❌ Ошибка при отправке: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data?.error || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    console.error(`❌ Исключение при отправке: ${error.message}`);
    if (error.response) {
      console.error(`Статус ошибки: ${error.response.status}`);
      console.error(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// Функция для запуска всех тестов
async function runTests() {
  console.log("\n🚀 ЗАПУСК ТЕСТОВ HTML-ФОРМАТИРОВАНИЯ В TELEGRAM 🚀\n");
  
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 ТЕСТ #${i+1}: ${testCase.name}`);
    console.log(`📝 Текст для отправки: ${testCase.text.substring(0, 100)}${testCase.text.length > 100 ? '...' : ''}`);
    
    // Отправляем сообщение
    const result = await sendMessage(testCase.text);
    
    if (result.success) {
      console.log(`✅ ТЕСТ #${i+1} УСПЕШНО ЗАВЕРШЕН!`);
      successful++;
    } else {
      console.log(`❌ ТЕСТ #${i+1} ПРОВАЛЕН: ${result.error}`);
      failed++;
    }
    
    // Пауза между тестами для избежания лимитов Telegram API
    if (i < testCases.length - 1) {
      console.log("⏳ Пауза 2 секунды перед следующим тестом...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log("\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ 📊");
  console.log(`✅ Успешно: ${successful}`);
  console.log(`❌ Провалено: ${failed}`);
  console.log(`📋 Всего тестов: ${testCases.length}`);
  
  if (failed === 0) {
    console.log("\n🎉 ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ! 🎉");
  } else {
    console.log("\n⚠️ ИМЕЮТСЯ ПРОВАЛЕННЫЕ ТЕСТЫ! ⚠️");
  }
}

// Запуск тестов
console.log("🔍 Тестирование HTML-форматирования в Telegram");
runTests().catch(error => {
  console.error('🔥 Критическая ошибка при выполнении тестов:', error);
  process.exit(1);
});