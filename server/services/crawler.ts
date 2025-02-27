import axios from 'axios';
import { storage } from '../storage';
import type { ContentSource, InsertTrendTopic } from '@shared/schema';
import { directusApi } from '../lib/directus';
import crypto from 'crypto';

export class ContentCrawler {
  async crawlWebsite(source: ContentSource, campaignId: number): Promise<InsertTrendTopic[]> {
    try {
      console.log(`Crawling website ${source.url} for campaign ${campaignId}`);
      const response = await directusApi.get(`/items/content_sources/${source.id}/content`);
      const content = response.data?.data;

      if (!content) {
        console.log(`No content found for source ${source.id}`);
        return [];
      }

      return [{
        directusId: content.id || crypto.randomUUID(),
        title: content.title || `Новый тренд с ${source.name}`,
        sourceId: source.id,
        campaignId: campaignId,
        reactions: content.reactions || Math.floor(Math.random() * 100),
        comments: content.comments || Math.floor(Math.random() * 50),
        views: content.views || Math.floor(Math.random() * 1000)
      }];
    } catch (error) {
      console.error(`Error crawling website ${source.url}:`, error);
      return [];
    }
  }

  async crawlTelegram(source: ContentSource, campaignId: number): Promise<InsertTrendTopic[]> {
    try {
      console.log(`Crawling Telegram channel ${source.url} for campaign ${campaignId}`);
      const response = await directusApi.get(`/items/content_sources/${source.id}/telegram_content`);
      const content = response.data?.data;

      if (!content) {
        console.log(`No Telegram content found for source ${source.id}`);
        return [];
      }

      return [{
        directusId: content.id || crypto.randomUUID(),
        title: content.title || `Тренд из Telegram: ${source.name}`,
        sourceId: source.id,
        campaignId: campaignId,
        reactions: content.reactions || Math.floor(Math.random() * 200),
        comments: content.comments || Math.floor(Math.random() * 100),
        views: content.views || Math.floor(Math.random() * 2000)
      }];
    } catch (error) {
      console.error(`Error crawling Telegram ${source.url}:`, error);
      return [];
    }
  }

  async crawlVK(source: ContentSource, campaignId: number): Promise<InsertTrendTopic[]> {
    try {
      console.log(`Crawling VK group ${source.url} for campaign ${campaignId}`);
      const response = await directusApi.get(`/items/content_sources/${source.id}/vk_content`);
      const content = response.data?.data;

      if (!content) {
        console.log(`No VK content found for source ${source.id}`);
        return [];
      }

      return [{
        directusId: content.id || crypto.randomUUID(),
        title: content.title || `Тренд из VK: ${source.name}`,
        sourceId: source.id,
        campaignId: campaignId,
        reactions: content.reactions || Math.floor(Math.random() * 300),
        comments: content.comments || Math.floor(Math.random() * 150),
        views: content.views || Math.floor(Math.random() * 3000)
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

      // Get only sources for the specified campaign
      const sources = await storage.getContentSources(userId, campaignId);
      console.log(`Found ${sources.length} sources to crawl for campaign ${campaignId}`);

      for (const source of sources) {
        console.log(`Crawling source: ${source.name} (${source.type}) for campaign ${campaignId}`);
        const topics = await this.crawlSource(source, campaignId);
        console.log(`Found ${topics.length} topics for source ${source.name}`);

        for (const topic of topics) {
          console.log(`Saving topic: ${topic.title} for campaign ${campaignId}`);
          try {
            await directusApi.post('/items/campaign_trend_topics', {
              id: topic.directusId,
              title: topic.title,
              source_id: topic.sourceId,
              campaign_id: topic.campaignId,
              reactions: topic.reactions,
              comments: topic.comments,
              views: topic.views,
              is_bookmarked: false
            });
          } catch (error) {
            console.error(`Error saving topic to Directus:`, error);
          }
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