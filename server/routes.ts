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

// Helper function to add delay between requests
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function for Social Searcher API
async function searchSocialSourcesByKeyword(keyword: string, authToken: string): Promise<any[]> {
  // Check cache first
  const cached = getCachedResults(keyword);
  if (cached) return cached;

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
      // Add delay to prevent rate limiting
      await delay(2000);

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

      if (response.data?.meta?.http_code === 403) {
        console.log('Social Searcher API daily limit reached, skipping YouTube search');
        return [];
      }

      const results = response.data?.posts?.map((post: any) => ({
        url: normalizeSourceUrl(post.user?.url, 'youtube.com') || post.user?.url,
        name: post.user?.name || '',
        rank: 5,
        followers: 100000,
        title: post.title || '',
        description: post.text || `YouTube канал: ${post.user?.name}`,
        keyword,
        platform: 'youtube'
      })).filter(Boolean) || [];

      // Cache the results
      searchCache.set(keyword, {
        timestamp: Date.now(),
        results
      });

      return results;

    } catch (apiError: any) {
      if (apiError.response?.data?.meta?.http_code === 403 || apiError.response?.status === 403) {
        console.log('Social Searcher API limit reached, continuing with Perplexity results only');
      } else {
        console.error('Social Searcher API error:', apiError.message);
      }
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
    return 0;
  }
}

// Helper function to extract sources from text content
function extractSourcesFromText(content: string): any[] {
  const sources: any[] = [];

  // Extract structured account information with followers count
  const structuredPattern = /\*\*([^*]+)\(@([a-zA-Z0-9._]+)\)\*\*[^*]*\*\*Followers:\*\*\s*([0-9.]+\s*[KkMm])/g;
  let match;

  while ((match = structuredPattern.exec(content)) !== null) {
    const [_, name, handle, followersText] = match;
    const followers = parseFollowerCount(followersText);

    if (followers >= 50000) { // Minimum follower requirement for Instagram
      sources.push({
        url: `https://instagram.com/${handle}`,
        name: name.trim(),
        rank: 5,
        followers,
        platform: 'instagram.com',
        description: `Instagram аккаунт @${handle} - ${name.trim()}`
      });
    }
  }

  // Extract Instagram handles with follower counts
  const instagramPattern = /@([a-zA-Z0-9._]+)[^@]*?([0-9.]+\s*(?:тысяч|тыс|k|K|млн|million|M|м))/gi;

  while ((match = instagramPattern.exec(content)) !== null) {
    const [_, handle, followersText] = match;
    const followers = parseFollowerCount(followersText);

    if (followers >= 50000 && !sources.some(s => s.url.includes(handle))) {
      sources.push({
        url: `https://instagram.com/${handle}`,
        name: handle,
        rank: 5,
        followers,
        platform: 'instagram.com',
        description: `Instagram аккаунт @${handle}`
      });
    }
  }

  return sources;
}

// Helper function to handle Perplexity search
async function existingPerplexitySearch(keyword: string, token: string): Promise<any[]> {
  const followerRequirements: PlatformRequirements = {
    'instagram.com': 50000,
    'vk.com': 10000,
    't.me': 5000,
    'reddit.com': 50000,
    'twitter.com': 10000,
    'x.com': 10000
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
      {
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: `You are an expert at finding high-quality social media sources.
Provide information about Instagram, Telegram, VK, and Reddit accounts.
Return ONLY active accounts with regular posts.
Requirements for followers:
- Instagram: > 50,000
- Telegram: > 5,000
- VK: > 10,000
- Reddit: > 50,000`
          },
          {
            role: "user",
            content: `Find TOP-5 most authoritative sources in Instagram and other social networks (except YouTube) for: ${keyword}`
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

    let allSources: any[] = [];

    // Try parsing JSON arrays first
    const jsonMatches = content.match(/\[[\s\S]*?\]/g) || [];
    for (const match of jsonMatches) {
      try {
        const sources = JSON.parse(match);
        if (Array.isArray(sources)) {
          allSources.push(...sources);
        }
      } catch (e) {
        console.log('Failed to parse JSON, will try text extraction');
      }
    }

    // Extract sources from narrative text
    const textSources = extractSourcesFromText(content);
    allSources.push(...textSources);

    // Validate and normalize sources
    const validSources = allSources
      .filter(source => {
        if (!source.url) return false;

        // Handle Instagram handles
        if (source.url.startsWith('@')) {
          source.url = `https://instagram.com/${source.url.substring(1)}`;
        }

        // Normalize URL
        if (!source.url.startsWith('http')) {
          source.url = `https://${source.url}`;
        }

        // Find matching platform
        const platform = Object.keys(followerRequirements).find(p => source.url.includes(p));
        if (!platform) return false;

        // Check followers requirement
        return !source.followers || source.followers >= followerRequirements[platform];
      })
      .map(source => ({
        url: source.url,
        rank: Math.min(Math.max(1, source.rank || 5), 10),
        followers: source.followers || followerRequirements[source.url.includes('instagram.com') ? 'instagram.com' : source.url.includes('vk.com') ? 'vk.com' : 't.me'],
        keyword,
        description: source.description || '',
        platform: Object.keys(followerRequirements).find(p => source.url.includes(p)) || ""
      }));

    console.log(`Found ${validSources.length} valid sources for keyword ${keyword}`);
    return validSources;

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
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');
      const { keywords } = req.body;

      if (!Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: "Keywords array is required and cannot be empty" });
      }

      console.log('Starting source search for keywords:', keywords);

      // Process keywords sequentially to avoid rate limits
      const results = [];
      for (const keyword of keywords) {
        // Check cache first
        const cached = getCachedResults(keyword);
        if (cached) {
          results.push(...cached);
          continue;
        }

        // Add delay between keyword searches
        await delay(1000);

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

        const combinedResults = [...perplexityResults, ...socialSearcherResults];

        // Cache the combined results
        searchCache.set(keyword, {
          timestamp: Date.now(),
          results: combinedResults
        });

        results.push(...combinedResults);
      }

      // Remove duplicates and normalize URLs
      const uniqueSourcesMap = new Map();
      results.forEach(source => {
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
        total: results.length,
        unique: uniqueSources.length,
        platforms: uniqueSources.reduce((acc: any, src: any) => {
          acc[src.platform] = (acc[src.platform] || 0) + 1;
          return acc;
        }, {})
      });

      res.json({
        sources: uniqueSources,
        meta: {
          total: results.length,
          unique: uniqueSources.length,
          cached: searchCache.size
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