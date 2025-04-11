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
   * Создает экземпляр Google Generative AI с правильными настройками
   * @param apiVersion Версия API (v1 или v1beta)
   * @returns Экземпляр GoogleGenerativeAI
   */
  private createGenAI(apiVersion: 'v1' | 'v1beta' = 'v1'): GoogleGenerativeAI {
    // Для исправления ошибки типизации в библиотеке
    const apiConfig = apiVersion === 'v1beta' ? { apiVersion } : undefined;
    
    // Создаем экземпляр GoogleGenerativeAI с указанной версией API
    return new GoogleGenerativeAI(this.apiKey, apiConfig);
  }
  
  /**
   * Проверяет валидность API ключа Gemini
   * @returns true если ключ валидный, false если нет
   */
  async testApiKey(): Promise<boolean> {
    try {
      logger.log('[gemini-service] Testing Gemini API key with stable model...', 'gemini');
      
      // Используем созданную функцию для инициализации API
      const genAI = this.createGenAI();
      
      // Используем стабильную модель для проверки ключа
      const PRO_MODEL = 'gemini-1.5-pro';
      const model = genAI.getGenerativeModel({ model: PRO_MODEL });
      const result = await model.generateContent('Hello, world!');
      
      logger.log('[gemini-service] Successfully tested API key with model: ' + PRO_MODEL, 'gemini');
      return result !== null;
    } catch (error) {
      logger.error('[gemini-service] Error testing API key:', error);
      
      // Расширенное логирование ошибки
      if (error instanceof Error) {
        logger.error(`[gemini-service] Detailed error testing API key: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      }
      
      return false;
    }
  }
  
  /**
   * Определяет подходящую модель Gemini и API версию на основе запроса пользователя
   * @param model Запрошенная модель
   * @returns Выбранная модель и необходимая версия API
   */
  private getSelectedModelInfo(model: string): { modelName: string; apiVersion: 'v1' | 'v1beta' } {
    // Актуальные модели Gemini (обновлены в апреле 2025 года)
    const PRO_MODEL_1_5 = 'gemini-1.5-pro'; // Стабильная модель Pro 1.5
    const FLASH_MODEL_1_5 = 'gemini-1.5-flash'; // Стабильная модель Flash 1.5
    const PRO_MODEL_2_5 = 'gemini-2.5-pro-preview-03-25'; // Preview модель Gemini 2.5 Pro
    const PRO_MODEL_2_5_EXP = 'gemini-2.5-pro-exp-03-25'; // Экспериментальная версия Gemini 2.5 Pro
    const FLASH_MODEL_2_0 = 'gemini-2.0-flash'; // Стабильная модель Gemini 2.0 Flash
    const FLASH_MODEL_2_0_EXP = 'gemini-2.0-flash-exp'; // Экспериментальная модель Gemini 2.0 Flash
    
    // Gemini 2.5 Flash еще не выпущена для публичного API
    // По результатам проверки в официальной документации 
    // https://ai.google.dev/models/gemini
    
    // Маппинг пользовательских моделей на фактические
    const modelMapping: {[key: string]: { name: string; beta: boolean }} = {
      'gemini': { name: PRO_MODEL_1_5, beta: false }, // По умолчанию используем 1.5 Pro
      'gemini-pro': { name: PRO_MODEL_1_5, beta: false },
      'gemini-2.5-pro': { name: PRO_MODEL_2_5, beta: true }, // Используем preview версию Gemini 2.5 Pro (beta)
      'gemini-2.5-pro-exp': { name: PRO_MODEL_2_5_EXP, beta: true }, // Экспериментальная версия
      'gemini-1.5-pro': { name: PRO_MODEL_1_5, beta: false },
      'gemini-1.5-flash': { name: FLASH_MODEL_1_5, beta: false },
      'gemini-2.0-flash': { name: FLASH_MODEL_2_0, beta: false }, // Gemini 2.0 Flash (стабильная)
      'gemini-2.0-flash-exp': { name: FLASH_MODEL_2_0_EXP, beta: true }, // Gemini 2.0 Flash Exp (экспериментальная)
      'gemini-2.5-flash': { name: FLASH_MODEL_2_0, beta: false } // Fallback к стабильной 2.0 Flash
    };
    
    // Получаем модель из маппинга или используем Pro модель 1.5 по умолчанию
    const defaultModel = { name: PRO_MODEL_1_5, beta: false };
    const mappedModel = modelMapping[model] || defaultModel;
    
    // Определяем версию API на основе типа модели
    const apiVersion = mappedModel.beta ? 'v1beta' : 'v1';
    
    // Регистрируем в логе, какую модель запросил пользователь
    logger.log(`[gemini-service] Requested model ${model}, using ${mappedModel.name} with API ${apiVersion}`, 'gemini');
    
    // Возвращаем информацию о модели
    return { 
      modelName: mappedModel.name,
      apiVersion
    };
  }
  
  /**
   * Определяет подходящую модель Gemini на основе запроса пользователя
   * @param model Запрошенная модель
   * @returns Выбранная модель
   * @deprecated Используйте getSelectedModelInfo вместо этого метода
   */
  private getSelectedModel(model: string): string {
    return this.getSelectedModelInfo(model).modelName;
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
      
      // Выбираем подходящую модель и версию API
      const { modelName: selectedModel, apiVersion } = this.getSelectedModelInfo(model);
      
      // Создаем генеративную модель через метод createGenAI с правильной версией API
      const genAI = this.createGenAI(apiVersion);
      const geminiModel = genAI.getGenerativeModel({ model: selectedModel });
      
      // Подготавливаем инструкцию с явным указанием не добавлять техническую информацию
      const instruction = `${prompt}

Исходный текст:
"""${text}"""

Важно: дай ТОЛЬКО улучшенный текст БЕЗ вводных фраз, технической информации и метаданных.
Не добавляй префиксы вроде "Улучшенный текст:" и подобные.
Не нужно добавлять комментарии о том, что было изменено.
Не нужно писать "Вот улучшенная версия" и т.п.
Верни ТОЛЬКО финальный отредактированный текст.`;
      
      // Генерируем улучшенный текст
      const result = await geminiModel.generateContent(instruction);
      const response = result.response;
      const improvedText = response.text();
      
      logger.log('[gemini-service] Text improvement successful with model ' + selectedModel, 'gemini');
      
      // Очищаем текст от возможных маркеров и технических деталей
      let cleanedText = improvedText
        .replace(/^(Улучшенный текст:|Вот улучшенный текст:|Улучшенная версия:|Результат:|Ответ:)/i, '')
        .replace(/^[ \t\n\r]+/, '') // Удаляем начальные пробелы и переносы строк
        .trim();
        
      return cleanedText;
    } catch (error) {
      logger.error('[gemini-service] Error improving text:', error);
      
      // Улучшенное логирование ошибок API для отладки проблем с моделями
      if (error instanceof Error) {
        logger.error(`[gemini-service] Detailed error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
        
        // Проверяем, является ли ошибка связанной с доступностью модели
        if (error.message && error.message.includes('Model not found')) {
          const requestedModel = this.getSelectedModel(model);
          logger.error(`[gemini-service] Model availability error: The model "${requestedModel}" is not available or doesn't exist`);
        }
      }
      
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
      
      // Выбираем подходящую модель и версию API
      const { modelName: selectedModel, apiVersion } = this.getSelectedModelInfo(model);
      
      // Создаем генеративную модель через метод createGenAI с правильной версией API
      const genAI = this.createGenAI(apiVersion);
      const geminiModel = genAI.getGenerativeModel({ model: selectedModel });
      
      // Дополняем промпт инструкциями не добавлять техническую информацию
      const enhancedPrompt = `${prompt}

Важно: дай ТОЛЬКО конечный текст контента БЕЗ вводных фраз, технической информации и метаданных.
Не добавляй префиксы или метки вроде "Ответ:", "Контент:" и т.п.
Не нужно добавлять комментарии о структуре или пояснения.
Верни ТОЛЬКО финальный отформатированный контент.`;
      
      // Генерируем контент
      const result = await geminiModel.generateContent(enhancedPrompt);
      const response = result.response;
      const generatedContent = response.text();
      
      logger.log(`[gemini-service] Content generation successful with model ${selectedModel}`, 'gemini');
      
      // Очищаем текст от возможных маркеров и технических деталей
      let cleanedContent = generatedContent
        .replace(/^(Контент:|Результат:|Готовый текст:|Ответ:|Вот готовый контент:|Вот результат:)/i, '')
        .replace(/^[ \t\n\r]+/, '') // Удаляем начальные пробелы и переносы строк
        .trim();
        
      return cleanedContent;
    } catch (error) {
      logger.error('[gemini-service] Error generating content:', error);
      
      // Улучшенное логирование ошибок API для отладки проблем с моделями
      if (error instanceof Error) {
        logger.error(`[gemini-service] Detailed error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
        
        // Проверяем, является ли ошибка связанной с доступностью модели
        if (error.message && error.message.includes('Model not found')) {
          const requestedModel = this.getSelectedModel(model);
          logger.error(`[gemini-service] Model availability error: The model "${requestedModel}" is not available or doesn't exist`);
        }
      }
      
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
      // Выбираем подходящую модель и версию API
      const { modelName: selectedModel, apiVersion } = this.getSelectedModelInfo(model);
      
      logger.log(`[gemini-service] Generating social content for platform: ${platform || 'general'}, using model: ${selectedModel} with API ${apiVersion}`, 'gemini');
      
      // Преобразуем ключевые слова в строку
      const keywordsText = keywords.join(', ');
      
      // Создаем генеративную модель через метод createGenAI с правильной версией API
      const genAI = this.createGenAI(apiVersion);
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
      
      // Добавляем инструкции для чистого вывода
      fullPrompt += `\n\nВажно: дай ТОЛЬКО готовый текст для публикации БЕЗ вводных фраз, технической информации и метаданных.
Не добавляй префиксы вроде "Контент для ${platform || 'социальных сетей'}:" и подобные.
Не нужно добавлять комментарии о формате, структуре или пояснения.
Верни ТОЛЬКО финальный текст для публикации.`;
      
      // Генерируем контент
      const result = await geminiModel.generateContent(fullPrompt);
      const response = result.response;
      const generatedContent = response.text();
      
      logger.log(`[gemini-service] Social content generation successful with model ${selectedModel}`, 'gemini');
      
      // Очищаем текст от возможных маркеров и технических деталей
      let cleanedContent = generatedContent
        .replace(/^(Пост для [^:]+:|Публикация для [^:]+:|Контент для [^:]+:|Результат:|Готовый текст:|Вот пост для [^:]+:|Вот публикация:|Публикация:|Пост:)/i, '')
        .replace(/^[ \t\n\r]+/, '') // Удаляем начальные пробелы и переносы строк
        .trim();
        
      return cleanedContent;
    } catch (error) {
      logger.error('[gemini-service] Error generating social content:', error);
      
      // Улучшенное логирование ошибок API для отладки проблем с моделями
      if (error instanceof Error) {
        logger.error(`[gemini-service] Detailed error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
        
        // Проверяем, является ли ошибка связанной с доступностью модели
        if (error.message && error.message.includes('Model not found')) {
          const requestedModel = this.getSelectedModel(model);
          logger.error(`[gemini-service] Model availability error: The model "${requestedModel}" is not available or doesn't exist`);
        }
      }
      
      throw new Error(`Ошибка при генерации социального контента с помощью Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}