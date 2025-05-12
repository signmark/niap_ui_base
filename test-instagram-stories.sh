#!/bin/bash

# Тестирование публикации Instagram Stories через API
CONTENT_ID="244c9fbd-dfab-445c-bc5d-dff085eb482d"
API_URL="http://localhost:5000/api/test/instagram-stories"
LOG_FILE="instagram_stories_test_$(date +%Y%m%d_%H%M%S).log"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== ТЕСТ INSTAGRAM STORIES =====${NC}" | tee -a "$LOG_FILE"
echo "Дата и время запуска: $(date)" | tee -a "$LOG_FILE"
echo -e "Отправка запроса на публикацию сторис ID: ${YELLOW}$CONTENT_ID${NC}" | tee -a "$LOG_FILE"
echo "API URL: $API_URL" | tee -a "$LOG_FILE"
echo "Лог-файл: $LOG_FILE" | tee -a "$LOG_FILE"
echo "--------------------------------" | tee -a "$LOG_FILE"

# Проверяем, что переменная среды для тестового режима не установлена
if [ -n "$INSTAGRAM_TEST_MODE" ]; then
  echo -e "${RED}⚠️ ВНИМАНИЕ: Установлена переменная INSTAGRAM_TEST_MODE=$INSTAGRAM_TEST_MODE${NC}" | tee -a "$LOG_FILE"
  echo -e "${RED}Это может привести к использованию заглушек вместо реального API!${NC}" | tee -a "$LOG_FILE"
  echo "Хотите продолжить? (y/n)"
  read -r continue
  if [ "$continue" != "y" ]; then
    echo "Тестирование отменено." | tee -a "$LOG_FILE"
    exit 1
  fi
else
  echo -e "${GREEN}✓ Переменная INSTAGRAM_TEST_MODE не установлена${NC}" | tee -a "$LOG_FILE"
fi

# Проверяем, что для тестового ID не установлена переменная среды
if [ -n "$INSTAGRAM_TEST_CONTENT_ID" ] && [ "$INSTAGRAM_TEST_CONTENT_ID" == "$CONTENT_ID" ]; then
  echo -e "${RED}⚠️ ВНИМАНИЕ: Установлена переменная INSTAGRAM_TEST_CONTENT_ID=$INSTAGRAM_TEST_CONTENT_ID${NC}" | tee -a "$LOG_FILE"
  echo -e "${RED}Это приведет к использованию заглушек для данного ID!${NC}" | tee -a "$LOG_FILE"
  echo "Хотите продолжить? (y/n)"
  read -r continue
  if [ "$continue" != "y" ]; then
    echo "Тестирование отменено." | tee -a "$LOG_FILE"
    exit 1
  fi
else
  echo -e "${GREEN}✓ Переменная INSTAGRAM_TEST_CONTENT_ID не мешает настоящему тестированию${NC}" | tee -a "$LOG_FILE"
fi

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
    echo -e "\n${GREEN}✓ Запрос выполнен успешно${NC}" | tee -a "$LOG_FILE"
    
    # Проверяем наличие информации о публикации
    if [[ "$response" == *"\"publication\""* && "$response" == *"\"status\""* ]]; then
      # Используем grep и jq (если доступны) для извлечения информации о публикации
      if command -v jq &> /dev/null; then
        # Используем jq для извлечения данных (более надежный способ)
        status=$(echo "$response" | jq -r '.publication.status')
        postUrl=$(echo "$response" | jq -r '.publication.postUrl // "Не указан"')
        postId=$(echo "$response" | jq -r '.publication.postId // "Не указан"')
        publishTime=$(echo "$response" | jq -r '.publication.publishedAt // "Не указан"')
        
        echo -e "Статус публикации: ${GREEN}$status${NC}" | tee -a "$LOG_FILE"
        echo -e "ID публикации: ${YELLOW}$postId${NC}" | tee -a "$LOG_FILE"
        echo -e "Время публикации: $publishTime" | tee -a "$LOG_FILE"
        echo -e "URL публикации: ${YELLOW}$postUrl${NC}" | tee -a "$LOG_FILE"
        
        # Проверяем формат URL на соответствие ожидаемому формату Instagram Stories
        if [[ "$postUrl" == *"/stories/"* ]]; then
          echo -e "${GREEN}✓ URL публикации соответствует формату Instagram Stories${NC}" | tee -a "$LOG_FILE"
        else
          echo -e "${RED}⚠️ URL публикации не соответствует ожидаемому формату Instagram Stories${NC}" | tee -a "$LOG_FILE"
          echo -e "${RED}   Ожидаемый формат: https://www.instagram.com/stories/username/storyId/${NC}" | tee -a "$LOG_FILE"
        fi
      else
        # Используем grep для поиска статуса публикации (резервный вариант)
        status=$(echo "$response" | grep -o '"publication":{[^}]*"status":"[^"]*"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        echo -e "Статус публикации: ${GREEN}$status${NC}" | tee -a "$LOG_FILE"
        
        # Извлекаем URL публикации, если есть
        if [[ "$response" == *"\"postUrl\""* ]]; then
          postUrl=$(echo "$response" | grep -o '"postUrl":"[^"]*"' | head -1 | cut -d'"' -f4)
          echo -e "URL публикации: ${YELLOW}$postUrl${NC}" | tee -a "$LOG_FILE"
          
          # Проверяем формат URL
          if [[ "$postUrl" == *"/stories/"* ]]; then
            echo -e "${GREEN}✓ URL публикации соответствует формату Instagram Stories${NC}" | tee -a "$LOG_FILE"
          else
            echo -e "${RED}⚠️ URL публикации не соответствует ожидаемому формату Instagram Stories${NC}" | tee -a "$LOG_FILE"
          fi
        fi
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