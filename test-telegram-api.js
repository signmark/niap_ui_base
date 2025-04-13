/**
 * Тест публикации в Telegram через API
 */
import axios from 'axios';

async function testTelegramPublication() {
  try {
    // 1. Публикация через тестовый API
    console.log('Тестируем публикацию через /api/test/telegram-post...');
    const testResponse = await axios.post('http://127.0.0.1:5000/api/test/telegram-post', {
      text: 'Это тестовое сообщение через JavaScript API для проверки работы публикации',
      token: '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU',
      chatId: '@ya_delayu_moschno',
      campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e'
    });
    
    console.log('Результат публикации через тестовый API:');
    console.log(JSON.stringify(testResponse.data, null, 2));
    
    // 2. Пробуем публикацию с HTML через тестовый API
    console.log('\nТестируем публикацию HTML через /api/test/telegram-html...');
    const htmlResponse = await axios.post('http://127.0.0.1:5000/api/test/telegram-html', {
      text: 'Это <b>тестовое</b> сообщение с <i>HTML-форматированием</i>',
      token: '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU',
      chatId: '@ya_delayu_moschno',
      campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e'
    });
    
    console.log('Результат публикации HTML через тестовый API:');
    console.log(JSON.stringify(htmlResponse.data, null, 2));
    
    console.log('\nВсе тесты выполнены успешно!');
  } catch (error) {
    console.error('Ошибка при тестировании API:');
    console.error(error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
  }
}

// Запуск тестов
testTelegramPublication();