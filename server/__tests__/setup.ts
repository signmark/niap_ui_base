/**
 * Конфигурация для тестов
 * Этот файл запускается перед выполнением каждого теста
 */

// Устанавливаем NODE_ENV для тестов
process.env.NODE_ENV = 'test';

// Устанавливаем таймаут для тестов
jest.setTimeout(30000);

// Глобальные моки
global.console = {
  ...console,
  // Можно отключить или модифицировать вывод консоли в тестах
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Очистка всех моков после каждого теста
afterEach(() => {
  jest.clearAllMocks();
});