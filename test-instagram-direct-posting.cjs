/**
 * Прямой тест публикации через Instagram Private API
 * Проверяет реальную публикацию поста с использованием сохраненного Instagram клиента
 */

const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const INSTAGRAM_USERNAME = 'dsignmark';
const INSTAGRAM_PASSWORD = 'K<2Y#DJh-<WCb!S';

// Простой fetch для Node.js
const http = require('http');
const { URL } = require('url');

const fetch = async (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 5000,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          json: async () => JSON.parse(data),
          text: async () => data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
};

async function testDirectInstagramPosting() {
  console.log('\n🚀 === ТЕСТ ПРЯМОЙ ПУБЛИКАЦИИ INSTAGRAM ===\n');

  try {
    // Шаг 1: Авторизация и получение Instagram клиента
    console.log('1️⃣ Аутентификация Instagram...');
    const authResponse = await fetch('http://localhost:5000/api/instagram-direct/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: INSTAGRAM_USERNAME,
        password: INSTAGRAM_PASSWORD,
        campaignId: CAMPAIGN_ID
      })
    });

    const authData = await authResponse.json();
    console.log('🔐 Результат аутентификации:', {
      success: authData.success,
      userId: authData.userId,
      status: authData.status,
      cached: authData.cached
    });

    if (!authData.success) {
      throw new Error(`Аутентификация не удалась: ${authData.error || authData.message}`);
    }

    // Шаг 2: Проверка наличия Instagram клиента
    console.log('\n2️⃣ Проверка Instagram клиента...');
    const statusResponse = await fetch('http://localhost:5000/api/instagram-direct/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: INSTAGRAM_USERNAME })
    });

    const statusData = await statusResponse.json();
    console.log('📊 Статус клиента:', {
      hasIgClient: statusData.hasIgClient,
      sessionValid: statusData.sessionValid,
      userId: statusData.userId
    });

    if (!statusData.hasIgClient) {
      throw new Error('Instagram Private API клиент недоступен');
    }

    // Шаг 3: Прямая публикация через Instagram Direct API
    console.log('\n3️⃣ Публикация поста...');
    const postContent = `🔥 Тест Instagram Private API публикации!
Время: ${new Date().toLocaleTimeString('ru-RU')}
Проверяем прямую публикацию через Instagram клиент.

#test #instagram #privateapi #smm`;

    // Создаем простое base64 изображение для теста (1x1 пиксель красного цвета)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const publishResponse = await fetch('http://localhost:5000/api/instagram-direct/publish-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: INSTAGRAM_USERNAME,
        imageData: testImageBase64,
        caption: postContent,
        campaignId: CAMPAIGN_ID
      })
    });

    const publishData = await publishResponse.json();
    console.log('📤 Результат публикации:', {
      success: publishData.success,
      status: publishData.status,
      postId: publishData.postId,
      postUrl: publishData.postUrl,
      message: publishData.message || publishData.error
    });

    if (publishData.success) {
      console.log('\n✅ === ПУБЛИКАЦИЯ УСПЕШНА ===');
      console.log('🔗 URL поста:', publishData.postUrl);
      console.log('🆔 ID поста:', publishData.postId);
    } else {
      console.log('\n❌ === ПУБЛИКАЦИЯ НЕ УДАЛАСЬ ===');
      console.log('💥 Ошибка:', publishData.error || publishData.message);
    }

    return {
      success: publishData.success,
      postUrl: publishData.postUrl,
      postId: publishData.postId,
      authResult: authData,
      statusResult: statusData
    };

  } catch (error) {
    console.error('\n❌ === КРИТИЧЕСКАЯ ОШИБКА ===');
    console.error('💥 Детали:', error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Запуск теста
if (require.main === module) {
  testDirectInstagramPosting()
    .then(result => {
      console.log('\n🏁 Финальный результат:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Критическая ошибка:', error);
      process.exit(1);
    });
}