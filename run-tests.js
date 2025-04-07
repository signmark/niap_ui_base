/**
 * Скрипт для запуска тестов
 * Для запуска используйте команду: node run-tests.js
 */
const { execSync } = require('child_process');

// Устанавливаем переменную окружения NODE_ENV=test
process.env.NODE_ENV = 'test';

try {
  // Выполняем команду для запуска Jest
  console.log('Запуск тестов...');
  execSync('node_modules/.bin/jest', { stdio: 'inherit' });
  console.log('Тесты выполнены успешно!');
} catch (error) {
  console.error('Ошибка при выполнении тестов:', error.message);
  process.exit(1);
}