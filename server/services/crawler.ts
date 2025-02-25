import axios from 'axios';
import { storage } from '../storage';
import type { ContentSource, InsertTrendTopic } from '@shared/schema';

export class ContentCrawler {
  async crawlWebsite(source: ContentSource): Promise<InsertTrendTopic[]> {
    try {
      const response = await axios.get(source.url);
      // В реальном приложении здесь будет более сложная логика парсинга
      // Сейчас просто заглушка для демонстрации
      return [{
        title: "Демо тема с сайта",
        sourceId: source.id,
        reactions: 0,
        comments: 0,
        views: 0,
        createdAt: new Date(),
        isBookmarked: false
      }];
    } catch (error) {
      console.error(`Error crawling website ${source.url}:`, error);
      return [];
    }
  }

  async crawlTelegram(source: ContentSource): Promise<InsertTrendTopic[]> {
    // Здесь будет реальная логика получения данных из Telegram
    // Сейчас просто заглушка
    return [{
      title: "Демо тема из Telegram",
      sourceId: source.id,
      reactions: 0,
      comments: 0,
      views: 0,
      createdAt: new Date(),
      isBookmarked: false
    }];
  }

  async crawlVK(source: ContentSource): Promise<InsertTrendTopic[]> {
    // Здесь будет реальная логика получения данных из VK
    // Сейчас просто заглушка
    return [{
      title: "Демо тема из VK",
      sourceId: source.id,
      reactions: 0,
      comments: 0,
      views: 0,
      createdAt: new Date(),
      isBookmarked: false
    }];
  }

  async crawlSource(source: ContentSource): Promise<InsertTrendTopic[]> {
    switch (source.type) {
      case 'website':
        return this.crawlWebsite(source);
      case 'telegram':
        return this.crawlTelegram(source);
      case 'vk':
        return this.crawlVK(source);
      default:
        console.error(`Unknown source type: ${source.type}`);
        return [];
    }
  }

  async crawlAllSources(userId: string): Promise<void> {
    try {
      const sources = await storage.getContentSources(userId);

      for (const source of sources) {
        const topics = await this.crawlSource(source);

        for (const topic of topics) {
          await storage.createTrendTopic(topic);
        }
      }
    } catch (error) {
      console.error('Error crawling sources:', error);
    }
  }
}

export const crawler = new ContentCrawler();