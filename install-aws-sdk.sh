#!/bin/bash
# Цвета для удобного отображения информации
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Установка AWS SDK в контейнере SMM =====${NC}"

# Проверка наличия fixed-docker-compose.yml и копирование при необходимости
if [ -f "./fixed-docker-compose.yml" ]; then
    echo -e "${YELLOW}Копирование исправленного docker-compose.yml в родительскую директорию...${NC}"
    cp ./fixed-docker-compose.yml ../docker-compose.yml
    echo -e "${GREEN}Файл docker-compose.yml успешно обновлен${NC}"
else
    echo -e "${YELLOW}Файл fixed-docker-compose.yml не найден, пропускаем копирование${NC}"
fi

# Проверка наличия env.example и копирование при необходимости
if [ -f "./env.example" ]; then
    if [ ! -f "../.env" ]; then
        echo -e "${YELLOW}Создание файла .env из шаблона...${NC}"
        cp ./env.example ../.env
        echo -e "${GREEN}Файл .env создан в родительской директории${NC}"
        echo -e "${YELLOW}ВАЖНО: необходимо отредактировать ../.env и добавить ключи Beget S3!${NC}"
    else
        echo -e "${GREEN}Файл .env уже существует в родительской директории${NC}"
    fi
else
    echo -e "${RED}Файл env.example не найден${NC}"
fi

# Копирование улучшенного deploy.sh в базовую директорию
if [ -f "./copy_to_parent_deploy.sh" ]; then
    echo -e "${YELLOW}Копирование улучшенного скрипта deploy.sh в родительскую директорию...${NC}"
    cp ./copy_to_parent_deploy.sh ../deploy.sh
    chmod +x ../deploy.sh
    echo -e "${GREEN}Скрипт deploy.sh успешно обновлен в родительской директории${NC}"
else
    echo -e "${YELLOW}Файл copy_to_parent_deploy.sh не найден, пропускаем копирование${NC}"
fi

# Установка AWS SDK в контейнере SMM
echo -e "${YELLOW}Установка пакетов AWS SDK в контейнере SMM...${NC}"
docker exec -i root-smm-1 npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage --save

# Проверка результата установки
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Пакеты AWS SDK успешно установлены${NC}"
    echo -e "${YELLOW}Перезапуск контейнера SMM...${NC}"
    docker restart root-smm-1
    echo -e "${GREEN}Контейнер перезапущен${NC}"
    echo -e "${YELLOW}Проверьте логи контейнера на наличие ошибок:${NC}"
    echo -e "docker logs root-smm-1"
else
    echo -e "${RED}Ошибка установки пакетов AWS SDK${NC}"
    echo -e "${YELLOW}Проверьте доступность контейнера SMM (docker ps) и наличие интернет-соединения${NC}"
    echo -e "${YELLOW}Возможно потребуется пересборка образа:${NC}"
    echo -e "cd .. && docker-compose build --no-cache smm"
    echo -e "docker-compose up -d"
fi

echo -e "${GREEN}===== Установка завершена =====${NC}"
echo -e "${YELLOW}Следующие шаги:${NC}"
echo -e "1. Убедитесь, что в ../.env указаны правильные ключи Beget S3"
echo -e "2. Если необходимо, запустите полный деплой: cd .. && ./deploy.sh"