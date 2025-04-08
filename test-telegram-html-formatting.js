/**
 * Тестовый скрипт для проверки HTML-форматирования в Telegram, используя настройки из Directus
 * Запустите: node test-telegram-html-formatting.js
 */

import axios from 'axios';

// Константы
const API_BASE_URL = process.env.DIRECTUS_URL || 'http://localhost:5000/api';
const EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || '';
const PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || '';

// Вспомогательные функции
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Получение токена для API запросов
async function getAdminToken() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      return response.data.data.access_token;
    } else {
      throw new Error('Failed to get token from response');
    }
  } catch (error) {
    log(`Ошибка авторизации: ${error.message}`);
    if (error.response) {
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Получение настроек кампании из Directus
async function getCampaignSettings(token, campaignId = '46868c44-c6a4-4bed-accf-9ad07bba790e') {
  try {
    const response = await axios.get(`${API_BASE_URL}/items/campaigns/${campaignId}?fields=social_media_settings`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data && response.data.data.social_media_settings) {
      return response.data.data.social_media_settings;
    } else {
      throw new Error('Настройки кампании не найдены');
    }
  } catch (error) {
    log(`Ошибка получения настроек кампании: ${error.message}`);
    if (error.response) {
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Отправка HTML-форматированного сообщения в Telegram
async function sendTelegramHtmlMessage(token, chatId, text) {
  try {
    log(`Отправка HTML-сообщения в Telegram: "${text}"`);
    
    const formattedChatId = chatId.startsWith('@') ? chatId : chatId.startsWith('-100') ? chatId : `-100${chatId}`;
    
    const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: formattedChatId,
      text,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      log(`Сообщение успешно отправлено. ID сообщения: ${response.data.result.message_id}`);
      return true;
    } else {
      log(`Ошибка при отправке: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    log(`Исключение при отправке: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

// Запуск тестов HTML-форматирования
async function runFormattingTests(telegramToken, telegramChatId) {
  const testCases = [
    {
      name: 'Тест 1: Простые теги b и i',
      text: 'Тест 1: <b>Жирный текст</b> и <i>курсивный текст</i>'
    },
    {
      name: 'Тест 2: Вложенные теги',
      text: 'Тест 2: <b>Жирный <i>и курсивный</i> текст</b>'
    },
    {
      name: 'Тест 3: Подчеркивание и зачеркивание',
      text: 'Тест 3: <u>Подчеркнутый текст</u> и <s>зачеркнутый текст</s>'
    },
    {
      name: 'Тест 4: HTML-ссылки',
      text: 'Тест 4: <a href="https://telegram.org">Ссылка на Telegram</a>'
    },
    {
      name: 'Тест 5: Код и пре-форматированный текст',
      text: 'Тест 5: <code>print("Hello World")</code>\n<pre>def hello():\n    print("Hello")</pre>'
    },
    {
      name: 'Тест 6: Теги, которые Telegram не поддерживает',
      text: 'Тест 6: <div>Div-контейнер</div>, <span>Span-элемент</span>, <h1>Заголовок</h1>'
    },
    {
      name: 'Тест 7: Незакрытые теги',
      text: 'Тест 7: <b>Незакрытый жирный тег и <i>вложенный курсивный тег'
    }
  ];
  
  log('Запуск тестов HTML-форматирования в Telegram...');
  
  for (const testCase of testCases) {
    log(`Выполняется ${testCase.name}`);
    const result = await sendTelegramHtmlMessage(telegramToken, telegramChatId, testCase.text);
    log(`Результат: ${result ? 'Успешно' : 'Ошибка'}`);
    
    // Небольшая пауза между сообщениями, чтобы не перегружать API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log('Все тесты завершены');
}

// Главная функция
async function main() {
  try {
    log('Получение токена администратора...');
    const adminToken = await getAdminToken();
    log('Токен администратора получен');
    
    log('Получение настроек кампании...');
    const settings = await getCampaignSettings(adminToken);
    log('Настройки кампании получены');
    
    if (!settings.telegram || !settings.telegram.token || !settings.telegram.chatId) {
      throw new Error('В настройках кампании отсутствуют настройки для Telegram');
    }
    
    log(`Telegram настройки: token=${settings.telegram.token.substring(0, 5)}..., chatId=${settings.telegram.chatId}`);
    
    log('Запуск тестов форматирования...');
    await runFormattingTests(settings.telegram.token, settings.telegram.chatId);
    
    log('Тесты успешно завершены');
  } catch (error) {
    log(`Ошибка при выполнении тестов: ${error.message}`);
  }
}

// Запуск скрипта
main().catch(err => {
  log(`Критическая ошибка: ${err.message}`);
  process.exit(1);
});