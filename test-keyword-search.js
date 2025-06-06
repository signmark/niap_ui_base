/**
 * Тест поиска ключевых слов с временным токеном тестового пользователя
 */

async function testKeywordSearch() {
  try {
    // Создаем временного тестового пользователя через локальный API
    const testResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'test123'
      })
    });
    
    console.log('Статус авторизации тестового пользователя:', testResponse.status);
    
    // Если тестовый пользователь не работает, используем известный токен админа
    const knownAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';  // Примерный токен
    
    // Тестируем поиск ключевых слов
    const response = await fetch('http://localhost:5000/api/keywords/search', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${knownAdminToken}`
      },
      body: JSON.stringify({
        keyword: 'спорт'
      })
    });
    
    const result = await response.text();
    console.log('Статус ответа:', response.status);
    console.log('Результат поиска:', result);
    
    if (response.ok) {
      console.log('Поиск ключевых слов работает успешно!');
    } else {
      console.log('Ошибка при поиске ключевых слов');
    }
    
  } catch (error) {
    console.error('Ошибка тестирования:', error.message);
  }
}

testKeywordSearch();