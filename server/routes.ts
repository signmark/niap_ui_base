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
        // Convert all YouTube channel formats to @username
        // First convert /channel/ format
        const channelMatch = normalizedUrl.match(/\/channel\/([^\/\?]+)/);
        if (channelMatch) {
          return `https://youtube.com/@${channelMatch[1]}`;
        }

        // Then handle /c/ format
        const cMatch = normalizedUrl.match(/\/c\/([^\/\?]+)/);
        if (cMatch) {
          return `https://youtube.com/@${cMatch[1]}`;
        }

        // If already has @, ensure proper format
        if (normalizedUrl.includes('@')) {
          const username = normalizedUrl.split('@')[1]?.split('/')[0];
          if (username) {
            return `https://youtube.com/@${username}`;
          }
        }

        // For bare channel URLs, extract channel name
        const parts = normalizedUrl.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart !== '') {
          return `https://youtube.com/@${lastPart}`;
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
        // Ensure VK URLs don't contain @ symbol and handle Cyrillic
        normalizedUrl = normalizedUrl.replace('@', '');
        if (normalizedUrl.includes('%')) {
          try {
            normalizedUrl = decodeURIComponent(normalizedUrl);
          } catch (e) {
            console.log('Error decoding VK URL:', e);
          }
        }
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
    if (!urlObj.pathname || urlObj.pathname === '/') {
      console.log(`Invalid URL path: ${normalizedUrl}`);
      return null;
    }

    return normalizedUrl.replace(/\/$/, '');
  } catch (error) {
    console.error(`Error normalizing URL ${url}:`, error);
    return null;
  }
}

// Add interface for Social Searcher response
interface SocialSearcherResponse {
  status: number;
  data: {
    meta: {
      http_code: number;
      network: string;
      query_type: string;
    };
    posts: Array<{
      network: string;
      posted: string;
      postid: string;
      title?: string;
      text?: string;
      type?: string;
      image?: string;
      url: string;
      user?: {
        userid: string;
        name: string;
        url: string;
      };
    }>;
  };
  params: {
    keyword: string;
    network: string;
    lang: string;
  };
}

// Helper function for Social Searcher API - currently only YouTube, will expand to other platforms later
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

    try {
      // Make request to Social Searcher API
      const response = await axios.get('https://api.social-searcher.com/v2/users', {
        params: {
          q: encodeURIComponent(keyword),
          key: socialSearcherKey,
          network: 'youtube',
          lang: 'ru,en'
        },
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.data?.posts) {
        console.log('No posts found in Social Searcher response');
        return [];
      }

      // Process and validate results
      const validPosts = response.data.posts
        .filter((post: any) => {
          try {
            if (!post.user?.url || !post.user?.name) {
              return false;
            }

            // Normalize YouTube URL
            const normalizedUrl = normalizeSourceUrl(post.user.url, 'youtube.com');
            if (!normalizedUrl) {
              return false;
            }

            // Store normalized URL
            post.url = normalizedUrl;
            return true;
          } catch (error) {
            console.error(`Error validating YouTube post:`, error);
            return false;
          }
        });

      // Map to consistent format
      return validPosts.map((post: any) => ({
        url: post.url,
        name: post.user?.name || '',
        rank: 5,
        followers: 100000,
        title: post.title || '',
        description: post.text || `YouTube канал: ${post.user?.name}`,
        keyword,
        platform: 'youtube'
      }));

    } catch (apiError: any) {
      // Handle 403 and other API errors gracefully
      console.log(`Social Searcher API error (${apiError.response?.status || 'unknown'}):`,
        apiError.response?.data || apiError.message);
      return [];
    }

  } catch (error) {
    console.error('Error in Social Searcher setup:', error);
    return [];
  }
}

// Helper function to handle Perplexity search - специализируется на Instagram и других платформах
async function existingPerplexitySearch(keyword: string, token: string): Promise<any[]> {
    const followerRequirements: PlatformRequirements = {
      'instagram.com': 50000,
      'vk.com': 10000,
      't.me': 5000,
      'reddit.com': 50000,
      'twitter.com': 10000,
      'x.com': 10000
    };

    const requestBody = {
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content: `Вы - эксперт по поиску высококачественных источников в социальных сетях, специализирующийся на Instagram, Telegram, VK и Reddit.

ВАЖНЫЕ ТРЕБОВАНИЯ К ИСТОЧНИКАМ:
1. Возвращайте ТОЛЬКО существующие и активные аккаунты с регулярными публикациями
2. Тщательно проверяйте количество подписчиков:
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
   - НЕ используйте кириллицу в URL
   - ОБЯЗАТЕЛЬНО проверьте существование аккаунта перед включением в список

5. Формат ответа строго JSON:
[{
  "url": "https://instagram.com/example",
  "rank": 2,
  "followers": 150000,
  "description": "Подробное описание аккаунта: тематика, экспертиза автора"
}]`
        },
        {
          role: "user",
          content: `Найдите ТОП-5 самых авторитетных источников в Instagram и других социальных сетях (кроме YouTube) по теме: ${keyword}.
ОБЯЗАТЕЛЬНО:
1. Проверьте реальное существование аккаунта
2. Укажите точное количество подписчиков
3. Оцените профессионализм автора для точного ранжирования
4. Исключите заброшенные аккаунты
5. Добавьте подробное описание для каждого источника`
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    };

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
        // Extract JSON arrays from the content
        const jsonMatches = content.match(/\[[\s\S]*?\]/g) || [];
        let results: any[] = [];

        for (const match of jsonMatches) {
          try {
            const sources = JSON.parse(match);
            if (!Array.isArray(sources)) continue;

            const validSources = sources.filter(source => {
              try {
                // Basic validation
                if (!source.url || !source.followers || !source.description) {
                  console.log(`Skipping source - missing required fields:`, source);
                  return false;
                }

                // Normalize URL
                let normalizedUrl = source.url;
                if (!normalizedUrl.startsWith('http')) {
                  normalizedUrl = `https://${normalizedUrl}`;
                }

                // Find matching platform
                const platform = Object.keys(followerRequirements).find(p => normalizedUrl.includes(p));
                if (!platform) {
                  console.log(`Skipping source - unsupported platform: ${normalizedUrl}`);
                  return false;
                }

                // Check follower count requirement
                const minFollowers = followerRequirements[platform];
                if (source.followers < minFollowers) {
                  console.log(`Skipping ${normalizedUrl} - insufficient followers: ${source.followers} < ${minFollowers}`);
                  return false;
                }

                // Store normalized URL back in source
                source.url = normalizedUrl;
                return true;
              } catch (error) {
                console.error(`Error validating source:`, error);
                return false;
              }
            });

            const mappedSources = validSources.map(source => ({
              url: source.url,
              rank: Math.min(Math.max(1, source.rank || 5), 10),
              followers: source.followers,
              keyword,
              description: source.description,
              platform: Object.keys(followerRequirements).find(p => source.url.includes(p)) || ""
            }));

            results = [...results, ...mappedSources];
          } catch (parseError) {
            console.error(`Error parsing JSON match for ${keyword}:`, parseError);
            continue;
          }
        }

        console.log(`Found ${results.length} valid sources for keyword ${keyword}`);
        return results;
      } catch (e) {
        console.error(`Error processing sources for ${keyword}:`, e, content);
        return [];
      }
    } catch (error) {
      console.error('Error in Perplexity search:', error);
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
          existingPerplexitySearch(keyword, token).catch(error => {
            console.error('Perplexity search error:', error);
            return [];
          }),
          searchSocialSourcesByKeyword(keyword, token).catch(error => {
            console.error('Social Searcher error:', error);
            return [];
          })
        ]);

        // Log results for debugging
        console.log(`Results for keyword "${keyword}":`, {
          perplexity: perplexityResults.length,
          socialSearcher: socialSearcherResults.length
        });

        return [...perplexityResults, ...socialSearcherResults];
      });

      const results = await Promise.all(searchPromises);
      const allSources = results.flat();

      // Improved duplicate removal with URL normalization
      const uniqueSourcesMap = new Map();
      allSources.forEach(source => {
        const key = source.url.toLowerCase().trim();
        if (!uniqueSourcesMap.has(key) || source.rank < uniqueSourcesMap.get(key).rank) {
          uniqueSourcesMap.set(key, source);
        }
      });

      const uniqueSources = Array.from(uniqueSourcesMap.values())
        .sort((a, b) => {
          const rankDiff = (a.rank || 5) - (b.rank || 5);
          return rankDiff !== 0 ? rankDiff : (b.followers || 0) - (a.followers || 0);
        });

      console.log('Found sources:', {
        total: allSources.length,
        unique: uniqueSources.length,
        platforms: uniqueSources.reduce((acc: any, src: any) => {
          acc[src.platform] = (acc[src.platform] || 0) + 1;
          return acc;
        }, {})
      });

      res.json({
        sources: uniqueSources,
        meta: {
          total: allSources.length,
          unique: uniqueSources.length
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