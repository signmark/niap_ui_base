/**
 * Скрипт для тестирования форматирования HTML для Telegram
 * 
 * Этот скрипт тестирует преобразование форматированного текста из редактора
 * в формат, понятный для Telegram API с parse_mode: "HTML"
 */

import { formatHtmlForTelegram } from './server/utils/telegram-formatter.js';
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';

// Загружаем переменные окружения из .env файла
dotenv.config();

// Параметры Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Тестовые HTML-тексты с разными форматами
const testCases = [
  {
    name: "Курсив через style",
    html: `<p>Текст с <span style="font-style: italic">курсивом</span> и обычным текстом</p>`
  },
  {
    name: "Курсив через em",
    html: `<p>Текст с <em>курсивом через em</em> и обычным текстом</p>`
  },
  {
    name: "Жирный через strong",
    html: `<p>Текст с <strong>жирным шрифтом</strong> и обычным текстом</p>`
  },
  {
    name: "Жирный через style",
    html: `<p>Текст с <span style="font-weight: bold">жирным шрифтом через style</span> и обычным текстом</p>`
  },
  {
    name: "Комбинированное форматирование",
    html: `<p>Текст с <strong>жирным</strong> и <em>курсивным</em> форматированием</p>`
  },
  {
    name: "Переносы строк",
    html: `<p>Первый абзац</p><p>Второй абзац</p><p>Третий абзац с <strong>выделением</strong></p>`
  },
  {
    name: "Реальный пример из редактора",
    html: `<p>Разработка сбалансированного и индивидуализированного рациона питания – сложная задача, требующая учета множества факторов: особенностей организма, образа жизни и состояния здоровья. Однако благодаря <span style="font-style: italic">инновационному онлайн-сервису для составления персонализированных планов питания</span> эта задача стала значительно проще.</p><p>Наш сервис использует передовые алгоритмы анализа данных для создания идеального рациона, полностью соответствующего вашим индивидуальным потребностям. Независимо от ваших целей – снижение веса, наращивание мышечной массы или поддержание здорового баланса – наш сервис поможет их достичь <span style="font-style: italic">максимально эффективным и безопасным способом</span>.</p>`
  }
];

/**
 * Отправляет отформатированный текст в Telegram и проверяет отображение форматирования
 * @param {string} html HTML-текст для отправки
 * @param {string} description Описание теста
 * @returns {Promise<void>}
 */
async function testTelegramFormatting(html, description) {
  try {
    console.log(`\n=== Тест: ${description} ===`);
    
    // Шаг 1: Показываем исходный HTML
    console.log(`Исходный HTML: ${html.substring(0, 100)}${html.length > 100 ? '...' : ''}`);
    
    // Шаг 2: Обрабатываем HTML через форматировщик
    const formattedHtml = formatHtmlForTelegram(html);
    console.log(`Форматированный HTML: ${formattedHtml.substring(0, 100)}${formattedHtml.length > 100 ? '...' : ''}`);
    
    // Шаг 3: Проверяем отправку через API Telegram
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const response = await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, 
        {
          chat_id: TELEGRAM_CHAT_ID,
          text: formattedHtml,
          parse_mode: 'HTML'
        }
      );
      
      if (response.data && response.data.ok) {
        console.log(`✅ Успешно отправлено в Telegram: message_id ${response.data.result.message_id}`);
      } else {
        console.log(`❌ Ошибка при отправке в Telegram: ${JSON.stringify(response.data)}`);
      }
    } else {
      console.log('⚠️ Не удалось отправить в Telegram: отсутствуют TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    }
    
    return formattedHtml;
  } catch (error) {
    console.error(`❌ Ошибка при тестировании: ${error.message}`);
    if (error.response) {
      console.error(`   Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
  }
}

/**
 * Запускает все тесты форматирования
 */
async function runAllTests() {
  console.log('=== Тестирование форматирования HTML для Telegram ===');
  
  const results = [];
  
  for (const testCase of testCases) {
    const formattedHtml = await testTelegramFormatting(testCase.html, testCase.name);
    results.push({
      name: testCase.name,
      original: testCase.html,
      formatted: formattedHtml
    });
  }
  
  // Сохраняем результаты в файл для дальнейшего анализа
  fs.writeFileSync('telegram-formatting-results.json', JSON.stringify(results, null, 2));
  
  console.log('\n=== Тестирование завершено ===');
  console.log(`Результаты сохранены в файл telegram-formatting-results.json`);
}

// Запускаем тесты
runAllTests().catch(console.error);