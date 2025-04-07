/**
 * Скрипт для запуска тестов
 * Для запуска используйте команду: node run-tests.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');

// Загружаем переменные окружения из .env файла
dotenv.config();

// Устанавливаем переменную окружения NODE_ENV=test
process.env.NODE_ENV = 'test';

// Проверяем наличие обязательных переменных окружения для тестов
const requiredEnvVars = ['DIRECTUS_ADMIN_EMAIL', 'DIRECTUS_ADMIN_PASSWORD'];
const missingEnvVars = [];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar);
  }
});

if (missingEnvVars.length > 0) {
  console.warn(`ВНИМАНИЕ: Следующие переменные окружения не найдены: ${missingEnvVars.join(', ')}`);
  console.warn('Тесты будут использовать мокированные данные вместо реальных API-вызовов.');
} else {
  console.log('Обнаружены все необходимые переменные окружения для тестов с реальным API.');
}

try {
  // Выполняем команду для запуска Jest с передачей переменных окружения
  console.log('Запуск тестов...');
  execSync('node_modules/.bin/jest', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      // Добавляем флаг, позволяющий тестам знать, что мы запускаем их из скрипта
      TEST_RUNNER: 'run-tests.js'
    }
  });
  console.log('Тесты выполнены успешно!');
} catch (error) {
  console.error('Ошибка при выполнении тестов:', error.message);
  process.exit(1);
}