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

# Создание временного package.json с AWS SDK зависимостями
echo -e "${YELLOW}Создание временного package.json с AWS SDK зависимостями...${NC}"
cat > aws-sdk-dependencies.json << EOL
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.523.0",
    "@aws-sdk/s3-request-presigner": "^3.523.0",
    "@aws-sdk/lib-storage": "^3.523.0"
  }
}
EOL

# Копирование зависимостей в контейнер
echo -e "${YELLOW}Копирование зависимостей в контейнер...${NC}"
docker cp aws-sdk-dependencies.json root-smm-1:/app/aws-sdk-dependencies.json

# Установка зависимостей в контейнере
echo -e "${YELLOW}Установка AWS SDK в контейнере...${NC}"
docker exec -i root-smm-1 /bin/bash -c "cd /app && npm install --no-save --package-lock=false --no-package-lock $(cat aws-sdk-dependencies.json | grep -o '\"@aws-sdk/[^\"]*\"' | tr -d '\"')"

# Проверка результата установки
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Пакеты AWS SDK успешно установлены${NC}"
    
    # Удаление временного файла
    rm aws-sdk-dependencies.json
    docker exec -i root-smm-1 rm -f /app/aws-sdk-dependencies.json
    
    echo -e "${YELLOW}Перезапуск контейнера SMM...${NC}"
    docker restart root-smm-1
    echo -e "${GREEN}Контейнер перезапущен${NC}"
    
    # Проверяем, что контейнер успешно запустился
    sleep 5
    CONTAINER_RUNNING=$(docker ps -q -f name=root-smm-1)
    if [ -z "$CONTAINER_RUNNING" ]; then
        echo -e "${RED}Контейнер не запустился после перезапуска!${NC}"
        echo -e "${YELLOW}Проверьте логи: docker logs root-smm-1${NC}"
        echo -e "${YELLOW}Возможно потребуется пересборка образа...${NC}"
    else
        echo -e "${GREEN}Контейнер успешно перезапущен${NC}"
    fi
else
    echo -e "${RED}Ошибка установки пакетов AWS SDK${NC}"
    
    # Удаление временного файла
    rm -f aws-sdk-dependencies.json
    docker exec -i root-smm-1 rm -f /app/aws-sdk-dependencies.json
    
    echo -e "${YELLOW}Рекомендуется полная пересборка образа:${NC}"
fi

echo -e "${YELLOW}Выполнение пересборки образа с AWS SDK...${NC}"
cd ..
echo -e "${YELLOW}Остановка и удаление контейнера...${NC}"
docker-compose stop smm
docker-compose rm -f smm

echo -e "${YELLOW}Пересборка образа...${NC}"
docker-compose build --no-cache smm

echo -e "${YELLOW}Запуск нового контейнера...${NC}"
docker-compose up -d smm

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Образ успешно пересобран и запущен!${NC}"
else
    echo -e "${RED}Ошибка при пересборке образа${NC}"
    echo -e "${YELLOW}Проверьте логи docker-compose${NC}"
fi

echo -e "${GREEN}===== Установка завершена =====${NC}"
echo -e "${YELLOW}Следующие шаги:${NC}"
echo -e "1. Убедитесь, что в ./.env указаны правильные ключи Beget S3"
echo -e "2. Проверьте логи контейнера: docker logs root-smm-1"