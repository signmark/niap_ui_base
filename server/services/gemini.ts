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
   * @returns Экземпляр GoogleGenerativeAI
   */
  private createGenAI(): GoogleGenerativeAI {
    // Создаем экземпляр GoogleGenerativeAI (с API v1 по умолчанию)
    return new GoogleGenerativeAI(this.apiKey);
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
   * Определяет подходящую модель Gemini на основе запроса пользователя
   * @param model Запрошенная модель
   * @returns Выбранная модель
   */
  private getSelectedModel(model: string): string {
    // Актуальные модели Gemini (обновлены в апреле 2025 года)
    const PRO_MODEL_1_5 = 'gemini-1.5-pro'; // Современная модель Pro 1.5
    const FLASH_MODEL_1_5 = 'gemini-1.5-flash'; // Быстрая модель Flash 1.5
    const PRO_MODEL_2_5 = 'gemini-2.5-pro-preview-03-25'; // Preview модель Gemini 2.5 Pro
    
    // Маппинг пользовательских моделей на фактические
    const modelMapping: {[key: string]: string} = {
      'gemini': PRO_MODEL_1_5, // По умолчанию используем 1.5 Pro
      'gemini-pro': PRO_MODEL_1_5,
      'gemini-2.5-pro': PRO_MODEL_2_5, // Используем актуальную preview версию Gemini 2.5 Pro
      'gemini-1.5-pro': PRO_MODEL_1_5,
      'gemini-1.5-flash': FLASH_MODEL_1_5
    };
    
    // Получаем модель из маппинга или используем Pro модель 1.5 по умолчанию
    const mappedModel = modelMapping[model] || PRO_MODEL_1_5;
    
    // Регистрируем в логе, какую модель запросил пользователь
    logger.log(`[gemini-service] Requested model ${model}, using ${mappedModel}`, 'gemini');
    
    // Возвращаем модель
    return mappedModel;
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
      
      // Создаем генеративную модель через метод createGenAI
      const genAI = this.createGenAI();
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
      
      // Выбираем подходящую модель
      const selectedModel = this.getSelectedModel(model);
      
      // Создаем генеративную модель через метод createGenAI
      const genAI = this.createGenAI();
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
      // Выбираем подходящую модель
      const selectedModel = this.getSelectedModel(model);
      
      logger.log(`[gemini-service] Generating social content for platform: ${platform || 'general'}, using model: ${selectedModel}`, 'gemini');
      
      // Преобразуем ключевые слова в строку
      const keywordsText = keywords.join(', ');
      
      // Создаем генеративную модель через метод createGenAI
      const genAI = this.createGenAI();
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