/**
 * Скрипт для запуска тестов
 * Для запуска используйте команду: node run-tests.js
 */

import { execSync } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';

// Загружаем переменные окружения
dotenv.config();

// Проверяем наличие Jest в локальных зависимостях
try {
  require.resolve('jest');
  console.log('Jest найден в локальных зависимостях.');
} catch (e) {
  console.error('Ошибка: Jest не установлен. Установите его с помощью: npm install jest');
  process.exit(1);
}

// Проверяем, что в .env есть необходимые переменные окружения для Directus
const requiredEnvVars = ['DIRECTUS_ADMIN_EMAIL', 'DIRECTUS_ADMIN_PASSWORD', 'DIRECTUS_URL'];
const missingVars = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  }
}

if (missingVars.length > 0) {
  console.error(`Ошибка: Отсутствуют необходимые переменные окружения: ${missingVars.join(', ')}`);
  console.error('Задайте их в файле .env и запустите скрипт заново.');
  process.exit(1);
}

// Проверяем указан ли путь к тесту в аргументах
const args = process.argv.slice(2);
let testPath = '';

if (args.length > 0) {
  testPath = args[0];
  
  // Проверяем существование файла теста
  if (!fs.existsSync(testPath)) {
    console.error(`Ошибка: Тест по пути ${testPath} не найден.`);
    process.exit(1);
  }
  
  console.log(`Запускаем тест: ${testPath}`);
} else {
  console.log('Запускаем все тесты...');
}

// Запускаем тесты
try {
  const command = testPath 
    ? `npx jest ${testPath} --verbose` 
    : 'npx jest --verbose';
  
  console.log(`Выполнение команды: ${command}`);
  execSync(command, { stdio: 'inherit' });
  
  console.log('Тесты успешно выполнены.');
} catch (error) {
  console.error('Ошибка при выполнении тестов:', error.message);
  process.exit(1);
}