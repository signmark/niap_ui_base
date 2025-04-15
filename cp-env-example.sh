#!/bin/bash

# Копирование env.example в нужное место
echo "Копирование env.example в корневую директорию..."

# Определение текущей директории
CURRENT_DIR=$(pwd)
BASE_DIR=$(dirname "$CURRENT_DIR")
DIR_NAME=$(basename "$CURRENT_DIR")

# Проверка, в какой директории мы находимся
if [ "$DIR_NAME" == "smm" ]; then
    # Мы в директории smm
    echo "Обнаружено выполнение из директории smm"
    
    # Проверка наличия файла env.example в текущей директории
    if [ -f "./env.example" ]; then
        # Резервное копирование существующего .env файла в родительской директории
        if [ -f "../.env" ]; then
            echo "Создание резервной копии текущего .env файла..."
            cp ../.env ../.env.backup.$(date +%Y%m%d%H%M%S)
            echo "Резервная копия создана"
        fi
        
        # Копирование примера в .env в родительской директории
        cp ./env.example ../.env
        echo "Файл env.example скопирован в .env в родительской директории"
        echo "Пожалуйста, отредактируйте ../.env файл и добавьте ваши ключи Beget S3"
    else
        echo "Файл env.example не найден в текущей директории"
        exit 1
    fi
else
    # Мы в родительской директории
    echo "Обнаружено выполнение из родительской директории"
    
    # Проверка наличия файла env.example в директории smm
    if [ -f "./smm/env.example" ]; then
        # Резервное копирование существующего .env файла в корне
        if [ -f "./.env" ]; then
            echo "Создание резервной копии текущего .env файла..."
            cp ./.env ./.env.backup.$(date +%Y%m%d%H%M%S)
            echo "Резервная копия создана"
        fi
        
        # Копирование примера в .env в корневой директории
        cp ./smm/env.example ./.env
        echo "Файл env.example скопирован в .env в корневой директории"
        echo "Пожалуйста, отредактируйте .env файл и добавьте ваши ключи Beget S3"
    else
        echo "Файл env.example не найден в директории smm"
        exit 1
    fi
fi