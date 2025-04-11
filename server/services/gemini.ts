import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import * as logger from '../utils/logger';

interface ImproveTextParams {
  text: string;
  prompt: string;
  model?: string;
}

/**
 * Сервис для работы с Google Gemini API
 */
export class GeminiService {
  private apiKey: string;
  
  /**
   * Конструктор сервиса Gemini
   * @param apiKey API ключ Gemini
   */
  constructor({ apiKey }: { apiKey: string }) {
    this.apiKey = apiKey;
  }
  
  /**
   * Проверяет валидность API ключа Gemini
   * @returns true если ключ валидный, false если нет
   */
  async testApiKey(): Promise<boolean> {
    try {
      // Создаем экземпляр Google Generative AI с API ключом
      const genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Простой запрос для проверки ключа
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent('Hello, world!');
      
      return result !== null;
    } catch (error) {
      logger.error('[gemini-service] Error testing API key:', error);
      return false;
    }
  }
  
  /**
   * Улучшает текст с помощью Gemini
   * @param params Параметры улучшения текста
   * @returns Улучшенный текст
   */
  async improveText(params: ImproveTextParams): Promise<string> {
    const { text, prompt, model = 'gemini-pro' } = params;
    
    try {
      logger.log(`[gemini-service] Improving text with model: ${model}`, 'gemini');
      
      // Создаем генеративную модель
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const genModel = genAI.getGenerativeModel({ model });
      
      // Определяем, содержит ли текст HTML-теги
      const containsHtml = /<[^>]+>/.test(text);
      
      // Формируем системный промпт и пользовательское сообщение
      let userPrompt = '';
      
      if (containsHtml) {
        userPrompt = `${prompt}\n\nВажно: текст содержит HTML разметку, которую нужно сохранить.\n\nВот текст для улучшения:\n\n${text}`;
      } else {
        userPrompt = `${prompt}\n\nВот текст для улучшения:\n\n${text}`;
      }
      
      // Получаем ответ от модели
      const result = await genModel.generateContent(userPrompt);
      const response = result.response;
      const improvedText = response.text();
      
      logger.log('[gemini-service] Successfully improved text', 'gemini');
      return improvedText;
    } catch (error) {
      logger.error('[gemini-service] Error improving text:', error);
      throw new Error(`Ошибка при улучшении текста с Gemini: ${(error as Error).message}`);
    }
  }
  
  /**
   * Обновляет API ключ
   * @param apiKey Новый API ключ
   */
  updateApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}

// Экспортируем экземпляр сервиса по умолчанию
export const geminiService = new GeminiService({ apiKey: process.env.GEMINI_API_KEY || '' });