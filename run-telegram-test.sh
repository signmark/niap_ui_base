#!/bin/bash

# Скрипт для запуска только тестов интеграции с Telegram

# Проверяем переменные окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "⚠️ ВНИМАНИЕ: Отсутствуют переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID"
  echo "Тесты могут быть пропущены или завершиться с ошибкой."
  echo ""
fi

# Проверяем, существует ли указанный тест
TEST_FILE="tests/e2e/telegram.spec.ts"
if [ ! -f "$TEST_FILE" ]; then
  echo "❌ Ошибка: Файл теста $TEST_FILE не найден"
  exit 1
fi

# Параметры запуска
PARAMS=""

# Проверяем переданные параметры
if [ "$1" == "debug" ]; then
  echo "🔍 Запускаем тест в режиме отладки..."
  PARAMS="--debug"
elif [ "$1" == "headed" ]; then
  echo "🖥️ Запускаем тест в режиме с браузером..."
  PARAMS="--headed"
elif [ "$1" == "ui" ]; then
  echo "🖼️ Запускаем тест с интерфейсом Playwright..."
  PARAMS="--ui"
fi

echo "🚀 Запускаем тест интеграции с Telegram..."
npx playwright test $TEST_FILE $PARAMS

# Проверяем код возврата
if [ $? -eq 0 ]; then
  echo "✅ Тесты успешно завершены!"
else
  echo "❌ Тесты завершились с ошибками"
fi