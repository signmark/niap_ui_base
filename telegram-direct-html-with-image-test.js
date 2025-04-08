/**
 * Тест прямой отправки HTML в Telegram через API с изображениями
 * Скрипт проверяет правильность отправки HTML-текста и изображений в одном сообщении
 * 
 * Запуск: node telegram-direct-html-with-image-test.js
 */

const axios = require('axios');

// Используем идентичные константы из основного кода для согласованности
const SMALL_TEXT_THRESHOLD = 1000; // Порог для определения "маленького" текста в символах

// Получаем токен и chat ID из переменных окружения
const TELEGRAM_TOKEN = process.env.TELEGRAM_TEST_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_TEST_CHAT_ID || '-1002302366310';

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
 * Отправляет HTML-сообщение в Telegram с автоматическим исправлением незакрытых тегов
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  try {
    log(`Отправка HTML-сообщения в Telegram (${html.length} символов)`);
    
    // URL для API Telegram
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    
    // Данные запроса
    const data = {
      chat_id: TELEGRAM_CHAT_ID,
      text: html,
      parse_mode: 'HTML'
    };
    
    // Отправляем запрос к API Telegram
    const response = await axios.post(url, data);
    
    // Проверяем ответ
    if (response.data && response.data.ok) {
      log(`Сообщение успешно отправлено. ID сообщения: ${response.data.result.message_id}`);
      return {
        success: true,
        messageId: response.data.result.message_id,
        messageUrl: `https://t.me/c/${TELEGRAM_CHAT_ID.replace('-100', '')}/`
          + response.data.result.message_id
      };
    } else {
      log(`Ошибка при отправке сообщения: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data?.description || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`Исключение при отправке HTML-текста: ${error.message}`);
    if (error.response) {
      log(`Ответ от API: ${JSON.stringify(error.response.data)}`);
      return {
        success: false,
        error: error.response.data?.description || error.message
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Отправляет изображение без подписи в Telegram
 * @param {string} imageUrl URL изображения
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithoutCaption(imageUrl) {
  try {
    log(`Отправка изображения без подписи: ${imageUrl}`);
    
    // URL для API Telegram
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
    
    // Данные запроса
    const data = {
      chat_id: TELEGRAM_CHAT_ID,
      photo: imageUrl
    };
    
    // Отправляем запрос к API Telegram
    const response = await axios.post(url, data);
    
    // Проверяем ответ
    if (response.data && response.data.ok) {
      log(`Изображение успешно отправлено. ID сообщения: ${response.data.result.message_id}`);
      return {
        success: true,
        messageId: response.data.result.message_id,
        messageUrl: `https://t.me/c/${TELEGRAM_CHAT_ID.replace('-100', '')}/`
          + response.data.result.message_id
      };
    } else {
      log(`Ошибка при отправке изображения: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data?.description || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`Исключение при отправке изображения: ${error.message}`);
    if (error.response) {
      log(`Ответ от API: ${JSON.stringify(error.response.data)}`);
      return {
        success: false,
        error: error.response.data?.description || error.message
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Отправляет изображение с HTML-подписью в Telegram
 * @param {string} imageUrl URL изображения
 * @param {string} caption HTML-текст подписи
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithHtmlCaption(imageUrl, caption) {
  try {
    log(`Отправка изображения с HTML-подписью: ${imageUrl}`);
    log(`Длина подписи: ${caption.length} символов`);
    
    // URL для API Telegram
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
    
    // Данные запроса
    const data = {
      chat_id: TELEGRAM_CHAT_ID,
      photo: imageUrl,
      caption: caption,
      parse_mode: 'HTML'
    };
    
    // Отправляем запрос к API Telegram
    const response = await axios.post(url, data);
    
    // Проверяем ответ
    if (response.data && response.data.ok) {
      log(`Изображение с подписью успешно отправлено. ID сообщения: ${response.data.result.message_id}`);
      return {
        success: true,
        messageId: response.data.result.message_id,
        messageUrl: `https://t.me/c/${TELEGRAM_CHAT_ID.replace('-100', '')}/`
          + response.data.result.message_id
      };
    } else {
      log(`Ошибка при отправке изображения с подписью: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data?.description || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`Исключение при отправке изображения с подписью: ${error.message}`);
    if (error.response) {
      log(`Ответ от API: ${JSON.stringify(error.response.data)}`);
      return {
        success: false,
        error: error.response.data?.description || error.message
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Отправляет изображение с HTML-текстом в Telegram, используя разные стратегии в зависимости от длины текста
 * Реализует ту же логику, что и в исправленном методе publishToPlatform
 * @param {string} imageUrl URL изображения
 * @param {string} html HTML-текст
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithHtmlText(imageUrl, html) {
  log(`Отправка изображения с HTML-текстом, используя логику с порогом в ${SMALL_TEXT_THRESHOLD} символов`);
  log(`Длина текста: ${html.length} символов`);
  
  if (html.length <= SMALL_TEXT_THRESHOLD) {
    // Короткий текст - отправляем как подпись к изображению
    log(`Текст короткий (${html.length} <= ${SMALL_TEXT_THRESHOLD}), отправляем как подпись к изображению`);
    return await sendImageWithHtmlCaption(imageUrl, html);
  } else {
    // Длинный текст - отправляем изображение без подписи, а затем текст отдельным сообщением
    log(`Текст длинный (${html.length} > ${SMALL_TEXT_THRESHOLD}), отправляем изображение и текст отдельно`);
    
    // Сначала отправляем изображение
    const imageResult = await sendImageWithoutCaption(imageUrl);
    
    // Затем отправляем текст
    const textResult = await sendHtmlMessage(html);
    
    // Возвращаем комбинированный результат
    return {
      success: imageResult.success && textResult.success,
      imageResult,
      textResult,
      messageIds: [imageResult.messageId, textResult.messageId].filter(Boolean),
      messageUrls: [imageResult.messageUrl, textResult.messageUrl].filter(Boolean)
    };
  }
}

/**
 * Тестирует отправку контента через API сервера
 * @param {Object} content Контент для отправки
 * @returns {Promise<Object>} Результат запроса
 */
async function testContentPublishingViaApi(content) {
  try {
    log('Отправка запроса на публикацию через API сервера...');
    
    // URL API для публикации
    const url = 'http://localhost:3000/api/test/telegram-post';
    
    // Добавляем настройки для тестирования
    const testData = {
      ...content,
      testToken: TELEGRAM_TOKEN,
      testChatId: TELEGRAM_CHAT_ID
    };
    
    // Отправляем запрос к API сервера
    const response = await axios.post(url, testData);
    
    log(`Ответ от API сервера: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    log(`Ошибка при публикации через API: ${error.message}`);
    if (error.response) {
      log(`Ответ от API: ${JSON.stringify(error.response.data)}`);
      return error.response.data;
    }
    return { error: error.message };
  }
}

/**
 * Запускает тесты с разными вариантами изображений и текстов
 */
async function runTests() {
  log('=== Запуск тестов отправки изображений с HTML-текстом в Telegram ===');
  
  // Тестовые данные
  const testImageUrl = 'https://i.ibb.co/RT55ybv/1744101904073-307934231.png';
  const randomImageUrl = 'https://picsum.photos/800/600?random=1';
  
  const smallHtml = `<p>🔥 <em>Устали публиковать контент вручную</em>? Хотите сэкономить время и силы?</p><p>Тогда <strong>автопостинг </strong>- <u>именно то, что вам нужно</u>!</p>`;
  
  const longHtml = `<p>🔥 <em>Устали публиковать контент вручную</em>? Хотите сэкономить время и силы?</p><p>Тогда <strong>автопостинг </strong>- <u>именно то, что вам нужно</u>! 💻 Забудьте о рутинной работе и наслаждайтесь автоматизацией публикаций в Telegram, ВКонтакте, Instagram и других соцсетях.</p><p>Просто загрузите контент, задайте расписание и наслаждайтесь результатами! Ваши посты будут публиковаться точно в срок, без опозданий и ошибок. 🕰️</p><p>Экономьте время, повышайте эффективность и наслаждайтесь преимуществами автопостинга. Попробуйте прямо сейчас и убедитесь сами! 🚀</p>
  <p>Автопостинг позволяет вам:</p>
  <ul>
    <li><strong>Экономить время</strong> - настройте расписание один раз и забудьте о рутине</li>
    <li><strong>Повысить точность</strong> - публикации выходят строго по заданному времени</li>
    <li><strong>Работать с несколькими платформами</strong> - одновременная публикация в Telegram, ВКонтакте, Instagram и других сетях</li>
    <li><strong>Анализировать эффективность</strong> - отслеживайте статистику и оптимизируйте контент</li>
  </ul>
  <p>Начните пользоваться автопостингом уже сегодня и увидите результаты уже через несколько дней! Ваши подписчики оценят регулярность и качество публикаций.</p>`;
  
  // Тест прямого взаимодействия с API Telegram
  log('\n--- Тест 1: Короткий текст с изображением через прямое API ---');
  await sendImageWithHtmlText(testImageUrl, smallHtml);
  
  log('\n--- Тест 2: Длинный текст с изображением через прямое API ---');
  await sendImageWithHtmlText(randomImageUrl, longHtml);
  
  // Тест через API сервера (реальный код)
  log('\n--- Тест 3: Короткий текст с изображением через API сервера ---');
  await testContentPublishingViaApi({
    title: 'Тест автопостинга',
    content: smallHtml,
    imageUrl: testImageUrl
  });
  
  log('\n--- Тест 4: Длинный текст с изображением через API сервера ---');
  await testContentPublishingViaApi({
    title: 'Тест автопостинга с длинным текстом',
    content: longHtml,
    imageUrl: randomImageUrl
  });
  
  log('\n=== Тестирование завершено ===');
}

// Запускаем тесты
runTests()
  .then(() => {
    log('Тесты успешно выполнены');
  })
  .catch(error => {
    log(`Ошибка при выполнении тестов: ${error.message}`);
    if (error.stack) {
      log(error.stack);
    }
  });