import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSourceSchema } from "@shared/schema";
import { crawler } from "./services/crawler";
import axios from "axios";
import { directusApi } from './directus';
import * as crypto from 'crypto';

// Add type for follower requirements
type PlatformRequirements = {
  [key: string]: number;
};

// Helper function to normalize URLs
function normalizeSourceUrl(url: string, platform: string): string | null {
  try {
    // Ensure URL starts with https://
    let normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    // Platform-specific normalization
    switch (platform) {
      case 'youtube.com':
        // Convert all YouTube URL formats to @username
        const youtubePathRegex = /\/(c|channel|user)\/([^\/\?]+)/;
        const match = normalizedUrl.match(youtubePathRegex);
        if (match) {
          normalizedUrl = `https://youtube.com/@${match[2]}`;
        }
        // If URL already uses @username format, ensure it's properly formatted
        if (!normalizedUrl.includes('/@')) {
          const username = normalizedUrl.split('/').pop();
          if (username) {
            normalizedUrl = `https://youtube.com/@${username}`;
          }
        }
        break;
      case 't.me':
        // Remove /s/ from Telegram URLs and ensure proper format
        normalizedUrl = normalizedUrl.replace('/s/', '/');
        if (!normalizedUrl.includes('t.me/')) {
          return null;
        }
        break;
      case 'reddit.com':
        // Properly format Reddit URLs
        if (normalizedUrl.includes('r/')) {
          const subreddit = normalizedUrl.split('r/')[1]?.split('/')[0];
          if (subreddit) {
            normalizedUrl = `https://reddit.com/r/${subreddit}`;
          }
        }
        break;
      case 'vk.com':
        // Ensure VK URLs don't contain @ symbol
        normalizedUrl = normalizedUrl.replace('@', '');
        break;
      case 'instagram.com':
        // Normalize Instagram URLs
        if (normalizedUrl.includes('instagram.com/')) {
          const username = normalizedUrl.split('instagram.com/')[1]?.split('/')[0];
          if (username) {
            normalizedUrl = `https://instagram.com/${username}`;
          }
        }
        break;
    }

    // Validate URL format
    const urlObj = new URL(normalizedUrl);

    // Additional validation
    if (!urlObj.pathname || urlObj.pathname === '/') {
      console.log(`Invalid URL path: ${normalizedUrl}`);
      return null;
    }

    // Remove any trailing slashes
    return normalizedUrl.replace(/\/$/, '');
  } catch (error) {
    console.error(`Error normalizing URL ${url}:`, error);
    return null;
  }
}

// Add interface for Social Searcher response
interface SocialSearcherResponse {
  users?: Array<{
    url: string;
    network: string;
    description?: string;
    bio?: string;
    followers?: number;
  }>;
}

// Helper function for Social Searcher API
async function searchSocialSourcesByKeyword(keyword: string, authToken: string): Promise<any[]> {
  try {
    // Get Social Searcher API key
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

    // Make request to Social Searcher API - только для YouTube
    const response = await axios.get('https://api.social-searcher.com/v2/users', {
      params: {
        q: encodeURIComponent(keyword),
        key: socialSearcherKey,
        network: 'youtube', // Используем только YouTube
        lang: 'ru,en',
        size: 20
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('Social Searcher API response:', {
      status: response.status,
      data: response.data,
      params: {
        keyword,
        network: 'youtube',
        lang: 'ru,en'
      }
    });

    if (!response.data?.users) {
      return [];
    }

    // Process and validate results
    return response.data.users
      .filter(user => {
        try {
          if (!user.url || !user.followers) {
            console.log(`Skipping YouTube user - missing required fields:`, user);
            return false;
          }

          // Normalize YouTube URL
          const normalizedUrl = normalizeSourceUrl(user.url, 'youtube.com');
          if (!normalizedUrl) {
            console.log(`Skipping invalid YouTube URL format: ${user.url}`);
            return false;
          }

          // Проверка минимального количества подписчиков
          if (user.followers < followerRequirements['youtube.com']) {
            console.log(`Skipping ${normalizedUrl} - insufficient followers: ${user.followers} < ${followerRequirements['youtube.com']}`);
            return false;
          }

          // Store normalized URL
          user.url = normalizedUrl;
          return true;
        } catch (error) {
          console.error(`Error validating YouTube user:`, error);
          return false;
        }
      })
      .map(user => ({
        url: user.url,
        followers: user.followers,
        rank: Math.min(Math.max(1, Math.ceil(10 - (Math.log10(user.followers) / 2))), 10),
        description: user.description || user.bio || `YouTube канал по теме ${keyword}`,
        keyword
      }));

  } catch (error) {
    console.error('Error searching Social Searcher:', error);
    return [];
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  console.log('Starting route registration...');
  const httpServer = createServer(app);

  const followerRequirements: PlatformRequirements = {
    'youtube.com': 100000,
    'reddit.com': 50000,
    'vk.com': 10000,
    't.me': 5000,
    'instagram.com': 50000,
    'twitter.com': 10000,
    'x.com': 10000
  };

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

  // Sources collection endpoint
  app.post("/api/sources/collect", async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        console.error('Missing authorization header');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');
      const { keywords } = req.body;

      if (!Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: "Keywords array is required and cannot be empty" });
      }

      console.log('Starting source search for keywords:', keywords);

      // Search using both APIs in parallel
      const searchPromises = keywords.map(async keyword => {
        const [perplexityResults, socialSearcherResults] = await Promise.all([
          // Existing Perplexity search
          (async () => {
            try {
              // Existing Perplexity search code extracted to a separate function
              const results = await existingPerplexitySearch(keyword, token);
              return results;
            } catch (error) {
              console.error('Error in Perplexity search:', error);
              return [];
            }
          })(),
          // New Social Searcher search
          searchSocialSourcesByKeyword(keyword, token)
        ]);

        // Combine and deduplicate results
        const combinedResults = [...perplexityResults, ...socialSearcherResults];

        // Remove duplicates based on normalized URLs
        const uniqueUrls = new Set();
        return combinedResults.filter(source => {
          const platform = Object.keys(followerRequirements).find(p => source.url.includes(p)) || '';
          const normalizedUrl = normalizeSourceUrl(source.url, platform);

          if (!normalizedUrl || uniqueUrls.has(normalizedUrl)) {
            return false;
          }

          uniqueUrls.add(normalizedUrl);
          return true;
        });
      });

      const results = await Promise.all(searchPromises.map(p => p.catch(e => {
        console.error('Search promise error:', e);
        return [];
      })));

      console.log('All search results:', results);

      // Объединяем все результаты и удаляем дубликаты
      const allSources = results.flat();
      console.log('Combined sources:', allSources);

      // Сортируем по рангу и количеству подписчиков
      const uniqueSources = [...new Map(allSources.map(source => [source.url, source])).values()]
        .sort((a, b) => {
          // Сначала сортируем по рангу
          const rankDiff = (a.rank || 10) - (b.rank || 10);
          if (rankDiff !== 0) return rankDiff;
          // При равном ранге сортируем по количеству подписчиков
          return (b.followers || 0) - (a.followers || 0);
        });

      console.log('Unique sources:', uniqueSources);

      res.json({
        success: true,
        data: {
          data: {
            sources: uniqueSources,
            totalResults: results.length,
            combinedSourcesCount: allSources.length,
            topSourcesCount: uniqueSources.length
          }
        }
      });

    } catch (error) {
      console.error('Error collecting sources:', error);
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
      const sources = await storage.getContentSources(undefined, Number(campaignId));
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
        const topics = await crawler.crawlSource(source, Number(campaignId), undefined);
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

  console.log('Route registration completed');
  return httpServer;
}

// Helper function to handle Perplexity search (extracted from existing code)
async function existingPerplexitySearch(keyword: string, token: string): Promise<any[]> {
  const followerRequirements: PlatformRequirements = {
    'youtube.com': 100000,
    'reddit.com': 50000,
    'vk.com': 10000,
    't.me': 5000,
    'instagram.com': 50000,
    'twitter.com': 10000,
    'x.com': 10000
  };

  const requestBody = {
    model: "llama-3.1-sonar-small-128k-online",
    messages: [
      {
        role: "system",
        content: `Вы - эксперт по поиску высококачественных источников по теме здорового питания и нутрициологии.

ВАЖНЫЕ ТРЕБОВАНИЯ К ИСТОЧНИКАМ:
1. Возвращайте ТОЛЬКО существующие и активные каналы с регулярными публикациями
2. Тщательно проверяйте количество подписчиков:
   - YouTube: строго > 100,000 подписчиков
   - Instagram: строго > 50,000 подписчиков
   - Telegram: строго > 5,000 подписчиков
   - VK: строго > 10,000 подписчиков
   - Reddit: строго > 50,000 участников
   - Twitter/X: строго > 10,000 подписчиков

3. Оценка качества (ранг от 1 до 10):
   - 1-3: Профессиональные диетологи, врачи, эксперты с научным подходом
   - 4-6: Популярные фитнес-тренеры и практикующие специалисты
   - 7-10: Качественные тематические каналы

4. Формат URL:
   - Всегда используйте https://
   - Для YouTube используйте ТОЛЬКО формат youtube.com/@username
   - НЕ используйте кириллицу в URL
   - ОБЯЗАТЕЛЬНО проверьте существование канала перед включением в список

5. Формат ответа строго JSON:
[{
  "url": "https://youtube.com/@example",
  "rank": 2,
  "followers": 150000,
  "description": "Подробное описание канала: тематика, экспертиза автора"
}]`
      },
      {
        role: "user",
        content: `Найдите ТОП-5 самых авторитетных источников по теме: ${keyword}.
ОБЯЗАТЕЛЬНО:
1. Проверьте реальное существование канала
2. Укажите точное количество подписчиков
3. Оцените профессионализм автора для точного ранжирования
4. Исключите заброшенные каналы
5. Добавьте подробное описание для каждого источника`
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  };

  const settings = await axios.get(`${process.env.DIRECTUS_URL}/items/user_api_keys`, {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    params: {
      filter: {
        service_name: { _eq: 'perplexity' },
        user_id: { _eq: '2d48e263-f562-4e3f-a235-e597fd62d4d8' }
      }
    }
  });

  const perplexityKey = settings.data?.data?.[0]?.api_key;
  if (!perplexityKey) {
    return [];
  }

  const response = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    requestBody,
    {
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.data?.choices?.[0]?.message?.content) {
    console.error(`Invalid API response for keyword ${keyword}:`, response.data);
    throw new Error('Invalid API response structure');
  }

  const content = response.data.choices[0].message.content;
  console.log(`Raw API response for keyword ${keyword}:`, content);

  try {
    const jsonMatches = content.match(/\[[\s\S]*?\]/g) || [];

    let results: any[] = [];
    for (const match of jsonMatches) {
      try {
        const sources = JSON.parse(match);

        if (Array.isArray(sources)) {
          const validSources = sources.filter(source => {
            try {
              if (!source.url || !source.followers || !source.description) {
                console.log(`Skipping source - missing required fields:`, source);
                return false;
              }

              // Find matching platform
              const platform = Object.keys(followerRequirements).find(p => source.url.includes(p));
              if (!platform) {
                console.log(`Skipping source - unsupported platform: ${source.url}`);
                return false;
              }

              // Normalize URL
              const normalizedUrl = normalizeSourceUrl(source.url, platform);
              if (!normalizedUrl) {
                console.log(`Skipping source - invalid URL format: ${source.url}`);
                return false;
              }

              const url = new URL(normalizedUrl);

              // Check for cyrillic characters
              if (/[а-яА-Я]/.test(url.href)) {
                console.log(`Skipping URL with cyrillic characters: ${url.href}`);
                return false;
              }

              // Platform-specific validations
              if (platform === 'youtube.com') {
                // Only accept /@username format
                if (!url.pathname.startsWith('/@')) {
                  console.log(`Skipping invalid YouTube URL format: ${url.href}`);
                  return false;
                }
              }

              // Check follower count requirement
              const minFollowers = followerRequirements[platform];
              if (source.followers < minFollowers) {
                console.log(`Skipping ${url.href} - insufficient followers: ${source.followers} < ${minFollowers}`);
                return false;
              }

              // Validate URL structure
              const hasValidPath = url.pathname.length > 1 &&
                !url.pathname.includes('?') &&
                !url.pathname.includes('search') &&
                !url.pathname.includes('explore');

              if (!hasValidPath) {
                console.log(`Skipping ${url.href} - invalid path structure`);
                return false;
              }

              // Store normalized URL back in source
              source.url = normalizedUrl;
              return true;
            } catch (error) {
              console.error(`Error validating source:`, error);
              return false;
            }
          }).map(source => ({
            url: source.url,
            rank: Math.min(Math.max(1, source.rank || 5), 10),
            followers: source.followers,
            keyword,
            description: source.description
          }));

          results = [...results,...validSources];
        }
      } catch (parseError) {
        console.error(`Error parsing JSON match for ${keyword}:`, parseError);
        continue;
      }
    }

    return results;
  } catch (e) {
    console.error(`Error processing sources for ${keyword}:`, e, content);
    return [];
  }
}