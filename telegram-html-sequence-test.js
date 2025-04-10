/**
 * Тест для проверки последовательной отправки изображения и HTML-текста в Telegram
 * Проверяет исправление проблемы с сохранением HTML-форматирования в тексте,
 * отправляемом после изображения.
 * 
 * Запуск: node telegram-html-sequence-test.js
 */

import axios from 'axios';

// Получаем токен и chat ID из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

/**
 * Выводит сообщение в консоль с временной меткой
 * @param {string} message Сообщение для вывода
 */
function log(message) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ru-RU', { hour12: false });
  console.log(`[${timeStr}] ${message}`);
}

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixUnclosedTags(html) {
  if (!html) return '';
  
  log(`Исправление незакрытых тегов в HTML: ${html.substring(0, 50)}...`);
  
  // Список поддерживаемых в Telegram тегов
  const supportedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 'code', 'pre', 's', 'strike', 'del', 'a'];
  
  // Соответствие тегов (для стандартизации)
  const tagMapping = {
    'strong': 'b',
    'em': 'i',
    'ins': 'u',
    'strike': 's',
    'del': 's'
  };
  
  // Стек для отслеживания открытых тегов
  const openTags = [];
  
  // Регулярное выражение для поиска всех HTML-тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)(?: [^>]*)?>/gi;
  
  // Подсчет открывающих и закрывающих тегов
  const openingTagsCount = (html.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?>+/gi) || []).length;
  const closingTagsCount = (html.match(/<\/[a-z][a-z0-9]*>/gi) || []).length;
  
  log(`Исходное количество тегов: открывающие=${openingTagsCount}, закрывающие=${closingTagsCount}`);
  
  // Если количество открывающих и закрывающих тегов не совпадает,
  // значит есть незакрытые теги и нужно их исправить
  if (openingTagsCount !== closingTagsCount) {
    log(`Внимание: количество открывающих (${openingTagsCount}) и закрывающих (${closingTagsCount}) HTML-тегов не совпадает. Это может вызвать ошибку при отправке в Telegram.`);
    
    // Проходим по всем тегам и собираем информацию об открытых/закрытых
    let match;
    const matches = [];
    while ((match = tagRegex.exec(html)) !== null) {
      matches.push({
        full: match[0],
        name: match[1].toLowerCase(),
        isClosing: match[0].startsWith('</'),
        index: match.index
      });
    }
    
    // Находим незакрытые теги
    const unclosedTags = [];
    for (const tag of matches) {
      if (!tag.isClosing) {
        // Это открывающий тег
        // Проверяем, поддерживается ли он в Telegram
        if (supportedTags.includes(tag.name) || supportedTags.includes(tagMapping[tag.name])) {
          // Стандартизируем имя тега
          const standardTag = tagMapping[tag.name] || tag.name;
          unclosedTags.push(standardTag);
        }
      } else {
        // Это закрывающий тег
        // Находим соответствующий открывающий тег и удаляем его из списка незакрытых
        const standardTag = tagMapping[tag.name] || tag.name;
        const index = unclosedTags.lastIndexOf(standardTag);
        if (index !== -1) {
          unclosedTags.splice(index, 1);
        }
      }
    }
    
    // Если остались незакрытые теги, добавляем закрывающие теги в конец
    if (unclosedTags.length > 0) {
      log(`Обнаружены незакрытые теги: ${unclosedTags.join(', ')}`);
      
      let fixedHtml = html;
      
      // Добавляем закрывающие теги в обратном порядке
      for (let i = unclosedTags.length - 1; i >= 0; i--) {
        fixedHtml += `</${unclosedTags[i]}>`;
      }
      
      return fixedHtml;
    }
  }
  
  // Если количество тегов совпадает или нет поддерживаемых незакрытых тегов,
  // возвращаем исходный HTML
  return html;
}

/**
 * Отправляет изображение без подписи в Telegram
 * @param {string} imageUrl URL изображения для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithoutCaption(imageUrl) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('Отсутствуют настройки Telegram (TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID)');
    return { success: false, error: 'Missing Telegram settings' };
  }
  
  log(`Отправка изображения без подписи в Telegram: ${imageUrl}`);
  
  try {
    // URL для API Telegram
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    
    // Данные запроса
    const data = {
      chat_id: TELEGRAM_CHAT_ID,
      photo: imageUrl
    };
    
    // Отправляем запрос к API Telegram
    const response = await axios.post(url, data);
    
    // Проверяем ответ
    if (response.data && response.data.ok) {
      log('Изображение успешно отправлено');
      return { 
        success: true,
        messageId: response.data.result.message_id
      };
    } else {
      log(`Ошибка при отправке изображения: ${JSON.stringify(response.data)}`);
      return { 
        success: false, 
        error: response.data?.description || 'Unknown error' 
      };
    }
  } catch (error) {
    log(`Исключение при отправке изображения: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст для отправки
 * @param {boolean} autoFix Автоматически исправлять незакрытые теги
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html, autoFix = true) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('Отсутствуют настройки Telegram (TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID)');
    return { success: false, error: 'Missing Telegram settings' };
  }
  
  // Если нужно, исправляем незакрытые теги
  const textToSend = autoFix ? fixUnclosedTags(html) : html;
  
  log(`Отправка HTML-сообщения в Telegram (${textToSend.length} символов)`);
  log(`Первые 100 символов сообщения: ${textToSend.substring(0, 100)}`);
  
  try {
    // URL для API Telegram
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    // Данные запроса с HTML-форматированием
    const data = {
      chat_id: TELEGRAM_CHAT_ID,
      text: textToSend,
      parse_mode: 'HTML'
    };
    
    // Отправляем запрос к API Telegram
    const response = await axios.post(url, data);
    
    // Проверяем ответ
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`Сообщение успешно отправлено, message_id: ${messageId}`);
      
      return {
        success: true,
        messageId,
        result: response.data.result
      };
    } else {
      log(`Ошибка при отправке сообщения: ${JSON.stringify(response.data)}`);
      
      // Если ошибка связана с HTML-тегами и автоисправление не было применено,
      // пробуем отправить с автоисправлением
      if (!autoFix && response.data?.description?.includes("can't parse entities")) {
        log('Пробуем отправить с автоисправлением HTML-тегов...');
        return sendHtmlMessage(html, true);
      }
      
      return {
        success: false,
        error: response.data?.description || 'Unknown error',
        data: response.data
      };
    }
  } catch (error) {
    log(`Исключение при отправке сообщения: ${error.message}`);
    if (error.response) {
      log(`Статус: ${error.response.status}, данные: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Проверяет отправку изображения и текста с форматированием HTML-тегами последовательно
 */
async function testSequentialMessagesWithFormatting() {
  // Тестовый текст с вложенным форматированием и списками
  const complexHtml = `
<b>Заголовок статьи</b>

Параграф обычного текста, который должен корректно отображаться
после <i>изображения</i>. Также проверим <b>жирный</b> текст и <u>подчеркнутый</u>.

<b>Структурированный список информации:</b>
• Первый пункт простого списка
• <i>Второй пункт списка с курсивом</i>
• <b>Третий пункт списка с жирным текстом</b>

<b>Вложенное форматирование:</b> 
Текст с <b>вложенным <i>форматированием</i> и <u>разными</u> стилями</b> должен 
корректно отображаться в Telegram.
  `;
  
  // URL тестового изображения
  const imageUrl = 'https://i.imgur.com/BVywpYP.jpg';
  
  log('=== ТЕСТИРОВАНИЕ ПОСЛЕДОВАТЕЛЬНОЙ ОТПРАВКИ ИЗОБРАЖЕНИЯ И ФОРМАТИРОВАННОГО ТЕКСТА ===');
  
  // Отправляем изображение без текста
  log('\n--- ЭТАП 1: Отправка изображения ---');
  const imageResult = await sendImageWithoutCaption(imageUrl);
  
  if (!imageResult.success) {
    log('Не удалось отправить изображение, прерываем тест');
    return;
  }
  
  log('\n--- ЭТАП 2: Отправка форматированного HTML-текста ---');
  const textResult = await sendHtmlMessage(complexHtml);
  
  // Итоги теста
  log('\n=== ИТОГИ ТЕСТИРОВАНИЯ ===');
  log(`1. Отправка изображения: ${imageResult.success ? 'УСПЕХ' : 'ОШИБКА'}`);
  log(`2. Отправка HTML-текста: ${textResult.success ? 'УСПЕХ' : 'ОШИБКА'}`);
  
  if (textResult.success && imageResult.success) {
    log('✅ ТЕСТ ПРОЙДЕН: Удалось отправить и изображение, и форматированный HTML-текст последовательно');
  } else {
    log('❌ ТЕСТ НЕ ПРОЙДЕН: Возникли проблемы при отправке последовательных сообщений');
  }
}

// Запускаем тестирование
testSequentialMessagesWithFormatting()
  .then(() => {
    log('Тестирование завершено');
  })
  .catch(error => {
    log(`Ошибка при выполнении теста: ${error.message}`);
  });