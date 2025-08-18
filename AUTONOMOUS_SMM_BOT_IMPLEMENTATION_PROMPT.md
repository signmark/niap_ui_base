# Автономный SMM Бот - Полная Реализация

## Задача
Реализовать полноценный автономный SMM бот для ведения рекламных кампаний с AI-генерацией контента, анализом трендов, персонализацией через анкету и автоматической публикацией.

## Ключевые Требования

### 1. Анализ и Изучение Существующих Компонентов

#### 1.1 Анализ Трендов (API `/api/campaign-trends`)
- **Файл**: `server/routes.ts` (строки ~8500-8700)
- **Функционал**: Получает тренды из Directus, анализирует популярность тем
- **Интеграция**: Использует Gemini AI для анализа текстов трендов
- **Задача**: Изучить как система получает тренды и как их анализирует AI

#### 1.2 Анализ Анкеты Бизнеса (Business Questionnaire)
- **Файл**: `server/services/business-questionnaire.ts`
- **Структура**: Данные о компании, целевой аудитории, УТП (unique value proposition)
- **API**: `/api/business-questionnaire/:campaignId`
- **Задача**: Понять структуру анкеты и как данные используются для персонализации

#### 1.3 Генерация Изображений через FAL AI
- **Файл**: `server/routes/fal-ai-routes.ts`
- **API**: `/api/fal-ai-models`, `/api/fal-generate-image`
- **Модели**: flux-pro, flux-dev, recraft-v3
- **Задача**: Изучить как формируются промпты для генерации медицинских изображений

#### 1.4 Контент-генерация через Gemini AI
- **Файл**: `server/services/gemini-service.ts`
- **Функционал**: Генерация текстов, анализ тональности, создание хештегов
- **Задача**: Понять как AI создает контент на основе анкеты и трендов

#### 1.5 Публикация через N8N
- **Файл**: `server/services/n8n-publisher.ts`
- **Платформы**: VK, Telegram, Instagram, Facebook, YouTube
- **Задача**: Изучить как работает автоматическая публикация

### 2. Архитектура Автономного Бота

#### 2.1 Основной Сервис Бота
```typescript
// server/services/autonomous-smm-bot.ts
class AutonomousSMMBot {
  // Анализ трендов и генерация идей контента
  async analyzeTrendsAndGenerateIdeas(campaignId: string): Promise<ContentIdea[]>
  
  // Генерация контента на основе анкеты и трендов
  async generatePersonalizedContent(campaignId: string, idea: ContentIdea): Promise<GeneratedContent>
  
  // Создание изображений для контента
  async generateContentImages(content: GeneratedContent): Promise<string[]>
  
  // Планирование и публикация контента
  async scheduleAndPublish(campaignId: string, content: GeneratedContent): Promise<void>
  
  // Мониторинг и аналитика результатов
  async trackPerformance(campaignId: string): Promise<PerformanceMetrics>
}
```

#### 2.2 Интеллектуальный Планировщик
```typescript
// server/services/intelligent-scheduler.ts
class IntelligentScheduler {
  // Определение оптимального времени публикации
  async getOptimalPublishingTime(platform: string, targetAudience: any): Promise<Date>
  
  // Анализ частоты публикаций конкурентов
  async analyzeCompetitorFrequency(industry: string): Promise<FrequencyRecommendation>
  
  // Автоматическое распределение контента по платформам
  async distributePlatformContent(content: GeneratedContent): Promise<PlatformDistribution>
}
```

#### 2.3 Система Принятия Решений
```typescript
// server/services/bot-decision-engine.ts
class BotDecisionEngine {
  // Анализ эффективности предыдущих постов
  async analyzeContentPerformance(campaignId: string): Promise<PerformanceInsights>
  
  // Принятие решения о типе контента
  async decideContentType(trends: Trend[], questionnaire: BusinessQuestionnaire): Promise<ContentStrategy>
  
  // Оптимизация стратегии на основе результатов
  async optimizeStrategy(campaignId: string, metrics: PerformanceMetrics): Promise<StrategyAdjustments>
}
```

### 3. Пошаговая Реализация

#### Шаг 1: Анализ Существующих Компонентов
1. **Изучить `server/routes.ts`** - найти все endpoints связанные с трендами, контентом, анкетами
2. **Проанализировать `server/services/gemini-service.ts`** - понять как работает AI генерация
3. **Исследовать `server/routes/fal-ai-routes.ts`** - изучить генерацию изображений
4. **Изучить `server/services/n8n-publisher.ts`** - понять процесс публикации
5. **Проанализировать структуру анкеты** в Directus таблице `business_questionnaire`

#### Шаг 2: Создание Базовой Архитектуры
1. **Создать основной сервис бота** `server/services/autonomous-smm-bot.ts`
2. **Создать планировщик** `server/services/intelligent-scheduler.ts`
3. **Создать движок принятия решений** `server/services/bot-decision-engine.ts`
4. **Добавить API endpoints** для управления ботом в `server/routes.ts`

#### Шаг 3: Интеграция с Существующими Сервисами
1. **Интегрировать с анализом трендов** - использовать существующий `/api/campaign-trends`
2. **Подключить генерацию текста** - использовать `gemini-service.ts` с промптами на основе анкеты
3. **Интегрировать FAL AI** - автоматическая генерация изображений для контента
4. **Подключить N8N публикацию** - автоматическая отправка в соцсети

#### Шаг 4: Создание Интеллектуальных Алгоритмов
1. **Алгоритм анализа трендов** - определение релевантных тем для бизнеса
2. **Персонализация контента** - адаптация под целевую аудиторию из анкеты
3. **Оптимизация изображений** - создание промптов для FAL AI на основе контента
4. **Умное планирование** - определение оптимального времени и частоты публикаций

#### Шаг 5: Frontend Интерфейс
1. **Панель управления ботом** - старт/стоп, настройки автономности
2. **Дашборд аналитики** - отображение результатов работы бота
3. **Настройки стратегии** - параметры генерации контента и публикации
4. **Превью контента** - возможность просмотра и редактирования до публикации

### 4. Технические Детали

#### 4.1 Структура Данных
```typescript
interface ContentIdea {
  id: string;
  topic: string;
  trend_relevance: number;
  target_audience_match: number;
  content_type: 'text' | 'image' | 'video' | 'carousel';
  suggested_platforms: Platform[];
  estimated_engagement: number;
}

interface GeneratedContent {
  id: string;
  title: string;
  content: string;
  hashtags: string[];
  image_prompts: string[];
  generated_images: string[];
  target_platforms: Platform[];
  scheduled_time: Date;
  business_context: BusinessContext;
}

interface BusinessContext {
  company_name: string;
  industry: string;
  target_audience: string;
  unique_value_proposition: string;
  tone_of_voice: string;
  brand_keywords: string[];
}
```

#### 4.2 Алгоритм Работы Бота
1. **Ежедневный анализ трендов** (утром)
2. **Генерация идей контента** на основе трендов + анкета
3. **Создание текстового контента** через Gemini AI
4. **Генерация изображений** через FAL AI (если нужно)
5. **Планирование публикации** с учетом оптимального времени
6. **Автоматическая публикация** через N8N
7. **Сбор аналитики** и корректировка стратегии

#### 4.3 Ключевые Промпты для AI

##### Промпт для анализа трендов:
```
Проанализируй следующие тренды в контексте бизнеса:
Компания: {company_name}
Сфера: {industry}
Целевая аудитория: {target_audience}
УТП: {unique_value_proposition}

Тренды: {trends_data}

Определи 3 наиболее релевантных тренда и предложи идеи контента для каждого.
```

##### Промпт для генерации контента:
```
Создай пост для социальных сетей на основе:
Тема: {content_idea}
Компания: {business_context}
Платформа: {target_platform}
Тон: {tone_of_voice}

Требования:
- Длина: 800-1200 символов
- Включить 5-7 хештегов
- Сделать призыв к действию
- Подчеркнуть УТП компании
```

##### Промпт для генерации изображений:
```
Professional {industry} image for social media post about {topic}.
Style: Clean, modern, medical/professional
Colors: Trust-inspiring blues and whites
Elements: {specific_elements_from_content}
No text overlays, high quality, 1080x1080 aspect ratio
```

### 5. Интеграция с Существующей Системой

#### 5.1 Использование Существующих API
- **Тренды**: `GET /api/campaign-trends` - получение актуальных трендов
- **Анкета**: `GET /api/business-questionnaire/:campaignId` - данные о бизнесе
- **Генерация**: `POST /api/gemini/generate-content` - создание текста
- **Изображения**: `POST /api/fal-generate-image` - создание картинок
- **Публикация**: `POST /api/n8n/publish` - отправка в соцсети

#### 5.2 Новые API для Бота
```typescript
// Управление автономным ботом
POST /api/autonomous-bot/start/:campaignId     // Запуск бота
POST /api/autonomous-bot/stop/:campaignId      // Остановка бота
GET  /api/autonomous-bot/status/:campaignId    // Статус работы
GET  /api/autonomous-bot/performance/:campaignId // Аналитика

// Настройки бота
PUT  /api/autonomous-bot/settings/:campaignId  // Обновление настроек
GET  /api/autonomous-bot/preview/:campaignId   // Превью контента
POST /api/autonomous-bot/approve/:contentId    // Одобрение контента
```

### 6. Настройки Автономности

#### 6.1 Уровни Автономности
1. **Полностью автономный** - публикует без согласования
2. **Умеренный** - генерирует контент, но требует одобрения
3. **Консультативный** - только предлагает идеи контента

#### 6.2 Параметры Настройки
- Частота публикаций (раз в день/неделю)
- Платформы для публикации
- Типы контента (только текст/с изображениями)
- Время публикации (автоматическое/заданное)
- Фильтры трендов (по релевантности)

### 7. Мониторинг и Аналитика

#### 7.1 Метрики Эффективности
- Количество созданного контента
- Процент одобренного контента (для умеренного режима)
- Вовлеченность аудитории
- Рост подписчиков
- Конверсия в продажи (если настроено)

#### 7.2 Система Обучения
- Анализ успешного контента
- Корректировка алгоритмов генерации
- Оптимизация промптов для AI
- Улучшение таргетинга трендов

### 8. Файлы для Создания/Модификации

#### Новые файлы:
1. `server/services/autonomous-smm-bot.ts` - основной сервис бота
2. `server/services/intelligent-scheduler.ts` - умное планирование
3. `server/services/bot-decision-engine.ts` - принятие решений
4. `server/routes/autonomous-bot-routes.ts` - API для бота
5. `client/src/components/AutonomousBotPanel.tsx` - панель управления
6. `client/src/components/BotAnalytics.tsx` - аналитика бота
7. `shared/types/autonomous-bot.ts` - типы для бота

#### Модификации существующих файлов:
1. `server/routes.ts` - добавить роуты бота
2. `server/services/gemini-service.ts` - добавить методы для бота
3. `client/src/App.tsx` - добавить страницы бота
4. `replit.md` - документация архитектуры бота

### 9. Последовательность Разработки

1. **Анализ (1-2 часа)** - изучение всех существующих компонентов
2. **Архитектура (1 час)** - создание базовой структуры сервисов
3. **Backend разработка (3-4 часа)** - реализация логики бота
4. **Frontend интерфейс (2-3 часа)** - панель управления и аналитика
5. **Интеграция (1-2 часа)** - подключение всех компонентов
6. **Тестирование (1-2 часа)** - проверка работы бота
7. **Оптимизация (1 час)** - улучшение производительности

### 10. Ожидаемый Результат

**Полностью функциональный автономный SMM бот, который:**
- Анализирует тренды и генерирует релевантные идеи контента
- Создает персонализированный контент на основе анкеты бизнеса
- Автоматически генерирует профессиональные изображения
- Умно планирует и публикует контент в соцсетях
- Мониторит результаты и корректирует стратегию
- Предоставляет детальную аналитику эффективности

Бот должен работать как "умный маркетолог", который понимает специфику бизнеса, следит за трендами и создает качественный контент без человеческого вмешательства.