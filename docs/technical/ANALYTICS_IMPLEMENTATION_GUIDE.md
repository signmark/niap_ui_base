# Техническое задание: Реализация отображения аналитики по кампаниям (Обновлено)

## 1. Общие требования

### 1.1. Назначение функционала
Разработать модуль отображения аналитики публикаций в социальных сетях с возможностью фильтрации по кампаниям и периодам. Сбор аналитики осуществляется через n8n workflows.

### 1.2. Целевые пользователи
SMM-менеджеры, маркетологи и владельцы бизнеса, отслеживающие эффективность публикаций в социальных сетях.

### 1.3. Интеграции и зависимости
- Интеграция с Directus CMS для получения данных о публикациях
- Интеграция с n8n для запуска сбора аналитики
- Использование данных аналитики, уже сохраненных в поле social_platforms постов

## 2. Функциональные требования

### 2.1. Сбор аналитики

#### 2.1.1. Источники данных
Сбор аналитики осуществляется через n8n workflow. Данные сохраняются в поле `social_platforms` каждого поста в Directus.

#### 2.1.2. n8n интеграция
- Эндпоинт n8n принимает параметры:
  ```json
  {
    "campaignId": "ID кампании", 
    "days": 7 // или 30 дней для анализа
  }
  ```
- Запуск сбора осуществляется по нажатию кнопки "Обновить данные"

**Telegram**
```javascript
// Получение статистики сообщения из Telegram
async function getTelegramMessageStats(botToken, chatId, messageId) {
  try {
    // Базовый URL для Telegram Bot API
    const baseUrl = `https://api.telegram.org/bot${botToken}`;
    
    // Получение информации о сообщении
    const messageResponse = await axios.get(`${baseUrl}/getChat?chat_id=${chatId}`);
    
    // Получение количества подписчиков (для канала)
    const chatMembersResponse = await axios.get(`${baseUrl}/getChatMembersCount?chat_id=${chatId}`);
    
    // Для приватных каналов можно получить статистику через getMessageStatistics
    // (требуется бот, добавленный как администратор канала)
    const statsResponse = await axios.get(`${baseUrl}/getMessageStatistics?chat_id=${chatId}&message_id=${messageId}`);
    
    return {
      views: statsResponse.data.result.views || 0,
      // Telegram прямо не предоставляет количество лайков, но можно получить через reactions
      likes: statsResponse.data.result.reactions?.filter(r => r.type === '👍').count || 0,
      comments: 0, // Комментарии нужно запрашивать отдельно через getReplies
      shares: statsResponse.data.result.forwards || 0
    };
  } catch (error) {
    console.error('Ошибка при получении статистики Telegram:', error);
    // Возвращаем нулевые значения в случае ошибки
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}
```

**ВКонтакте**
```javascript
// Получение статистики поста из ВКонтакте
async function getVkPostStats(accessToken, ownerId, postId) {
  try {
    // Базовый URL для VK API
    const baseUrl = 'https://api.vk.com/method';
    
    // Получение информации о посте
    const wallGetByIdResponse = await axios.get(`${baseUrl}/wall.getById`, {
      params: {
        posts: `${ownerId}_${postId}`,
        access_token: accessToken,
        v: '5.131'
      }
    });
    
    const post = wallGetByIdResponse.data.response[0];
    
    // Получение статистики поста
    const statsResponse = await axios.get(`${baseUrl}/stats.getPostReach`, {
      params: {
        owner_id: ownerId,
        post_id: postId,
        access_token: accessToken,
        v: '5.131'
      }
    });
    
    return {
      views: post.views?.count || 0,
      likes: post.likes?.count || 0,
      comments: post.comments?.count || 0,
      shares: post.reposts?.count || 0,
      // Дополнительная статистика из stats.getPostReach
      reach: statsResponse.data.response?.reach || 0,
      reach_subscribers: statsResponse.data.response?.reach_subscribers || 0,
      links: statsResponse.data.response?.links || 0,
      to_group: statsResponse.data.response?.to_group || 0,
      join_group: statsResponse.data.response?.join_group || 0,
      report: statsResponse.data.response?.report || 0,
      hide: statsResponse.data.response?.hide || 0,
      unsubscribe: statsResponse.data.response?.unsubscribe || 0
    };
  } catch (error) {
    console.error('Ошибка при получении статистики ВКонтакте:', error);
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}
```

**Instagram**
```javascript
// Получение статистики публикации из Instagram через Graph API
async function getInstagramPostStats(accessToken, mediaId) {
  try {
    // Базовый URL для Instagram Graph API
    const baseUrl = 'https://graph.facebook.com/v17.0';
    
    // Получение основной информации о публикации
    const mediaResponse = await axios.get(`${baseUrl}/${mediaId}`, {
      params: {
        fields: 'id,media_type,media_url,permalink,thumbnail_url,timestamp,caption',
        access_token: accessToken
      }
    });
    
    // Получение метрик публикации
    const insightsResponse = await axios.get(`${baseUrl}/${mediaId}/insights`, {
      params: {
        metric: 'impression,reach,engagement,saved',
        access_token: accessToken
      }
    });
    
    // Получение комментариев
    const commentsResponse = await axios.get(`${baseUrl}/${mediaId}/comments`, {
      params: {
        access_token: accessToken
      }
    });
    
    // Собираем метрики из ответа API
    const metricMap = {};
    insightsResponse.data.data.forEach(metric => {
      metricMap[metric.name] = metric.values[0].value;
    });
    
    return {
      views: metricMap.impression || 0,
      reach: metricMap.reach || 0,
      engagement: metricMap.engagement || 0,
      saved: metricMap.saved || 0,
      comments: commentsResponse.data.data.length || 0,
      // Лайки в новой версии API нужно запрашивать отдельно
      likes: 0
    };
  } catch (error) {
    console.error('Ошибка при получении статистики Instagram:', error);
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}
```

**Facebook**
```javascript
// Получение статистики публикации из Facebook через Graph API
async function getFacebookPostStats(accessToken, postId) {
  try {
    // Базовый URL для Facebook Graph API
    const baseUrl = 'https://graph.facebook.com/v17.0';
    
    // Получение основной информации о публикации
    const postResponse = await axios.get(`${baseUrl}/${postId}`, {
      params: {
        fields: 'id,message,created_time,permalink_url',
        access_token: accessToken
      }
    });
    
    // Получение метрик публикации
    const insightsResponse = await axios.get(`${baseUrl}/${postId}/insights`, {
      params: {
        metric: 'post_impressions,post_impressions_unique,post_engaged_users,post_reactions_by_type_total',
        access_token: accessToken
      }
    });
    
    // Получение комментариев
    const commentsResponse = await axios.get(`${baseUrl}/${postId}/comments`, {
      params: {
        summary: true,
        access_token: accessToken
      }
    });
    
    // Получение количества репостов
    const sharesResponse = await axios.get(`${baseUrl}/${postId}/sharedposts`, {
      params: {
        summary: true,
        access_token: accessToken
      }
    });
    
    // Собираем метрики из ответа API
    const metricMap = {};
    insightsResponse.data.data.forEach(metric => {
      if (metric.name === 'post_reactions_by_type_total') {
        // Отдельно обрабатываем реакции по типам
        metricMap.reactions = metric.values[0].value || {};
      } else {
        metricMap[metric.name] = metric.values[0].value;
      }
    });
    
    // Суммируем все типы лайков
    const totalLikes = metricMap.reactions ? 
      (metricMap.reactions.like || 0) + 
      (metricMap.reactions.love || 0) + 
      (metricMap.reactions.wow || 0) + 
      (metricMap.reactions.haha || 0) + 
      (metricMap.reactions.sad || 0) + 
      (metricMap.reactions.angry || 0) + 
      (metricMap.reactions.thankful || 0) : 0;
    
    return {
      views: metricMap.post_impressions || 0,
      unique_views: metricMap.post_impressions_unique || 0,
      engagement: metricMap.post_engaged_users || 0,
      likes: totalLikes,
      comments: commentsResponse.data.summary.total_count || 0,
      shares: sharesResponse.data.summary?.total_count || 0
    };
  } catch (error) {
    console.error('Ошибка при получении статистики Facebook:', error);
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}
```

#### 2.1.2. Собираемые метрики
- Просмотры
- Лайки
- Комментарии
- Репосты
- Клики (где доступно)
- Вовлеченность (рассчитывается как сумма лайков, комментариев и репостов)
- Коэффициент вовлеченности (вовлеченность/просмотры * 100%)

#### 2.1.3. Частота обновления данных
- Автоматический сбор данных каждые 5 минут (настраивается через планировщик)
- Ручное обновление по запросу пользователя (кнопка "Обновить данные")

#### 2.1.4. Привязка аналитики к кампаниям
- Аналитические данные должны сохраняться в структуре поста внутри поля social_platforms
- Каждый пост должен иметь привязку к кампании через поле campaign_id
- В Directus посты должны фильтроваться по campaign_id

### 2.2. Отображение аналитики

#### 2.2.1. Интерфейс пользователя
- Создать раздел "Аналитика" в основном навигационном меню
- Добавить селектор выбора кампании в верхней части страницы
- Добавить селектор периода (За последний день, 7 дней, 30 дней, Все время)
- Добавить кнопку "Обновить данные" для принудительного обновления данных
- Отображать время последнего обновления данных

#### 2.2.2. Вкладки аналитики
- **Обзор**: общая статистика и распределение данных
- **Публикации**: топ публикаций по просмотрам и вовлеченности
- **Платформы**: детальная статистика по каждой социальной сети

#### 2.2.3. Блоки данных для вкладки "Обзор"
- Суммарные показатели:
  - Общее количество просмотров
  - Средний показатель вовлеченности
  - Количество опубликованных постов
  - Общее количество взаимодействий
- Графики:
  - Круговая диаграмма распределения просмотров по платформам
  - Столбчатая диаграмма типов вовлеченности (лайки, комментарии, репосты)

#### 2.2.4. Блоки данных для вкладки "Публикации"
- Топ публикаций по просмотрам (4 поста)
- Топ публикаций по вовлеченности (4 поста)
- Для каждого поста отображать:
  - Заголовок поста
  - Процент вовлеченности
  - Иконку просмотров

#### 2.2.5. Блоки данных для вкладки "Платформы"
- Сравнительная диаграмма эффективности платформ
- Метрики по каждой платформе:
  - Telegram
  - ВКонтакте
  - Facebook
  - Instagram
- Для каждой платформы отображать:
  - Количество публикаций
  - Просмотры
  - Лайки
  - Комментарии
  - Репосты
  - Коэффициент вовлеченности (%)

### 2.3. Взаимодействие с пользователем

#### 2.3.1. Выбор кампании
- При выборе кампании в селекторе:
  - Отправлять запрос на API с указанием campaign_id
  - Инициировать сбор аналитики для выбранной кампании
  - Обновлять все показатели и графики с учетом выбранной кампании

#### 2.3.2. Выбор периода
- При выборе периода в селекторе:
  - Отправлять запрос на API с указанием периода
  - Обновлять все показатели и графики с учетом выбранного периода

#### 2.3.3. Ручное обновление данных
- При нажатии на кнопку "Обновить данные":
  - Отправлять запрос на сервер для инициации внеочередного сбора данных
  - Обновлять интерфейс после получения свежих данных
  - Показывать индикатор загрузки во время обновления

#### 2.3.4. Смена пользователя
- При входе в систему нового пользователя:
  - Автоматически собирать аналитику для его постов
  - Отображать данные только для постов текущего пользователя

## 3. Технические требования

### 3.1. Серверная часть

#### 3.1.1. API эндпоинты
- GET `/api/analytics/posts` - получение топ-постов с аналитикой
  - Параметры: period, campaignId, userId
  - Возвращает: topByViews, topByEngagement
- GET `/api/analytics/platforms` - получение статистики по платформам
  - Параметры: period, campaignId, userId
  - Возвращает: platforms, aggregated
- GET `/api/analytics/status` - получение статуса сбора аналитики
  - Возвращает: isCollecting, lastCollectionTime, progress
- POST `/api/analytics/collect` - запуск принудительного сбора аналитики
  - Параметры: userId, campaignId (опционально)

#### 3.1.2. Структура данных
- Сервис аналитики должен сохранять данные в поле social_platforms каждого поста
- Структура поля social_platforms:
```json
{
  "telegram": {
    "status": "published",
    "postUrl": "https://t.me/channel/123",
    "publishedAt": "2025-04-20T12:00:00.000Z",
    "analytics": {
      "views": 100,
      "likes": 10,
      "comments": 5,
      "shares": 3
    }
  },
  "vk": { ... },
  "instagram": { ... },
  "facebook": { ... }
}
```

#### 3.1.3. Фильтрация по кампаниям
- Использовать поле campaign_id для фильтрации постов в Directus
- Не перезаписывать campaign_id в ответе API, использовать оригинальные значения из постов
- В запросах к Directus использовать следующую структуру фильтра:
```javascript
{
  "user_id": {"_eq": userId},
  "status": {"_eq": "published"},
  "campaign_id": {"_eq": campaignId}
}
```

#### 3.1.4. Планировщик аналитики
- Реализовать планировщик, который будет запускать сбор аналитики автоматически
- Интервал запуска: 5 минут (300000 мс)
- Сохранять статус сбора данных (isCollecting, lastCollectionTime, progress)
- Обеспечить блокировку параллельных запусков сбора данных
- Запускать сбор аналитики при смене пользователя или кампании

### 3.2. Клиентская часть

#### 3.2.1. Компоненты UI
- CampaignSelector - компонент выбора кампании
- PeriodSelector - компонент выбора периода
- AnalyticsDashboard - основной компонент для отображения аналитики
- TopPostsList - компонент для отображения списка топ-постов
- PlatformStats - компонент для отображения статистики по платформам
- OverviewStats - компонент для отображения общей статистики
- AnalyticsCharts - компоненты для отображения графиков

#### 3.2.2. Состояние и управление данными
- Использовать React Query для запросов данных
- Создать хук для работы с состоянием выбранной кампании (useSelectedCampaign)
- Использовать Recharts для построения графиков и диаграмм
- Реализовать логику ручного обновления данных с отображением состояния загрузки
- Отслеживать смену пользователя и кампании для автоматического обновления данных

#### 3.2.3. Адаптивный дизайн
- Обеспечить корректное отображение на различных устройствах
- Использовать компоненты из библиотеки Shadсn UI
- Придерживаться общей стилистики проекта

### 3.3. Извлечение данных из URL постов

#### 3.3.1. Извлечение ID постов из URL
- Для корректного запроса статистики необходимо извлекать идентификаторы постов из сохраненных URL

**Telegram**
```javascript
// Извлечение messageId и chatId из URL Telegram
function extractTelegramIds(postUrl) {
  try {
    if (!postUrl) return { chatId: null, messageId: null };
    
    // Обработка URL формата https://t.me/c/1234567890/123
    // или https://t.me/channel_name/123
    const urlMatch = postUrl.match(/t\.me\/(?:c\/(\d+)|([^/]+))\/(\d+)/);
    
    if (urlMatch) {
      // Если найден числовой chatId (закрытый канал)
      if (urlMatch[1]) {
        return {
          chatId: `-100${urlMatch[1]}`,
          messageId: parseInt(urlMatch[3], 10)
        };
      } 
      // Если найден username канала (публичный канал)
      else if (urlMatch[2]) {
        return {
          chatId: `@${urlMatch[2]}`,
          messageId: parseInt(urlMatch[3], 10)
        };
      }
    }
    
    return { chatId: null, messageId: null };
  } catch (error) {
    console.error('Ошибка при извлечении Telegram IDs:', error);
    return { chatId: null, messageId: null };
  }
}
```

**ВКонтакте**
```javascript
// Извлечение owner_id и post_id из URL ВКонтакте
function extractVkIds(postUrl) {
  try {
    if (!postUrl) return { ownerId: null, postId: null };
    
    // Обработка URL формата https://vk.com/wall-12345_67890
    const wallMatch = postUrl.match(/vk\.com\/wall(-?\d+)_(\d+)/);
    
    if (wallMatch) {
      return {
        ownerId: wallMatch[1],
        postId: parseInt(wallMatch[2], 10)
      };
    }
    
    return { ownerId: null, postId: null };
  } catch (error) {
    console.error('Ошибка при извлечении VK IDs:', error);
    return { ownerId: null, postId: null };
  }
}
```

**Instagram**
```javascript
// Извлечение media_id из URL Instagram
function extractInstagramId(postUrl) {
  try {
    if (!postUrl) return null;
    
    // Обработка URL формата https://www.instagram.com/p/ABC123def456/
    const instaMatch = postUrl.match(/instagram\.com\/p\/([^\/]+)/);
    
    if (instaMatch) {
      return instaMatch[1];
    }
    
    // Новый формат URL может потребовать дополнительного запроса к API
    // для получения реального media_id на основе кода из URL
    
    return null;
  } catch (error) {
    console.error('Ошибка при извлечении Instagram ID:', error);
    return null;
  }
}
```

**Facebook**
```javascript
// Извлечение post_id из URL Facebook
function extractFacebookId(postUrl) {
  try {
    if (!postUrl) return null;
    
    // Обработка URL формата https://www.facebook.com/username/posts/12345678901234
    const fbPostMatch = postUrl.match(/facebook\.com\/(?:[^\/]+)\/posts\/(\d+)/);
    
    if (fbPostMatch) {
      return fbPostMatch[1];
    }
    
    // Обработка URL формата https://www.facebook.com/permalink.php?story_fbid=12345678901234&id=67890
    const fbPermalinkMatch = postUrl.match(/story_fbid=(\d+)/);
    
    if (fbPermalinkMatch) {
      return fbPermalinkMatch[1];
    }
    
    // Новые форматы URL с ID в конце
    const fbIdMatch = postUrl.match(/\/(\d+)$/);
    
    if (fbIdMatch) {
      return fbIdMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error('Ошибка при извлечении Facebook ID:', error);
    return null;
  }
}
```

### 3.4. Обработка событий смены контекста

#### 3.3.1. Смена кампании
- При выборе новой кампании в селекторе:
  - Сохранять выбор в localStorage
  - Инициировать запрос на сервер для сбора аналитики
  - Отображать индикатор процесса сбора
  - Обновлять UI после завершения сбора

#### 3.3.2. Смена пользователя
- При авторизации нового пользователя:
  - Получать список его кампаний
  - Автоматически запускать сбор аналитики
  - Отображать данные только для этого пользователя

## 4. Особенности реализации

### 4.1. Критически важные аспекты
1. **Корректная фильтрация по кампаниям**:
   - Не перезаписывать campaignId в ответе API, использовать оригинальные значения
   - Учитывать возможные различия в именовании полей (campaign vs campaign_id)

2. **Работа со всеми платформами**:
   - Реализовать отдельные сервисы для каждой платформы
   - Обрабатывать различия в API и форматах данных

3. **Хранение данных**:
   - Хранить аналитику внутри структуры social_platforms каждого поста
   - Не создавать отдельные таблицы для аналитики

4. **Автоматическое и ручное обновление**:
   - Обеспечить работу планировщика для регулярного обновления
   - Реализовать возможность ручного запуска сбора данных
   - Запускать сбор при смене контекста (пользователь, кампания)

### 4.2. Потенциальные проблемы и решения
1. **Проблема**: Различия в структуре данных posts между campaign и campaign_id
   **Решение**: Использовать универсальный подход: `post.campaign_id || post.campaign || null`

2. **Проблема**: Отсутствие аналитики для новых постов
   **Решение**: Инициализировать структуру analytics с нулевыми значениями

3. **Проблема**: Высокая нагрузка при сборе аналитики для большого количества постов
   **Решение**: Добавить пагинацию и обработку порциями

4. **Проблема**: Ограничения API социальных сетей
   **Решение**: Добавить обработку ошибок и лимитов, использовать очереди

5. **Проблема**: Отсутствие обновления данных при смене пользователя или кампании
   **Решение**: Добавить слушатели событий для отслеживания изменений контекста

## 5. Критерии приемки

### 5.1. Функциональные критерии
- Успешный сбор аналитики для всех поддерживаемых платформ
- Корректная фильтрация по кампаниям и периодам
- Успешное отображение всех метрик и графиков
- Работоспособность кнопки обновления данных
- Автоматический сбор данных при смене пользователя или кампании

### 5.2. Нефункциональные критерии
- Время отклика API не более 2 секунд
- Корректное отображение на устройствах с разрешением от 320px
- Понятный пользовательский интерфейс
- Адекватная обработка ошибок и отображение соответствующих сообщений
- Индикация процесса сбора данных

## 6. План реализации

1. Создать серверные компоненты для сбора аналитики
2. Реализовать API эндпоинты для работы с аналитикой
3. Разработать планировщик для автоматического сбора данных
4. Создать UI компоненты для отображения аналитики
5. Реализовать механизмы смены контекста (пользователь, кампания)
6. Интегрировать компоненты в общий интерфейс
7. Произвести тестирование и корректировку