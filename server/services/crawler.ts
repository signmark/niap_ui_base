import { storage } from '../storage';
import type { ContentSource, InsertTrendTopic } from '@shared/schema';
import { directusApi } from '../lib/directus';
import crypto from 'crypto';
import { apifyService } from './apify';

export class ContentCrawler {
  private async initializeApify(userId: string) {
    try {
      console.log('Initializing Apify service for user:', userId);
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
      console.log('Successfully initialized Apify service');
    } catch (error) {
      console.error('Error initializing Apify:', error);
      throw error;
    }
  }

  async crawlInstagram(source: ContentSource, campaignId: number, userId: string): Promise<InsertTrendTopic[]> {
    try {
      console.log(`Starting Instagram crawling process for source: ${source.name} (${source.url})`);
      console.log(`Campaign ID: ${campaignId}, User ID: ${userId}`);

      await this.initializeApify(userId);

      // Extract username from URL
      const username = source.url.split('/').filter(Boolean).pop() || '';
      if (!username) {
        throw new Error('Could not extract Instagram username from URL');
      }

      console.log(`Extracted Instagram username: ${username}`);

      // Run Instagram scraper actor
      const runId = await apifyService.runInstagramScraper(username);
      console.log(`Started Instagram scraping task ${runId} for ${username}`);

      // Wait for the scraping to finish
      await apifyService.waitForRunToFinish(runId);
      console.log(`Scraping task ${runId} completed`);

      // Get results
      const posts = await apifyService.getRunResults(runId);
      console.log(`Retrieved ${posts.length} posts from Instagram for ${username}`);

      const topics = posts.map(post => ({
        directusId: crypto.randomUUID(),
        title: post.caption?.substring(0, 200) || `Пост из ${source.name}`,
        sourceId: source.id,
        campaignId: campaignId,
        reactions: post.likesCount || 0,
        comments: post.commentsCount || 0,
        views: post.viewsCount || 0
      }));

      console.log(`Transformed ${topics.length} posts into trend topics`);
      return topics;

    } catch (error) {
      console.error(`Error crawling Instagram ${source.url}:`, error);
      throw error;
    }
  }

  async crawlSource(source: ContentSource, campaignId: number, userId: string): Promise<InsertTrendTopic[]> {
    console.log(`Crawling source: ${source.name} (${source.type}) for campaign ${campaignId}`);

    if (source.type !== 'instagram') {
      throw new Error('Currently only Instagram sources are supported');
    }

    return this.crawlInstagram(source, campaignId, userId);
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