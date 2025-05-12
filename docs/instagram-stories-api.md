# Instagram Stories API

Этот документ описывает API для публикации Instagram Stories через SMM Manager.

## Основная информация

API для публикации Instagram Stories использует Instagram Graph API и позволяет публиковать медиа-контент в Instagram Stories.
Обратите внимание на следующие особенности:

1. Instagram API не предоставляет возможность напрямую накладывать текст на изображения в Stories
2. Текст должен быть наложен на изображение заранее, до публикации
3. Доступ к API требует бизнес-аккаунт Instagram и токен доступа
4. Прямые ссылки на конкретные истории недоступны, только общий URL на все истории пользователя

## API эндпоинты

### Публикация истории с заданным URL изображения

**Endpoint:** `POST /api/publish/instagram-story`

**Body:**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "caption": "Текст подписи (опционально)",
  "campaignId": "uuid-кампании"
}
```

**Ответ:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "storyId": "12345678901234567",
    "storyUrl": "https://www.instagram.com/stories/username/",
    "mediaContainerId": "9876543210987654",
    "igUsername": "username",
    "creationTime": "2025-05-12T12:00:00.000Z"
  }
}
```

### Публикация истории по ID контента

**Endpoint:** `POST /api/publish/instagram-stories`

**Body:**
```json
{
  "contentId": "uuid-контента",
  "campaignId": "uuid-кампании"
}
```

**Ответ:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "storyId": "12345678901234567",
    "storyUrl": "https://www.instagram.com/stories/username/",
    "mediaContainerId": "9876543210987654",
    "igUsername": "username",
    "creationTime": "2025-05-12T12:00:00.000Z"
  }
}
```

### Проверка настроек Instagram для кампании

**Endpoint:** `GET /api/instagram-stories/settings/:campaignId`

**Ответ:**
```json
{
  "success": true,
  "settings": {
    "hasToken": true,
    "hasAccountId": true,
    "isConfigured": true
  }
}
```

## Структура данных

### Результат публикации истории

```typescript
interface PublishStoryResult {
  success: boolean;
  storyId?: string;          // ID опубликованной истории
  storyUrl?: string;         // URL истории (общий для всех историй пользователя)
  mediaContainerId?: string; // ID контейнера медиа-файла
  igUsername?: string;       // Имя пользователя Instagram
  creationTime?: string;     // Время публикации
  error?: any;               // Описание ошибки (если success: false)
}
```

## Требования для использования API

1. Наличие настроенного бизнес-аккаунта Instagram
2. Наличие токена доступа к Instagram API с правами на публикацию медиа
3. Настроенная кампания с указанными параметрами instagram_token и instagram_business_account_id

## Ограничения

- Максимальный размер изображения: 1080x1920 пикселей
- Поддерживаемые форматы изображений: JPG, PNG
- Интервал между публикациями: не менее 5 секунд
- Истории доступны в течение 24 часов после публикации
- Прямые ссылки на отдельные истории недоступны в Instagram API