import axios from 'axios';
import { ApiKeyService, ApiServiceName } from './api-keys';
import { formatAuthToken } from '../utils/auth';

/**
 * Сервис для работы с Claude AI API
 * Предоставляет функции для обработки текста с помощью Claude AI
 */
export class ClaudeService {
  private apiKeyService: ApiKeyService;
  private baseUrl = 'https://api.anthropic.com/v1/messages';
  private defaultModel = 'claude-3-sonnet-20240229';

  constructor(apiKeyService: ApiKeyService) {
    this.apiKeyService = apiKeyService;
  }

  /**
   * Улучшает текст с помощью Claude AI
   * @param text Исходный текст для улучшения
   * @param prompt Инструкции для улучшения текста
   * @param userId ID пользователя для получения API ключа
   * @param authToken Токен авторизации пользователя
   * @returns Улучшенный текст
   */
  async improveText(text: string, prompt: string, userId: string, authToken?: string): Promise<string> {
    const apiKey = await this.getApiKey(userId, authToken);
    if (!apiKey) {
      throw new Error('API ключ Claude AI не найден. Пожалуйста, добавьте ключ в настройках API.');
    }

    const systemPrompt = `
      Ты - эксперт по созданию контента для социальных сетей.
      Твоя задача - улучшить предоставленный текст согласно инструкциям.
      
      Правила:
      1. Сохраняй HTML разметку, если она присутствует в тексте. Сохраняй все форматирование.
      2. Не придумывай новый контент, если это не требуется в инструкциях.
      3. Сохраняй стиль и тон исходного текста, если в инструкциях не указано иное.
      4. Адаптируй текст под указанную социальную сеть, если она указана.
      5. Отвечай только улучшенным текстом, без дополнительных комментариев.
    `;

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `Вот исходный текст, который нужно улучшить:
        
        ${text}
        
        Вот инструкции по улучшению:
        
        ${prompt}
        
        Пожалуйста, улучши текст, сохраняя HTML форматирование.`
      }
    ];

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          model: this.defaultModel,
          max_tokens: 4096,
          messages,
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      // Извлекаем текст из ответа
      if (response.data && response.data.content && response.data.content.length > 0) {
        const improvedText = response.data.content[0].text;
        return improvedText || text;
      }

      return text;
    } catch (error) {
      console.error('Ошибка при улучшении текста через Claude AI:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        console.error('Claude API response error:', error.response.data);
        throw new Error(`Ошибка Claude API: ${error.response.status} - ${error.response.data.error?.message || 'Неизвестная ошибка'}`);
      }
      
      throw new Error('Не удалось улучшить текст через Claude AI. Повторите попытку позже.');
    }
  }

  /**
   * Генерирует текст с помощью Claude AI
   * @param prompt Инструкции для генерации текста
   * @param userId ID пользователя для получения API ключа
   * @param authToken Токен авторизации пользователя
   * @returns Сгенерированный текст
   */
  async generateText(prompt: string, userId: string, authToken?: string): Promise<string> {
    const apiKey = await this.getApiKey(userId, authToken);
    if (!apiKey) {
      throw new Error('API ключ Claude AI не найден. Пожалуйста, добавьте ключ в настройках API.');
    }

    const systemPrompt = `
      Ты - эксперт по созданию контента для социальных сетей.
      Создавай контент, который соответствует запросу пользователя.
      
      Контент должен быть:
      1. Привлекательным и интересным для целевой аудитории
      2. Оптимизированным для социальных сетей (правильная длина, структура)
      3. Форматированным с HTML-тегами для лучшей читаемости (заголовки, списки, выделения)
      4. Без лишнего вступления или заключения - сразу по делу
      
      Всегда добавляй:
      - Заголовок с тегом <h2>
      - Структурированный контент с подзаголовками при необходимости
      - Списки, если это уместно
      - Выделение ключевых мыслей полужирным шрифтом
      - Эмодзи для повышения визуальной привлекательности 📱✨
    `;

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          model: this.defaultModel,
          max_tokens: 4096,
          messages,
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      // Извлекаем текст из ответа
      if (response.data && response.data.content && response.data.content.length > 0) {
        return response.data.content[0].text || '';
      }

      return '';
    } catch (error) {
      console.error('Ошибка при генерации текста через Claude AI:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        console.error('Claude API response error:', error.response.data);
        throw new Error(`Ошибка Claude API: ${error.response.status} - ${error.response.data.error?.message || 'Неизвестная ошибка'}`);
      }
      
      throw new Error('Не удалось сгенерировать текст через Claude AI. Повторите попытку позже.');
    }
  }

  /**
   * Получает API ключ для Claude AI из сервиса API ключей
   * @param userId ID пользователя
   * @param authToken Токен авторизации
   * @returns API ключ или null, если ключ не найден
   */
  private async getApiKey(userId: string, authToken?: string): Promise<string | null> {
    const formattedToken = authToken ? formatAuthToken(authToken) : undefined;
    return this.apiKeyService.getApiKey(userId, 'claude', formattedToken);
  }
}

// Импортируем сервис API ключей для использования в сервисе Claude
import { apiKeyService } from './api-keys';

// Создаем и экспортируем экземпляр сервиса Claude
export const claudeService = new ClaudeService(apiKeyService);