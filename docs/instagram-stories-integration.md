# Интеграция Instagram Stories

## Описание

Этот документ описывает интеграцию публикации Instagram Stories в SMM Manager. Интеграция позволяет публиковать контент из системы как истории (сторис) в Instagram, используя API Instagram Graph.

## Особенности

1. **Источник данных**: Используются настройки из кампании (поля `instagram_token` и `instagram_business_account_id`)
2. **Формат медиа**: Поддерживаются изображения из поля `additional_images`
3. **Результат публикации**: Сохраняется ID истории и URL профиля
4. **Ограничения**: Instagram не предоставляет прямых ссылок на опубликованные истории

## API Endpoints

### 1. POST /api/publish/instagram-stories

Публикует контент в Instagram Stories по ID контента.

**Параметры запроса:**
```json
{
  "contentId": "string",
  "campaignId": "string",
  "platform": "instagram"
}
```

**Пример успешного ответа:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "storyId": "17987654321098765",
    "storyUrl": "https://www.instagram.com/stories/username/",
    "profileUrl": "https://www.instagram.com/username/",
    "igUsername": "username",
    "creationTime": "2025-05-12T16:40:00.000Z"
  }
}
```

### 2. POST /api/publish/instagram-story

Публикует историю в Instagram с заданным URL изображения.

**Параметры запроса:**
```json
{
  "imageUrl": "string",
  "caption": "string",
  "campaignId": "string"
}
```

**Пример успешного ответа:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "storyId": "17987654321098765",
    "storyUrl": "https://www.instagram.com/stories/username/",
    "profileUrl": "https://www.instagram.com/username/",
    "igUsername": "username",
    "creationTime": "2025-05-12T16:40:00.000Z"
  }
}
```

### 3. GET /api/instagram-stories/settings/:campaignId

Получает параметры доступа к Instagram API для конкретной кампании.

**Пример успешного ответа:**
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

## Сохраняемые данные в контенте

После успешной публикации истории в таблице `campaign_content` обновляются следующие поля:

- `instagram_stories_status`: 'published'
- `instagram_stories_id`: ID истории в Instagram
- `instagram_stories_url`: URL на истории пользователя
- `instagram_profile_url`: URL профиля пользователя
- `instagram_username`: Имя пользователя Instagram
- `instagram_stories_published_at`: Время публикации

## Важные замечания

1. **Отсутствие прямых ссылок**: Instagram API не предоставляет возможности получить прямую ссылку на конкретную историю. Доступна только ссылка на все истории пользователя в формате `https://www.instagram.com/stories/username/`

2. **Срок жизни историй**: Истории в Instagram исчезают через 24 часа после публикации

3. **API Ограничения**: Для публикации историй требуется бизнес-аккаунт Instagram и соответствующие разрешения API

## Отладка

Для отладки публикации историй можно использовать следующие утилиты:

- `test-instagram-story-id-improved.js`: Тестирование публикации и получения информации о истории
- `test-instagram-stories.js`: Тестирование базовой публикации истории
- `debug-instagram-stories.js`: Диагностика проблем с медиа в контенте