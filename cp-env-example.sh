#!/bin/bash

# Копирование env.example в нужное место
echo "Копирование env.example в корневую директорию..."

# Проверка наличия файла env.example в директории smm
if [ -f "./smm/env.example" ]; then
    # Резервное копирование существующего .env файла в корне, если есть
    if [ -f "./.env" ]; then
        echo "Создание резервной копии текущего .env файла..."
        cp ./.env ./.env.backup.$(date +%Y%m%d%H%M%S)
        echo "Резервная копия создана"
    fi
    
    # Копирование примера в .env в корневой директории (на уровне docker-compose.yml)
    cp ./smm/env.example ./.env
    echo "Файл env.example скопирован в .env в корневой директории"
    echo "Пожалуйста, отредактируйте .env файл и добавьте ваши ключи Beget S3"
else
    echo "Файл env.example не найден в директории smm"
    exit 1
fi