/**
 * Тест для проверки функции агрессивного исправления HTML-тегов
 * 
 * Этот скрипт отправляет разные примеры проблемных HTML тегов в API
 * и проверяет, как работает aggressiveTagFixer
 * 
 * Запуск: node test-telegram-html-aggressive.js
 */

import axios from 'axios';

// Используем локальный URL сервера
const API_BASE_URL = 'http://localhost:3000'; // Порт 3000 используется в проекте

// Массив тестовых примеров с проблемными HTML-тегами
const TEST_CASES = [
  { 
    name: 'Незакрытый тег жирного шрифта',
    input: 'Текст с <b>незакрытым тегом жирного шрифта'
  },
  { 
    name: 'Незакрытый тег курсива',
    input: 'Текст с <i>незакрытым тегом курсива'
  },
  { 
    name: 'Перекрещивающиеся теги',
    input: 'Перекрещивающиеся <b>жирный <i>курсив</b> текст</i>'
  },
  { 
    name: 'Вложенные незакрытые теги',
    input: 'Вложенные <b>жирный <i>курсив <u>подчеркнутый'
  },
  { 
    name: 'Неизвестные теги должны быть удалены',
    input: 'Неизвестный <unknown>тег</unknown> должен быть удален'
  },
  { 
    name: 'Случай с ссылкой',
    input: 'Текст с <a href="https://example.com">ссылкой'
  },
  {
    name: 'Комплексный пример',
    input: `<b>Заголовок</b>
    
    <i>Подзаголовок с <u>подчеркиванием</i>
    
    Обычный текст <code>с кодом</code> и <pre>блоком кода
    на несколько строк</pre>
    
    <a href="https://example.com">Ссылка без закрытия
    
    <b>Финальный <i>текст <u>с множеством</i> вложенных</u> тегов`
  }
];

/**
 * Выполняет один тест на исправление HTML
 * @param {Object} testCase Объект с тестовыми данными
 * @returns {Promise<void>}
 */
async function runTest(testCase) {
  try {
    console.log(`\n===== Тест: ${testCase.name} =====`);
    console.log('Исходный текст:', testCase.input);
    
    // Вызываем обычный метод исправления (для сравнения)
    const normalResponse = await axios.post(`${API_BASE_URL}/api/test/fix-html`, {
      text: testCase.input,
      aggressive: false
    });
    
    // Вызываем агрессивный метод исправления
    const aggressiveResponse = await axios.post(`${API_BASE_URL}/api/test/fix-html`, {
      text: testCase.input,
      aggressive: true
    });
    
    console.log('\nОбычное исправление:');
    console.log(normalResponse.data.fixedText);
    
    console.log('\nАгрессивное исправление:');
    console.log(aggressiveResponse.data.fixedText);
    
    console.log('\nРезультат:');
    console.log('Успешно исправлено обычным способом:', normalResponse.data.success);
    console.log('Успешно исправлено агрессивным способом:', aggressiveResponse.data.success);
    
    // Если оба метода дали разные результаты, выделяем это
    if (normalResponse.data.fixedText !== aggressiveResponse.data.fixedText) {
      console.log('\n⚠️ Результаты отличаются!');
    }
    
  } catch (error) {
    console.error(`\n❌ Ошибка при тестировании "${testCase.name}":`, error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
      console.error('Статус:', error.response.status);
    }
  }
}

/**
 * Выполняет все тесты последовательно
 */
async function runAllTests() {
  console.log('Начинаем тестирование агрессивного исправления HTML-тегов');
  console.log('=======================================================\n');
  
  for (const testCase of TEST_CASES) {
    await runTest(testCase);
  }
  
  console.log('\nТестирование завершено!');
}

// Запускаем тесты
runAllTests();