#!/bin/bash

echo "🔄 Восстановление базы данных из последнего бэкапа"

# Переходим в директорию с бэкапами
cd /root/backup

# Находим последний бэкап
LATEST_BACKUP=$(ls -t all_databases_*.sql 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ Бэкап не найден в /root/backup/"
    echo "Доступные файлы:"
    ls -la /root/backup/
    exit 1
fi

echo "📦 Найден последний бэкап: $LATEST_BACKUP"
echo "📅 Дата создания: $(stat -c %y "$LATEST_BACKUP")"

# Подтверждение
read -p "Восстановить базу данных из этого бэкапа? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "Отменено пользователем"
    exit 0
fi

echo "⏹️ Остановка приложения..."
cd /root
docker-compose stop

echo "🗄️ Восстановление базы данных..."
docker exec root-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS directus;"
docker exec root-postgres-1 psql -U postgres -c "CREATE DATABASE directus;"

echo "📥 Восстановление данных из бэкапа..."
docker exec -i root-postgres-1 psql -U postgres < /root/backup/$LATEST_BACKUP

echo "🚀 Запуск приложения..."
docker-compose up -d

echo "⏳ Ожидание запуска сервисов..."
sleep 30

echo "📋 Проверка статуса контейнеров..."
docker-compose ps

echo "✅ Восстановление завершено!"
echo "🌐 Приложение доступно по адресу: https://roboflow.tech"
echo "🔧 Directus доступен по адресу: https://directus.roboflow.tech"