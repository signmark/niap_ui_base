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
    try {
      logger.log(`[gemini-service] Creating Gemini API client with version ${apiVersion}`, 'gemini');
      
      // Для указания версии API (v1 или v1beta)
      // Используем вложенное свойство apiOptions.apiVersion по документации Google
      const apiConfig = apiVersion === 'v1beta' 
        ? { apiOptions: { apiVersion: 'v1beta' } } 
        : undefined;
      
      // Создаем экземпляр с учетом выбранной версии API (v1 или v1beta)
      // @ts-ignore - Игнорируем ошибку типов, так как библиотека поддерживает второй параметр
      // с apiOptions.apiVersion, даже если это не отражено в типах
      return new GoogleGenerativeAI(this.apiKey, apiConfig);
    } catch (error) {
      // Если версия API не поддерживается, откатываемся к стандартной
      logger.error(`[gemini-service] Error creating Gemini API with version ${apiVersion}, falling back to v1:`, error);
      return new GoogleGenerativeAI(this.apiKey);
    }
  }
  
  /**
   * Проверяет валидность API ключа Gemini
   * @returns true если ключ валидный, false если нет
   */
  async testApiKey(): Promise<boolean> {
    try {
      logger.log('[gemini-service] Testing Gemini API key with stable model...', 'gemini');
      
      // Используем созданную функцию для инициализации стандартного v1 API (без бета)
      const genAI = this.createGenAI('v1');
      
      // Используем гарантированно стабильную модель для проверки ключа
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
        
        // Специальная обработка для недействительного ключа или проблем с API
        if (error.message && (
          error.message.includes('API key not valid') || 
          error.message.includes('Invalid API key') || 
          error.message.includes('Authentication failed')
        )) {
          logger.error('[gemini-service] Invalid API key detected');
        }
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
    const FLASH_MODEL_2_0 = 'gemini-2.0-flash'; // Стабильная модель Gemini 2.0 Flash
    const PRO_MODEL_2_0 = 'gemini-2.0-pro'; // Стабильная модель Pro 2.0
    const PRO_MODEL_2_5 = 'gemini-2.5-pro-preview-03-25'; // Preview модель Gemini 2.5 Pro
    
    // Только рабочие модели без v1beta API
    // По результатам проверки в официальной документации 
    // https://ai.google.dev/models/gemini
    
    // Маппинг пользовательских моделей на фактические
    // Данные получены из официальной документации Google AI, актуально на апрель 2025
    const modelMapping: {[key: string]: { name: string; beta: boolean }} = {
      // Стабильные модели (подтверждено документацией)
      'gemini': { name: PRO_MODEL_1_5, beta: false }, // По умолчанию используем 1.5 Pro
      'gemini-pro': { name: PRO_MODEL_1_5, beta: false },
      'gemini-1.5-pro': { name: PRO_MODEL_1_5, beta: false }, // Стабильная модель
      'gemini-1.5-flash': { name: FLASH_MODEL_1_5, beta: false }, // Стабильная модель
      'gemini-1.5-flash-8b': { name: 'gemini-1.5-flash-8b', beta: false }, // Стабильная модель
      'gemini-2.0-flash-001': { name: 'gemini-2.0-flash-001', beta: false }, // Стабильная модель
      'gemini-2.0-flash-lite-001': { name: 'gemini-2.0-flash-lite-001', beta: false }, // Стабильная модель
      
      // Модели, которые ранее работали в проекте (сохраняем предыдущие настройки)
      'gemini-2.0-pro': { name: PRO_MODEL_2_0, beta: false }, // Работала с v1 API
      'gemini-2.0-flash': { name: FLASH_MODEL_2_0, beta: false }, // Работала с v1 API
      
      // Preview и экспериментальные модели
      'gemini-2.5-pro-preview-03-25': { name: PRO_MODEL_2_5, beta: true }, // Preview модель
      'gemini-2.5-pro-exp-03-25': { name: 'gemini-2.5-pro-exp-03-25', beta: true }, // Экспериментальная
      'gemini-2.0-flash-exp': { name: 'gemini-2.0-flash-exp', beta: true }, // Экспериментальная
      'gemini-2.0-flash-exp-image-generation': { name: 'gemini-2.0-flash-exp-image-generation', beta: true }, // Экспериментальная
      'gemini-2.0-flash-thinking-exp-01-21': { name: 'gemini-2.0-flash-thinking-exp-01-21', beta: true }, // Экспериментальная
      'gemini-2.0-flash-live-001': { name: 'gemini-2.0-flash-live-001', beta: true }, // Preview
      
      // Старые версии моделей (все с суффиксами и прочие) - предполагаем, что beta
      'gemini-1.5-flash-001': { name: 'gemini-1.5-flash-001', beta: true },
      'gemini-1.5-flash-002': { name: 'gemini-1.5-flash-002', beta: true },
      'gemini-1.5-flash-latest': { name: 'gemini-1.5-flash-latest', beta: true },
      'gemini-1.5-flash-8b-001': { name: 'gemini-1.5-flash-8b-001', beta: true },
      'gemini-1.5-flash-8b-exp-0827': { name: 'gemini-1.5-flash-8b-exp-0827', beta: true },
      'gemini-1.5-flash-8b-exp-0924': { name: 'gemini-1.5-flash-8b-exp-0924', beta: true },
      'gemini-1.5-flash-8b-latest': { name: 'gemini-1.5-flash-8b-latest', beta: true },
      'gemini-1.5-pro-001': { name: 'gemini-1.5-pro-001', beta: true },
      'gemini-1.5-pro-002': { name: 'gemini-1.5-pro-002', beta: true },
      'gemini-1.5-pro-exp-0801': { name: 'gemini-1.5-pro-exp-0801', beta: true },
      'gemini-1.5-pro-exp-0827': { name: 'gemini-1.5-pro-exp-0827', beta: true },
      'gemini-1.5-pro-latest': { name: 'gemini-1.5-pro-latest', beta: true },
      'gemini-1.0-pro': { name: 'gemini-1.0-pro', beta: true },
      'gemini-1.0-pro-001': { name: 'gemini-1.0-pro-001', beta: true },
      'gemini-1.0-pro-latest': { name: 'gemini-1.0-pro-latest', beta: true },
      'gemini-1.0-pro-vision-001': { name: 'gemini-1.0-pro-vision-001', beta: true },
      'gemini-1.0-pro-vision-latest': { name: 'gemini-1.0-pro-vision-latest', beta: true },
      'gemini-ultra-vision-001': { name: 'gemini-ultra-vision-001', beta: true },
      'gemini-pro-vision': { name: 'gemini-pro-vision', beta: true }
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
    
    // Добавляем отладочную информацию
    console.log('[DEBUG-GEMINI] improveText вызван с параметрами:', {
      textLength: text?.length || 0,
      promptLength: prompt?.length || 0,
      model
    });
    
    try {
      logger.log(`[gemini-service] Improving text with model: ${model}`, 'gemini');
      
      // Выбираем подходящую модель и версию API
      const { modelName: selectedModel, apiVersion } = this.getSelectedModelInfo(model);
      
      // Логируем выбранную модель и версию API для диагностики
      logger.log(`[gemini-service] Selected model: ${selectedModel}, API version: ${apiVersion}`, 'gemini');
      console.log(`[DEBUG-GEMINI] Выбрана модель ${selectedModel} с версией API ${apiVersion}`);
      
      try {
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
      } catch (modelError) {
        // Если бета-модель недоступна, пробуем использовать стабильную модель
        if (apiVersion === 'v1beta' && modelError instanceof Error) {
          logger.error(`[gemini-service] Beta model error: ${modelError.message}. Falling back to stable model`, 'gemini');
          
          // Используем стабильную модель Gemini 1.5 Pro
          const stableModel = 'gemini-1.5-pro';
          const fallbackGenAI = this.createGenAI('v1'); // Всегда используем v1 для fallback
          const fallbackGeminiModel = fallbackGenAI.getGenerativeModel({ model: stableModel });
          
          // Используем тот же промпт для стабильной модели
          const instruction = `${prompt}

Исходный текст:
"""${text}"""

Важно: дай ТОЛЬКО улучшенный текст БЕЗ вводных фраз, технической информации и метаданных.
Не добавляй префиксы вроде "Улучшенный текст:" и подобные.
Не нужно добавлять комментарии о том, что было изменено.
Не нужно писать "Вот улучшенная версия" и т.п.
Верни ТОЛЬКО финальный отредактированный текст.`;
          
          // Генерируем контент с резервной моделью
          logger.log(`[gemini-service] Retrying with stable model ${stableModel}`, 'gemini');
          const fallbackResult = await fallbackGeminiModel.generateContent(instruction);
          const fallbackResponse = fallbackResult.response;
          const fallbackText = fallbackResponse.text();
          
          logger.log(`[gemini-service] Successfully generated content with fallback model ${stableModel}`, 'gemini');
          
          // Очищаем текст так же, как и выше
          const cleanedFallbackText = fallbackText
            .replace(/^(Улучшенный текст:|Вот улучшенный текст:|Улучшенная версия:|Результат:|Ответ:)/i, '')
            .replace(/^[ \t\n\r]+/, '') // Удаляем начальные пробелы и переносы строк
            .trim();
            
          return cleanedFallbackText;
        } else {
          // Если это не ошибка бета-модели или fallback не сработал, пробрасываем исключение дальше
          throw modelError;
        }
      }
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
      
      // Логируем выбранную модель и версию API для диагностики
      logger.log(`[gemini-service] Selected model: ${selectedModel}, API version: ${apiVersion}`, 'gemini');
      
      try {
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
      } catch (modelError) {
        // Если бета-модель недоступна, пробуем использовать стабильную модель
        if (apiVersion === 'v1beta' && modelError instanceof Error) {
          logger.error(`[gemini-service] Beta model error: ${modelError.message}. Falling back to stable model`, 'gemini');
          
          // Используем стабильную модель Gemini 1.5 Pro
          const stableModel = 'gemini-1.5-pro';
          const fallbackGenAI = this.createGenAI('v1'); // Всегда используем v1 для fallback
          const fallbackGeminiModel = fallbackGenAI.getGenerativeModel({ model: stableModel });
          
          // Используем тот же промпт для стабильной модели
          const enhancedPrompt = `${prompt}

Важно: дай ТОЛЬКО конечный текст контента БЕЗ вводных фраз, технической информации и метаданных.
Не добавляй префиксы или метки вроде "Ответ:", "Контент:" и т.п.
Не нужно добавлять комментарии о структуре или пояснения.
Верни ТОЛЬКО финальный отформатированный контент.`;
          
          // Генерируем контент с резервной моделью
          logger.log(`[gemini-service] Retrying content generation with stable model ${stableModel}`, 'gemini');
          const fallbackResult = await fallbackGeminiModel.generateContent(enhancedPrompt);
          const fallbackResponse = fallbackResult.response;
          const fallbackContent = fallbackResponse.text();
          
          logger.log(`[gemini-service] Successfully generated content with fallback model ${stableModel}`, 'gemini');
          
          // Очищаем текст так же, как и выше
          const cleanedFallbackContent = fallbackContent
            .replace(/^(Контент:|Результат:|Готовый текст:|Ответ:|Вот готовый контент:|Вот результат:)/i, '')
            .replace(/^[ \t\n\r]+/, '') // Удаляем начальные пробелы и переносы строк
            .trim();
            
          return cleanedFallbackContent;
        } else {
          // Если это не ошибка бета-модели или fallback не сработал, пробрасываем исключение дальше
          throw modelError;
        }
      }
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
      
      // Логируем выбранную модель и версию API для диагностики
      logger.log(`[gemini-service] Generating social content for platform: ${platform || 'general'}, using model: ${selectedModel} with API ${apiVersion}`, 'gemini');
      
      // Преобразуем ключевые слова в строку
      const keywordsText = keywords.join(', ');
      
      try {
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
      } catch (modelError) {
        // Если бета-модель недоступна, пробуем использовать стабильную модель
        if (apiVersion === 'v1beta' && modelError instanceof Error) {
          logger.error(`[gemini-service] Beta model error in social content: ${modelError.message}. Falling back to stable model`, 'gemini');
          
          // Используем стабильную модель Gemini 1.5 Pro
          const stableModel = 'gemini-1.5-pro';
          const fallbackGenAI = this.createGenAI('v1'); // Всегда используем v1 для fallback
          const fallbackGeminiModel = fallbackGenAI.getGenerativeModel({ model: stableModel });
          
          // Формируем тот же промпт для стабильной модели
          let fallbackPrompt = prompt;
          
          // Добавляем информацию о платформе и тоне
          if (platform) {
            fallbackPrompt += `\n\nСоздай контент для платформы: ${platform}`;
          }
          
          if (tone) {
            fallbackPrompt += `\n\nИспользуй следующий тон: ${tone}`;
          }
          
          // Добавляем ключевые слова
          fallbackPrompt += `\n\nИспользуй следующие ключевые слова: ${keywordsText}`;
          
          // Добавляем инструкции для чистого вывода
          fallbackPrompt += `\n\nВажно: дай ТОЛЬКО готовый текст для публикации БЕЗ вводных фраз, технической информации и метаданных.
Не добавляй префиксы вроде "Контент для ${platform || 'социальных сетей'}:" и подобные.
Не нужно добавлять комментарии о формате, структуре или пояснения.
Верни ТОЛЬКО финальный текст для публикации.`;
          
          // Генерируем контент с резервной моделью
          logger.log(`[gemini-service] Retrying social content generation with stable model ${stableModel}`, 'gemini');
          const fallbackResult = await fallbackGeminiModel.generateContent(fallbackPrompt);
          const fallbackResponse = fallbackResult.response;
          const fallbackContent = fallbackResponse.text();
          
          logger.log(`[gemini-service] Successfully generated social content with fallback model ${stableModel}`, 'gemini');
          
          // Очищаем текст так же, как и выше
          const cleanedFallbackContent = fallbackContent
            .replace(/^(Пост для [^:]+:|Публикация для [^:]+:|Контент для [^:]+:|Результат:|Готовый текст:|Вот пост для [^:]+:|Вот публикация:|Публикация:|Пост:)/i, '')
            .replace(/^[ \t\n\r]+/, '') // Удаляем начальные пробелы и переносы строк
            .trim();
            
          return cleanedFallbackContent;
        } else {
          // Если это не ошибка бета-модели или fallback не сработал, пробрасываем исключение дальше
          throw modelError;
        }
      }
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