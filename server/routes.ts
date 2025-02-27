import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSourceSchema } from "@shared/schema";
import { crawler } from "./services/crawler";
import axios from "axios";
import { directusApi } from "./lib/directus";

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
      const userId = req.headers["x-user-id"] as string;
      const campaignId = req.query.campaignId ? Number(req.query.campaignId) : undefined;

      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      console.log("Fetching sources for user:", userId, "campaign:", campaignId);

      if (campaignId && isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const sources = await storage.getContentSources(userId, campaignId);
      console.log("Found sources:", sources);
      res.json({ data: sources });
    } catch (error) {
      console.error("Error fetching sources:", error);
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

      // Get campaign UUID from Directus
      const campaignResponse = await directusApi.get('/items/user_campaigns', {
        params: {
          filter: {
            directus_id: { _eq: campaignId }
          },
          fields: ['id']
        }
      });

      if (!campaignResponse.data?.data?.[0]?.id) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const directusCampaignId = campaignResponse.data.data[0].id;
      console.log('Starting trend collection for user:', userId, 'campaign:', directusCampaignId);

      // Get sources for this campaign
      const sources = await storage.getContentSources(userId, Number(campaignId));
      if (!sources || sources.length === 0) {
        return res.status(400).json({ message: "No sources found for this campaign" });
      }

      // Start crawling process
      await crawler.crawlAllSources(userId, directusCampaignId);
      console.log('Trend collection completed');

      res.json({ message: "Trend collection completed successfully" });
    } catch (error) {
      console.error("Error collecting trends:", error);
      res.status(500).json({ error: "Failed to collect trends" });
    }
  });

  // Sources collection endpoint
  app.post("/api/sources/collect", async (req, res) => {
    try {
      const { keywords } = req.body;
      if (!Array.isArray(keywords) || keywords.length === 0) {
        console.error('Invalid keywords array:', keywords);
        return res.status(400).json({ error: "Keywords array is required and cannot be empty" });
      }

      // Get authorization token
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        console.error('Missing authorization header');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');
      console.log('Starting source collection with keywords:', keywords);

      // Call n8n webhook with keywords and auth token in body
      const response = await axios.post(
        'https://n8n.nplanner.ru/webhook/e2a3fcb2-1427-40e7-b61a-38eacfaeb8c9',
        {
          perplexity_api: "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",
          keywords,
          token,
          query: `Find social media accounts, groups, and channels on YouTube, Reddit, VKontakte (VK), LinkedIn, and other platforms that frequently discuss these topics: ${keywords.join(', ')}. For each source, provide the platform name, URL, and brief description of their content focus.`
        }
      );

      console.log('n8n webhook response received:', response.status);

      if (!response.data || response.status !== 200) {
        console.error('Invalid response from n8n:', response.data);
        throw new Error('Invalid response from n8n webhook');
      }

      // Parse response for social media URLs
      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Invalid response format from n8n');
      }

      // Extract URLs from content and validate they're social media
      const urlPattern = /(https?:\/\/[^\s]+)/g;
      const urls = content.match(urlPattern) || [];

      const validDomains = ['youtube.com', 'reddit.com', 'vk.com', 'linkedin.com', 't.me', 'diets.ru'];
      const socialMediaUrls = urls.filter(url => 
        validDomains.some(domain => url.includes(domain))
      );

      res.json({
        success: true,
        data: {
          sources: socialMediaUrls,
          rawContent: content
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
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { url, sourceType } = req.body;
      if (!url || !sourceType) {
        return res.status(400).json({ error: "URL and source type are required" });
      }

      // Get user's Apify API key
      const apiKeyResponse = await directusApi.get('/items/user_api_keys', {
        params: {
          filter: {
            user_id: { _eq: userId },
            service_name: { _eq: 'apify' }
          },
          fields: ['api_key']
        }
      });

      const apifyKey = apiKeyResponse.data?.data?.[0]?.api_key;
      if (!apifyKey) {
        return res.status(400).json({ error: "Apify API key not found. Please add it in settings." });
      }

      // Call n8n webhook with the API key and source details
      const response = await axios.post(
        'https://n8n.nplanner.ru/webhook/apify-parser',
        {
          apiKey: apifyKey,
          url: url,
          sourceType: sourceType
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('n8n response:', response.data);

      res.json({
        success: true,
        data: response.data
      });

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
      directusApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const sourceId = req.params.sourceId;
      const { campaignId } = req.body;

      if (!sourceId || !campaignId) {
        console.error('Missing required parameters:', { sourceId, campaignId });
        return res.status(400).json({ message: "Source ID and Campaign ID are required" });
      }

      // Get user ID from token
      const userResponse = await directusApi.get('/users/me');
      const userId = userResponse.data?.data?.id;

      if (!userId) {
        console.error('Could not get user ID from token');
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get source for this campaign
      const sources = await storage.getContentSources(userId, Number(campaignId));
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
        const topics = await crawler.crawlSource(source, Number(campaignId), userId);
        console.log(`Found ${topics.length} topics for source ${source.name}`);

        if (topics.length === 0) {
          console.error('No topics found for source:', source.name);
          return res.status(404).json({ message: "No topics found for this source" });
        }

        // Create crawler task in Directus after successful crawl
        console.log('Creating crawler task in Directus');
        const taskData = {
          source_id: sourceId,
          campaign_id: campaignId,
          status: "processing",
          started_at: new Date().toISOString(),
          completed_at: null,
          error_message: null
        };

        taskResponse = await directusApi.post('/items/crawler_tasks', taskData);
        console.log('Created task:', taskResponse.data);

        // Save topics
        for (const topic of topics) {
          console.log(`Saving topic: ${topic.title}`);
          await directusApi.post('/items/campaign_trend_topics', {
            id: topic.directusId,
            title: topic.title,
            source_id: topic.sourceId,
            campaign_id: campaignId,
            reactions: topic.reactions,
            comments: topic.comments,
            views: topic.views,
            is_bookmarked: false
          });
        }

        // Mark task as completed
        await directusApi.patch(`/items/crawler_tasks/${taskResponse.data.data.id}`, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });

        res.json({
          message: "Source crawling completed successfully",
          data: {
            taskId: taskResponse.data.data.id,
            topicsCount: topics.length
          }
        });

      } catch (error) {
        console.error("Error during crawling:", error);

        // If task was created, mark it as failed
        if (taskResponse?.data?.data?.id) {
          await directusApi.patch(`/items/crawler_tasks/${taskResponse.data.data.id}`, {
            status: 'error',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error'
          });
        }

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