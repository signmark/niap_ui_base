/**
 * Тест для проверки форматирования URL в Telegram
 * 
 * Запуск: node test-telegram-url-format.js
 */

import { ensureValidTelegramUrl } from './server/services/publish-scheduler.js';

// Тестовые данные
const testCases = [
  {
    url: 'https://t.me/mychannel',
    platform: 'telegram',
    messageId: '123',
    expected: 'https://t.me/mychannel/123',
    description: 'URL для публичного канала без ID сообщения'
  },
  {
    url: 'https://t.me/c/1234567890',
    platform: 'telegram',
    messageId: '123',
    expected: 'https://t.me/c/1234567890/123',
    description: 'URL для приватного канала без ID сообщения'
  },
  {
    url: 'https://t.me/mychannel/123',
    platform: 'telegram',
    messageId: '456',
    expected: 'https://t.me/mychannel/123',
    description: 'URL уже содержит ID сообщения'
  },
  {
    url: null,
    platform: 'telegram',
    messageId: '123',
    expected: '',
    description: 'Пустой URL'
  },
  {
    url: 'https://t.me/c/1234567890/123',
    platform: 'instagram', 
    messageId: '456',
    expected: 'https://t.me/c/1234567890/123',
    description: 'Не-Telegram платформа'
  }
];

// Функция для проведения тестов
function runTests() {
  console.log('Запуск тестов форматирования URL для Telegram');
  console.log('==============================================');
  
  let passed = 0;
  let failed = 0;
  
  for (const [index, test] of testCases.entries()) {
    const result = ensureValidTelegramUrl(test.url, test.platform, test.messageId);
    const success = result === test.expected;
    
    if (success) {
      console.log(`✅ Тест #${index + 1} пройден: ${test.description}`);
      passed++;
    } else {
      console.log(`❌ Тест #${index + 1} не пройден: ${test.description}`);
      console.log(`   Ожидался: ${test.expected}`);
      console.log(`   Получено: ${result}`);
      failed++;
    }
  }
  
  console.log('==============================================');
  console.log(`Итого: ${passed} тестов пройдено, ${failed} тестов не пройдено`);
  
  return failed === 0;
}

// Запуск тестов
try {
  const success = runTests();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('Ошибка при запуске тестов:', error);
  process.exit(1);
}