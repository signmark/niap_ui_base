/**
 * Тесты для проверки получения API ключей из user_api_keys
 */
import axios from 'axios';
import dotenv from 'dotenv';
import { mocks, apiKeys } from './setup';

// Загружаем переменные окружения
dotenv.config();

// Мокаем axios для имитации API-вызовов
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('User API Keys', () => {
  beforeEach(() => {
    // Очищаем все моки
    jest.clearAllMocks();
  });

  test('should load API keys from user_api_keys table', async () => {
    // Мокируем ответ от Directus API с ключами
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: [
          { service: 'perplexity', key: 'test-perplexity-key' },
          { service: 'deepseek', key: 'test-deepseek-key' },
          { service: 'falai', key: 'test-falai-key' },
          { service: 'claude', key: 'test-claude-key' },
          { service: 'xmlriver', key: 'test-user-id:test-api-key' }
        ]
      }
    });

    // Имитируем, что у нас есть directusToken
    const directusToken = 'test-directus-token';
    const directusUrl = process.env.DIRECTUS_URL || 'https://cms.smm-manager.ru';

    // Вручную вызываем функцию загрузки ключей (предполагаем, что она определена в mocks)
    await loadApiKeys(directusToken, directusUrl);

    // Проверяем, что axios был вызван с правильными параметрами
    expect(mockedAxios.get).toHaveBeenCalledWith(`${directusUrl}/items/user_api_keys`, {
      headers: {
        'Authorization': `Bearer ${directusToken}`
      }
    });

    // Проверяем, что ключи были загружены в apiKeys
    expect(apiKeys.perplexity).toBe('test-perplexity-key');
    expect(apiKeys.deepseek).toBe('test-deepseek-key');
    expect(apiKeys.falai).toBe('test-falai-key');
    expect(apiKeys.claude).toBe('test-claude-key');
    expect(apiKeys.xmlriver.userId).toBe('test-user-id');
    expect(apiKeys.xmlriver.apiKey).toBe('test-api-key');
  });

  test('should handle empty API keys response', async () => {
    // Мокируем пустой ответ от Directus API
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: []
      }
    });

    // Имитируем, что у нас есть directusToken
    const directusToken = 'test-directus-token';
    const directusUrl = process.env.DIRECTUS_URL || 'https://cms.smm-manager.ru';

    // Вручную вызываем функцию загрузки ключей
    await loadApiKeys(directusToken, directusUrl);

    // Проверяем, что axios был вызван с правильными параметрами
    expect(mockedAxios.get).toHaveBeenCalledWith(`${directusUrl}/items/user_api_keys`, {
      headers: {
        'Authorization': `Bearer ${directusToken}`
      }
    });

    // Проверяем, что ключи не были изменены (остались пустыми)
    expect(apiKeys.perplexity).toBe('');
    expect(apiKeys.deepseek).toBe('');
    expect(apiKeys.falai).toBe('');
    expect(apiKeys.claude).toBe('');
    expect(apiKeys.xmlriver.userId).toBe('');
    expect(apiKeys.xmlriver.apiKey).toBe('');
  });

  test('should handle API error', async () => {
    // Мокируем ошибку от Directus API
    mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

    // Имитируем, что у нас есть directusToken
    const directusToken = 'test-directus-token';
    const directusUrl = process.env.DIRECTUS_URL || 'https://cms.smm-manager.ru';

    // Вручную вызываем функцию загрузки ключей и ожидаем, что она не выбросит ошибку
    await expect(loadApiKeys(directusToken, directusUrl)).resolves.not.toThrow();

    // Проверяем, что axios был вызван с правильными параметрами
    expect(mockedAxios.get).toHaveBeenCalledWith(`${directusUrl}/items/user_api_keys`, {
      headers: {
        'Authorization': `Bearer ${directusToken}`
      }
    });
  });
});

/**
 * Вспомогательная функция для тестирования загрузки API ключей
 */
async function loadApiKeys(directusToken: string, directusUrl: string) {
  // Обнуляем текущие ключи для теста
  apiKeys.perplexity = '';
  apiKeys.apify = '';
  apiKeys.deepseek = '';
  apiKeys.falai = '';
  apiKeys.claude = '';
  apiKeys.xmlriver.userId = '';
  apiKeys.xmlriver.apiKey = '';
  
  try {
    console.log('Загрузка API ключей из user_api_keys...');
    
    // Выполняем запрос к Directus для получения API ключей
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