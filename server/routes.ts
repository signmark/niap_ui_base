import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSourceSchema } from "@shared/schema";
import { crawler } from "./services/crawler";
import axios from "axios";
import { directusApi } from './directus'; // Assuming this is defined elsewhere
import * as crypto from 'crypto';

export async function registerRoutes(app: Express): Promise<Server> {
  console.log('Starting route registration...');
  const httpServer = createServer(app);

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

      // Get Perplexity API key using correct endpoint and filter
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
        return res.status(400).json({ error: "Perplexity API key not found. Please add it in settings." });
      }

      const { keywords } = req.body;
      if (!Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: "Keywords array is required and cannot be empty" });
      }

      console.log('Starting source search for keywords:', keywords);

      const searchPromises = keywords.map(async keyword => {
        console.log(`Searching sources for keyword: ${keyword}`);

        const requestBody = {
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "system",
              content: `Вы - эксперт по поиску качественных источников в социальных сетях. Строго проверяйте требования к количеству подписчиков:
- YouTube каналы (youtube.com/c/ или youtube.com/channel/): ТОЛЬКО с более чем 100,000 подписчиков
- Reddit (reddit.com/r/): ТОЛЬКО сабреддиты с более чем 50,000 участников
- VK (vk.com/): ТОЛЬКО группы/паблики с более чем 10,000 подписчиков
- Telegram (t.me/): ТОЛЬКО каналы с более чем 5,000 подписчиков
- Instagram (instagram.com/): ТОЛЬКО аккаунты с более чем 50,000 подписчиков
- Twitter/X (twitter.com/ или x.com/): ТОЛЬКО аккаунты с более чем 10,000 подписчиков

ВАЖНО:
1. Возвращайте ТОЛЬКО реальные, активные и популярные каналы/группы
2. Всегда используйте полные URL с https://
3. Проверяйте существование и активность каждого источника
4. НЕ включайте источники с меньшим числом подписчиков
5. Формат ответа строго JSON массив: [{"url":"https://platform.com/account","rank":1,"followers":100000}]
6. Ранг от 1 до 10, где 1 - самый качественный источник`
            },
            {
              role: "user",
              content: `Найдите ТОП-5 самых популярных и качественных источников по теме: ${keyword}. 
ОБЯЗАТЕЛЬНО:
1. Проверьте количество подписчиков
2. Убедитесь, что канал активен
3. Используйте только полные URL с https://
4. Укажите точное количество подписчиков в поле followers`
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        };

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

          for (const match of jsonMatches) {
            try {
              const sources = JSON.parse(match);

              if (Array.isArray(sources)) {
                const validSources = sources.filter(source => {
                  try {
                    if (!source.url || !source.followers) {
                      return false;
                    }

                    const url = new URL(source.url);

                    // Platform-specific follower requirements
                    const followerRequirements = {
                      'youtube.com': 100000,
                      'reddit.com': 50000,
                      'vk.com': 10000,
                      't.me': 5000,
                      'instagram.com': 50000,
                      'twitter.com': 10000,
                      'x.com': 10000
                    };

                    // Check if URL is from supported platform
                    const platform = Object.keys(followerRequirements).find(p => url.hostname.includes(p));
                    if (!platform) {
                      return false;
                    }

                    // Check follower count requirement
                    if (source.followers < followerRequirements[platform]) {
                      console.log(`Skipping ${url.href} - insufficient followers: ${source.followers} < ${followerRequirements[platform]}`);
                      return false;
                    }

                    // Validate URL structure
                    const hasValidPath = url.pathname.length > 1 && 
                      !url.pathname.includes('?') && 
                      !url.pathname.includes('search') &&
                      !url.pathname.includes('explore');

                    return hasValidPath;
                  } catch (error) {
                    console.error(`Error validating source:`, error);
                    return false;
                  }
                }).map(source => ({
                  url: source.url,
                  rank: Math.min(Math.max(1, source.rank || 5), 10),
                  followers: source.followers,
                  keyword
                }));

                if (validSources.length > 0) {
                  console.log(`Found ${validSources.length} valid sources for ${keyword}:`, validSources);
                  return validSources;
                }
              }
            } catch (parseError) {
              console.error(`Error parsing JSON match for ${keyword}:`, parseError);
              continue;
            }
          }

          console.error(`No valid sources found in response for ${keyword}`);
          return [];

        } catch (e) {
          console.error(`Error processing sources for ${keyword}:`, e, content);
          return [];
        }
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
            sources: uniqueSources.map(({ url, rank, keyword }) => ({ url, rank, keyword })),
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