/**
 * Финальный тест форматирования URL Telegram через API
 * Проверяет правильность исправления URL с отрицательным ID чата
 */

import axios from 'axios';
const API_URL = 'http://localhost:5000';

async function testTelegramUrlFormatting() {
  console.log('🔍 Запуск финального теста форматирования URL Telegram...');
  
  try {
    // Вызываем тестовый API для проверки форматирования URL
    const response = await axios.get(`${API_URL}/api/test/telegram-url?chatId=-1002302366310&messageId=12345`);
    
    if (response.status !== 200) {
      throw new Error(`Неверный код ответа: ${response.status}`);
    }
    
    const data = response.data;
    
    if (!data.success) {
      throw new Error(`API вернул ошибку: ${data.error || 'Нет информации об ошибке'}`);
    }
    
    console.log('📋 Ответ от API:', JSON.stringify(data, null, 2));
    
    const url = data.data?.url;
    
    if (!url) {
      throw new Error('URL отсутствует в ответе');
    }
    
    console.log('📋 Сформированный URL:', url);
    
    // Проверяем формат URL
    const expectedFormat = 'https://t.me/c/2302366310/12345';
    
    if (url === expectedFormat) {
      console.log('✅ URL сформирован правильно!');
    } else {
      console.log(`❌ URL сформирован неправильно! Ожидалось: ${expectedFormat}, Получено: ${url}`);
    }
    
    console.log('🏁 Тест успешно завершен!');
  } catch (error) {
    console.error('❌ Ошибка при выполнении теста:', error.message);
    if (error.response) {
      console.error('📋 Ответ сервера:', error.response.data);
    }
  }
}

testTelegramUrlFormatting();