# API для публикации Instagram Stories

Этот документ описывает API для публикации Instagram Stories и получения ID опубликованных историй.

## Общая информация

API поддерживает публикацию изображений в качестве историй в Instagram. После успешной публикации возвращается ID истории, который можно использовать для формирования прямой ссылки на опубликованную историю.

## Эндпоинты

### Публикация Instagram Stories

**URL**: `/api/publish/instagram-stories`

**Метод**: `POST`

**Требуется аутентификация**: Да

**Тело запроса**:
```json
{
  "contentId": "string" // ID контента для публикации
}
```

**Успешный ответ**:
```json
{
  "success": true,
  "result": {
    "platform": "instagram",
    "status": "published",
    "publishedAt": "2025-05-12T15:00:00.000Z",
    "postId": "17123456789012345", // ID истории
    "postUrl": "https://www.instagram.com/stories/username/17123456789012345/", // URL истории
    "storyId": "17123456789012345", // ID истории (дублирует postId)
    "storyUrl": "https://www.instagram.com/stories/username/17123456789012345/", // URL истории
    "mediaContainerId": "987654321", // ID контейнера медиа в Instagram API
    "igUsername": "username", // Имя пользователя Instagram
    "creationTime": "2025-05-12T15:00:00.000Z" // Время создания
  },
  "contentId": "string", // ID контента
  "campaignId": "string" // ID кампании
}
```

**Ответ с ошибкой**:
```json
{
  "success": false,
  "error": "Текст ошибки"
}
```

### Получение статуса публикации

**URL**: `/api/publish/instagram-stories/:contentId/status`

**Метод**: `GET`

**Требуется аутентификация**: Да

**Параметры пути**:
- `contentId`: ID контента

**Успешный ответ**:
```json
{
  "success": true,
  "status": {
    "status": "published",
    "postId": "17123456789012345",
    "postUrl": "https://www.instagram.com/stories/username/17123456789012345/",
    "platform": "instagram_stories",
    "publishedAt": "2025-05-12T15:00:00.000Z",
    "mediaContainerId": "987654321",
    "igUsername": "username",
    "creationTime": "2025-05-12T15:00:00.000Z"
  },
  "contentId": "string"
}
```

**Ответ с ошибкой**:
```json
{
  "success": false,
  "error": "Текст ошибки"
}
```

## Формирование прямой ссылки на историю

Для формирования прямой ссылки на опубликованную историю используется следующий формат:

```
https://www.instagram.com/stories/{username}/{storyId}/
```

где:
- `username` - имя пользователя Instagram
- `storyId` - ID опубликованной истории, возвращенный API

## Требования к контенту

Для успешной публикации контент должен содержать:

1. Изображение в одном из следующих полей:
   - `imageUrl` - URL изображения
   - `additionalImages` - Массив объектов с URL изображений
   - `additionalMedia` - Массив объектов с URL медиафайлов

2. Опционально: текст в поле `content` - будет использован как подпись к истории

## Ограничения Instagram API

- Истории исчезают через 24 часа после публикации
- Подпись не отображается непосредственно на истории, т.к. API Instagram не имеет встроенной функции наложения текста
- Для просмотра историй необходимо быть авторизованным в Instagram и иметь доступ к аккаунту пользователя

## Примеры использования

### Пример публикации истории

```javascript
// Пример запроса на публикацию истории
const response = await fetch('/api/publish/instagram-stories', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    contentId: '12345678-abcd-1234-5678-1234567890ab'
  })
});

const result = await response.json();

if (result.success) {
  // История успешно опубликована
  console.log(`ID истории: ${result.result.storyId}`);
  console.log(`URL истории: ${result.result.storyUrl}`);
} else {
  // Ошибка публикации
  console.error(`Ошибка: ${result.error}`);
}
```

### Пример проверки статуса публикации

```javascript
// Пример запроса на проверку статуса публикации
const contentId = '12345678-abcd-1234-5678-1234567890ab';
const response = await fetch(`/api/publish/instagram-stories/${contentId}/status`, {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

const result = await response.json();

if (result.success && result.status) {
  // Получение статуса успешно
  console.log(`Статус: ${result.status.status}`);
  if (result.status.status === 'published') {
    console.log(`ID истории: ${result.status.postId}`);
    console.log(`URL истории: ${result.status.postUrl}`);
  }
} else {
  // Ошибка получения статуса
  console.error(`Ошибка: ${result.error}`);
}
```

## Тестирование

Для тестирования публикации историй и получения ID можно использовать скрипт `test-instagram-story-id.js`:

```bash
node test-instagram-story-id.js [URL_изображения]
```

Этот скрипт публикует тестовую историю и выводит информацию о полученном ID и URL.