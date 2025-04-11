import { GoogleGenerativeAI } from '@google/generative-ai';
import * as logger from '../utils/logger';

interface ImproveTextParams {
  text: string;
  prompt: string;
  model?: string;
}

interface GenerateSocialContentOptions {
  platform?: string;
  tone?: string;
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
  constructor(apiKey: string) {
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
      const geminiModel = genAI.getGenerativeModel({ model });
      
      // Подготавливаем инструкцию
      const instruction = `${prompt}\n\nИсходный текст:\n"""${text}"""\n\nУлучшенный текст:`;
      
      // Генерируем улучшенный текст
      const result = await geminiModel.generateContent(instruction);
      const response = result.response;
      const improvedText = response.text();
      
      logger.log('[gemini-service] Text improvement successful', 'gemini');
      return improvedText;
    } catch (error) {
      logger.error('[gemini-service] Error improving text:', error);
      throw new Error(`Ошибка при улучшении текста с помощью Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Генерирует контент с помощью Gemini
   * @param prompt Промпт для генерации
   * @param model Модель Gemini (по умолчанию gemini-pro)
   * @returns Сгенерированный контент
   */
  async generateContent(prompt: string, model = 'gemini-pro'): Promise<string> {
    try {
      logger.log(`[gemini-service] Generating content with model: ${model}`, 'gemini');
      
      // Создаем генеративную модель
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const geminiModel = genAI.getGenerativeModel({ model });
      
      // Генерируем контент
      const result = await geminiModel.generateContent(prompt);
      const response = result.response;
      const generatedContent = response.text();
      
      logger.log('[gemini-service] Content generation successful', 'gemini');
      return generatedContent;
    } catch (error) {
      logger.error('[gemini-service] Error generating content:', error);
      throw new Error(`Ошибка при генерации контента с помощью Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Генерирует социальный контент с помощью Gemini
   * @param keywords Ключевые слова
   * @param prompt Базовый промпт
   * @param options Дополнительные опции (платформа, тон, модель)
   * @returns Сгенерированный социальный контент
   */
  async generateSocialContent(
    keywords: string[],
    prompt: string,
    options: GenerateSocialContentOptions = {}
  ): Promise<string> {
    const { platform, tone, model = 'gemini-pro' } = options;
    
    try {
      logger.log(`[gemini-service] Generating social content for platform: ${platform || 'general'}, using model: ${model}`, 'gemini');
      
      // Преобразуем ключевые слова в строку
      const keywordsText = keywords.join(', ');
      
      // Создаем генеративную модель
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const geminiModel = genAI.getGenerativeModel({ model });
      
      // Формируем полный промпт
      let fullPrompt = prompt;
      
      // Добавляем информацию о платформе и тоне
      if (platform) {
        fullPrompt += `\n\nСоздай контент для платформы: ${platform}`;
      }
      
      if (tone) {
        fullPrompt += `\n\nИспользуй следующий тон: ${tone}`;
      }
      
      // Добавляем ключевые слова
      fullPrompt += `\n\nИспользуй следующие ключевые слова: ${keywordsText}`;
      
      // Генерируем контент
      const result = await geminiModel.generateContent(fullPrompt);
      const response = result.response;
      const generatedContent = response.text();
      
      logger.log('[gemini-service] Social content generation successful', 'gemini');
      return generatedContent;
    } catch (error) {
      logger.error('[gemini-service] Error generating social content:', error);
      throw new Error(`Ошибка при генерации социального контента с помощью Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}