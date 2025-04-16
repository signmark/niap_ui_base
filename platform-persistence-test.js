/**
 * Скрипт для тестирования сохранения информации о платформах в функции updatePublicationStatus
 * Имитирует процесс публикации в Telegram, а затем проверяет, что информация о других платформах сохранилась
 */

import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Получаем текущую директорию для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Константы для тестирования
const DIRECTUS_URL = process.env.DIRECTUS_API_URL || 'https://directus.nplanner.ru';
const EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e'; // ID тестовой кампании "Правильное питание"

// Фунуция для логирования с поддержкой сохранения в файл
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Записываем в файл
  fs.appendFileSync('platform-persistence-test.log', logMessage + '\n');
}

// Авторизация в Directus
async function authenticate() {
  try {
    log('Авторизация в Directus...');
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('Авторизация успешна');
      return response.data.data.access_token;
    } else {
      log('Ошибка авторизации: неожиданный формат ответа');
      return null;
    }
  } catch (error) {
    log(`Ошибка авторизации: ${error.message}`);
    return null;
  }
}

// Создание тестового контента с несколькими платформами
async function createTestContent(token) {
  try {
    log('Создание тестового контента с несколькими платформами...');
    
    // Текущее время для уникальности
    const now = new Date();
    const timeStr = now.toISOString();
    
    // Время публикации для разных платформ
    const telegramTime = new Date(now.getTime() + 1 * 60 * 1000); // Telegram через 1 минуту
    const vkTime = new Date(now.getTime() + 5 * 60 * 1000);       // VK через 5 минут
    const instagramTime = new Date(now.getTime() + 10 * 60 * 1000); // Instagram через 10 минут
    
    // Социальные платформы для теста
    const socialPlatforms = {
      telegram: {
        status: 'scheduled',
        scheduledAt: telegramTime.toISOString(),
        chatId: '@test_channel'
      },
      vk: {
        status: 'scheduled',
        scheduledAt: vkTime.toISOString(),
        groupId: '123456789'
      },
      instagram: {
        status: 'scheduled',
        scheduledAt: instagramTime.toISOString(),
        accountId: '987654321'
      }
    };
    
    // Создаем тестовый контент
    const content = {
      title: `Тест сохранения платформ ${timeStr}`,
      content: `Это тестовый контент для проверки сохранения информации о платформах. Создан: ${timeStr}`,
      campaign_id: CAMPAIGN_ID, // snake_case для Directus API
      status: 'scheduled',
      content_type: 'text', // snake_case для Directus API
      image_url: 'https://picsum.photos/800/600', // snake_case для Directus API
      social_platforms: socialPlatforms, // snake_case для Directus API
      user_id: '53921f16-f51d-4591-80b9-8caa4fde4d13' // ID пользователя для теста
    };
    
    // Отправляем запрос на создание
    const response = await axios.post(`${DIRECTUS_URL}/items/campaign_content`, content, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data && response.data.data.id) {
      log(`Тестовый контент успешно создан с ID: ${response.data.data.id}`);
      return {
        contentId: response.data.data.id,
        socialPlatforms
      };
    } else {
      log('Ошибка создания контента: неожиданный формат ответа');
      return null;
    }
  } catch (error) {
    log(`Ошибка создания контента: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

// Имитация публикации в Telegram
async function simulateTelegramPublication(contentId, token) {
  try {
    log(`Имитация публикации в Telegram для контента ${contentId}...`);
    
    // Создаем результат публикации
    const publicationResult = {
      platform: 'telegram',
      status: 'published',
      publishedAt: new Date().toISOString(),
      postUrl: 'https://t.me/test_channel/12345',
      messageId: 12345
    };
    
    // Отправляем запрос для обновления статуса
    const response = await axios.post(`http://localhost:5000/api/publication/update-status`, {
      contentId: contentId,
      platform: 'telegram',
      publicationResult: publicationResult
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    log(`Результат обновления статуса: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    log(`Ошибка при имитации публикации: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

// Проверка состояния контента после публикации
async function checkContentStatus(contentId, token) {
  try {
    log(`Проверка состояния контента ${contentId} после публикации...`);
    
    // Получаем актуальное состояние контента
    const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      const content = response.data.data;
      log(`Статус контента: ${content.status}`);
      
      // Проверяем socialPlatforms
      let socialPlatforms = content.social_platforms;
      if (typeof socialPlatforms === 'string') {
        try {
          socialPlatforms = JSON.parse(socialPlatforms);
        } catch (e) {
          log(`Ошибка парсинга JSON social_platforms: ${e}`);
          return false;
        }
      }
      
      log(`Платформы после публикации: ${JSON.stringify(socialPlatforms)}`);
      
      // Проверяем наличие всех платформ
      const platforms = Object.keys(socialPlatforms);
      log(`Найдено платформ: ${platforms.length} (${platforms.join(', ')})`);
      
      // Проверяем, что Telegram опубликован, а остальные платформы сохранились
      const telegramPublished = socialPlatforms.telegram && socialPlatforms.telegram.status === 'published';
      const vkPreserved = socialPlatforms.vk && socialPlatforms.vk.status === 'scheduled';
      const instagramPreserved = socialPlatforms.instagram && socialPlatforms.instagram.status === 'scheduled';
      
      log(`Проверка статусов:
      - Telegram опубликован: ${telegramPublished}
      - VK сохранен: ${vkPreserved}
      - Instagram сохранен: ${instagramPreserved}`);
      
      // Общий результат теста
      const testPassed = telegramPublished && vkPreserved && instagramPreserved;
      return {
        contentId,
        status: content.status,
        platforms: platforms,
        telegramPublished,
        vkPreserved,
        instagramPreserved,
        testPassed,
        socialPlatforms
      };
    } else {
      log('Ошибка получения контента: неожиданный формат ответа');
      return null;
    }
  } catch (error) {
    log(`Ошибка при проверке состояния контента: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

// Основная функция для запуска теста
async function runTest() {
  // Очищаем лог-файл перед запуском
  fs.writeFileSync('platform-persistence-test.log', '');
  
  log('=== НАЧАЛО ТЕСТА СОХРАНЕНИЯ ИНФОРМАЦИИ О ПЛАТФОРМАХ ===');
  
  // Шаг 1: Авторизация
  const token = await authenticate();
  if (!token) {
    log('Тест прерван: ошибка авторизации');
    return;
  }
  
  // Шаг 2: Создание тестового контента
  const testContent = await createTestContent(token);
  if (!testContent) {
    log('Тест прерван: ошибка создания тестового контента');
    return;
  }
  
  const { contentId, socialPlatforms } = testContent;
  
  // Шаг 3: Имитация публикации в Telegram
  const publicationResult = await simulateTelegramPublication(contentId, token);
  if (!publicationResult) {
    log('Тест прерван: ошибка при имитации публикации');
    return;
  }
  
  // Шаг 4: Проверка состояния контента после публикации
  const statusResult = await checkContentStatus(contentId, token);
  if (!statusResult) {
    log('Тест прерван: ошибка при проверке состояния контента');
    return;
  }
  
  // Шаг 5: Вывод результатов теста
  log('=== РЕЗУЛЬТАТЫ ТЕСТА ===');
  log(`Тест ID: ${contentId}`);
  log(`Общий статус теста: ${statusResult.testPassed ? 'УСПЕШНО' : 'НЕУДАЧНО'}`);
  
  log(`Статус контента: ${statusResult.status}`);
  log(`Найденные платформы: ${statusResult.platforms.join(', ')}`);
  
  log(`Детали проверки:
  - Telegram опубликован: ${statusResult.telegramPublished}
  - VK сохранен: ${statusResult.vkPreserved}
  - Instagram сохранен: ${statusResult.instagramPreserved}`);
  
  // Сохраняем детальные результаты в файл
  fs.writeFileSync('platform-persistence-result.json', JSON.stringify({
    initialState: {
      contentId,
      socialPlatforms
    },
    finalState: statusResult,
    testPassed: statusResult.testPassed
  }, null, 2));
  
  log('Детальные результаты сохранены в файл platform-persistence-result.json');
  log('=== ЗАВЕРШЕНИЕ ТЕСТА ===');
}

// Запускаем тест
runTest();