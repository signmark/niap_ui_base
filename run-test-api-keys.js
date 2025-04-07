/**
 * Скрипт для проверки загрузки API ключей из user_api_keys
 * Запустите: node run-test-api-keys.js
 */

const axios = require('axios');
const dotenv = require('dotenv');

// Загружаем переменные окружения
dotenv.config();

// Хранилище для API ключей внешних сервисов
const apiKeys = {
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

/**
 * Авторизуется в Directus и получает токен доступа
 * @returns {Promise<string|null>} Токен доступа
 */
async function authenticate() {
  const email = process.env.DIRECTUS_ADMIN_EMAIL;
  const password = process.env.DIRECTUS_ADMIN_PASSWORD;
  const directusUrl = process.env.DIRECTUS_URL || 'https://cms.smm-manager.ru';
  
  if (!email || !password) {
    console.error('Отсутствуют учетные данные DIRECTUS_ADMIN_EMAIL или DIRECTUS_ADMIN_PASSWORD');
    return null;
  }
  
  try {
    console.log(`Авторизация в Directus (${email})...`);
    const response = await axios.post(`${directusUrl}/auth/login`, {
      email,
      password
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      console.log('Авторизация успешна');
      return response.data.data.access_token;
    } else {
      console.error('Ошибка авторизации: нет токена в ответе');
      return null;
    }
  } catch (error) {
    console.error('Ошибка авторизации:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
    }
    return null;
  }
}

/**
 * Загружает API ключи из user_api_keys
 * @param {string} token Токен авторизации Directus
 */
async function loadApiKeys(token) {
  const directusUrl = process.env.DIRECTUS_URL || 'https://cms.smm-manager.ru';
  
  try {
    console.log('Загрузка API ключей из user_api_keys...');
    
    const response = await axios.get(`${directusUrl}/items/user_api_keys`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      console.log(`Найдено ${response.data.data.length} записей с API ключами:`);
      console.log(JSON.stringify(response.data.data, null, 2));
      
      // Обрабатываем полученные ключи
      for (const keyData of response.data.data) {
        if (keyData.service && keyData.key) {
          switch (keyData.service.toLowerCase()) {
            case 'perplexity':
              apiKeys.perplexity = keyData.key;
              console.log('✓ Загружен ключ для Perplexity API');
              break;
            case 'apify':
              apiKeys.apify = keyData.key;
              console.log('✓ Загружен ключ для Apify API');
              break;
            case 'deepseek':
              apiKeys.deepseek = keyData.key;
              console.log('✓ Загружен ключ для DeepSeek API');
              break;
            case 'falai':
              apiKeys.falai = keyData.key;
              console.log('✓ Загружен ключ для FAL.AI API');
              break;
            case 'claude':
              apiKeys.claude = keyData.key;
              console.log('✓ Загружен ключ для Claude AI API');
              break;
            case 'xmlriver':
              // Если для XMLRiver хранится полный ключ в формате userId:apiKey
              if (keyData.key.includes(':')) {
                const [userId, apiKey] = keyData.key.split(':');
                apiKeys.xmlriver.userId = userId;
                apiKeys.xmlriver.apiKey = apiKey;
                console.log('✓ Загружен составной ключ для XMLRiver');
              } else if (keyData.field === 'userId') {
                apiKeys.xmlriver.userId = keyData.key;
                console.log('✓ Загружен userId для XMLRiver');
              } else if (keyData.field === 'apiKey') {
                apiKeys.xmlriver.apiKey = keyData.key;
                console.log('✓ Загружен apiKey для XMLRiver');
              }
              break;
            default:
              console.log(`✓ Найден ключ для сервиса: ${keyData.service}`);
          }
        }
      }
      
      // Выводим итоговое состояние ключей
      console.log('\nИтоговое состояние API ключей:');
      const safeApiKeys = {
        ...apiKeys,
        perplexity: apiKeys.perplexity ? '******' : '',
        apify: apiKeys.apify ? '******' : '',
        deepseek: apiKeys.deepseek ? '******' : '',
        falai: apiKeys.falai ? '******' : '',
        claude: apiKeys.claude ? '******' : '',
        xmlriver: {
          userId: apiKeys.xmlriver.userId ? '******' : '',
          apiKey: apiKeys.xmlriver.apiKey ? '******' : ''
        }
      };
      console.log(JSON.stringify(safeApiKeys, null, 2));
    } else {
      console.warn('API ключи не найдены в таблице user_api_keys');
    }
  } catch (error) {
    console.error('Ошибка при загрузке API ключей:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
    }
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Получаем токен авторизации
    const token = await authenticate();
    
    if (token) {
      // Загружаем API ключи
      await loadApiKeys(token);
    }
  } catch (error) {
    console.error('Ошибка выполнения скрипта:', error.message);
  }
}

// Запускаем основную функцию
main();