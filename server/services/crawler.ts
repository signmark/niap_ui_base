import axios from 'axios';
import { storage } from '../storage';
import type { ContentSource, InsertTrendTopic } from '@shared/schema';

export class ContentCrawler {
  async crawlWebsite(source: ContentSource, campaignId?: number): Promise<InsertTrendTopic[]> {
    try {
      const response = await axios.get(source.url);
      // В реальном приложении здесь будет более сложная логика парсинга
      // Сейчас просто заглушка для демонстрации
      return [{
        title: "Демо тема с сайта",
        sourceId: source.id,
        campaignId,
        reactions: 0,
        comments: 0,
        views: 0
      }];
    } catch (error) {
      console.error(`Error crawling website ${source.url}:`, error);
      return [];
    }
  }

  async crawlTelegram(source: ContentSource, campaignId?: number): Promise<InsertTrendTopic[]> {
    // Здесь будет реальная логика получения данных из Telegram
    // Сейчас просто заглушка
    return [{
      title: "Демо тема из Telegram",
      sourceId: source.id,
      campaignId,
      reactions: 0,
      comments: 0,
      views: 0
    }];
  }

  async crawlVK(source: ContentSource, campaignId?: number): Promise<InsertTrendTopic[]> {
    // Здесь будет реальная логика получения данных из VK
    // Сейчас просто заглушка
    return [{
      title: "Демо тема из VK",
      sourceId: source.id,
      campaignId,
      reactions: 0,
      comments: 0,
      views: 0
    }];
  }

  async crawlSource(source: ContentSource, campaignId?: number): Promise<InsertTrendTopic[]> {
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

  async crawlAllSources(userId: string, campaignId?: number): Promise<void> {
    try {
      console.log(`Starting to crawl sources for user ${userId}`);
      const sources = await storage.getContentSources(userId);
      console.log(`Found ${sources.length} sources to crawl`);

      for (const source of sources) {
        console.log(`Crawling source: ${source.name} (${source.type})`);
        const topics = await this.crawlSource(source, campaignId);
        console.log(`Found ${topics.length} topics for source ${source.name}`);

        for (const topic of topics) {
          console.log(`Saving topic: ${topic.title}`);
          await storage.createTrendTopic(topic);
        }
      }
      console.log('Finished crawling all sources');
    } catch (error) {
      console.error('Error crawling sources:', error);
      throw error;
    }
  }
}

export const crawler = new ContentCrawler();