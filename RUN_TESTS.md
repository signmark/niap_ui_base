# Запуск тестов для безопасного рефакторинга

## Быстрый старт

```bash
# Запуск всех тестов
npx jest tests/unit --config=jest.config.simple.js --verbose

# Запуск с покрытием
npx jest tests/unit --config=jest.config.simple.js --coverage --verbose
```

## Отдельные наборы тестов

### Планировщик публикаций
```bash
npx jest tests/unit/scheduler-logic.test.js --config=jest.config.simple.js
```

### Валидация платформ  
```bash
npx jest tests/unit/platform-validation.test.js --config=jest.config.simple.js
```

### Управление Stories
```bash
npx jest tests/unit/stories-management.test.js --config=jest.config.simple.js
```

### API эндпоинты
```bash
npx jest tests/unit/api-endpoints.test.js --config=jest.config.simple.js
```

## Ожидаемый результат

При успешном прохождении всех тестов вы должны увидеть:

```
✅ Test Suites: 4 passed, 4 total
✅ Tests: 16 passed, 16 total  
✅ Snapshots: 0 total
⏱️ Time: ~9-10 seconds
```

## Проверка перед рефакторингом

Обязательно запустите все тесты **ДО** внесения изменений в код:

```bash
# Проверка текущего состояния
npx jest tests/unit --config=jest.config.simple.js

# Если все прошло - можно рефакторить
# После рефакторинга - запустить тесты снова
```

## В случае ошибок

1. **Если тесты не запускаются** - проверьте наличие файла `jest.config.simple.js`
2. **Если тесты падают** - НЕ продолжайте рефакторинг, сначала разберитесь с ошибками
3. **После рефакторинга** - обязательно запустите тесты повторно

## Конфигурация Jest

Используется упрощенная конфигурация `jest.config.simple.js` для избежания конфликтов с TypeScript и ES модулями.

## Важно

⚠️ **Никогда не рефакторьте код без прохождения тестов!**
⚠️ **После каждого значительного изменения запускайте тесты заново!**