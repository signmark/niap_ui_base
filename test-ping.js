/**
 * Тестирование маршрута ping
 */

import axios from 'axios';

async function testPing() {
  try {
    console.log('Отправка запроса на /api/test/ping...');
    const response = await axios.get('http://localhost:5000/api/test/ping', {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Статус ответа:', response.status);
    console.log('Заголовки ответа:', response.headers);
    console.log('Данные ответа:', response.data);
    
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      console.log('Ответ содержит HTML вместо JSON!');
    }
  } catch (error) {
    console.error('Ошибка при запросе:', error.message);
    if (error.response) {
      console.log('Статус ошибки:', error.response.status);
      console.log('Данные ошибки:', error.response.data);
    }
  }
}

testPing();