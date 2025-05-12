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
  
  # Красиво форматируем JSON ответ с помощью python (если python установлен)
  echo -e "\n=== ОТВЕТ СЕРВЕРА ===" | tee -a "$LOG_FILE"
  if command -v python &> /dev/null; then
    echo "$response" | python -m json.tool | tee -a "$LOG_FILE"
  elif command -v jq &> /dev/null; then
    echo "$response" | jq | tee -a "$LOG_FILE"
  else
    echo "$response" | tee -a "$LOG_FILE"
  fi
  
  # Проверяем, успешный ли запрос
  if [[ "$response" == *"\"success\":true"* ]]; then
    echo -e "\nЗапрос выполнен успешно" | tee -a "$LOG_FILE"
    
    # Извлекаем информацию о публикации
    if [[ "$response" == *"\"publication\""* && "$response" == *"\"status\""* ]]; then
      # Используем grep для поиска статуса публикации
      status=$(echo "$response" | grep -o '"publication":{[^}]*"status":"[^"]*"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
      echo -e "Статус публикации: $status" | tee -a "$LOG_FILE"
      
      # Извлекаем URL публикации, если есть
      if [[ "$response" == *"\"postUrl\""* ]]; then
        postUrl=$(echo "$response" | grep -o '"postUrl":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo "URL публикации: $postUrl" | tee -a "$LOG_FILE"
      fi
    fi
  else
    echo -e "\nЗапрос завершился с ошибкой" | tee -a "$LOG_FILE"
  fi
  
  # Проверяем на наличие ошибок
  if [[ "$response" == *"\"error\""* ]]; then
    IFS=$'\n' read -rd '' -a errors < <(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    for error in "${errors[@]}"; do
      echo "ОШИБКА: $error" | tee -a "$LOG_FILE"
    done
  fi
else
  echo "Ошибка при выполнении запроса. Код: $result" | tee -a "$LOG_FILE"
  if [ $result -eq 28 ]; then
    echo "Превышен таймаут (30 секунд)" | tee -a "$LOG_FILE"
  fi
fi

echo -e "\n=== ТЕСТ ЗАВЕРШЕН ===" | tee -a "$LOG_FILE"
echo "Результаты сохранены в файл: $LOG_FILE" | tee -a "$LOG_FILE"