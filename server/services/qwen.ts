import axios from 'axios';
import { apiKeyService } from './api-keys';
import { log } from '../utils/logger';

export interface QwenConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class QwenService {
  private apiKey: string;
  private readonly baseUrl = 'https://api.qwen.ai/v1';
  
  constructor(config: QwenConfig) {
    this.apiKey = config.apiKey;
  }
  
  /**
   * Обновляет API ключ сервиса
   */
  updateApiKey(newApiKey: string): void {
    if (newApiKey && newApiKey.trim() !== '') {
      this.apiKey = newApiKey;
      console.log("Qwen API key updated from user settings");
    }
  }
  
  /**
   * Проверяет, установлен ли API ключ
   * @returns true, если API ключ установлен, иначе false
   */
  hasApiKey(): boolean {
    return !!(this.apiKey && this.apiKey.trim() !== '');
  }
  
  /**
   * Инициализирует сервис с API ключом пользователя
   * @param userId ID пользователя
   * @returns true, если сервис инициализирован успешно, иначе false
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      // Ищем API ключ пользователя 
      const apiKey = await apiKeyService.getUserApiKey(userId, 'qwen');
      
      if (apiKey && apiKey.trim() !== '') {
        this.apiKey = apiKey;
        console.log(`Qwen API key updated from user settings for user ${userId}`);
        return true;
      } else {
        console.log(`Qwen API key not found for user ${userId}`);
        return false;
      }
    } catch (error) {
      console.error(`Error initializing Qwen service for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Отправляет запрос на генерацию текста через Qwen API
   */
  async generateText(messages: QwenMessage[], options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop?: string[];
  } = {}): Promise<string> {
    try {
      // Модель Qwen по умолчанию - Qwen 1.5-72B-Chat
      const model = options.model || 'qwen1.5-72b-chat';
      const temperature = options.temperature !== undefined ? options.temperature : 0.3;
      const max_tokens = options.max_tokens || 1000;
      const top_p = options.top_p !== undefined ? options.top_p : 0.9;
      
      // Проверяем, что API ключ установлен
      if (!this.apiKey || this.apiKey.trim() === '') {
        console.error('Qwen API key is not set');
        throw new Error('Qwen API ключ не установлен. Пожалуйста, добавьте API ключ в настройках пользователя.');
      }
      
      console.log(`Sending request to Qwen API (model: ${model}, temp: ${temperature})`);
      
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages,
          temperature,
          max_tokens,
          top_p,
          stop: options.stop || null
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data?.choices?.[0]?.message?.content) {
        console.error('Invalid response format from Qwen API:', response.data);
        throw new Error('Некорректный ответ от Qwen API. Пожалуйста, проверьте настройки или попробуйте позже.');
      }
      
      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('Error calling Qwen API:', error);
      
      // Проверяем, содержит ли сообщение об ошибке "Invalid API key"
      if (error.response?.data?.error) {
        const errorMessage = error.response.data.error.message || error.response.data.error;
        
        if (typeof errorMessage === 'string' && 
           (errorMessage.includes('API key') || errorMessage.includes('authentication') || 
            errorMessage.includes('auth') || errorMessage.includes('token') || 
            error.response.status === 401 || error.response.status === 403)) {
          throw new Error('Недействительный API ключ Qwen. Пожалуйста, проверьте ключ в настройках пользователя.');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Генерирует контент для социальных сетей на основе ключевых слов и трендов
   */
  async generateSocialContent(
    keywords: string[],
    topics: string[],
    platform: string,
    options: {
      length?: 'short' | 'medium' | 'long',
      tone?: 'professional' | 'casual' | 'friendly' | 'humorous',
      language?: 'ru' | 'en'
    } = {}
  ): Promise<string> {
    const length = options.length || 'medium';
    const tone = options.tone || 'professional';
    const language = options.language || 'ru';
    
    const lengthMap = {
      short: 'короткий (до 100 слов)',
      medium: 'средний (150-200 слов)',
      long: 'длинный (250-300 слов)'
    };
    
    const toneMap = {
      professional: 'профессиональный и информативный',
      casual: 'неформальный и разговорный',
      friendly: 'дружелюбный и вовлекающий',
      humorous: 'с юмором и легкостью'
    };
    
    const langMap = {
      ru: 'на русском языке',
      en: 'на английском языке'
    };
    
    const platformSpecifics = platform === 'instagram' 
      ? 'Обязательно используй эмодзи между абзацами и в конце предложений. Включи 5-7 хэштегов в конце поста.'
      : platform === 'facebook'
        ? 'Используй четкое форматирование текста с абзацами. Добавь 2-3 вопроса для вовлечения аудитории.'
        : platform === 'telegram' 
          ? 'Добавь ссылки и упоминания. Можно использовать эмодзи, но умеренно. Не используй хэштеги.'
          : 'Адаптируй контент для цифровых платформ.';
    
    const systemPrompt = `Ты профессиональный копирайтер для социальных сетей. Твоя задача - создать качественный контент для платформы ${platform} на основе предоставленных ключевых слов и тем.

Создай ${lengthMap[length]} пост ${langMap[language]} с ${toneMap[tone]} тоном.

${platformSpecifics}

В тексте обязательно используй предоставленные ключевые слова органично, без искусственного вставления. Раскрой предоставленные темы, но делай это естественно и интересно для читателя.

ВАЖНО:
- Не упоминай, что текст создан ИИ или для каких-то конкретных целей
- Не используй клише и шаблонные фразы
- Делай текст живым, с естественными переходами между мыслями
- Используй активный залог вместо пассивного`;

    // Обработка различных типов данных
    let keywordsStr = Array.isArray(keywords) ? keywords.join(', ') : typeof keywords === 'string' ? keywords : String(keywords || '');
    let topicsStr = Array.isArray(topics) ? topics.join(', ') : typeof topics === 'string' ? topics : String(topics || '');
    
    const userContent = `Ключевые слова: ${keywordsStr}
Темы для раскрытия: ${topicsStr}

Создай привлекательный пост для ${platform} ${language === 'ru' ? 'на русском языке' : 'на английском языке'}.`;

    try {
      return await this.generateText(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        {
          temperature: 0.7,  // Более высокая температура для креативности
          max_tokens: length === 'short' ? 300 : length === 'medium' ? 500 : 800
        }
      );
    } catch (error) {
      console.error('Error generating social content with Qwen:', error);
      throw error;
    }
  }
  
  /**
   * Генерирует промт для изображения на основе текстового контента
   * @param content Текстовый контент, на основе которого нужно сгенерировать промт
   * @param keywords Ключевые слова для усиления релевантности промта (опционально)
   * @returns Промт для генерации изображения на английском языке
   */
  async generateImagePrompt(
    content: string,
    keywords: string[] = []
  ): Promise<string> {
    try {
      // Очищаем HTML-теги из контента, но сохраняем структуру текста
      const cleanedContent = content
        .replace(/<[^>]*>/g, ' ')  // Заменяем HTML-теги пробелами
        .replace(/\s+/g, ' ')      // Заменяем множественные пробелы одним
        .trim();                    // Убираем пробелы в начале и конце
      
      console.log('Генерация промта на основе текста через Qwen (одноэтапный метод)');
      console.log(`Очищенный текст перед отправкой: ${cleanedContent.substring(0, 150)}...`);
      
      // Формируем системный промт с улучшенными инструкциями для работы с русским текстом
      const systemPrompt = `You are an expert image prompt generator for Stable Diffusion AI.
Your task is to translate Russian text into detailed English image generation prompts.

INSTRUCTIONS:
1. Read the provided Russian text content carefully
2. Translate and transform the content directly into a detailed, vivid image prompt in ENGLISH
3. Focus on the main subject, scene, mood, and style from the content
4. Include visual details like lighting, color scheme, and composition
5. DO NOT mention text, captions, or writing in the image
6. Output ONLY the image prompt text in English - nothing else
7. Format the prompt to be optimized for Stable Diffusion or Midjourney
8. DO NOT put quotation marks around the prompt
9. DO NOT include any explanations or comments
10. Length should be 1-3 sentences maximum
11. Include adjectives like "detailed", "high quality", "photorealistic" or art styles
12. Always add quality boosters like "4k", "masterpiece", "intricate details"`;

      // Подготавливаем пользовательское сообщение с ключевыми словами
      let userPrompt = `Generate an image prompt from this Russian text:\n\n${cleanedContent.substring(0, 1000)}`;
      
      // Добавляем ключевые слова, если они предоставлены
      if (keywords && keywords.length > 0) {
        userPrompt += `\n\nAdditional keywords to emphasize: ${keywords.join(', ')}`;
      }
      
      // Выполняем один запрос для генерации промта
      const finalPrompt = await this.generateText(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.7,
          max_tokens: 500
        }
      );
      
      console.log(`Generated image prompt via Qwen: ${finalPrompt.substring(0, 100)}...`);
      return finalPrompt;
    } catch (error) {
      console.error('Error generating image prompt with Qwen:', error);
      // В случае ошибки генерируем базовый промт
      return 'A detailed, high-quality image related to the content, photorealistic style, 4k, masterpiece';
    }
  }
  
  /**
   * Генерирует крючки (hooks) для контента
   */
  async generateHooks(
    subject: string,
    tone: 'professional' | 'casual' | 'urgent' | 'curiosity' = 'professional'
  ): Promise<string[]> {
    try {
      const toneMap = {
        professional: 'профессиональный и информативный',
        casual: 'неформальный и дружественный',
        urgent: 'срочный и вызывающий желание действовать немедленно',
        curiosity: 'вызывающий любопытство и интригующий'
      };
      
      const systemPrompt = `Ты копирайтер, специалист по созданию привлекательных заголовков и крючков.
Твоя задача - создать 5 вариантов крючков (hooks) для привлечения внимания читателя.

Крючки должны быть:
- Короткими (не более 100 символов)
- Цепляющими внимание
- С ${toneMap[tone]} тоном
- Без излишнего хайпа или кликбейта
- Соответствующими теме

Создай 5 разных вариантов, которые вызовут желание узнать подробности.`;

      const userPrompt = `Тема для крючков: ${subject}

Пожалуйста, создай 5 вариантов крючков для этой темы.`;

      const response = await this.generateText(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.8,
          max_tokens: 400
        }
      );
      
      // Обрабатываем ответ, разбивая его на отдельные строки
      // и фильтруя пустые строки или нумерацию
      return response
        .split('\n')
        .map(line => line.trim())
        .map(line => line.replace(/^[0-9]+[\.\)\-:]?\s*/, '')) // Удаляем нумерацию (1., 2), 3: и т.д.)
        .filter(line => line && line.length > 10); // Оставляем только непустые строки достаточной длины
    } catch (error) {
      console.error('Error generating hooks with Qwen:', error);
      return [
        'Узнайте, почему это важно сейчас',
        'Интересное открытие, которое стоит увидеть',
        'Вы точно об этом не знали!',
        'Простой способ решить сложную проблему',
        'Только факты: что нужно знать'
      ];
    }
  }
}

// Создаем инстанс сервиса с пустым ключом
export const qwenService = new QwenService({ apiKey: '' });

// Обновляем API ключ при инициализации и когда он меняется
apiKeyService.addKeyUpdateListener('qwen', (newKey) => {
  qwenService.updateApiKey(newKey);
});