import axios from 'axios';
import { apiKeyService } from './api-keys';
import { log } from '../utils/logger';

export interface PerplexityConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class PerplexityService {
  private apiKey: string;
  private readonly baseUrl = 'https://api.perplexity.ai/chat/completions';
  
  // Альтернативные URL для API Perplexity
  private readonly compatModes = {
    standard: 'https://api.perplexity.ai/chat/completions',
    legacy: 'https://api.perplexity.ai/v1/chat/completions'
  };
  
  // Указываем активную конфигурацию API
  private apiMode: 'standard' | 'legacy' = 'legacy';
  
  constructor(config: PerplexityConfig) {
    this.apiKey = config.apiKey;
  }
  
  /**
   * Обновляет API ключ сервиса
   */
  updateApiKey(newApiKey: string): void {
    if (newApiKey && newApiKey.trim() !== '') {
      this.apiKey = newApiKey;
      console.log("Perplexity API key updated from user settings");
    }
  }
  
  /**
   * Проверяет, установлен ли API ключ
   * @returns true, если API ключ установлен, иначе false
   */
  hasApiKey(): boolean {
    const hasKey = !!(this.apiKey && this.apiKey.trim() !== '');
    console.log(`Проверка API ключа Perplexity: ${hasKey ? 'ключ установлен' : 'ключ отсутствует'}`);
    return hasKey;
  }

  /**
   * Отправляет запрос на генерацию текста через Perplexity API
   */
  async generateText(messages: PerplexityMessage[], options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}): Promise<string> {
    try {
      const model = options.model || 'llama-3.1-sonar-small-128k-online';
      const temperature = options.temperature !== undefined ? options.temperature : 0.7;
      const max_tokens = options.max_tokens || 4000;
      
      // Проверяем, что API ключ установлен
      if (!this.apiKey || this.apiKey.trim() === '') {
        console.error('Perplexity API key is not set');
        throw new Error('Perplexity API ключ не установлен. Пожалуйста, добавьте API ключ в настройках пользователя.');
      }
      
      // Получаем активный URL API на основе режима
      const activeBaseUrl = this.compatModes[this.apiMode];
      
      console.log(`Sending request to Perplexity API (model: ${model}, temp: ${temperature})`);
      console.log(`Using Perplexity API URL: ${activeBaseUrl} (mode: ${this.apiMode})`);
      console.log(`Request payload: ${JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens
      }, null, 2)}`);
      
      const response = await axios.post(
        activeBaseUrl,
        {
          model,
          messages,
          temperature,
          max_tokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data?.choices?.[0]?.message?.content) {
        console.error('Invalid response format from Perplexity API:', response.data);
        throw new Error('Некорректный ответ от Perplexity API. Пожалуйста, проверьте настройки или попробуйте позже.');
      }
      
      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('Error calling Perplexity API:', error);
      
      // Проверяем, содержит ли сообщение об ошибке информацию о неверном API ключе
      if (error.response?.data?.error) {
        const errorMessage = error.response.data.error.message || error.response.data.error;
        
        if (typeof errorMessage === 'string' && 
           (errorMessage.includes('API key') || errorMessage.includes('authentication') || 
            errorMessage.includes('auth') || errorMessage.includes('token') || 
            error.response.status === 401 || error.response.status === 403)) {
          throw new Error('Недействительный API ключ Perplexity. Пожалуйста, проверьте ключ в настройках пользователя.');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Генерирует контент для социальных сетей на основе ключевых слов и запроса
   */
  async generateSocialContent(
    keywords: string[],
    prompt: string,
    tone: 'informative' | 'friendly' | 'professional' | 'casual' | 'humorous' = 'professional',
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
    } = {}
  ): Promise<string> {
    // Создаем системный промт в зависимости от выбранного тона
    let systemPrompt = "Ты - опытный копирайтер, который создает качественный контент для социальных сетей.";
    
    switch (tone) {
      case "informative":
        systemPrompt += " Твой стиль информативный, ясный и образовательный.";
        break;
      case "friendly":
        systemPrompt += " Твой стиль дружелюбный, теплый и доступный, как разговор с другом.";
        break;
      case "professional":
        systemPrompt += " Твой стиль профессиональный, авторитетный и основательный.";
        break;
      case "casual":
        systemPrompt += " Твой стиль повседневный, непринужденный и разговорный.";
        break;
      case "humorous":
        systemPrompt += " Твой стиль остроумный, забавный, с уместным юмором.";
        break;
    }
    
    const userContent = `Создай контент для социальных сетей на основе следующего задания: ${prompt}
    
    Обязательно используй эти ключевые слова: ${keywords.join(", ")}
    
    Контент должен быть в русском языке, легко читаемым, структурированным, и длиной около 2000-3000 символов.`;
    
    try {
      return await this.generateText(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        options
      );
    } catch (error) {
      console.error('Error generating social content with Perplexity:', error);
      throw error;
    }
  }
  
  /**
   * Инициализирует сервис с API ключом пользователя из централизованного сервиса API ключей
   * @param userId ID пользователя
   * @param authToken Токен авторизации для Directus (опционально)
   * @returns true в случае успешной инициализации, false в случае ошибки
   */
  async initialize(userId: string, authToken?: string): Promise<boolean> {
    try {
      console.log('Попытка инициализации Perplexity сервиса для пользователя', userId);
      
      // Используем только централизованную систему API ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'perplexity', authToken);
      
      if (apiKey) {
        console.log(`Perplexity API ключ получен из БД (длина: ${apiKey.length})`);
        this.updateApiKey(apiKey);
        log('Perplexity API ключ успешно получен через API Key Service', 'perplexity');
        console.log('Perplexity API ключ успешно получен через API Key Service');
        return true;
      } else {
        console.log('API ключ Perplexity не найден в БД для пользователя', userId);
        log('Perplexity API ключ не найден в настройках пользователя', 'perplexity');
        return false;
      }
    } catch (error) {
      console.error('Ошибка при инициализации Perplexity сервиса:', error);
      log(`Ошибка при инициализации Perplexity сервиса: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`, 'perplexity');
      return false;
    }
  }
}

// Экспортируем экземпляр сервиса для использования в других модулях
// ВАЖНО: Инициализируем без API ключа, ключ будет получен из Directus при необходимости
export const perplexityService = new PerplexityService({
  apiKey: "" // Пустой ключ, будет получен из Directus при вызове initialize()
});

// Логируем статус инициализации сервиса
console.log(`Perplexity service initialized. API keys will be obtained ONLY from Directus user settings.`);