/**
 * Тест очистки ID чатов Telegram от префиксов
 * Проверяет корректность обработки различных форматов ID для приватных каналов
 * 
 * Запуск: node test-telegram-chat-id.js
 */

// Функция для очистки ID чата от префиксов
function cleanTelegramChatId(chatId) {
  if (!chatId) return '';
  
  // Не обрабатываем ID, которые уже содержат номер сообщения (формат ID/message)
  if (chatId.includes('/')) {
    return chatId;
  }
  
  let cleanChatId = chatId;
  
  // Обрабатываем различные форматы префиксов
  if (chatId.startsWith('-1001')) {
    cleanChatId = chatId.substring(5); // Удаляем префикс -1001
    // Исправляем для случая -1001234567890 -> нам нужно 1234567890, а не 234567890
    cleanChatId = '1' + cleanChatId;
    console.log(`Обработка ID чата с префиксом -1001: ${chatId} -> ${cleanChatId}`);
  } else if (chatId.startsWith('-1002')) {
    cleanChatId = chatId.substring(5); // Удаляем префикс -1002
    console.log(`Обработка ID чата с префиксом -1002: ${chatId} -> ${cleanChatId}`);
  } else if (chatId.startsWith('-100')) {
    cleanChatId = chatId.substring(4); // Удаляем префикс -100
    console.log(`Обработка ID чата с префиксом -100: ${chatId} -> ${cleanChatId}`);
  }
  
  return cleanChatId;
}

// Тестовые кейсы для очистки ID чатов
const testCases = [
  {
    chatId: '-1001234567890',
    expected: '1234567890',
    description: 'ID с префиксом -1001'
  },
  {
    chatId: '-1002123456789',
    expected: '123456789',
    description: 'ID с префиксом -1002'
  },
  {
    chatId: '-100987654321',
    expected: '987654321',
    description: 'ID с префиксом -100'
  },
  {
    chatId: '1234567890',
    expected: '1234567890',
    description: 'ID без префикса'
  },
  {
    chatId: '@channel_name',
    expected: '@channel_name',
    description: 'ID в формате username (не требует очистки)'
  },
  {
    chatId: '-1001234567890/123',
    expected: '-1001234567890/123',
    description: 'ID с префиксом и номером сообщения (не должен обрабатываться)'
  },
  {
    chatId: null,
    expected: '',
    description: 'Пустой ID'
  }
];

// Функция для запуска тестов
function runTests() {
  console.log('Запуск тестов очистки ID чатов Telegram');
  console.log('=========================================');
  
  let passed = 0;
  let failed = 0;
  
  for (const [index, test] of testCases.entries()) {
    const result = cleanTelegramChatId(test.chatId);
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
  
  console.log('=========================================');
  console.log(`Итого: ${passed} тестов пройдено, ${failed} тестов не пройдено`);
  
  return failed === 0;
}

// Запуск тестов
runTests();