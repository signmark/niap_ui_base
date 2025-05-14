# Интеграция функционала Stories и Shorts в SMM Manager

## Обзор и цели

Расширение функциональности SMM Manager для поддержки создания и публикации:
- **Instagram Stories** - временный вертикальный контент длительностью до 24 часов
- **ВКонтакте Истории** - аналогичный формат историй во ВКонтакте
- **Короткие вертикальные видео** (Instagram Reels, TikTok, YouTube Shorts) - видео в вертикальном формате длительностью до 60 секунд

## 1. Изменения в модели данных Directus

### Расширение поля `content_type` в таблице `campaign_content`

К существующим типам контента (`text`, `text-image`, `video`, `video-text`, `mixed`) добавляем:
- `story` - для Instagram и ВКонтакте Stories
- `short-video` - для коротких вертикальных видео (Reels/Shorts)

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
  "media_type": "STORIES", // тип для Instagram Stories (не "IMAGE" или "VIDEO")
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
  "media_type": "REELS", // тип для Instagram Reels
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

Новые эндпоинты для интеграции с n8n (в соответствии с существующими форматами):
- `https://n8n.nplanner.ru/webhook/publish-instagram-stories` - для публикации историй Instagram
- `https://n8n.nplanner.ru/webhook/publish-vk-stories` - для публикации историй ВКонтакте
- `https://n8n.nplanner.ru/webhook/publish-instagram-reels` - для публикации Reels
- `https://n8n.nplanner.ru/webhook/publish-tiktok` - для публикации в TikTok

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

### Метод для публикации Instagram Stories

```typescript
/**
 * Публикует историю в Instagram с использованием Graph API
 * @param content Контент для публикации
 * @param instagramSettings Настройки Instagram API
 * @returns Результат публикации
 */
async publishInstagramStory(
  content: CampaignContent,
  instagramSettings: SocialPlatformSettings
): Promise<SocialPublication> {
  try {
    log(`Публикация истории в Instagram для контента ID: ${content.id}`, 'instagram-stories');
    
    // Проверка наличия настроек Instagram API
    if (!instagramSettings.token || !instagramSettings.businessAccountId) {
      log(`Ошибка публикации истории: отсутствуют настройки Instagram API`, 'instagram-stories');
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки Instagram API (токен или ID бизнес-аккаунта)'
      };
    }
    
    // Проверка наличия изображения для истории
    if (!content.imageUrl) {
      log(`Ошибка публикации истории: отсутствует изображение`, 'instagram-stories');
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует изображение для публикации истории'
      };
    }
    
    // Публикация в Instagram Stories состоит из 2 этапов:
    // 1. Создание контейнера для медиа с типом STORIES
    const baseUrl = 'https://graph.facebook.com/v18.0';
    const containerUrl = `${baseUrl}/${instagramSettings.businessAccountId}/media`;
    
    // Параметры для создания контейнера истории
    const containerParams = {
      image_url: content.imageUrl,
      media_type: 'STORIES', // Важно: для историй используется тип STORIES
      caption: this.formatTextForInstagram(content.content || ''),
      access_token: instagramSettings.token
    };
    
    // Если есть ссылка для swipe-up, добавляем её
    if (content.linkUrl) {
      containerParams['story_link'] = content.linkUrl;
    }
    
    // Отправляем запрос на создание контейнера
    const containerResponse = await axios.post(
      containerUrl, 
      containerParams, 
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!containerResponse.data || !containerResponse.data.id) {
      throw new Error('Не удалось создать контейнер для истории');
    }
    
    // Получаем ID контейнера
    const containerId = containerResponse.data.id;
    
    // 2. Публикация истории с указанием созданного контейнера
    const publishUrl = `${baseUrl}/${instagramSettings.businessAccountId}/stories`;
    
    const publishResponse = await axios.post(
      publishUrl,
      {
        creation_id: containerId,
        access_token: instagramSettings.token
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!publishResponse.data || !publishResponse.data.id) {
      throw new Error('Не удалось опубликовать историю');
    }
    
    // Формируем результат публикации
    return {
      platform: 'instagram',
      status: 'published',
      publishedAt: new Date().toISOString(),
      postId: publishResponse.data.id,
      postUrl: `https://www.instagram.com/stories/${instagramSettings.username}/`,
      userId: content.userId
    };
  } catch (error) {
    log(`Ошибка при публикации истории в Instagram: ${error.message}`, 'instagram-stories');
    return {
      platform: 'instagram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при публикации истории: ${error.message}`
    };
  }
}

/**
 * Публикует историю в ВКонтакте
 * @param content Контент для публикации
 * @param vkSettings Настройки ВКонтакте API
 * @returns Результат публикации
 */
async publishVkStory(
  content: CampaignContent,
  vkSettings: SocialPlatformSettings
): Promise<SocialPublication> {
  try {
    log(`Публикация истории в ВКонтакте для контента ID: ${content.id}`, 'vk-stories');
    
    // Проверка наличия настроек ВКонтакте API
    if (!vkSettings.token || !vkSettings.groupId) {
      log(`Ошибка публикации истории: отсутствуют настройки ВКонтакте API`, 'vk-stories');
      return {
        platform: 'vk',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки ВКонтакте API (токен или ID группы)'
      };
    }
    
    // Проверка наличия изображения для истории
    if (!content.imageUrl) {
      log(`Ошибка публикации истории: отсутствует изображение`, 'vk-stories');
      return {
        platform: 'vk',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует изображение для публикации истории'
      };
    }
    
    // Загрузка изображения на сервер ВКонтакте
    // Шаг 1: Получение URL для загрузки изображения
    const getUploadUrlResponse = await axios.get('https://api.vk.com/method/stories.getPhotoUploadServer', {
      params: {
        add_to_news: 1,
        group_id: vkSettings.groupId.replace('-', ''), // Убираем минус из ID группы если есть
        access_token: vkSettings.token,
        v: '5.131'
      }
    });
    
    if (!getUploadUrlResponse.data.response || !getUploadUrlResponse.data.response.upload_url) {
      throw new Error('Не удалось получить URL для загрузки изображения');
    }
    
    const uploadUrl = getUploadUrlResponse.data.response.upload_url;
    
    // Шаг 2: Загрузка изображения
    // Скачиваем изображение и формируем FormData
    const imageResponse = await axios.get(content.imageUrl, { responseType: 'arraybuffer' });
    const formData = new FormData();
    formData.append('photo', Buffer.from(imageResponse.data), 'story.jpg');
    
    // Отправляем изображение на сервер ВКонтакте
    const uploadResponse = await axios.post(uploadUrl, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    if (!uploadResponse.data.upload_result) {
      throw new Error('Не удалось загрузить изображение для истории');
    }
    
    // Шаг 3: Добавление истории в ВКонтакте
    const addStoryResponse = await axios.get('https://api.vk.com/method/stories.save', {
      params: {
        upload_results: uploadResponse.data.upload_result,
        access_token: vkSettings.token,
        v: '5.131'
      }
    });
    
    if (!addStoryResponse.data.response || !addStoryResponse.data.response.story_id) {
      throw new Error('Не удалось сохранить историю');
    }
    
    const storyId = addStoryResponse.data.response.story_id;
    const storyOwnerId = addStoryResponse.data.response.owner_id || vkSettings.groupId;
    
    // Формируем результат публикации
    return {
      platform: 'vk',
      status: 'published',
      publishedAt: new Date().toISOString(),
      postId: storyId,
      postUrl: `https://vk.com/stories${storyOwnerId}_${storyId}`,
      userId: content.userId
    };
  } catch (error) {
    log(`Ошибка при публикации истории в ВКонтакте: ${error.message}`, 'vk-stories');
    return {
      platform: 'vk',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при публикации истории: ${error.message}`
    };
  }
}
```

## 7. Заключение

Интеграция функционала Stories и Shorts в SMM Manager позволит расширить возможности платформы и предоставить пользователям больше инструментов для управления социальными медиа. Реализация будет следовать существующим паттернам, используя текущую инфраструктуру и системы автоматизации.

### Ключевые технические решения

1. Расширение текущих типов контента вместо создания новой структуры данных
2. Использование правильных media_type для Instagram API (STORIES, REELS)
3. Следование формату вебхуков n8n, принятому в системе
4. Совместимость с существующей системой обновления статусов публикаций

### Следующие шаги

1. Реализация бэкенд сервисов для публикации Stories и Reels
2. Создание новых вебхук эндпоинтов для n8n
3. Разработка фронтенд компонентов для создания и редактирования Stories/Reels
4. Тестирование интеграции на тестовых аккаунтах социальных сетей


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