import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

/**
 * Конфигурация Playwright для автоматического тестирования
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  // Максимальное время выполнения теста
  expect: {
    timeout: 5000
  },
  // Сообщать о медленных тестах
  reportSlowTests: {
    max: 0,
    threshold: 60000
  },
  // Количество повторных попыток для проваленных тестов
  retries: process.env.CI ? 2 : 0,
  // Параллельность в CI
  workers: process.env.CI ? 1 : undefined,
  // Репортер для вывода результатов
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  // Общие настройки для всех проектов
  use: {
    // Максимальное время для действий с Trace Viewer
    actionTimeout: 5000,
    // Базовый URL для доступа к приложению
    baseURL: 'http://localhost:5000',
    // Записывать трассировку при проваленных тестах
    trace: 'on-first-retry',
    // Записывать видео при проваленных тестах
    video: 'on-first-retry',
    // Скриншоты при проваленных тестах
    screenshot: 'only-on-failure',
  },
  // Проекты для разных браузеров и окружений
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'telegram-api-tests',
      testMatch: /telegram.*\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        // Передаем переменные через process.env, а не через use
      },
    },
  ],
  // Настройки веб-сервера
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});