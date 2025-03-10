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

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSourceSchema, insertCampaignContentSchema } from "@shared/schema";
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
  app.get("/api/trends", async (req, res) => {
    try {
      const period = req.query.period as string;
      const campaignId = req.query.campaignId ? Number(req.query.campaignId) : undefined;

      console.log("Fetching trends with params:", { period, campaignId });

      if (campaignId && isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
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

      const trends = await storage.getTrendTopics({ from, campaignId });
      console.log('Found trends:', trends);
      res.json({ data: trends });
    } catch (error) {
      console.error("Error fetching trends:", error);
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
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { campaignId } = req.body;
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      // Get sources for this campaign
      const sources = await storage.getContentSources(userId, Number(campaignId));
      if (!sources || sources.length === 0) {
        return res.status(400).json({ message: "No sources found for this campaign" });
      }

      console.log(`Starting trend collection for ${sources.length} sources in campaign ${campaignId}`);
      let collectedTopicsCount = 0;

      // Временные тестовые данные для демонстрации
      // В реальной системе здесь будет парсинг реальных данных из источников
      for (const source of sources) {
        try {
          console.log(`Processing source: ${source.name} (${source.url})`);

          // Генерация демонстрационных трендов для заполнения таблицы
          const sampleTopics = [
            {
              directusId: crypto.randomUUID(),
              title: `Популярный пост о ${source.type === 'instagram' ? 'фото' : source.type === 'youtube' ? 'видео' : 'контенте'}`,
              sourceId: source.id,
              campaignId: Number(campaignId),
              reactions: Math.floor(Math.random() * 2000) + 100,
              comments: Math.floor(Math.random() * 300) + 10,
              views: Math.floor(Math.random() * 10000) + 500
            },
            {
              directusId: crypto.randomUUID(),
              title: `Трендовая тема из ${source.name}`,
              sourceId: source.id,
              campaignId: Number(campaignId),
              reactions: Math.floor(Math.random() * 1500) + 50,
              comments: Math.floor(Math.random() * 200) + 5,
              views: Math.floor(Math.random() * 8000) + 300
            }
          ];

          // Сохранение трендов в базу данных
          for (const topic of sampleTopics) {
            await storage.createTrendTopic(topic);
            collectedTopicsCount++;
          }

          console.log(`Added ${sampleTopics.length} sample trends for source ${source.name}`);
        } catch (sourceError) {
          console.error(`Error processing source ${source.name}:`, sourceError);
          // Продолжаем с другими источниками даже если один не обработался
        }
      }

      console.log(`Trend collection completed. Added ${collectedTopicsCount} topics.`);

      res.json({
        message: "Trend collection completed successfully",
        topicsCollected: collectedTopicsCount
      });
    } catch (error) {
      console.error("Error collecting trends:", error);
      res.status(500).json({ error: "Failed to collect trends" });
    }
  });

  // Modified sources/collect endpoint to use real search
  app.post("/api/sources/collect", async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');
      const { keywords } = req.body;
      console.log('Starting source search for keywords:', keywords);

      // Check cache for each keyword first
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

      // Collect sources from multiple services for keywords without cache
      const allResults = await Promise.all(
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

      // Merge all results and remove duplicates
      const uniqueSources = allResults.flat().reduce((acc: any[], source) => {
        const exists = acc.some(s => s.url === source.url);
        if (!exists) {
          acc.push(source);
        }
        return acc;
      }, []);

      console.log(`Found ${uniqueSources.length} unique sources across all keywords`);

      return res.json({
        success: true,
        data: {
          sources: uniqueSources
        }
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

      // Get source for this campaign
      const sources = await storage.getContentSources("", Number(campaignId));
      console.log('Found sources:', sources);

      const source = sources.find(s => String(s.id) === String(sourceId));

      if (!source) {
        console.error('Source not found:', { sourceId, campaignId });
        return res.status(404).json({ message: "Source not found" });
      }

      let taskResponse;

      try {
        // Start crawling process first
        console.log('Starting crawling process for source:', source.name);
        const topics = await crawler.crawlSource(source, Number(campaignId), "");
        console.log(`Found ${topics.length} topics for source ${source.name}`);

        if (topics.length === 0) {
          console.error('No topics found for source:', source.name);
          return res.status(404).json({ message: "No topics found for this source" });
        }

        res.status(501).json({ error: "Not Implemented" });

      } catch (error) {
        console.error("Error during crawling:", error);

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
  app.get("/api/campaigns", async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        console.log("No authorization header provided");
        // Для тестирования в разработке возвращаем тестовые данные
        return res.json({ data: devCampaigns });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // В реальной среде получаем кампании из Directus
        const response = await directusApi.get('/items/user_campaigns', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const campaigns = response.data.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          userId: item.user_id,
          createdAt: item.created_at
        }));
        
        res.json({ data: campaigns });
      } catch (error) {
        console.error('Error getting campaigns:', error);
        if (axios.isAxiosError(error) && error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        // Для тестирования в разработке возвращаем тестовые данные при ошибке API
        return res.json({ data: devCampaigns });
      }
    } catch (error) {
      console.error("Error in campaigns route:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
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
        
        // Создаем фильтр для запроса, полагаясь на авторизацию Directus API
        // Directus автоматически фильтрует по пользователю, основываясь на токене 
        const filter: any = {};
        
        // Если указан campaignId, добавляем его в фильтр
        if (campaignId) {
          filter.campaign_id = {
            _eq: campaignId
          }
        }
        
        // Получаем контент напрямую из Directus API
        const contentResponse = await directusApi.get('/items/campaign_content', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          params: {
            filter: filter
          }
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const contentItems = contentResponse.data.data.map((item: any) => ({
          id: item.id,
          campaignId: item.campaign_id,
          userId: item.user_id,
          title: item.title,
          content: item.content,
          contentType: item.content_type,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          prompt: item.prompt,
          keywords: item.keywords ? (typeof item.keywords === "string" ? JSON.parse(item.keywords) : item.keywords) : [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {}
        }));
        
        res.json({ data: contentItems });
      } catch (error) {
        console.error('Error getting campaign content:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
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
        
        // Получаем контент напрямую из Directus API
        // API Directus автоматически проверит права доступа на основе токена
        const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const item = contentResponse.data.data;
        
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
          keywords: item.keywords ? (typeof item.keywords === "string" ? JSON.parse(item.keywords) : item.keywords) : [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {}
        };
        
        res.json({ data: content });
      } catch (error) {
        console.error('Error getting campaign content by ID:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
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
          // Проверяем, что keywords это массив и передаем его напрямую для PostgreSQL
          keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
          status: req.body.status || "draft",
          user_id: userId,
          created_at: new Date().toISOString()
        };
        
        console.log("Creating campaign content:", directusPayload);
        
        const contentResponse = await directusApi.post('/items/campaign_content', directusPayload, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Трансформируем данные из формата Directus в наш формат
        const content = {
          id: contentResponse.data.data.id,
          campaignId: contentResponse.data.data.campaign_id,
          userId: contentResponse.data.data.user_id,
          title: contentResponse.data.data.title,
          content: contentResponse.data.data.content,
          contentType: contentResponse.data.data.content_type,
          imageUrl: contentResponse.data.data.image_url,
          videoUrl: contentResponse.data.data.video_url,
          prompt: contentResponse.data.data.prompt,
          // Парсим keywords из строки JSON, если это возможно
          keywords: contentResponse.data.data.keywords 
            ? (typeof contentResponse.data.data.keywords === 'string' 
                ? JSON.parse(contentResponse.data.data.keywords) 
                : contentResponse.data.data.keywords)
            : [],
          createdAt: contentResponse.data.data.created_at,
          scheduledAt: contentResponse.data.data.scheduled_at,
          publishedAt: contentResponse.data.data.published_at,
          status: contentResponse.data.data.status,
          socialPlatforms: contentResponse.data.data.social_platforms
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
        
        // Directus API автоматически проверяет права доступа
        // Преобразуем данные для Directus
        const directusPayload = {
          content_type: req.body.contentType,
          title: req.body.title,
          content: req.body.content,
          image_url: req.body.imageUrl,
          video_url: req.body.videoUrl,
          // Проверяем, что keywords это массив и передаем его напрямую для PostgreSQL
          keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
          status: req.body.status,
          user_id: userId
        };
        
        // Обновляем данные через Directus API
        const updatedContentResponse = await directusApi.patch(`/items/campaign_content/${contentId}`, directusPayload, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const item = updatedContentResponse.data.data;
        
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
          // Парсим keywords из строки JSON, если это возможно
          keywords: item.keywords 
            ? (typeof item.keywords === 'string' 
                ? JSON.parse(item.keywords) 
                : item.keywords)
            : [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {}
        };
        
        res.json({ data: updatedContent });
      } catch (error) {
        console.error('Error updating campaign content:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
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
        
        // Удалить контент напрямую через Directus API
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
          console.error('Directus API error details:', error.response.data);
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
        
        // Создаем фильтр для запроса, не делая лишнего запроса для проверки пользователя
        // Directus API автоматически проверит авторизацию по токену
        const filter: any = {
          status: {
            _eq: "scheduled"
          },
          scheduled_at: {
            _nnull: true
          }
        };
        
        // Если указан campaignId, добавляем его в фильтр
        if (campaignId) {
          filter.campaign_id = {
            _eq: campaignId
          }
        }
        
        // Получаем запланированный контент напрямую из Directus API
        const contentResponse = await directusApi.get('/items/campaign_content', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          params: {
            filter: filter,
            sort: ["scheduled_at"]
          }
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const contentItems = contentResponse.data.data.map((item: any) => ({
          id: item.id,
          campaignId: item.campaign_id,
          userId: item.user_id,
          title: item.title,
          content: item.content,
          contentType: item.content_type,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          prompt: item.prompt,
          keywords: item.keywords ? (typeof item.keywords === "string" ? JSON.parse(item.keywords) : item.keywords) : [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {}
        }));
        
        res.json({ data: contentItems });
      } catch (error) {
        console.error('Error fetching scheduled content:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        return res.status(401).json({ error: "Invalid token or failed to fetch scheduled content" });
      }
    } catch (error) {
      console.error("Error fetching scheduled content:", error);
      res.status(500).json({ error: "Failed to fetch scheduled content" });
    }
  });

  // Добавляем маршрут для создания кампаний
  app.post("/api/campaigns", async (req, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Название кампании обязательно" });
      }
      
      // В реальном приложении здесь бы происходила авторизация и проверка прав
      // Для разработки используем мок данные
      const newCampaignId = crypto.randomUUID();
      
      // Добавляем новую кампанию в существующий список
      const newCampaign = {
        id: newCampaignId,
        name: name,
        description: description || null,
        userId: "user123", // Должно быть заменено реальным ID пользователя
        createdAt: new Date().toISOString()
      };
      
      // Добавляем новую кампанию в наш массив кампаний для разработки
      devCampaigns.push(newCampaign);
      
      // Возвращаем результат
      return res.status(201).json({ 
        success: true,
        data: newCampaign
      });
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });
  
  // Добавляем маршрут для удаления кампаний
  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const campaignId = req.params.id;
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании обязателен" });
      }
      
      // Находим индекс кампании в массиве
      const campaignIndex = devCampaigns.findIndex(camp => camp.id === campaignId);
      
      if (campaignIndex === -1) {
        return res.status(404).json({ error: "Кампания не найдена" });
      }
      
      // Удаляем кампанию из массива
      devCampaigns.splice(campaignIndex, 1);
      
      // Возвращаем результат
      return res.status(200).json({ 
        success: true,
        message: "Кампания успешно удалена"
      });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });
  
  // Добавляем маршрут для обновления кампаний
  app.patch("/api/campaigns/:id", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { name } = req.body;
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании обязателен" });
      }
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: "Название кампании обязательно" });
      }
      
      // Находим индекс кампании в массиве
      const campaignIndex = devCampaigns.findIndex(camp => camp.id === campaignId);
      
      if (campaignIndex === -1) {
        return res.status(404).json({ error: "Кампания не найдена" });
      }
      
      // Обновляем кампанию в массиве
      devCampaigns[campaignIndex] = {
        ...devCampaigns[campaignIndex],
        name: name.trim()
      };
      
      // Возвращаем результат
      return res.status(200).json({ 
        success: true,
        data: devCampaigns[campaignIndex],
        message: "Кампания успешно обновлена"
      });
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  console.log('Route registration completed');
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