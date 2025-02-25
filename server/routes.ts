import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertKeywordSchema, insertContentSourceSchema } from "@shared/schema";
import axios from "axios";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Content Sources routes
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
      res.json({ data: sources }); // Оборачиваем в объект с полем data
    } catch (error) {
      console.error("Error fetching sources:", error);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.post("/api/sources", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const result = insertContentSourceSchema.safeParse({ ...req.body, userId });
      if (!result.success) {
        return res.status(400).json({ errors: result.error.errors });
      }

      const source = await storage.createContentSource(result.data);
      res.status(201).json({ data: source }); // Оборачиваем в объект с полем data
    } catch (error) {
      console.error("Error creating source:", error);
      res.status(500).json({ error: "Failed to create source" });
    }
  });

  // Добавляем новый endpoint для удаления источника
  app.delete("/api/sources/:id", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      await storage.deleteContentSource(Number(req.params.id), userId);
      res.status(200).json({ message: "Source deleted successfully" });
    } catch (error) {
      console.error("Error deleting source:", error);
      res.status(500).json({ error: "Failed to delete source" });
    }
  });

  // Trends routes
  app.get("/api/trends", async (req, res) => {
    try {
      const period = req.query.period as string;
      const campaignId = req.query.campaignId ? Number(req.query.campaignId) : undefined;

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
          from.setDate(from.getDate() - 7); // По умолчанию за неделю
      }

      console.log('Fetching trends with params:', { period, from, campaignId });
      const trends = await storage.getTrendTopics({ from, campaignId });
      console.log('Found trends:', trends);
      res.json({ data: trends }); // Оборачиваем в объект с полем data
    } catch (error) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ error: "Failed to fetch trends" });
    }
  });

  // Обновляем endpoint для запуска сбора трендов
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

      console.log('Starting trend collection for user:', userId, 'campaign:', campaignId);

      // Получаем источники для данной кампании
      const sources = await storage.getContentSources(userId, Number(campaignId));
      if (!sources || sources.length === 0) {
        return res.status(400).json({ message: "No sources found for this campaign" });
      }

      const { crawler } = await import('./services/crawler');
      await crawler.crawlAllSources(userId, Number(campaignId));
      console.log('Trend collection completed');

      res.json({ message: "Trend collection started" });
    } catch (error) {
      console.error("Error collecting trends:", error);
      res.status(500).json({ error: "Failed to collect trends" });
    }
  });

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      console.log(`Fetching campaigns for user ${req.headers["x-user-id"]}`);
      const userId = req.headers["x-user-id"] as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const campaigns = await storage.getCampaigns(userId);
      console.log("Campaigns found:", campaigns);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      console.log("Received campaign data:", req.body);
      const result = insertCampaignSchema.safeParse(req.body);
      if (!result.success) {
        console.error("Validation error:", result.error.errors);
        return res.status(400).json({ errors: result.error.errors });
      }
      const campaign = await storage.createCampaign(result.data);
      console.log("Campaign created:", campaign);
      res.json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      console.log(`Deleting campaign ${req.params.id}`);
      await storage.deleteCampaign(Number(req.params.id));
      console.log("Campaign deleted successfully");
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // Keywords routes
  app.get("/api/campaigns/:id/keywords", async (req, res) => {
    try {
      console.log(`Fetching keywords for campaign ${req.params.id}`);
      const keywords = await storage.getKeywords(Number(req.params.id));
      console.log("Keywords found:", keywords);
      res.json(keywords);
    } catch (error) {
      console.error("Error fetching keywords:", error);
      res.status(500).json({ error: "Failed to fetch keywords" });
    }
  });

  app.post("/api/keywords", async (req, res) => {
    try {
      console.log("Received keyword data:", req.body);
      const result = insertKeywordSchema.safeParse(req.body);
      if (!result.success) {
        console.error("Validation error:", result.error.errors);
        return res.status(400).json({ errors: result.error.errors });
      }
      const keyword = await storage.addKeyword(result.data);
      console.log("Keyword added:", keyword);
      res.json(keyword);
    } catch (error) {
      console.error("Error adding keyword:", error);
      res.status(500).json({ error: "Failed to add keyword" });
    }
  });

  app.delete('/api/keywords/:id', async (req, res) => {
    try {
      console.log(`Deleting keyword ${req.params.id}`);
      await storage.deleteKeyword(Number(req.params.id));
      console.log("Keyword deleted successfully");
      res.status(200).json({ message: 'Keyword deleted' });
    } catch (error) {
      console.error("Error deleting keyword:", error);
      res.status(500).json({ error: 'Failed to delete keyword' });
    }
  });

  // Search endpoint
  app.post('/api/perplexity/search', async (req, res) => {
    try {
      const { keywords } = req.body;
      console.log("Received search request for keywords:", keywords);

      if (!keywords || !Array.isArray(keywords)) {
        console.error("Invalid keywords format:", keywords);
        return res.status(400).json({ error: 'Keywords array is required' });
      }

      const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
      if (!N8N_WEBHOOK_URL) {
        console.error("N8N webhook URL not configured");
        return res.status(500).json({ error: 'N8N webhook URL is not configured' });
      }

      console.log("Sending request to N8N webhook");
      await axios.post(N8N_WEBHOOK_URL, { keywords });
      console.log("Search request sent successfully");

      res.status(200).json({ message: 'Search initiated' });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Failed to initiate search' });
    }
  });

  // Posts endpoints
  app.post('/api/posts', async (req, res) => {
    const { date, content, mediaUrl, campaignId } = req.body;    
    try {
      console.log("Creating new post:", req.body);
      await storage.createPost({ date: new Date(date), content, mediaUrl, campaignId });
      console.log("Post created successfully");
      res.status(201).json({ message: 'Post created' });
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ error: 'Failed to create post' });
    }
  });

  app.get('/api/posts', async (req, res) => {
    try {
      console.log("Fetching posts. Query params:", req.query);
      const campaignId = Number(req.query.campaignId);
      const posts = await storage.getPosts(campaignId);
      console.log("Posts fetched:", posts);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  });

  // XMLRiver API proxy
  app.get("/api/wordstat/:keyword", async (req, res) => {
    try {
      console.log(`Searching WordStat for keyword: ${req.params.keyword}`);
      const response = await axios.get(`http://xmlriver.com/wordstat/json`, {
        params: {
          user: process.env.XMLRIVER_USER,
          key: process.env.XMLRIVER_KEY,
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
        trend: parseInt(item.number.replace(/\s/g, '')) || 0
      }));

      console.log("Processed keywords:", keywords);
      res.json({ data: { keywords } });
    } catch (error) {
      console.error('XMLRiver API error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Error fetching keywords from XMLRiver" 
      });
    }
  });

  // Добавляем новый endpoint для генерации контента
  app.post("/api/content/generate", async (req, res) => {
    try {
      const { topics, prompt, useAI } = req.body;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!topics || !Array.isArray(topics) || topics.length === 0) {
        return res.status(400).json({ error: "No topics selected" });
      }

      // Здесь будет логика генерации контента
      // Можно использовать DeepSeek или другой AI-сервис

      // Пока возвращаем заглушку
      res.json({
        message: "Content generation started",
        topics,
        prompt,
        useAI
      });
    } catch (error) {
      console.error("Error generating content:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });


  return httpServer;
}