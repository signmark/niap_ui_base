#!/bin/bash

echo "🔄 Восстановление базы данных через ID контейнеров"

# Получаем ID контейнера PostgreSQL
POSTGRES_ID=$(docker ps | grep postgres | awk '{print $1}')

if [ -z "$POSTGRES_ID" ]; then
    echo "❌ PostgreSQL контейнер не найден"
    exit 1
fi

echo "📦 PostgreSQL контейнер ID: $POSTGRES_ID"

# Переходим в директорию с бэкапами
cd /root/backup

# Находим последний бэкап
LATEST_BACKUP=$(ls -t all_databases_*.sql 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ Бэкап не найден"
    exit 1
fi

echo "📦 Используем бэкап: $LATEST_BACKUP"

# Остановка сервисов
echo "⏹️ Остановка сервисов..."
cd /root
docker-compose stop

# Восстановление базы данных
echo "🗄️ Удаление старой базы данных..."
docker exec $POSTGRES_ID psql -U postgres -c "DROP DATABASE IF EXISTS directus;"

echo "🗄️ Создание новой базы данных..."
docker exec $POSTGRES_ID psql -U postgres -c "CREATE DATABASE directus;"

echo "📥 Восстановление данных из бэкапа..."
docker exec -i $POSTGRES_ID psql -U postgres < /root/backup/$LATEST_BACKUP

echo "🚀 Запуск сервисов..."
docker-compose up -d

echo "⏳ Ожидание запуска..."
sleep 30

echo "✅ Восстановление завершено!"
docker-compose ps