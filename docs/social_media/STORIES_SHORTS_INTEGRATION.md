# Интеграция функционала Stories и Shorts в SMM Manager

## Обзор и цели

Расширение функциональности SMM Manager для поддержки создания и публикации:
- **Instagram Stories** - временный вертикальный контент длительностью до 24 часов
- **Короткие вертикальные видео** (Instagram Reels, TikTok, YouTube Shorts) - видео в вертикальном формате длительностью до 60 секунд

## 1. Изменения в модели данных Directus

### Расширение поля `content_type` в таблице `campaign_content`

К существующим типам контента (`post`, `carousel`) добавляем:
- `story` - для Instagram Stories
- `reels` - для коротких вертикальных видео

### Дополнительные поля для таблицы `campaign_content`

| Поле | Тип | Описание |
|------|-----|----------|
| `story_settings` | JSON | Настройки истории (интерактивные элементы, стикеры, опросы) |
| `video_settings` | JSON | Настройки для коротких видео (соотношение сторон, аудио, эффекты) |
| `story_duration` | Integer | Длительность истории в секундах |

Пример `story_settings`:
```json
{
  "interactive_elements": [
    {
      "type": "sticker",
      "position": { "x": 0.5, "y": 0.3 },
      "scale": 1.0,
      "rotation": 0,
      "imageUrl": "https://example.com/sticker.png"
    },
    {
      "type": "poll",
      "position": { "x": 0.5, "y": 0.7 },
      "question": "Нравится наш новый продукт?",
      "options": ["Да!", "Конечно!"]
    }
  ],
  "background": {
    "type": "color", // или "gradient", "image"
    "value": "#FF5733" // или градиент, или URL
  },
  "linkUrl": "https://yourwebsite.com/promo" // для swipe-up
}
```

Пример `video_settings`:
```json
{
  "aspectRatio": "9:16",
  "trimStart": 0,
  "trimEnd": 30,
  "audio": {
    "sourceUrl": "https://example.com/audio.mp3",
    "startAt": 5,
    "volume": 0.8
  },
  "filters": [
    {
      "type": "brightness",
      "value": 1.2
    },
    {
      "type": "saturation",
      "value": 1.1
    }
  ],
  "speed": 1.0
}
```

## 2. API для Stories (Instagram)

### Публикация Stories через Instagram Graph API

**Процесс публикации:**
1. Создание медиа-контейнера
2. Публикация истории с указанием контейнера
3. Обновление статуса публикации в Directus

Пример запроса для создания медиа-контейнера:
```
POST https://graph.facebook.com/v18.0/{instagram-business-id}/media
{
  "image_url": "https://example.com/story-image.jpg",
  "media_type": "IMAGE", // или "VIDEO"
  "caption": "Текст истории",
  "story_link": "https://yourwebsite.com/promo", // опционально для swipe-up
  "access_token": "{access-token}"
}
```

Пример запроса для публикации истории:
```
POST https://graph.facebook.com/v18.0/{instagram-business-id}/stories
{
  "creation_id": "{container-id}",
  "access_token": "{access-token}"
}
```

### Ограничения Instagram Stories API

- Отсутствие поддержки некоторых интерактивных элементов (стикеры, опросы) через API
- Swipe-up ссылка доступна только для аккаунтов с более чем 10000 подписчиков или бизнес-аккаунтов

## 3. API для Reels и коротких видео

### Публикация Instagram Reels через Graph API

**Процесс публикации:**
1. Загрузка видео в медиа-контейнер с указанием типа `REELS`
2. Ожидание обработки видео (проверка статуса)
3. Публикация медиа
4. Обновление статуса и получение permalink в Directus

Пример запроса для создания Reels:
```
POST https://graph.facebook.com/v18.0/{instagram-business-id}/media
{
  "video_url": "https://example.com/reels-video.mp4",
  "media_type": "REELS",
  "caption": "Текст для Reels #hashtag",
  "share_to_feed": true,
  "access_token": "{access-token}"
}
```

### Публикация в TikTok через TikTok API

TikTok предоставляет API для загрузки видео через TikTok Marketing API:

```
POST https://business-api.tiktok.com/open_api/v1.3/content/video/upload/
Content-Type: multipart/form-data

{
  "video_file": [binary data],
  "video_info": {
    "title": "Название видео",
    "cover_image_path": "https://example.com/cover.jpg",
    "description": "Описание видео #hashtag"
  }
}
```

## 4. Интерфейс пользователя

### Новый компонент выбора типа контента

Расширение селектора типа контента:
- Пост
- Карусель
- Сторис
- Reels

### Редактор Stories

UI-компоненты для редактора историй:
- Загрузка медиа (фото/видео)
- Настройка длительности (для автоматической ротации)
- Добавление текста с настройкой стиля и размещения
- Добавление интерактивных элементов (стикеры, опросы)
- Настройка swipe-up ссылки
- Предпросмотр в формате вертикального экрана 9:16

### Редактор Reels/коротких видео

UI-компоненты для редактора:
- Загрузка видео
- Обрезка видео (выбор начала и конца)
- Добавление аудио из библиотеки
- Настройка фильтров и эффектов
- Добавление текста поверх видео
- Параметры соотношения сторон с предпросмотром

## 5. Интеграция с workflow-автоматизацией

### Новые wеbhook-эндпоинты для n8n

Новые эндпоинты для интеграции с n8n:
- `/api/instagram-stories/publish` - для публикации историй
- `/api/instagram-reels/publish` - для публикации Reels
- `/api/tiktok/publish` - для публикации в TikTok

### Процесс автоматизации для Stories

1. Подготовка контента в Directus (content_type = 'story')
2. Триггер по расписанию через n8n
3. Вызов webhook-эндпоинта с ID контента
4. Получение данных контента и настроек соцсетей
5. Публикация в Instagram через Graph API
6. Обновление статуса публикации в Directus

### Процесс автоматизации для Reels

1. Подготовка видео в Directus (content_type = 'reels')
2. Предварительная обработка видео при необходимости
3. Триггер публикации через n8n
4. Поэтапная публикация с ожиданием обработки видео
5. Получение постоянной ссылки и обновление статуса

## 6. Примеры реализации на TypeScript

### Сервис для публикации Instagram Stories

```typescript
export class InstagramStoriesService {
  /**
   * Публикует историю в Instagram через Graph API
   */
  async publishStory(content, settings) {
    try {
      const { businessAccountId, token } = settings;
      
      if (!businessAccountId || !token) {
        throw new Error('Не указаны обязательные параметры Instagram API');
      }
      
      // Получаем URL изображения или видео для истории
      const mediaUrl = content.image_url || content.media_url || '';
      
      if (!mediaUrl) {
        throw new Error('История не содержит медиафайл');
      }
      
      // Получаем текст истории
      const caption = content.text || '';
      
      // Получаем настройки истории
      const storySettings = content.story_settings || {};
      
      // Определяем тип медиа (фото/видео)
      const isVideo = mediaUrl.match(/\.(mp4|mov|avi|wmv|flv|webm)$/i) !== null;
      const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
      
      // 1. Создаем медиа-контейнер для истории
      const containerResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${businessAccountId}/media`,
        {
          [isVideo ? 'video_url' : 'image_url']: mediaUrl,
          media_type: mediaType,
          caption,
          story_link: storySettings.linkUrl || null,
          access_token: token
        }
      );
      
      const containerId = containerResponse.data.id;
      
      // 2. Публикуем историю
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${businessAccountId}/stories`,
        {
          creation_id: containerId,
          access_token: token
        }
      );
      
      const storyId = publishResponse.data.id;
      
      // 3. Возвращаем результат публикации
      return {
        platform: 'instagram',
        contentType: 'story',
        status: 'published',
        publishedAt: new Date().toISOString(),
        mediaId: storyId,
        postUrl: `https://www.instagram.com/stories/...` // Формирование URL истории
      };
      
    } catch (error) {
      return {
        platform: 'instagram',
        contentType: 'story',
        status: 'failed',
        error: error.message
      };
    }
  }
}
```

## 7. Рекомендации по дизайну и SEO

### Дизайн Stories и Reels
- Соотношение сторон 9:16 (1080x1920px)
- Оптимальный размер текста 14-24pt
- Размещение важных элементов в "безопасной зоне" (центральная часть)
- Яркие цвета и контрастные тексты для читаемости
- Учет времени автоматической смены историй (5-7 секунд)

### SEO и продвижение
- Использование релевантных хэштегов (до 5-7 в Stories, до 10-15 в Reels)
- Добавление текстовых субтитров для улучшения доступности
- Интеграция с актуальными трендами в коротких видео
- Таргетирование по интересам аудитории
- Кросс-промо между разными форматами (ссылка на пост из Stories)

## 8. Технические ограничения и рекомендации

### Ограничения по форматам
- **Stories**: 
  - Фото: JPG, PNG (до 30MB)
  - Видео: MP4, MOV (до 15 секунд, до 100MB)
- **Reels**: 
  - Видео: MP4 (от 3 до 60 секунд, до 1GB)
  - Разрешение: минимум 720x1280px

### Обработка видео
- Предварительная транскодировка в оптимальные форматы
- Адаптация битрейта для быстрой загрузки (2-4 Mbps)
- Использование h.264 кодека для максимальной совместимости
- Адаптация соотношения сторон и обрезка для различных платформ

### Рекомендации по безопасности
- Обработка медиафайлов в защищенной среде
- Хранение API-ключей и токенов в зашифрованном виде
- Использование временных токенов доступа
- Регулярный аудит разрешений приложения

## 9. Планы по дальнейшему развитию

### Краткосрочные перспективы
- Добавление интерактивных опросов в Stories
- Расширение библиотеки шаблонов и стикеров
- Интеграция с библиотеками аудио для Reels
- А/Б тестирование различных форматов Stories

### Долгосрочные перспективы
- Интеграция с YouTube Shorts
- Автоматическая адаптация контента под разные платформы
- ИИ-ассистент для создания трендовых коротких видео
- Аналитика эффективности разных форматов Stories и Reels