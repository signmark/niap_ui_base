# План внедрения анализа медиаконтента в трендах

## Обзор функционала

Анализ медиаконтента в трендах позволит:
1. Выявлять закономерности в популярных изображениях и видео
2. Определять наиболее эффективные визуальные элементы (цвета, объекты, композиции)
3. Отслеживать эмоциональный тон в успешных публикациях
4. Генерировать рекомендации по созданию собственного медиаконтента

## Компоненты системы (уже созданы)

1. **server/services/media-analyzer.ts** - Сервис для анализа медиаконтента
   - Использует FAL AI для анализа изображений
   - Заглушки для анализа видео (будущая интеграция)
   - Определение содержимого (объекты, текст, композиция)

2. **client/src/components/MediaAnalysisPanel.tsx** - Компонент для отображения результатов
   - Удобный UI с вкладками
   - Визуализация результатов анализа
   - Адаптивный дизайн

## Шаги для полной интеграции

### 1. API-маршрут для анализа медиа
Добавить в server/routes.ts:

```typescript
// Маршрут для анализа медиаконтента
app.get("/api/media-analysis", authenticateUser, async (req, res) => {
  try {
    const { trendId, mediaUrl } = req.query;
    
    if (!trendId || !mediaUrl) {
      return res.status(400).json({ error: "Требуется ID тренда и URL медиа" });
    }
    
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Пользователь не авторизован" });
    }
    
    // Анализируем медиаконтент
    const result = await mediaAnalyzerService.analyzeMedia(
      mediaUrl as string, 
      userId,
      token
    );
    
    if (!result) {
      return res.status(500).json({ error: "Ошибка анализа медиаконтента" });
    }
    
    // Сохраняем результаты анализа в базу данных для будущего использования
    // TODO: Реализовать сохранение результатов анализа
    
    return res.json({ result });
  } catch (error) {
    console.error("Error analyzing media:", error);
    return res.status(500).json({ error: "Ошибка анализа медиаконтента" });
  }
});
```

### 2. Обновление fal-ai-client.ts
Добавить метод для анализа изображений в класс FalAiClient:

```typescript
/**
 * Анализирует изображение и возвращает информацию о его содержимом
 */
async analyzeImage(imageUrl: string): Promise<any> {
  try {
    if (!this.apiKey) {
      throw new Error('FAL API ключ не установлен');
    }
    
    // Запрос к FAL AI для анализа изображения
    const response = await axios.post(
      'https://api.fal.ai/v1/image/analyze',
      {
        image: imageUrl,
        features: ['objects', 'colors', 'text', 'composition']
      },
      {
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error analyzing image with FAL AI:', error);
    throw error;
  }
}
```

### 3. Интеграция с TrendDetailDialog
Обновить TrendDetailDialog для отображения панели анализа медиа:

```typescript
// Добавить в импорты
import { MediaAnalysisPanel } from "./MediaAnalysisPanel";

// Добавить состояние
const [showMediaAnalysis, setShowMediaAnalysis] = useState(false);

// Добавить кнопку для анализа медиа
<Button 
  variant="outline" 
  size="sm"
  onClick={() => setShowMediaAnalysis(!showMediaAnalysis)}
  className="ml-2"
>
  {showMediaAnalysis ? "Скрыть анализ" : "Анализировать медиа"}
</Button>

// Добавить компонент для отображения анализа
{showMediaAnalysis && trend.mediaLinks && (
  <div className="mt-4">
    <MediaAnalysisPanel
      trendId={trend.id}
      mediaUrl={getMainMediaUrl(trend)} // Создать функцию для получения основного URL медиа
      isVisible={showMediaAnalysis}
    />
  </div>
)}
```

### 4. Реализация структуры данных
Создать таблицу для хранения результатов анализа в базе данных:

```typescript
// В shared/schema.ts

export const mediaAnalysisTable = pgTable("media_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  trendId: uuid("trend_id").references(() => campaignTrendTopicsTable.id, {
    onDelete: "cascade",
  }),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull(),
  objects: jsonb("objects"),
  colors: jsonb("colors"),
  composition: text("composition"),
  sentiment: text("sentiment"),
  engagement: integer("engagement"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

## Дополнительные функции для будущей реализации

1. **Сравнительный анализ трендов**:
   - Сравнение цветовых схем нескольких популярных трендов
   - Выявление общих объектов и композиций

2. **Анализ эффективности медиаконтента**:
   - Корреляция между визуальными элементами и метриками эффективности
   - Рекомендации на основе успешных публикаций

3. **Генерация медиаконтента**:
   - Автоматическое создание изображений на основе анализа трендов
   - Подбор подходящих стоковых изображений

4. **Интеграции с другими сервисами**:
   - Google Vision API для более глубокого анализа изображений
   - AWS Rekognition для распознавания видео
   
## Интерфейс для управления анализом

Для полноценного использования функционала анализа медиаконтента рекомендуется создать отдельную страницу или вкладку в интерфейсе, которая позволит:

1. Запускать анализ выбранных трендов
2. Просматривать статистику и закономерности
3. Управлять настройками анализа
4. Экспортировать результаты

## Ожидаемые технические вызовы

1. **Обработка больших объемов данных**:
   - Кеширование результатов анализа
   - Оптимизация запросов к внешним API

2. **Стоимость использования внешних API**:
   - Ограничение количества анализируемых медиа
   - Интеллектуальное определение, какой контент нуждается в анализе

3. **Интеграция с различными форматами медиа**:
   - Обработка различных форматов видео
   - Поддержка защищенных ресурсов (Instagram, TikTok)

## Рекомендации по внедрению

1. Реализовать функционал в новой ветке git (например, `feature/media-content-analyzer`)
2. Начать с простого анализа изображений, затем добавить поддержку видео
3. Интегрировать сначала в детальное представление тренда, затем в списки
4. Проводить постепенное тестирование с ограниченным набором медиаконтента