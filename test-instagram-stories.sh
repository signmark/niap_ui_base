#!/bin/bash

# Скрипт для тестирования публикации Instagram Stories

# Настройки
API_URL="http://localhost:5000"
TEST_CONTENT_ID="c8db1fd0-6fd3-4a21-ab5d-c4efd801bb63"
PLATFORM="instagram"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="instagram_stories_test_${TIMESTAMP}.log"

# Функция логирования
log() {
  echo "[$(date '+%T')] $1" | tee -a "$LOG_FILE"
}

# Старт теста
log "============================================="
log "Тестирование публикации Instagram Stories"
log "============================================="
log "API URL: $API_URL"
log "Контент ID: $TEST_CONTENT_ID"
log "Платформа: $PLATFORM"

# Получаем контент для проверки
log "Получение информации о контенте..."
CONTENT_RESPONSE=$(curl -s "${API_URL}/api/campaign-content/${TEST_CONTENT_ID}")
CONTENT_TYPE=$(echo $CONTENT_RESPONSE | jq -r '.data.contentType')
MEDIA_URL=$(echo $CONTENT_RESPONSE | jq -r '.data.imageUrl')
ADDITIONAL_MEDIA=$(echo $CONTENT_RESPONSE | jq -r '.data.additionalMedia')

log "Тип контента: $CONTENT_TYPE"
log "URL медиа: $MEDIA_URL"
log "Дополнительные медиа: $ADDITIONAL_MEDIA"

if [ "$CONTENT_TYPE" != "stories" ]; then
  log "ВНИМАНИЕ: Контент имеет тип '$CONTENT_TYPE', а не 'stories'. Это может привести к ошибке."
fi

if [ -z "$MEDIA_URL" ] && [ "$ADDITIONAL_MEDIA" == "null" ]; then
  log "ВНИМАНИЕ: Не найдено медиа для сторис. Необходимо наличие изображения или видео."
fi

# Выполняем запрос на публикацию
log "Отправка запроса на публикацию сторис..."
RESPONSE=$(curl -s -X POST "${API_URL}/api/publish/stories" \
  -H "Content-Type: application/json" \
  -d "{\"contentId\":\"${TEST_CONTENT_ID}\", \"platform\":\"${PLATFORM}\"}")

# Выводим результат
log "============================================="
log "Результат публикации:"
log "============================================="
echo $RESPONSE | jq . | tee -a "$LOG_FILE"

# Проверяем статус публикации
SUCCESS=$(echo $RESPONSE | jq -r '.success')

if [ "$SUCCESS" == "true" ]; then
  log "Тест завершен успешно!"
  exit 0
else
  ERROR=$(echo $RESPONSE | jq -r '.error')
  log "Тест завершен с ошибкой: $ERROR"
  exit 1
fi