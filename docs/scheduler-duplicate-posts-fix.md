# 🔄 Документация по фиксу дублирования постов в шедулере

## 🚨 Проблема

Шедулер публикует посты в социальные сети **несколько раз**, что приводит к:
- Дублированию контента в соцсетях
- Лишним запросам к API социальных сетей
- Потенциальным блокировкам аккаунтов
- Неправильной аналитике

## 🔍 Анализ проблемы

### Текущее поведение
Шедулер не проверяет, был ли пост уже опубликован, и повторно отправляет его в соцсети при каждом запуске.

### Логи из системы
```
12:54:40 PM [scheduler] Контент 1171953c-18ab-493b-98ab-4b6281f4bd23 (Постинг) - статус: published
12:54:40 PM [scheduler]   - Всего платформ: 2
12:54:40 PM [scheduler]   - Опубликовано: 2
12:54:40 PM [scheduler]   - В ожидании: 0
12:54:40 PM [scheduler]   - Запланировано: 0
12:54:40 PM [scheduler]   - С ошибками: 0
```

## ✅ Решение

### Проверка перед публикацией
Перед отправкой поста в соцсеть необходимо проверить наличие:

1. **`postUrl`** - ссылка на опубликованный пост
2. **`publishedAt`** - timestamp публикации

### Алгоритм проверки

```javascript
function shouldPublishPost(platformData) {
  // Если есть postUrl - пост уже опубликован
  if (platformData.postUrl && platformData.postUrl.trim() !== '') {
    console.log(`Пост уже опубликован: ${platformData.postUrl}`);
    return false;
  }
  
  // Если есть publishedAt - пост уже опубликован
  if (platformData.publishedAt) {
    console.log(`Пост опубликован в: ${platformData.publishedAt}`);
    return false;
  }
  
  // Если статус 'published' - пост уже опубликован
  if (platformData.status === 'published') {
    console.log(`Статус платформы: published`);
    return false;
  }
  
  // Только если нет признаков публикации - можно публиковать
  return true;
}
```

### Примеры проверки

#### ❌ НЕ публиковать (уже опубликован)
```json
{
  "telegram": {
    "status": "published",
    "postUrl": "https://t.me/c/2302366310/702",
    "publishedAt": "2025-04-08T10:52:19.358Z",
    "analytics": { "views": 10, "likes": 0 }
  }
}
```

#### ❌ НЕ публиковать (есть URL)
```json
{
  "instagram": {
    "status": "published", 
    "postUrl": "https://www.instagram.com/p/DILtKj4Pxvi/",
    "publishedAt": "2025-04-08T10:52:14.610Z"
  }
}
```

#### ✅ МОЖНО публиковать (нет признаков публикации)
```json
{
  "vk": {
    "status": "scheduled",
    "scheduledAt": "2025-05-23T15:00:00.000Z"
    // НЕТ postUrl и publishedAt
  }
}
```

## 🛠 Реализация

### Место внедрения
Файл: `server/scheduler.js` или аналогичный

### Функция проверки
```javascript
function checkPublicationStatus(contentItem, platformName) {
  const platformData = contentItem.social_platforms[platformName];
  
  if (!platformData) {
    return { canPublish: false, reason: 'Platform data not found' };
  }
  
  // Проверяем признаки уже выполненной публикации
  if (platformData.postUrl) {
    return { 
      canPublish: false, 
      reason: `Already published: ${platformData.postUrl}` 
    };
  }
  
  if (platformData.publishedAt) {
    return { 
      canPublish: false, 
      reason: `Already published at: ${platformData.publishedAt}` 
    };
  }
  
  if (platformData.status === 'published') {
    return { 
      canPublish: false, 
      reason: `Status is already 'published'` 
    };
  }
  
  // Проверяем время публикации для scheduled постов
  if (platformData.status === 'scheduled') {
    const scheduledTime = new Date(platformData.scheduledAt);
    const now = new Date();
    
    if (scheduledTime > now) {
      return { 
        canPublish: false, 
        reason: `Scheduled for future: ${platformData.scheduledAt}` 
      };
    }
  }
  
  return { canPublish: true, reason: 'Ready to publish' };
}
```

### Использование в шедулере
```javascript
async function processScheduledContent() {
  const scheduledContent = await getScheduledContent();
  
  for (const contentItem of scheduledContent) {
    for (const [platformName, platformData] of Object.entries(contentItem.social_platforms)) {
      
      // ГЛАВНАЯ ПРОВЕРКА
      const checkResult = checkPublicationStatus(contentItem, platformName);
      
      if (!checkResult.canPublish) {
        console.log(`[${platformName}] Пропускаем публикацию: ${checkResult.reason}`);
        continue; // Пропускаем эту платформу
      }
      
      // Публикуем только если прошли все проверки
      console.log(`[${platformName}] Публикуем пост: ${contentItem.id}`);
      await publishToSocialNetwork(platformName, contentItem);
    }
  }
}
```

## 🔄 Дополнительные проверки

### Проверка по времени
```javascript
function isRecentlyPublished(publishedAt, thresholdMinutes = 5) {
  if (!publishedAt) return false;
  
  const publishTime = new Date(publishedAt);
  const now = new Date();
  const diffMinutes = (now - publishTime) / (1000 * 60);
  
  return diffMinutes < thresholdMinutes;
}
```

### Проверка по ID поста
```javascript
function hasValidPostId(platformData) {
  const postIdFields = ['postId', 'post_id', 'id'];
  
  return postIdFields.some(field => 
    platformData[field] && 
    platformData[field].toString().trim() !== ''
  );
}
```

## 📊 Логирование

### Рекомендуемые логи
```javascript
// При пропуске публикации
console.log(`[SKIP] ${contentItem.id} -> ${platformName}: ${reason}`);

// При успешной публикации  
console.log(`[PUBLISH] ${contentItem.id} -> ${platformName}: Success`);

// При обнаружении дубликата
console.log(`[DUPLICATE] ${contentItem.id} -> ${platformName}: Already published at ${publishedAt}`);
```

## 🎯 Ожидаемый результат

После внедрения фикса:
- ✅ Каждый пост публикуется **только один раз**
- ✅ Шедулер корректно определяет уже опубликованные посты
- ✅ Снижается нагрузка на API социальных сетей
- ✅ Исключается риск блокировок за спам
- ✅ Улучшается качество аналитики

## 📋 План внедрения

### Завтра:
1. Реализовать функцию `checkPublicationStatus()`
2. Интегрировать проверки в основной цикл шедулера
3. Добавить детальное логирование
4. Протестировать на тестовых постах
5. Развернуть на продакшен

### Приоритет: **ВЫСОКИЙ** 🔴
Проблема дублирования постов критична для пользовательского опыта.

---

**Автор**: AI Assistant  
**Дата**: 23 мая 2025  
**Статус**: 📋 Документировано, готово к реализации  
**Файлы**: scheduler.js, social-media-publishers.js