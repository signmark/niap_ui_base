# Руководство по изменениям в коде планировщика публикаций

## Внесенные изменения

В ходе доработки планировщика публикаций были внесены следующие изменения:

### 1. Обработка платформ со статусом "scheduled"

**Файл**: `server/services/publish-scheduler.ts`  
**Метод**: `checkScheduledContent()`

```javascript
// Было:
// Сначала проверяем, есть ли платформы в статусе pending - это наивысший приоритет
for (const [platform, platformData] of Object.entries(content.socialPlatforms)) {
  // Если платформа выбрана и статус pending - публикуем НЕМЕДЛЕННО
  if (platformData?.selected === true && platformData?.status === 'pending') {
    logMessages.push(`${platform}: статус pending - ГОТОВ К НЕМЕДЛЕННОЙ ПУБЛИКАЦИИ`);
    anyPlatformPending = true;
    // Не прерываем цикл, чтобы увидеть все платформы в pending
  }
}
```

```javascript
// Стало:
// Сначала проверяем, есть ли платформы в статусе pending или scheduled - это наивысший приоритет
for (const [platform, platformData] of Object.entries(content.socialPlatforms)) {
  // Если платформа выбрана и статус pending - публикуем НЕМЕДЛЕННО
  if (platformData?.selected === true && platformData?.status === 'pending') {
    logMessages.push(`${platform}: статус pending - ГОТОВ К НЕМЕДЛЕННОЙ ПУБЛИКАЦИИ`);
    anyPlatformPending = true;
  }
  // Если платформа выбрана и статус scheduled - также готова к публикации
  if (platformData?.selected === true && platformData?.status === 'scheduled') {
    logMessages.push(`${platform}: статус scheduled - ГОТОВ К ЗАПЛАНИРОВАННОЙ ПУБЛИКАЦИИ`);
    anyPlatformPending = true;
  }
}
```

### 2. Изменение условий обновления статуса контента

**Файл**: `server/services/publish-scheduler.ts`  
**Метод**: `checkAndUpdateContentStatuses()`

```javascript
// Было:
// Проверяем условия для обновления статуса
const allSelectedPublishedOrFailed = selectedPlatforms.length === (publishedPlatforms.length + failedPlatforms.length);
const atLeastOnePublished = publishedPlatforms.length > 0;

// Обновляем статус только если все выбранные платформы достигли финального статуса (published или failed)
// И при этом хотя бы одна платформа была успешно опубликована
if (allSelectedPublishedOrFailed && atLeastOnePublished) {
  log(`Контент ${item.id}: опубликовано ${publishedPlatforms.length}/${selectedPlatforms.length} платформ, ожидает публикации: ${pendingPlatforms.length}`, 'scheduler');
  log(`Обновление основного статуса контента ${item.id} на "published" после публикации во всех платформах или в отсутствии запланированных платформ`, 'scheduler');
```

```javascript
// Стало:
// Проверяем условия для обновления статуса
// Обновляем статус ТОЛЬКО если ВСЕ выбранные платформы имеют статус published
// Статус error игнорируем и не меняем основной статус контента
const allSelectedPublished = selectedPlatforms.length === publishedPlatforms.length && selectedPlatforms.length > 0;

// Если есть ошибки в публикации, логируем их
if (failedPlatforms.length > 0) {
  log(`Контент ${item.id}: обнаружены платформы с ошибками (${failedPlatforms.length} платформ: ${failedPlatforms.join(', ')})`, 'scheduler');
  log(`Статус контента ${item.id} НЕ будет изменен из-за наличия ошибок публикации`, 'scheduler');
}

// Обновляем статус ТОЛЬКО если все выбранные платформы опубликованы (все имеют статус published)
if (allSelectedPublished) {
  log(`Контент ${item.id}: все платформы опубликованы (${publishedPlatforms.length}/${selectedPlatforms.length})`, 'scheduler');
  log(`Обновление основного статуса контента ${item.id} на "published", так как все выбранные платформы опубликованы`, 'scheduler');
```

## Ключевые моменты изменений

1. **Новое условие обновления статуса**:
   - Раньше: статус менялся, если все платформы достигли "published" или "failed", и хотя бы одна была "published"
   - Теперь: статус меняется **только** если все выбранные платформы имеют статус "published"

2. **Обработка ошибок публикации**:
   - Раньше: платформы с ошибками ("failed") считались завершенными
   - Теперь: при наличии ошибок ("failed") статус контента не меняется

3. **Обработка статуса "scheduled"**:
   - Раньше: платформы со статусом "scheduled" не обрабатывались специально
   - Теперь: платформы со статусом "scheduled" обрабатываются как готовые к публикации

## Что нужно проверить после внедрения

1. Правильность обработки платформ со статусом "scheduled"
2. Корректность обновления статуса контента (только когда все платформы "published")
3. Правильность обработки ошибок публикации (статус контента не меняется)
4. Наличие и информативность логов по каждому действию системы