/**
 * Настройка тестового окружения
 * Файл содержит инициализацию данных для тестов и моки
 */
import axios from 'axios';
import dotenv from 'dotenv';
import { DirectusAuthManager } from '../services/directus/directus-auth';
import { DatabaseStorage } from '../storage';

// Загружаем переменные окружения
dotenv.config();

// Глобальные переменные для хранения тестовых данных
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e'; // ID кампании "Правильное питание"
let testStorage: DatabaseStorage;
let directusToken: string | null = null;
let campaignSettings: any = null;

// Проверяем наличие требуемых переменных окружения и инициализируем тесты
beforeAll(async () => {
  // Устанавливаем таймаут для всех тестов
  jest.setTimeout(30000);
  
  // Проверяем наличие переменных окружения для Directus
  const requiredEnvVars = ['DIRECTUS_ADMIN_EMAIL', 'DIRECTUS_ADMIN_PASSWORD'];
  const missingVars = [];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }
  
  if (missingVars.length > 0) {
    console.warn(`ВНИМАНИЕ: Отсутствуют необходимые переменные окружения: ${missingVars.join(', ')}`);
    console.warn('Тесты будут использовать моки вместо реальных API вызовов');
  } else {
    // Инициализируем доступ к Directus
    directusToken = await initializeDirectusAuth();
    
    if (directusToken) {
      // Если получили токен, создаем экземпляр хранилища для доступа к данным
      testStorage = new DatabaseStorage();
      
      // Получаем настройки тестовой кампании для использования в тестах
      try {
        await loadCampaignSettings();
      } catch (error) {
        console.error('Ошибка при загрузке настроек кампании:', error);
      }
    }
  }
});

// Очищаем моки после каждого теста
afterEach(() => {
  jest.clearAllMocks();
});

/**
 * Инициализирует авторизацию Directus из переменных окружения
 * @returns {Promise<string|null>} Токен доступа к Directus или null в случае ошибки
 */
async function initializeDirectusAuth(): Promise<string | null> {
  // Получаем учетные данные из переменных окружения
  const email = process.env.DIRECTUS_ADMIN_EMAIL;
  const password = process.env.DIRECTUS_ADMIN_PASSWORD;
  
  if (!email || !password) {
    console.warn('Отсутствуют учетные данные для Directus');
    return null;
  }
  
  try {
    // Пытаемся авторизоваться в Directus
    console.log('Авторизация в Directus с использованием переменных окружения...');
    
    // Получаем экземпляр менеджера авторизации
    const authManager = DirectusAuthManager.getInstance();
    
    // Выполняем авторизацию
    const result = await authManager.login(email, password);
    
    if (result && result.access_token) {
      console.log('Авторизация в Directus успешна, получен токен доступа');
      return result.access_token;
    } else {
      console.error('Авторизация в Directus не вернула токен доступа');
      return null;
    }
  } catch (error) {
    console.error('Ошибка при авторизации в Directus:', error);
    return null;
  }
}

/**
 * Загружает настройки кампании для использования в тестах
 */
async function loadCampaignSettings() {
  if (!testStorage || !directusToken) {
    console.warn('Невозможно загрузить настройки кампании: отсутствует хранилище или токен доступа');
    return;
  }
  
  try {
    console.log(`Загрузка настроек кампании ${testCampaignId}...`);
    
    // Получаем кампанию с настройками через хранилище
    const campaign = await testStorage.getCampaign(testCampaignId);
    
    if (campaign && campaign.socialMediaSettings) {
      console.log('Настройки кампании загружены успешно');
      console.log(`Обнаружены настройки для платформ: ${Object.keys(campaign.socialMediaSettings).join(', ')}`);
      
      // Сохраняем настройки в глобальных мокированных данных для использования в тестах
      mocks.campaignSettings = campaign.socialMediaSettings;
    } else {
      console.warn('Настройки социальных сетей для кампании не найдены');
    }
  } catch (error) {
    console.error('Ошибка при загрузке настроек кампании:', error);
  }
}

// Экспортируем глобальные моки и утилиты для использования в тестах
export const mocks = {
  // Настройки кампании, будут заполнены при инициализации
  campaignSettings: null as any,
  
  // Функция для получения директус-токена в тестах
  getDirectusToken: () => directusToken,
  
  // Мокированные ответы API на случай, если реальные API недоступны
  apiResponses: {
    telegram: {
      success: {
        ok: true,
        result: {
          message_id: 12345,
          from: { id: 123456789, is_bot: true, first_name: 'TestBot', username: 'test_bot' },
          chat: { id: -1001234567890, title: 'Test Channel', type: 'channel' },
          date: Math.floor(Date.now() / 1000),
          text: 'Test message'
        }
      },
      error: {
        ok: false, 
        error_code: 400, 
        description: 'Bad Request: chat not found'
      }
    },
    vk: {
      success: {
        response: {
          post_id: 12345
        }
      },
      error: {
        error: {
          error_code: 15,
          error_msg: 'Access denied'
        }
      }
    }
  }
};