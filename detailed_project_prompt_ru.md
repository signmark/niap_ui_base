# Детальный промт для разработки SMM Manager

## Общее описание проекта

Разработать SMM Manager - продвинутую AI-платформу для анализа социальных медиа и управления контентом. Система должна предоставлять интеллектуальные инструменты для сбора данных из социальных сетей, анализа трендов, генерации контента с помощью AI и планирования публикаций.

### Ключевые функции системы:
1. Анализ социальных сетей и обнаружение трендов
2. Автоматизированная генерация контента на основе трендов
3. Планирование и публикация контента в разных социальных сетях
4. Кросс-платформенная адаптация контента
5. Бизнес-аналитика и отчетность

## Техническая архитектура

### Технологический стек:
- **Frontend**: React с TypeScript, использование шаблонов ShadCN для компонентов UI
- **Backend**: Node.js с Express
- **Хранение данных**: Внешнее хранилище через Directus API
- **Управление состоянием**: React Query, Zustand
- **Интеграция с AI**: DeepSeek, Perplexity API, FAL AI (для генерации изображений)
- **Авторизация**: Через Directus API (внешняя система)
- **Обработка асинхронных задач**: Интеграция с N8N через вебхуки

### Архитектурные ограничения:
1. Система должна быть развернута на Replit
2. Нельзя использовать виртуальные окружения или Docker-контейнеры
3. Нельзя напрямую редактировать package.json или другие конфигурационные файлы
4. Необходимо следовать существующей структуре проекта
5. Вся работа с данными происходит через Directus API, локальная база данных не используется

## Структура данных

### Основные типы данных (хранятся в Directus):
1. **campaigns** (кампании):
   - id (primary key, serial)
   - directusId (внешний идентификатор из Directus)
   - name (название кампании)
   - description (описание кампании)
   - userId (связь с пользователем)
   - createdAt (дата создания)
   - link (ссылка)
   - socialMediaSettings (JSON с настройками для разных соцсетей)
   - trendAnalysisSettings (JSON с настройками анализа трендов)

2. **content_sources** (источники контента):
   - id (primary key, serial)
   - directusId (внешний идентификатор из Directus)
   - name (название источника)
   - url (URL источника)
   - type (тип источника - instagram, telegram, vk, facebook)
   - userId (связь с пользователем)
   - campaignId (связь с кампанией)
   - createdAt (дата создания)
   - isActive (статус активности)

3. **campaign_content** (сгенерированный контент):
   - id (primary key, uuid)
   - campaignId (связь с кампанией)
   - userId (ID пользователя)
   - title (заголовок контента)
   - content (основной контент в HTML формате)
   - contentType (тип контента - text, text-image, video, video-text)
   - imageUrl, videoUrl (ссылки на медиа)
   - prompt (промпт для генерации)
   - keywords, hashtags, links (массивы соответствующих данных)
   - createdAt, scheduledAt, publishedAt (даты)
   - status (статус - draft, scheduled, published)
   - socialPlatforms (JSON с данными о публикации в соцсетях)
   - metadata (дополнительные метаданные)

4. **campaign_trend_topics** (трендовые темы):
   - id (primary key, uuid)
   - title (заголовок тренда)
   - sourceId (связь с источником)
   - campaignId (связь с кампанией)
   - reactions, comments, views (метрики взаимодействия)
   - createdAt (дата создания)
   - isBookmarked (отмечен ли как избранный)
   - mediaLinks (JSON с ссылками на медиа)

5. **business_questionnaire** (бизнес-анкета):
   - id (primary key, uuid)
   - campaignId (связь с кампанией)
   - companyName, contactInfo, businessDescription, и т.д. (бизнес-информация)
   - createdAt (дата создания)

Все данные хранятся и управляются через Directus API. В проекте используются только типы и интерфейсы TypeScript для описания данных, локальная база данных не используется.

## API интеграции и внешние сервисы

### Интеграция с AI-сервисами:
1. **DeepSeek API**:
   - Используется для анализа веб-сайтов и генерации контента
   - Требует API ключа пользователя из системы настроек
   - Поддерживает модель "deepseek-chat" для генерации контента
   - Температура 0.3, максимальное количество токенов 1500
   - Формат ответа должен содержать JSON

2. **Perplexity API**:
   - Используется для поиска источников контента
   - Работает с моделью "llama-3.1-sonar-small-128k-online"
   - Требует API ключа пользователя
   - Оптимизирован для поиска Instagram аккаунтов и других социальных источников

3. **FAL AI API**:
   - Используется для генерации изображений
   - Несколько моделей: "fast-sdxl", "stable-diffusion-v35-medium", "flux/schnell"
   - Требуется форматирование API ключа в виде "Key {apiKey}"
   - Разные эндпоинты для разных моделей

4. **Social Searcher API**:
   - Для поиска контента по социальным сетям
   - Требует API ключа пользователя

5. **Apify API**:
   - Для парсинга социальных сетей
   - Оптимизирован для работы с Instagram

### Интеграция с Directus:
1. Используется для хранения пользовательских данных и авторизации
2. Все API-запросы к пользовательским данным проходят через Directus
3. Токены Directus кэшируются для оптимизации запросов
4. URL Directus: "https://directus.nplanner.ru"

### Webhook интеграции:
1. Интеграция с N8N для обработки публикаций в соцсети
2. Требуется API ключ N8N для отправки данных
3. Асинхронная обработка статусов публикаций

## Фронтенд архитектура

### Основные страницы:
1. **Авторизация** (/auth/login) - страница входа
2. **Кампании** (/campaigns) - список и управление кампаниями
3. **Детали кампании** (/campaigns/[id]) - подробности кампании
4. **Тренды** (/trends) - анализ трендовых тем
5. **Контент** (/content) - управление сгенерированным контентом
6. **Ключевые слова** (/keywords) - управление ключевыми словами
7. **Посты** (/posts) - планирование публикаций
8. **Аналитика** (/analytics) - статистика и отчеты
9. **Задачи** (/tasks) - мониторинг автоматизированных задач

### Ключевые компоненты UI:
1. **Layout.tsx** - основной макет с боковым меню
2. **CampaignSelector** - выбор активной кампании
3. **ContentGenerationDialog** - генерация контента с AI
4. **ContentPlanGenerator** - создание контент-плана
5. **BusinessQuestionnaireForm** - форма бизнес-анкеты
6. **SocialPublishingPanel** - публикация в социальные сети
7. **TrendsList** - отображение трендов
8. **Calendar** - календарь публикаций
9. **SettingsDialog** - настройки API ключей

### Управление состоянием:
1. **React Query** для запросов к API
2. **Zustand** для глобального состояния (авторизация, выбранная кампания)
3. **LocalStorage** для сохранения токенов и пользовательских настроек

## Особенности генерации контента

### AI промпты:
1. **Для анализа сайтов**:
```
Ты эксперт по анализу контента сайтов. Твоя задача - проанализировать конкретное содержимое сайта и предложить ИСКЛЮЧИТЕЛЬНО релевантные ключевые слова, точно соответствующие именно этому сайту.

ОСОБЫЕ ОГРАНИЧЕНИЯ:
!!! СТРОГИЙ ЗАПРЕТ !!! Категорически запрещено:
- Генерировать ключевые слова о планировке/дизайне/ремонте квартир, если сайт НЕ ПОСВЯЩЕН этой теме
- Создавать "дефолтные" ключевые слова, не имеющие прямой связи с анализируемым контентом
- Включать ключевые слова по привычным шаблонам, если они не подтверждаются содержанием сайта

ИНСТРУКЦИЯ ПО АНАЛИЗУ:
1. Сначала внимательно изучи ВСЮ предоставленную информацию
2. Определи ТОЧНУЮ тематику и направление сайта
3. Сформулируй ключевые слова ТОЛЬКО на основе имеющихся данных, не добавляя темы "по умолчанию"
4. Учитывай, что сайт может быть на ЛЮБУЮ тему: здоровье, технологии, финансы, хобби, образование и т.д.
```

2. **Для генерации контента**:
```
Ты - эксперт по созданию контента для социальных сетей с фокусом на {industry}. Твоя задача - создать высококачественный контент, который:
1) Отражает актуальные тренды и интересы целевой аудитории
2) Соответствует тону и стилю коммуникации бренда
3) Вовлекает аудиторию и стимулирует взаимодействие

Используй следующие темы и ключевые слова как основу:
{keywords}

Учитывай следующую информацию о бизнесе:
{businessInfo}

Создай {contentType} контент с {tone} тоном. Контент должен включать заголовок, основной текст и хэштеги.

Формат ответа: чистый HTML с использованием тегов <p>, <strong>, <em> и т.д. для форматирования. Используй <br> для переносов строки.
```

3. **Для поиска источников**:
```
You are an expert at finding high-quality Russian Instagram accounts.
Focus only on Instagram accounts with >50K followers that post in Russian.
For each account provide:
1. Username with @ symbol 
2. Full name in Russian
3. Follower count with K or M
4. Brief description in Russian

Format each account as:
1. **@username** - Name (500K followers) - Description
```

### Процесс генерации изображений:
1. Перевод текстовых промптов с русского на английский для лучших результатов
2. Использование FAL AI API с моделью fast-sdxl по умолчанию
3. Параметры: ширина/высота 1024x1024, количество изображений 1
4. Поддержка негативных промптов для исключения нежелательных элементов
5. Обработка ошибок авторизации API с повторными попытками

## Особенности хранения данных и безопасность

### Работа с API ключами:
1. Хранение API ключей в профиле пользователя, а не в переменных окружения
2. Кэширование API ключей на стороне сервера для оптимизации запросов
3. Приоритизация пользовательских ключей над системными
4. Механизм проверки ключей при инициализации сервисов

### Безопасность:
1. Токены проверяются через middleware authenticateUser
2. Проверка существования кампаний перед доступом к связанным данным
3. Валидация параметров запросов перед выполнением операций
4. Обработка ошибок с информативными сообщениями

## Бизнес-логика и потоки данных

### Основные потоки:
1. **Анализ социальных сетей**:
   - Пользователь добавляет источники в кампанию
   - Система парсит социальные сети и извлекает тренды
   - Тренды сохраняются и ранжируются по метрикам

2. **Генерация контента**:
   - Пользователь выбирает тренды/ключевые слова
   - Система генерирует контент с помощью AI
   - Контент сохраняется с возможностью редактирования

3. **Планирование публикаций**:
   - Пользователь выбирает сгенерированный контент
   - Система адаптирует контент для разных платформ
   - Контент отправляется на публикацию через webhook

### Обработка ошибок:
1. Проверка API ключей перед выполнением запросов
2. Информативные сообщения об ошибках с деталями
3. Уведомления пользователя через toast-сообщения
4. Логирование ошибок на сервере

## Особенности интерфейса

### Адаптивный дизайн:
1. Мобильная и десктопная версии с различным отображением меню
2. Responsive grid с учетом разных размеров экрана
3. Компактные таблицы данных с возможностью сортировки и фильтрации

### Визуальные компоненты:
1. Карточки для отображения трендов и контента
2. Модальные окна для генерации и редактирования
3. WYSIWYG редактор для контента с поддержкой HTML
4. Календарь для планирования публикаций

## Ограничения и предостережения

1. **Доступ к API**:
   - Необходимы валидные API ключи для DeepSeek, Perplexity, FAL AI и других сервисов
   - Система должна запрашивать ключи у пользователя, не предоставляя фиктивные результаты

2. **Интеграции**:
   - Авторизация через Directus требует валидного URL и доступности сервиса
   - Webhook-интеграции требуют настройки N8N с соответствующими триггерами

3. **Технические**:
   - Избегать модификации конфигурационных файлов (vite.config.ts, package.json)
   - Не использовать локальную базу данных, все взаимодействие с данными через Directus API
   - Соблюдать существующую структуру проекта

## Требования к реализации

1. Необходимо соблюдать семантику и стилистику существующего кода
2. Для новых компонентов использовать shadcn и tailwind
3. Соблюдать типизацию с использованием TypeScript
4. Код должен быть документирован с комментариями на русском языке
5. Новую функциональность интегрировать с существующей архитектурой
6. Учитывать многоязычность интерфейса (в данном случае - русский язык)

## Технические рекомендации для реализации

1. Использовать React Query для всех API запросов
2. Настроить оптимистичные обновления UI для лучшего UX
3. Реализовать бесконечную прокрутку для списков трендов
4. Оптимизировать загрузку изображений через прокси-серверы
5. Использовать кэширование запросов к внешним API
6. Разделить бизнес-логику и представление в компонентах

## Развертывание в продакшн

### Docker интеграция
SMM Manager интегрируется в инфраструктуру с использованием Docker и Docker Compose. Ниже приведен полный пример конфигурации инфраструктуры, включающий все необходимые компоненты:

```yaml
services:
  # Traefik - обратный прокси для маршрутизации запросов и SSL
  traefik:
    image: "traefik:v3.3"
    restart: always
    command:
      - "--api=true"
      - "--api.insecure=true"
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.mytlschallenge.acme.tlschallenge=true"
      - "--certificatesresolvers.mytlschallenge.acme.email=${SSL_EMAIL}"
      - "--certificatesresolvers.mytlschallenge.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./traefik_data:/letsencrypt
      - /var/run/docker.sock:/var/run/docker.sock:ro

  # N8N - сервис автоматизации для обработки вебхуков и публикации контента
  n8n:
    build:
      context: .
      dockerfile: Dockerfile-n8n
    restart: always
    depends_on:
      - postgres
    ports:
      - "127.0.0.1:5678:5678"
    labels:
      - traefik.enable=true
      - traefik.http.routers.n8n.rule=Host(`${SUBDOMAIN}.${DOMAIN_NAME}`)
      - traefik.http.routers.n8n.tls=true
      - traefik.http.routers.n8n.entrypoints=web,websecure
      - traefik.http.routers.n8n.tls.certresolver=mytlschallenge
      - traefik.http.middlewares.n8n.headers.SSLRedirect=true
      - traefik.http.middlewares.n8n.headers.STSSeconds=315360000
      - traefik.http.middlewares.n8n.headers.browserXSSFilter=true
      - traefik.http.middlewares.n8n.headers.contentTypeNosniff=true
      - traefik.http.middlewares.n8n.headers.forceSTSHeader=true
      - traefik.http.middlewares.n8n.headers.SSLHost=${DOMAIN_NAME}
      - traefik.http.middlewares.n8n.headers.STSIncludeSubdomains=true
      - traefik.http.middlewares.n8n.headers.STSPreload=true
      - traefik.http.routers.n8n.middlewares=n8n@docker
    environment:
      - N8N_HOST=${SUBDOMAIN}.${DOMAIN_NAME}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://${SUBDOMAIN}.${DOMAIN_NAME}/
      - GENERIC_TIMEZONE=${GENERIC_TIMEZONE}
      - DB_TYPE=postgresdb
      - DB_TABLE_PREFIX=n8n_
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_USER=postgres
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      - EXECUTIONS_DATA_MAX_AGE=168
      - EXECUTIONS_DATA_PRUNE_MAX_COUNT=10000
      - N8N_DEFAULT_BINARY_DATA_MODE=filesystem
      - NODE_PATH=/home/node/.n8n/node_modules
      - NODE_FUNCTION_ALLOW_EXTERNAL=*  
    volumes:
      - ./n8n_data:/home/node/.n8n
      - ./local-files:/files

  # PostgreSQL - центральная база данных для хранения данных Directus и N8N
  postgres:
    image: postgres:16
    restart: always
    shm_size: 128mb
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - ./postgres:/var/lib/postgresql/data

  # PgAdmin - интерфейс администрирования PostgreSQL
  pgadmin:
    image: dpage/pgadmin4
    restart: always
    depends_on:
      - postgres
    volumes:
      - ./pgadmin_data:/var/lib/pgadmin
    environment:
      - PGADMIN_DEFAULT_EMAIL=${SSL_EMAIL}
      - PGADMIN_DEFAULT_PASSWORD=${PASSWORD_PGADMIN}
    labels:
      - traefik.enable=true
      - traefik.http.routers.pgadmin.entrypoints=web,websecure
      - traefik.http.routers.pgadmin.tls=true
      - traefik.http.routers.pgadmin.rule=Host(`${PGADMIN_SUBDOMAIN}.${DOMAIN_NAME}`)
      - traefik.http.routers.pgadmin.tls.certresolver=mytlschallenge
      - traefik.http.services.pgadmin.loadbalancer.server.port=80

  # Directus - система управления данными и пользовательскими аккаунтами
  directus:
    image: directus/directus:latest
    restart: always
    depends_on:
      - postgres
    environment:
      - DB_CLIENT=pg
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_DATABASE=directus
      - DB_USER=postgres
      - DB_PASSWORD=${DIRECTUS_DB_PASSWORD}
      - ADMIN_EMAIL=${DIRECTUS_ADMIN_EMAIL}
      - ADMIN_PASSWORD=${DIRECTUS_ADMIN_PASSWORD}
      - CORS_ENABLED=true
      - CORS_ORIGIN=true
      - CORS_METHODS=GET,POST,PATCH,DELETE
      - CORS_ALLOWED_HEADERS=Content-Type,Authorization
      - CORS_EXPOSED_HEADERS=Content-Range
      - CORS_CREDENTIALS=true
      - CORS_MAX_AGE=18000
    volumes:
      - ./directus_data:/directus/uploads
    labels:
      - traefik.enable=true
      - traefik.http.routers.directus.rule=Host(`directus.${DOMAIN_NAME}`)
      - traefik.http.routers.directus.tls=true
      - traefik.http.routers.directus.entrypoints=web,websecure
      - traefik.http.routers.directus.tls.certresolver=mytlschallenge
      - traefik.http.services.directus.loadbalancer.server.port=8055

  # SMM Manager - основное приложение
  smm:
    build:
      context: ./smm
      dockerfile: Dockerfile
    restart: always
    volumes:
      - ./smm:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run dev
    labels:
      - traefik.enable=true
      - traefik.http.routers.smm.rule=Host(`smm.nplanner.ru`)
      - traefik.http.routers.smm.tls=true
      - traefik.http.routers.smm.entrypoints=web,websecure
      - traefik.http.routers.smm.tls.certresolver=mytlschallenge
      - traefik.http.services.smm.loadbalancer.server.port=5000
```

### Dockerfile

```dockerfile
# Используем актуальную версию Node.js
FROM node:18

# Устанавливаем рабочий каталог
WORKDIR /app

# Устанавливаем системные зависимости через apt
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Копируем package.json и package-lock.json
COPY package*.json ./

# Очищаем существующие node_modules и lock-файлы для чистой установки
RUN rm -rf node_modules package-lock.json

# Устанавливаем зависимости
RUN npm install --no-audit --verbose

# Явно устанавливаем react-draggable
RUN npm install react-draggable@4.4.6 --save --no-audit

# Проверяем наличие библиотеки
RUN npm ls react-draggable

# Копируем исходный код
COPY . .

# Экспортируем порт для приложения
EXPOSE 5000

# Команда для сборки и запуска приложения
CMD ["npm", "run", "dev"]
```

Данный промт содержит все необходимые детали для воссоздания проекта SMM Manager с учетом существующей архитектуры, ограничений и технических особенностей.