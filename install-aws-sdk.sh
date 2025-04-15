#!/bin/bash

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
fi