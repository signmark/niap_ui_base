# План внедрения анализа медиаконтента с использованием Qwen-VL

## Обзор функционала

Анализ медиаконтента в трендах с помощью Qwen-VL позволит:
1. Выявлять закономерности в популярных изображениях и видео
2. Определять ключевые объекты и элементы в визуальном контенте
3. Получать детальное описание содержимого изображений и видео
4. Генерировать рекомендации для создания собственного контента на основе анализа
5. Анализировать текст, расположенный на изображениях

## Преимущества использования Qwen-VL вместо FAL AI

1. **Единый поставщик API**: Используя Qwen как для генерации текста, так и для анализа изображений, мы упрощаем управление API-ключами
2. **Мультимодальность**: Qwen-VL специально разработан для понимания как текста, так и изображений
3. **Гибкость запросов**: Возможность задавать специфические вопросы об изображении и получать целенаправленные ответы
4. **Детальное описание**: Более глубокий и естественный анализ изображений на русском языке
5. **Распознавание текста**: Встроенная возможность извлекать текст с изображений

## Компоненты системы

1. **server/services/media-analyzer.ts** - Сервис для анализа медиаконтента
   - Использует Qwen-VL для анализа изображений
   - Поддержка видео через анализ ключевых кадров
   - Генерация структурированного описания содержимого

2. **client/src/components/MediaAnalysisPanel.tsx** - Компонент для отображения результатов
   - Удобный UI с вкладками для разных аспектов анализа
   - Визуализация результатов
   - Адаптивный дизайн

## Шаги для полной интеграции

### 1. Добавление метода для анализа изображений в QwenService

Обновить server/services/qwen.ts, добавив метод для анализа изображений:

```typescript
/**
 * Анализирует изображение с помощью Qwen-VL и возвращает структурированную информацию
 * @param imageUrl URL изображения для анализа
 * @param analysisType Тип анализа: 'basic', 'detailed', 'objects', 'text', 'sentiment'
 * @returns Структурированный результат анализа изображения
 */
async analyzeImage(imageUrl: string, analysisType: 'basic' | 'detailed' | 'objects' | 'text' | 'sentiment' = 'detailed'): Promise<any> {
  try {
    if (!this.apiKey) {
      throw new Error('Qwen API ключ не установлен');
    }

    // Преобразование URL изображения в Base64, если это необходимо
    const imageData = await this.getImageAsBase64(imageUrl);

    // Шаблоны системных сообщений для разных типов анализа
    const systemPrompts = {
      basic: "Опиши что изображено на этой картинке. Дай краткое общее описание.",
      detailed: `Проанализируй изображение и предоставь детальную структурированную информацию в формате JSON со следующими полями:
        - description: общее описание изображения
        - objects: список основных объектов на изображении
        - colors: основные цвета в порядке преобладания
        - composition: описание композиции и расположения элементов
        - text: любой текст, видимый на изображении
        - mood: общее настроение или эмоциональный тон изображения
        - engagement_factors: элементы, которые могут привлечь внимание аудитории
        - recommendations: 3-5 рекомендаций для создания подобного контента`,
      objects: "Перечисли все объекты на изображении и их примерное расположение. Представь результат как JSON-массив объектов.",
      text: "Извлеки весь текст, видимый на изображении. Сохрани оригинальное форматирование и порядок текста.",
      sentiment: "Проанализируй эмоциональное воздействие этого изображения. Какие эмоции оно вызывает и почему? Оцени от 1 до 10 потенциальную вовлеченность аудитории."
    };

    // Формируем сообщения для API запроса
    const messages = [
      { 
        role: 'system', 
        content: systemPrompts[analysisType]
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Проанализируй это изображение:' },
          { type: 'image_url', image_url: { url: imageData } }
        ]
      }
    ];

    console.log(`Отправляем запрос на анализ изображения в Qwen-VL (тип анализа: ${analysisType})`);

    // Отправляем запрос к Qwen-VL API
    const response = await axios.post(
      `${this.compatModes[this.apiMode]}/chat/completions`,
      {
        model: 'qwen-vl',
        messages: messages,
        temperature: 0.2, // Низкая температура для более точных результатов
        max_tokens: 1500, // Достаточно для подробного анализа
        response_format: { type: 'json_object' } // Запрашиваем ответ в формате JSON
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Некорректный ответ от Qwen-VL API');
    }

    // Обрабатываем ответ и преобразуем его в структурированный JSON, если необходимо
    let result = response.data.choices[0].message.content;

    // Если ответ в виде JSON-строки, преобразуем в объект
    if (typeof result === 'string' && analysisType !== 'basic' && analysisType !== 'text') {
      try {
        // Извлекаем JSON из текста ответа, если он окружен другим текстом
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = JSON.parse(result);
        }
      } catch (e) {
        console.warn('Не удалось преобразовать ответ в JSON:', e);
        // Оставляем как есть, если не удалось преобразовать
      }
    }

    console.log('Анализ изображения успешно получен от Qwen-VL');
    return result;
  } catch (error) {
    console.error('Ошибка при анализе изображения с помощью Qwen-VL:', error);
    throw error;
  }
}

/**
 * Получает изображение по URL и преобразует его в Base64 для отправки в API
 * @param imageUrl URL изображения
 * @returns Строка с данными изображения в формате data URL
 */
private async getImageAsBase64(imageUrl: string): Promise<string> {
  try {
    // Если URL уже в формате data:image
    if (imageUrl.startsWith('data:image')) {
      return imageUrl;
    }

    // Получаем изображение через axios
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    // Определяем тип изображения из заголовков ответа
    const contentType = response.headers['content-type'] || 'image/jpeg';

    // Преобразуем в Base64
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Ошибка при получении изображения по URL:', error);
    throw new Error(`Не удалось получить изображение по URL: ${error.message}`);
  }
}
```

### 2. Обновление media-analyzer.ts для использования Qwen-VL

Модифицировать server/services/media-analyzer.ts:

```typescript
import { qwenService } from './qwen';
import { apiKeyService } from './api-keys';
import axios from 'axios';

class MediaAnalyzerService {
  /**
   * Анализирует медиаконтент по URL
   * @param mediaUrl URL изображения или видео для анализа
   * @param userId ID пользователя для получения API ключей
   * @param authToken Токен авторизации пользователя
   * @returns Результаты анализа медиаконтента
   */
  async analyzeMedia(mediaUrl: string, userId: string, authToken: string): Promise<any> {
    try {
      // Инициализируем сервис Qwen с ключом пользователя
      const initialized = await qwenService.initialize(userId, authToken);

      if (!initialized) {
        throw new Error('Не удалось инициализировать Qwen API. Проверьте API ключ в настройках.');
      }

      // Определяем тип медиаконтента (изображение или видео)
      const mediaType = this.detectMediaType(mediaUrl);
      console.log(`Начинаем анализ ${mediaType}: ${mediaUrl}`);

      // Анализируем контент в зависимости от типа
      if (mediaType === 'image') {
        return await this.analyzeImage(mediaUrl);
      } else if (mediaType === 'video') {
        return await this.analyzeVideo(mediaUrl);
      } else {
        throw new Error('Неподдерживаемый тип медиаконтента');
      }
    } catch (error) {
      console.error('Ошибка при анализе медиаконтента:', error);
      throw error;
    }
  }

  /**
   * Определяет тип медиаконтента по URL
   * @param url URL медиаконтента
   * @returns Тип медиаконтента ('image', 'video', 'unknown')
   */
  private detectMediaType(url: string): string {
    // Получаем расширение файла из URL
    const extension = url.split('.').pop()?.toLowerCase();

    // Проверяем по расширению файла
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
      return 'image';
    } else if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'wmv', 'flv'].includes(extension)) {
      return 'video';
    }

    // Проверяем по домену (для известных сервисов)
    if (url.includes('youtube.com') || url.includes('youtu.be') || 
        url.includes('vimeo.com') || url.includes('tiktok.com')) {
      return 'video';
    }

    // Для Instagram нужна дополнительная проверка
    if (url.includes('instagram.com')) {
      // Проверяем, содержит ли URL '/reel/' или '/p/'
      if (url.includes('/reel/')) {
        return 'video';
      } else if (url.includes('/p/')) {
        // По умолчанию считаем постом с изображением
        return 'image';
      }
    }

    // По умолчанию считаем изображением
    return 'image';
  }

  /**
   * Анализирует изображение с помощью Qwen-VL
   * @param imageUrl URL изображения для анализа
   * @returns Результаты анализа изображения
   */
  private async analyzeImage(imageUrl: string): Promise<any> {
    try {
      // Получаем детальный анализ изображения
      const detailedAnalysis = await qwenService.analyzeImage(imageUrl, 'detailed');

      // Возвращаем форматированные результаты
      return this.formatAnalysisResults(detailedAnalysis, 'image');
    } catch (error) {
      console.error('Ошибка при анализе изображения:', error);
      throw error;
    }
  }

  /**
   * Анализирует видео, извлекая ключевые кадры
   * @param videoUrl URL видео для анализа
   * @returns Результаты анализа видео
   */
  private async analyzeVideo(videoUrl: string): Promise<any> {
    try {
      // Извлекаем ключевые кадры из видео (заглушка)
      const keyframes = await this.extractKeyframes(videoUrl);

      // Анализируем каждый ключевой кадр
      const frameAnalyses = await Promise.all(
        keyframes.map(async (frame) => await qwenService.analyzeImage(frame.url, 'detailed'))
      );

      // Объединяем и обобщаем результаты анализов кадров
      const combinedAnalysis = this.combineFrameAnalyses(frameAnalyses);

      // Возвращаем форматированные результаты
      return this.formatAnalysisResults(combinedAnalysis, 'video');
    } catch (error) {
      console.error('Ошибка при анализе видео:', error);

      // В случае ошибки возвращаем анализ превью видео
      console.log('Пробуем проанализировать превью видео...');
      const thumbnailUrl = await this.getVideoThumbnail(videoUrl);

      if (thumbnailUrl) {
        const thumbnailAnalysis = await this.analyzeImage(thumbnailUrl);
        thumbnailAnalysis.note = 'Анализ основан только на превью видео, а не на полном контенте';
        return thumbnailAnalysis;
      }

      throw error;
    }
  }

  /**
   * Заглушка для извлечения ключевых кадров из видео
   * В реальном приложении здесь должна быть интеграция с сервисом обработки видео
   */
  private async extractKeyframes(videoUrl: string): Promise<{url: string, timestamp: number}[]> {
    // Заглушка - возвращаем только превью видео
    const thumbnailUrl = await this.getVideoThumbnail(videoUrl);

    if (thumbnailUrl) {
      return [{ url: thumbnailUrl, timestamp: 0 }];
    }

    throw new Error('Не удалось извлечь ключевые кадры из видео');
  }

  /**
   * Получает превью видео по URL
   * @param videoUrl URL видео
   * @returns URL превью видео
   */
  private async getVideoThumbnail(videoUrl: string): Promise<string> {
    // Логика получения превью в зависимости от платформы
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      // Извлекаем ID видео из URL YouTube
      let videoId = '';

      if (videoUrl.includes('youtube.com')) {
        const url = new URL(videoUrl);
        videoId = url.searchParams.get('v') || '';
      } else if (videoUrl.includes('youtu.be')) {
        videoId = videoUrl.split('/').pop() || '';
      }

      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }

    // Заглушка для других платформ
    // В реальной реализации нужно добавить обработку разных видеохостингов
    return '';
  }

  /**
   * Объединяет анализы нескольких кадров в один общий результат
   * @param frameAnalyses Массив результатов анализа отдельных кадров
   * @returns Объединенный результат анализа
   */
  private combineFrameAnalyses(frameAnalyses: any[]): any {
    // Простейшая реализация - просто берем анализ первого кадра
    // В реальном приложении здесь должна быть более сложная логика обобщения
    if (frameAnalyses.length === 0) {
      return null;
    }

    return frameAnalyses[0];
  }

  /**
   * Форматирует результаты анализа для отображения на фронтенде
   * @param analysisResults Результаты анализа от AI
   * @param mediaType Тип медиаконтента ('image' или 'video')
   * @returns Форматированные результаты для фронтенда
   */
  private formatAnalysisResults(analysisResults: any, mediaType: string): any {
    // Если результаты уже структурированы как JSON-объект
    if (typeof analysisResults === 'object' && analysisResults !== null) {
      return {
        mediaType,
        ...analysisResults,
        timestamp: new Date().toISOString()
      };
    }

    // Если результаты пришли как строка, пытаемся преобразовать в JSON
    if (typeof analysisResults === 'string') {
      try {
        const jsonMatch = analysisResults.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedResults = JSON.parse(jsonMatch[0]);
          return {
            mediaType,
            ...parsedResults,
            timestamp: new Date().toISOString()
          };
        }
      } catch (e) {
        console.warn('Не удалось преобразовать результаты анализа в JSON:', e);
      }

      // Если не удалось преобразовать в JSON, возвращаем как текстовое описание
      return {
        mediaType,
        description: analysisResults,
        timestamp: new Date().toISOString()
      };
    }

    // Если не удалось обработать результаты
    return {
      mediaType,
      error: 'Не удалось обработать результаты анализа',
      rawResults: analysisResults,
      timestamp: new Date().toISOString()
    };
  }
}

export const mediaAnalyzerService = new MediaAnalyzerService();
```

### 3. API-маршрут для анализа медиа

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

    // Анализируем медиаконтент с помощью Qwen-VL
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

### 4. Интеграция с TrendDetailDialog

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
  {showMediaAnalysis ? "Скрыть анализ" : "Анализировать с помощью AI"}
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

### 5. Обновление компонента MediaAnalysisPanel

Модифицировать client/src/components/MediaAnalysisPanel.tsx для отображения результатов анализа от Qwen-VL:

```typescript
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface MediaAnalysisPanelProps {
  trendId: string;
  mediaUrl: string;
  isVisible: boolean;
}

export const MediaAnalysisPanel: React.FC<MediaAnalysisPanelProps> = ({ 
  trendId, 
  mediaUrl, 
  isVisible 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);

  // Функция для получения результатов анализа
  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('/api/media-analysis', {
        params: {
          trendId,
          mediaUrl
        }
      });

      setAnalysis(response.data.result);
    } catch (err) {
      console.error('Error fetching media analysis:', err);
      setError('Не удалось получить анализ медиаконтента. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  // Запускаем анализ при отображении компонента
  useEffect(() => {
    if (isVisible && mediaUrl && !analysis && !loading) {
      fetchAnalysis();
    }
  }, [isVisible, mediaUrl]);

  // Если компонент скрыт, не рендерим содержимое
  if (!isVisible) return null;

  // Отображаем индикатор загрузки
  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Анализ медиаконтента</CardTitle>
          <CardDescription>Qwen-VL анализирует визуальный контент...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Анализируем контент с помощью AI...</span>
        </CardContent>
      </Card>
    );
  }

  // Отображаем ошибку
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Анализ медиаконтента</CardTitle>
          <CardDescription>Произошла ошибка при анализе</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">{error}</div>
          <Button onClick={fetchAnalysis} className="mt-4">Попробовать снова</Button>
        </CardContent>
      </Card>
    );
  }

  // Если нет данных для отображения
  if (!analysis) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Анализ медиаконтента</CardTitle>
          <CardDescription>Данные для анализа отсутствуют</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchAnalysis}>Запустить анализ</Button>
        </CardContent>
      </Card>
    );
  }

  // Отображаем результаты анализа
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Анализ медиаконтента</CardTitle>
        <CardDescription>
          Результаты анализа с помощью Qwen-VL ({new Date(analysis.timestamp).toLocaleString()})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="objects">Объекты</TabsTrigger>
            <TabsTrigger value="composition">Композиция</TabsTrigger>
            <TabsTrigger value="recommendations">Рекомендации</TabsTrigger>
            {analysis.text && <TabsTrigger value="text">Текст</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Описание</h3>
                <p className="text-muted-foreground mt-1">{analysis.description || 'Описание отсутствует'}</p>
              </div>

              {analysis.mood && (
                <div>
                  <h3 className="text-lg font-medium">Настроение</h3>
                  <p className="text-muted-foreground mt-1">{analysis.mood}</p>
                </div>
              )}

              {analysis.colors && analysis.colors.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium">Основные цвета</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Array.isArray(analysis.colors) ? analysis.colors.map((color, index) => (
                      <Badge key={index} variant="outline" className="px-3 py-1">
                        {color}
                      </Badge>
                    )) : (
                      <p className="text-muted-foreground">{analysis.colors}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="objects">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Обнаруженные объекты</h3>
              {analysis.objects ? (
                Array.isArray(analysis.objects) ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {analysis.objects.map((object, index) => (
                      <li key={index}>{object}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{analysis.objects}</p>
                )
              ) : (
                <p className="text-muted-foreground">Объекты не обнаружены</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="composition">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Композиция</h3>
              <p className="text-muted-foreground">{analysis.composition || 'Данные о композиции отсутствуют'}</p>

              {analysis.engagement_factors && (
                <>
                  <Separator className="my-4" />
                  <h3 className="text-lg font-medium">Факторы вовлеченности</h3>
                  {Array.isArray(analysis.engagement_factors) ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {analysis.engagement_factors.map((factor, index) => (
                        <li key={index}>{factor}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">{analysis.engagement_factors}</p>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recommendations">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Рекомендации для создания контента</h3>
              {analysis.recommendations ? (
                Array.isArray(analysis.recommendations) ? (
                  <ul className="list-disc pl-5 space-y-2">
                    {analysis.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{analysis.recommendations}</p>
                )
              ) : (
                <p className="text-muted-foreground">Рекомендации отсутствуют</p>
              )}
            </div>
          </TabsContent>

          {analysis.text && (
            <TabsContent value="text">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Распознанный текст</h3>
                <div className="bg-muted p-3 rounded-md whitespace-pre-wrap font-mono text-sm">
                  {analysis.text}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
};
```

### 6. Реализация структуры данных

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
  analysisData: jsonb("analysis_data"),  // Хранит весь результат анализа в JSON
  createdAt: timestamp("created_at").defaultNow(),
  userId: uuid("user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
});

// Создаем тип для вставки
export const createMediaAnalysisSchema = createInsertSchema(mediaAnalysisTable);
export type InsertMediaAnalysis = z.infer<typeof createMediaAnalysisSchema>;
```

## Преимущества Qwen-VL перед FAL AI

1. **Гибкая настройка анализа**: Возможность задавать разные типы вопросов об изображении
2. **Мультимодальность**: Анализ изображений как часть общего AI-сервиса
3. **Лучшая совместимость с русским языком**: Нативная поддержка русского языка для описаний
4. **Меньше интеграций**: Используем уже настроенный сервис, не нужны дополнительные API ключи
5. **Структурированный вывод**: Возможность получать JSON-структуры для удобного отображения

## Дополнительные функции для будущей реализации

1. **Интеллектуальные вопросы к изображениям**:
   - Возможность задавать произвольные вопросы к изображению через интерфейс
   - Например: "Какие элементы стоит изменить для лучшей вовлеченности?"

2. **Сравнительный анализ изображений**:
   - Одновременный анализ нескольких изображений
   - Выявление общих черт и различий

3. **Анализ видео с временными метками**:
   - Полный анализ видео с разбивкой по сценам
   - Определение ключевых моментов с временными метками

4. **Генерация текста для изображений**:
   - Автоматическое создание подписей к постам
   - Генерация хэштегов на основе содержимого изображения

## Рекомендации по внедрению

1. Реализовать функционал в новой ветке git (например, `feature/qwen-media-analyzer`)
2. Начать с простого анализа изображений, затем добавить поддержку видео
3. Интегрировать сначала в детальное представление тренда, затем в списки
4. Создать отдельную страницу для управления анализом медиаконтента
5. Добавить кэширование результатов анализа для экономии запросов к API