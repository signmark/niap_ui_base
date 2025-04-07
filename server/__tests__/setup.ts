/**
 * Настройка тестового окружения
 * Файл содержит инициализацию данных для тестов и моки
 */
import axios from 'axios';
import dotenv from 'dotenv';
// Правильный путь к DirectusAuthManager
import { DirectusAuthManager } from '../services/directus/directus-auth-manager';
import { DatabaseStorage } from '../storage';

// Загружаем переменные окружения
dotenv.config();

// Глобальные переменные для хранения тестовых данных
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e'; // ID кампании "Правильное питание"
let testStorage: DatabaseStorage;
let directusToken: string | null = null;
let campaignSettings: any = null;

// Хранилище для API ключей внешних сервисов
export const apiKeys = {
  perplexity: '',
  apify: '',
  deepseek: '',
  falai: '',
  claude: '',
  xmlriver: {
    userId: '',
    apiKey: ''
  }
};

// Определяем jest глобальную функцию beforeAll
const beforeAll = globalThis.beforeAll || (async (fn) => await fn());

// Проверяем наличие требуемых переменных окружения и инициализируем тесты
beforeAll(async () => {
  // Устанавливаем таймаут для всех тестов
  if (globalThis.jest) {
    globalThis.jest.setTimeout(30000);
  }
  
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

// Определяем jest глобальную функцию afterEach
const afterEach = globalThis.afterEach || ((fn) => fn());

// Очищаем моки после каждого теста
afterEach(() => {
  if (globalThis.jest) {
    globalThis.jest.clearAllMocks();
  }
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
 * Загружает настройки кампании и API ключи для использования в тестах
 */
async function loadCampaignSettings() {
  if (!testStorage || !directusToken) {
    console.warn('Невозможно загрузить настройки кампании: отсутствует хранилище или токен доступа');
    return;
  }
  
  try {
    console.log(`Загрузка настроек кампании ${CAMPAIGN_ID}...`);
    
    // Получаем кампанию с настройками через хранилище
    const campaign = await testStorage.getCampaign(CAMPAIGN_ID);
    
    if (campaign && campaign.socialMediaSettings) {
      console.log('Настройки кампании загружены успешно');
      console.log(`Обнаружены настройки для платформ: ${Object.keys(campaign.socialMediaSettings).join(', ')}`);
      
      // Сохраняем настройки в глобальных мокированных данных для использования в тестах
      mocks.campaignSettings = campaign.socialMediaSettings;
      
      // Загружаем API ключи из таблицы user_api_keys
      await loadApiKeys();
    } else {
      console.warn('Настройки социальных сетей для кампании не найдены');
    }
  } catch (error) {
    console.error('Ошибка при загрузке настроек кампании:', error);
  }
}

/**
 * Загружает API ключи пользователя из Directus
 */
async function loadApiKeys() {
  if (!directusToken) {
    console.warn('Невозможно загрузить API ключи: отсутствует токен доступа к Directus');
    return;
  }
  
  try {
    console.log('Загрузка API ключей из user_api_keys...');
    
    // Выполняем запрос к Directus для получения API ключей
    const directusUrl = process.env.DIRECTUS_URL || 'https://cms.smm-manager.ru';
    const response = await axios.get(`${directusUrl}/items/user_api_keys`, {
      headers: {
        'Authorization': `Bearer ${directusToken}`
      }
    });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      console.log(`Найдено ${response.data.data.length} записей с API ключами`);
      
      // Обрабатываем полученные ключи
      for (const keyData of response.data.data) {
        if (keyData.service && keyData.key) {
          switch (keyData.service.toLowerCase()) {
            case 'perplexity':
              apiKeys.perplexity = keyData.key;
              console.log('Загружен ключ для Perplexity API');
              break;
            case 'apify':
              apiKeys.apify = keyData.key;
              console.log('Загружен ключ для Apify API');
              break;
            case 'deepseek':
              apiKeys.deepseek = keyData.key;
              console.log('Загружен ключ для DeepSeek API');
              break;
            case 'falai':
              apiKeys.falai = keyData.key;
              console.log('Загружен ключ для FAL.AI API');
              break;
            case 'claude':
              apiKeys.claude = keyData.key;
              console.log('Загружен ключ для Claude AI API');
              break;
            case 'xmlriver':
              // Если для XMLRiver хранится полный ключ в формате userId:apiKey
              if (keyData.key.includes(':')) {
                const [userId, apiKey] = keyData.key.split(':');
                apiKeys.xmlriver.userId = userId;
                apiKeys.xmlriver.apiKey = apiKey;
                console.log('Загружен составной ключ для XMLRiver');
              } else if (keyData.field === 'userId') {
                apiKeys.xmlriver.userId = keyData.key;
                console.log('Загружен userId для XMLRiver');
              } else if (keyData.field === 'apiKey') {
                apiKeys.xmlriver.apiKey = keyData.key;
                console.log('Загружен apiKey для XMLRiver');
              }
              break;
            default:
              console.log(`Найден ключ для неизвестного сервиса: ${keyData.service}`);
          }
        }
      }
    } else {
      console.warn('API ключи не найдены в таблице user_api_keys');
    }
  } catch (error) {
    console.error('Ошибка при загрузке API ключей:', error);
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