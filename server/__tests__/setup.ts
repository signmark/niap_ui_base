/**
 * Настройка тестового окружения
 * Файл содержит инициализацию данных для тестов и моки
 */
import axios from 'axios';
import dotenv from 'dotenv';
import { DirectusAuthManager } from '../services/directus/directus-auth';

// Загружаем переменные окружения
dotenv.config();

// Проверяем наличие требуемых переменных окружения
beforeAll(() => {
  // Устанавливаем таймаут для всех тестов
  jest.setTimeout(10000);
  
  // Проверяем наличие переменных окружения
  const requiredEnvVars = ['DIRECTUS_ADMIN_EMAIL', 'DIRECTUS_ADMIN_PASSWORD', 'DIRECTUS_URL'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`Предупреждение: Переменная окружения ${envVar} не найдена`);
    }
  }
  
  // Инициализируем авторизацию для тестов
  initializeDirectusAuth();
});

// Очищаем моки после каждого теста
afterEach(() => {
  jest.clearAllMocks();
});

/**
 * Инициализирует авторизацию Directus из переменных окружения
 */
async function initializeDirectusAuth() {
  // Получаем учетные данные из переменных окружения
  const email = process.env.DIRECTUS_ADMIN_EMAIL;
  const password = process.env.DIRECTUS_ADMIN_PASSWORD;
  const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
  
  if (!email || !password) {
    console.log('Переменные окружения для авторизации в Directus не найдены, тесты будут использовать моки');
    return;
  }
  
  try {
    // Пытаемся авторизоваться в Directus
    console.log(`Попытка авторизации в Directus (${directusUrl}) с учетными данными из переменных окружения`);
    
    // Получаем экземпляр менеджера авторизации
    const authManager = DirectusAuthManager.getInstance();
    
    // Выполняем авторизацию
    await authManager.login(email, password);
    
    console.log('Авторизация в Directus успешна, тесты будут использовать реальный токен');
  } catch (error) {
    console.error('Ошибка при авторизации в Directus:', error);
    console.log('Тесты будут использовать моки');
  }
}

// Экспортируем глобальные моки для использования в тестах
export const mocks = {
  // Мокированные ответы API
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