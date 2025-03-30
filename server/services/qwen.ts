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
  content: string | any[]; // Поддержка мультимодальных сообщений
}

export class QwenService {
  private apiKey: string;
  // Поддерживаемые базовые URL для Qwen API
  private readonly baseUrl = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  private readonly compatModes = {
    dashscope: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    openai: 'https://api.openai.com/v1'
  };
  
  // Указываем активную конфигурацию API
  private apiMode: 'dashscope' | 'qwen' | 'openai' = 'dashscope';
  
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
      const model = options.model || 'qwen-plus';
      const temperature = options.temperature !== undefined ? options.temperature : 0.3;
      const max_tokens = options.max_tokens || 1000;
      const top_p = options.top_p !== undefined ? options.top_p : 0.9;
      
      // Проверяем, что API ключ установлен
      if (!this.apiKey || this.apiKey.trim() === '') {
        console.error('Qwen API key is not set');
        throw new Error('Qwen API ключ не установлен. Пожалуйста, добавьте API ключ в настройках пользователя.');
      }
      
      console.log(`Sending request to Qwen API (model: ${model}, temp: ${temperature})`);
      
      // Получаем активный URL API на основе режима
      const activeBaseUrl = this.compatModes[this.apiMode];
      
      // Добавляем подробное логирование
      console.log(`Using Qwen API URL: ${activeBaseUrl}/chat/completions (mode: ${this.apiMode})`);
      console.log(`Request payload: ${JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
        top_p,
        stop: options.stop || null
      }, null, 2)}`);
      
      const response = await axios.post(
        `${activeBaseUrl}/chat/completions`,
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
      
      console.log(`Successful response from Qwen API, status ${response.status}`);
      
      if (!response.data?.choices?.[0]?.message?.content) {
        console.error('Invalid response format from Qwen API:', response.data);
        throw new Error('Некорректный ответ от Qwen API. Пожалуйста, проверьте настройки или попробуйте позже.');
      }
      
      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('Error calling Qwen API:', error);
      
      // Проверяем, содержит ли сообщение об ошибке проблемы с API ключом
      if (error.response?.data?.error) {
        const errorMessage = error.response.data.error.message || error.response.data.error;
        
        if (typeof errorMessage === 'string' && 
           (errorMessage.includes('API key') || errorMessage.includes('authentication') || 
            errorMessage.includes('auth') || errorMessage.includes('token') || 
            error.response.status === 401 || error.response.status === 403)) {
          throw new Error('Недействительный API ключ Qwen. Пожалуйста, проверьте ключ в настройках пользователя.');
        }
      }
      
      // Если проблема с доступом к API
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error(`Не удалось подключиться к Qwen API (${this.baseUrl}). Пожалуйста, проверьте подключение к интернету и доступность сервиса.`);
      }
      
      throw new Error(`Ошибка при обращении к Qwen API: ${error.message || 'Неизвестная ошибка'}`);
    }
  }
  
  /**
   * Анализирует изображение с помощью Qwen-VL и возвращает структурированную информацию
   * @param imageUrl URL изображения для анализа
   * @param analysisType Тип анализа: 'basic', 'detailed', 'objects', 'text', 'sentiment'
   * @returns Структурированный результат анализа изображения
   */
  async analyzeImage(imageUrl: string, analysisType: 'basic' | 'detailed' | 'objects' | 'text' | 'sentiment' = 'detailed'): Promise<any> {
    try {
      if (!this.apiKey) {
        throw new Error('Qwen API ключ не установлен');
      }
      
      console.log(`[qwen] Начинаем анализ изображения: ${imageUrl.substring(0, 50)}...`);
      
      // Преобразование URL изображения в Base64, если это необходимо
      const imageData = await this.getImageAsBase64(imageUrl);
      
      // Шаблоны системных сообщений для разных типов анализа
      const systemPrompts = {
        basic: "Опиши что изображено на этой картинке. Дай краткое общее описание.",
        detailed: `Проанализируй изображение и предоставь детальную структурированную информацию в формате JSON со следующими полями:
          - description: общее описание изображения
          - objects: список основных объектов на изображении
          - colors: основные цвета в порядке преобладания
          - composition: описание композиции и расположения элементов
          - text: любой текст, видимый на изображении
          - mood: общее настроение или эмоциональный тон изображения
          - engagement_factors: элементы, которые могут привлечь внимание аудитории
          - recommendations: 3-5 рекомендаций для создания подобного контента`,
        objects: "Перечисли все объекты на изображении и их примерное расположение. Представь результат как JSON-массив объектов.",
        text: "Извлеки весь текст, видимый на изображении. Сохрани оригинальное форматирование и порядок текста.",
        sentiment: "Проанализируй эмоциональное воздействие этого изображения. Какие эмоции оно вызывает и почему? Оцени от 1 до 10 потенциальную вовлеченность аудитории."
      };
      
      // Формируем сообщения для API запроса
      const messages = [
        { 
          role: 'system', 
          content: systemPrompts[analysisType]
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Проанализируй это изображение:' },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ];
      
      console.log(`[qwen] Отправляем запрос на анализ изображения в Qwen-VL (тип анализа: ${analysisType})`);
      
      // Получаем активный URL API на основе режима
      const activeBaseUrl = this.compatModes[this.apiMode];
      
      // Проверяем наличие API ключа
      if (!this.apiKey || this.apiKey.trim() === '') {
        console.error('[qwen] Отсутствует API ключ для запроса к Qwen-VL API');
        throw new Error('Отсутствует API ключ для сервиса Qwen. Проверьте настройки в Directus.');
      }
      
      // Логируем параметры запроса
      console.log(`[qwen] Используем модель Qwen-VL Plus для анализа изображения`);
      console.log(`[qwen] Используем API URL: ${activeBaseUrl}/chat/completions`);
      console.log(`[qwen] Длина API ключа: ${this.apiKey.length} символов`);
      console.log(`[qwen] Первые 5 символов ключа: ${this.apiKey.substring(0, 5)}...`);
      
      try {
        // Проверяем доступность URL изображения, прежде чем отправлять его в API
        try {
          // Отправляем HEAD запрос, чтобы проверить доступность изображения
          await axios.head(imageUrl, { timeout: 10000 });
        } catch (headError) {
          console.error(`[qwen] Ошибка проверки доступности изображения: ${imageUrl}`, headError);
          console.log(`[qwen] Продолжаем, так как изображение может быть доступно через GET запрос...`);
        }
        
        // Отправляем запрос к Qwen-VL API с дополнительной обработкой ошибок
        console.log(`[qwen] Выполняем POST запрос к ${activeBaseUrl}/chat/completions`);
        const response = await axios.post(
          `${activeBaseUrl}/chat/completions`,
          {
            model: 'qwen-vl-plus',  // Используем мультимодальную модель по документации Alibaba Cloud
            messages: messages,
            temperature: 0.2, // Низкая температура для более точных результатов
            max_tokens: 1500, // Достаточно для подробного анализа
            response_format: { type: 'json_object' } // Запрашиваем ответ в формате JSON
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000 // Увеличиваем таймаут до 60 секунд
          }
        );
      
      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Некорректный ответ от Qwen-VL API');
      }
      
      // Обрабатываем ответ и преобразуем его в структурированный JSON, если необходимо
      let result = response.data.choices[0].message.content;
      
      // Если ответ в виде JSON-строки, преобразуем в объект
      if (typeof result === 'string' && analysisType !== 'basic' && analysisType !== 'text') {
        try {
          // Извлекаем JSON из текста ответа, если он окружен другим текстом
          const jsonMatch = result.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          } else {
            result = JSON.parse(result);
          }
        } catch (e) {
          console.warn('[qwen] Не удалось преобразовать ответ в JSON:', e);
          // Оставляем как есть, если не удалось преобразовать
        }
      }
      
      console.log('[qwen] Анализ изображения успешно получен от Qwen-VL');
      return result;
    } catch (error) {
      console.error('[qwen] Ошибка при анализе изображения с помощью Qwen-VL:', error);
      throw error;
    }
  }
  
  /**
   * Получает изображение по URL и преобразует его в Base64 для отправки в API
   * @param imageUrl URL изображения
   * @returns Строка с данными изображения в формате data URL
   */
  private async getImageAsBase64(imageUrl: string): Promise<string> {
    try {
      // Если URL уже в формате data:image
      if (imageUrl.startsWith('data:image')) {
        return imageUrl;
      }
      
      console.log(`[qwen] Получаем изображение по URL: ${imageUrl.substring(0, 50)}...`);
      
      try {
        // Получаем изображение через axios
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        
        // Определяем тип изображения из заголовков ответа
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        // Преобразуем в Base64
        const base64 = Buffer.from(response.data).toString('base64');
        const dataUrl = `data:${contentType};base64,${base64}`;
        
        console.log(`[qwen] Изображение успешно преобразовано в Base64 (длина: ${dataUrl.length} символов)`);
        return dataUrl;
      } catch (getError) {
        console.error('[qwen] Ошибка при получении изображения через GET:', getError);
        
        // Если URL содержит прокси в нашем проекте, пробуем получить прямой URL
        if (imageUrl.includes('/api/proxy-image')) {
          const urlParams = new URL(imageUrl).searchParams;
          const originalUrl = urlParams.get('url');
          
          if (originalUrl) {
            console.log(`[qwen] Пробуем получить изображение по оригинальному URL: ${originalUrl.substring(0, 50)}...`);
            
            try {
              // Пытаемся обратиться к оригинальному URL
              const directResponse = await axios.get(originalUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
              });
              
              const directContentType = directResponse.headers['content-type'] || 'image/jpeg';
              const directBase64 = Buffer.from(directResponse.data).toString('base64');
              const directDataUrl = `data:${directContentType};base64,${directBase64}`;
              
              console.log(`[qwen] Изображение успешно получено по оригинальному URL (длина: ${directDataUrl.length} символов)`);
              return directDataUrl;
            } catch (directError) {
              console.error('[qwen] Ошибка при получении изображения по оригинальному URL:', directError);
              throw new Error(`Не удалось получить изображение ни через прокси, ни напрямую: ${directError instanceof Error ? directError.message : 'неизвестная ошибка'}`);
            }
          }
        }
        
        throw getError;
      }
    } catch (error) {
      console.error('[qwen] Ошибка при получении изображения по URL:', error);
      throw new Error(`Не удалось получить изображение по URL: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
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

    const userContent = `Ключевые слова: ${keywords.join(', ')}
Темы для раскрытия: ${topics.join(', ')}

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
    } catch (error: any) {
      console.error('Error generating social content with Qwen:', error);
      const errorMessage = error.message || 'Неизвестная ошибка при генерации контента';
      log(`Qwen генерация контента не удалась: ${errorMessage}`, 'qwen');
      
      // Форматируем сообщение об ошибке для более понятного отображения пользователю
      if (errorMessage.includes('API ключ')) {
        throw new Error(`Проблема с API ключом Qwen: ${errorMessage}`);
      } else if (errorMessage.includes('подключиться')) {
        throw new Error('Не удалось подключиться к Qwen API. Проверьте соединение или доступность сервиса.');
      } else {
        throw new Error(`Ошибка при генерации контента через Qwen: ${errorMessage}`);
      }
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
      console.log('[qwen] Initializing Qwen service for user', userId);
      
      // Используем централизованную систему API ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'qwen', authToken);
      
      if (apiKey) {
        const keyPreview = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 5);
        console.log(`[qwen] API key successfully obtained from API Key Service: ${keyPreview} (длина ключа: ${apiKey.length})`);
        this.updateApiKey(apiKey);
        log('[qwen] API key successfully obtained from API Key Service', 'qwen');
        return true;
      } else {
        console.log('[qwen] API key not found for user', userId);
        console.log('[qwen] Checking fallback environment variable QWEN_API_KEY');
        
        // Пробуем использовать ключ из переменных окружения как резервный вариант
        const envApiKey = process.env.QWEN_API_KEY;
        if (envApiKey && envApiKey.trim() !== '') {
          console.log('[qwen] Using API key from environment variable QWEN_API_KEY');
          this.updateApiKey(envApiKey);
          log('[qwen] Using API key from environment variable QWEN_API_KEY', 'qwen');
          return true;
        }
        
        log('[qwen] API key not found in user settings or environment variables', 'qwen');
        console.warn('[qwen] Не найден API ключ ни в настройках пользователя, ни в переменных окружения');
        return false;
      }
    } catch (error) {
      console.error('[qwen] Error initializing Qwen service:', error);
      
      // Более подробное логирование ошибки
      if ('response' in (error as any)) {
        const axiosError = error as any;
        console.error('[qwen] Error details:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          message: axiosError.message
        });
      }
      
      log(`[qwen] Error initializing Qwen service: ${error instanceof Error ? error.message : 'unknown error'}`, 'qwen');
      return false;
    }
  }
}

export const qwenService = new QwenService({
  apiKey: ''
});