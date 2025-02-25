import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSourceSchema } from "@shared/schema";
import { crawler } from "./services/crawler";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Sources routes
  app.get("/api/sources", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;

      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      console.log("Fetching sources for user:", userId, "campaign:", campaignId);

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
      const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;

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

      console.log('Fetching trends with params:', { period, from, campaignId });
      const trends = await storage.getTrendTopics({ from, campaignId });
      console.log('Found trends:', trends);
      res.json({ data: trends });
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
      const sources = await storage.getContentSources(userId, campaignId);
      if (!sources || sources.length === 0) {
        return res.status(400).json({ message: "No sources found for this campaign" });
      }

      await crawler.crawlAllSources(userId, Number(campaignId));
      console.log('Trend collection completed');

      res.json({ message: "Trend collection started" });
    } catch (error) {
      console.error("Error collecting trends:", error);
      res.status(500).json({ error: "Failed to collect trends" });
    }
  });

  return httpServer;
}