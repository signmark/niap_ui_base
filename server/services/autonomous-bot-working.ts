import { directusCrud, directusAuthManager } from './directus/index';
import { GeminiVertexService } from './gemini-vertex';
import { falAiUniversalService } from './fal-ai-universal';
import logger from '../utils/logger';
import axios from 'axios';

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

export class AutonomousBotWorking {
  private gemini: GeminiVertexService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private currentCampaignId: string | null = null;

  constructor() {
    this.gemini = new GeminiVertexService();
  }

  /**
   * Запуск автономного бота для кампании
   */
  async start(campaignId: string, config: BotConfig): Promise<void> {
    if (this.isRunning) {
      logger.info(`[AutonomousBot] Бот уже запущен для кампании ${this.currentCampaignId}`);
      return;
    }

    logger.info(`[AutonomousBot] Запуск автономного бота для кампании ${campaignId}`);
    this.isRunning = true;
    this.currentCampaignId = campaignId;

    try {
      // Немедленно запустить первый цикл
      await this.runCycle(campaignId, config);

      // Установить интервал для последующих циклов
      this.intervalId = setInterval(async () => {
        try {
          await this.runCycle(campaignId, config);
        } catch (error) {
          logger.error(`[AutonomousBot] Ошибка в интервальном цикле:`, error);
        }
      }, config.frequency * 60 * 1000);

      logger.info(`[AutonomousBot] Бот запущен с интервалом ${config.frequency} минут`);
    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка запуска бота:`, error);
      this.stop();
      throw error;
    }
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
    this.currentCampaignId = null;
    logger.info(`[AutonomousBot] Автономный бот остановлен`);
  }

  /**
   * Получить статус бота
   */
  getStatus(): { isRunning: boolean; intervalId: boolean; campaignId: string | null } {
    return {
      isRunning: this.isRunning,
      intervalId: !!this.intervalId,
      campaignId: this.currentCampaignId
    };
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
      const selectedTrends = this.selectBestTrends(trends, config.maxPostsPerCycle);

      // 3. Генерировать контент для каждого тренда
      const generatedContent: GeneratedContent[] = [];
      for (const trend of selectedTrends) {
        try {
          const content = await this.generateContentFromTrend(campaignId, trend, config);
          if (content) {
            generatedContent.push(content);
          }
        } catch (error) {
          logger.error(`[AutonomousBot] Ошибка генерации контента для тренда ${trend.id}:`, error);
        }
      }

      // 4. Создать и запланировать публикации
      for (const content of generatedContent) {
        try {
          await this.createAndSchedulePost(campaignId, content, config);
        } catch (error) {
          logger.error(`[AutonomousBot] Ошибка создания публикации:`, error);
        }
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

      if (!response || !response.data) {
        logger.warn(`[AutonomousBot] Нет данных трендов для кампании ${campaignId}`);
        return [];
      }

      return response.data.map((trend: any) => ({
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
  private selectBestTrends(trends: TrendData[], maxPosts: number): TrendData[] {
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
      const response = await this.gemini.generateContent(prompt);
      
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
      const campaign = await directusCrud.getItemById('campaigns', campaignId, { authToken: systemToken });
      
      if (!campaign) {
        throw new Error('Кампания не найдена');
      }

      return {
        name: campaign.name || 'Автономная кампания',
        description: campaign.description || 'Умная SMM кампания',
        targetAudience: campaign.target_audience || 'Широкая аудитория',
        keywords: campaign.keywords || '',
        tone: campaign.tone || 'дружелюбный',
        language: campaign.language || 'ru'
      };
    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка получения контекста кампании:`, error);
      return {
        name: 'Автономная кампания',
        description: 'Умная SMM кампания',
        targetAudience: 'Широкая аудитория',
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
- Тон должен соответствовать кампании: ${campaignContext.tone}
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
          title: parsed.title || 'Автоматически созданный пост',
          content: parsed.content || response.substring(0, 280),
          hashtags: parsed.hashtags || ['#автопост', '#контент'],
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
      const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
      
      // Рассчитать оптимальное время публикации
      const scheduledTime = this.calculateOptimalPostTime(config.platforms);
      
      // Создать публикацию в Directus
      const postData = {
        campaign_id: campaignId,
        title: content.title,
        content: content.content,
        hashtags: content.hashtags.join(' '),
        platforms: config.platforms,
        status: 'scheduled',
        scheduled_at: scheduledTime,
        created_by_bot: true,
        content_type: 'text'
      };

      const createdPost = await directusCrud.createItem('publications', postData, { authToken: systemToken });
      
      if (!createdPost) {
        throw new Error('Не удалось создать публикацию');
      }

      // Если есть prompt для изображения, попытаться создать изображение
      if (content.imagePrompt && config.contentTypes.includes('image')) {
        await this.generateAndAttachImage(createdPost.id, content.imagePrompt, systemToken);
      }

      logger.info(`[AutonomousBot] Публикация создана и запланирована: ${createdPost.id}`);

    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка создания публикации:`, error);
      throw error;
    }
  }

  /**
   * Простой расчет оптимального времени публикации
   */
  private calculateOptimalPostTime(platforms: string[]): string {
    // Базовая логика - публикация в ближайшие 2-8 часов
    const minDelay = 2 * 60; // 2 часа в минутах
    const maxDelay = 8 * 60; // 8 часов в минутах
    const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
    
    return new Date(Date.now() + randomDelay * 60 * 1000).toISOString();
  }

  /**
   * Генерация и прикрепление изображения к публикации
   */
  private async generateAndAttachImage(postId: string, imagePrompt: string, authToken: string): Promise<void> {
    try {
      logger.info(`[AutonomousBot] Попытка генерации изображения для поста ${postId}`);
      
      // Простая логика для изображений - пока используем placeholder
      const placeholderImages = [
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600',
        'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600',
        'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600'
      ];
      
      const randomImage = placeholderImages[Math.floor(Math.random() * placeholderImages.length)];
      
      await directusCrud.updateItem('publications', postId, {
        media_url: randomImage,
        media_type: 'image',
        has_media: true
      }, { authToken });

      logger.info(`[AutonomousBot] Изображение прикреплено к посту ${postId}`);
      
    } catch (error) {
      logger.error(`[AutonomousBot] Ошибка прикрепления изображения:`, error);
    }
  }
}

export const autonomousBotWorking = new AutonomousBotWorking();