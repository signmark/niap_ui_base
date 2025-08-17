import { directusCrud, directusAuthManager } from './directus/index';
import { GeminiVertexService } from './gemini-vertex';
import logger from '../utils/logger';
import axios from 'axios';
import { falAiUniversalService } from './fal-ai-universal';

interface BotConfig {
  enabled: boolean;
  frequency: number; // минуты между циклами
  contentTypes: string[];
  platforms: string[];
  moderationLevel: 'strict' | 'normal' | 'relaxed';
  maxPostsPerCycle: number;
}

interface TrendData {
  id: string;
  title: string;
  description: string;
  platform: string;
  engagement: number;
  sentiment: string;
  keywords: string[];
}

interface GeneratedContent {
  title: string;
  content: string;
  hashtags: string[];
  platform: string;
  contentType: 'text' | 'image' | 'story';
  imagePrompt?: string;
}

export class AutonomousBot {
  private gemini: GeminiVertexService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private directus: any;
  private falAI: any;

  constructor() {
    this.gemini = new GeminiVertexService();
    this.directus = directusCrud;
    this.falAI = falAiUniversalService;
  }

  /**
   * Запуск автономного бота для кампании
   */
  async start(campaignId: string, config: BotConfig): Promise<void> {
    if (this.isRunning) {
      logger.info(`[AutonomousBot] Бот для кампании ${campaignId} уже запущен`);
      return;
    }

    logger.info(`[AutonomousBot] Запуск автономного бота для кампании ${campaignId}`);
    this.isRunning = true;

    // Немедленно запустить первый цикл
    await this.runCycle(campaignId, config);

    // Установить интервал для последующих циклов
    this.intervalId = setInterval(async () => {
      await this.runCycle(campaignId, config);
    }, config.frequency * 60 * 1000);

    logger.info(`[AutonomousBot] Бот запущен с интервалом ${config.frequency} минут`);
  }

  /**
   * Остановка бота
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info(`[AutonomousBot] Автономный бот остановлен`);
  }

  /**
   * Основной цикл работы бота
   */
  private async runCycle(campaignId: string, config: BotConfig): Promise<void> {
    try {
      logger.info(`[AutonomousBot] Начало цикла для кампании ${campaignId}`);

      // 1. Получить последние тренды
      const trends = await this.getLatestTrends(campaignId);
      if (trends.length === 0) {
        logger.info(`[AutonomousBot] Нет новых трендов для анализа`);
        return;
      }

      // 2. Выбрать лучшие тренды для контента
      const selectedTrends = await this.selectBestTrends(trends, config.maxPostsPerCycle);

      // 3. Генерировать контент для каждого тренда
      const generatedContent: GeneratedContent[] = [];
      for (const trend of selectedTrends) {
        const content = await this.generateContentFromTrend(campaignId, trend, config);
        if (content) {
          generatedContent.push(content);
        }
      }

      // 4. Создать и запланировать публикации
      for (const content of generatedContent) {
        await this.createAndSchedulePost(campaignId, content, config);
      }

      logger.info(`[AutonomousBot] Цикл завершен. Создано ${generatedContent.length} публикаций`);

    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка в цикле бота:`, error);
    }
  }

  /**
   * Получение последних трендов для анализа
   */
  private async getLatestTrends(campaignId: string): Promise<TrendData[]> {
    try {
      // Используем системный токен для получения трендов
      const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
      
      const response = await directusCrud.getItems('campaign_trends', {
        filter: {
          campaign_id: { _eq: campaignId },
          status: { _eq: 'published' },
          created_at: { _gt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
        },
        sort: ['-engagement_rate', '-created_at'],
        limit: 20
      }, { authToken: systemToken });

      return response.map((trend: any) => ({
        id: trend.id,
        title: trend.title || '',
        description: trend.description || '',
        platform: trend.platform || 'unknown',
        engagement: trend.engagement_rate || 0,
        sentiment: trend.sentiment || 'neutral',
        keywords: trend.keywords ? trend.keywords.split(',').map((k: string) => k.trim()) : []
      }));

    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка получения трендов:`, error);
      return [];
    }
  }

  /**
   * Выбор лучших трендов для создания контента
   */
  private async selectBestTrends(trends: TrendData[], maxPosts: number): Promise<TrendData[]> {
    // Сортировка по engagement и позитивному sentiment
    const scored = trends.map(trend => ({
      ...trend,
      score: this.calculateTrendScore(trend)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxPosts);
  }

  /**
   * Расчет скора тренда для выбора лучших
   */
  private calculateTrendScore(trend: TrendData): number {
    let score = trend.engagement || 0;
    
    // Бонус за позитивный sentiment
    if (trend.sentiment === 'positive') score *= 1.3;
    else if (trend.sentiment === 'negative') score *= 0.7;
    
    // Бонус за количество ключевых слов
    score += (trend.keywords?.length || 0) * 0.1;
    
    return score;
  }

  /**
   * Генерация контента на основе тренда с использованием Gemini
   */
  private async generateContentFromTrend(
    campaignId: string, 
    trend: TrendData, 
    config: BotConfig
  ): Promise<GeneratedContent | null> {
    try {
      // Получить контекст кампании
      const campaignContext = await this.getCampaignContext(campaignId);
      
      // Создать промпт для Gemini
      const prompt = this.createContentPrompt(trend, campaignContext, config);
      
      // Генерировать контент через Gemini
      const response = await this.gemini.generateText(prompt);
      
      if (!response) {
        logger.warn(`[AutonomousBot] Не удалось сгенерировать контент для тренда ${trend.id}`);
        return null;
      }

      // Парсить ответ от Gemini
      const parsedContent = this.parseGeminiResponse(response, trend.platform);
      
      logger.info(`[AutonomousBot] Контент сгенерирован для тренда: ${trend.title}`);
      return parsedContent;

    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка генерации контента:`, error);
      return null;
    }
  }

  /**
   * Получение контекста кампании для генерации
   */
  private async getCampaignContext(campaignId: string): Promise<any> {
    try {
      const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
      const campaign = await directusCrud.getItemById('campaigns', campaignId);
      return {
        name: campaign.name || '',
        description: campaign.description || '',
        targetAudience: campaign.target_audience || '',
        keywords: campaign.keywords || '',
        tone: campaign.tone || 'friendly',
        language: campaign.language || 'ru'
      };
    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка получения контекста кампании:`, error);
      return {
        name: 'Тестовая кампания',
        description: 'Умная кампания SMM',
        targetAudience: 'Молодая аудитория',
        tone: 'дружелюбный',
        language: 'ru'
      };
    }
  }

  /**
   * Создание промпта для Gemini
   */
  private createContentPrompt(trend: TrendData, campaignContext: any, config: BotConfig): string {
    return `
Создай engaging пост для социальных сетей на основе следующего тренда:

ТРЕНД:
Название: ${trend.title}
Описание: ${trend.description}
Платформа: ${trend.platform}
Ключевые слова: ${trend.keywords.join(', ')}
Настроение: ${trend.sentiment}

КОНТЕКСТ КАМПАНИИ:
Название: ${campaignContext.name}
Описание: ${campaignContext.description}
Целевая аудитория: ${campaignContext.targetAudience}
Тон общения: ${campaignContext.tone}
Язык: ${campaignContext.language}

ТРЕБОВАНИЯ:
- Создай привлекательный и релевантный пост
- Длина текста: 150-300 символов для соцсетей
- Добавь 3-5 релевантных хэштегов
- Тон должен соответствать кампании: ${campaignContext.tone}
- Язык: ${campaignContext.language}
- Учти настроение тренда: ${trend.sentiment}

Верни результат в следующем JSON формате:
{
  "title": "Заголовок поста",
  "content": "Основной текст поста",
  "hashtags": ["#хештег1", "#хештег2", "#хештег3"],
  "imagePrompt": "Описание для генерации изображения (если нужно)"
}
`;
  }

  /**
   * Парсинг ответа от Gemini
   */
  private parseGeminiResponse(response: string, platform: string): GeneratedContent {
    try {
      // Извлекаем JSON из ответа
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || '',
          content: parsed.content || '',
          hashtags: parsed.hashtags || [],
          platform: platform,
          contentType: 'text',
          imagePrompt: parsed.imagePrompt
        };
      }
    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка парсинга ответа Gemini:`, error);
    }

    // Fallback парсинг
    return {
      title: 'Автоматически созданный пост',
      content: response.substring(0, 280),
      hashtags: ['#автопост', '#контент'],
      platform: platform,
      contentType: 'text'
    };
  }

  /**
   * Создание и планирование публикации
   */
  private async createAndSchedulePost(
    campaignId: string, 
    content: GeneratedContent, 
    config: BotConfig
  ): Promise<void> {
    try {
      // Создать публикацию в Directus
      const postData = {
        campaign_id: campaignId,
        title: content.title,
        content: content.content,
        hashtags: content.hashtags.join(' '),
        platforms: config.platforms,
        status: 'scheduled',
        scheduled_at: await this.calculateOptimalPostTime(campaignId, config.platforms, undefined),
        created_by_bot: true,
        source_trend_id: null // можно связать с трендом если нужно
      };

      const createdPost = await this.directus.createItem('publications', postData);
      
      // Если есть prompt для изображения, создать изображение
      if (content.imagePrompt && config.contentTypes.includes('image')) {
        await this.generateAndAttachImage(createdPost.id, content.imagePrompt);
      }

      logger.info(`[AutonomousBot] Публикация создана и запланирована: ${createdPost.id}`);

    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка создания публикации:`, error);
    }
  }

  /**
   * Интеллектуальный расчет оптимального времени публикации на основе анализа трендов
   */
  private async calculateOptimalPostTime(campaignId: string, platforms: string[], trendData?: TrendData): Promise<string> {
    try {
      // Анализ исторических данных публикаций для определения лучшего времени
      const historicalData = await this.analyzeHistoricalEngagement(campaignId, platforms);
      
      // Анализ времени активности аудитории по платформам
      const audienceActivity = await this.getAudienceActivityPatterns(platforms, trendData);
      
      // Определение оптимального времени на основе комбинации факторов
      const optimalTime = this.combineTimingFactors(historicalData, audienceActivity, trendData);
      
      logger.info(`[AutonomousBot] Рассчитано оптимальное время публикации: ${optimalTime}`);
      return optimalTime;
      
    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка расчета оптимального времени:`, error);
      // Fallback к базовой логике
      const randomDelay = Math.floor(Math.random() * (4 * 60 - 30) + 30);
      return new Date(Date.now() + randomDelay * 60 * 1000).toISOString();
    }
  }

  /**
   * Анализ исторических данных engagement для определения лучшего времени
   */
  private async analyzeHistoricalEngagement(campaignId: string, platforms: string[]): Promise<any> {
    try {
      // Получить публикации за последние 30 дней с метриками
      const response = await this.directus.getItems('publications', {
        filter: {
          campaign_id: { _eq: campaignId },
          platforms: { _intersects: platforms },
          status: { _eq: 'published' },
          created_at: { _gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
        },
        fields: ['scheduled_at', 'platforms', 'engagement_rate', 'likes', 'comments', 'shares']
      });

      // Группировать по часам и дням недели
      const hourlyStats = new Map();
      const weekdayStats = new Map();

      response.data.forEach((post: any) => {
        if (post.scheduled_at && post.engagement_rate > 0) {
          const date = new Date(post.scheduled_at);
          const hour = date.getHours();
          const weekday = date.getDay();

          // Статистика по часам
          if (!hourlyStats.has(hour)) {
            hourlyStats.set(hour, { total: 0, count: 0 });
          }
          const hourStat = hourlyStats.get(hour);
          hourStat.total += post.engagement_rate;
          hourStat.count++;

          // Статистика по дням недели
          if (!weekdayStats.has(weekday)) {
            weekdayStats.set(weekday, { total: 0, count: 0 });
          }
          const weekdayStat = weekdayStats.get(weekday);
          weekdayStat.total += post.engagement_rate;
          weekdayStat.count++;
        }
      });

      // Найти лучшие часы и дни
      let bestHour = 12; // default
      let bestHourRating = 0;
      for (const [hour, stats] of hourlyStats.entries()) {
        const avgEngagement = stats.total / stats.count;
        if (avgEngagement > bestHourRating) {
          bestHour = hour;
          bestHourRating = avgEngagement;
        }
      }

      let bestWeekday = 1; // default Monday
      let bestWeekdayRating = 0;
      for (const [weekday, stats] of weekdayStats.entries()) {
        const avgEngagement = stats.total / stats.count;
        if (avgEngagement > bestWeekdayRating) {
          bestWeekday = weekday;
          bestWeekdayRating = avgEngagement;
        }
      }

      return { bestHour, bestWeekday, hourlyStats, weekdayStats };

    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка анализа исторических данных:`, error);
      return { bestHour: 12, bestWeekday: 1 };
    }
  }

  /**
   * Анализ паттернов активности аудитории по платформам
   */
  private async getAudienceActivityPatterns(platforms: string[], trendData?: TrendData): Promise<any> {
    // Базовые паттерны активности для разных платформ
    const platformPatterns = {
      vk: { peakHours: [10, 14, 18, 20], timezone: 'Europe/Moscow' },
      facebook: { peakHours: [9, 13, 15, 21], timezone: 'Europe/Moscow' },
      instagram: { peakHours: [11, 15, 19, 21], timezone: 'Europe/Moscow' },
      telegram: { peakHours: [8, 12, 17, 22], timezone: 'Europe/Moscow' },
      youtube: { peakHours: [16, 18, 20, 22], timezone: 'Europe/Moscow' }
    };

    // Если есть данные о тренде, учесть время его активности
    let trendOptimalHours: number[] = [];
    if (trendData && trendData.engagement > 0) {
      // Определить, в какие часы тренд показывал лучшие результаты
      trendOptimalHours = [12, 15, 18]; // упрощенная логика
    }

    return { platformPatterns, trendOptimalHours };
  }

  /**
   * Комбинирование всех факторов для определения оптимального времени
   */
  private combineTimingFactors(historicalData: any, audienceActivity: any, trendData?: TrendData): string {
    // Получить лучший час из исторических данных
    const historicalBestHour = historicalData.bestHour || 12;
    
    // Получить пиковые часы для платформ
    const platformHours: number[] = [];
    Object.values(audienceActivity.platformPatterns).forEach((pattern: any) => {
      platformHours.push(...pattern.peakHours);
    });

    // Найти пересечение всех факторов
    let optimalHour = historicalBestHour;
    if (platformHours.includes(historicalBestHour)) {
      optimalHour = historicalBestHour;
    } else {
      // Взять наиболее частый час из платформ
      const hourCounts = new Map();
      platformHours.forEach(hour => {
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });
      optimalHour = Array.from(hourCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
    }

    // Определить оптимальный день (не раньше чем через 2 часа, но в пределах 2-7 дней)
    const now = new Date();
    const minDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // минимум через 2 часа
    const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // максимум через 7 дней

    // Найти ближайший подходящий день и час
    let targetDate = new Date(minDate);
    targetDate.setHours(optimalHour, Math.floor(Math.random() * 60), 0, 0);

    // Если время уже прошло сегодня, запланировать на завтра
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    // Учесть лучший день недели из исторических данных
    const targetWeekday = historicalData.bestWeekday || 1;
    const currentWeekday = targetDate.getDay();
    
    if (currentWeekday !== targetWeekday && targetWeekday !== undefined) {
      const daysToAdd = (targetWeekday - currentWeekday + 7) % 7;
      if (daysToAdd > 0 && daysToAdd <= 3) { // если не больше 3 дней
        targetDate.setDate(targetDate.getDate() + daysToAdd);
      }
    }

    // Проверить, что дата не выходит за максимальные пределы
    if (targetDate > maxDate) {
      targetDate = new Date(maxDate);
      targetDate.setHours(optimalHour, Math.floor(Math.random() * 60), 0, 0);
    }

    return targetDate.toISOString();
  }

  /**
   * Генерация и прикрепление изображения к публикации через FAL AI
   */
  private async generateAndAttachImage(postId: string, imagePrompt: string): Promise<void> {
    try {
      logger.info(`[AutonomousBot] Генерация изображения для поста ${postId}: ${imagePrompt}`);
      
      // Улучшить промпт для лучшего качества изображения
      const enhancedPrompt = this.enhanceImagePrompt(imagePrompt);
      
      // Генерировать изображение через FAL AI
      const imageResult = await this.falAI.generateImage({
        prompt: enhancedPrompt,
        image_size: 'landscape_4_3', // подходящий формат для соцсетей
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        seed: Math.floor(Math.random() * 1000000)
      });

      if (imageResult && imageResult.images && imageResult.images.length > 0) {
        const imageUrl = imageResult.images[0].url;
        
        // Обновить публикацию с URL изображения
        await this.directus.updateItem('publications', postId, {
          media_url: imageUrl,
          media_type: 'image',
          has_media: true
        });

        logger.info(`[AutonomousBot] Изображение успешно сгенерировано и прикреплено: ${imageUrl}`);
      } else {
        logger.warn(`[AutonomousBot] Не удалось сгенерировать изображение для поста ${postId}`);
      }
      
    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка генерации изображения:`, error);
      
      // Если генерация не удалась, попробуем найти подходящее изображение из библиотеки
      await this.fallbackToStockImage(postId, imagePrompt);
    }
  }

  /**
   * Улучшение промпта для генерации изображения
   */
  private enhanceImagePrompt(originalPrompt: string): string {
    const enhancements = [
      'high quality, professional',
      'vibrant colors, sharp details',
      'social media ready',
      'engaging visual content',
      'clean composition'
    ];
    
    return `${originalPrompt}, ${enhancements.join(', ')}`;
  }

  /**
   * Резервный вариант - поиск подходящего stock изображения
   */
  private async fallbackToStockImage(postId: string, imagePrompt: string): Promise<void> {
    try {
      // Простая логика для выбора подходящего placeholder изображения
      const stockImages = [
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3', // social media
        'https://images.unsplash.com/photo-1611224923853-80b023f02d71', // content creation
        'https://images.unsplash.com/photo-1551650975-87deedd944c3', // marketing
      ];
      
      const randomImage = stockImages[Math.floor(Math.random() * stockImages.length)];
      
      await this.directus.updateItem('publications', postId, {
        media_url: randomImage,
        media_type: 'image',
        has_media: true
      });

      logger.info(`[AutonomousBot] Использовано резервное изображение для поста ${postId}`);
      
    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка установки резервного изображения:`, error);
    }
  }

  /**
   * Получить статус бота
   */
  getStatus(): { isRunning: boolean; intervalId: boolean } {
    return {
      isRunning: this.isRunning,
      intervalId: !!this.intervalId
    };
  }
}

export const autonomousBot = new AutonomousBot();