/**
 * Тестируем обработку приватных каналов Telegram
 */

function testPrivateChannelUrl() {
  // Проверка URL из тестового кейса
  const url = 'https://t.me/c/1234567890';
  const messageId = '123';
  
  console.log(`Тест 1: ${url.match(/^https?:\/\/t\.me\/c\/\d+$/) ? 'MATCHED' : 'NOT MATCHED'}`);
  console.log(`Тест 2: ${url.match(/^https?:\/\/t\.me\/c\/[\d-]+$/) ? 'MATCHED' : 'NOT MATCHED'}`);
  console.log(`Тест 3: ${url.includes('/c/') ? 'MATCHED' : 'NOT MATCHED'}`);
  
  const regex1 = /^https?:\/\/t\.me\/c\/\d+$/;
  const regex2 = /^https?:\/\/t\.me\/c\/[\d-]+$/;
  const regex3 = /t\.me\/c\/\d+$/;
  
  console.log(`Подробная проверка regex1: ${regex1.test(url)}`);
  console.log(`Подробная проверка regex2: ${regex2.test(url)}`);
  console.log(`Подробная проверка regex3: ${regex3.test(url)}`);
  
  // Отладка всех частей URL
  const parts = url.split('/');
  console.log('Части URL:', parts);
  
  // Проверяем, есть ли после /c/ числовое значение
  const cIndex = parts.indexOf('c');
  if (cIndex !== -1 && cIndex + 1 < parts.length) {
    const numericPart = parts[cIndex + 1];
    console.log(`Часть после /c/: ${numericPart}, isNumeric: ${!isNaN(numericPart)}`);
  }
  
  console.log('\nТЕСТИРОВАНИЕ ФУНКЦИИ ДЛЯ ИСПРАВЛЕНИЯ URL');
  console.log('=====================================');
  
  function ensureValidTelegramUrl(url, platform, messageId) {
    console.log(`Исходные данные: url=${url}, platform=${platform}, messageId=${messageId}`);
    
    // Проверяем соответствие регулярному выражению для приватного канала
    const isPrivateChannel = url.match(/^https?:\/\/t\.me\/c\/\d+$/);
    console.log(`Это приватный канал? ${isPrivateChannel ? 'Да' : 'Нет'}`);
    
    if (isPrivateChannel && platform === 'telegram' && messageId) {
      const fixedUrl = `${url}/${messageId}`;
      console.log(`Исправленный URL: ${fixedUrl}`);
      return fixedUrl;
    }
    
    console.log('URL остался без изменений');
    return url;
  }
  
  // Явно проверяем наш тестовый URL
  const testUrl = 'https://t.me/c/1234567890';
  const testMessageId = '123';
  const expected = 'https://t.me/c/1234567890/123';
  
  const result = ensureValidTelegramUrl(testUrl, 'telegram', testMessageId);
  console.log(`Результат: ${result}`);
  console.log(`Совпадает с ожиданием? ${result === expected ? 'Да' : 'Нет'}`);
}

// Запуск тестов
console.log('ТЕСТЫ ДЛЯ ПРИВАТНЫХ КАНАЛОВ TELEGRAM');
console.log('===================================');
testPrivateChannelUrl();