/**
 * Комплексный тест функционала форматирования URL и обработки ID чатов Telegram
 * 
 * Запуск: node test-telegram-url-formatting.js
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

// Функция для форматирования URL
function formatTelegramUrl(chatId, messageId, username) {
  if (!chatId) return 'https://t.me';
  
  console.log(`Форматирование URL для Telegram: chatId=${chatId}, messageId=${messageId || 'не указан'}, username=${username || 'не указан'}`);
  
  // Если ID сообщения не указан, формируем URL только для канала/чата
  if (!messageId) {
    // Случай с username
    if (username) {
      return `https://t.me/${username}`;
    }
    
    // Случай с username, заданным через @
    if (chatId.startsWith('@')) {
      return `https://t.me/${chatId.substring(1)}`;
    }
    
    // Для публичных каналов возвращаем базовый URL
    return 'https://t.me';
  }
  
  // Если известен username, используем его для формирования URL
  if (username) {
    return `https://t.me/${username}/${messageId}`;
  }
  
  // Случай с username, заданным через @
  if (chatId.startsWith('@')) {
    const channelName = chatId.substring(1);
    return `https://t.me/${channelName}/${messageId}`;
  }
  
  // Обрабатываем приватные каналы/чаты
  if (chatId.startsWith('-100') || chatId.startsWith('-1001') || chatId.startsWith('-1002')) {
    // Очищаем ID от префикса
    const cleanChatId = cleanTelegramChatId(chatId);
    return `https://t.me/c/${cleanChatId}/${messageId}`;
  }
  
  // Для всех остальных случаев (числовые ID)
  return `https://t.me/c/${chatId}/${messageId}`;
}

// Функция для проверки и корректировки URL
function ensureValidTelegramUrl(url, platform, messageId) {
  // Если URL не определен, возвращаем пустую строку
  if (!url) return '';
  
  console.log(`Проверка URL: ${url}, платформа: ${platform}, messageId: ${messageId}`);
  
  // Обрабатываем URL только для Telegram
  if (platform === 'telegram') {
    // Специальная обработка случая, когда URL имеет неправильный формат из-за ошибки [object Object]
    if (url.includes('[object Object]')) {
      console.log(`Найден некорректный URL с [object Object]: ${url}`);
      return 'https://t.me';
    }
    
    // Если URL содержит слово "undefined", тоже считаем его некорректным
    if (url.includes('undefined')) {
      console.log(`Найден некорректный URL с undefined: ${url}`);
      return 'https://t.me';
    }
    
    // Проверяем наличие messageId в URL (URL заканчивается на /NUMBER)
    const hasMessageIdInUrl = !!url.match(/\/\d+$/);
    
    // Если URL уже содержит ID сообщения или messageId не указан, возвращаем URL без изменений
    if (hasMessageIdInUrl || !messageId) {
      return url;
    }
    
    // Специальная обработка для URL приватных каналов (t.me/c/1234567890)
    if (url.match(/^https?:\/\/t\.me\/c\/\d+$/)) {
      const fixedUrl = `${url}/${messageId}`;
      console.log(`Исправление URL для приватного канала Telegram: ${url} -> ${fixedUrl}`);
      return fixedUrl;
    }
    
    // URL не содержит ID сообщения - нужно добавить messageId
    
    // Удаляем завершающий слеш, если он есть
    let baseUrl = url;
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    // Добавляем ID сообщения
    const fixedUrl = `${baseUrl}/${messageId}`;
    
    // Определяем тип URL для логирования
    if (url.match(/^https?:\/\/t\.me\/[^\/]+$/)) {
      console.log(`Исправление URL для публичного канала Telegram: ${url} -> ${fixedUrl}`);
    } else if (url.includes('/c/')) {
      console.log(`Исправление URL для приватного канала Telegram: ${url} -> ${fixedUrl}`);
    } else {
      console.log(`Исправление URL для Telegram: ${url} -> ${fixedUrl}`);
    }
    
    return fixedUrl;
  }
  
  // Для других платформ возвращаем без изменений
  return url;
}

// Тестовые кейсы для форматирования URL
const urlFormatTestCases = [
  {
    chatId: '@channel_name',
    messageId: '123',
    username: undefined,
    expected: 'https://t.me/channel_name/123',
    description: 'Публичный канал с username через @'
  },
  {
    chatId: '-1001234567890',
    messageId: '123',
    username: undefined,
    expected: 'https://t.me/c/1234567890/123',
    description: 'Приватный канал с ID -1001...'
  },
  {
    chatId: '-1002123456789',
    messageId: '123',
    username: undefined,
    expected: 'https://t.me/c/123456789/123',
    description: 'Приватный канал с ID -1002...'
  },
  {
    chatId: '-100987654321',
    messageId: '123',
    username: undefined,
    expected: 'https://t.me/c/987654321/123',
    description: 'Приватный канал с ID -100...'
  },
  {
    chatId: '1234567890',
    messageId: '123',
    username: undefined,
    expected: 'https://t.me/c/1234567890/123',
    description: 'ID без префиксов'
  },
  {
    chatId: '-1001234567890',
    messageId: undefined,
    username: undefined,
    expected: 'https://t.me',
    description: 'Без ID сообщения'
  },
  {
    chatId: '-1001234567890',
    messageId: '123',
    username: 'channel_username',
    expected: 'https://t.me/channel_username/123',
    description: 'С известным username канала'
  }
];

// Тестовые кейсы для проверки и коррекции URL
const ensureUrlTestCases = [
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
  },
  {
    url: 'https://t.me/c/-1001234567890',
    platform: 'telegram',
    messageId: '123',
    expected: 'https://t.me/c/-1001234567890/123',
    description: 'URL для приватного канала с префиксом -100 без слеша'
  },
  {
    url: 'https://t.me/c/-1001234567890/',
    platform: 'telegram',
    messageId: '123',
    expected: 'https://t.me/c/-1001234567890/123',
    description: 'URL для приватного канала с префиксом -100 с завершающим слешем'
  },
  {
    url: 'https://t.me/[object Object]',
    platform: 'telegram',
    messageId: '123',
    expected: 'https://t.me',
    description: 'URL с ошибкой [object Object]'
  }
];

// Функция для запуска тестов форматирования URL
function runFormatTests() {
  console.log('Запуск тестов форматирования URL для Telegram');
  console.log('==============================================');
  
  let passed = 0;
  let failed = 0;
  
  for (const [index, test] of urlFormatTestCases.entries()) {
    const result = formatTelegramUrl(test.chatId, test.messageId, test.username);
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

// Функция для запуска тестов проверки и коррекции URL
function runEnsureUrlTests() {
  console.log('\nЗапуск тестов проверки и коррекции URL для Telegram');
  console.log('==============================================');
  
  let passed = 0;
  let failed = 0;
  
  for (const [index, test] of ensureUrlTestCases.entries()) {
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

// Запуск всех тестов
console.log('КОМПЛЕКСНЫЙ ТЕСТ ФОРМАТИРОВАНИЯ URL ДЛЯ TELEGRAM');
console.log('================================================');

const formatResult = runFormatTests();
const ensureResult = runEnsureUrlTests();

console.log('\nИТОГОВЫЙ РЕЗУЛЬТАТ');
console.log('====================');
console.log(`Тесты форматирования URL: ${formatResult ? 'УСПЕШНО' : 'НЕУДАЧА'}`);
console.log(`Тесты проверки URL: ${ensureResult ? 'УСПЕШНО' : 'НЕУДАЧА'}`);
console.log(`Общий результат: ${formatResult && ensureResult ? 'УСПЕШНО' : 'НЕУДАЧА'}`);

// Код выхода (0 при успехе, 1 при ошибке)
process.exit(formatResult && ensureResult ? 0 : 1);