# Аналитика SMM Manager - Простое руководство

## Архитектура данных

### Где хранятся данные
- **Источник данных**: Поле `social_platforms` в таблице `campaign_content` в Directus
- **Сбор данных**: n8n автоматически собирает аналитику и сохраняет в это поле
- **Отображение**: Frontend только читает и показывает уже собранные данные

### Структура данных в social_platforms
```json
{
  "telegram": {
    "status": "published",
    "analytics": {
      "likes": 0,
      "views": 10,
      "shares": 0,
      "comments": 0,
      "lastUpdated": "2025-05-22T08:00:33.472Z"
    },
    "publishedAt": "2025-04-08T10:52:19.358Z"
  },
  "instagram": {
    "status": "published", 
    "analytics": {
      "likes": 1,
      "views": 13,
      "clicks": 1,
      "shares": 0,
      "comments": 0,
      "engagementRate": 33,
      "lastUpdated": "2025-04-24T11:14:50.062Z"
    },
    "publishedAt": "2025-04-08T10:52:14.610Z"
  },
  "vk": {
    "status": "published",
    "analytics": {
      "likes": 2,
      "views": 24,
      "shares": 0,
      "comments": 0,
      "lastUpdated": "2025-05-22T14:15:09.799Z"
    }
  }
}
```

## Что нужно сделать

### Backend API
1. Создать endpoint `/api/analytics/platforms-stats?campaignId=XXX`
2. Читать данные из `campaign_content.social_platforms`
3. Агрегировать статистику по платформам
4. Возвращать суммарную аналитику

### Frontend
1. Отображать статистику по платформам (VK, Instagram, Telegram)
2. Показывать переключатель 7/30 дней
3. Кнопка "Обновить" запускает n8n для сбора свежих данных

## Принципы
- **НЕ собираем** данные в приложении
- **ТОЛЬКО отображаем** то, что уже собрал n8n
- **Читаем напрямую** из поля social_platforms
- **Простота** - минимум кода, максимум результата

## Текущие данные
- Telegram: 10 просмотров
- Instagram: 13 просмотров, 1 лайк, 33% вовлеченность
- VK: 24 просмотра, 2 лайка

Эти данные уже есть в системе, нужно только правильно их отобразить!