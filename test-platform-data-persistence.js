/**
 * Тест для проверки сохранения данных всех платформ после публикации в одну из них
 * Тестирует исправление бага, когда после публикации в Telegram пропадали данные для других платформ
 */

import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Конфигурация
const API_URL = 'http://localhost:5000/api';
const EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'your_password';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e'; // ID кампании "Правильное питание"

// Настройки для тестового контента
const TEST_CONTENT = {
  title: "Тест сохранения данных платформ",
  content: "<p>Этот пост создан для проверки исправления бага с потерей данных платформы.</p>",
  campaign: CAMPAIGN_ID,
  status: "draft",
  // Записываем текущее время и добавляем разное время для разных платформ
  socialPlatforms: {
    telegram: {
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 1 * 60 * 1000).toISOString(), // через 1 минуту
      scheduled_at: new Date(Date.now() + 1 * 60 * 1000).toISOString()
    },
    vk: {
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // через 3 минуты
      scheduled_at: new Date(Date.now() + 3 * 60 * 1000).toISOString()
    }
  }
};

// Функция для логирования с записью в файл
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}`;
  console.log(logEntry);
  fs.appendFileSync('platform-persistence-test.log', logEntry + '\n');
}

// Получение токена авторизации
async function getAuthToken() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    return response.data.data.access_token;
  } catch (error) {
    log(`Ошибка авторизации: ${error.message}`);
    if (error.response) {
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Создание тестового контента
async function createTestContent(token) {
  try {
    const response = await axios.post(
      `${API_URL}/campaign-content`,
      TEST_CONTENT,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    log(`Создан тестовый контент с ID: ${response.data.data.id}`);
    return response.data.data;
  } catch (error) {
    log(`Ошибка создания контента: ${error.message}`);
    if (error.response) {
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Изменение статуса контента на scheduled
async function scheduleContent(contentId, token) {
  try {
    const response = await axios.patch(
      `${API_URL}/campaign-content/${contentId}`,
      { status: 'scheduled' },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    log(`Контент ${contentId} запланирован для публикации`);
    return response.data.data;
  } catch (error) {
    log(`Ошибка планирования контента: ${error.message}`);
    if (error.response) {
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Получение содержимого контента
async function getContentDetails(contentId, token) {
  try {
    const response = await axios.get(
      `${API_URL}/campaign-content/${contentId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data.data;
  } catch (error) {
    log(`Ошибка получения данных контента: ${error.message}`);
    if (error.response) {
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Проверка результатов публикации и вывод в консоль
async function checkPublicationStatus(contentId, token) {
  const MAX_ATTEMPTS = 10;
  const INTERVAL_MS = 30000; // 30 секунд между проверками
  
  let attempt = 0;
  
  // Создаем интервал для периодической проверки
  const checkInterval = setInterval(async () => {
    attempt++;
    log(`Проверка #${attempt} статуса публикации для контента ${contentId}`);
    
    try {
      const content = await getContentDetails(contentId, token);
      const socialPlatforms = typeof content.socialPlatforms === 'string' 
        ? JSON.parse(content.socialPlatforms) 
        : content.socialPlatforms;
      
      log(`Текущие данные socialPlatforms: ${JSON.stringify(socialPlatforms, null, 2)}`);
      
      // Проверяем наличие обеих платформ в данных
      const hasVk = socialPlatforms && socialPlatforms.vk;
      const hasTelegram = socialPlatforms && socialPlatforms.telegram;
      
      if (hasVk && hasTelegram) {
        log(`УСПЕХ: Данные сохранены для обеих платформ после ${attempt} проверок`);
      } else {
        log(`ОШИБКА: Данные потеряны для ${!hasVk ? 'VK' : ''}${!hasVk && !hasTelegram ? ' и ' : ''}${!hasTelegram ? 'Telegram' : ''}`);
      }
      
      // Если Telegram уже опубликован, а VK еще нет, то это идеальный случай для проверки
      if (hasTelegram && hasVk && 
          socialPlatforms.telegram.status === 'published' && 
          socialPlatforms.vk.status === 'scheduled') {
        log(`ТЕСТ ПРОЙДЕН: Telegram опубликован, VK в ожидании и данные сохранены для обеих платформ`);
        clearInterval(checkInterval);
        return;
      }
      
      // Прерываем проверки после достижения максимального количества попыток
      if (attempt >= MAX_ATTEMPTS) {
        log(`Достигнуто максимальное количество проверок (${MAX_ATTEMPTS}). Завершение теста.`);
        clearInterval(checkInterval);
      }
    } catch (error) {
      log(`Ошибка при проверке статуса: ${error.message}`);
      if (attempt >= MAX_ATTEMPTS) {
        clearInterval(checkInterval);
      }
    }
  }, INTERVAL_MS);
}

// Главная функция
async function runTest() {
  try {
    log('Начало теста сохранения данных платформ');
    
    // Получаем токен авторизации
    const token = await getAuthToken();
    log('Успешная авторизация');
    
    // Создаем тестовый контент
    const content = await createTestContent(token);
    log(`Создан контент: ${JSON.stringify(content.socialPlatforms)}`);
    
    // Запланируем публикацию
    await scheduleContent(content.id, token);
    
    // Начинаем проверку результатов публикации
    await checkPublicationStatus(content.id, token);
    
    log('Тест запущен, проверка результатов будет выполняться в фоновом режиме');
  } catch (error) {
    log(`Ошибка при выполнении теста: ${error.message}`);
  }
}

// Запуск теста
runTest();