#!/bin/bash

# Скрипт для развертывания поддержки Stories в production
# Запуск: ./deploy_stories_production.sh

set -e  # Остановка при любой ошибке

echo "🚀 Развертывание Stories в production..."
echo "=========================================="

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Установите Node.js для продолжения."
    exit 1
fi

# Проверяем наличие npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не найден. Установите npm для продолжения."
    exit 1
fi

# Проверяем переменные окружения
if [ -z "$PRODUCTION_ADMIN_EMAIL" ]; then
    echo "❌ Не задана переменная PRODUCTION_ADMIN_EMAIL"
    echo "   Установите: export PRODUCTION_ADMIN_EMAIL=admin@nplanner.ru"
    exit 1
fi

if [ -z "$PRODUCTION_ADMIN_PASSWORD" ]; then
    echo "❌ Не задана переменная PRODUCTION_ADMIN_PASSWORD"
    echo "   Установите: export PRODUCTION_ADMIN_PASSWORD=ваш_пароль"
    exit 1
fi

echo "✅ Переменные окружения настроены"
echo "📧 Email: $PRODUCTION_ADMIN_EMAIL"
echo "🌐 URL: https://directus.nplanner.ru"

# Устанавливаем зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install axios dotenv
fi

# Запускаем скрипт развертывания
echo "🔧 Запуск скрипта развертывания..."
node deploy_stories_metadata_field.js

echo ""
echo "🎉 Развертывание завершено!"
echo "✅ Stories готовы к использованию в production"