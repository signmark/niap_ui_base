#!/bin/bash

echo "🔧 Исправление YouTube redirect URI на продакшене"
echo "=============================================="

echo "📝 Текущие проблемы:"
echo "1. DIRECTUS_TOKEN истёк - код не может получить ключи из базы"
echo "2. YOUTUBE_REDIRECT_URI указывает на старый replit.dev URL"
echo "3. Нужен продакшен URL: https://smm.nplanner.ru/api/youtube/auth/callback"
echo ""

echo "🔧 Команды для исправления на продакшене:"
echo ""

echo "1️⃣ Обновить DIRECTUS_TOKEN (получить новый через админку Directus):"
echo "   - Зайти в https://directus.roboflow.space"
echo "   - Settings > Access Tokens > Create new token"
echo "   - Обновить переменную DIRECTUS_TOKEN в .env продакшена"
echo ""

echo "2️⃣ Обновить YOUTUBE_REDIRECT_URI в .env продакшена:"
echo "   export YOUTUBE_REDIRECT_URI='https://smm.nplanner.ru/api/youtube/auth/callback'"
echo ""

echo "3️⃣ Или обновить redirect URI в базе данных через SQL:"
echo "   UPDATE global_api_keys"
echo "   SET api_key = 'https://smm.nplanner.ru/api/youtube/auth/callback'"
echo "   WHERE service_name = 'YOUTUBE_REDIRECT_URI' AND is_active = true;"
echo ""

echo "4️⃣ Обновить Google OAuth консоль:"
echo "   - Зайти в https://console.cloud.google.com/"
echo "   - APIs & Services > Credentials"
echo "   - Найти YouTube OAuth приложение"
echo "   - Добавить https://smm.nplanner.ru/api/youtube/auth/callback в Authorized redirect URIs"
echo ""

echo "5️⃣ Перезапустить продакшен сервер после изменений"
echo ""

echo "✅ После исправления YouTube OAuth будет работать на продакшене"