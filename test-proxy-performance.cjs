/**
 * Тестирование производительности различных портов SOCKS5 прокси
 */

const { SocksProxyAgent } = require('socks-proxy-agent');
const axios = require('axios');

const PROXY_CONFIG = {
  host: 'mobpool.proxy.market',
  ports: [10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009],
  username: 'WeBZDZ7p9lh5',
  password: 'iOPNYl8D'
};

async function testProxyPort(port) {
  console.log(`🧪 Тестируем порт ${port}...`);
  
  try {
    const proxyUrl = `socks5://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${port}`;
    const agent = new SocksProxyAgent(proxyUrl);
    
    const startTime = Date.now();
    
    // Тестируем простой HTTP запрос
    const response = await axios({
      method: 'GET',
      url: 'https://httpbin.org/json',
      timeout: 15000,
      httpsAgent: agent,
      httpAgent: agent
    });
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200) {
      console.log(`✅ Порт ${port}: ${duration}ms - SUCCESS`);
      return { port, duration, success: true };
    } else {
      console.log(`❌ Порт ${port}: HTTP ${response.status}`);
      return { port, duration, success: false, error: `HTTP ${response.status}` };
    }
    
  } catch (error) {
    console.log(`❌ Порт ${port}: ${error.message}`);
    return { port, duration: 15000, success: false, error: error.message };
  }
}

async function findBestProxy() {
  console.log('🔍 Тестируем все доступные порты прокси...\n');
  
  const results = [];
  
  // Тестируем все порты параллельно
  const promises = PROXY_CONFIG.ports.map(port => testProxyPort(port));
  const testResults = await Promise.all(promises);
  
  // Фильтруем успешные соединения
  const successful = testResults.filter(result => result.success);
  
  console.log('\n📊 Результаты тестирования:');
  console.log('='.repeat(50));
  
  if (successful.length === 0) {
    console.log('❌ Ни один порт не работает!');
    return null;
  }
  
  // Сортируем по скорости
  successful.sort((a, b) => a.duration - b.duration);
  
  console.log('✅ Рабочие порты (отсортированы по скорости):');
  successful.forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`${medal} Порт ${result.port}: ${result.duration}ms`);
  });
  
  const best = successful[0];
  console.log(`\n🎯 Лучший порт: ${best.port} (${best.duration}ms)`);
  
  return best;
}

// Запускаем тест
findBestProxy()
  .then(best => {
    if (best) {
      console.log(`\n🔧 Рекомендация: используйте порт ${best.port} для Instagram API`);
      process.exit(0);
    } else {
      console.log('\n💥 Все прокси не работают');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });