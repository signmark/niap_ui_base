#!/bin/bash

# Копирование env.example в нужное место
echo "Копирование env.example в директорию смм..."

# Проверка наличия файла env.example в текущей директории
if [ -f "./smm/env.example" ]; then
    # Резервное копирование существующего .env файла, если есть
    if [ -f "./smm/.env" ]; then
        echo "Создание резервной копии текущего .env файла..."
        cp ./smm/.env ./smm/.env.backup.$(date +%Y%m%d%H%M%S)
        echo "Резервная копия создана"
    fi
    
    # Копирование примера в .env
    cp ./smm/env.example ./smm/.env
    echo "Файл env.example скопирован в .env"
    echo "Пожалуйста, отредактируйте .env файл и добавьте ваши ключи Beget S3"
else
    echo "Файл env.example не найден в директории smm"
    exit 1
fi