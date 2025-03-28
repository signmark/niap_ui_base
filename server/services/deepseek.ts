import axios from 'axios';
import { apiKeyService } from './api-keys';

/**
 * Сервис для взаимодействия с DeepSeek AI API
 */
class DeepSeekService {
  private baseUrl = 'https://api.deepseek.com/v1';
  private defaultModel = 'deepseek-chat';

  constructor() {
    console.log('DeepSeek service initialized. API keys will be obtained ONLY from Directus user settings.');
  }

  /**
   * Генерирует контент с помощью DeepSeek API
   * 
   * @param prompt - промпт для генерации
   * @param options - дополнительные параметры запроса
   * @param userId - ID пользователя для получения ключа API
   * @param token - токен авторизации для Directus
   */
  async generateContent(
    prompt: string, 
    options: {
      model?: string; 
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      keywords?: string[];
      tone?: string;
      platform?: string;
      trends?: any[];
    } = {},
    userId?: string,
    token?: string
  ) {
    try {
      // Получаем API ключ из сервиса ключей
      const apiKey = await apiKeyService.getApiKey(userId || '', 'deepseek', token);
      
      if (!apiKey) {
        throw new Error('DeepSeek API key is not available');
      }
      
      console.log('DeepSeek API key updated from user settings');
      
      // Подготавливаем системный промпт на основе параметров
      const defaultSystemPrompt = `You are a social media content creator that writes engaging and high-quality content.`;
      
      // Учитываем тон контента, если он указан
      let toneDescription = '';
      if (options.tone) {
        switch (options.tone) {
          case 'informative':
            toneDescription = 'educational and informative';
            break;
          case 'casual':
            toneDescription = 'casual and friendly';
            break;
          case 'professional':
            toneDescription = 'professional and formal';
            break;
          case 'funny':
            toneDescription = 'humorous and entertaining';
            break;
          default:
            toneDescription = 'professional and engaging';
        }
      }
      
      // Учитываем платформу, если она указана
      let platformGuidelines = '';
      if (options.platform) {
        switch (options.platform) {
          case 'telegram':
            platformGuidelines = 'For Telegram: Create a conversational post with emojis, clear formatting, and concise paragraphs. Use markdown for emphasis where appropriate.';
            break;
          case 'vk':
            platformGuidelines = 'For VK: Create a conversational post with some emojis, engaging questions, and call to actions. Text should be relatively short.';
            break;
          case 'instagram':
            platformGuidelines = 'For Instagram: Create a short, visually descriptive post with emojis and hashtags at the end. Keep paragraphs very short.';
            break;
          case 'facebook':
            platformGuidelines = 'For Facebook: Create a conversational post with some emojis. Moderate length is acceptable, break into 2-3 short paragraphs.';
            break;
          default:
            platformGuidelines = 'Create content suitable for social media with appropriate formatting.';
        }
      }
      
      // Формируем полную системную инструкцию
      const systemPrompt = options.systemPrompt || `${defaultSystemPrompt}
Your writing style is ${toneDescription || 'professional and engaging'}.
${platformGuidelines}

${options.keywords?.length ? `Try to incorporate some of these keywords naturally in the content: ${options.keywords.join(', ')}` : ''}

Create high-quality, original content that is engaging, accurate, and free of excessive promotional language.`;

      // Форматируем тренды в информативный контекст, если они предоставлены
      let trendsContext = '';
      if (options.trends && options.trends.length > 0) {
        trendsContext = `\n\nHere are the trends to base your content on:\n`;
        options.trends.forEach((trend, index) => {
          trendsContext += `${index + 1}. ${trend.title}${trend.description ? `: ${trend.description}` : ''}\n`;
        });
      }
      
      // Объединяем промпт пользователя с контекстом трендов
      const finalPrompt = `${prompt}${trendsContext}`;
      
      console.log(`Sending request to DeepSeek API (model: ${options.model || this.defaultModel}, temp: ${options.temperature || 0.3})`);
      
      // Формируем запрос к API
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: options.model || this.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: finalPrompt }
          ],
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.3,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
      
      // Проверяем ответ и возвращаем сгенерированный контент
      if (
        response.data && 
        response.data.choices && 
        response.data.choices.length > 0 && 
        response.data.choices[0].message
      ) {
        return response.data.choices[0].message.content;
      }
      
      throw new Error('Invalid response from DeepSeek API');
    } catch (error) {
      console.error('Error in DeepSeek service:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`DeepSeek API error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`);
      }
      
      throw error;
    }
  }
}

export const deepSeekService = new DeepSeekService();