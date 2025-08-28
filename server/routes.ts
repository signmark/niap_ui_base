import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserCampaignSchema, insertCampaignContentSchema, insertContentSourceSchema,
  insertCampaignTrendTopicSchema, insertBusinessQuestionnaireSchema, insertAnalyticsDataSchema
} from "@shared/schema";
import { generateContent } from "./services/openai";
import { analyzeTrends } from "./services/perplexity";
import { publishToSocialMedia } from "./services/social-media";

export async function registerRoutes(app: Express): Promise<Server> {
  // Campaigns routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }
      
      const campaigns = await storage.getUserCampaigns(userId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const validatedData = insertUserCampaignSchema.parse({ ...req.body, userId });
      const campaign = await storage.createCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.put("/api/campaigns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.updateCampaign(id, req.body);
      res.json(campaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCampaign(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // Content routes
  app.get("/api/content", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const campaignId = req.query.campaignId as string;
      
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const content = campaignId 
        ? await storage.getCampaignContent(campaignId)
        : await storage.getUserContent(userId);
      
      res.json(content);
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.get("/api/content/scheduled", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const scheduledContent = await storage.getScheduledContent(userId);
      res.json(scheduledContent);
    } catch (error) {
      console.error("Error fetching scheduled content:", error);
      res.status(500).json({ message: "Failed to fetch scheduled content" });
    }
  });

  app.post("/api/content", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const validatedData = insertCampaignContentSchema.parse({ ...req.body, userId });
      const content = await storage.createContent(validatedData);
      res.status(201).json(content);
    } catch (error) {
      console.error("Error creating content:", error);
      res.status(500).json({ message: "Failed to create content" });
    }
  });

  app.put("/api/content/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const content = await storage.updateContent(id, req.body);
      res.json(content);
    } catch (error) {
      console.error("Error updating content:", error);
      res.status(500).json({ message: "Failed to update content" });
    }
  });

  app.delete("/api/content/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteContent(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ message: "Failed to delete content" });
    }
  });

  // AI Content Generation
  app.post("/api/content/generate", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const { prompt, campaignId, contentType, language = "ru" } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const generatedContent = await generateContent(prompt, { contentType, language });
      
      // If campaignId is provided, save the generated content
      if (campaignId && generatedContent) {
        const contentData = {
          title: generatedContent.title || "AI Generated Content",
          content: generatedContent.content,
          campaignId,
          userId,
          aiGenerated: true,
          status: "draft" as const,
          keywords: generatedContent.keywords || [],
          metadata: { aiGenerated: true, prompt },
        };
        
        const savedContent = await storage.createContent(contentData);
        res.json(savedContent);
      } else {
        res.json(generatedContent);
      }
    } catch (error) {
      console.error("Error generating content:", error);
      res.status(500).json({ message: "Failed to generate content" });
    }
  });

  // Trend Analysis
  app.get("/api/trends", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      const trends = await storage.getCampaignTrendTopics(campaignId);
      res.json(trends);
    } catch (error) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ message: "Failed to fetch trends" });
    }
  });

  app.post("/api/trends/analyze", async (req, res) => {
    try {
      const { query, campaignId } = req.body;
      
      if (!query || !campaignId) {
        return res.status(400).json({ message: "Query and campaign ID are required" });
      }

      const trendAnalysis = await analyzeTrends(query);
      
      // Save trend topics to database
      if (trendAnalysis && trendAnalysis.length > 0) {
        const savedTrends = [];
        for (const trend of trendAnalysis) {
          const trendData = {
            title: trend.title,
            description: trend.description,
            campaignId,
            trendScore: trend.score,
            mentionsCount: trend.mentions,
            sourceUrl: trend.url,
            sourcePlatform: trend.platform,
          };
          
          const savedTrend = await storage.createTrendTopic(trendData);
          savedTrends.push(savedTrend);
        }
        res.json(savedTrends);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error analyzing trends:", error);
      res.status(500).json({ message: "Failed to analyze trends" });
    }
  });

  app.put("/api/trends/:id/bookmark", async (req, res) => {
    try {
      const { id } = req.params;
      const { isBookmarked } = req.body;
      
      const trend = await storage.updateTrendTopic(id, { isBookmarked });
      res.json(trend);
    } catch (error) {
      console.error("Error updating trend bookmark:", error);
      res.status(500).json({ message: "Failed to update trend bookmark" });
    }
  });

  // Business Questionnaire
  app.get("/api/questionnaire/:campaignId", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const questionnaire = await storage.getBusinessQuestionnaire(campaignId);
      res.json(questionnaire);
    } catch (error) {
      console.error("Error fetching questionnaire:", error);
      res.status(500).json({ message: "Failed to fetch questionnaire" });
    }
  });

  app.post("/api/questionnaire", async (req, res) => {
    try {
      const validatedData = insertBusinessQuestionnaireSchema.parse(req.body);
      const questionnaire = await storage.createBusinessQuestionnaire(validatedData);
      res.status(201).json(questionnaire);
    } catch (error) {
      console.error("Error creating questionnaire:", error);
      res.status(500).json({ message: "Failed to create questionnaire" });
    }
  });

  app.put("/api/questionnaire/:campaignId", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const questionnaire = await storage.updateBusinessQuestionnaire(campaignId, req.body);
      res.json(questionnaire);
    } catch (error) {
      console.error("Error updating questionnaire:", error);
      res.status(500).json({ message: "Failed to update questionnaire" });
    }
  });

  // Analytics
  app.get("/api/analytics", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const campaignId = req.query.campaignId as string;
      
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const analytics = campaignId 
        ? await storage.getCampaignAnalytics(campaignId)
        : await storage.getUserAnalytics(userId);
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const summary = await storage.getAnalyticsSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ message: "Failed to fetch analytics summary" });
    }
  });

  app.post("/api/analytics", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const validatedData = insertAnalyticsDataSchema.parse({ ...req.body, userId });
      const analyticsData = await storage.createAnalyticsData(validatedData);
      res.status(201).json(analyticsData);
    } catch (error) {
      console.error("Error creating analytics data:", error);
      res.status(500).json({ message: "Failed to create analytics data" });
    }
  });

  // Social Media Publishing
  app.post("/api/publish/:contentId", async (req, res) => {
    try {
      const { contentId } = req.params;
      const { platforms } = req.body;
      
      const content = await storage.getContentById(contentId);
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      const results = await publishToSocialMedia(content, platforms);
      
      // Update content status to published
      await storage.updateContent(contentId, { status: "published" });
      
      res.json(results);
    } catch (error) {
      console.error("Error publishing content:", error);
      res.status(500).json({ message: "Failed to publish content" });
    }
  });

  // Content Sources
  app.get("/api/content-sources", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const campaignId = req.query.campaignId as string;
      
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const sources = campaignId 
        ? await storage.getCampaignContentSources(campaignId)
        : await storage.getContentSources(userId);
      
      res.json(sources);
    } catch (error) {
      console.error("Error fetching content sources:", error);
      res.status(500).json({ message: "Failed to fetch content sources" });
    }
  });

  app.post("/api/content-sources", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }

      const validatedData = insertContentSourceSchema.parse({ ...req.body, userId });
      const source = await storage.createContentSource(validatedData);
      res.status(201).json(source);
    } catch (error) {
      console.error("Error creating content source:", error);
      res.status(500).json({ message: "Failed to create content source" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
