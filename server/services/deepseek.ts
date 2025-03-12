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
        throw new Error('Invalid response format from DeepSeek API');
      }
      
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling DeepSeek API:', error);
      throw error;
    }
  }
  
  /**
   * Генерирует ключевые слова для URL с помощью DeepSeek API
   */
  async generateKeywordsForUrl(url: string, content: string, requestId: string): Promise<any[]> {
    try {
      // Извлекаем домен из URL
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      console.log(`[${requestId}] Generating keywords with DeepSeek for domain: ${domain}`);
      
      const systemPrompt = `Ты эксперт по SEO и маркетингу. Твоя задача - проанализировать содержание сайта максимально тщательно и определить его НАСТОЯЩУЮ тематику и основную специализацию. Затем создать набор строго релевантных ключевых слов, которые реально используются целевой аудиторией этого сайта в поисковых запросах.

СТРОГИЕ ТРЕБОВАНИЯ К АНАЛИЗУ КОНТЕНТА:
1. Внимательно изучи ВЕСЬ предоставленный текст сайта, обращая особое внимание на:
   - Заголовки и подзаголовки сайта (теги H1, H2 и т.д.)
   - Реально повторяющиеся термины и фразы в тексте
   - Специализированную лексику, профессиональные термины и аббревиатуры
   - Названия продуктов, услуг, товаров или конкретных решений
   - Проблемы пользователей, которые решает сайт
2. Определи, с какой КОНКРЕТНОЙ отраслью/нишей/сферой бизнеса связан сайт
3. Определи целевую аудиторию сайта (B2B, B2C, возраст, интересы)
4. Проанализируй бизнес-модель (продажа товаров, услуг, информационный ресурс)

ВАЖНЕЙШИЕ ПРАВИЛА ДЛЯ ФОРМИРОВАНИЯ КЛЮЧЕВЫХ СЛОВ:
1. НИКОГДА не используй имя домена "${domain}" или URL-адрес сайта "${url}" в качестве основы для ключевых слов!
2. НИКОГДА не генерируй ключевые слова только на основе имени домена!
3. Ключевые слова должны отражать СОДЕРЖАНИЕ и ТЕМАТИКУ сайта, а не его URL
4. Если у сайта нет четкой тематики или недостаточно контента, верни пустой массив []
5. СТРОГО ограничь результат до 10-15 максимально конкретных и релевантных ключевых слов
6. ВСЕ ключевые слова должны быть на том же языке, что и основной контент сайта
7. ВСЕ ключевые слова должны использоваться реальными людьми в поисковых запросах
8. Ключевые слова ОБЯЗАТЕЛЬНО должны включать коммерческие запросы (купить, цена, услуги) если это коммерческий сайт
9. ЗАПРЕЩЕНЫ общие, неконкретные фразы. Используй только специфичные для данной ниши запросы

ДОПОЛНИТЕЛЬНЫЕ СТРОГИЕ ОГРАНИЧЕНИЯ:
1. АБСОЛЮТНО ЗАПРЕЩЕНО использовать в качестве ключевых слов любые слова из домена "${domain}"
2. Чем более конкретные и узкие ключевые слова, тем ЛУЧШЕ
3. ОБЩИЕ ключевые слова (например, "платформа", "сервис", "технология") без конкретной специфики – ЭТО ОШИБКА
4. ПРЕДПОЧТЕНИЕ длинным, специфичным ключевым фразам из 3-4 слов
5. ОБЯЗАТЕЛЬНО включи коммерческие и транзакционные запросы, если это коммерческий сайт

ФОРМАТ ОТВЕТА:
Верни СТРОГО JSON-массив объектов со следующими полями:
- keyword: конкретное ключевое слово или фраза (строка)
- trend: примерная месячная частота запросов (целое число от 100 до 10000)
- competition: уровень конкуренции от 0 до 100 (целое число)

Пример формата:
[
  {"keyword": "название продукта купить", "trend": 5400, "competition": 85},
  {"keyword": "услуга в городе цена", "trend": 1200, "competition": 60}
]`;

      const userContent = content 
        ? `Вот содержимое сайта ${url}:\n\n${content}\n\nПроанализируй этот контент и сгенерируй массив релевантных ключевых слов в JSON формате.`
        : `Посети сайт ${url} и сгенерируй массив релевантных ключевых слов в JSON формате.`;

      const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ];

      const result = await this.generateText(messages, {
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: 1000
      });
      
      console.log(`[${requestId}] DeepSeek API response (first 100 chars): ${result.substring(0, 100)}...`);
      
      // Пытаемся извлечь JSON из ответа
      let keywords = [];
      try {
        // Пробуем напрямую распарсить ответ
        keywords = JSON.parse(result);
      } catch (e) {
        // Если не получилось, пробуем найти JSON в тексте с помощью регулярки
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            keywords = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            console.error(`[${requestId}] Failed to parse JSON from DeepSeek response:`, e2);
          }
        }
      }
      
      console.log(`[${requestId}] Successfully extracted ${keywords.length} keywords from DeepSeek API`);
      
      // Форматируем и возвращаем результаты
      return keywords.map((item: any) => ({
        keyword: item.keyword?.toLowerCase().trim() || "",
        trend: item.trend || Math.floor(Math.random() * 5000) + 100,
        competition: item.competition || Math.floor(Math.random() * 80) + 20
      })).filter((item: any) => item.keyword.length > 0);
    } catch (error) {
      console.error(`[${requestId}] Error generating keywords with DeepSeek:`, error);
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
  apiKey: process.env.DEEPSEEK_API_KEY || "sk-7debde066de4456bbf2b029beb789db3"
});