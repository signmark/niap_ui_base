/**
 * Прямой тест отправки HTML-текста с использованием нашего нового очистителя HTML
 * Запуск: node telegram-html-direct-test.js
 */

import { fixUnclosedTags } from './server/utils/telegram-html-cleaner.js';
import axios from 'axios';

// Получаем секреты из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

/**
 * Тестовый HTML-текст для отправки
 */
const testHtml = `<p>В ходе предыдущего <strong>обсуждения</strong> мы рассмотрели причины, по которым завтрак является наиболее важным приемом пищи, и его влияние на уровень энергии, метаболизм и контроль аппетита. 😊</p><p>В настоящее время целесообразно проанализировать роль перекусов, поскольку они могут как способствовать поддержанию здоровья <strong>"хорошего"</strong>, так и незаметно наносить вред фигуре и самочувствию. 🍎 Перекусы помогают избежать резких колебаний уровня сахара в крови, поддерживают энергетический баланс и предотвращают чрезмерное чувство голода, которое зачастую приводит к переедания во время основных приемов пищи. 🚫</p><p>Следует, однако, понимать, что не все перекусы одинаково полезны. ⚠️ К нежелательным перекусам относятся сладости, булочки, печенье, чипсы и прочие продукты фастфуда. 🍩 Они вызывают быстрое повышение уровня сахара в крови, обеспечивая кратковременный прилив энергии, но столь же стремительно приводят к усталости, усилению аппетита и накоплению жировых отложений. </p><p><em>Полезными перекусами являются те, которые обеспечивают чувство сытости, стабильный энергетический баланс и поступление питательных веществ.</em> 🥗 К ним можно отнести орехи, ягоды, фрукты, овощи с хумусом, яйца, греческий йогурт, творог, цельнозерновые хлебцы с авокадо или ореховой пастой. 🥑 🍞 🥒</p><p>Рекомендации по правильному перекусыванию: 📝</p><ul><li>Выбирайте перекусы, содержащие белок, полезные жиры и клетчатку – они дольше обеспечивают чувство сытости и поддерживают обмен веществ. 👍</li><li>Не употребляйте пищу автоматически – перекус необходим, если вы действительно испытываете легкое чувство голода, а не просто по привычке или от скуки. 🤔</li><li>Контролируйте размер порции – горсть орехов полезна, но если съесть полпакета, это уже станет полноценным приемом пищи. 🥜</li></ul><p>Если вы стремитесь разобраться в вопросах питания, избавиться от вредных привычек и выстроить комфортную систему питания, присоединяйтесь к нашему марафону на нашем телеграм-канале. 📱</p>`;

/**
 * Простая функция для очистки HTML, которая просто удаляет переносы строк и лишние пробелы
 * @param {string} html HTML-текст для обработки
 * @returns {string} Обработанный HTML-текст
 */
function cleanHtml(html) {
  return html
    // Обрабатываем блочные элементы
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Обрабатываем списки
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n')
    // Нормализуем теги
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
    // Удаляем неподдерживаемые теги
    .replace(/<\/?(?!b|i|u|s|code|pre|a\b)[^>]+>/gi, '');
}

/**
 * Ручная обработка HTML для сложных случаев
 * @param {string} html Исходный HTML
 * @returns {string} Обработанный HTML для Telegram
 */
function manualHtmlProcessing(html) {
  // 1. Обработка блочных элементов
  let result = html
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n')
    .replace(/<br\s*\/?>/gi, '\n');
    
  // 2. Обрабатываем списки
  result = result
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
    
  // 3. Нормализуем Telegram-теги (каждый тег обрабатываем отдельно)
  // ВАЖНО: для тегов форматирования в Telegram мы обрабатываем каждый случай отдельно
  
  // Обрабатываем bold
  let processedResult = '';
  const boldSegments = result.split(/<\/?strong[^>]*>/);
  for (let i = 0; i < boldSegments.length; i++) {
    if (i % 2 === 0) {
      // Нечетные сегменты - обычный текст
      processedResult += boldSegments[i];
    } else {
      // Четные сегменты - текст внутри <strong>...</strong>
      processedResult += `<b>${boldSegments[i]}</b>`;
    }
  }
  
  // Обрабатываем italic
  result = processedResult;
  processedResult = '';
  const italicSegments = result.split(/<\/?em[^>]*>/);
  for (let i = 0; i < italicSegments.length; i++) {
    if (i % 2 === 0) {
      // Нечетные сегменты - обычный текст
      processedResult += italicSegments[i];
    } else {
      // Четные сегменты - текст внутри <em>...</em>
      processedResult += `<i>${italicSegments[i]}</i>`;
    }
  }
  
  // 4. Удаляем все остальные неподдерживаемые теги
  result = processedResult.replace(/<\/?(?!b|i|u|s|code|pre|a\b)[^>]+>/gi, '');
  
  return result;
}

/**
 * Отправляет сообщение в Telegram
 * @param {string} text Текст сообщения
 * @param {string} parse_mode Режим парсинга (HTML или Markdown)
 * @returns {Promise<any>} Ответ от Telegram API
 */
async function sendTelegramMessage(text, parse_mode = 'HTML') {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const data = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode
  };
  
  try {
    console.log(`Отправка сообщения в Telegram (${text.length} символов)...`);
    const response = await axios.post(url, data);
    console.log('Ответ от Telegram API:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке сообщения в Telegram:', error.response?.data || error.message);
    throw error;
  }
}

// Тестируем три разных способа обработки HTML:

// 1. Самый простой - очистка от HTML-разметки
async function testPlainText() {
  console.log('\n=== ТЕСТ 1: ПРОСТОЙ ТЕКСТ БЕЗ ФОРМАТИРОВАНИЯ ===');
  
  const plainText = testHtml.replace(/<[^>]+>/g, '');
  
  try {
    await sendTelegramMessage(plainText);
    console.log('✅ Тест 1 успешно выполнен');
  } catch (error) {
    console.error('❌ Тест 1 не пройден:', error.message);
  }
}

// 2. Базовая очистка HTML с сохранением поддерживаемых тегов
async function testBasicHtmlCleaning() {
  console.log('\n=== ТЕСТ 2: БАЗОВАЯ ОЧИСТКА HTML ===');
  
  const cleanedHtml = cleanHtml(testHtml);
  
  try {
    await sendTelegramMessage(cleanedHtml);
    console.log('✅ Тест 2 успешно выполнен');
  } catch (error) {
    console.error('❌ Тест 2 не пройден:', error.message);
  }
}

// 3. Ручная обработка HTML
async function testManualHtmlProcessing() {
  console.log('\n=== ТЕСТ 3: РУЧНАЯ ОБРАБОТКА HTML ===');
  
  const processedHtml = manualHtmlProcessing(testHtml);
  const fixedHtml = fixUnclosedTags(processedHtml);
  
  try {
    await sendTelegramMessage(fixedHtml);
    console.log('✅ Тест 3 успешно выполнен');
  } catch (error) {
    console.error('❌ Тест 3 не пройден:', error.message);
  }
}

// Запускаем все тесты последовательно
async function runAllTests() {
  try {
    await testPlainText();
    await testBasicHtmlCleaning();
    await testManualHtmlProcessing();
    console.log('\nВсе тесты завершены. Проверьте результаты в Telegram.');
  } catch (error) {
    console.error('Произошла ошибка при выполнении тестов:', error);
  }
}

// Запускаем тесты
runAllTests();