#!/bin/bash

# Функция для вывода с цветом
print_color() {
  COLOR=$1
  TEXT=$2
  case $COLOR in
    "red") echo -e "\033[1;31m$TEXT\033[0m" ;;
    "green") echo -e "\033[1;32m$TEXT\033[0m" ;;
    "yellow") echo -e "\033[1;33m$TEXT\033[0m" ;;
    "blue") echo -e "\033[1;34m$TEXT\033[0m" ;;
    *) echo "$TEXT" ;;
  esac
}

# Заголовок
print_color "blue" "===== ТЕСТ ОПРЕДЕЛЕНИЯ ТИПОВ МЕДИА ФАЙЛОВ ====="
echo "Дата и время запуска: $(date)"
echo

# Тестируем различные типы URL и имена файлов
test_media_types() {
  print_color "yellow" "Тестирование медиа типов по URL:"
  
  # Массив тестовых URL
  declare -a test_urls=(
    "https://example.com/image.jpg"
    "https://example.com/video.mp4"
    "https://example.com/document.pdf"
    "https://v3.fal.media/files/rabbit/uoE7izr1qaZv384zV0Iha.png"
    "https://media.example.com/videos/clip.mov"
    "https://site.ru/files/photo.heic"
    "https://cdn.example.com/animation.webm"
  )
  
  # Массив тестовых объектов
  declare -a test_objects=(
    '{"url": "https://example.com/image.jpg", "type": "image"}'
    '{"url": "https://example.com/video.mp4", "type": "video"}'
    '{"file": "https://example.com/photo.png"}'
    '{"filename": "vacation.jpg"}'
    '{"fileName": "presentation.mp4"}'
    '{"name": "screenshot.png", "mime": "image/png"}'
    '{"src": "https://example.com/video.mov", "mimeType": "video/quicktime"}'
  )
  
  # Отправляем запрос к новому тестовому маршруту
  echo "Отправка запроса на тестирование типов медиа..."
  curl -s -X POST "http://localhost:5000/api/test/media-types" \
    -H "Content-Type: application/json" \
    -d "{
      \"urls\": $(echo "${test_urls[@]}" | jq -R . | jq -s .),
      \"objects\": $(echo "${test_objects[@]}" | jq -R . | jq -s .)
    }" | jq .
}

# Запуск тестов
test_media_types

print_color "blue" "===== ТЕСТ ЗАВЕРШЕН ====="