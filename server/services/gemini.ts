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
   * Определяет подходящую модель Gemini на основе запроса пользователя
   * @param model Запрошенная модель
   * @returns Выбранная модель
   */
  private getSelectedModel(model: string): string {
    // Поддерживаемые модели Gemini (актуальны в 2025 году)
    const supportedModels = [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-ultra'
    ];

    // Маппинг новых моделей на поддерживаемые
    const modelMapping: {[key: string]: string} = {
      'gemini': 'gemini-pro',
      'gemini-2.5-pro': 'gemini-pro',
      'gemini-2.5-flash': 'gemini-pro',
      'gemini-1.5-pro': 'gemini-pro',
      'gemini-1.5-flash': 'gemini-pro'
    };

    // Получаем модель из маппинга или возвращаем исходную
    const mappedModel = modelMapping[model] || model;
    
    // Проверяем, поддерживается ли модель
    if (supportedModels.includes(mappedModel)) {
      logger.log(`[gemini-service] Using model ${mappedModel} (requested ${model})`, 'gemini');
      return mappedModel;
    } else {
      // Если модель не поддерживается, возвращаем стандартную
      logger.log(`[gemini-service] Model ${model} not supported, falling back to gemini-pro`, 'gemini');
      return 'gemini-pro';
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
      
      // Выбираем подходящую модель
      const selectedModel = this.getSelectedModel(model);
      
      // Создаем генеративную модель
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: selectedModel });
      
      // Подготавливаем инструкцию
      const instruction = `${prompt}\n\nИсходный текст:\n"""${text}"""\n\nУлучшенный текст:`;
      
      // Генерируем улучшенный текст
      const result = await geminiModel.generateContent(instruction);
      const response = result.response;
      const improvedText = response.text();
      
      logger.log('[gemini-service] Text improvement successful with model ' + selectedModel, 'gemini');
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
      
      // Выбираем подходящую модель
      const selectedModel = this.getSelectedModel(model);
      
      // Создаем генеративную модель
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: selectedModel });
      
      // Генерируем контент
      const result = await geminiModel.generateContent(prompt);
      const response = result.response;
      const generatedContent = response.text();
      
      logger.log(`[gemini-service] Content generation successful with model ${selectedModel}`, 'gemini');
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
      
      // Выбираем подходящую модель
      const selectedModel = this.getSelectedModel(model);
      
      // Преобразуем ключевые слова в строку
      const keywordsText = keywords.join(', ');
      
      // Создаем генеративную модель
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: selectedModel });
      
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
      
      logger.log(`[gemini-service] Social content generation successful with model ${selectedModel}`, 'gemini');
      return generatedContent;
    } catch (error) {
      logger.error('[gemini-service] Error generating social content:', error);
      throw new Error(`Ошибка при генерации социального контента с помощью Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}