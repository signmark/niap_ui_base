
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertKeywordSchema } from "@shared/schema";
import axios from "axios";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const campaigns = await storage.getCampaigns(userId);
    res.json(campaigns);
  });

  app.post("/api/campaigns", async (req, res) => {
    const result = insertCampaignSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ errors: result.error.errors });
    }
    const campaign = await storage.createCampaign(result.data);
    res.json(campaign);
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    await storage.deleteCampaign(Number(req.params.id));
    res.status(204).end();
  });

  // Keywords routes
  app.get("/api/campaigns/:id/keywords", async (req, res) => {
    const keywords = await storage.getKeywords(Number(req.params.id));
    res.json(keywords);
  });

  app.post("/api/keywords", async (req, res) => {
    const result = insertKeywordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ errors: result.error.errors });
    }
    const keyword = await storage.addKeyword(result.data);
    res.json(keyword);
  });

  app.delete('/api/keywords/:id', async (req, res) => {
    try {
      await storage.deleteKeyword(Number(req.params.id));
      res.status(200).json({ message: 'Keyword deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete keyword' });
    }
  });

  // Search endpoint
  app.post('/api/search', async (req, res) => {
    const { keywords } = req.body;
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

    try {
      const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });

      if (!webhookResponse.ok) {
        throw new Error('Webhook request failed');
      }

      res.status(200).json({ message: 'Search initiated' });
    } catch (error) {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Posts endpoints
  app.post('/api/posts', async (req, res) => {
    const { date, content, mediaUrl, campaignId } = req.body;
    
    try {
      await storage.createPost({ date: new Date(date), content, mediaUrl, campaignId });
      res.status(201).json({ message: 'Post created' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create post' });
    }
  });

  app.get('/api/posts', async (req, res) => {
    try {
      const campaignId = Number(req.query.campaignId);
      const posts = await storage.getPosts(campaignId);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  });

  // XMLRiver API proxy
  app.get("/api/wordstat/:keyword", async (req, res) => {
    try {
      const response = await axios.get(`http://xmlriver.com/wordstat/json`, {
        params: {
          user: process.env.XMLRIVER_USER,
          key: process.env.XMLRIVER_KEY,
          query: req.params.keyword
        }
      });

      if (!response.data?.content?.includingPhrases?.items) {
        throw new Error("Некорректный формат ответа от XMLRiver API");
      }

      const keywords = response.data.content.includingPhrases.items.map((item) => ({
        keyword: item.phrase,
        trend: parseInt(item.number.replace(/\s/g, '')) || 0
      }));

      res.json({ data: { keywords } });
    } catch (error) {
      console.error('XMLRiver API error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Error fetching keywords from XMLRiver" 
      });
    }
  });

  return httpServer;
}
