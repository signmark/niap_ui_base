/**
 * Тест API приложения для отправки HTML-сообщений в Telegram
 * 
 * Этот скрипт тестирует API вашего приложения, а не напрямую API Telegram
 * Запуск: node test-app-telegram-html.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Базовый URL для API приложения
const API_BASE_URL = 'http://localhost:5000/api';

// ID контента и кампании для тестирования
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || '46868c44-c6a4-4bed-accf-9ad07bba790e';
const CONTENT_ID = '094bb372-d8ae-4759-8d0e-1c6c63391a04'; // ID контента из URL на скриншоте

// Примеры HTML-форматированного текста для тестирования
const TEST_CASES = [
  {
    name: 'Простое форматирование',
    html: '<b>Жирный текст</b> и <i>курсив</i>, <code>моноширинный</code>, <u>подчеркнутый</u> и <a href="https://t.me">ссылка</a>.',
    platform: 'telegram'
  },
  {
    name: 'Сложное форматирование',
    html: `<b>Заголовок жирным</b>

<i>Курсивный подзаголовок с <a href="https://example.com">ссылкой</a></i>

Обычный текст и <code>моноширинный шрифт</code> для кода.

<u>Подчеркнутый список</u>:
• Первый пункт
• Второй <b>жирный</b> пункт
• Третий <i>курсивный</i> пункт

<b><i>Жирный и курсивный одновременно!</i></b>

<a href="https://telegram.org">Посетите сайт Telegram</a>`,
    platform: 'telegram'
  },
  {
    name: 'Незакрытые теги',
    html: `<b>Тест с незакрытым тегом жирного текста и <i>курсива

Внимание! Этот текст должен исправиться нашим API и успешно отправиться через Telegram API.

<u>Еще один незакрытый тег`,
    platform: 'telegram'
  },
  {
    name: 'Вложенное форматирование',
    html: `<b>Жирный текст <i>с курсивом внутри <u>и с подчеркиванием <code>и с кодом</code></u></i></b>

<b>Проверка вложенности:</b>
1. <i>Курсив <b>с жирным</b> внутри</i>
2. <code>Код <i>с курсивом</i> внутри</code>`,
    platform: 'telegram'
  }
];

/**
 * Отправляет HTML-сообщение через API приложения
 * @param {object} testCase Тестовый случай с HTML-контентом
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlViaAppApi(testCase) {
  try {
    console.log(`\nОтправка HTML через API приложения (${testCase.platform}): ${testCase.html.substring(0, 50)}${testCase.html.length > 50 ? '...' : ''}`);
    
    // Используем маршрут API для тестирования публикации на разных платформах
    const response = await axios.post(`${API_BASE_URL}/test/publish-platform`, {
      campaignId: CAMPAIGN_ID,
      contentId: CONTENT_ID,
      platform: testCase.platform,
      content: testCase.html,
      // Для тестирования HTML-форматирования не требуется изображение
      imageUrl: null
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке через API приложения:', error.message);
    if (error.response && error.response.data) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
    }
    return { success: false, error: error.message };
  }
}

/**
 * Тестирует определенный тестовый случай и выводит результат
 * @param {object} testCase Тестовый случай
 * @param {number} index Индекс теста
 * @returns {Promise<void>}
 */
async function runTest(testCase, index) {
  console.log(`\n--- Тест ${index + 1}: ${testCase.name} ---`);
  
  try {
    const result = await sendHtmlViaAppApi(testCase);
    
    if (result.success) {
      console.log('✅ Результат: Успешно');
      console.log(`URL: ${result.postUrl || 'Нет URL'}`);
      
      if (result.details) {
        console.log('Детали:', JSON.stringify(result.details));
      }
    } else {
      console.log('❌ Результат: Ошибка');
      console.log('Детали ошибки:', result.error || 'Неизвестная ошибка');
    }
  } catch (error) {
    console.error('❌ Ошибка при выполнении теста:', error.message);
  }
}

/**
 * Запускает все тестовые случаи последовательно
 */
async function runAllTests() {
  console.log('=== Начало тестирования API приложения для HTML-форматирования ===');
  console.log(`Кампания ID: ${CAMPAIGN_ID}`);
  console.log(`Контент ID: ${CONTENT_ID}`);
  console.log(`URL API: ${API_BASE_URL}`);
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    await runTest(TEST_CASES[i], i);
    
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  console.log('\n=== Завершение тестирования API приложения для HTML-форматирования ===');
}

// Запускаем все тесты
runAllTests();