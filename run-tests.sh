#!/bin/bash

# Скрипт для запуска тестов в проекте SMM Manager
# Запуск: bash run-tests.sh [опции] [путь к тестам]

# Запускаем Jest напрямую
npx jest $@
