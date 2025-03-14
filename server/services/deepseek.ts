import axios from 'axios';

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
      
      // Проверяем, что API ключ установлен
      if (!this.apiKey || this.apiKey.trim() === '') {
        console.error('DeepSeek API key is not set');
        throw new Error('DeepSeek API ключ не установлен. Пожалуйста, добавьте API ключ в настройках пользователя.');
      }
      
      console.log(`Sending request to DeepSeek API (model: ${model}, temp: ${temperature})`);
      
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
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data?.choices?.[0]?.message?.content) {
        console.error('Invalid response format from DeepSeek API:', response.data);
        throw new Error('Некорректный ответ от DeepSeek API. Пожалуйста, проверьте настройки или попробуйте позже.');
      }
      
      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('Error calling DeepSeek API:', error);
      
      // Проверяем, содержит ли сообщение об ошибке "Invalid API key"
      if (error.response?.data?.error) {
        const errorMessage = error.response.data.error.message || error.response.data.error;
        
        if (typeof errorMessage === 'string' && 
           (errorMessage.includes('API key') || errorMessage.includes('authentication') || 
            errorMessage.includes('auth') || errorMessage.includes('token') || 
            error.response.status === 401 || error.response.status === 403)) {
          throw new Error('Недействительный API ключ DeepSeek. Пожалуйста, проверьте ключ в настройках пользователя.');
        }
      }
      
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
    } catch (error) {
      console.error(`Error adapting content for ${platform}:`, error);
      throw error;
    }
  }
}

// Экспортируем экземпляр сервиса для использования в других модулях
export const deepseekService = new DeepSeekService({
  apiKey: process.env.DEEPSEEK_API_KEY || ""
});

// Логируем статус инициализации сервиса
console.log(`DeepSeek service initialized. API key from env: ${process.env.DEEPSEEK_API_KEY ? 'Present' : 'Not found'}`);