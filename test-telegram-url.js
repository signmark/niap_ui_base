/**
 * Тестовый скрипт для проверки формирования URL Telegram
 * Проверяет работу новой логики с generatePostUrl
 */
import { config } from 'dotenv';
import axios from 'axios';

config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Функция для формирования URL Telegram с учетом разных форматов chat ID
function formatTelegramUrl(chatId, messageId, chatUsername) {
  console.log(`Формирование Telegram URL: chatId=${chatId}, messageId=${messageId || 'не указан'}, username=${chatUsername || 'не указан'}`);
  
  // Если ID сообщения не указан, вернем дефолтный URL Telegram
  if (!messageId) {
    console.log('messageId не указан, возвращаем базовый URL для Telegram');
    
    // Если известен username, используем его
    if (chatUsername) {
      return `https://t.me/${chatUsername}`;
    }
    
    // Иначе создаем URL на основе chat ID
    if (chatId.startsWith('@')) {
      // Если ID начинается с @, это username
      return `https://t.me/${chatId.substring(1)}`;
    } else if (chatId.startsWith('-100')) {
      // Если ID начинается с -100, это ID супергруппы
      return `https://t.me/c/${chatId.substring(4)}`;
    } else {
      // В остальных случаях просто дефолтный URL Telegram
      return 'https://t.me';
    }
  }
  
  // Если есть ID сообщения, создаем прямую ссылку на сообщение
  if (chatUsername) {
    // Если известен username, формат: https://t.me/username/messageId
    return `https://t.me/${chatUsername}/${messageId}`;
  }
  
  // Формируем URL на основе chat ID
  if (chatId.startsWith('@')) {
    // Если ID начинается с @, используем username без @
    return `https://t.me/${chatId.substring(1)}/${messageId}`;
  } else if (chatId.startsWith('-100')) {
    // Если ID начинается с -100, это ID супергруппы/канала
    const cleanId = chatId.substring(4);
    return `https://t.me/c/${cleanId}/${messageId}`;
  } else {
    // Для других случаев используем старый формат (может не работать для некоторых групп)
    console.log('Внимание: Нестандартный формат chat_id, URL может быть некорректным');
    return `https://t.me/c/${chatId}/${messageId}`;
  }
}

// Функция для получения информации о чате
async function getChatInfo(chatId, token) {
  try {
    const url = `https://api.telegram.org/bot${token}/getChat`;
    const response = await axios.post(url, { chat_id: chatId });
    
    if (response.status === 200 && response.data && response.data.ok) {
      return response.data.result;
    } else {
      console.error('Ошибка при получении информации о чате:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Исключение при получении информации о чате:', error.message);
    return null;
  }
}

// Функция для генерации URL сообщения
async function generatePostUrl(chatId, messageId) {
  // Получаем информацию о чате для определения username
  const chatInfo = await getChatInfo(chatId, TELEGRAM_BOT_TOKEN);
  const chatUsername = chatInfo?.username;
  
  console.log('Полученная информация о чате:', JSON.stringify(chatInfo, null, 2));
  
  // Используем полученный username для формирования URL
  return formatTelegramUrl(chatId, messageId, chatUsername);
}

// Отправка тестового сообщения в Telegram
async function sendTestMessage() {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Ошибка: не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в .env файле');
      return;
    }
    
    const text = 'Тестовое сообщение для проверки формирования URL Telegram (HTML форматирование: <b>жирный</b>, <i>курсив</i>, <u>подчеркнутый</u>)';
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    console.log(`Отправка сообщения в чат: ${TELEGRAM_CHAT_ID}`);
    
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    });
    
    if (response.status === 200 && response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      console.log(`Сообщение успешно отправлено, ID: ${messageId}`);
      
      // Получаем URL сообщения
      const oldUrl = formatTelegramUrl(TELEGRAM_CHAT_ID, messageId);
      console.log(`Старый метод формирования URL: ${oldUrl}`);
      
      const newUrl = await generatePostUrl(TELEGRAM_CHAT_ID, messageId);
      console.log(`Новый метод формирования URL: ${newUrl}`);
      
      return {
        messageId,
        oldUrl,
        newUrl
      };
    } else {
      console.error('Ошибка при отправке сообщения:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Исключение при отправке сообщения:', error.message);
    return null;
  }
}

// Запуск тестирования
sendTestMessage()
  .then(result => {
    if (result) {
      console.log('=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===');
      console.log(`ID сообщения: ${result.messageId}`);
      console.log(`Старый URL: ${result.oldUrl}`);
      console.log(`Новый URL: ${result.newUrl}`);
    }
  })
  .catch(error => {
    console.error('Ошибка при выполнении теста:', error.message);
  });