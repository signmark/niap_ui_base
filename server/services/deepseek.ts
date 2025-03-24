import axios from 'axios';
import { apiKeyService } from './api-keys';
import { log } from '../utils/logger';

export interface DeepSeekConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class DeepSeekService {
  private apiKey: string;
  private readonly baseUrl = 'https://api.deepseek.com/v1';
  
  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey;
  }
  
  /**
   * Обновляет API ключ сервиса
   */
  updateApiKey(newApiKey: string): void {
    if (newApiKey && newApiKey.trim() !== '') {
      this.apiKey = newApiKey;
      console.log("DeepSeek API key updated from user settings");
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
   * Отправляет запрос на генерацию текста через DeepSeek API
   */
  async generateText(messages: DeepSeekMessage[], options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop?: string[];
  } = {}): Promise<string> {
    try {
      const model = options.model || 'deepseek-chat';
      const temperature = options.temperature !== undefined ? options.temperature : 0.3;
      const max_tokens = options.max_tokens || 1000;
      const top_p = options.top_p !== undefined ? options.top_p : 0.9;
      
      // Генерируем уникальный идентификатор для этого запроса (для логирования)
      const requestId = Math.random().toString(36).substring(2, 10);
      console.log(`[${requestId}] Начинаем запрос к DeepSeek API (model: ${model}, temp: ${temperature})`);
      
      // Логируем первые 100 символов первого сообщения пользователя (для диагностики)
      const userMessage = messages.find(m => m.role === 'user')?.content || '';
      console.log(`[${requestId}] Содержимое запроса (первые 100 символов): ${userMessage.substring(0, 100)}...`);
      
      // Проверяем, что API ключ установлен
      if (!this.apiKey || this.apiKey.trim() === '') {
        console.error(`[${requestId}] DeepSeek API key is not set`);
        throw new Error('DeepSeek API ключ не установлен. Пожалуйста, добавьте API ключ в настройках пользователя.');
      }
      
      console.log(`[${requestId}] Текущий API ключ DeepSeek (первые/последние 5 символов): ${this.apiKey.substring(0, 5)}...${this.apiKey.substring(this.apiKey.length - 5)}`);
      
      // Пробуем разные форматы ключей, так как они могут иметь разную структуру
      const keyFormats = [
        { format: 'original', key: this.apiKey },
        { format: 'without_bearer', key: this.apiKey.replace(/^Bearer\s+/i, '') },
        { format: 'with_bearer', key: this.apiKey.startsWith('Bearer ') ? this.apiKey : `Bearer ${this.apiKey}` },
        { format: 'with_sk', key: this.apiKey.startsWith('sk-') ? this.apiKey : `sk-${this.apiKey.replace(/^Bearer\s+/i, '')}` },
        { format: 'clean_sk', key: this.apiKey.replace(/^Bearer\s+/i, '').replace(/^sk-/i, '') }
      ];
      
      // Перебираем форматы ключей и пытаемся отправить запрос
      let lastError = null;
      
      for (const format of keyFormats) {
        try {
          console.log(`[${requestId}] Пробуем формат ключа: ${format.format}`);
          
          // Логируем первые/последние символы текущего ключа для диагностики
          const keyPreview = `${format.key.substring(0, 5)}...${format.key.substring(format.key.length - 5)}`;
          console.log(`[${requestId}] Ключ в формате ${format.format}: ${keyPreview}`);
          
          // Пробуем отправить запрос с текущим форматом ключа
          const startTime = Date.now();
          const response = await axios.post(
            `${this.baseUrl}/chat/completions`,
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
                'Authorization': format.format === 'original' || format.format === 'with_bearer' 
                  ? format.key  // Используем ключ как есть, если он уже начинается с Bearer
                  : `Bearer ${format.key}`, // Иначе добавляем префикс Bearer
                'Content-Type': 'application/json'
              },
              timeout: 30000 // 30 секунд таймаут
            }
          );
          
          const responseTime = Date.now() - startTime;
          console.log(`[${requestId}] Запрос выполнен за ${responseTime}ms`);
          
          // Проверяем, что структура ответа соответствует ожидаемой
          if (!response.data?.choices?.[0]?.message?.content) {
            console.error(`[${requestId}] Некорректная структура ответа:`, JSON.stringify(response.data).substring(0, 500));
            throw new Error('Некорректный формат ответа от DeepSeek API.');
          }
          
          const content = response.data.choices[0].message.content;
          
          console.log(`[${requestId}] DeepSeek API запрос успешен с форматом ключа: ${format.format}`);
          console.log(`[${requestId}] Получен ответ длиной ${content.length} символов. Первые 100: ${content.substring(0, 100)}...`);
          
          // Если запрос успешен, сохраняем рабочий формат ключа для использования в будущем
          if (format.format !== 'original') {
            console.log(`[${requestId}] Обновляем формат API ключа на ${format.format}`);
            this.apiKey = format.key;
          }
          
          return content;
        } catch (formatError: any) {
          // Если этот формат ключа не сработал, сохраняем ошибку и пробуем следующий формат
          console.error(`[${requestId}] Ошибка с форматом ключа ${format.format}:`, formatError.message);
          lastError = formatError;
          
          // Выводим детали ошибки для отладки
          if (formatError.response) {
            console.error(`[${requestId}] Детали ошибки DeepSeek API (${format.format}):`, 
              `Статус: ${formatError.response.status}`, 
              `Данные: ${JSON.stringify(formatError.response.data || {}).substring(0, 500)}`
            );
            
            // Если это явно ошибка ключа API, пробуем следующий формат
            const errorStatus = formatError.response.status;
            const errorData = formatError.response.data;
            
            if (errorStatus === 401 || errorStatus === 403 || 
                (errorData && (
                  (errorData.error && typeof errorData.error === 'string' && 
                   (errorData.error.includes('API key') || errorData.error.includes('auth'))) ||
                  (errorData.message && typeof errorData.message === 'string' && 
                   (errorData.message.includes('API key') || errorData.message.includes('auth')))
                ))) {
              console.log(`[${requestId}] Ошибка ключа API, пробуем другой формат`);
              continue;
            }
          } else if (formatError.request) {
            // Сетевая ошибка - запрос был отправлен, но ответа не получено
            console.error(`[${requestId}] Ошибка сети при запросе (${format.format}):`, formatError.message);
          } else {
            // Ошибка при настройке запроса
            console.error(`[${requestId}] Ошибка настройки запроса (${format.format}):`, formatError.message);
          }
        }
      }
      
      // Если все форматы ключей не сработали, выбрасываем последнюю ошибку
      if (lastError) {
        console.error(`[${requestId}] Все форматы API ключей DeepSeek не сработали:`, lastError.message);
        
        // Проверяем, содержит ли сообщение об ошибке информацию об недействительном ключе API
        if (lastError.response?.data?.error) {
          const errorMessage = typeof lastError.response.data.error === 'string' 
            ? lastError.response.data.error
            : (lastError.response.data.error.message || JSON.stringify(lastError.response.data.error));
          
          if (typeof errorMessage === 'string' && 
             (errorMessage.includes('API key') || errorMessage.includes('authentication') || 
              errorMessage.includes('auth') || errorMessage.includes('token') || 
              lastError.response.status === 401 || lastError.response.status === 403)) {
            throw new Error('Недействительный API ключ DeepSeek. Пожалуйста, проверьте и обновите ключ в настройках пользователя.');
          }
        }
        
        // Проверяем, не является ли ошибка сетевой
        if (lastError.code === 'ECONNREFUSED' || lastError.code === 'ECONNABORTED' || 
            lastError.code === 'ETIMEDOUT' || lastError.message.includes('timeout')) {
          throw new Error('Ошибка подключения к серверу DeepSeek API. Пожалуйста, проверьте соединение или попробуйте позже.');
        }
        
        throw new Error(`Ошибка при запросе к DeepSeek API: ${lastError.message}`);
      }
      
      // Этот код никогда не должен выполняться, но добавлен для типизации
      throw new Error('Непредвиденная ошибка при отправке запроса к DeepSeek API');
    } catch (error: any) {
      console.error('Критическая ошибка при вызове DeepSeek API:', error);
      
      // Проверяем, содержит ли сообщение об ошибке "Invalid API key"
      if (error.response?.data?.error) {
        const errorMessage = typeof error.response.data.error === 'string' 
          ? error.response.data.error
          : (error.response.data.error.message || JSON.stringify(error.response.data.error));
        
        if (typeof errorMessage === 'string' && 
           (errorMessage.includes('API key') || errorMessage.includes('authentication') || 
            errorMessage.includes('auth') || errorMessage.includes('token') || 
            error.response.status === 401 || error.response.status === 403)) {
          throw new Error('Недействительный API ключ DeepSeek. Пожалуйста, проверьте ключ в настройках пользователя.');
        }
      }
      
      // Перебрасываем ошибку, чтобы вызывающий код мог ее обработать
      throw error;
    }
  }
  
  /**
   * Генерирует ключевые слова для URL с помощью DeepSeek API
   * Улучшенная версия с подробным анализом структурированного контента
   */
  async generateKeywordsForUrl(url: string, content: string, requestId: string): Promise<any[]> {
    try {
      // Извлекаем домен из URL
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      console.log(`[${requestId}] Generating enhanced keywords with DeepSeek for domain: ${domain}, content length: ${content.length} chars`);
      
      const systemPrompt = `Ты эксперт по анализу контента сайтов. Твоя задача - проанализировать конкретное содержимое сайта и предложить ИСКЛЮЧИТЕЛЬНО релевантные ключевые слова, точно соответствующие именно этому сайту.

ОСОБЫЕ ОГРАНИЧЕНИЯ:
!!! СТРОГИЙ ЗАПРЕТ !!! Категорически запрещено:
- Генерировать ключевые слова о планировке, ремонте, дизайне квартир или интерьеров, если сайт НЕ ПОСВЯЩЕН этой теме
- Создавать "дефолтные" ключевые слова, не имеющие прямой связи с анализируемым контентом
- Включать ключевые слова по привычным шаблонам, если они не подтверждаются содержанием сайта

ИНСТРУКЦИЯ ПО АНАЛИЗУ:
1. Сначала внимательно изучи ВСЮ предоставленную информацию: заголовок, описание, ключевые слова, тексты
2. Определи ФАКТИЧЕСКУЮ тематику сайта, основываясь ИСКЛЮЧИТЕЛЬНО на реальном содержимом
3. Генерируй ключевые слова ТОЛЬКО на основе имеющихся данных, не добавляя темы "по умолчанию"
4. Учитывай, что сайт может быть на ЛЮБУЮ тему: здоровье, технологии, финансы, хобби, образование и т.д.

ОБЯЗАТЕЛЬНОЕ ПРАВИЛО:
Если в контенте нет упоминаний о планировке/дизайне/ремонте квартир, НИ ОДНО ключевое слово не должно содержать эти темы. 
То же правило применяется к любой другой тематике - генерируй ключевые слова ТОЛЬКО по темам, представленным в контенте.

ФОРМАТ И ДЛИНА КЛЮЧЕВЫХ СЛОВ:
1. Создай 15-20 разных ключевых фраз (2-5 слов каждая)
2. Каждое ключевое слово должно быть напрямую связано с контентом сайта
3. Слова домена "${domain}" не должны использоваться в ключевых словах

СТРУКТУРА ОТВЕТА:
Верни ТОЛЬКО JSON-массив объектов с полями:
- keyword: ключевое слово/фраза (строка)
- trend: число от 100 до 10000
- competition: число от 0 до 100

Примеры (для сайта об образовании):
[
  {"keyword": "курсы программирования онлайн", "trend": 5200, "competition": 65},
  {"keyword": "обучение английскому языку", "trend": 4100, "competition": 70},
  {"keyword": "подготовка к экзаменам эффективно", "trend": 2900, "competition": 55}
]`;

      // Обработка контента для случая, если он слишком длинный
      let adjustedContent = content;
      if (content.length > 12000) {
        // Выделяем наиболее значимые части
        const contentParts = content.split('\n\n');
        const importantSections = [];
        
        // Добавляем заголовок, описание и мета-ключевые слова в любом случае
        for (const part of contentParts) {
          if (part.startsWith('ЗАГОЛОВОК САЙТА:') || 
              part.startsWith('ОПИСАНИЕ САЙТА:') || 
              part.startsWith('КЛЮЧЕВЫЕ СЛОВА САЙТА:') ||
              part.startsWith('ЗАГОЛОВКИ СТРАНИЦЫ:')) {
            importantSections.push(part);
          }
        }
        
        // Добавляем элементы списков
        const listsSection = contentParts.find(part => part.startsWith('ЭЛЕМЕНТЫ СПИСКОВ:'));
        if (listsSection) importantSections.push(listsSection);
        
        // Добавляем часть основного текста
        const mainTextSection = contentParts.find(part => part.startsWith('ОСНОВНОЙ ТЕКСТ:'));
        if (mainTextSection) {
          const textLines = mainTextSection.split('\n').slice(0, 30); // Берем не больше 30 строк
          importantSections.push(textLines.join('\n'));
        }
        
        adjustedContent = importantSections.join('\n\n');
        console.log(`[${requestId}] Content was truncated from ${content.length} to ${adjustedContent.length} characters`);
      }

      const userContent = `Вот структурированное содержимое сайта ${url}:\n\n${adjustedContent}\n\nПроанализируй этот контент максимально тщательно и сгенерируй массив высокорелевантных ключевых слов в JSON формате.`;

      const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ];

      const result = await this.generateText(messages, {
        model: 'deepseek-chat',  // Используем самую мощную доступную модель
        temperature: 0.2,        // Немного увеличиваем для разнообразия
        top_p: 0.85,
        max_tokens: 2000        // Увеличиваем для более подробного анализа
      });
      
      console.log(`[${requestId}] Enhanced DeepSeek API response (first 150 chars): ${result.substring(0, 150)}...`);
      
      // Пытаемся извлечь JSON из ответа
      let keywords = [];
      try {
        // Пробуем напрямую распарсить ответ
        keywords = JSON.parse(result);
      } catch (e) {
        // Если не получилось, пробуем найти JSON в тексте с помощью регулярки
        const jsonMatch = result.match(/\[\s*\{\s*"keyword"[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            keywords = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            console.error(`[${requestId}] Failed to parse JSON from enhanced DeepSeek response:`, e2);
            
            // Ещё одна попытка: очистка и нормализация JSON
            try {
              // Заменяем некорректный синтаксис и пробуем парсить снова
              const cleanJson = jsonMatch[0]
                .replace(/,\s*]/g, ']')           // Убираем запятую перед закрывающей скобкой
                .replace(/,\s*}/g, '}')           // Убираем запятую перед закрывающей фигурной скобкой
                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":'); // Убеждаемся, что ключи в кавычках
              
              keywords = JSON.parse(cleanJson);
            } catch (e3) {
              console.error(`[${requestId}] All parsing attempts failed for DeepSeek response`);
            }
          }
        }
      }
      
      console.log(`[${requestId}] Successfully extracted ${keywords.length} enhanced keywords from DeepSeek API`);
      
      // Проверяем и форматируем результаты
      return keywords.map((item: any) => {
        // Проверяем наличие ключевого слова
        if (!item.keyword || typeof item.keyword !== 'string' || item.keyword.trim().length === 0) {
          return null; // Будет отфильтровано ниже
        }
        
        // Нормализуем и очищаем ключевое слово
        const normalizedKeyword = item.keyword
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ');  // Убираем лишние пробелы
        
        // Исключаем слишком короткие ключевые слова (меньше 5 символов)
        if (normalizedKeyword.length < 5) {
          return null;
        }
        
        return {
          keyword: normalizedKeyword,
          trend: typeof item.trend === 'number' ? item.trend : Math.floor(Math.random() * 5000) + 200,
          competition: typeof item.competition === 'number' ? item.competition : Math.floor(Math.random() * 80) + 20
        };
      }).filter(Boolean); // Отфильтровываем null значения
    } catch (error) {
      console.error(`[${requestId}] Error generating enhanced keywords with DeepSeek:`, error);
      return [];
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
    } catch (error) {
      console.error('Error generating social content with DeepSeek:', error);
      throw error;
    }
  }
  
  /**
   * Генерирует промт для изображения на основе текстового контента
   * @param content Текстовый контент, на основе которого нужно сгенерировать промт
   * @param keywords Ключевые слова для усиления релевантности промта (опционально)
   * @returns Промт для генерации изображения на английском языке
   */
  async generateImagePrompt(
    content: string,
    keywords: string[] = []
  ): Promise<string> {
    try {
      console.log('Начинаем генерацию промта для изображений с помощью DeepSeek...');
      
      // Очищаем HTML-теги из контента, но сохраняем структуру текста
      const cleanedContent = content
        .replace(/<[^>]*>/g, ' ')  // Заменяем HTML-теги пробелами
        .replace(/\s+/g, ' ')      // Заменяем множественные пробелы одним
        .trim();                    // Убираем пробелы в начале и конце
      
      console.log(`Контент очищен от HTML. Длина: ${cleanedContent.length} символов. Первые 100: ${cleanedContent.substring(0, 100)}...`);
      
      // Формируем системный промт
      const systemPrompt = `You are an expert image prompt generator for Stable Diffusion AI.
Your task is to create detailed, vivid, and highly specific prompts for generating images based on Russian text content.

INSTRUCTIONS:
1. Read the provided Russian text content carefully
2. Create a SINGLE, detailed image generation prompt in ENGLISH
3. Focus on the main subject, scene, mood, and style from the content
4. Include visual details like lighting, color scheme, and composition
5. DO NOT mention text, captions, or writing in the image
6. Output ONLY the image prompt text in English - nothing else
7. Format the prompt to be optimized for Stable Diffusion AI
8. DO NOT put quotation marks around the prompt
9. DO NOT include any explanations or comments
10. Length should be 1-3 sentences maximum
11. Include adjectives like "detailed", "high quality", "photorealistic" or art styles

The ideal prompt should create a visually appealing, professional image that captures the essence of the source content.`;

      // Добавляем ключевые слова в запрос, если они предоставлены
      const keywordsText = keywords && keywords.length > 0 
        ? `\n\nReference keywords (use if relevant): ${keywords.join(', ')}` 
        : '';
      
      const userPrompt = `Create a professional image generation prompt based on this Russian text:

${cleanedContent}${keywordsText}

Remember to output ONLY the English prompt without any explanations.`;

      const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      // Если API ключ не установлен, пытаемся использовать fallback напрямую
      if (!this.hasApiKey()) {
        console.warn('DeepSeek API ключ не установлен. Возвращаем заранее подготовленный промт.');
        
        // Пока DeepSeek API не работает, возвращаем базовый промт на основе контента
        const fallbackPrompt = `A detailed, high-quality photorealistic image of ${cleanedContent.substring(0, 100)}, with natural lighting, vibrant colors, and professional composition.`;
        console.log('Используем fallback промт: ' + fallbackPrompt);
        
        // В этом случае не бросаем ошибку, а возвращаем что-то полезное
        return fallbackPrompt;
      }

      console.log('Отправляем запрос на генерацию промта к DeepSeek API...');
      
      // Перехватываем больше потенциальных ошибок
      try {
        // Вызываем генерацию с соответствующими параметрами
        const result = await this.generateText(messages, {
          model: 'deepseek-chat',
          temperature: 0.7,  // Более высокая температура для творческих результатов
          max_tokens: 300    // Ограничиваем длину промта
        });
        
        // Проверка на валидность результата
        if (!result || typeof result !== 'string' || result.trim().length < 10) {
          throw new Error(`Некорректный результат от DeepSeek API: ${result}`);
        }
        
        console.log(`Успешно получен результат от DeepSeek API. Длина: ${result.length} символов.`);
        console.log(`Первые 100 символов промта: ${result.substring(0, 100)}...`);
        
        // Чистим результат от лишних кавычек, если они добавлены моделью
        return result.replace(/^["']|["']$/g, '').trim();
      } catch (apiError: any) {
        console.error('Ошибка при обращении к DeepSeek API:', apiError);
        
        // Дополнительная информация для диагностики
        if (apiError.response) {
          console.error('Детали ответа API:', JSON.stringify({
            status: apiError.response.status,
            data: apiError.response.data
          }));
        }
        
        // Ошибка при обращении к API, проверим формат ключа
        console.log('Проверка формата API ключа...');
        
        // Перепробуем с другими форматами ключа
        const keyFormats = [
          { format: 'без Bearer', key: this.apiKey.replace(/^Bearer\s+/i, '') },
          { format: 'с Bearer', key: this.apiKey.startsWith('Bearer ') ? this.apiKey : `Bearer ${this.apiKey}` },
          { format: 'с sk-', key: this.apiKey.startsWith('sk-') ? this.apiKey : `sk-${this.apiKey}` }
        ];
        
        // Пробуем каждый формат
        for (const format of keyFormats) {
          console.log(`Пробуем формат ключа: ${format.format}`);
          
          try {
            // Временно меняем ключ
            const originalKey = this.apiKey;
            this.apiKey = format.key;
            
            // Пробуем простой запрос
            const testResult = await this.generateText(
              [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Say hello in one word.' }
              ],
              { max_tokens: 10 }
            );
            
            console.log(`Формат ключа ${format.format} успешно сработал!`);
            
            // Если этот формат сработал, возвращаемся к основному запросу
            const finalResult = await this.generateText(messages, {
              model: 'deepseek-chat',
              temperature: 0.7,
              max_tokens: 300
            });
            
            // Чистим результат и возвращаем
            return finalResult.replace(/^["']|["']$/g, '').trim();
          } catch (formatError) {
            console.error(`Формат ключа ${format.format} не сработал:`, formatError);
            // Продолжаем с другими форматами
          }
        }
        
        // Если ни один формат не сработал, возвращаем подготовленный промт на основе контента
        console.warn('Все форматы ключа DeepSeek API не сработали. Возвращаем заранее подготовленный промт.');
        const fallbackPrompt = `A detailed, high-quality photorealistic image of ${cleanedContent.substring(0, 100)}, with natural lighting, vibrant colors, and professional composition.`;
        return fallbackPrompt;
      }
    } catch (error: any) {
      console.error('Критическая ошибка при генерации промта для изображения с DeepSeek:', error);
      
      // В случае полного отказа системы, всё равно возвращаем что-то полезное
      try {
        // Простая генерация промта на основе контента
        const emergencyPrompt = `A detailed, high-quality photorealistic image related to ${content.substring(0, 50).replace(/<[^>]*>/g, ' ').trim()}`;
        return emergencyPrompt;
      } catch (e) {
        throw new Error(`Не удалось сгенерировать промт для изображения: ${error.message || String(error)}`);
      }
    }
  }

  /**
   * Адаптирует контент для разных платформ
   */
  async adaptContentForPlatform(
    originalContent: string,
    platform: string,
    contentType: 'text' | 'image' | 'video' | 'carousel'
  ): Promise<string> {
    const platformGuidelines = {
      instagram: 'Instagram: картинки квадратного формата, до 2200 символов текста, много эмодзи, 5-30 хэштегов, умеренное форматирование',
      facebook: 'Facebook: больше текста, меньше эмодзи, важна структура с заголовками, вопросы для вовлечения, можно добавить призыв к действию в конце',
      telegram: 'Telegram: поддерживает форматирование Markdown, не использует хэштеги, умеренные эмодзи, можно добавлять упоминания и ссылки',
      vk: 'ВКонтакте: средний объем текста, умеренные эмодзи, несколько хэштегов, можно добавлять упоминания и ссылки'
    };
    
    const systemPrompt = `Ты эксперт по адаптации контента для социальных сетей. Тебе предоставят оригинальный контент, а твоя задача - адаптировать его для платформы ${platform} в формате ${contentType}.

РУКОВОДСТВО ПО ПЛАТФОРМЕ:
${platformGuidelines[platform as keyof typeof platformGuidelines] || 'Адаптируй контент под специфику платформы, соблюдая все ограничения.'}

ПРАВИЛА АДАПТАЦИИ:
1. Сохрани основную идею и сообщение контента
2. Адаптируй длину под требования платформы
3. Добавь или убери элементы форматирования, хэштеги и эмодзи по необходимости
4. Сохрани ключевые слова и термины
5. Текст должен оставаться естественным и не выглядеть шаблонным
6. Не добавляй лишних примечаний о том, что это адаптация

ВАЖНО:
- Не упоминай, что контент был создан ИИ или адаптирован
- Убедись, что контент не выглядит искусственным
- Используй подходящие для платформы обороты речи`;

    const userContent = `Вот оригинальный контент:

${originalContent}

Пожалуйста, адаптируй этот контент для платформы ${platform} в формате ${contentType}.`;

    try {
      return await this.generateText(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        {
          temperature: 0.4,
          max_tokens: 1000
        }
      );
    } catch (error: any) {
      console.error(`Error adapting content for ${platform}:`, error);
      throw new Error(`Ошибка адаптации контента для ${platform}: ${error.message || String(error)}`);
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
      console.log('Попытка инициализации DeepSeek сервиса для пользователя', userId);
      
      // Используем только централизованную систему API ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'deepseek', authToken);
      
      if (apiKey) {
        console.log(`DeepSeek API ключ получен из БД (длина: ${apiKey.length})`);
        this.updateApiKey(apiKey);
        log('DeepSeek API ключ успешно получен через API Key Service', 'deepseek');
        console.log('DeepSeek API ключ успешно получен через API Key Service');
        return true;
      } else {
        console.log('API ключ DeepSeek не найден в БД для пользователя', userId);
        log('DeepSeek API ключ не найден в настройках пользователя', 'deepseek');
        return false;
      }
    } catch (error: any) {
      console.error('Ошибка при инициализации DeepSeek сервиса:', error);
      log(`Ошибка при инициализации DeepSeek сервиса: ${error.message || String(error)}`, 'deepseek');
      return false;
    }
  }
}

// Экспортируем экземпляр сервиса для использования в других модулях
// ВАЖНО: Инициализируем без API ключа, ключ будет получен из Directus при необходимости
export const deepseekService = new DeepSeekService({
  apiKey: "" // Пустой ключ, будет получен из Directus при вызове initialize()
});

// Логируем статус инициализации сервиса
console.log(`DeepSeek service initialized. API keys will be obtained ONLY from Directus user settings.`);