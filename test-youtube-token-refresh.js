/**
 * Тест обновления YouTube токенов
 */

const axios = require('axios');

async function testYouTubeTokenRefresh() {
  try {
    // Данные для тестирования (из логов системы)
    const campaignId = '46868c44-c6a4-4bed-accf-9ad07bba790e';
    const refreshToken = '1//05vtpMD2L6mM6CgYIARAAGAUSNwF-L9IrMdMT8CFmdeuT7SUk-5WqAOwC_nvu2h-2WxrwPfXcYZUvCT7rO-6p921etz8tbdwE0dU';
    
    console.log('🔄 Тестирование обновления YouTube токенов...');
    console.log(`Campaign ID: ${campaignId}`);
    console.log(`Refresh Token: ${refreshToken.substring(0, 20)}...`);
    
    // Вызываем API endpoint для обновления токенов
    const response = await axios.post('http://localhost:5000/api/youtube/refresh-token', {
      campaignId: campaignId,
      refreshToken: refreshToken
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Используем admin токен для тестирования
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`
      }
    });
    
    console.log('✅ Токены успешно обновлены!');
    console.log('Ответ API:', JSON.stringify(response.data, null, 2));
    
    // Информация о времени истечения
    if (response.data.expiresAt) {
      const expiresDate = new Date(response.data.expiresAt);
      const now = new Date();
      const timeLeft = expiresDate - now;
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      
      console.log(`⏰ Новый токен истекает: ${expiresDate.toLocaleString()}`);
      console.log(`⏱️ Осталось времени: ${hoursLeft}ч ${minutesLeft}мин`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении токенов:');
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Сообщение:', error.message);
    }
  }
}

async function testTokenRefreshService() {
  try {
    console.log('\n🧪 Тестирование сервиса обновления токенов напрямую...');
    
    // Импортируем сервис напрямую
    const { YouTubeTokenRefresh } = require('./server/services/youtube-token-refresh');
    const tokenService = new YouTubeTokenRefresh();
    
    const refreshToken = '1//05vtpMD2L6mM6CgYIARAAGAUSNwF-L9IrMdMT8CFmdeuT7SUk-5WqAOwC_nvu2h-2WxrwPfXcYZUvCT7rO-6p921etz8tbdwE0dU';
    
    const newTokens = await tokenService.refreshAccessToken(refreshToken);
    
    console.log('✅ Сервис работает корректно!');
    console.log('Новый access token:', newTokens.accessToken.substring(0, 50) + '...');
    console.log('Refresh token:', newTokens.refreshToken ? newTokens.refreshToken.substring(0, 20) + '...' : 'Не изменился');
    console.log('Истекает через:', newTokens.expiresIn, 'секунд');
    console.log('Истекает в:', new Date(newTokens.expiresAt).toLocaleString());
    
  } catch (error) {
    console.error('❌ Ошибка сервиса:', error.message);
  }
}

// Запускаем тесты
async function main() {
  console.log('🚀 Запуск тестов обновления YouTube токенов\n');
  
  // Тест 1: Прямой вызов сервиса
  await testTokenRefreshService();
  
  // Тест 2: Через API endpoint
  await testYouTubeTokenRefresh();
  
  console.log('\n✨ Тестирование завершено');
}

main().catch(console.error);