#!/bin/bash

# Тестирование публикации Instagram Stories через API
CONTENT_ID="244c9fbd-dfab-445c-bc5d-dff085eb482d"
API_URL="http://localhost:5000/api/test/instagram-stories"
LOG_FILE="instagram_stories_test_$(date +%Y%m%d_%H%M%S).log"

echo "===== ТЕСТ INSTAGRAM STORIES =====" | tee -a "$LOG_FILE"
echo "Дата и время запуска: $(date)" | tee -a "$LOG_FILE"
echo "Отправка запроса на публикацию сторис ID: $CONTENT_ID" | tee -a "$LOG_FILE"
echo "API URL: $API_URL" | tee -a "$LOG_FILE"
echo "Лог-файл: $LOG_FILE" | tee -a "$LOG_FILE"
echo "--------------------------------" | tee -a "$LOG_FILE"

# Устанавливаем таймаут 30 секунд для curl
echo "Отправка запроса с таймаутом 30 секунд..." | tee -a "$LOG_FILE"
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"contentId\": \"$CONTENT_ID\"}" \
  --max-time 30 \
  $API_URL)

result=$?

echo -e "\n=== РЕЗУЛЬТАТ ЗАПРОСА ===" | tee -a "$LOG_FILE"
if [ $result -eq 0 ]; then
  echo "Запрос успешно выполнен (код: $result)" | tee -a "$LOG_FILE"
  
  # Красиво форматируем JSON ответ с помощью python
  echo -e "\n=== ОТВЕТ СЕРВЕРА ===" | tee -a "$LOG_FILE"
  echo "$response" | python -m json.tool | tee -a "$LOG_FILE"
  
  # Извлекаем статус публикации
  if [[ "$response" == *"\"status\""* ]]; then
    status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo -e "\nСтатус публикации: $status" | tee -a "$LOG_FILE"
  fi
  
  # Извлекаем URL публикации, если есть
  if [[ "$response" == *"\"postUrl\""* ]]; then
    postUrl=$(echo "$response" | grep -o '"postUrl":"[^"]*"' | cut -d'"' -f4)
    echo "URL публикации: $postUrl" | tee -a "$LOG_FILE"
  fi
  
  # Проверяем на наличие ошибок
  if [[ "$response" == *"\"error\""* ]]; then
    error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "ОШИБКА: $error" | tee -a "$LOG_FILE"
  fi
else
  echo "Ошибка при выполнении запроса. Код: $result" | tee -a "$LOG_FILE"
  if [ $result -eq 28 ]; then
    echo "Превышен таймаут (30 секунд)" | tee -a "$LOG_FILE"
  fi
fi

echo -e "\n=== ТЕСТ ЗАВЕРШЕН ===" | tee -a "$LOG_FILE"
echo "Результаты сохранены в файл: $LOG_FILE" | tee -a "$LOG_FILE"