/**
 * Тест для проверки удаления неподдерживаемых тегов в Telegram
 * 
 * Этот тест проверяет как агрессивный метод исправления HTML-тегов
 * обрабатывает теги, которые не поддерживаются в Telegram
 * 
 * Запуск: node test-telegram-unsupported-tags.js
 */

import axios from 'axios';

// Используем локальный URL сервера
const API_BASE_URL = 'http://localhost:5000'; // Порт 5000 указан пользователем

// Массив тестовых примеров с неподдерживаемыми HTML-тегами
const TEST_CASES = [
  { 
    name: 'Неподдерживаемый тег span',
    input: 'Текст с <span style="color: red;">красным текстом</span>'
  },
  { 
    name: 'Неподдерживаемый тег div',
    input: '<div>Блок текста</div>'
  },
  { 
    name: 'Неподдерживаемый тег strong',
    input: 'Текст с <strong>выделением</strong>'
  },
  { 
    name: 'Неподдерживаемый тег h1',
    input: '<h1>Заголовок</h1>'
  },
  {
    name: 'Смесь поддерживаемых и неподдерживаемых тегов',
    input: '<div><b>Жирный текст</b> <span>в блоке</span></div>'
  },
  {
    name: 'Вложенные неподдерживаемые теги',
    input: '<div><span>Текст <strong>с выделением</strong></span></div>'
  },
  {
    name: 'Список с пунктами',
    input: '<ul><li>Пункт 1</li><li>Пункт 2</li></ul>'
  }
];

/**
 * Выполняет один тест на удаление неподдерживаемых тегов
 * @param {Object} testCase Объект с тестовыми данными
 * @returns {Promise<void>}
 */
async function runTest(testCase) {
  try {
    console.log(`\n===== Тест: ${testCase.name} =====`);
    console.log('Исходный текст:', testCase.input);
    
    // Вызываем агрессивный метод исправления
    const response = await axios.post(`${API_BASE_URL}/api/test/fix-html`, {
      text: testCase.input,
      aggressive: true
    });
    
    console.log('\nОбработанный текст:');
    console.log(response.data.fixedText);
    
    // Проверяем, что неподдерживаемые теги были удалены
    const hasUnsupportedTags = /(<span|<div|<strong|<h1|<ul|<li)/i.test(response.data.fixedText);
    console.log('\nНеподдерживаемые теги удалены:', !hasUnsupportedTags);
    
    if (hasUnsupportedTags) {
      console.log('\n⚠️ В обработанном тексте остались неподдерживаемые теги!');
    } else {
      console.log('\n✅ Неподдерживаемые теги успешно удалены');
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
  console.log('Тестирование удаления неподдерживаемых HTML-тегов в Telegram');
  console.log('=======================================================\n');
  
  for (const testCase of TEST_CASES) {
    await runTest(testCase);
  }
  
  console.log('\nТестирование завершено!');
}

// Запускаем тесты
runAllTests();