import axios from 'axios';
import { storage } from '../storage';
import type { ContentSource, InsertTrendTopic } from '@shared/schema';
import { directusApi } from '../lib/directus';
import crypto from 'crypto';
import { apifyService } from './apify';

export class ContentCrawler {
  private async initializeApify(userId: string) {
    try {
      const response = await directusApi.get('/items/user_api_keys', {
        params: {
          filter: {
            user_id: { _eq: userId },
            service_name: { _eq: 'apify' }
          },
          fields: ['api_key']
        }
      });

      if (!response.data?.data?.[0]?.api_key) {
        throw new Error('Apify API key not found');
      }

      await apifyService.initialize(userId);
    } catch (error) {
      console.error('Error initializing Apify:', error);
      throw error;
    }
  }

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

  async crawlInstagram(source: ContentSource, campaignId: number, userId: string): Promise<InsertTrendTopic[]> {
    try {
      console.log(`Crawling Instagram ${source.url} for campaign ${campaignId}`);

      await this.initializeApify(userId);

      // Extract username from URL
      const username = source.url.split('/').filter(Boolean).pop() || '';

      // Run Instagram scraper actor
      const runId = await apifyService.runActor('zuzka/instagram-post-scraper', {
        username: [username],
        resultsLimit: 10,
      });

      console.log(`Started Instagram scraping task ${runId} for ${username}`);

      // Wait for the scraping to finish
      await apifyService.waitForRunToFinish(runId);

      // Get results
      const posts = await apifyService.getRunResults(runId);
      console.log(`Retrieved ${posts.length} posts from Instagram`);

      return posts.map(post => ({
        directusId: crypto.randomUUID(),
        title: post.caption?.substring(0, 200) || `Пост из ${source.name}`,
        sourceId: source.id,
        campaignId: campaignId,
        reactions: post.likesCount || 0,
        comments: post.commentsCount || 0,
        views: post.viewsCount || 0
      }));

    } catch (error) {
      console.error(`Error crawling Instagram ${source.url}:`, error);
      return [];
    }
  }

  async crawlVK(source: ContentSource, campaignId: number, userId: string): Promise<InsertTrendTopic[]> {
    try {
      console.log(`Crawling VK group ${source.url} for campaign ${campaignId}`);

      await this.initializeApify(userId);

      // Extract VK group ID or username from URL
      const urlParts = source.url.split('/');
      const groupIdentifier = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];

      // Run VK scraper actor
      const runId = await apifyService.runActor('apify/vk-posts-scraper', {
        startUrls: [{ url: source.url }],
        maxPosts: 10,
      });

      console.log(`Started VK scraping task ${runId} for ${groupIdentifier}`);

      // Wait for the scraping to finish
      await apifyService.waitForRunToFinish(runId);

      // Get results
      const posts = await apifyService.getRunResults(runId);
      console.log(`Retrieved ${posts.length} posts from VK`);

      return posts.map(post => ({
        directusId: crypto.randomUUID(),
        title: post.text?.substring(0, 200) || `Пост из ${source.name}`,
        sourceId: source.id,
        campaignId: campaignId,
        reactions: post.likes || 0,
        comments: post.comments || 0,
        views: post.views || 0,
      }));

    } catch (error) {
      console.error(`Error crawling VK ${source.url}:`, error);
      return [];
    }
  }

  async crawlSource(source: ContentSource, campaignId: number, userId: string): Promise<InsertTrendTopic[]> {
    console.log(`Crawling source: ${source.name} (${source.type}) for campaign ${campaignId}`);

    switch (source.type) {
      case 'website':
        return this.crawlWebsite(source, campaignId);
      case 'instagram':
        return this.crawlInstagram(source, campaignId, userId);
      case 'vk':
        return this.crawlVK(source, campaignId, userId);
      default:
        console.error(`Unknown source type: ${source.type}`);
        return [];
    }
  }

  async crawlAllSources(userId: string, campaignId: string): Promise<void> {
    try {
      console.log(`Starting to crawl sources for user ${userId} and campaign ${campaignId}`);

      // Get only sources for the specified campaign
      const sources = await storage.getContentSources(userId, Number(campaignId));
      console.log(`Found ${sources.length} sources to crawl for campaign ${campaignId}`);

      for (const source of sources) {
        console.log(`Processing source: ${source.name}`);

        // First, try to get trends for this source
        const topics = await this.crawlSource(source, Number(campaignId), userId);

        if (topics.length === 0) {
          console.log(`No trends found for source ${source.name}, skipping task creation`);
          continue;
        }

        try {
          // Save the topics
          for (const topic of topics) {
            console.log(`Saving topic: ${topic.title}`);
            await directusApi.post('/items/campaign_trend_topics', {
              data: {
                id: topic.directusId,
                title: topic.title,
                source_id: topic.sourceId,
                campaign_id: campaignId,
                reactions: topic.reactions,
                comments: topic.comments,
                views: topic.views,
                is_bookmarked: false
              }
            });
          }

        } catch (error) {
          console.error(`Error saving topics for source ${source.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Error details:', errorMessage);
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