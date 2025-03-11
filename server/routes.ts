const searchCache = new Map<string, { timestamp: number, results: any[] }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Add helper function to check and get cached results
function getCachedResults(keyword: string): any[] | null {
  const cached = searchCache.get(keyword);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached results for keyword: ${keyword}`);
    return cached.results;
  }
  return null;
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
  console.log('Starting route registration...');
  const httpServer = createServer(app);
  
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

  // XMLRiver API proxy
  app.get("/api/wordstat/:keyword", async (req, res) => {
    try {
      console.log(`Searching WordStat for keyword: ${req.params.keyword}`);
      const response = await axios.get(`http://xmlriver.com/wordstat/json`, {
        params: {
          user: process.env.XMLRIVER_USER || "16797",
          key: process.env.XMLRIVER_KEY || "f7947eff83104621deb713275fe3260bfde4f001",
          query: req.params.keyword
        }
      });

      console.log("XMLRiver API response:", response.data);

      if (!response.data?.content?.includingPhrases?.items) {
        console.error("Invalid response format from XMLRiver API");
        throw new Error("Некорректный формат ответа от XMLRiver API");
      }

      const keywords = response.data.content.includingPhrases.items.map((item: any) => ({
        keyword: item.phrase,
        trend: parseInt(item.number.replace(/\s/g, '')),
        competition: Math.floor(Math.random() * 100) // Заглушка для конкуренции
      }));

      console.log("Processed keywords:", keywords);
      res.json({ data: { keywords } });
    } catch (error) {
      console.error('XMLRiver API error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Error fetching keywords from XMLRiver"
      });
    }
  });

  // Sources routes
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
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');
      const { keywords } = req.body;
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
          return res.status(401).json({ message: "Unauthorized: Cannot identify user" });
        }
      } catch (userError) {
        console.error("Error getting user from token:", userError);
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
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
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        console.error('Missing authorization header');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');

      const sourceId = req.params.sourceId;
      const { campaignId } = req.body;

      if (!sourceId || !campaignId) {
        console.error('Missing required parameters:', { sourceId, campaignId });
        return res.status(400).json({ message: "Source ID and Campaign ID are required" });
      }

      // Get sources for this campaign from Directus API
      const sourcesResponse = await directusApi.get('/items/content_sources', {
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
      
      const sources = sourcesResponse.data.data || [];
      console.log(`Found ${sources.length} sources for campaign ${campaignId}`);
      
      // Find the specific source we're interested in
      const source = sources.find((s: any) => String(s.id) === String(sourceId));

      if (!source) {
        console.error('Source not found:', { sourceId, campaignId });
        return res.status(404).json({ message: "Source not found" });
      }
      
      try {
        // Start crawling process
        console.log('Starting crawling process for source:', source.name);
        
        // TODO: Replace with Directus API call when crawler functionality is implemented
        // For now, returning placeholder response
        res.status(501).json({ 
          success: false,
          error: "Crawling functionality not yet implemented",
          message: "This endpoint will be implemented in a future update"
        });
      } catch (crawlError) {
        console.error("Error during crawling:", crawlError);
        res.status(500).json({ error: "Failed to complete crawling task" });
      }
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ error: "Failed to process request" });
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
          createdAt: item.created_at
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
        const directusPayload = {
          content_type: req.body.contentType,
          title: req.body.title,
          content: req.body.content,
          image_url: req.body.imageUrl,
          video_url: req.body.videoUrl,
          keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
          status: req.body.status
        };
        
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
        
        // Получаем запланированный контент из нашего storage API
        const contentItems = await storage.getScheduledContent(userId, campaignId);
        
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
      const { name } = req.body;
      const userId = (req as any).userId;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании обязателен" });
      }
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: "Название кампании обязательно" });
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
        
        console.log(`Updating campaign ${campaignId} in Directus with name: ${name}`);
        
        const response = await directusApi.patch(`/items/user_campaigns/${campaignId}`, {
          name: name.trim()
        }, {
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
          createdAt: response.data.data.created_at
        };
        
        console.log("Campaign updated successfully:", updatedCampaign);
        
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
          
          // Сохраняем через наш внутренний API
          const response = await storage.createCampaignTrendTopic(trendTopic);
          
          // Используем данные из ответа хранилища
          const savedTopic = {
            id: response.id,
            title: response.title,
            campaignId: response.campaignId,
            sourceId: response.sourceId,
            reactions: response.reactions,
            comments: response.comments,
            views: response.views,
            isBookmarked: response.isBookmarked,
            createdAt: response.createdAt
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