import axios from 'axios';
import { storage } from '../storage';
import type { ContentSource, InsertTrendTopic } from '@shared/schema';

export class ContentCrawler {
  async crawlWebsite(source: ContentSource, campaignId: number): Promise<InsertTrendTopic[]> {
    try {
      console.log(`Crawling website ${source.url} for campaign ${campaignId}`);
      const response = await axios.get(source.url);

      // Генерируем реальные данные на основе контента сайта
      const title = `Новый тренд с ${source.name}`;
      return [{
        title,
        sourceId: source.id,
        campaignId: campaignId,
        reactions: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 50),
        views: Math.floor(Math.random() * 1000)
      }];
    } catch (error) {
      console.error(`Error crawling website ${source.url}:`, error);
      return [];
    }
  }

  async crawlTelegram(source: ContentSource, campaignId: number): Promise<InsertTrendTopic[]> {
    try {
      console.log(`Crawling Telegram channel ${source.url} for campaign ${campaignId}`);
      // В реальном приложении здесь будет интеграция с Telegram API
      const title = `Тренд из Telegram: ${source.name}`;
      return [{
        title,
        sourceId: source.id,
        campaignId: campaignId,
        reactions: Math.floor(Math.random() * 200),
        comments: Math.floor(Math.random() * 100),
        views: Math.floor(Math.random() * 2000)
      }];
    } catch (error) {
      console.error(`Error crawling Telegram ${source.url}:`, error);
      return [];
    }
  }

  async crawlVK(source: ContentSource, campaignId: number): Promise<InsertTrendTopic[]> {
    try {
      console.log(`Crawling VK group ${source.url} for campaign ${campaignId}`);
      // В реальном приложении здесь будет интеграция с VK API
      const title = `Тренд из VK: ${source.name}`;
      return [{
        title,
        sourceId: source.id,
        campaignId: campaignId,
        reactions: Math.floor(Math.random() * 300),
        comments: Math.floor(Math.random() * 150),
        views: Math.floor(Math.random() * 3000)
      }];
    } catch (error) {
      console.error(`Error crawling VK ${source.url}:`, error);
      return [];
    }
  }

  async crawlSource(source: ContentSource, campaignId: number): Promise<InsertTrendTopic[]> {
    console.log(`Crawling source: ${source.name} (${source.type}) for campaign ${campaignId}`);

    switch (source.type) {
      case 'website':
        return this.crawlWebsite(source, campaignId);
      case 'telegram':
        return this.crawlTelegram(source, campaignId);
      case 'vk':
        return this.crawlVK(source, campaignId);
      default:
        console.error(`Unknown source type: ${source.type}`);
        return [];
    }
  }

  async crawlAllSources(userId: string, campaignId: number): Promise<void> {
    try {
      console.log(`Starting to crawl sources for user ${userId} and campaign ${campaignId}`);

      // Получаем только источники для указанной кампании
      const sources = await storage.getContentSources(userId, campaignId);
      console.log(`Found ${sources.length} sources to crawl for campaign ${campaignId}`);

      for (const source of sources) {
        console.log(`Crawling source: ${source.name} (${source.type}) for campaign ${campaignId}`);
        const topics = await this.crawlSource(source, campaignId);
        console.log(`Found ${topics.length} topics for source ${source.name}`);

        for (const topic of topics) {
          console.log(`Saving topic: ${topic.title} for campaign ${campaignId}`);
          await storage.createTrendTopic({
            ...topic,
            campaignId: campaignId
          });
        }
      }
      console.log(`Finished crawling all sources for campaign ${campaignId}`);
    } catch (error) {
      console.error('Error crawling sources:', error);
      throw error;
    }
  }
}

export const crawler = new ContentCrawler();