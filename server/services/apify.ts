import axios from 'axios';
import { directusApi } from '@/lib/directus';

interface ApifyRunResponse {
  id: string;
  actId: string;
  status: string;
}

interface ApifyRunResult {
  items: any[];
}

export class ApifyService {
  private apiKey: string | null = null;
  private readonly baseUrl = 'https://api.apify.com/v2';

  async initialize(userId: string) {
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

      if (response.data?.data?.[0]?.api_key) {
        this.apiKey = response.data.data[0].api_key;
        console.log('Successfully initialized Apify service with API key');
      } else {
        throw new Error('Apify API key not found in user settings');
      }
    } catch (error) {
      console.error('Error getting Apify API key:', error);
      throw error;
    }
  }

  async runInstagramScraper(username: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Apify API key not initialized');
    }

    try {
      const requestData = {
        username: [username],
        resultsLimit: 10
      };

      console.log('Starting Instagram scraper with request:', requestData);

      const response = await axios.post(
        `${this.baseUrl}/acts/zuzka~instagram-post-scraper/runs`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          }
        }
      );

      const runData = response.data as ApifyRunResponse;
      console.log('Apify Instagram scraper run created:', runData);
      return runData.id;
    } catch (error) {
      console.error('Error running Instagram scraper:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Apify API error response:', error.response.data);
      }
      throw error;
    }
  }

  async getRunStatus(runId: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Apify API key not initialized');
    }

    try {
      console.log(`Checking status for run ${runId}`);
      const response = await axios.get(
        `${this.baseUrl}/actor-runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          }
        }
      );

      console.log(`Run ${runId} status:`, response.data.status);
      return response.data.status;
    } catch (error) {
      console.error('Error getting run status:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Apify API error response:', error.response.data);
      }
      throw error;
    }
  }

  async getRunResults(runId: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Apify API key not initialized');
    }

    try {
      console.log(`Fetching results for run ${runId}`);
      const response = await axios.get(
        `${this.baseUrl}/actor-runs/${runId}/dataset/items`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          }
        }
      );

      const results = response.data as ApifyRunResult;
      console.log(`Retrieved ${results.items.length} items from run ${runId}`);
      return results.items;
    } catch (error) {
      console.error('Error getting run results:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Apify API error response:', error.response.data);
      }
      throw error;
    }
  }

  async waitForRunToFinish(runId: string, checkInterval = 5000): Promise<void> {
    console.log(`Waiting for run ${runId} to finish`);
    while (true) {
      const status = await this.getRunStatus(runId);
      console.log(`Current status for run ${runId}: ${status}`);

      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') {
        if (status !== 'SUCCEEDED') {
          throw new Error(`Run ${runId} failed with status: ${status}`);
        }
        console.log(`Run ${runId} completed successfully`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
}

export const apifyService = new ApifyService();