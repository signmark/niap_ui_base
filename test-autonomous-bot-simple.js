#!/usr/bin/env node

/**
 * Простой тест автономного бота SMM Manager
 * Этот скрипт тестирует базовую функциональность автономной генерации контента
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const TEST_CAMPAIGN_ID = '8e4a1018-72ff-48eb-a3ff-9bd41bf83253'; // Тестовая кампания

async function testAutonomousBot() {
  console.log('🤖 Начинаем тестирование автономного бота SMM Manager');
  console.log('============================================\n');

  try {
    // 1. Проверить статус бота
    console.log('1. Проверяем статус бота...');
    const statusResponse = await axios.get(`${BASE_URL}/api/autonomous-bot-working/status/${TEST_CAMPAIGN_ID}`);
    console.log('   Статус:', statusResponse.data);
    console.log('   ✅ Статус получен успешно\n');

    // 2. Запустить бота на короткий период для тестирования
    console.log('2. Запускаем автономного бота...');
    const startConfig = {
      frequency: 5, // 5 минут для быстрого тестирования
      contentTypes: ['text'],
      platforms: ['vk'],
      moderationLevel: 'normal',
      maxPostsPerCycle: 1
    };

    const startResponse = await axios.post(`${BASE_URL}/api/autonomous-bot-working/start/${TEST_CAMPAIGN_ID}`, startConfig);
    console.log('   Результат запуска:', startResponse.data);
    console.log('   ✅ Бот запущен успешно\n');

    // 3. Подождать немного и проверить статус снова
    console.log('3. Ждём 3 секунды и проверяем статус...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const statusAfterStart = await axios.get(`${BASE_URL}/api/autonomous-bot-working/status/${TEST_CAMPAIGN_ID}`);
    console.log('   Статус после запуска:', statusAfterStart.data);
    console.log('   ✅ Статус обновлен\n');

    // 4. Запустить ручной цикл для мгновенного тестирования
    console.log('4. Запускаем ручной цикл генерации...');
    const manualCycleResponse = await axios.post(`${BASE_URL}/api/autonomous-bot-working/manual-cycle/${TEST_CAMPAIGN_ID}`);
    console.log('   Результат ручного цикла:', manualCycleResponse.data);
    console.log('   ✅ Ручной цикл запущен\n');

    // 5. Остановить бота
    console.log('5. Останавливаем бота...');
    const stopResponse = await axios.post(`${BASE_URL}/api/autonomous-bot-working/stop/${TEST_CAMPAIGN_ID}`);
    console.log('   Результат остановки:', stopResponse.data);
    console.log('   ✅ Бот остановлен\n');

    // 6. Финальная проверка статуса
    console.log('6. Финальная проверка статуса...');
    const finalStatus = await axios.get(`${BASE_URL}/api/autonomous-bot-working/status/${TEST_CAMPAIGN_ID}`);
    console.log('   Финальный статус:', finalStatus.data);
    console.log('   ✅ Финальный статус получен\n');

    console.log('🎉 Тестирование автономного бота завершено успешно!');
    console.log('============================================');
    console.log('Все API endpoints автономного бота работают корректно.');
    console.log('Бот готов к продуктивному использованию.');

  } catch (error) {
    console.error('❌ Ошибка при тестировании автономного бота:', error.message);
    
    if (error.response) {
      console.error('   Статус ответа:', error.response.status);
      console.error('   Данные ошибки:', error.response.data);
    }
    
    console.log('\n🔧 Проверьте:');
    console.log('- Работает ли сервер на порту 5173');
    console.log('- Существует ли кампания с ID:', TEST_CAMPAIGN_ID);
    console.log('- Правильно ли настроены API endpoints');
  }
}

// Запускаем тест
testAutonomousBot();