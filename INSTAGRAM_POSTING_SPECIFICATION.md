**# ТЗ: Instagram Posting через Instagram Private API

## Цель проекта
Реализовать полнофункциональную систему публикации контента в Instagram через логин/пароль аутентификацию с использованием библиотеки `instagram-private-api`.

## Технические требования

### 1. Основная архитектура
- **Библиотека**: `instagram-private-api` (проверенная working версия)
- **Аутентификация**: Логин/пароль (без OAuth, без cookies)
- **Proxy поддержка**: SOCKS5 прокси для обхода блокировок
- **Session Management**: Кеширование сессий для избежания повторных логинов

### 2. Функциональные возможности

#### 2.1 Базовый постинг
- **Обычные посты**: Фото + текст
- **Instagram Stories**: Фото + интерактивные элементы
- **Поддержка форматов**: JPG, PNG, локальные файлы и URL
- **Описания**: Полная поддержка caption, хештегов, эмодзи

#### 2.2 Интерактивные элементы Stories
- **Опросы (Poll)**: Двойной выбор с кастомными вариантами
- **Слайдеры (Slider)**: Рейтинговые оценки с эмодзи
- **Вопросы (Question)**: Открытые текстовые ответы
- **Комбинации**: Несколько элементов в одной Stories

#### 2.3 Расширенный функционал (опционально)
- **Карусели**: Множественные фото в одном посте
- **Видео посты**: MP4 файлы
- **Video Stories**: Короткие видео для Stories
- **IGTV**: Длинные видео

### 3. API Endpoints Structure

```
POST /api/instagram-direct/publish
POST /api/instagram-direct/publish-story
GET  /api/instagram-direct/status
POST /api/instagram-direct/test
```

### 4. Структура данных

#### 4.1 Обычный пост
```json
{
  "username": "string",
  "password": "string", 
  "imageUrl": "string", // путь или URL
  "caption": "string",
  "contentId": "string" // для tracking
}
```

#### 4.2 Stories с интерактивными элементами
```json
{
  "username": "string",
  "password": "string",
  "imageUrl": "string",
  "contentId": "string",
  "interactive": {
    "poll": {
      "question": "string",
      "option1": "string",
      "option2": "string"
    },
    "slider": {
      "text": "string", 
      "emoji": "string"
    },
    "question": {
      "text": "string",
      "backgroundColor": "string"
    }
  }
}
```

### 5. Технические детали реализации

#### 5.1 Proxy Configuration
```javascript
const proxy = {
  protocol: 'socks5',
  host: 'mobpool.proxy.market',
  port: 1090,
  auth: {
    username: process.env.PROXY_USER,
    password: process.env.PROXY_PASS
  }
};
```

#### 5.2 Session Management
- Кеширование сессий по username
- Автоматическое переиспользование активных сессий
- Очистка expired сессий
- Fallback на новый логин при неудаче

#### 5.3 Error Handling
- **feedback_required**: Блокировка за частые публикации
- **login_required**: Проблемы с аутентификацией  
- **network_error**: Проблемы с прокси/сетью
- **invalid_credentials**: Неверные логин/пароль

### 6. Файловая структура

```
server/
├── services/
│   ├── instagram-private-service.js     # Основной сервис
│   └── instagram-session-manager.js     # Управление сессиями
├── routes/
│   └── routes-instagram-direct.js       # API endpoints
└── utils/
    └── proxy-config.js                  # Конфигурация прокси
```

### 7. Обязательные функции Instagram Service

#### 7.1 InstagramPrivateService class
```javascript
class InstagramPrivateService {
  // Базовые функции
  async getClient(username, password)           // Получение авторизованного клиента
  async publishPhoto(username, password, imageData, caption)  // Обычный пост
  async publishStory(username, password, imageData, interactive) // Stories
  
  // Утилиты
  async loadImage(imagePath)                    // Загрузка изображений
  clearCache()                                  // Очистка кеша сессий
}
```

#### 7.2 Интерактивные элементы Stories
```javascript
// Опрос
const pollSticker = {
  type: 'poll',
  x: 0.5, y: 0.7, width: 0.6, height: 0.15,
  poll: {
    question: "Вопрос?",
    option1: "Вариант 1", 
    option2: "Вариант 2"
  }
};

// Слайдер
const sliderSticker = {
  type: 'slider',
  x: 0.5, y: 0.8, width: 0.6, height: 0.1,
  slider: {
    text: "Оцени от 0 до 100",
    emoji: "🔥"
  }
};

// Вопрос
const questionSticker = {
  type: 'question', 
  x: 0.5, y: 0.6, width: 0.7, height: 0.15,
  question: {
    text: "Задай вопрос",
    backgroundColor: "#ffffff"
  }
};
```

### 8. Response Format

#### 8.1 Успешная публикация поста
```json
{
  "success": true,
  "status": "published",
  "postId": "3680988143625136020_75806346276",
  "postUrl": "https://www.instagram.com/p/DMVfzbDM2eU/",
  "platform": "instagram",
  "publishedAt": "2025-07-20T16:13:26.187Z",
  "message": "Пост успешно опубликован в Instagram",
  "mediaCode": "DMVfzbDM2eU"
}
```

#### 8.2 Успешная публикация Stories
```json
{
  "success": true,
  "status": "published", 
  "storyId": "3680985948653395705_75806346276",
  "storyUrl": "https://www.instagram.com/stories/it.signmark/3680985948653395705_75806346276/",
  "platform": "instagram_stories",
  "publishedAt": "2025-07-20T16:09:03.678Z",
  "message": "Stories успешно опубликована в Instagram",
  "type": "story",
  "interactive": {...} // если были интерактивные элементы
}
```

#### 8.3 Ошибка публикации
```json
{
  "success": false,
  "error": "POST /api/v1/media/configure_to_story/ - 400 Bad Request; feedback_required",
  "type": "publication_error",
  "platform": "instagram",
  "publishedAt": "2025-07-20T16:17:14.000Z"
}
```

### 9. Environment Variables

```env
# Proxy настройки
PROXY_HOST=mobpool.proxy.market
PROXY_PORT=1090
PROXY_USER=your_proxy_user
PROXY_PASS=your_proxy_pass

# Instagram тестовые аккаунты
INSTAGRAM_TEST_USER=it.signmark
INSTAGRAM_TEST_PASS=QtpZ3dh7
```

### 10. Интеграция с основной системой

#### 10.1 Архитектура после коммита 29d5001c35cbfc9e83ad8d1bfb2ee1fa93bcf48b
**ВАЖНО**: В указанном коммите уже частично реализована Instagram интеграция

**Существующие компоненты:**
- `server/api/social-publishing-router.ts` - основной роутер с Instagram логикой
- `server/services/instagram-*.js` - множество Instagram сервисов (требуют консолидацию)
- `publishViaInstagramDirectAPI()` функция уже объявлена в social-publishing-router.ts (строка 189)

**Что нужно реализовать:**
- Завершить функцию `publishViaInstagramDirectAPI()` в social-publishing-router.ts
- Создать единый `InstagramPrivateService` консолидирующий все существующие сервисы
- Добавить роуты в `server/routes.ts` для прямых Instagram API вызовов

#### 10.2 Точки интеграции в существующей системе

**1. В `server/api/social-publishing-router.ts` (строки 187-195):**
```javascript
// Instagram использует прямую интеграцию, остальные платформы - N8N вебхуки
if (platform === 'instagram') {
  log(`[Social Publishing] Публикация ${platform} через Instagram Direct API`);
  const result = await publishViaInstagramDirectAPI(contentId); // ← НУЖНО РЕАЛИЗОВАТЬ
  publishResults.push({
    platform,
    success: true,
    result
  });
}
```

**2. Функция `publishViaInstagramDirectAPI()` уже заготовлена (строки 1130-1235):**
- Получает campaign data из storage
- Извлекает Instagram настройки (username/password)
- Формирует publishData
- Вызывает `/api/instagram-direct/publish` endpoint
- Обновляет статус в базе данных

**3. В `server/routes.ts` нужно добавить:**
```javascript
// Instagram Direct API routes
import instagramDirectRoutes from './routes-instagram-direct';
app.use('/api/instagram-direct', instagramDirectRoutes);
```

#### 10.3 Database Integration (уже реализовано)
- Статусы публикации сохраняются в Directus через `storage.updateCampaignContent()`
- Поддержка pending/published/failed статусов
- Автоматическое обновление через DIRECTUS_TOKEN
- Campaign социальные настройки хранятся в `campaign.socialMediaSettings.instagram`

#### 10.4 Требуемые изменения в существующих файлах

**1. Создать `server/routes-instagram-direct.js`:**
```javascript
// Новый файл с Instagram Direct API endpoints
POST /publish        // Обычные посты
POST /publish-story  // Stories с интерактивными элементами
GET  /status         // Проверка статуса сессии
POST /test           // Тестирование подключения
```

**2. Создать `server/services/instagram-private-service.js`:**
```javascript
// Консолидированный сервис заменяющий все instagram-*.js файлы
class InstagramPrivateService {
  async publishPhoto(username, password, imageData, caption)
  async publishStory(username, password, imageData, interactive)
  async getClient(username, password)
  async loadImage(imagePath)
}
```

**3. Обновить `server/routes.ts` добавив:**
```javascript
// После строки 72 где уже есть instagramPersonalRoutes
import instagramDirectRoutes from './routes-instagram-direct';

// В функции registerRoutes после строки с instagramPersonalRoutes
app.use('/api/instagram-direct', instagramDirectRoutes);
```

### 11. Testing Strategy

#### 11.1 Unit Tests
```javascript
// Тест обычного поста
test('publish regular post', async () => {
  const result = await publishPhoto(credentials, imageData, caption);
  expect(result.success).toBe(true);
  expect(result.postUrl).toMatch(/instagram.com\/p\//);
});

// Тест Stories с опросом
test('publish story with poll', async () => {
  const interactive = { poll: { question: "Test?", option1: "Yes", option2: "No" }};
  const result = await publishStory(credentials, imageData, interactive);
  expect(result.success).toBe(true);
  expect(result.interactive.poll).toBeDefined();
});
```

#### 11.2 Integration Tests  
- Тестирование с реальным Instagram аккаунтом
- Проверка прокси соединения
- Валидация интерактивных элементов

### 12. Performance Requirements

- **Время публикации**: 6-8 секунд для обычных постов
- **Stories**: 7-10 секунд включая интерактивные элементы
- **Session reuse**: Повторные публикации 3-4 секунды
- **Error rate**: <5% при стабильном прокси

### 13. Security Considerations

- **Credentials**: Никогда не логировать пароли
- **Session storage**: Временное хранение в памяти
- **Proxy rotation**: Поддержка множественных прокси
- **Rate limiting**: Защита от превышения лимитов Instagram

### 14. Deployment Checklist

- [ ] Установлена `instagram-private-api`
- [ ] Настроен SOCKS5 прокси
- [ ] Созданы все API endpoints
- [ ] Реализованы интерактивные элементы
- [ ] Написаны unit tests
- [ ] Протестировано с реальным аккаунтом
- [ ] Интегрировано с основной системой
- [ ] Обновлена документация

### 15. Success Criteria

✅ **Публикация обычных постов**: Фото + текст, получение postUrl
✅ **Публикация Stories**: С интерактивными элементами (опросы, слайдеры, вопросы)  
✅ **Session management**: Переиспользование сессий, кеширование
✅ **Error handling**: Корректная обработка всех типов ошибок
✅ **Proxy support**: Стабильная работа через SOCKS5
✅ **Database integration**: Сохранение статусов в Directus
✅ **Performance**: 6-8 секунд на публикацию
✅ **Testing**: 95%+ success rate при тестировании

## Примечания по реализации

1. **Начать с базового постинга** - сначала обычные посты, потом Stories
2. **Proxy обязателен** - без прокси Instagram блокирует
3. **Session caching критичен** - избегать повторных логинов
4. **Интерактивные элементы постепенно** - сначала один тип, потом комбинации
5. **Тестирование на реальном аккаунте** - эмулятор не подходит

### 16. Пошаговый план реализации

#### Фаза 1: Базовая инфраструктура (1-2 часа)
1. **Консолидация существующих сервисов:**
   - Изучить все 15+ существующих instagram-*.js файлов в server/services/
   - Создать единый `InstagramPrivateService` с лучшими практиками
   - Установить `instagram-private-api` если не установлена

2. **Создание API endpoints:**
   - Создать `server/routes-instagram-direct.js` с 4 основными роутами
   - Добавить импорт в `server/routes.ts`

3. **Завершение функции `publishViaInstagramDirectAPI()`:**
   - Функция уже на 80% готова в social-publishing-router.ts
   - Нужно только подключить к новому InstagramPrivateService

#### Фаза 2: Базовый постинг (1-2 часа)  
1. **Обычные посты:**
   - Реализовать загрузку изображений (URL и локальные файлы)
   - Публикация фото + текст
   - Получение postUrl и сохранение в базу

2. **Тестирование:**
   - Тест с реальным аккаунтом it.signmark/QtpZ3dh7
   - Проверка proxy подключения mobpool.proxy.market
   - Валидация статусов в базе данных

#### Фаза 3: Instagram Stories (2-3 часа)
1. **Базовые Stories:**
   - Публикация Stories без интерактивных элементов
   - Получение storyUrl и storyId

2. **Интерактивные элементы:**
   - Реализация опросов (Poll)
   - Добавление слайдеров (Slider) 
   - Поддержка вопросов (Question)
   - Комбинированные элементы

#### Фаза 4: Интеграция и оптимизация (1 час)
1. **Интеграция с UI:**
   - Проверка работы через главный интерфейс
   - Тестирование "Опубликовать сейчас"
   - Валидация статусов pending/published/failed

2. **Финальные тесты:**
   - Комплексное тестирование всех функций
   - Проверка error handling
   - Performance тестирование

### 17. Критические моменты реализации

#### 17.1 Обязательные требования
- **Proxy обязателен**: Без SOCKS5 прокси Instagram блокирует через 2-3 запроса
- **Session caching**: Избегать повторных логинов (Instagram может заблокировать)
- **Rate limiting**: Не более 1 поста в минуту, Stories - не чаще 3 в час
- **Error handling**: Обрабатывать feedback_required, login_required, network_error

#### 17.2 Интеграция с существующей архитектурой
- **НЕ ТРОГАТЬ** publish-scheduler.ts - пользователь запретил
- Instagram использует Direct API, остальные платформы остаются на N8N
- Сохранять единый interface в social-publishing-router.ts
- Статусы должны обновляться так же как у других платформ

#### 17.3 Готовые компоненты для переиспользования
- Proxy конфигурация уже есть в instagram-web-auth.js
- Session management логика в instagram-session-manager.js  
- Image download utils в instagram-direct-post.js
- Authentication flows в instagram-web-auth.js

### 18. Ожидаемые результаты

После реализации система должна:
✅ **Публиковать обычные посты** через Direct API за 6-8 секунд
✅ **Публиковать Stories с интерактивными элементами** за 7-10 секунд  
✅ **Интегрироваться с UI** через кнопку "Опубликовать сейчас"
✅ **Сохранять статусы** в базе как остальные платформы
✅ **Обрабатывать ошибки** с понятными сообщениями пользователю
✅ **Работать стабильно** с success rate 95%+ при наличии proxy

### 19. Финальная проверка готовности

Перед объявлением о готовности проверить:
- [ ] Обычный пост публикуется и получаем postUrl
- [ ] Stories публикуется с интерактивными элементами
- [ ] Статусы правильно сохраняются в Directus
- [ ] Error handling работает для всех типов ошибок
- [ ] UI показывает корректные статусы публикации
- [ ] Proxy подключение стабильно работает
- [ ] Session caching предотвращает повторные логины

Данное ТЗ обеспечивает полную реализацию Instagram постинга с максимальным функционалом и надежностью, учитывая существующую архитектуру системы после коммита 29d5001c35cbfc9e83ad8d1bfb2ee1fa93bcf48b.**