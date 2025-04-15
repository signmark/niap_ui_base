#!/bin/bash
# Цвета для удобного отображения информации
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Установка AWS SDK и настройка Beget S3 =====${NC}"

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

# Прямая установка AWS SDK в контейнере
echo -e "${YELLOW}Выполняем установку AWS SDK пакетов в контейнере...${NC}"

# Проверка, работает ли контейнер
CONTAINER_RUNNING=$(docker ps -q -f name=root-smm-1)
if [ -z "$CONTAINER_RUNNING" ]; then
    echo -e "${RED}Контейнер smm не запущен!${NC}"
    echo -e "${YELLOW}Запустите контейнер перед установкой пакетов:${NC}"
    echo -e "cd .. && docker-compose up -d smm"
    exit 1
fi

# Копирование aws-package.json в контейнер
if [ -f "./aws-package.json" ]; then
    echo -e "${YELLOW}Копирование package.json с AWS SDK в контейнер...${NC}"
    docker cp aws-package.json root-smm-1:/app/aws-package.json
    
    # Установка пакетов в контейнере
    echo -e "${YELLOW}Установка пакетов AWS SDK...${NC}"
    docker exec -i root-smm-1 bash -c "cd /app && npm install --save @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Пакеты AWS SDK успешно установлены${NC}"
        
        # Проверка, что пакеты установлены
        docker exec -i root-smm-1 bash -c "cd /app && npm ls @aws-sdk/client-s3"
        
        # Перезапуск контейнера
        echo -e "${YELLOW}Перезапуск контейнера...${NC}"
        docker restart root-smm-1
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Контейнер успешно перезапущен${NC}"
            echo -e "${YELLOW}Проверьте логи контейнера через 5-10 секунд:${NC}"
            echo -e "docker logs root-smm-1"
        else
            echo -e "${RED}Ошибка при перезапуске контейнера${NC}"
        fi
    else
        echo -e "${RED}Ошибка при установке пакетов AWS SDK${NC}"
        echo -e "${YELLOW}Возможно потребуется полная пересборка образа${NC}"
    fi
else
    echo -e "${RED}Файл aws-package.json не найден${NC}"
    echo -e "${YELLOW}Создание временного файла...${NC}"
    
    cat > aws-temp-package.json << EOL
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.523.0",
    "@aws-sdk/s3-request-presigner": "^3.523.0",
    "@aws-sdk/lib-storage": "^3.523.0"
  }
}
EOL
    
    docker cp aws-temp-package.json root-smm-1:/app/aws-package.json
    
    # Установка пакетов в контейнере
    echo -e "${YELLOW}Установка пакетов AWS SDK...${NC}"
    docker exec -i root-smm-1 bash -c "cd /app && npm install --save @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage"
    
    # Удаление временного файла
    rm -f aws-temp-package.json
    docker exec -i root-smm-1 bash -c "rm -f /app/aws-package.json"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Пакеты AWS SDK успешно установлены${NC}"
        
        # Перезапуск контейнера
        echo -e "${YELLOW}Перезапуск контейнера...${NC}"
        docker restart root-smm-1
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Контейнер успешно перезапущен${NC}"
            echo -e "${YELLOW}Проверьте логи контейнера через 5-10 секунд:${NC}"
            echo -e "docker logs root-smm-1"
        else
            echo -e "${RED}Ошибка при перезапуске контейнера${NC}"
        fi
    else
        echo -e "${RED}Ошибка при установке пакетов AWS SDK${NC}"
        echo -e "${YELLOW}Возможно потребуется полная пересборка образа${NC}"
    fi
fi

# Рекомендации по перестройке образа если установка не сработает
echo -e "${YELLOW}Если после перезапуска контейнера ошибка сохраняется:${NC}"
echo -e "1. Проверьте, что в .env указаны правильные ключи Beget S3"
echo -e "2. Выполните полную пересборку образа:"
echo -e "   cd .. && docker-compose build --no-cache smm && docker-compose up -d"

echo -e "${GREEN}===== Установка AWS SDK завершена =====${NC}"