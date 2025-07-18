// Глобальная настройка для тестов
import dotenv from 'dotenv';

// Загружаем переменные окружения для тестов
dotenv.config({ path: '.env.local' });

// Устанавливаем тестовое окружение
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DISABLE_PUBLISHING = 'true';

// Отключаем консольные логи во время тестов (кроме ошибок)
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;

console.log = jest.fn();
console.info = jest.fn();
console.warn = jest.fn();

// Восстанавливаем после каждого теста
afterEach(() => {
  jest.clearAllMocks();
});

// Глобальная очистка после всех тестов
afterAll(() => {
  console.log = originalConsoleLog;
  console.info = originalConsoleInfo;
  console.warn = originalConsoleWarn;
});