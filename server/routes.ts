const searchCache = new Map<string, { timestamp: number, results: any[] }>();
const urlKeywordCache = new Map<string, { timestamp: number, results: any[] }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Функция для очистки устаревших записей кеша
function cleanupExpiredCache() {
  const now = Date.now();
  let removedCount = 0;
  
  // Очищаем кеш для обычных запросов
  for (const [key, entry] of searchCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      console.log(`Removing expired cache entry for keyword: ${key}`);
      searchCache.delete(key);
      removedCount++;
    }
  }
  
  // Очищаем кеш для URL-запросов
  for (const [url, entry] of urlKeywordCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      console.log(`Removing expired cache entry for URL: ${url}`);
      urlKeywordCache.delete(url);
      removedCount++;
    }
  }
  
  console.log(`Cache cleanup completed. Removed ${removedCount} expired entries. Current state: Keywords cache: ${searchCache.size} entries, URL cache: ${urlKeywordCache.size} entries`);
}

// Запускаем очистку кеша каждые 15 минут
setInterval(cleanupExpiredCache, 15 * 60 * 1000);

// Add helper function to check and get cached results
function getCachedResults(keyword: string): any[] | null {
  const cached = searchCache.get(keyword);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached results for keyword: ${keyword}`);
    return cached.results;
  }
  return null;
}

// Специальное кеширование для URL-адресов
function getCachedKeywordsByUrl(url: string): any[] | null {
  const normalizedUrl = url.toLowerCase().trim();
  const cached = urlKeywordCache.get(normalizedUrl);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached URL keywords for: ${url}, found ${cached.results.length} items`);
    return cached.results;
  }
  return null;
}

// Функция для объединения ключевых слов из разных источников
function mergeKeywords(perplexityKeywords: any[], xmlRiverKeywords: any[]): any[] {
  // Создаем Map для уникальности по ключевому слову
  const keywordMap = new Map<string, any>();
  
  // Сначала добавляем ключевые слова от Perplexity, они приоритетнее
  perplexityKeywords.forEach(keyword => {
    if (!keyword?.keyword) return;
    const key = keyword.keyword.toLowerCase().trim();
    if (!keywordMap.has(key)) {
      keywordMap.set(key, keyword);
    }
  });
  
  // Затем добавляем ключевые слова от XMLRiver, если таких еще нет
  xmlRiverKeywords.forEach(keyword => {
    if (!keyword?.keyword) return;
    const key = keyword.keyword.toLowerCase().trim();
    if (!keywordMap.has(key)) {
      keywordMap.set(key, keyword);
    }
  });
  
  // Преобразуем Map обратно в массив и сортируем по популярности
  return Array.from(keywordMap.values())
    .sort((a, b) => b.trend - a.trend)
    .slice(0, 15); // Ограничиваем до 15 самых популярных ключевых слов
}

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertContentSourceSchema, 
  insertCampaignContentSchema,
  insertCampaignTrendTopicSchema,
  InsertCampaignTrendTopic,
  InsertCampaignContent
} from "@shared/schema";
import { crawler } from "./services/crawler";
import axios from "axios";
import { directusApi } from './directus';
import * as crypto from 'crypto';

// Add type for follower requirements
type PlatformRequirements = {
  [key: string]: number;
};

// Image proxy function to handle Telegram images
async function fetchAndProxyImage(url: string, res: any) {
  try {
    console.log(`Proxying image: ${url}`);
    // Set a timeout to prevent hanging requests
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: {
        // Add common browser headers to avoid being blocked
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });

    // Set appropriate headers based on content type
    let contentType = response.headers['content-type'];

    // Special handling for Telegram MP4 files which are actually GIFs
    if (url.includes('tgcnt.ru') && url.toLowerCase().endsWith('.mp4')) {
      // Force content type to be video/mp4 for Telegram MP4 files
      contentType = 'video/mp4';
    }

    // Set headers
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    // Log success
    console.log(`Successfully proxied image ${url} with content type ${contentType}`);

    // Send the image data
    res.send(response.data);
  } catch (error) {
    console.error(`Error proxying image ${url}:`, error);
    res.status(404).send('Image not found');
  }
}

// Helper function to normalize URLs
function normalizeInstagramUrl(url: string): string {
  try {
    // Remove http/https and www
    let username = url.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '');

    // Remove @ if present
    if (username.startsWith('@')) {
      username = username.substring(1);
    }

    // Remove trailing slash and query params
    username = username.split('/')[0].split('?')[0];

    if (!username) return '';

    return `https://instagram.com/${username}`;
  } catch (error) {
    console.error(`Error normalizing Instagram URL ${url}:`, error);
    return url;
  }
}


// Helper function to add delay between requests
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function for Social Searcher API
async function searchSocialSourcesByKeyword(keyword: string, authToken: string): Promise<any[]> {
  try {
    const settings = await directusApi.get('/items/user_api_keys', {
      params: {
        filter: {
          service_name: { _eq: 'social_searcher' }
        }
      },
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const socialSearcherKey = settings.data?.data?.[0]?.api_key;
    if (!socialSearcherKey) {
      console.log('Social Searcher API key not found');
      return [];
    }

    try {
      const response = await axios.get('https://api.social-searcher.com/v2/users', {
        params: {
          q: encodeURIComponent(keyword),
          key: socialSearcherKey,
          network: 'youtube,instagram',
          lang: 'ru'
        }
      });

      if (response.data?.meta?.http_code === 403) {
        console.log('Social Searcher API daily limit reached');
        return [];
      }

      const validSources = (response.data?.posts || [])
        .filter((post: any) => {
          // Фильтруем посты на русском языке
          const hasRussianText = /[а-яА-ЯёЁ]/.test(post.text || '') || /[а-яА-ЯёЁ]/.test(post.title || '');
          return hasRussianText;
        })
        .map((post: any) => {
          const url = normalizeSourceUrl(post.user?.url, post.network);
          if (!url) return null;

          return {
            url,
            name: post.user?.name || '',
            followers: 100000, // Заглушка, в реальности нужно парсить
            platform: post.network,
            description: post.text || `${post.network === 'youtube' ? 'YouTube канал' : 'Instagram аккаунт'}: ${post.user?.name}`,
            rank: 5
          };
        })
        .filter(Boolean);

      return validSources;

    } catch (apiError: any) {
      if (apiError.response?.status === 403) {
        console.log('Social Searcher API limit reached or access denied');
        return [];
      }
      console.error('Social Searcher API error:', apiError.message);
      return [];
    }
  } catch (error) {
    console.error('Error in Social Searcher setup:', error);
    return [];
  }
}

// Helper function to convert follower count text to number
function parseFollowerCount(text: string): number {
  try {
    // Remove any non-numeric characters except K, M, k, m
    const cleanText = text.toLowerCase().replace(/[^0-9km]/g, '');
    const number = parseFloat(cleanText.replace(/[km]/g, ''));

    if (cleanText.includes('m')) {
      return number * 1000000;
    } else if (cleanText.includes('k')) {
      return number * 1000;
    }
    return number;
  } catch (e) {
    console.error('Error parsing follower count:', e);
    return 0;
  }
}

// Helper function to extract sources from text content
function extractSourcesFromText(content: string): any[] {
  const sources: any[] = [];

  // 1. Direct Instagram URLs
  // Example: https://www.instagram.com/pp_mari_food/ - хороший аккаунт
  const urlPattern = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._-]+)\/?/g;
  let match;

  while ((match = urlPattern.exec(content)) !== null) {
    const username = match[1];
    const url = normalizeInstagramUrl(`instagram.com/${username}`);
    if (!sources.some(s => s.url === url)) {
      sources.push({
        url,
        name: username,
        followers: 100000, // Default value
        platform: 'instagram.com',
        description: 'Instagram аккаунт о правильном питании',
        rank: 5
      });
    }
  }

  // 2. Formatted lists with stars
  // Example: "1. **@raychelpaul** - Рейчел Паул (500K followers) - Публикует рецепты..."
  const formattedPattern = /\*\*@([a-zA-Z0-9._-]+)\*\*\s*-\s*([^(]+)\s*\(([0-9.]+[KkMm][^)]*)\)[^-]*-\s*([^.\n]+)/g;

  while ((match = formattedPattern.exec(content)) !== null) {
    const [_, username, name, followers, description] = match;
    const followersCount = parseFollowerCount(followers);
    const url = normalizeInstagramUrl(`instagram.com/${username}`);

    if (followersCount >= 50000 && !sources.some(s => s.url === url)) {
      sources.push({
        url,
        name: name.trim(),
        followers: followersCount,
        platform: 'instagram.com',
        description: description.trim(),
        rank: 5
      });
    }
  }

  // 3. Simple @ mentions
  // Example: "@username (500K followers)"
  const simplePattern = /@([a-zA-Z0-9._-]+)\s*\(([0-9.]+[KkMm][^)]*)\)/g;

  while ((match = simplePattern.exec(content)) !== null) {
    const [_, username, followers] = match;
    const followersCount = parseFollowerCount(followers);
    const url = normalizeInstagramUrl(`instagram.com/${username}`);

    if (followersCount >= 50000 && !sources.some(s => s.url === url)) {
      sources.push({
        url,
        name: username,
        followers: followersCount,
        platform: 'instagram.com',
        description: 'Instagram аккаунт о правильном питании',
        rank: 5
      });
    }
  }

  console.log(`Extracted ${sources.length} Instagram sources:`, sources);
  return sources;
}

// Helper function for Perplexity search
async function existingPerplexitySearch(keyword: string, token: string): Promise<any[]> {
  const cached = getCachedResults(keyword);
  if (cached) {
    console.log(`Using ${cached.length} cached results for keyword: ${keyword}`);
    return cached;
  }

  try {
    const settings = await directusApi.get('/items/user_api_keys', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        filter: {
          service_name: { _eq: 'perplexity' }
        }
      }
    });

    const perplexityKey = settings.data?.data?.[0]?.api_key;
    if (!perplexityKey) {
      console.error('Perplexity API key not found');
      return [];
    }

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: `You are an expert at finding high-quality Russian Instagram accounts.
Focus only on Instagram accounts with >50K followers that post in Russian.
For each account provide:
1. Username with @ symbol 
2. Full name in Russian
3. Follower count with K or M
4. Brief description in Russian

Format each account as:
1. **@username** - Name (500K followers) - Description

Also include direct Instagram URLs in the response like:
https://www.instagram.com/username/ - description`
          },
          {
            role: "user",
            content: `Find TOP-5 most authoritative Russian Instagram accounts for: ${keyword}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response structure');
    }

    const content = response.data.choices[0].message.content;
    console.log(`Raw API response for keyword ${keyword}:`, content);

    // Извлекаем источники из текста
    const sources = extractSourcesFromText(content);
    console.log(`Found ${sources.length} sources for keyword ${keyword}`);

    // Кешируем результаты
    if (sources.length > 0) {
      console.log(`Caching ${sources.length} results for keyword: ${keyword}`);
      searchCache.set(keyword, {
        timestamp: Date.now(),
        results: sources
      });
    }

    return sources;

  } catch (error) {
    console.error('Error in Perplexity search:', error);
    return [];
  }
}

// Helper function to merge sources and remove duplicates
function mergeSources(sources: any[]): any[] {
  console.log('Merging sources, total input:', sources.length);
  const uniqueSourcesMap = new Map();
  sources.forEach(source => {
    const key = source.url.toLowerCase().trim();
    if (!uniqueSourcesMap.has(key) || source.rank < uniqueSourcesMap.get(key).rank) {
      uniqueSourcesMap.set(key, source);
    }
  });
  const mergedSources = Array.from(uniqueSourcesMap.values());
  console.log('After merging, unique sources:', mergedSources.length);
  return mergedSources;
}

// Middleware для проверки авторизации
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No authorization header provided');
      return res.status(401).json({ error: 'Не авторизован: Отсутствует заголовок авторизации' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('Empty token provided');
      return res.status(401).json({ error: 'Не авторизован: Пустой токен' });
    }

    try {
      // Получаем информацию о пользователе из Directus API
      const response = await directusApi.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data?.data?.id) {
        console.log('Invalid token: cannot get user info');
        return res.status(401).json({ error: 'Не авторизован: Недействительный токен' });
      }

      // Добавляем userId в объект запроса для дальнейшего использования
      (req as any).userId = response.data.data.id;
      next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(401).json({ 
        error: 'Не авторизован: Ошибка проверки токена',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Вспомогательная функция для обработки ключевых слов
  function processKeywords(keywordsData: any): string[] {
    if (!keywordsData) return [];
    
    if (Array.isArray(keywordsData)) {
      return keywordsData.map(k => typeof k === 'string' ? k : String(k));
    }
    
    if (typeof keywordsData === 'string') {
      try {
        const parsed = JSON.parse(keywordsData);
        if (Array.isArray(parsed)) {
          return parsed.map(k => typeof k === 'string' ? k : String(k));
        }
      } catch (e) {
        // Не JSON строка
      }
      return [keywordsData];
    }
    
    return [String(keywordsData)];
  }
  
  // Создаем "пользовательский" метод для замены переменной
  const fixCampaignContent = (routes: Express): void => {
    const getHandler = routes._router.stack.find((layer: any) => 
      layer.route && layer.route.path === '/api/campaign-content' && layer.route.methods.get);
    
    if (getHandler && getHandler.route && getHandler.route.stack && getHandler.route.stack[0] && getHandler.route.stack[0].handle) {
      const originalHandler = getHandler.route.stack[0].handle;
      getHandler.route.stack[0].handle = async function(req: Request, res: Response) {
        try {
          // Перед передачей запроса исходному обработчику, добавляем обработку для
          // переопределения метода преобразования данных
          const originalJson = res.json;
          res.json = function(body) {
            // Если это ответ с данными контента кампании
            if (body && body.data && Array.isArray(body.data)) {
              // Перебираем все элементы контента и обрабатываем keywords
              body.data = body.data.map((item: any) => {
                if (item.keywords) {
                  console.log(`Original keywords for ${item.id}:`, typeof item.keywords, JSON.stringify(item.keywords));
                  item.keywords = processKeywords(item.keywords);
                  console.log(`Processed keywords for ${item.id}:`, typeof item.keywords, JSON.stringify(item.keywords));
                }
                return item;
              });
            }
            // Вызываем оригинальный метод json с измененными данными
            return originalJson.call(this, body);
          };
          
          return originalHandler(req, res);
        } catch (error) {
          console.error('Error in campaign content handler:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      };
    }
  };
  console.log('Starting route registration...');
  const httpServer = createServer(app);
  
  // Применяем наш фикс для правильной обработки keywords
  fixCampaignContent(app);
  
  // Маршрут для генерации контента через Perplexity API
  app.post("/api/generate-content", async (req, res) => {
    try {
      const { prompt, keywords, tone, campaignId } = req.body;
      
      if (!prompt || !keywords || !tone || !campaignId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Получаем API ключ Perplexity из настроек пользователя
        const settings = await directusApi.get('/items/user_api_keys', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          params: {
            filter: {
              service_name: { _eq: 'perplexity' }
            }
          }
        });
        
        const perplexityKey = settings.data?.data?.[0]?.api_key;
        if (!perplexityKey) {
          return res.status(400).json({ error: "Не найден API ключ для Perplexity. Добавьте его в настройках." });
        }
        
        // Создаем системный промт в зависимости от выбранного тона
        let systemPrompt = "Ты - опытный копирайтер, который создает качественный контент для социальных сетей.";
        
        switch (tone) {
          case "informative":
            systemPrompt += " Твой стиль информативный, ясный и образовательный.";
            break;
          case "friendly":
            systemPrompt += " Твой стиль дружелюбный, теплый и доступный, как разговор с другом.";
            break;
          case "professional":
            systemPrompt += " Твой стиль профессиональный, авторитетный и основательный.";
            break;
          case "casual":
            systemPrompt += " Твой стиль повседневный, непринужденный и разговорный.";
            break;
          case "humorous":
            systemPrompt += " Твой стиль остроумный, забавный, с уместным юмором.";
            break;
        }
        
        // Формируем запрос к API для генерации контента
        console.log(`Generating content for campaign ${campaignId} with keywords: ${keywords.join(", ")}`);
        
        const response = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          {
            model: "llama-3.1-sonar-small-128k-online",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: `Создай контент для социальных сетей на основе следующего задания: ${prompt}
                
                Обязательно используй эти ключевые слова: ${keywords.join(", ")}
                
                Контент должен быть в русском языке, легко читаемым, структурированным, и длиной около 2000-3000 символов.`
              }
            ],
            max_tokens: 4000,
            temperature: 0.7
          },
          {
            headers: {
              'Authorization': `Bearer ${perplexityKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!response.data?.choices?.[0]?.message?.content) {
          throw new Error('Invalid API response structure');
        }
        
        const content = response.data.choices[0].message.content;
        console.log(`Generated content length: ${content.length} characters`);
        
        res.json({ success: true, content });
        
      } catch (error) {
        console.error('Error generating content with Perplexity:', error);
        if (axios.isAxiosError(error)) {
          console.error('Perplexity API error details:', {
            status: error.response?.status,
            data: error.response?.data
          });
        }
        return res.status(500).json({ error: "Failed to generate content with AI" });
      }
    } catch (error) {
      console.error("Error in content generation:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });

  // New endpoint for proxying images
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send('URL parameter is required');
    }

    try {
      // Decode the URL if it's encoded
      const decodedUrl = decodeURIComponent(imageUrl);
      await fetchAndProxyImage(decodedUrl, res);
    } catch (error) {
      console.error('Error in image proxy:', error);
      res.status(500).send('Failed to proxy image');
    }
  });

  // Интеллектуальный поиск ключевых слов (XMLRiver с Perplexity fallback)
  app.get("/api/wordstat/:keyword", async (req, res) => {
    try {
      console.log(`Searching for keywords with context: ${req.params.keyword}`);
      
      // Фильтр нецензурной лексики в качестве входных данных
      const offensiveWords = ['бля', 'хуй', 'пизд', 'ебан', 'еб', 'пидор', 'пидар', 'хуя', 'нахуй', 'дебил'];
      const keyword = req.params.keyword.toLowerCase();
      
      // Проверяем, содержит ли ключевое слово нецензурную лексику
      if (offensiveWords.some(word => keyword.includes(word)) || 
          (keyword === 'сука' && !keyword.includes('порода') && !keyword.includes('собак'))) {
        return res.status(400).json({
          error: "Запрос содержит недопустимое содержание",
          message: "Пожалуйста, используйте корректные ключевые слова для поиска"
        });
      }
      
      // Отключаем кеширование для этого запроса
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Генерируем случайный ID для отслеживания
      const requestId = Math.random().toString(36).substring(2, 15);
      console.log(`[${requestId}] Processing keyword search for: ${keyword}`);

      // Добавляем случайный параметр чтобы избежать кеширования на клиенте
      const nocache = Date.now();
      
      // Проверяем, является ли введенное значение URL сайта
      let isUrl = false;
      try {
        const url = new URL(keyword.startsWith('http') ? keyword : `https://${keyword}`);
        isUrl = url.hostname.includes('.');
      } catch (e) {
        isUrl = false;
      }

      let finalKeywords = [];
      
      // Если это URL, используем Perplexity API для получения релевантных ключевых слов
      if (isUrl) {
        console.log('Using Perplexity for URL-based keyword search');
        
        // Нормализуем URL
        const normalizedUrl = keyword.startsWith('http') ? keyword : `https://${keyword}`;
        
        // Проверяем кеш для URL
        const cachedKeywords = getCachedKeywordsByUrl(normalizedUrl);
        if (cachedKeywords && cachedKeywords.length > 0) {
          console.log(`[${requestId}] Using ${cachedKeywords.length} cached keywords for URL: ${normalizedUrl}`);
          finalKeywords = cachedKeywords;
          return res.json({ data: { keywords: finalKeywords } });
        }
        
        try {
          // Получаем API ключ Perplexity
          const settings = await directusApi.get('/items/user_api_keys', {
            params: {
              filter: {
                service_name: { _eq: 'perplexity' }
              }
            }
          });
          
          const perplexityKey = settings.data?.data?.[0]?.api_key;
          if (!perplexityKey) {
            throw new Error('Perplexity API key not found');
          }
          
          // Сначала попробуем получить контент с сайта для лучшего анализа
          let siteContent = "";
          let metaDescription = "";
          let metaKeywords = "";
          let title = "";
          
          try {
            console.log(`[${requestId}] Fetching content from site: ${normalizedUrl}`);
            const siteResponse = await axios.get(normalizedUrl, {
              timeout: 8000, // Увеличиваем таймаут для медленных сайтов
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
              }
            });
            
            // Получаем HTML контент
            const htmlContent = siteResponse.data;
            
            // Извлекаем мета-теги
            const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1].trim();
              console.log(`[${requestId}] Title: ${title}`);
            }
            
            const descriptionMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                             htmlContent.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
            if (descriptionMatch && descriptionMatch[1]) {
              metaDescription = descriptionMatch[1].trim();
              console.log(`[${requestId}] Description: ${metaDescription}`);
            }
            
            const keywordsMatch = htmlContent.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                          htmlContent.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']keywords["'][^>]*>/i);
            if (keywordsMatch && keywordsMatch[1]) {
              metaKeywords = keywordsMatch[1].trim();
              console.log(`[${requestId}] Keywords: ${metaKeywords}`);
            }
            
            // Извлекаем основной контент
            let mainContent = "";
            
            // Сначала пробуем найти основной контент в тегах с семантическим значением
            const contentElements = [
              /<article[^>]*>(.*?)<\/article>/is,
              /<main[^>]*>(.*?)<\/main>/is,
              /<div[^>]*class=["'](?:.*?content.*?|.*?main.*?|.*?body.*?)["'][^>]*>(.*?)<\/div>/is,
              /<div[^>]*id=["'](?:content|main|body)["'][^>]*>(.*?)<\/div>/is
            ];
            
            for (const pattern of contentElements) {
              const match = htmlContent.match(pattern);
              if (match && match[1] && match[1].length > mainContent.length) {
                mainContent = match[1];
              }
            }
            
            // Если не удалось найти основной контент, используем весь HTML
            if (!mainContent || mainContent.length < 500) {
              mainContent = htmlContent;
            }
            
            // Очищаем HTML от скриптов и стилей
            siteContent = mainContent
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
              .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, ' ')
              .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
              .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
              .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
              .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
              .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, ' ')
              .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
              
            // Удаляем повторы текста на странице
            const sentences = siteContent.split(/[.!?]+/);
            const uniqueSentences = new Set(sentences.map(s => s.trim()).filter(s => s.length > 20));
            siteContent = Array.from(uniqueSentences).join('. ');
            
            // Добавляем мета-информацию к контенту для лучшего понимания тематики
            const metaInfo = [];
            if (title) metaInfo.push(`Заголовок сайта: ${title}`);
            if (metaDescription) metaInfo.push(`Описание сайта: ${metaDescription}`);
            if (metaKeywords) metaInfo.push(`Ключевые слова сайта: ${metaKeywords}`);
            
            // Объединяем мета-информацию и контент
            const fullContent = [...metaInfo, `Основной контент сайта: ${siteContent}`].join('\n\n');
            
            // Ограничиваем размер контента
            siteContent = fullContent.substring(0, 8000);
            console.log(`[${requestId}] Successfully extracted ${siteContent.length} chars of content`);
          } catch (error) {
            console.error(`[${requestId}] Error fetching site content:`, error);
            // Если не удалось извлечь контент, хотя бы используем URL для анализа
            siteContent = `URL сайта: ${normalizedUrl}`;
            
            // Попытка извлечь информацию из URL
            try {
              const url = new URL(normalizedUrl);
              const domainParts = url.hostname.split('.');
              if (domainParts.length >= 2) {
                const domain = domainParts[domainParts.length - 2]; // Берем имя домена без TLD
                siteContent += `\n\nНазвание домена: ${domain}`;
                
                // Извлекаем пути из URL если они есть
                if (url.pathname && url.pathname !== '/' && url.pathname.length > 1) {
                  const pathParts = url.pathname.split('/').filter(Boolean);
                  siteContent += `\n\nСтруктура сайта: ${pathParts.join(', ')}`;
                }
              }
            } catch (urlError) {
              console.error(`[${requestId}] Error parsing URL:`, urlError);
            }
          }
          
          // Запрос к Perplexity с учетом контента сайта
          const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
              model: "llama-3.1-sonar-small-128k-online",
              messages: [
                {
                  role: "system",
                  content: `Ты эксперт по SEO и поисковым запросам. Твоя задача - проанализировать контент сайта и определить его ТОЧНУЮ тематику, чтобы затем составить список максимально релевантных ключевых слов, которые могли бы использовать потенциальные посетители этого сайта в поисковых системах.

ВАЖНО: Проведи глубокий анализ контента! Не ориентируйся только на URL, домен или заголовок. Анализируй всю предоставленную информацию о сайте, включая основной текст, мета-теги, заголовки страниц и описания.

Необходимо создать список из 15-20 самых релевантных ключевых слов и фраз, обязательно соблюдая следующие правила:

1. Ключевые слова должны быть на том же языке, что и контент сайта (русский, английский и т.д.)
2. Фразы должны быть реалистичными поисковыми запросами, которые люди могли бы вводить в поисковую систему
3. Включи разные типы запросов:
   - Высокочастотные (популярные общие запросы по тематике)
   - Среднечастотные (более специфичные запросы)
   - Низкочастотные (узконаправленные запросы с меньшей конкуренцией)
4. Для каждого ключевого слова реалистично оцени популярность (число запросов в месяц)
5. Оцени уровень конкуренции по каждому запросу по шкале от 0 до 100

Ответ предоставь ТОЛЬКО в виде JSON-массива объектов со следующими полями:
- keyword: ключевое слово или фраза (строка)
- trend: примерное количество запросов в месяц (число)
- competition: уровень конкуренции от 0 до 100 (число)`
                },
                {
                  role: "user",
                  content: siteContent 
                    ? `Вот содержимое сайта ${normalizedUrl}:\n\n${siteContent}\n\nПроанализируй этот контент и сгенерируй массив релевантных ключевых слов в JSON формате.`
                    : `Посети сайт ${normalizedUrl} и сгенерируй массив релевантных ключевых слов в JSON формате.`
                }
              ],
              max_tokens: 1000,
              temperature: 0.05, // Максимально низкая температура для стабильности
              random_seed: 12345, // Абсолютно фиксированный seed для одинаковых результатов при повторных запросах
              top_p: 0.9 // Ограничение разнообразия токенов
            },
            {
              headers: {
                'Authorization': `Bearer ${perplexityKey}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (!response.data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid API response structure');
          }
          
          // Извлекаем JSON из ответа
          const content = response.data.choices[0].message.content;
          console.log(`[${requestId}] Perplexity response content:`, content);
          
          // Логируем больше отладочной информации
          console.log(`[${requestId}] Used content length for analysis: ${siteContent.length} chars`);
          console.log(`[${requestId}] Title extracted: ${title || 'None'}`);
          console.log(`[${requestId}] Meta description extracted: ${metaDescription || 'None'}`);
          console.log(`[${requestId}] Meta keywords extracted: ${metaKeywords || 'None'}`);
          console.log(`[${requestId}] Request URL: ${normalizedUrl}`);
          
          // Улучшенный алгоритм извлечения JSON из текста
          // Ищем JSON массив в тексте, используя несколько методов
          let parsedKeywords = [];
          
          try {
            // Метод 1: Попытка найти массив JSON с помощью регулярного выражения
            const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              
              try {
                const parsedData = JSON.parse(jsonStr);
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                  parsedKeywords = parsedData;
                  console.log(`[${requestId}] Successfully extracted ${parsedKeywords.length} keywords using regex`);
                }
              } catch (jsonError) {
                console.error(`[${requestId}] Error parsing JSON from regex match:`, jsonError);
              }
            }
            
            // Метод 2: Если первый метод не сработал, пробуем найти начало и конец массива JSON
            if (parsedKeywords.length === 0) {
              const startIdx = content.indexOf('[');
              const endIdx = content.lastIndexOf(']');
              
              if (startIdx >= 0 && endIdx > startIdx) {
                const jsonStr = content.substring(startIdx, endIdx + 1);
                
                try {
                  const parsedData = JSON.parse(jsonStr);
                  if (Array.isArray(parsedData) && parsedData.length > 0) {
                    parsedKeywords = parsedData;
                    console.log(`[${requestId}] Successfully extracted ${parsedKeywords.length} keywords using direct indexing`);
                  }
                } catch (jsonError) {
                  console.error(`[${requestId}] Error parsing JSON from direct indexing:`, jsonError);
                }
              }
            }
            
            // Метод 3: Если предыдущие не сработали, пробуем извлечь всю структуру ответа как JSON
            if (parsedKeywords.length === 0) {
              try {
                // Очищаем строку от специальных символов и попробуем парсить
                const cleanContent = content.replace(/```json|```/g, '').trim();
                const parsedData = JSON.parse(cleanContent);
                
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                  parsedKeywords = parsedData;
                  console.log(`[${requestId}] Successfully extracted ${parsedKeywords.length} keywords from clean content`);
                }
              } catch (jsonError) {
                console.error(`[${requestId}] Error parsing clean content as JSON:`, jsonError);
              }
            }
          
            // Обрабатываем полученные ключевые слова
            if (parsedKeywords.length > 0) {
              console.log(`[${requestId}] Extracted ${parsedKeywords.length} keywords from Perplexity`);
              
              finalKeywords = parsedKeywords.map(item => ({
                keyword: item.keyword || "",
                trend: parseInt(item.trend) || Math.floor(Math.random() * 5000) + 1000,
                competition: parseInt(item.competition) || Math.floor(Math.random() * 100)
              })).filter(item => item.keyword && item.keyword.trim() !== "");
              
              console.log(`[${requestId}] Processed ${finalKeywords.length} valid keywords`);
            }
          } catch (processingError) {
            console.error(`[${requestId}] Error during keyword processing:`, processingError);
          }
        } catch (perplexityError) {
          console.error('Error using Perplexity API:', perplexityError);
        }
      }
      
      // Если перплексити не вернул результатов или это не URL, используем XMLRiver
      if (finalKeywords.length === 0) {
        console.log('Falling back to XMLRiver for keyword search');
        try {
          const xmlriverResponse = await axios.get(`http://xmlriver.com/wordstat/json`, {
            params: {
              user: process.env.XMLRIVER_USER || "16797",
              key: process.env.XMLRIVER_KEY || "f7947eff83104621deb713275fe3260bfde4f001",
              query: isUrl ? "контент для сайта" : req.params.keyword
            }
          });
          
          if (xmlriverResponse.data?.content?.includingPhrases?.items) {
            const allKeywords = xmlriverResponse.data.content.includingPhrases.items.map((item: any) => ({
              keyword: item.phrase,
              trend: parseInt(item.number.replace(/\s/g, '')),
              competition: Math.floor(Math.random() * 100)
            }));
            
            // Фильтруем результаты на нецензурную лексику
            finalKeywords = allKeywords.filter(item => 
              !offensiveWords.some(word => item.keyword.toLowerCase().includes(word))
            );
            
            // Сохраняем результаты в кеш для обычных ключевых слов
            if (!isUrl && finalKeywords.length > 0) {
              searchCache.set(keyword.toLowerCase().trim(), {
                timestamp: Date.now(),
                results: finalKeywords
              });
              console.log(`[${requestId}] Added ${finalKeywords.length} keywords to cache for "${keyword}"`);
            }
          }
        } catch (xmlriverError) {
          console.error('XMLRiver API error:', xmlriverError);
          // Если XMLRiver тоже не сработал, возвращаем пустой массив
          finalKeywords = [];
        }
      }
      
      console.log(`Final keywords: ${finalKeywords.length}`);
      
      // Сохраняем результаты в кеш, если это URL и результаты получены
      if (isUrl && finalKeywords.length > 0) {
        const normalizedUrl = keyword.startsWith('http') ? keyword : `https://${keyword}`;
        urlKeywordCache.set(normalizedUrl.toLowerCase(), {
          timestamp: Date.now(),
          results: finalKeywords
        });
        console.log(`[${requestId}] Added ${finalKeywords.length} keywords to cache for ${normalizedUrl}`);
      }
      
      res.json({ data: { keywords: finalKeywords } });
    } catch (error) {
      console.error('Keyword search error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Error searching for keywords"
      });
    }
  });

  // Sources routes
  app.post("/api/sources", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');
      const { name, url, type, campaignId, isActive } = req.body;

      if (!name || !url || !type || !campaignId) {
        return res.status(400).json({ 
          success: false, 
          error: "Отсутствуют обязательные поля",
          message: "Необходимо указать name, url, type и campaignId" 
        });
      }

      // Получаем информацию о пользователе из токена
      let userId;
      try {
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        userId = userResponse.data?.data?.id;
        if (!userId) {
          return res.status(401).json({ success: false, message: "Unauthorized: Cannot identify user" });
        }
      } catch (userError) {
        console.error("Error getting user from token:", userError);
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
      }

      // Создаем новый источник в Directus
      try {
        console.log(`Creating source: ${name} (${url}) for campaign: ${campaignId}`);
        
        const response = await directusApi.post('/items/campaign_content_sources', {
          name: name,
          url: url,
          type: type,
          campaign_id: campaignId,
          is_active: isActive !== undefined ? isActive : true
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Преобразуем ответ от Directus в наш формат
        const newSource = {
          id: response.data.data.id,
          name: response.data.data.name,
          url: response.data.data.url,
          type: response.data.data.type,
          isActive: response.data.data.is_active,
          campaignId: response.data.data.campaign_id,
          createdAt: response.data.data.created_at
        };

        console.log('Successfully created source:', newSource);

        return res.status(201).json({
          success: true,
          data: newSource,
          message: "Источник успешно добавлен"
        });
      } catch (directusError) {
        console.error("Error creating source in Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
          
          return res.status(directusError.response.status || 500).json({
            success: false,
            error: "Ошибка при создании источника",
            details: directusError.response.data
          });
        }
        
        return res.status(500).json({
          success: false,
          error: "Ошибка при создании источника",
          message: directusError instanceof Error ? directusError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error in POST /api/sources:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create source",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/sources", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      console.log("Fetching sources for campaign:", campaignId);

      // Get sources from Directus
      const authToken = req.headers.authorization;
      if (!authToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const response = await directusApi.get('/items/campaign_content_sources', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            },
            is_active: {
              _eq: true
            }
          },
          fields: ['id', 'name', 'url', 'type', 'is_active', 'campaign_id', 'created_at']
        },
        headers: {
          'Authorization': authToken
        }
      });

      console.log('Directus sources API response:', {
        status: response.status,
        dataLength: response.data?.data?.length,
        firstSource: response.data?.data?.[0]
      });

      res.json({ data: response.data?.data || [] });
    } catch (error) {
      console.error("Error fetching sources:", error);
      if (axios.isAxiosError(error)) {
        console.error('Directus API error details:', {
          status: error.response?.status,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            params: error.config?.params
          }
        });
      }
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  // Trends routes
  app.get("/api/trends", authenticateUser, async (req, res) => {
    try {
      const period = req.query.period as string;
      const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
      const authHeader = req.headers['authorization'];

      console.log("Fetching trends with params:", { period, campaignId });

      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');

      const from = new Date();
      switch (period) {
        case "3days":
          from.setDate(from.getDate() - 3);
          break;
        case "7days":
          from.setDate(from.getDate() - 7);
          break;
        case "14days":
          from.setDate(from.getDate() - 14);
          break;
        case "30days":
          from.setDate(from.getDate() - 30);
          break;
        default:
          from.setDate(from.getDate() - 7);
      }

      try {
        // Форматируем дату для фильтра в формате ISO
        const fromDateISO = from.toISOString();
        
        // Создаем фильтр для API запроса
        const filter: any = {
          created_at: {
            _gte: fromDateISO
          }
        };
        
        // Если указан campaignId, добавляем в фильтр
        if (campaignId) {
          filter.campaign_id = {
            _eq: campaignId
          };
        }
        
        // Получаем тренды напрямую из Directus API
        const response = await directusApi.get('/items/trend_topics', {
          params: {
            filter: filter,
            sort: ['-created_at']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const trends = response.data.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          sourceId: item.source_id,
          reactions: item.reactions,
          comments: item.comments,
          views: item.views,
          createdAt: item.created_at,
          campaignId: item.campaign_id
        }));
        
        console.log(`Found ${trends.length} trends`);
        res.json({ data: trends });
      } catch (directusError) {
        console.error("Error fetching trends from Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
        }
        
        return res.status(500).json({ error: "Failed to fetch trends" });
      }
    } catch (error) {
      console.error("Error in trends route:", error);
      res.status(500).json({ error: "Failed to fetch trends" });
    }
  });

  // Source Posts routes - для получения постов из источников
  app.get("/api/source-posts", async (req, res) => {
    try {
      const period = req.query.period as string;
      const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
      const sourceId = req.query.sourceId ? String(req.query.sourceId) : undefined;

      console.log("Fetching source posts with params:", { period, campaignId, sourceId });

      if (!campaignId) {
        return res.status(400).json({ error: "Campaign ID is required" });
      }

      const from = new Date();
      switch (period) {
        case "3days":
          from.setDate(from.getDate() - 3);
          break;
        case "7days":
          from.setDate(from.getDate() - 7);
          break;
        case "14days":
          from.setDate(from.getDate() - 14);
          break;
        case "30days":
          from.setDate(from.getDate() - 30);
          break;
        default:
          from.setDate(from.getDate() - 7);
      }

      // Get posts from Directus
      const authToken = req.headers.authorization;
      if (!authToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log("Making request to Directus with filter:", {
        campaign_id: campaignId,
        from: from.toISOString()
      });

      const response = await directusApi.get('/items/source_posts', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            },
            created_at: {
              _gte: from.toISOString()
            }
          },
          fields: ['id', 'postContent', 'source_id', 'campaign_id', 'created_at'],
          sort: ['-created_at']
        },
        headers: {
          'Authorization': authToken
        }
      });

      console.log('Directus API response:', {
        status: response.status,
        dataLength: response.data?.data?.length,
        firstPost: response.data?.data?.[0]
      });

      res.json({ data: response.data?.data || [] });
    } catch (error) {
      console.error("Error fetching source posts:", error);
      if (axios.isAxiosError(error)) {
        console.error('Directus API error details:', {
          status: error.response?.status,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            params: error.config?.params
          }
        });
      }
      res.status(500).json({ error: "Failed to fetch source posts" });
    }
  });

  // Trend collection endpoint
  app.post("/api/trends/collect", async (req, res) => {
    try {
      // Получаем токен аутентификации из заголовков
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized: Missing or invalid authorization header" });
      }
      const token = authHeader.replace('Bearer ', '');

      // Получаем user_id из заголовка или токена
      let userId: string;
      if (req.headers["x-user-id"]) {
        userId = req.headers["x-user-id"] as string;
      } else {
        try {
          // Получаем информацию о пользователе из токена
          const userResponse = await directusApi.get('/users/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          userId = userResponse.data?.data?.id;
          if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Cannot identify user" });
          }
        } catch (userError) {
          console.error("Error getting user from token:", userError);
          return res.status(401).json({ message: "Unauthorized: Invalid token" });
        }
      }

      const { campaignId } = req.body;
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      // Проверяем существование кампании через Directus
      try {
        const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!campaignResponse.data?.data) {
          return res.status(404).json({ message: "Campaign not found" });
        }
      } catch (error) {
        console.error("Error fetching campaign from Directus:", error);
        return res.status(500).json({ message: "Failed to verify campaign", error: String(error) });
      }

      // Получаем ключевые слова для этой кампании
      const keywordsResponse = await directusApi.get('/items/user_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          }
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!keywordsResponse.data?.data || keywordsResponse.data.data.length === 0) {
        return res.status(400).json({ message: "No keywords found for this campaign" });
      }

      const keywordsList = keywordsResponse.data.data.map((k: { keyword: string }) => k.keyword);
      console.log('Sending keywords to webhook:', keywordsList);
      
      // Отправляем запрос на webhook n8n с ключевыми словами кампании
      // Добавляем информацию о запросе
      console.log('Sending webhook request to n8n with payload:', {
        campaignId,
        keywordsCount: keywordsList.length,
        userId
      });
      
      let webhookResponse = { status: 500, data: null };
      try {
        // Создаем отдельный идентификатор запроса для отслеживания
        const requestId = crypto.randomUUID();
        
        webhookResponse = await axios.post('https://n8n.nplanner.ru/webhook/df4257a3-deb1-4c73-82ea-44deead48939', {
          campaignId: campaignId,
          keywords: keywordsList,
          userId: userId,
          requestId: requestId,
          // Не передаем токен пользователя в webhook, используем requestId для идентификации
        }, {
          headers: {
            'Content-Type': 'application/json',
            // Используем только API ключ для авторизации в N8N
            'X-N8N-Authorization': process.env.N8N_API_KEY || '',
          },
          timeout: 30000 // 30 секунд таймаут
        });
        
        console.log('Webhook response status:', webhookResponse.status);
        if (webhookResponse.data) {
          console.log('Webhook response preview:', JSON.stringify(webhookResponse.data).substring(0, 200));
          console.log('Webhook response type:', typeof webhookResponse.data);
          
          // Обработка разных форматов данных - массив или объект
          let postsToProcess = [];
          
          // Проверяем формат данных ответа
          if (Array.isArray(webhookResponse.data)) {
            // Ответ является массивом постов
            console.log('Response is an array of posts, processing directly');
            postsToProcess = webhookResponse.data;
          } else if (webhookResponse.data.trendTopics && Array.isArray(webhookResponse.data.trendTopics)) {
            // Ответ содержит массив trendTopics
            console.log('Response contains trendTopics array');
            postsToProcess = webhookResponse.data.trendTopics;
          } else if (webhookResponse.data.posts && Array.isArray(webhookResponse.data.posts)) {
            // Ответ содержит массив posts
            console.log('Response contains posts array');
            postsToProcess = webhookResponse.data.posts;
          } else if (webhookResponse.data.trends && Array.isArray(webhookResponse.data.trends)) {
            // Ответ содержит массив trends
            console.log('Response contains trends array');
            postsToProcess = webhookResponse.data.trends;
          }
          
          if (postsToProcess.length > 0) {
            console.log(`Processing ${postsToProcess.length} posts/topics from webhook response`);
            
            let savedCount = 0;
            const errors: Error[] = [];
            
            // Обрабатываем каждый пост и сохраняем в базу данных
            for (const post of postsToProcess) {
              try {
                // Определяем формат данных - TG пост или обычный тренд
                const isTelegramPost = post.text !== undefined;
                
                const trendTopic: InsertCampaignTrendTopic = {
                  // Для TG-постов используем первые 255 символов text как title, иначе используем title
                  title: isTelegramPost 
                    ? (post.text ? post.text.substring(0, 255) : 'Untitled Post') 
                    : (post.title || 'Untitled Topic'),
                  
                  // Для TG-постов используем channel_id или url, иначе sourceId
                  sourceId: isTelegramPost 
                    ? (post.channel_id || post.url || 'unknown') 
                    : (post.sourceId || 'unknown'),
                  
                  // Преобразуем метрики соответственно
                  reactions: isTelegramPost 
                    ? (post.reactions || 0) 
                    : (post.reactions || 0),
                  
                  comments: isTelegramPost 
                    ? (post.comments || 0) 
                    : (post.comments || 0),
                  
                  views: isTelegramPost 
                    ? (post.views || 0) 
                    : (post.views || 0),
                  
                  campaignId: campaignId,
                  isBookmarked: false
                };
                
                console.log(`Saving trend topic: ${trendTopic.title.substring(0, 30)}... from ${trendTopic.sourceId}`);
                
                // Создаем запись в Directus API напрямую
                try {
                  const payload = {
                    title: trendTopic.title || '',
                    source_id: trendTopic.sourceId || '',
                    reactions: trendTopic.reactions || 0,
                    comments: trendTopic.comments || 0,
                    views: trendTopic.views || 0,
                    campaign_id: String(campaignId),
                    is_bookmarked: false
                  };
                  
                  console.log('Sending payload to Directus:', JSON.stringify(payload).substring(0, 100));
                  
                  // Используем storage.createCampaignTrendTopic вместо прямого вызова Directus API
                  const trendTopicData: InsertCampaignTrendTopic = {
                    title: payload.title,
                    sourceId: payload.source_id,
                    campaignId: payload.campaign_id,
                    reactions: payload.reactions,
                    comments: payload.comments,
                    views: payload.views,
                    isBookmarked: payload.is_bookmarked
                  };
                  
                  console.log('Saving trend topic using storage:', JSON.stringify(trendTopicData).substring(0, 100));
                  const response = await storage.createCampaignTrendTopic(trendTopicData);
                  
                  console.log('Successfully saved trend topic with id:', response.id);
                } catch (storageError) {
                  console.error('Error saving trend topic to database:', storageError);
                  throw storageError;
                }
                savedCount++;
              } catch (err) {
                console.error("Error saving trend topic:", err);
                if (err instanceof Error) {
                  errors.push(err);
                } else {
                  errors.push(new Error(String(err)));
                }
              }
            }
            
            console.log(`Successfully saved ${savedCount} of ${postsToProcess.length} trend topics`);
          } else {
            console.log('No posts to process in the webhook response');
          }
        }
      } catch (error) {
        console.error('Error calling n8n webhook:', error instanceof Error ? error.message : String(error));
        if (axios.isAxiosError(error)) {
          console.error('Webhook response status:', error.response?.status);
          console.error('Webhook response data:', error.response?.data);
          
          // Проверяем, есть ли частичные данные в ответе
          if (error.response?.data?.trendTopics && Array.isArray(error.response.data.trendTopics)) {
            console.log(`Found ${error.response.data.trendTopics.length} trend topics in error response, attempting to process`);
            // Process the partial data if available
            // ... (аналогично обработке выше)
          }
        }
        // Продолжаем выполнение, чтобы клиент получил хотя бы частичный ответ
      }
      
      // Предполагаем, что вебхук работает, даже если у нас нет явного ответа
      console.log('Webhook request sent successfully');

      res.json({
        success: true,
        message: "Trend collection started via n8n webhook",
        data: {
          keywordsCount: keywordsList.length,
          campaignId,
          webhookStatus: webhookResponse && webhookResponse.status === 200 ? 'success' : 'error'
        }
      });
    } catch (error) {
      console.error("Error collecting trends:", error);
      res.status(500).json({ 
        error: "Failed to collect trends", 
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Modified sources/collect endpoint to use n8n webhook
  app.post("/api/sources/collect", async (req, res) => {
    // Устанавливаем заголовок Content-Type явно, чтобы клиент всегда получал JSON
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');
      const { keywords } = req.body;
      
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Требуется указать ключевые слова для поиска",
          message: "Требуется указать ключевые слова для поиска" 
        });
      }
      
      console.log('Starting source search for keywords:', keywords);
      
      // Получаем информацию о пользователе из токена
      let userId;
      try {
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        userId = userResponse.data?.data?.id;
        if (!userId) {
          return res.status(401).json({ success: false, message: "Unauthorized: Cannot identify user" });
        }
      } catch (userError) {
        console.error("Error getting user from token:", userError);
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
      }

      console.log('Searching for sources with keywords:', keywords);

      // Check cache for quick response first
      const cachedResults = keywords.map((keyword: any) => {
        const cached = getCachedResults(keyword);
        if (cached) {
          console.log(`Using ${cached.length} cached results for keyword: ${keyword}`);
          return cached;
        }
        return null;
      });

      // If all keywords have cached results, merge and return them
      if (cachedResults.every((result: any) => result !== null)) {
        console.log('All results found in cache');
        const uniqueSources = cachedResults.flat().reduce((acc: any[], source) => {
          if (!acc.some(s => s.url === source.url)) {
            acc.push(source);
          }
          return acc;
        }, []);

        return res.json({
          success: true,
          data: {
            sources: uniqueSources
          }
        });
      }

      // Отправка запроса на webhook n8n для поиска источников
      console.log('Sending webhook request to n8n for source search');
      
      try {
        // Создаем идентификатор запроса для безопасного отслеживания
        const requestId = crypto.randomUUID();
        
        const webhookResponse = await axios.post('https://n8n.nplanner.ru/webhook/767bbaf6-e9ca-4f1d-aeb6-66598ff7e291', {
          keywords: keywords,
          userId: userId,
          requestId: requestId,
          // Не передаем токен пользователя в webhook
        }, {
          headers: {
            'Content-Type': 'application/json',
            // Используем только API ключ для авторизации в N8N
            'X-N8N-Authorization': process.env.N8N_API_KEY || ''
          },
          timeout: 30000 // 30 секунд таймаут
        });
        
        console.log('Webhook source search response status:', webhookResponse.status);

        // Если n8n вернул результаты, используем их
        if (webhookResponse.data && webhookResponse.data.sources) {
          console.log(`Received ${webhookResponse.data.sources.length} sources from n8n webhook`);
          
          // Кешируем результаты поиска
          keywords.forEach((keyword: string) => {
            const sourcesForKeyword = webhookResponse.data.sourcesMap && 
                                     webhookResponse.data.sourcesMap[keyword] ? 
                                     webhookResponse.data.sourcesMap[keyword] : 
                                     webhookResponse.data.sources;
            
            if (sourcesForKeyword && sourcesForKeyword.length > 0) {
              console.log(`Caching ${sourcesForKeyword.length} results for keyword: ${keyword}`);
              searchCache.set(keyword, {
                timestamp: Date.now(),
                results: sourcesForKeyword
              });
            }
          });
          
          return res.json({
            success: true,
            data: {
              sources: webhookResponse.data.sources
            }
          });
        } else {
          // Если n8n не вернул результаты, возвращаемся к обычному поиску
          console.log('No sources in webhook response, falling back to regular search');
          
          // Собираем источники из нескольких сервисов для ключевых слов без кеша
          const fallbackResults = await Promise.all(
            keywords.map(async (keyword: string, index: number) => {
              if (cachedResults[index]) {
                return cachedResults[index];
              }

              // В случае если Social Searcher недоступен, используем только Perplexity
              const [socialResults, perplexityResults] = await Promise.all([
                searchSocialSourcesByKeyword(keyword, token),
                existingPerplexitySearch(keyword, token)
              ]);

              const results = [...socialResults, ...perplexityResults];

              // Cache the results
              if (results.length > 0) {
                console.log(`Caching ${results.length} results for keyword: ${keyword}`);
                searchCache.set(keyword, {
                  timestamp: Date.now(),
                  results
                });
              }

              return results;
            })
          );
          
          // Объединяем результаты и удаляем дубликаты
          const uniqueSourcesFallback = fallbackResults.flat().reduce((acc: any[], source) => {
            const exists = acc.some(s => s.url === source.url);
            if (!exists) {
              acc.push(source);
            }
            return acc;
          }, []);
          
          console.log(`Found ${uniqueSourcesFallback.length} unique sources from fallback search`);
          
          return res.json({
            success: true,
            data: {
              sources: uniqueSourcesFallback
            }
          });
        }
      } catch (webhookError) {
        console.error('Error calling n8n webhook for source search:', webhookError);
        
        // В случае ошибки webhook, возвращаемся к обычному поиску
        console.log('Webhook error, falling back to regular search');
        
        // Собираем источники из нескольких сервисов для ключевых слов без кеша
        const fallbackResults = await Promise.all(
          keywords.map(async (keyword: string, index: number) => {
            if (cachedResults[index]) {
              return cachedResults[index];
            }

            // В случае если Social Searcher недоступен, используем только Perplexity
            const [socialResults, perplexityResults] = await Promise.all([
              searchSocialSourcesByKeyword(keyword, token),
              existingPerplexitySearch(keyword, token)
            ]);

            const results = [...socialResults, ...perplexityResults];

            // Cache the results
            if (results.length > 0) {
              console.log(`Caching ${results.length} results for keyword: ${keyword}`);
              searchCache.set(keyword, {
                timestamp: Date.now(),
                results
              });
            }

            return results;
          })
        );
        
        // Объединяем результаты и удаляем дубликаты
        const uniqueSourcesFallback = fallbackResults.flat().reduce((acc: any[], source) => {
          const exists = acc.some(s => s.url === source.url);
          if (!exists) {
            acc.push(source);
          }
          return acc;
        }, []);
        
        console.log(`Found ${uniqueSourcesFallback.length} unique sources from fallback search after webhook error`);
        
        return res.json({
          success: true,
          data: {
            sources: uniqueSourcesFallback
          }
        });
      }

      // Этот код никогда не должен выполняться из-за возвращаемых значений в блоках выше
      return res.status(500).json({
        error: "Unexpected error in /api/sources/collect",
        message: "Please check server logs"
      });

    } catch (error) {
      console.error('Error in /api/sources/collect:', error);
      res.status(500).json({
        error: "Failed to collect sources",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Apify social media parsing endpoint
  app.post("/api/sources/parse", async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        console.error('Missing authorization header');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');

      const { url, sourceType } = req.body;
      if (!url || !sourceType) {
        return res.status(400).json({ error: "URL and source type are required" });
      }

      res.status(501).json({ error: "Not Implemented" });

    } catch (error) {
      console.error('Error parsing source:', error);
      res.status(500).json({
        error: "Failed to parse source",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Single source crawling endpoint
  app.post("/api/sources/:sourceId/crawl", async (req, res) => {
    try {
      const sourceId = req.params.sourceId;
      const { campaignId } = req.body;

      if (!sourceId || !campaignId) {
        console.error('Missing required parameters:', { sourceId, campaignId });
        return res.status(400).json({ 
          success: false,
          message: "Source ID and Campaign ID are required" 
        });
      }
      
      // Получаем имя источника из запроса клиента вместо запроса к серверу
      // Клиент уже получил список источников, поэтому он знает имя источника
      const sourceName = req.body.sourceName || req.query.sourceName || sourceId;
      console.log(`Starting crawl process for source: ${sourceName} (${sourceId}) in campaign: ${campaignId}`);
      
      try {
        // Отправляем запрос на n8n webhook для сбора постов из источника
        const webhookUrl = 'https://n8n.nplanner.ru/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c';
        
        // Отправляем только sourceId и campaignId без авторизации
        const webhookResponse = await axios.post(webhookUrl, {
          sourceId,
          campaignId
        });
        
        console.log('Webhook response:', webhookResponse.status);
        
        // Возвращаем успешный результат с указанием имени источника, если оно доступно
        return res.status(200).json({
          success: true,
          message: `Задача на сбор постов из источника успешно запущена`,
          sourceId: sourceId,
          campaignId: campaignId,
          sourceName: sourceName // Передаем имя источника на фронтенд
        });
      } catch (crawlError) {
        console.error("Error calling webhook:", crawlError);
        
        // Проверяем, есть ли ответ от сервера
        if (axios.isAxiosError(crawlError) && crawlError.response) {
          console.error('Webhook error response:', {
            status: crawlError.response.status,
            data: crawlError.response.data
          });
        }
        
        res.status(500).json({ 
          success: false,
          error: "Failed to start crawling task",
          message: crawlError instanceof Error ? crawlError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Unexpected error in crawl endpoint:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to process request",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const followerRequirements: PlatformRequirements = {
    'youtube.com': 100000,
    'reddit.com': 50000,
    'vk.com': 10000,
    't.me': 5000,
    'instagram.com': 50000,
    'twitter.com': 10000,
    'x.com': 10000
  };

  // Массив для хранения кампаний в разработке
  const devCampaigns: any[] = [
    {
      id: "46868c44-c6a4-4bed-accf-9ad07bba790e",
      name: "Правильное питание",
      description: "Кампания о правильном питании и здоровом образе жизни",
      userId: "user123",
      createdAt: new Date().toISOString()
    },
    {
      id: "76d7eb6e-dc8b-4d4f-a8b0-aa72bf6136f0",
      name: "Фитнес тренировки",
      description: "Кампания о фитнесе и спортивных тренировках",
      userId: "user123",
      createdAt: new Date().toISOString()
    }
  ];

  // Endpoint to get all campaigns for the user
  // Webhook endpoint для получения трендовых данных от n8n
  app.post("/api/trends/webhook", async (req, res) => {
    try {
      console.log("Received trend data from n8n webhook");
      
      // Получаем токен только из заголовка авторизации, это безопаснее
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace('Bearer ', '') : null;
      
      if (!token) {
        console.error("No authorization token provided for webhook");
        return res.status(401).json({
          error: "Authorization required",
          message: "No token provided"
        });
      }
      
      // Поддерживаем два формата данных: старый (trends) и новый (posts из TG)
      const posts = req.body.posts || [];
      const trends = req.body.trends || [];
      const { campaignId, userId } = req.body;
      
      // Используем данные из массива posts, если он есть, иначе из trends
      const trendsData = posts.length > 0 ? posts : trends;
      
      if (!trendsData.length || !campaignId || !userId) {
        console.error("Invalid webhook data format:", req.body);
        return res.status(400).json({ 
          error: "Invalid data format", 
          message: "Required fields: trends or posts (array), campaignId (string), and userId (string)" 
        });
      }
      
      console.log(`Processing ${trendsData.length} trends for campaign ${campaignId} (data format: ${posts.length > 0 ? 'TG posts' : 'trends'})`);
      
      let savedCount = 0;
      const errors: Error[] = [];
      
      // Обрабатываем каждый тренд и сохраняем в базу данных
      for (const post of trendsData) {
        try {
          // Определяем формат данных - TG пост или обычный тренд
          const isTelegramPost = post.text !== undefined;
          
          const trendTopic: InsertCampaignTrendTopic = {
            // Для TG-постов используем первые 255 символов text как title, иначе используем title
            title: isTelegramPost 
              ? (post.text ? post.text.substring(0, 255) : 'Untitled Post') 
              : post.title,
            
            // Для TG-постов используем channel_id или url, иначе sourceId
            sourceId: isTelegramPost 
              ? (post.channel_id || post.url || 'unknown') 
              : post.sourceId,
            
            // Преобразуем метрики соответственно
            reactions: isTelegramPost 
              ? (post.reactions || 0) 
              : (post.reactions || 0),
            
            comments: isTelegramPost 
              ? (post.comments || 0) 
              : (post.comments || 0),
            
            views: isTelegramPost 
              ? (post.views || 0) 
              : (post.views || 0),
            
            campaignId: campaignId,
            isBookmarked: false
          };
          
          console.log(`Saving trend topic: ${trendTopic.title.substring(0, 30)}... from ${trendTopic.sourceId}, metrics: views=${trendTopic.views}, reactions=${trendTopic.reactions}, comments=${trendTopic.comments}`);
          
          // Используем storage вместо прямого обращения к Directus API
          await storage.createCampaignTrendTopic(trendTopic);
          savedCount++;
        } catch (err) {
          console.error("Error saving trend:", err);
          if (err instanceof Error) {
            errors.push(err);
          } else {
            errors.push(new Error(String(err)));
          }
        }
      }
      
      console.log(`Successfully saved ${savedCount} of ${trendsData.length} trends`);
      
      res.json({
        success: true,
        message: `Processed ${trendsData.length} trends`,
        saved: savedCount,
        errors: errors.length > 0 ? errors.map(e => e.message) : null
      });
    } catch (error) {
      console.error("Error processing webhook data:", error);
      res.status(500).json({ 
        error: "Failed to process trend data", 
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Маршрут для получения кампаний пользователя
  app.get("/api/campaigns", authenticateUser, async (req, res) => {
    try {
      // Получаем userId двумя способами - из middleware authenticateUser или из заголовка
      const authenticatedUserId = (req as any).userId;
      const headerUserId = req.headers['x-user-id'];
      
      // Выбираем userId из доступных источников
      const userId = authenticatedUserId || 
                    (typeof headerUserId === 'string' ? headerUserId : 
                    Array.isArray(headerUserId) ? headerUserId[0] : null);
      
      const authHeader = req.headers['authorization'] || req.headers.authorization;
      
      if (!userId) {
        console.log("Missing userId (auth middleware and header)");
        return res.status(401).json({ error: "Не авторизован: отсутствует идентификатор пользователя" });
      }
      
      if (!authHeader) {
        console.log("Missing authorization header");
        return res.status(401).json({ error: "Не авторизован: отсутствует заголовок авторизации" });
      }
      
      // Проверяем, что формат заголовка соответствует ожидаемому
      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.replace('Bearer ', '')
        : Array.isArray(authHeader) && authHeader[0].startsWith('Bearer ')
          ? authHeader[0].replace('Bearer ', '')
          : null;
      
      if (!token) {
        console.log("Invalid token format in header");
        return res.status(401).json({ error: "Неверный формат токена авторизации" });
      }
          
      try {
        console.log(`Fetching campaigns for user: ${userId}`);
        
        // Получаем кампании из Directus, СТРОГО фильтруя по user_id
        console.log(`Sending request to Directus with filter user_id = ${userId}`);
        
        const response = await directusApi.get('/items/user_campaigns', {
          params: {
            filter: JSON.stringify({
              "user_id": {
                "_eq": userId
              }
            }),
            // Обеспечиваем, чтобы вернулись только кампании указанного пользователя
            "fields": ["*", "user_id"]
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Проверяем, что получили массив
        if (!Array.isArray(response.data.data)) {
          console.error("Unexpected response format from Directus:", response.data);
          return res.status(500).json({ error: "Неожиданный формат ответа от Directus API" });
        }
        
        // Строго фильтруем по userId перед преобразованием
        console.log('Filtering server-side for userId:', userId);
        
        // Преобразуем userId к строке для безопасного сравнения
        const stringUserId = String(userId);
        const filteredItems = response.data.data.filter((item: any) => {
          const itemUserId = String(item.user_id);
          const matches = itemUserId === stringUserId;
          
          if (!matches) {
            console.log(`Item user_id mismatch: ${itemUserId} !== ${stringUserId}`);
          }
          
          return matches;
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const campaigns = filteredItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          userId: item.user_id,
          createdAt: item.created_at,
          socialMediaSettings: item.social_media_settings || null,
          trendAnalysisSettings: item.trend_analysis_settings || {
            minFollowers: {
              instagram: 5000,
              telegram: 2000,
              vk: 3000,
              facebook: 5000,
              youtube: 10000
            },
            maxSourcesPerPlatform: 10,
            maxTrendsPerSource: 5
          }
        }));
        
        console.log(`Found ${campaigns.length} campaigns for user ${userId} (filtered from ${response.data.data.length} total)`);
        
        // Дополнительная отладочная информация для ЛЮБОГО результата
        console.log('All campaign user_ids in response:', response.data.data.map((item: any) => item.user_id).join(', '));
        console.log('User ID from request:', userId);
        console.log('Types - userId:', typeof userId, 'first db userId:', typeof response.data.data[0]?.user_id);
        
        // Проверяем все кампании и логгируем те, что не соответствуют userId
        const wrongCampaigns = response.data.data.filter((item: any) => item.user_id !== userId);
        if (wrongCampaigns.length > 0) {
          console.log('WARNING: Found campaigns with wrong user_id:', 
            wrongCampaigns.map((item: any) => ({
              id: item.id,
              name: item.name,
              user_id: item.user_id
            }))
          );
        }
        
        res.json({ data: campaigns });
      } catch (error) {
        console.error("Error fetching campaigns:", error);
        if (axios.isAxiosError(error)) {
          console.error('Directus API error details:', {
            status: error.response?.status,
            data: error.response?.data,
            config: {
              url: error.config?.url,
              method: error.config?.method,
              params: error.config?.params
            }
          });
        }
        res.status(500).json({ error: "Не удалось загрузить кампании" });
      }
    } catch (error) {
      console.error("Error in campaigns route:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Endpoint для получения трендовых тем кампании
  app.get("/api/campaign-trends", authenticateUser, async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      const period = req.query.period as string || '7days';
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "Campaign ID is required" });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      let fromDate: Date | undefined;
      
      // Определяем период для фильтрации данных
      switch (period) {
        case '3days':
          fromDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
          break;
        case '7days':
          fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '14days':
          fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }
      
      try {
        console.log(`Fetching trend topics for campaign: ${campaignId}, period: ${period}`);
        
        // Форматируем дату для фильтра в формате ISO
        const fromDateISO = fromDate.toISOString();
        
        // Получаем темы напрямую из Directus API
        const response = await directusApi.get('/items/campaign_trend_topics', {
          params: {
            filter: {
              campaign_id: {
                _eq: campaignId
              },
              created_at: {
                _gte: fromDateISO
              }
            },
            sort: ['-created_at']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const trendTopics = response.data.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          sourceId: item.source_id,
          reactions: item.reactions,
          comments: item.comments,
          views: item.views,
          createdAt: item.created_at,
          isBookmarked: item.is_bookmarked,
          campaignId: item.campaign_id
        }));
        
        console.log(`Found ${trendTopics.length} trend topics for campaign ${campaignId}`);
        
        res.json({ 
          success: true,
          data: trendTopics 
        });
      } catch (directusError) {
        console.error("Error fetching trend topics from Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
        }
        
        return res.status(500).json({ 
          success: false,
          error: "Не удалось получить тренды", 
          message: directusError instanceof Error ? directusError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error fetching campaign trend topics:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch campaign trend topics",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Endpoint для закладок трендовых тем
  app.patch("/api/campaign-trends/:id/bookmark", authenticateUser, async (req, res) => {
    try {
      const topicId = req.params.id;
      const { isBookmarked } = req.body;
      const authHeader = req.headers['authorization'];
      
      if (typeof isBookmarked !== 'boolean') {
        return res.status(400).json({ 
          success: false,
          error: "isBookmarked field (boolean) is required" 
        });
      }
      
      if (!authHeader) {
        return res.status(401).json({ 
          success: false,
          error: "Unauthorized" 
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Обновляем статус закладки через Directus API
        const response = await directusApi.patch(`/items/campaign_trend_topics/${topicId}`, {
          is_bookmarked: isBookmarked
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.data || !response.data.data) {
          return res.status(404).json({ 
            success: false,
            error: "Topic not found" 
          });
        }
        
        // Преобразуем данные из формата Directus в наш формат
        const updatedTopic = {
          id: response.data.data.id,
          title: response.data.data.title,
          sourceId: response.data.data.source_id,
          reactions: response.data.data.reactions,
          comments: response.data.data.comments,
          views: response.data.data.views,
          createdAt: response.data.data.created_at,
          isBookmarked: response.data.data.is_bookmarked,
          campaignId: response.data.data.campaign_id
        };
        
        res.json({ 
          success: true,
          data: updatedTopic 
        });
      } catch (directusError) {
        console.error("Error updating bookmark in Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
          
          if (directusError.response.status === 404) {
            return res.status(404).json({ 
              success: false,
              error: "Topic not found" 
            });
          }
        }
        
        return res.status(500).json({ 
          success: false,
          error: "Failed to update bookmark status",
          message: directusError instanceof Error ? directusError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error updating bookmark status:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update bookmark status",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Campaign Keywords routes
  app.get("/api/keywords", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      
      if (!campaignId) {
        return res.status(400).json({ error: "Campaign ID is required" });
      }
      
      console.log("Fetching keywords for campaign:", campaignId);
      
      // Получаем токен из заголовка
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Получаем ключевые слова из Directus через таблицу user_keywords
        const response = await directusApi.get('/items/user_keywords', {
          params: {
            filter: {
              campaign_id: {
                _eq: campaignId
              }
            },
            fields: ['id', 'keyword', 'trend_score', 'campaign_id']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('Directus keywords API response:', {
          status: response.status,
          dataLength: response.data?.data?.length,
          firstKeyword: response.data?.data?.[0]
        });
        
        // Преобразуем данные из Directus в нужный формат
        const keywords = (response.data?.data || []).map((item: any) => ({
          id: item.id,
          keyword: item.keyword,
          trendScore: item.trend_score
        }));
        
        res.json({ data: keywords });
      } catch (error) {
        console.error('Error fetching keywords from Directus:', error);
        if (axios.isAxiosError(error)) {
          console.error('Directus API error details:', {
            status: error.response?.status,
            data: error.response?.data,
            config: {
              url: error.config?.url,
              method: error.config?.method,
              params: error.config?.params
            }
          });
        }
        return res.status(401).json({ error: "Invalid token or failed to fetch keywords" });
      }
    } catch (error) {
      console.error("Error fetching keywords:", error);
      res.status(500).json({ error: "Failed to fetch keywords" });
    }
  });

  // Campaign Content routes
  app.get("/api/campaign-content", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Fetching content for campaign ID: ${campaignId || 'all campaigns'}`);
        
        // Получаем ID пользователя из токена
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Вместо storage API, получаем контент напрямую из Directus API
        const response = await directusApi.get('/items/campaign_content', {
          params: {
            filter: JSON.stringify({
              user_id: {
                _eq: userId
              },
              ...(campaignId ? { campaign_id: { _eq: campaignId } } : {})
            }),
            sort: ['-created_at']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Проверяем, что получили массив
        if (!Array.isArray(response.data.data)) {
          console.error("Unexpected response format from Directus:", response.data);
          return res.status(500).json({ error: "Неожиданный формат ответа от Directus API" });
        }
        
        // Преобразуем данные из формата Directus в наш формат
        const contentItems = response.data.data.map((item: any) => ({
          id: item.id,
          campaignId: item.campaign_id,
          userId: item.user_id,
          title: item.title,
          content: item.content,
          contentType: item.content_type,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          prompt: item.prompt,
          keywords: item.keywords || [],
          hashtags: item.hashtags || [],
          links: item.links || [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {},
          metadata: item.metadata || {}
        }));
        
        console.log(`Found ${contentItems.length} content items for campaign ${campaignId || 'all'}`);
        
        // Для отладки выводим ключевые слова из первого элемента
        if (contentItems.length > 0) {
          const sample = contentItems[0];
          console.log('Sample keywords being sent to client:', typeof sample.keywords, JSON.stringify(sample.keywords));
        }
        
        res.json({ data: contentItems });
      } catch (error) {
        console.error('Error getting campaign content:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
        }
        return res.status(401).json({ error: "Invalid token or failed to fetch content" });
      }
    } catch (error) {
      console.error("Error fetching campaign content:", error);
      res.status(500).json({ error: "Failed to fetch campaign content" });
    }
  });

  app.get("/api/campaign-content/:id", async (req, res) => {
    try {
      const contentId = req.params.id;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Fetching content with ID: ${contentId}`);
        
        // Получаем ID пользователя из токена для проверки прав доступа
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Получаем контент напрямую из Directus API
        const response = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.data || !response.data.data) {
          return res.status(404).json({ error: "Content not found" });
        }
        
        const item = response.data.data;
        
        // Проверяем, принадлежит ли контент пользователю
        if (item.user_id !== userId) {
          return res.status(403).json({ error: "You don't have permission to view this content" });
        }
        
        // Преобразуем данные из формата Directus в наш формат
        const content = {
          id: item.id,
          campaignId: item.campaign_id,
          userId: item.user_id,
          title: item.title,
          content: item.content,
          contentType: item.content_type,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          prompt: item.prompt,
          keywords: item.keywords || [],
          hashtags: item.hashtags || [],
          links: item.links || [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {},
          metadata: item.metadata || {}
        };
        
        res.json({ data: content });
      } catch (error) {
        console.error('Error getting campaign content by ID:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
          if (error.response.status === 404) {
            return res.status(404).json({ error: "Content not found" });
          }
        }
        return res.status(401).json({ error: "Invalid token or failed to fetch content" });
      }
    } catch (error) {
      console.error("Error fetching campaign content:", error);
      res.status(500).json({ error: "Failed to fetch campaign content" });
    }
  });

  app.post("/api/campaign-content", async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log("Creating new campaign content");
        
        // Получаем ID пользователя из токена - это обязательное поле для Directus
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Создаем контент кампании напрямую через Directus API
        const directusPayload = {
          campaign_id: req.body.campaignId,
          content_type: req.body.contentType, 
          title: req.body.title,
          content: req.body.content,
          image_url: req.body.imageUrl,
          video_url: req.body.videoUrl,
          // Проверяем, что keywords это массив
          keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
          status: req.body.status || "draft",
          user_id: userId
          // created_at генерируется автоматически в БД
        };
        
        console.log("Creating campaign content:", JSON.stringify(directusPayload).substring(0, 200));
        
        // Создаем запись через Directus API
        const response = await directusApi.post('/items/campaign_content', directusPayload, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.data || !response.data.data) {
          throw new Error('Failed to create content, invalid response from Directus');
        }
        
        const item = response.data.data;
        
        // Преобразуем данные из формата Directus в наш формат
        const content = {
          id: item.id,
          campaignId: item.campaign_id,
          userId: item.user_id,
          title: item.title,
          content: item.content,
          contentType: item.content_type,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          prompt: item.prompt,
          keywords: item.keywords || [],
          hashtags: item.hashtags || [],
          links: item.links || [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {},
          metadata: item.metadata || {}
        };
        
        res.status(201).json({ data: content });
      } catch (error) {
        console.error('Error creating campaign content:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        return res.status(401).json({ error: "Invalid token or failed to create content" });
      }
    } catch (error) {
      console.error("Error creating campaign content:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create campaign content" });
    }
  });

  app.patch("/api/campaign-content/:id", async (req, res) => {
    try {
      const contentId = req.params.id;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Updating content with ID: ${contentId}`);
        
        // Получаем ID пользователя из токена - это может потребоваться для обновления
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Получаем текущий контент напрямую из Directus API для проверки
        const existingContentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!existingContentResponse.data || !existingContentResponse.data.data) {
          return res.status(404).json({ error: "Content not found" });
        }
        
        const existingItem = existingContentResponse.data.data;
        
        // Проверяем, принадлежит ли контент пользователю
        if (existingItem.user_id !== userId) {
          return res.status(403).json({ error: "You don't have permission to update this content" });
        }
        
        // Преобразуем данные в формат Directus API
        const directusPayload: any = {
          content_type: req.body.contentType,
          title: req.body.title,
          content: req.body.content,
          image_url: req.body.imageUrl,
          video_url: req.body.videoUrl,
          status: req.body.status
        };
        
        // Обрабатываем ключевые слова особым образом
        if (req.body.keywords !== undefined) {
          console.log('Request keywords type:', typeof req.body.keywords, 'Value:', req.body.keywords);
          
          // Убедимся, что keywords - это массив
          let keywordsArray: string[] = [];
          
          if (Array.isArray(req.body.keywords)) {
            // Если уже массив, используем его напрямую
            keywordsArray = req.body.keywords.map((k: any) => 
              typeof k === 'string' ? k : String(k)
            );
          } else if (typeof req.body.keywords === 'string') {
            try {
              // Проверяем, может быть это JSON-строка
              const parsed = JSON.parse(req.body.keywords);
              if (Array.isArray(parsed)) {
                keywordsArray = parsed.map((k: any) => typeof k === 'string' ? k : String(k));
              } else {
                // Одиночное значение, оборачиваем в массив
                keywordsArray = [req.body.keywords];
              }
            } catch (e) {
              // Если не удалось распарсить как JSON, то это просто строка
              keywordsArray = [req.body.keywords];
            }
          } else if (req.body.keywords === null) {
            keywordsArray = [];
          } else {
            // Для всех остальных типов пытаемся преобразовать
            keywordsArray = [String(req.body.keywords)];
          }
          
          // Фильтруем пустые значения и гарантируем уникальность
          const uniqueKeywords = [...new Set(
            keywordsArray
              .filter(k => k && typeof k === 'string' && k.trim() !== '')
              .map(k => k.trim())
          )];
          
          directusPayload.keywords = uniqueKeywords;
          console.log('Processed unique keywords array:', directusPayload.keywords);
        }
        
        // Обновляем данные через Directus API
        const response = await directusApi.patch(`/items/campaign_content/${contentId}`, directusPayload, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.data || !response.data.data) {
          throw new Error('Failed to update content, invalid response from Directus');
        }
        
        const item = response.data.data;
        
        // Преобразуем данные из формата Directus в наш формат
        const updatedContent = {
          id: item.id,
          campaignId: item.campaign_id,
          userId: item.user_id,
          title: item.title,
          content: item.content,
          contentType: item.content_type,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          prompt: item.prompt,
          // Убедимся, что ключевые слова всегда возвращаются как массив
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
          links: Array.isArray(item.links) ? item.links : [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {},
          metadata: item.metadata || {}
        };
        
        res.json({ data: updatedContent });
      } catch (error) {
        console.error('Error updating campaign content:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
          if (error.response.status === 404) {
            return res.status(404).json({ error: "Content not found" });
          }
        }
        return res.status(401).json({ error: "Invalid token or failed to update content" });
      }
    } catch (error) {
      console.error("Error updating campaign content:", error);
      res.status(500).json({ error: "Failed to update campaign content" });
    }
  });

  app.delete("/api/campaign-content/:id", async (req, res) => {
    try {
      const contentId = req.params.id;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Deleting content with ID: ${contentId}`);
        
        // Получаем ID пользователя для проверки права на удаление
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Получаем контент напрямую из Directus API для проверки
        const existingContentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!existingContentResponse.data || !existingContentResponse.data.data) {
          return res.status(404).json({ error: "Content not found" });
        }
        
        const existingItem = existingContentResponse.data.data;
        
        // Проверяем, принадлежит ли контент пользователю
        if (existingItem.user_id !== userId) {
          return res.status(403).json({ error: "You don't have permission to delete this content" });
        }
        
        // Удаляем контент через Directus API
        await directusApi.delete(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`Successfully deleted content with ID: ${contentId}`);
        res.status(204).end();
      } catch (error) {
        console.error('Error deleting campaign content:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
          if (error.response.status === 404) {
            return res.status(404).json({ error: "Content not found" });
          }
        }
        return res.status(500).json({ error: "Failed to delete content" });
      }
    } catch (error) {
      console.error("Error deleting campaign content:", error);
      res.status(500).json({ error: "Failed to delete campaign content" });
    }
  });

  app.get("/api/campaign-content/scheduled", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Fetching scheduled content for campaign ID: ${campaignId || 'all campaigns'}`);
        
        // Получаем ID пользователя из токена
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Получаем запланированный контент напрямую из Directus API
        // Текущая дата в ISO формате
        const now = new Date().toISOString();
        
        // Построение фильтра для Directus API: контент, у которого scheduled_at в будущем
        const filter = {
          user_id: {
            _eq: userId
          },
          status: {
            _eq: "scheduled"
          },
          scheduled_at: {
            _gt: now
          },
          ...(campaignId ? { campaign_id: { _eq: campaignId } } : {})
        };
        
        // Выполняем запрос к Directus API
        const response = await directusApi.get('/items/campaign_content', {
          params: {
            filter: JSON.stringify(filter),
            sort: ['scheduled_at']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Проверяем, что получили массив
        if (!Array.isArray(response.data.data)) {
          console.error("Unexpected response format from Directus:", response.data);
          return res.status(500).json({ error: "Неожиданный формат ответа от Directus API" });
        }
        
        // Преобразуем данные из формата Directus в наш формат
        const contentItems = response.data.data.map((item: any) => ({
          id: item.id,
          campaignId: item.campaign_id,
          userId: item.user_id,
          title: item.title,
          content: item.content,
          contentType: item.content_type,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          prompt: item.prompt,
          keywords: item.keywords || [],
          hashtags: item.hashtags || [],
          links: item.links || [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {},
          metadata: item.metadata || {}
        }));
        
        console.log(`Found ${contentItems.length} scheduled content items for campaign ${campaignId || 'all'}`);
        
        res.json({ data: contentItems });
      } catch (error) {
        console.error('Error fetching scheduled content:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
        }
        return res.status(401).json({ error: "Invalid token or failed to fetch scheduled content" });
      }
    } catch (error) {
      console.error("Error fetching scheduled content:", error);
      res.status(500).json({ error: "Failed to fetch scheduled content" });
    }
  });

  // Маршрут для адаптации контента для социальных сетей
  app.post("/api/content/:id/adapt", async (req, res) => {
    try {
      const contentId = req.params.id;
      const { socialPlatforms } = req.body;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Adapting content ID ${contentId} for social platforms`);
        
        // Получаем текущий контент
        const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const content = contentResponse.data.data;
        
        if (!content) {
          return res.status(404).json({ error: "Content not found" });
        }
        
        // Обновляем social_platforms в Directus
        await directusApi.patch(`/items/campaign_content/${contentId}`, {
          social_platforms: socialPlatforms
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Получаем ID кампании и информацию о пользователе для отправки в webhook
        const campaignId = content.campaign_id;
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        // Отправляем данные в n8n webhook для обработки
        // Проверяем наличие n8n API ключа в env
        const n8nApiKey = process.env.N8N_API_KEY;
        
        if (n8nApiKey) {
          try {
            // Подготавливаем данные для n8n webhook
            const webhookPayload = {
              contentId,
              campaignId,
              userId,
              platforms: Object.keys(socialPlatforms),
              content: socialPlatforms,
              // Получаем данные изображений и прочую информацию из основного контента
              imageUrl: content.image_url,
              videoUrl: content.video_url,
              title: content.title
            };
            
            // Отправляем запрос на n8n webhook для публикации
            await axios.post('https://n8n.nplanner.ru/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c', webhookPayload, {
              headers: {
                'Content-Type': 'application/json',
                'X-N8N-Authorization': n8nApiKey
              },
              timeout: 10000 // 10 секунд таймаут
            });
            
            console.log(`Successfully sent content ${contentId} to n8n webhook for social media publishing`);
          } catch (webhookError) {
            console.error('Error sending data to n8n webhook:', webhookError);
            // Не прерываем выполнение операции, если n8n недоступен
          }
        } else {
          console.warn('N8N_API_KEY not found in environment variables, skipping webhook call');
        }
        
        // Возвращаем успешный ответ
        return res.json({
          success: true,
          message: "Content adapted for social platforms"
        });
        
      } catch (error) {
        console.error('Error adapting content for social platforms:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        return res.status(error.response?.status || 500).json({ 
          error: "Failed to adapt content",
          details: error.message
        });
      }
    } catch (error) {
      console.error("Error adapting content:", error);
      res.status(500).json({ error: "Failed to adapt content" });
    }
  });
  
  // Маршрут для публикации контента в соцсети
  app.post("/api/content/:id/publish", async (req, res) => {
    try {
      const contentId = req.params.id;
      const { socialPlatforms, status } = req.body;
      
      // Проверка авторизации
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Не авторизован' });
      }
      
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Невалидный токен' });
      }
      
      try {
        // Отправляем запрос к Directus API для запланированной публикации
        const response = await directusApi.patch(`/items/campaign_content/${contentId}`, {
          social_platforms: socialPlatforms,
          status: status || 'scheduled'
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        res.json({ data: response.data.data });
      } catch (error: any) {
        console.error('Error publishing content:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        return res.status(error.response?.status || 500).json({ 
          error: "Ошибка при публикации контента",
          details: error.response?.data?.errors || error.message
        });
      }
    } catch (error: any) {
      console.error("Error publishing content:", error);
      res.status(500).json({ error: "Ошибка при публикации контента" });
    }
  });

  // Маршрут для публикации в соцсети уже адаптированного контента
  app.post("/api/content/:id/publish-social", async (req, res) => {
    try {
      const contentId = req.params.id;
      const { platforms } = req.body;
      
      // Проверка авторизации
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Не авторизован' });
      }
      
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Невалидный токен' });
      }
      
      try {
        // Получаем информацию о контенте
        const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        const content = contentResponse.data.data;
        if (!content) {
          return res.status(404).json({ error: "Контент не найден" });
        }
        
        // Проверяем, есть ли настройки для публикации
        if (!content.social_platforms) {
          return res.status(400).json({ error: "Контент не адаптирован для публикации в соцсетях" });
        }
        
        // Фильтруем только запрошенные платформы или используем все настроенные
        const platformsToPublish = platforms || Object.keys(content.social_platforms);
        
        // Обновляем статус на "publishing" для выбранных платформ
        const updatedSocialPlatforms = { ...content.social_platforms };
        
        platformsToPublish.forEach(platform => {
          if (updatedSocialPlatforms[platform]) {
            updatedSocialPlatforms[platform].status = 'publishing';
          }
        });
        
        // Обновляем статусы в базе данных
        await directusApi.patch(`/items/campaign_content/${contentId}`, {
          social_platforms: updatedSocialPlatforms
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Отправляем данные в n8n webhook для публикации
        const n8nApiKey = process.env.N8N_API_KEY;
        
        if (!n8nApiKey) {
          console.warn('N8N_API_KEY not found in environment variables');
          return res.status(500).json({ error: "API ключ n8n не настроен" });
        }
        
        try {
          // Подготавливаем данные для n8n webhook
          const webhookPayload = {
            contentId,
            campaignId: content.campaign_id,
            userId: content.user_id,
            platforms: platformsToPublish,
            content: {
              title: content.title,
              originalContent: content.content,
              imageUrl: content.image_url,
              videoUrl: content.video_url,
              socialPlatforms: updatedSocialPlatforms
            },
            scheduledAt: content.scheduled_at,
            metadata: {
              keywords: content.keywords,
              type: content.content_type
            }
          };
          
          // Отправляем запрос на n8n webhook для публикации
          const webhookResponse = await axios.post(
            'https://n8n.nplanner.ru/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c',
            webhookPayload,
            {
              headers: {
                'Content-Type': 'application/json',
                'X-N8N-Authorization': n8nApiKey
              },
              timeout: 10000 // 10 секунд таймаут
            }
          );
          
          if (webhookResponse.status === 200) {
            console.log(`Successfully sent content ${contentId} to n8n for publishing`);
          } else {
            console.warn(`Unexpected response from n8n webhook: ${webhookResponse.status}`);
          }
        } catch (webhookError) {
          console.error('Error sending data to n8n webhook:', webhookError);
          return res.status(500).json({ 
            error: "Ошибка при отправке данных в n8n",
            details: webhookError.message
          });
        }
        
        res.json({ 
          success: true, 
          message: "Началась публикация контента в социальные сети",
          platforms: platformsToPublish
        });
      } catch (error: any) {
        console.error('Error publishing to social media:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        return res.status(error.response?.status || 500).json({ 
          error: "Ошибка при публикации в соцсети",
          details: error.response?.data?.errors || error.message
        });
      }
    } catch (error: any) {
      console.error("Error publishing to social media:", error);
      res.status(500).json({ error: "Ошибка при публикации в соцсети" });
    }
  });

  // Добавляем маршрут для создания кампаний
  app.post("/api/campaigns", authenticateUser, async (req, res) => {
    try {
      const { name, description } = req.body;
      const userId = (req as any).userId;
      const authHeader = req.headers['authorization'];
      
      if (!name) {
        return res.status(400).json({ error: "Название кампании обязательно" });
      }
      
      if (!userId || !authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Creating new campaign for user ${userId}`);
        
        // Создаем кампанию через Directus API
        const response = await directusApi.post('/items/user_campaigns', {
          name,
          description: description || null,
          user_id: userId
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Преобразуем ответ в нужный формат
        const newCampaign = {
          id: response.data.data.id,
          name: response.data.data.name,
          description: response.data.data.description,
          userId: response.data.data.user_id,
          createdAt: response.data.data.created_at
        };
        
        console.log(`Created new campaign for user ${userId}:`, newCampaign);
        
        // Возвращаем результат
        return res.status(201).json({ 
          success: true,
          data: newCampaign
        });
      } catch (error) {
        console.error("Error creating campaign:", error);
        if (axios.isAxiosError(error)) {
          console.error('Directus API error details:', {
            status: error.response?.status,
            data: error.response?.data
          });
        }
        return res.status(500).json({ error: "Не удалось создать кампанию" });
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });
  
  // Добавляем маршрут для удаления кампаний
  app.delete("/api/campaigns/:id", authenticateUser, async (req, res) => {
    try {
      const campaignId = req.params.id;
      const userId = (req as any).userId;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании обязателен" });
      }
      
      if (!userId || !authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Получаем информацию о кампании из Directus, чтобы проверить владельца
        const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!campaignResponse.data || !campaignResponse.data.data) {
          return res.status(404).json({ error: "Кампания не найдена" });
        }
        
        const campaign = campaignResponse.data.data;
        
        // Проверяем, принадлежит ли кампания текущему пользователю
        if (campaign.user_id !== userId) {
          return res.status(403).json({ error: "Доступ запрещен: вы не являетесь владельцем этой кампании" });
        }
        
        // Удаляем кампанию через Directus API
        await directusApi.delete(`/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Возвращаем результат
        return res.status(200).json({ 
          success: true,
          message: "Кампания успешно удалена"
        });
      } catch (deleteError) {
        console.error(`Error deleting campaign ${campaignId}:`, deleteError);
        if (axios.isAxiosError(deleteError)) {
          console.error('Directus API error details:', {
            status: deleteError.response?.status,
            data: deleteError.response?.data
          });
        }
        return res.status(500).json({ error: "Не удалось удалить кампанию" });
      }
    } catch (error) {
      console.error("Error in delete campaign endpoint:", error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });
  
  // Добавляем маршрут для обновления кампаний
  app.patch("/api/campaigns/:id", authenticateUser, async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { name, link, social_media_settings, trend_analysis_settings } = req.body;
      const userId = (req as any).userId;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании обязателен" });
      }
      
      // Разрешаем обновление только определенных полей
      // Удалим undefined значения, оставим только те, что нужно обновить
      const updateFields: any = {};
      
      if (name !== undefined && name.trim() !== '') {
        updateFields.name = name.trim();
      }
      
      if (link !== undefined) {
        updateFields.link = link.trim();
      }
      
      if (social_media_settings !== undefined) {
        updateFields.social_media_settings = social_media_settings;
      }
      
      if (trend_analysis_settings !== undefined) {
        updateFields.trend_analysis_settings = trend_analysis_settings;
      }
      
      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ error: "Необходимо указать хотя бы одно поле для обновления" });
      }
      
      if (!userId || !authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Получаем информацию о кампании из Directus, чтобы проверить владельца
        const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!campaignResponse.data || !campaignResponse.data.data) {
          return res.status(404).json({ error: "Кампания не найдена" });
        }
        
        const campaign = campaignResponse.data.data;
        
        // Проверяем, принадлежит ли кампания текущему пользователю
        if (campaign.user_id !== userId) {
          return res.status(403).json({ error: "Доступ запрещен: вы не являетесь владельцем этой кампании" });
        }
        
        console.log(`Updating campaign ${campaignId} in Directus with fields:`, updateFields);
        
        const response = await directusApi.patch(`/items/user_campaigns/${campaignId}`, updateFields, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const updatedCampaign = {
          id: response.data.data.id,
          name: response.data.data.name,
          description: response.data.data.description,
          userId: response.data.data.user_id,
          createdAt: response.data.data.created_at,
          link: response.data.data.link,
          socialMediaSettings: response.data.data.social_media_settings,
          trendAnalysisSettings: response.data.data.trend_analysis_settings
        };
        
        console.log("Campaign updated successfully:", updatedCampaign.name);
        
        return res.status(200).json({ 
          success: true,
          data: updatedCampaign,
          message: "Кампания успешно обновлена"
        });
      } catch (directusError) {
        console.error("Error updating campaign in Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
          
          // Если получаем ошибку 401 или 403, возвращаем соответствующий статус
          if (directusError.response.status === 401 || directusError.response.status === 403) {
            return res.status(directusError.response.status).json({
              error: "Не авторизован для редактирования кампании"
            });
          }
          
          if (directusError.response.status === 404) {
            return res.status(404).json({ error: "Кампания не найдена" });
          }
        }
        
        return res.status(500).json({ 
          error: "Не удалось обновить кампанию", 
          message: directusError instanceof Error ? directusError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ 
        error: "Failed to update campaign",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  console.log('Route registration completed');
  // Webhook endpoint to receive trend topics from n8n
  app.post("/api/webhook/trend-topics", async (req, res) => {
    try {
      console.log("Received webhook request for trend topics:", req.body);
      
      const { campaignId, keywords, trendTopics } = req.body;
      
      if (!campaignId || !trendTopics || !Array.isArray(trendTopics)) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid payload. Required: campaignId and trendTopics array." 
        });
      }
      
      console.log(`Processing ${trendTopics.length} trend topics for campaign ${campaignId}`);
      
      // Получаем API ключ n8n из переменных окружения
      const n8nApiKey = process.env.N8N_API_KEY;
      
      if (!n8nApiKey) {
        return res.status(500).json({ 
          success: false, 
          error: "N8N API key not configured" 
        });
      }
      
      // Save each trend topic to the database using Directus API
      const savedTopics = [];
      for (const topic of trendTopics) {
        try {
          // Сначала создаем объект, соответствующий схеме
          const trendTopic = insertCampaignTrendTopicSchema.parse({
            title: topic.title,
            campaignId: campaignId,
            sourceId: topic.sourceId || null,
            reactions: topic.reactions || 0,
            comments: topic.comments || 0,
            views: topic.views || 0,
            isBookmarked: false
          });
          
          // Сохраняем через Directus API
          // Преобразуем в формат Directus
          const directusPayload = {
            title: trendTopic.title,
            campaign_id: trendTopic.campaignId,
            source_id: trendTopic.sourceId,
            reactions: trendTopic.reactions,
            comments: trendTopic.comments,
            views: trendTopic.views,
            is_bookmarked: trendTopic.isBookmarked
          };
          
          // Отправляем запрос в Directus API с использованием сервисного токена
          // Здесь для webhook мы используем n8nApiKey как авторизацию
          const response = await directusApi.post('/items/campaign_trend_topics', directusPayload, {
            headers: {
              'Authorization': `Bearer ${n8nApiKey}`
            }
          });
          
          const item = response.data.data;
          
          // Преобразуем данные из формата Directus в наш формат
          const savedTopic = {
            id: item.id,
            title: item.title,
            campaignId: item.campaign_id,
            sourceId: item.source_id,
            reactions: item.reactions,
            comments: item.comments,
            views: item.views,
            isBookmarked: item.is_bookmarked,
            createdAt: item.created_at
          };
          savedTopics.push(savedTopic);
        } catch (topicError) {
          console.error("Error saving trend topic:", topicError);
          // Continue with other topics even if one fails
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `Successfully processed ${savedTopics.length} of ${trendTopics.length} trend topics`,
        data: { 
          savedCount: savedTopics.length,
          campaignId 
        }
      });
    } catch (error) {
      console.error("Error processing webhook for trend topics:", error);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to process trend topics data"
      });
    }
  });
  
  // Проверяет статус публикации контента в n8n
  async function checkPublishingStatus(contentId: string, n8nApiKey: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://n8n.nplanner.ru/webhook/status/${contentId}`,
        {
          headers: {
            'X-N8N-Authorization': n8nApiKey
          },
          timeout: 5000
        }
      );
      
      return response.data;
    } catch (error) {
      console.error(`Error checking publishing status for content ${contentId}:`, error);
      throw error;
    }
  }

  // Маршрут для проверки статуса публикации
  app.get("/api/content/:id/publish-status", async (req, res) => {
    try {
      const contentId = req.params.id;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const n8nApiKey = process.env.N8N_API_KEY;
      
      if (!n8nApiKey) {
        return res.status(500).json({ error: "API ключ n8n не настроен" });
      }
      
      try {
        // Получаем статус из n8n
        const publishingStatus = await checkPublishingStatus(contentId, n8nApiKey);
        
        // Получаем текущий контент из Directus
        const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const content = contentResponse.data.data;
        if (!content) {
          return res.status(404).json({ error: "Контент не найден" });
        }
        
        // Обновляем статусы платформ если есть изменения
        let hasStatusChanges = false;
        const updatedSocialPlatforms = { ...content.social_platforms };
        
        Object.entries(publishingStatus.platforms || {}).forEach(([platform, status]) => {
          if (updatedSocialPlatforms[platform]) {
            if (status.status !== updatedSocialPlatforms[platform].status) {
              hasStatusChanges = true;
              updatedSocialPlatforms[platform] = {
                ...updatedSocialPlatforms[platform],
                ...status
              };
            }
          }
        });
        
        // Если есть изменения, обновляем в базе
        if (hasStatusChanges) {
          await directusApi.patch(`/items/campaign_content/${contentId}`, {
            social_platforms: updatedSocialPlatforms
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        }
        
        res.json({
          success: true,
          status: publishingStatus,
          platforms: updatedSocialPlatforms
        });
        
      } catch (error: any) {
        console.error('Error checking publishing status:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
        }
        return res.status(error.response?.status || 500).json({ 
          error: "Ошибка при проверке статуса публикации",
          details: error.response?.data?.errors || error.message
        });
      }
    } catch (error: any) {
      console.error("Error checking publishing status:", error);
      res.status(500).json({ error: "Ошибка при проверке статуса публикации" });
    }
  });

  return httpServer;
}

function normalizeSourceUrl(url: string, domain: string): string | undefined {
  try {
    const parsed = new URL(url);
    if(parsed.hostname === domain){
      return url;
    }
    return undefined;
  } catch(e){
    console.error('Error normalizing source URL', url, e);
    return undefined;
  }
}