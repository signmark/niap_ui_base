#!/bin/bash

# Проверка публикации Instagram Stories для конкретного контента
# Запуск: bash test-instagram-stories.sh

# ID тестируемого контента
CONTENT_ID="e8936ebf-75d3-4dd1-9f85-1970f186b219"

# Настройки API
API_URL="http://localhost:5000"

# Цвета для вывода
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

echo -e "${YELLOW}=====================================================${NC}"
echo -e "${YELLOW}ТЕСТ ПУБЛИКАЦИИ INSTAGRAM STORIES${NC}"
echo -e "${YELLOW}=====================================================${NC}"

# Получение токена из .env (если есть)
if [ -f .env ]; then
  source .env
  echo -e "${BLUE}[INFO] Загружены переменные окружения из .env${NC}"
fi

# Информация о параметрах запроса
echo -e "${BLUE}[INFO] Тестирование публикации для контента: ${CONTENT_ID}${NC}"

# Выполнение запроса на публикацию
echo -e "${BLUE}[INFO] Отправка запроса на публикацию...${NC}"

if [ -n "$AUTH_TOKEN" ]; then
  AUTH_HEADER="-H \"Authorization: Bearer $AUTH_TOKEN\""
else
  AUTH_HEADER=""
fi

# Сохраняем вывод в лог-файл для анализа
LOG_FILE="instagram_stories_test_$(date +'%Y%m%d_%H%M%S').log"

# Формируем команду запроса
CURL_CMD="curl -s -X POST \"${API_URL}/api/publish/instagram/stories\" \
  -H \"Content-Type: application/json\" \
  ${AUTH_HEADER} \
  -d '{\"contentId\":\"${CONTENT_ID}\"}'"

# Выполняем запрос и сохраняем результат
echo -e "${BLUE}[INFO] Выполнение команды: ${CURL_CMD}${NC}"
echo "Выполнение команды: ${CURL_CMD}" > ${LOG_FILE}

# Выполнение запроса
RESPONSE=$(eval ${CURL_CMD})
echo "$RESPONSE" >> ${LOG_FILE}

# Анализ ответа
echo -e "${BLUE}[INFO] Ответ сервера получен${NC}"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Проверка успешности публикации
if echo "$RESPONSE" | grep -q "success\":true"; then
  echo -e "${GREEN}[SUCCESS] Публикация Instagram Stories успешно выполнена!${NC}"
else
  echo -e "${RED}[ERROR] Ошибка при публикации Instagram Stories!${NC}"
  echo -e "${YELLOW}[INFO] Подробности в файле: ${LOG_FILE}${NC}"
fi

echo -e "${YELLOW}=====================================================${NC}"
echo -e "${BLUE}[INFO] Проверка деталей контента для диагностики...${NC}"

# Получение информации о контенте
CONTENT_CMD="curl -s \"${API_URL}/api/campaign-content/${CONTENT_ID}\" ${AUTH_HEADER}"
CONTENT_RESPONSE=$(eval ${CONTENT_CMD})

echo "Информация о контенте:" >> ${LOG_FILE}
echo "$CONTENT_RESPONSE" >> ${LOG_FILE}

# Извлечение и отображение ключевых полей
CONTENT_TYPE=$(echo "$CONTENT_RESPONSE" | jq -r '.data.contentType' 2>/dev/null || echo "Не удалось извлечь")
TITLE=$(echo "$CONTENT_RESPONSE" | jq -r '.data.title' 2>/dev/null || echo "Не удалось извлечь")
HAS_IMAGE=$(echo "$CONTENT_RESPONSE" | jq -r 'if .data.imageUrl then "Да" else "Нет" end' 2>/dev/null || echo "Не удалось извлечь")
HAS_ADDITIONAL_IMAGES=$(echo "$CONTENT_RESPONSE" | jq -r 'if .data.additionalImages then "Да" else "Нет" end' 2>/dev/null || echo "Не удалось извлечь")

echo -e "${BLUE}Тип контента:${NC} $CONTENT_TYPE"
echo -e "${BLUE}Заголовок:${NC} $TITLE"
echo -e "${BLUE}Имеет основное изображение:${NC} $HAS_IMAGE"
echo -e "${BLUE}Имеет дополнительные изображения:${NC} $HAS_ADDITIONAL_IMAGES"

echo -e "${YELLOW}=====================================================${NC}"
echo -e "${GREEN}Тест завершен. Результаты сохранены в ${LOG_FILE}${NC}"
echo -e "${YELLOW}=====================================================${NC}"