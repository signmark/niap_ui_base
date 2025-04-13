/**
 * Тест для полной проверки цепочки генерации URL
 * 1. Сервер генерирует URL с message_id
 * 2. Клиент получает и форматирует URL для отображения
 */

// Создаем тестовые данные
const messageId = '12345';
const chatId = '-1002302366310';

console.log('🔍 Тест полной цепочки генерации URL Telegram');
console.log(`📋 Исходные данные: chatId=${chatId}, messageId=${messageId}`);

// Функция, которая имитирует серверный код (из telegram-service.ts)
function formatTelegramUrlServer(chatId, messageId) {
  if (!chatId || !messageId) {
    console.log('⚠️ chatId или messageId не указаны');
    return null;
  }
  
  // Определяем базовый URL
  let baseUrl = '';
  
  // Если это username (начинается с @), удаляем @ и не добавляем /c/
  if (chatId.startsWith('@')) {
    baseUrl = `https://t.me/${chatId.substring(1)}`;
  }
  // Для числовых ID проверяем, нужен ли префикс /c/
  else {
    // Проверяем, является ли chatId полным числовым идентификатором канала
    const isFullNumericId = chatId.startsWith('-100');
    
    if (isFullNumericId) {
      const channelId = chatId.substring(4); // Убираем префикс -100
      baseUrl = `https://t.me/c/${channelId}`;
    } else if (chatId.startsWith('-')) {
      const channelId = chatId.substring(1); // Убираем префикс -
      baseUrl = `https://t.me/c/${channelId}`;
    } else {
      baseUrl = `https://t.me/${chatId}`;
    }
  }
  
  // Создаем полный URL с ID сообщения
  return `${baseUrl}/${messageId}`;
}

// Функция, которая имитирует клиентский код (из ScheduledPostInfo.tsx)
const formatTelegramUrlClient = (url) => {
  if (!url) return null;
  if (!url.includes('t.me')) return url;
  
  try {
    // Разбираем URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts.length === 0) return url;
    
    // ИСПРАВЛЕНИЕ: особый случай для URL вида https://t.me/-1002302366310
    // Формат отрицательных ID каналов/групп
    if (pathParts[0].startsWith('-100')) {
      // Отрицательные ID с -100 нужно форматировать в виде https://t.me/c/ID_БЕЗ_МИНУС_100
      const channelId = pathParts[0].substring(4); // Убираем -100
      const messageId = pathParts.length > 1 ? pathParts[1] : '';
      return `https://t.me/c/${channelId}${messageId ? `/${messageId}` : ''}`;
    }
    
    // ИСПРАВЛЕНИЕ: особый случай для других отрицательных ID
    if (pathParts[0].startsWith('-') && !pathParts[0].startsWith('-100')) {
      // Отрицательные ID нужно форматировать в виде https://t.me/c/ID_БЕЗ_МИНУСА
      const channelId = pathParts[0].substring(1); // Убираем только минус
      const messageId = pathParts.length > 1 ? pathParts[1] : '';
      return `https://t.me/c/${channelId}${messageId ? `/${messageId}` : ''}`;
    }
    
    return url;
  } catch (error) {
    console.error('Ошибка при форматировании URL Telegram:', error);
    return url;
  }
};

// Имитируем процесс:
// 1. Сервер генерирует URL с отрицательным ID чата
const serverGeneratedUrl = formatTelegramUrlServer(chatId, messageId);
console.log('📋 URL, сгенерированный сервером:', serverGeneratedUrl);

// 2. Клиент получает URL и форматирует его для отображения
const clientFormattedUrl = formatTelegramUrlClient(serverGeneratedUrl);
console.log('📋 URL, отформатированный клиентом:', clientFormattedUrl);

// 3. Проверяем результат
const expectedUrl = 'https://t.me/c/2302366310/12345';
if (clientFormattedUrl === expectedUrl) {
  console.log('✅ URL сформирован правильно!');
} else {
  console.log(`❌ URL сформирован неправильно! Ожидалось: ${expectedUrl}, Получено: ${clientFormattedUrl}`);
}

console.log('🏁 Тест успешно завершен!');