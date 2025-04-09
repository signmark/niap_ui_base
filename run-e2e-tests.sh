#!/bin/bash

# Скрипт для запуска E2E тестов Playwright

# Проверяем, установлены ли необходимые пакеты
if ! npx playwright --version &> /dev/null; then
  echo "Устанавливаем Playwright..."
  npx playwright install
fi

# Запускаем все E2E тесты
echo "Запускаем все E2E тесты..."
npx playwright test

# Запускаем только тесты Telegram
echo "Запускаем только тесты Telegram..."
npx playwright test tests/e2e/telegram.spec.ts