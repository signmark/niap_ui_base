#!/bin/bash

# Скрипт для проверки наличия медиа в контенте с типом stories
# Требуется для предварительной валидации контента перед публикацией в Instagram Stories

# Настройки
API_URL="http://localhost:5000"
CONTENT_ID="${1:-}"
PLATFORM="instagram"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="content_media_check_${TIMESTAMP}.log"

# Цветные сообщения
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция логирования
log() {
  echo -e "$1" | tee -a "$LOG_FILE"
}

# Если ID контента не передан, выводим инструкцию
if [ -z "$CONTENT_ID" ]; then
  log "${RED}Необходимо указать ID контента для проверки!${NC}"
  log "Использование: $0 <content_id>"
  exit 1
fi

# Старт проверки
log "${BLUE}===============================================${NC}"
log "${BLUE}Проверка медиа для контента (Instagram Stories)${NC}"
log "${BLUE}===============================================${NC}"
log "${BLUE}API URL: $API_URL${NC}"
log "${BLUE}Контент ID: $CONTENT_ID${NC}"

# Получаем контент
log "${BLUE}Получение информации о контенте...${NC}"
CONTENT_RESPONSE=$(curl -s "${API_URL}/api/campaign-content/${CONTENT_ID}")
TITLE=$(echo $CONTENT_RESPONSE | jq -r '.data.title')
CONTENT_TYPE=$(echo $CONTENT_RESPONSE | jq -r '.data.contentType')
PLATFORM_DATA=$(echo $CONTENT_RESPONSE | jq -r '.data.social_platforms')

log "${BLUE}Заголовок: ${NC}$TITLE"
log "${BLUE}Тип контента: ${NC}$CONTENT_TYPE"

# Проверка типа контента
if [ "$CONTENT_TYPE" != "stories" ]; then
  log "${YELLOW}ВНИМАНИЕ: Контент имеет тип '$CONTENT_TYPE', а не 'stories'.${NC}"
  log "${YELLOW}Это может привести к ошибке при публикации в Instagram Stories.${NC}"
fi

# Проверяем наличие различных медиа полей
log "${BLUE}Проверка доступности медиа для публикации в Instagram Stories:${NC}"

# Проверяем основные поля для изображений и видео
IMAGE_URL=$(echo $CONTENT_RESPONSE | jq -r '.data.imageUrl')
VIDEO_URL=$(echo $CONTENT_RESPONSE | jq -r '.data.videoUrl')
ADDITIONAL_IMAGES=$(echo $CONTENT_RESPONSE | jq -r '.data.additionalImages')
ADDITIONAL_VIDEOS=$(echo $CONTENT_RESPONSE | jq -r '.data.additionalVideos')
ADDITIONAL_MEDIA=$(echo $CONTENT_RESPONSE | jq -r '.data.additionalMedia')

# Проверка основного изображения
if [ "$IMAGE_URL" != "null" ] && [ -n "$IMAGE_URL" ]; then
  log "${GREEN}✓ Основное изображение: $IMAGE_URL${NC}"
  HAS_MEDIA=true
else
  log "${YELLOW}✗ Основное изображение отсутствует${NC}"
fi

# Проверка основного видео
if [ "$VIDEO_URL" != "null" ] && [ -n "$VIDEO_URL" ]; then
  log "${GREEN}✓ Основное видео: $VIDEO_URL${NC}"
  HAS_MEDIA=true
else
  log "${YELLOW}✗ Основное видео отсутствует${NC}"
fi

# Проверка дополнительных изображений
if [ "$ADDITIONAL_IMAGES" != "null" ] && [ "$ADDITIONAL_IMAGES" != "[]" ]; then
  IMAGES_COUNT=$(echo $ADDITIONAL_IMAGES | jq 'if type == "array" then length else 0 end')
  if [ "$IMAGES_COUNT" -gt 0 ]; then
    log "${GREEN}✓ Дополнительные изображения: $IMAGES_COUNT${NC}"
    echo $ADDITIONAL_IMAGES | jq -r '.[] | "  - \(.)"' | tee -a "$LOG_FILE"
    HAS_MEDIA=true
  else
    log "${YELLOW}✗ Дополнительные изображения отсутствуют${NC}"
  fi
else
  log "${YELLOW}✗ Дополнительные изображения отсутствуют${NC}"
fi

# Проверка дополнительных видео
if [ "$ADDITIONAL_VIDEOS" != "null" ] && [ "$ADDITIONAL_VIDEOS" != "[]" ]; then
  VIDEOS_COUNT=$(echo $ADDITIONAL_VIDEOS | jq 'if type == "array" then length else 0 end')
  if [ "$VIDEOS_COUNT" -gt 0 ]; then
    log "${GREEN}✓ Дополнительные видео: $VIDEOS_COUNT${NC}"
    echo $ADDITIONAL_VIDEOS | jq -r '.[] | "  - \(.)"' | tee -a "$LOG_FILE"
    HAS_MEDIA=true
  else
    log "${YELLOW}✗ Дополнительные видео отсутствуют${NC}"
  fi
else
  log "${YELLOW}✗ Дополнительные видео отсутствуют${NC}"
fi

# Проверка поля additionalMedia (может использоваться в stories)
if [ "$ADDITIONAL_MEDIA" != "null" ] && [ "$ADDITIONAL_MEDIA" != "[]" ]; then
  log "${GREEN}✓ Поле additionalMedia содержит данные:${NC}"
  echo $ADDITIONAL_MEDIA | jq '.' | tee -a "$LOG_FILE"
  HAS_MEDIA=true
else
  log "${YELLOW}✗ Поле additionalMedia пусто${NC}"
fi

# Итоговая проверка
log "${BLUE}===============================================${NC}"
if [ "$HAS_MEDIA" = true ]; then
  log "${GREEN}✓ Контент содержит медиа и может быть опубликован в Instagram Stories${NC}"
  exit 0
else
  log "${RED}✗ ОШИБКА: Контент не содержит медиа! Для публикации в Instagram Stories необходимо наличие изображения или видео.${NC}"
  exit 1
fi