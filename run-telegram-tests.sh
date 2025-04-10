#!/bin/bash

# Скрипт для запуска тестов интеграции с Telegram
# Поддерживает различные режимы тестирования и опции
# Автор: SMM Manager Development Team

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для печати заголовка
print_header() {
  echo -e "${BLUE}======================================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}======================================================${NC}"
}

# Функция для проверки успешности выполнения команды
check_result() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Успешно: $1${NC}"
  else
    echo -e "${RED}✗ Ошибка: $1${NC}"
    if [ "$2" = "exit" ]; then
      exit 1
    fi
  fi
}

# Функция для вывода справки
show_help() {
  echo "Использование: ./run-telegram-tests.sh [ОПЦИИ]"
  echo ""
  echo "Опции:"
  echo "  -a, --all          Запустить все тесты (по умолчанию)"
  echo "  -e, --e2e          Запустить только E2E тесты Playwright"
  echo "  -s, --simple       Запустить только простые тесты CLI"
  echo "  -i, --images       Запустить только тесты отправки изображений"
  echo "  -c, --check        Только проверить переменные окружения"
  echo "  -v, --verbose      Подробный вывод"
  echo "  -h, --help         Показать эту справку"
  echo ""
  echo "Примеры:"
  echo "  ./run-telegram-tests.sh -s     # Запуск только простых тестов"
  echo "  ./run-telegram-tests.sh -e -v  # Запуск E2E тестов с подробным выводом"
  echo "  ./run-telegram-tests.sh -i     # Запуск только тестов с изображениями"
  exit 0
}

# Парсинг аргументов командной строки
ALL=true
E2E=false
SIMPLE=false
IMAGES=false
CHECK=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -a|--all)
      ALL=true
      E2E=true
      SIMPLE=true
      IMAGES=true
      shift
      ;;
    -e|--e2e)
      ALL=false
      E2E=true
      shift
      ;;
    -s|--simple)
      ALL=false
      SIMPLE=true
      shift
      ;;
    -i|--images)
      ALL=false
      IMAGES=true
      shift
      ;;
    -c|--check)
      ALL=false
      CHECK=true
      shift
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      show_help
      ;;
    *)
      echo -e "${RED}Неизвестный аргумент: $1${NC}"
      show_help
      ;;
  esac
done

# Проверка наличия переменных окружения
print_header "Проверка переменных окружения для Telegram API"
node check-telegram-secrets.js
check_result "Проверка переменных окружения Telegram" "exit"

# Если выбрана только проверка, завершаем работу
if [ "$CHECK" = true ]; then
  echo -e "${GREEN}✓ Проверка переменных окружения выполнена успешно${NC}"
  exit 0
fi

# Запуск простых тестов CLI
if [ "$ALL" = true ] || [ "$SIMPLE" = true ]; then
  print_header "Запуск простых тестов Telegram API"
  
  echo -e "${YELLOW}Выполнение простых тестов отправки...${NC}"
  node telegram-simple-test.js
  check_result "Выполнение простых тестов отправки"
  
  echo -e "${YELLOW}Выполнение тестов API приложения...${NC}"
  node telegram-api-test.js
  check_result "Выполнение тестов API приложения"
  
  echo -e "${YELLOW}Выполнение продвинутых тестов форматирования...${NC}"
  node telegram-format-advanced-test.js
  check_result "Выполнение продвинутых тестов форматирования"
fi

# Запуск тестов с изображениями
if [ "$ALL" = true ] || [ "$IMAGES" = true ]; then
  print_header "Запуск тестов отправки изображений в Telegram"
  
  echo -e "${YELLOW}Проверка наличия необходимых пакетов...${NC}"
  if ! npm list form-data &>/dev/null; then
    echo -e "${YELLOW}Установка пакета form-data...${NC}"
    npm install form-data
    check_result "Установка пакета form-data"
  fi
  
  echo -e "${YELLOW}Выполнение тестов с изображениями...${NC}"
  node telegram-image-test.js
  check_result "Выполнение тестов отправки изображений"
fi

# Запуск E2E тестов
if [ "$ALL" = true ] || [ "$E2E" = true ]; then
  print_header "Запуск E2E тестов Telegram с Playwright"
  
  # Проверка установки Playwright
  if ! command -v npx playwright &> /dev/null; then
    echo -e "${YELLOW}Установка Playwright...${NC}"
    npm install -D @playwright/test
    check_result "Установка Playwright"
  fi
  
  # Проверка наличия браузеров
  echo -e "${YELLOW}Проверка наличия браузеров...${NC}"
  if [ "$VERBOSE" = true ]; then
    npx playwright install
  else
    npx playwright install --quiet
  fi
  check_result "Установка браузеров Playwright"
  
  # Запуск тестов
  echo -e "${YELLOW}Запуск E2E тестов...${NC}"
  if [ "$VERBOSE" = true ]; then
    npx playwright test tests/e2e/telegram.spec.ts --headed
  else
    npx playwright test tests/e2e/telegram.spec.ts
  fi
  check_result "Выполнение E2E тестов"
fi

print_header "Итоги тестирования"
echo -e "${GREEN}✓ Тестирование интеграции с Telegram завершено${NC}"
echo -e "${YELLOW}Для просмотра документации по тестированию запустите:${NC}"
echo -e "  less TELEGRAM_TESTING_GUIDE_RU.md   # Общее руководство по тестированию"
echo -e "  less TELEGRAM_E2E_TESTING.md        # Детальная информация по E2E тестам"