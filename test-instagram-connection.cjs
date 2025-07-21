/**
 * Простой тест соединения с Instagram API без публикации
 */

const { IgApiClient } = require('instagram-private-api');
const { SocksProxyAgent } = require('socks-proxy-agent');

// Конфигурация прокси
const PROXY_CONFIG = {
  host: 'mobpool.proxy.market',
  port: 10000, // Фиксированный порт для теста
  username: 'WeBZDZ7p9lh5',
  password: 'iOPNYl8D'
};

// Данные для авторизации Instagram
const INSTAGRAM_CREDENTIALS = {
  username: 'darkhorse_fashion',
  password: 'QtpZ3dh70306'
};

async function testInstagramConnection() {
  console.log('🔗 Тестируем соединение с Instagram через прокси...');
  
  try {
    const ig = new IgApiClient();
    
    // Настраиваем прокси
    console.log(`📡 Настраиваем прокси: ${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
    const proxyUrl = `socks5://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
    const agent = new SocksProxyAgent(proxyUrl);
    
    ig.request.defaults.agent = agent;
    ig.request.defaults.timeout = 60000; // 60 секунд для теста соединения
    
    console.log('📱 Настраиваем устройство...');
    
    // Настраиваем устройство перед авторизацией
    ig.state.generateDevice(INSTAGRAM_CREDENTIALS.username);
    
    console.log('🔑 Начинаем авторизацию Instagram...');
    
    // Авторизуемся
    const auth = await ig.account.login(INSTAGRAM_CREDENTIALS.username, INSTAGRAM_CREDENTIALS.password);
    
    console.log('✅ Успешная авторизация!');
    console.log(`👤 User ID: ${auth.pk}`);
    console.log(`📱 Username: ${auth.username}`);
    
    // Получаем информацию о пользователе для проверки соединения
    const userInfo = await ig.user.info(auth.pk);
    console.log(`📊 Подписчики: ${userInfo.follower_count}`);
    console.log(`📝 Посты: ${userInfo.media_count}`);
    
    console.log('🎉 Тест соединения прошёл успешно!');
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка теста соединения:', error.message);
    if (error.message.includes('ESOCKETTIMEDOUT')) {
      console.error('⏰ Проблема с таймаутом - возможно проблемы с прокси');
    } else if (error.message.includes('challenge_required')) {
      console.error('🔐 Instagram требует прохождения challenge - это нормально');
    } else if (error.message.includes('checkpoint_required')) {
      console.error('🚦 Instagram требует прохождения checkpoint - это нормально');
    }
    return false;
  }
}

// Запускаем тест
testInstagramConnection()
  .then(success => {
    console.log(`\n🏁 Тест завершен: ${success ? 'УСПЕШНО' : 'С ОШИБКОЙ'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });