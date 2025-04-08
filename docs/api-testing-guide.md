
# Руководство по тестированию API

## Структура тестов

### 1. Модульные тесты API
- Тестирование отдельных эндпоинтов
- Проверка форматирования данных
- Валидация ответов сервера

### 2. Интеграционные тесты
- Взаимодействие между сервисами
- Проверка потока данных
- Тестирование авторизации

### 3. Тесты социальных сетей
```typescript
describe('Социальные сети', () => {
  test('Публикация в Telegram', async () => {
    // Код теста
  });
  
  test('Публикация в VK', async () => {
    // Код теста
  });
});
```

## Запуск тестов

### Локальное тестирование
```bash
npm run test server/__tests__/api-tests.test.ts
```

### CI/CD тестирование
```bash
npm run test:ci
```

## Правила написания тестов

1. **Изоляция тестов**
   - Каждый тест независим
   - Используйте моки для внешних сервисов
   - Очищайте состояние после тестов

2. **Структура теста**
   ```typescript
   describe('API endpoint', () => {
     beforeAll(() => {
       // Подготовка
     });

     test('should do something', async () => {
       // Действие
       // Проверка
     });

     afterAll(() => {
       // Очистка
     });
   });
   ```

3. **Проверка ошибок**
   ```typescript
   test('should handle errors', async () => {
     try {
       await api.doSomething();
       fail('Should throw error');
     } catch (error) {
       expect(error.message).toBe('Expected error');
     }
   });
   ```

## Лучшие практики

1. **Именование тестов**
   - Понятные названия
   - Описание ожидаемого результата
   - Группировка связанных тестов

2. **Моки и стабы**
   ```typescript
   jest.mock('../services/api', () => ({
     getData: jest.fn()
   }));
   ```

3. **Асинхронное тестирование**
   ```typescript
   test('async operations', async () => {
     await expect(asyncFunction()).resolves.toBe(expected);
   });
   ```

## Отладка тестов

1. **Использование отладчика**
   ```typescript
   test('debug test', () => {
     debugger;
     // Код теста
   });
   ```

2. **Расширенное логирование**
   ```typescript
   test('with logging', () => {
     console.log('Test state:', state);
     // Код теста
   });
   ```
