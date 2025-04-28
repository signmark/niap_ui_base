// Тестовый скрипт для проверки функции очистки HTML для Facebook
// Запустите с помощью команды: node test-facebook-cleaning.js

import axios from 'axios';

async function testFacebookCleaning() {
  try {
    // Пример HTML-текста с различными тегами форматирования
    const htmlText = `
      <div>
        <h2>Заголовок поста</h2>
        <p>Это <strong>жирный текст</strong> и <em>курсив</em>.</p>
        <p>Абзац с <a href="https://example.com">ссылкой</a> внутри.</p>
        <ul>
          <li>Пункт списка 1</li>
          <li>Пункт списка 2</li>
        </ul>
        <div>Вложенный <span style="color: red;">текст</span> с стилями</div>
        <p>Текст с символами &amp; и &quot;кавычками&quot; и&nbsp;неразрывными&nbsp;пробелами</p>
      </div>
    `;

    console.log('Отправка запроса для очистки HTML...');
    
    // Отправляем запрос на тестовый маршрут
    const response = await axios.post('http://localhost:5000/api/test/facebook-cleaning', {
      html: htmlText
    });

    // Выводим результат
    console.log('\n--- Результат очистки HTML ---');
    console.log('\nИсходный HTML:');
    console.log(response.data.original);
    
    console.log('\nОчищенный для Facebook:');
    console.log(response.data.cleaned);
    
    console.log('\n--- Тест выполнен успешно ---');
  } catch (error) {
    console.error('Ошибка при выполнении теста:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
  }
}

// Запускаем тест
testFacebookCleaning();