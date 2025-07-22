/**
 * Тест публикации Instagram с расширенными данными сессии
 * Проверяет публикацию через Instagram Private API с полными сессионными данными
 */

// Для node.js < 18 нужен node-fetch
let fetch;
try {
  fetch = globalThis.fetch || require('node-fetch');
} catch (e) {
  // Для старых версий Node.js используем простой HTTP
  const http = require('http');
  const https = require('https');
  const { URL } = require('url');
  
  fetch = async (url, options = {}) => {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };
      
      const req = client.request(requestOptions, (res) => {
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
}

const API_BASE = 'http://localhost:5000/api';

// Данные кампании с рабочими учетными данными
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const INSTAGRAM_USERNAME = 'dsignmark';
const INSTAGRAM_PASSWORD = 'K<2Y#DJh-<WCb!S';

// Тестовые данные для публикации
const TEST_POST_DATA = {
  content: '🔥 Тест Instagram Private API публикации! Проверяем расширенные сессионные данные для постинга. #test #instagram #api',
  platform: 'instagram',
  campaignId: CAMPAIGN_ID,
  contentType: 'text',
  scheduledAt: new Date().toISOString()
};

async function testInstagramPublishing() {
  console.log('\n🚀 === ТЕСТ INSTAGRAM PUBLISHING С РАСШИРЕННЫМИ ДАННЫМИ ===\n');

  try {
    // Шаг 1: Очистим существующие сессии для чистого теста
    console.log('1️⃣ Очистка существующих сессий...');
    try {
      const clearResponse = await fetch(`${API_BASE}/instagram-direct/clear-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`✅ Кэш очищен: ${clearResponse.status}`);
    } catch (e) {
      console.log('⚠️ Не удалось очистить кэш (возможно, уже пуст)');
    }

    // Шаг 2: Аутентификация с получением расширенных данных
    console.log('\n2️⃣ Аутентификация Instagram Private API...');
    const authResponse = await fetch(`${API_BASE}/instagram-direct/login`, {
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
      status: authData.status,
      userId: authData.userId,
      username: authData.username,
      cached: authData.cached,
      authMethod: authData.authMethod
    });

    if (!authData.success) {
      throw new Error(`Аутентификация не удалась: ${authData.error || authData.message}`);
    }

    // Анализируем полученные данные сессии
    const sessionData = authData.sessionData;
    console.log('\n📊 Анализ сессионных данных:');
    console.log('- Базовые данные:', {
      username: sessionData.username,
      isAuthenticated: sessionData.isAuthenticated,
      authMethod: sessionData.authMethod
    });
    console.log('- Данные для публикации:', {
      hasSessionId: !!sessionData.sessionId,
      hasCsrfToken: !!sessionData.csrfToken,
      hasDeviceId: !!sessionData.deviceId,
      hasUserAgent: !!sessionData.userAgent,
      hasCookies: !!sessionData.cookies,
      hasAuthData: !!sessionData.authData
    });

    // Шаг 3: Создание тестового контента
    console.log('\n3️⃣ Создание тестового контента...');
    const contentResponse = await fetch(`${API_BASE}/campaign-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: CAMPAIGN_ID,
        content: TEST_POST_DATA.content,
        contentType: TEST_POST_DATA.contentType,
        status: 'scheduled',
        scheduledAt: TEST_POST_DATA.scheduledAt,
        socialPlatforms: {
          instagram: { status: 'pending' }
        }
      })
    });

    const contentData = await contentResponse.json();
    console.log('📝 Контент создан:', {
      success: !!contentData.id,
      contentId: contentData.id,
      status: contentData.status
    });

    if (!contentData.id) {
      throw new Error('Не удалось создать тестовый контент');
    }

    // Шаг 4: Попытка публикации через Instagram Direct API
    console.log('\n4️⃣ Публикация через Instagram Direct API...');
    
    // Проверяем доступность Instagram Private API клиента
    const statusResponse = await fetch(`${API_BASE}/instagram-direct/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: INSTAGRAM_USERNAME })
    });

    const statusData = await statusResponse.json();
    console.log('🔍 Статус Instagram клиента:', {
      hasIgClient: statusData.hasIgClient,
      sessionValid: statusData.sessionValid,
      userId: statusData.userId
    });

    if (!statusData.hasIgClient) {
      throw new Error('Instagram Private API клиент недоступен для публикации');
    }

    // Попытка публикации через социальную платформу
    console.log('\n5️⃣ Публикация поста через социальный роутер...');
    const publishResponse = await fetch(`${API_BASE}/social-publishing/publish-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'instagram',
        contentId: contentData.id,
        campaignId: CAMPAIGN_ID,
        content: TEST_POST_DATA.content,
        contentType: TEST_POST_DATA.contentType
      })
    });

    const publishData = await publishResponse.json();
    console.log('📤 Результат публикации:', {
      success: publishData.success,
      status: publishData.status,
      postId: publishData.postId,
      postUrl: publishData.postUrl,
      message: publishData.message
    });

    // Шаг 6: Проверка обновления статуса в базе данных
    console.log('\n6️⃣ Проверка статуса в базе данных...');
    const updatedContentResponse = await fetch(`${API_BASE}/campaign-content/${contentData.id}`);
    const updatedContent = await updatedContentResponse.json();
    
    console.log('💾 Обновленный статус контента:', {
      contentId: updatedContent.id,
      status: updatedContent.status,
      instagramStatus: updatedContent.socialPlatforms?.instagram?.status || 'не задан',
      postUrl: updatedContent.socialPlatforms?.instagram?.postUrl || 'отсутствует'
    });

    console.log('\n✅ === ТЕСТ ЗАВЕРШЕН УСПЕШНО ===\n');

    return {
      success: true,
      authMethod: authData.authMethod,
      sessionData: authData.sessionData,
      publishResult: publishData,
      finalStatus: updatedContent.socialPlatforms?.instagram?.status
    };

  } catch (error) {
    console.error('\n❌ === ОШИБКА В ТЕСТЕ ===');
    console.error('💥 Детали ошибки:', error.message);
    console.error('📍 Stack trace:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Запуск теста
if (require.main === module) {
  testInstagramPublishing()
    .then(result => {
      console.log('\n🏁 Финальный результат теста:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Критическая ошибка теста:', error);
      process.exit(1);
    });
}

module.exports = { testInstagramPublishing };