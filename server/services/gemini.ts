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
      
      // Простой запрос для проверки ключа с современной моделью
      // Используем gemini-1.5-flash как наиболее стабильную модель для тестирования
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent('Hello, world!');
      
      return result !== null;
    } catch (error) {
      // Проверяем конкретную ошибку региона
      const errorMessage = String(error);
      if (errorMessage.includes('User location is not supported for the API use')) {
        logger.error('[gemini-service] Ошибка доступа к API: ваш регион не поддерживается Gemini API.');
        logger.error('[gemini-service] Для доступа требуется VPN или сервер в поддерживаемом регионе.');
        logger.error('[gemini-service] Подробнее: https://ai.google.dev/available_regions');
      }
      
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
    const { text, prompt, model = 'gemini-1.5-flash' } = params;
    
    try {
      logger.log(`[gemini-service] Improving text with model: ${model}`, 'gemini');
      
      // Создаем генеративную модель
      const genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Параметры модели в зависимости от выбранной модели
      let generationConfig = {};
      
      // Для некоторых моделей может потребоваться особая настройка
      if (model === 'gemini-2.0-flash' || model === 'gemini-1.5-flash') {
        generationConfig = {
          temperature: 0.7,
          topP: 0.9,
          topK: 32
        };
      }
      
      // Создаем соответствующую модель
      const genModel = genAI.getGenerativeModel({ 
        model,
        generationConfig
      });
      
      // Определяем, содержит ли текст HTML-теги
      const containsHtml = /<[^>]+>/.test(text);
      
      // Формируем системный промпт и пользовательское сообщение
      let userPrompt = '';
      
      if (containsHtml) {
        userPrompt = `${prompt}\n\nВажно: 
1. Текст содержит HTML разметку, которую нужно сохранить.
2. Ответ должен содержать ТОЛЬКО улучшенный текст, без объяснений и кодовых блоков.
3. Не заключай ответ в кавычки, теги code или markdown-разметку.
4. Ответ должен начинаться сразу с первой буквы улучшенного текста.

Вот текст для улучшения:\n\n${text}`;
      } else {
        userPrompt = `${prompt}\n\nВажно: 
1. Ответ должен содержать ТОЛЬКО улучшенный текст, без объяснений и кодовых блоков.
2. Не заключай ответ в кавычки, теги code или markdown-разметку.
3. Ответ должен начинаться сразу с первой буквы улучшенного текста.

Вот текст для улучшения:\n\n${text}`;
      }
      
      // Получаем ответ от модели
      const result = await genModel.generateContent(userPrompt);
      const response = result.response;
      let improvedText = response.text();
      
      // Удаляем любую markdown-разметку и кодовые блоки, если они всё-таки появились
      improvedText = improvedText
        .replace(/^```[a-z]*\n/gm, '') // Удаляем открывающие маркеры кодовых блоков
        .replace(/```$/gm, '')         // Удаляем закрывающие маркеры кодовых блоков
        .replace(/^\s*```\s*$/gm, '')  // Удаляем строки с маркерами кодовых блоков
        .trim();                      // Удаляем лишние пробелы
      
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