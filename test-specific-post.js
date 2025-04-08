/**
 * Скрипт для тестирования отправки конкретного поста с ID 094bb372-d8ae-4759-8d0e-1c6c63391a04
 * Использует API приложения для отправки
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Настраиваем dotenv
dotenv.config();

// Константы
const CONTENT_ID = '094bb372-d8ae-4759-8d0e-1c6c63391a04';
const BASE_URL = 'https://b97f8d4a-3eb5-439c-9956-3cacfdeb3f2a-00-30nikq0wek8gj.picard.replit.dev/api';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Логгер с временной меткой
 */
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Получает информацию о контенте из Directus
 */
async function getContentData() {
  try {
    log(`Получение информации о контенте с ID: ${CONTENT_ID}`);
    
    // Сначала получаем токен авторизации
    log('Отправка запроса авторизации...');
    
    const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'lbrspb@gmail.com',
      password: 'QtpZ3dh7'
    });
    
    log('Получен ответ авторизации');
    log(`Статус: ${authResponse.status}`);
    log(`Содержимое ответа: ${JSON.stringify(authResponse.data)}`);
    log('Структура ответа:');
    for (const key in authResponse.data) {
      log(`  - ${key}: ${typeof authResponse.data[key]}`);
    }
    
    if (!authResponse.data || !authResponse.data.access_token) {
      throw new Error('Не удалось получить токен авторизации');
    }
    
    const token = authResponse.data.access_token;
    log('Успешная авторизация, получен токен');
    
    // Получаем данные контента
    const contentResponse = await axios.get(`${BASE_URL}/campaign-content/${CONTENT_ID}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!contentResponse.data) {
      throw new Error('Не удалось получить данные контента');
    }
    
    const content = contentResponse.data;
    log(`Получены данные контента: "${content.title && content.title.substring(0, 30) || 'Без заголовка'}..."`);
    
    return { content, token };
  } catch (error) {
    log(`Ошибка при получении данных контента: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Отправляет контент в Telegram
 */
async function publishToTelegram(content, token) {
  try {
    log('Отправка контента в Telegram...');
    
    const response = await axios.post(`${BASE_URL}/publish`, {
      contentId: CONTENT_ID,
      platforms: ['telegram'],
      forcePublish: true,
      telegramSettings: {
        token: TELEGRAM_BOT_TOKEN,
        chatId: TELEGRAM_CHAT_ID
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.success) {
      log('Контент успешно опубликован в Telegram');
      
      if (response.data.results && response.data.results.telegram) {
        const telegramResult = response.data.results.telegram;
        log(`Telegram message ID: ${telegramResult.messageId}`);
        log(`Telegram URL: ${telegramResult.postUrl}`);
      }
      
      return true;
    } else {
      throw new Error(`Ошибка при публикации: ${response.data.error || 'Неизвестная ошибка'}`);
    }
  } catch (error) {
    log(`Ошибка при публикации в Telegram: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Отправляет контент с изображением в Telegram
 */
async function publishImageToTelegram(content, token, imageUrl) {
  try {
    log('Отправка контента с изображением в Telegram...');
    log(`Используемый URL изображения: ${imageUrl}`);
    
    // Создаем копию контента и добавляем изображение
    const contentWithImage = {
      ...content,
      imageUrl: imageUrl
    };
    
    // Проверяем данные для отладки
    log(`Контент для отправки: ID=${contentWithImage.id}, title=${contentWithImage.title?.substring(0, 30) || 'Без заголовка'}`);
    log(`Изображение: ${contentWithImage.imageUrl}`);
    
    const response = await axios.post(`${BASE_URL}/publish`, {
      contentId: CONTENT_ID,
      platforms: ['telegram'],
      forcePublish: true,
      telegramSettings: {
        token: TELEGRAM_BOT_TOKEN,
        chatId: TELEGRAM_CHAT_ID
      },
      // Передаем контент напрямую, чтобы включить изображение
      content: contentWithImage
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.success) {
      log('Контент с изображением успешно опубликован в Telegram');
      
      if (response.data.results && response.data.results.telegram) {
        const telegramResult = response.data.results.telegram;
        log(`Telegram message ID: ${telegramResult.messageId}`);
        log(`Telegram URL: ${telegramResult.postUrl}`);
      }
      
      return true;
    } else {
      throw new Error(`Ошибка при публикации с изображением: ${response.data.error || 'Неизвестная ошибка'}`);
    }
  } catch (error) {
    log(`Ошибка при публикации с изображением в Telegram: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Прямая отправка HTML-контента в Telegram
 */
async function sendDirectToTelegram(content) {
  try {
    log('Прямая отправка HTML в Telegram...');
    
    // Преобразование HTML-формата для Telegram
    const html = content.content
      .replace(/<p>/g, '')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<em>/g, '<i>')
      .replace(/<\/em>/g, '</i>')
      .replace(/<strong>/g, '<b>')
      .replace(/<\/strong>/g, '</b>')
      .trim();
    
    log(`Форматированный HTML: ${html.substring(0, 100)}...`);
    
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: html,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      log('Сообщение успешно отправлено напрямую в Telegram');
      const message = response.data.result;
      log(`Message ID: ${message.message_id}`);
      
      // Формируем URL сообщения
      let messageUrl;
      if (TELEGRAM_CHAT_ID.startsWith('-100')) {
        // Убираем первые 4 символа (-100) для формирования URL
        const chatIdForUrl = TELEGRAM_CHAT_ID.substring(4);
        messageUrl = `https://t.me/c/${chatIdForUrl}/${message.message_id}`;
      } else {
        messageUrl = `https://t.me/${TELEGRAM_CHAT_ID}/${message.message_id}`;
      }
      
      log(`URL сообщения: ${messageUrl}`);
      return true;
    } else {
      throw new Error('Ошибка при отправке сообщения');
    }
  } catch (error) {
    log(`Ошибка при прямой отправке в Telegram: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Ответ API Telegram: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Прямая отправка заданного HTML в Telegram
 */
async function sendHtmlToTelegram(html) {
  try {
    log('Отправка заданного HTML в Telegram...');
    log(`Исходный HTML: ${html.substring(0, 100)}...`);
    
    // Преобразование HTML-формата для Telegram
    const formattedHtml = html
      .replace(/<p>/g, '')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<em>/g, '<i>')
      .replace(/<\/em>/g, '</i>')
      .replace(/<strong>/g, '<b>')
      .replace(/<\/strong>/g, '</b>')
      .trim();
    
    log(`Форматированный HTML: ${formattedHtml.substring(0, 100)}...`);
    
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: formattedHtml,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      log('Сообщение успешно отправлено напрямую в Telegram');
      const message = response.data.result;
      log(`Message ID: ${message.message_id}`);
      
      // Формируем URL сообщения
      let messageUrl;
      if (TELEGRAM_CHAT_ID.startsWith('-100')) {
        // Убираем первые 4 символа (-100) для формирования URL
        const chatIdForUrl = TELEGRAM_CHAT_ID.substring(4);
        messageUrl = `https://t.me/c/${chatIdForUrl}/${message.message_id}`;
      } else {
        messageUrl = `https://t.me/${TELEGRAM_CHAT_ID}/${message.message_id}`;
      }
      
      log(`URL сообщения: ${messageUrl}`);
      return true;
    } else {
      throw new Error('Ошибка при отправке сообщения');
    }
  } catch (error) {
    log(`Ошибка при прямой отправке HTML в Telegram: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Ответ API Telegram: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Главная функция
 */
async function main() {
  log('=== Тестирование отправки конкретного поста ===');
  
  // Публикация с HTML-разметкой, которую вы указали
  log('\n--- Тест 1: Отправка заданного HTML в Telegram ---');
  const givenHtml = `<p>🔥 <em>Устали публиковать контент вручную</em>? Хотите сэкономить время и силы?</p><p>Тогда <strong>автопостинг </strong>- <u>именно то, что вам нужно</u>! 💻 Забудьте о рутинной работе и наслаждайтесь автоматизацией публикаций в Telegram, ВКонтакте, Instagram и других соцсетях.</p><p>Просто загрузите контент, задайте расписание и наслаждайтесь результатами! Ваши посты будут публиковаться точно в срок, без опозданий и ошибок. 🕰️</p><p>Экономьте время, повышайте эффективность и наслаждайтесь преимуществами автопостинга. Попробуйте прямо сейчас и убедитесь сами! 🚀</p>`;
  
  await sendHtmlToTelegram(givenHtml);
  
  // Получение и публикация контента из Directus
  log('\n--- Тест 2: Получение и публикация контента из Directus ---');
  const result = await getContentData();
  
  if (result) {
    const { content, token } = result;
    
    // Вариант 1: Публикация через API приложения
    log('\n--- Тест 2.1: Публикация через API приложения ---');
    await publishToTelegram(content, token);
    
    // Вариант 2: Прямая отправка в Telegram
    log('\n--- Тест 2.2: Прямая отправка в Telegram ---');
    await sendDirectToTelegram(content);
    
    // Тест 3: Отправка контента с изображением
    log('\n--- Тест 3: Отправка контента с изображением через API ---');
    // Использовать URL изображения из ваших ресурсов
    const testImageUrl = 'https://i.ibb.co/RT55ybv/1744101904073-307934231.png';
    await publishImageToTelegram(content, token, testImageUrl);
    
    // Тест 4: Отправка с другим изображением
    log('\n--- Тест 4: Отправка контента с другим изображением ---');
    const anotherImageUrl = 'https://picsum.photos/800/600?random=1';
    await publishImageToTelegram(content, token, anotherImageUrl);
  }
  
  log('\n=== Тестирование завершено ===');
}

// Запуск главной функции
main().catch(error => {
  console.error('Ошибка при выполнении скрипта:', error);
});

export {};