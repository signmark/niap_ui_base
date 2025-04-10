/**
 * Тест для проверки форматирования URL в Telegram
 * 
 * Используется для проверки правильности обработки разных форматов URL
 */

// Тестовая функция для проверки URL
function ensureValidTelegramUrl(url, platform, messageId) {
  // Если URL не определен, возвращаем пустую строку
  if (!url) return '';
  
  console.log(`Проверка URL: ${url}, платформа: ${platform}, messageId: ${messageId}`);
  
  // Обрабатываем URL только для Telegram
  if (platform === 'telegram') {
    // Проверяем наличие messageId в URL
    const hasMessageIdInUrl = !!url.match(/\/\d+$/); // URL заканчивается на /NUMBER
    
    if (!hasMessageIdInUrl && messageId) {
      // URL не содержит ID сообщения - нужно добавить messageId
      
      // Случай 1: URL для публичного канала без ID сообщения (t.me/channelname)
      if (url.match(/^https?:\/\/t\.me\/[^\/]+$/)) {
        const fixedUrl = `${url}/${messageId}`;
        console.log(`Исправление URL для публичного канала Telegram: ${url} -> ${fixedUrl}`);
        return fixedUrl;
      }
      
      // Случай 2: URL для приватного канала без ID сообщения (t.me/c/123456789)
      if (url.match(/^https?:\/\/t\.me\/c\/\d+$/)) {
        const fixedUrl = `${url}/${messageId}`;
        console.log(`Исправление URL для приватного канала Telegram: ${url} -> ${fixedUrl}`);
        return fixedUrl;
      }
      
      // Общий случай: просто добавляем messageId в конец URL
      if (!url.endsWith('/')) {
        const fixedUrl = `${url}/${messageId}`;
        console.log(`Исправление URL для Telegram (общий случай): ${url} -> ${fixedUrl}`);
        return fixedUrl;
      } else {
        const fixedUrl = `${url}${messageId}`;
        console.log(`Исправление URL для Telegram (с завершающим слешем): ${url} -> ${fixedUrl}`);
        return fixedUrl;
      }
    }
    
    // Специальная обработка случая, когда URL имеет неправильный формат из-за ошибки [object Object]
    if (url.includes('[object Object]')) {
      console.log(`Найден некорректный URL с [object Object]: ${url}`);
      
      // Пытаемся создать корректный URL из доступной информации
      if (messageId) {
        const baseUrl = "https://t.me";
        // Возвращаем базовый URL, так как мы не можем определить ID канала
        return `${baseUrl}`;
      }
    }
  }
  
  // Для других платформ или если URL уже корректный, возвращаем без изменений
  return url;
}

// Тестовые кейсы
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
  },
  {
    url: 'https://t.me/c/-1001234567890',
    platform: 'telegram',
    messageId: '123',
    expected: 'https://t.me/c/-1001234567890/123',
    description: 'URL для приватного канала с префиксом -100'
  },
  {
    url: 'https://t.me/[object Object]',
    platform: 'telegram',
    messageId: '123',
    expected: 'https://t.me',
    description: 'URL с ошибкой [object Object]'
  }
];

// Функция для запуска тестов
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
runTests();