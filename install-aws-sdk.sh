#!/bin/bash

# Определение текущей директории
CURRENT_DIR=$(pwd)
DIR_NAME=$(basename "$CURRENT_DIR")

# Проверка, что скрипт запущен из директории smm
if [ "$DIR_NAME" != "smm" ]; then
    echo "Ошибка: этот скрипт должен запускаться из директории smm"
    echo "Перейдите в директорию smm и запустите скрипт снова"
    exit 1
fi

# Инструкции для администратора
echo "==================== ИНСТРУКЦИЯ ===================="
echo "1. Сначала скопируйте этот файл на сервер в директорию smm"
echo "2. Из директории smm выполните: cp fixed-docker-compose.yml ../docker-compose.yml"
echo "3. Из директории smm выполните: cp env.example ../.env"
echo "4. Отредактируйте файл ../.env и добавьте ваши ключи Beget S3"
echo "5. Продолжайте установку AWS SDK с помощью этого скрипта"
echo "====================================================="

# Проверяем, хочет ли пользователь продолжить
read -p "Вы уже выполнили предварительные шаги? (y/n): " choice
if [ "$choice" != "y" ] && [ "$choice" != "Y" ]; then
    echo "Выполните предварительные шаги и запустите скрипт снова"
    exit 0
fi

# Проверка наличия файла fixed-docker-compose.yml
if [ -f "./fixed-docker-compose.yml" ]; then
    echo "Обнаружен файл fixed-docker-compose.yml, рекомендуется скопировать его:"
    echo "cp ./fixed-docker-compose.yml ../docker-compose.yml"
fi

# Установка AWS SDK в контейнере SMM
echo "Установка пакетов AWS SDK в контейнере SMM..."
docker exec -i root-smm-1 npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage --save

# Проверка результата установки
if [ $? -eq 0 ]; then
    echo "Пакеты AWS SDK успешно установлены"
    echo "Перезапуск контейнера SMM..."
    docker restart root-smm-1
    echo "Контейнер перезапущен. Проверьте логи контейнера на наличие ошибок:"
    echo "docker logs root-smm-1"
else
    echo "Ошибка установки пакетов AWS SDK"
    echo "Проверьте доступность контейнера SMM (docker ps) и наличие интернет-соединения"
    echo "Возможно потребуется пересборка образа:"
    echo "cd .. && docker-compose build --no-cache smm"
    echo "docker-compose up -d"
fi