/**
 * Простой тест отправки сообщения в Telegram через API
 * Запуск: node telegram-simple-test.js
 */

import fetch from 'node-fetch';

/**
 * Отправляет текстовое сообщение в Telegram
 * @param {string} text Текст сообщения
 * @returns {Promise<object>} Результат отправки
 */
async function sendMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    throw new Error('Отсутствуют переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
  }
  
  console.log(`Отправка сообщения в Telegram в чат ${chatId}`);
  console.log(`Текст сообщения: ${text}`);
  
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    throw error;
  }
}

/**
 * Отправляет HTML-форматированное сообщение в Telegram
 * @param {string} html HTML-текст сообщения
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtml(html) {
  return sendMessage(html);
}

/**
 * Запускает тестовую отправку простого сообщения
 */
async function runSimpleTest() {
  console.log('=== Тест простого текстового сообщения ===');
  const result = await sendMessage('Тестовое сообщение из скрипта telegram-simple-test.js');
  console.log('Результат:', JSON.stringify(result, null, 2));
}

/**
 * Запускает тестовую отправку HTML-сообщения
 */
async function runHtmlTest() {
  console.log('\n=== Тест HTML-форматированного сообщения ===');
  const html = '<b>Жирный текст</b> и <i>курсивный текст</i>, а также <u>подчеркнутый</u>.';
  const result = await sendHtml(html);
  console.log('Результат:', JSON.stringify(result, null, 2));
}

/**
 * Запускает тестовую отправку списка с HTML-форматированием
 */
async function runListTest() {
  console.log('\n=== Тест списка с HTML-форматированием ===');
  const html = `<b>Заголовок списка:</b>
  
• Первый пункт
• <b>Второй пункт</b> с форматированием
• Третий пункт с <i>курсивом</i>`;
  
  const result = await sendHtml(html);
  console.log('Результат:', JSON.stringify(result, null, 2));
}

/**
 * Запускает тестовую отправку сложного форматирования с эмодзи
 */
async function runComplexTest() {
  console.log('\n=== Тест сложного форматирования с эмодзи ===');
  const html = `🔥 <b>Горячие новости!</b> 🔥
  
Сегодня в нашем магазине:
  
• 🍎 Яблоки со скидкой 20%
• 🍌 Бананы - 2 кг по цене 1
• 🍓 Свежая клубника
  
🛒 Приходите за покупками!`;
  
  const result = await sendHtml(html);
  console.log('Результат:', JSON.stringify(result, null, 2));
}

// Запускаем все тесты последовательно
async function runAllTests() {
  try {
    console.log('Запуск тестов отправки сообщений в Telegram...\n');
    
    await runSimpleTest();
    await runHtmlTest();
    await runListTest();
    await runComplexTest();
    
    console.log('\n✅ Все тесты успешно выполнены!');
  } catch (error) {
    console.error('\n❌ Ошибка при выполнении тестов:', error);
  }
}

runAllTests();