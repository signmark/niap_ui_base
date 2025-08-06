/**
 * Отладка YouTube конфигурации для продакшена
 */

const axios = require('axios');

async function debugYouTubeConfigProd() {
  try {
    console.log('🔍 Отладка YouTube конфигурации для продакшена...');
    
    const prodUrl = 'https://smm.nplanner.ru';
    const directusUrl = 'https://directus.roboflow.space';
    
    console.log('📝 Проверяем доступность продакшена:');
    console.log(`Продакшен URL: ${prodUrl}`);
    console.log(`Directus URL: ${directusUrl}`);
    console.log('');
    
    // Проверяем доступность продакшена
    try {
      const healthResponse = await axios.get(`${prodUrl}/health`);
      console.log('✅ Продакшен сервер работает');
      console.log(`Версия: ${healthResponse.data?.version || 'неизвестно'}`);
      console.log(`Среда: ${healthResponse.data?.environment || 'неизвестно'}`);
      console.log(`Uptime: ${Math.floor((healthResponse.data?.uptime || 0) / 60)} минут`);
    } catch (error) {
      console.error('❌ Продакшен сервер недоступен:', error.message);
      return;
    }
    
    console.log('');
    console.log('🔐 Проверяем доступность Directus с новым токеном...');
    
    // Здесь нужно ввести новый действующий токен
    const testToken = 'ВВЕДИТЕ_НОВЫЙ_DIRECTUS_TOKEN_ЗДЕСЬ';
    
    if (testToken === 'ВВЕДИТЕ_НОВЫЙ_DIRECTUS_TOKEN_ЗДЕСЬ') {
      console.log('⚠️  Введите действующий DIRECTUS_TOKEN для проверки');
      console.log('   Получить новый токен: https://directus.roboflow.space');
      console.log('   Settings > Access Tokens > Create new token');
      return;
    }
    
    try {
      const directusResponse = await axios.get(`${directusUrl}/server/info`, {
        headers: {
          Authorization: `Bearer ${testToken}`
        }
      });
      console.log('✅ Новый токен работает');
    } catch (error) {
      console.error('❌ Новый токен не работает:', error.response?.status);
      return;
    }
    
    // Проверяем YouTube ключи с новым токеном
    console.log('');
    console.log('🔑 Проверяем YouTube ключи с новым токеном...');
    
    const apiKeysResponse = await axios.get(`${directusUrl}/items/global_api_keys`, {
      params: {
        fields: ['service_name', 'api_key', 'is_active'],
        filter: {
          service_name: { _in: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REDIRECT_URI'] },
          is_active: { _eq: true }
        }
      },
      headers: {
        Authorization: `Bearer ${testToken}`
      }
    });
    
    const apiKeys = apiKeysResponse.data?.data || [];
    console.log(`📊 Получено ${apiKeys.length} YouTube ключей`);
    
    if (apiKeys.length > 0) {
      console.log('✅ YouTube ключи найдены:');
      apiKeys.forEach(key => {
        if (key.service_name === 'YOUTUBE_REDIRECT_URI') {
          console.log(`   - ${key.service_name}: ${key.api_key}`);
          if (!key.api_key.includes('smm.nplanner.ru')) {
            console.log('   ⚠️  Redirect URI нужно обновить на продакшен URL');
          }
        } else {
          console.log(`   - ${key.service_name}: ${key.api_key ? 'есть значение' : 'пустое'}`);
        }
      });
    } else {
      console.log('❌ YouTube ключи не найдены');
    }
    
    console.log('');
    console.log('📋 Следующие шаги для исправления:');
    console.log('1. Обновить DIRECTUS_TOKEN на продакшене');
    console.log('2. Обновить YOUTUBE_REDIRECT_URI в базе данных');
    console.log('3. Обновить Google OAuth консоль');
    console.log('4. Перезапустить продакшен сервер');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

// Запускаем если вызван напрямую
if (require.main === module) {
  debugYouTubeConfigProd();
}

module.exports = { debugYouTubeConfigProd };