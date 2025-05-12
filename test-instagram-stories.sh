#!/bin/bash

# Тестирование публикации Instagram Stories через API
CONTENT_ID="244c9fbd-dfab-445c-bc5d-dff085eb482d"
API_URL="http://localhost:5000/api/test/instagram-stories"

echo "Отправка запроса на публикацию сторис ID: $CONTENT_ID"
echo "API URL: $API_URL"

curl -X POST \
  -H "Content-Type: application/json" \
  -d "{\"contentId\": \"$CONTENT_ID\"}" \
  $API_URL

echo -e "\n\nЗапрос выполнен!"