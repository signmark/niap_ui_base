/**
 * Генератор контента на основе анкеты компании
 * Использует данные из кампании и анкеты для создания персонализированного контента
 */

import { directusCrud } from './services/directus/index.js';
import { GeminiVertexService } from './services/gemini-vertex.js';
import { falAiUniversalService } from './services/fal-ai-universal.js';
import logger from './utils/logger.js';

interface QuestionnaireBasedContent {
  title: string;
  content: string;
  hashtags: string[];
  targetAudience: string;
  contentType: 'educational' | 'promotional' | 'testimonial' | 'howto' | 'announcement';
  imagePrompt: string;
}

interface CampaignData {
  id: string;
  name: string;
  description?: string;
  target_audience?: string;
  business_type?: string;
  goals?: string;
  unique_selling_proposition?: string;
  keywords?: string;
  tone?: string;
  language?: string;
  questionnaire_data?: any;
}

export class QuestionnaireContentGenerator {
  private gemini: GeminiVertexService;

  constructor() {
    this.gemini = new GeminiVertexService();
  }

  /**
   * Получить данные кампании с анкетой
   */
  async getCampaignQuestionnaire(campaignId: string): Promise<CampaignData | null> {
    try {
      const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
      const campaign = await directusCrud.getItemById('campaigns', campaignId, { authToken: systemToken });
      
      if (!campaign) {
        logger.warn(`Campaign ${campaignId} not found`);
        return null;
      }

      logger.info(`Loaded campaign: ${campaign.name || 'Unnamed'}`);
      return campaign as CampaignData;
      
    } catch (error) {
      logger.error('Error loading campaign questionnaire:', error);
      return null;
    }
  }

  /**
   * Анализ анкеты и создание контент-стратегии
   */
  async analyzeQuestionnaireForContentStrategy(campaignData: CampaignData): Promise<string[]> {
    const prompt = `
Проанализируй данные компании и создай список из 5-7 тем для контента в социальных сетях.

Данные компании:
- Название: ${campaignData.name}
- Описание: ${campaignData.description || 'Не указано'}
- Целевая аудитория: ${campaignData.target_audience || 'Широкая аудитория'}
- Тип бизнеса: ${campaignData.business_type || 'Не указан'}
- Цели: ${campaignData.goals || 'Продвижение бренда'}
- УТП: ${campaignData.unique_selling_proposition || 'Не указано'}
- Ключевые слова: ${campaignData.keywords || 'Не указаны'}
- Тон общения: ${campaignData.tone || 'Дружелюбный'}

Создай список актуальных тем для контента, которые:
1. Соответствуют целевой аудитории
2. Раскрывают преимущества компании
3. Решают проблемы клиентов
4. Повышают экспертность бренда
5. Подходят для социальных сетей

Формат ответа - список тем через точку с запятой:
Тема 1; Тема 2; Тема 3; Тема 4; Тема 5
`;

    try {
      const response = await this.gemini.generateContent(prompt);
      if (!response) return [];

      const topics = response.split(';').map(topic => topic.trim()).filter(topic => topic.length > 0);
      logger.info(`Generated ${topics.length} content topics based on questionnaire`);
      return topics;
      
    } catch (error) {
      logger.error('Error analyzing questionnaire:', error);
      return [];
    }
  }

  /**
   * Генерация контента на основе темы и анкеты
   */
  async generateContentFromQuestionnaire(
    campaignData: CampaignData, 
    topic: string
  ): Promise<QuestionnaireBasedContent | null> {
    const prompt = `
Создай привлекательный пост для социальных сетей на основе данных компании и темы.

ДАННЫЕ КОМПАНИИ:
- Название: ${campaignData.name}
- Описание: ${campaignData.description || 'Профессиональная компания'}
- Целевая аудитория: ${campaignData.target_audience || 'Широкая аудитория'}
- Тип бизнеса: ${campaignData.business_type || 'Услуги'}
- УТП: ${campaignData.unique_selling_proposition || 'Высокое качество'}
- Тон общения: ${campaignData.tone || 'Дружелюбный'}
- Язык: ${campaignData.language || 'ru'}

ТЕМА ПОСТА: ${topic}

ТРЕБОВАНИЯ:
- Длина: 200-300 символов
- Включи конкретные преимущества компании из анкеты
- Обратись к целевой аудитории
- Добавь призыв к действию
- Используй указанный тон общения
- 3-5 релевантных хэштегов
- Создай описание для изображения

Верни результат в JSON формате:
{
  "title": "Заголовок поста",
  "content": "Основной текст поста с призывом к действию",
  "hashtags": ["#хештег1", "#хештег2", "#хештег3"],
  "targetAudience": "Описание целевой аудитории",
  "contentType": "educational/promotional/testimonial/howto/announcement",
  "imagePrompt": "Детальное описание изображения на английском языке для AI генерации"
}
`;

    try {
      const response = await this.gemini.generateContent(prompt);
      if (!response) return null;

      // Парсинг JSON ответа
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        logger.info(`Generated content for topic: ${topic}`);
        return parsed as QuestionnaireBasedContent;
      }

      // Fallback парсинг
      return {
        title: topic,
        content: response.substring(0, 280),
        hashtags: ['#контент', '#бизнес'],
        targetAudience: campaignData.target_audience || 'Широкая аудитория',
        contentType: 'promotional',
        imagePrompt: `Professional business content about ${topic}, modern office setting, high quality`
      };

    } catch (error) {
      logger.error('Error generating content from questionnaire:', error);
      return null;
    }
  }

  /**
   * Создание нескольких публикаций на основе анкеты кампании
   */
  async createQuestionnaireBasedContent(campaignId: string, numberOfPosts: number = 3): Promise<any[]> {
    try {
      logger.info(`Creating questionnaire-based content for campaign ${campaignId}`);
      
      // 1. Получить данные кампании
      const campaignData = await this.getCampaignQuestionnaire(campaignId);
      if (!campaignData) {
        throw new Error('Campaign data not found');
      }

      // 2. Проанализировать анкету и получить темы
      const topics = await this.analyzeQuestionnaireForContentStrategy(campaignData);
      if (topics.length === 0) {
        throw new Error('No content topics generated from questionnaire');
      }

      const selectedTopics = topics.slice(0, numberOfPosts);
      const createdPosts = [];

      // 3. Создать контент для каждой темы
      for (let i = 0; i < selectedTopics.length; i++) {
        const topic = selectedTopics[i];
        logger.info(`Creating content ${i + 1}/${selectedTopics.length}: ${topic}`);

        // Генерировать контент
        const content = await this.generateContentFromQuestionnaire(campaignData, topic);
        if (!content) continue;

        // Генерировать изображение
        let imageUrl: string | null = null;
        try {
          const imageResult = await falAiUniversalService.generateImage({
            prompt: content.imagePrompt,
            image_size: 'landscape_4_3',
            num_inference_steps: 28,
            guidance_scale: 3.5,
            num_images: 1,
            enable_safety_checker: true
          });

          if (imageResult?.images?.[0]?.url) {
            imageUrl = imageResult.images[0].url;
            logger.info('Image generated successfully');
          }
        } catch (imageError) {
          logger.warn('Image generation failed, using placeholder');
          imageUrl = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600';
        }

        // Создать публикацию
        const scheduledTime = new Date(Date.now() + (i + 1) * 3 * 60 * 60 * 1000).toISOString();
        const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';

        const publicationData = {
          campaign_id: campaignId,
          title: content.title,
          content: content.content,
          hashtags: content.hashtags.join(' '),
          platforms: ['vk', 'telegram', 'facebook'],
          status: 'scheduled',
          scheduled_at: scheduledTime,
          created_by_bot: true,
          content_type: content.contentType,
          media_url: imageUrl,
          media_type: imageUrl ? 'image' : null,
          has_media: !!imageUrl,
          target_audience: content.targetAudience
        };

        const createdPost = await directusCrud.createItem('publications', publicationData, { authToken: systemToken });
        if (createdPost) {
          createdPosts.push({
            id: createdPost.id,
            topic,
            content: content.content,
            scheduledTime,
            hasImage: !!imageUrl
          });
          logger.info(`Post created successfully: ${createdPost.id}`);
        }
      }

      logger.info(`Created ${createdPosts.length} questionnaire-based posts`);
      return createdPosts;

    } catch (error) {
      logger.error('Error creating questionnaire-based content:', error);
      throw error;
    }
  }
}

export const questionnaireContentGenerator = new QuestionnaireContentGenerator();