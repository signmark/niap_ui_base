# Тест для проверки сохранения данных платформ

## Подготовка теста

1. Убедитесь, что сервер запущен и доступен по адресу http://localhost:5000

## Шаги тестирования

### 1. Создание тестового контента

```http
POST http://localhost:5000/api/campaign-content
Content-Type: application/json

{
  "content": "Тестовый контент для проверки сохранения платформ",
  "campaignId": "45daab2a-4c6f-4578-8665-3a04f70d0421",
  "contentType": "text",
  "title": "Тест сохранения платформ",
  "status": "draft",
  "socialPlatforms": {
    "telegram": {
      "status": "pending",
      "scheduledAt": "2025-04-16T15:00:00Z"
    },
    "vk": {
      "status": "pending",
      "scheduledAt": "2025-04-16T16:00:00Z"
    },
    "instagram": {
      "status": "pending",
      "scheduledAt": "2025-04-16T17:00:00Z"
    }
  }
}
```

Сохраните полученный ID контента для дальнейших запросов.

### 2. Проверка начального состояния

```http
GET http://localhost:5000/api/campaign-content/{contentId}
```

Убедитесь, что все три платформы присутствуют со статусом "pending".

### 3. Публикация на Telegram

```http
POST http://localhost:5000/api/publish/{contentId}/telegram
Content-Type: application/json

{
  "platform": "telegram",
  "status": "published",
  "publishedAt": "2025-04-16T14:30:00Z",
  "postId": "123456789",
  "postUrl": "https://t.me/channel/123456789"
}
```

### 4. Проверка состояния после публикации

```http
GET http://localhost:5000/api/campaign-content/{contentId}
```

Проверьте в ответе:
1. Telegram имеет статус "published"
2. VK и Instagram всё еще присутствуют со статусом "pending"

### 5. Очистка (опционально)

```http
DELETE http://localhost:5000/api/campaign-content/{contentId}
```

## Ожидаемый результат

После публикации на Telegram, данные других платформ (VK, Instagram) должны сохраниться в объекте socialPlatforms. Если это так, то исправление сработало корректно.

## Что проверяет тест

Тест проверяет, что при обновлении статуса публикации для одной платформы сохраняются данные других платформ, и их статусы не сбрасываются.