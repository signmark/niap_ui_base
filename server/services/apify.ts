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
      // Get API key from user settings
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
      } else {
        throw new Error('Apify API key not found in user settings');
      }
    } catch (error) {
      console.error('Error getting Apify API key:', error);
      throw error;
    }
  }

  async runActor(actorId: string, input: any): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Apify API key not initialized');
    }

    try {
      console.log(`Running Apify actor ${actorId} with input:`, input);
      const response = await axios.post(
        `${this.baseUrl}/acts/${actorId}/runs`,
        {
          ...input,
          webhooks: [{
            event: "ACTOR.RUN.SUCCEEDED",
            requestUrl: `${process.env.REPLIT_URL}/api/apify/webhook`
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          }
        }
      );

      const runData = response.data as ApifyRunResponse;
      console.log('Apify run created:', runData);
      return runData.id;
    } catch (error) {
      console.error('Error running Apify actor:', error);
      throw error;
    }
  }

  async getRunStatus(runId: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Apify API key not initialized');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/actor-runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          }
        }
      );

      return response.data.status;
    } catch (error) {
      console.error('Error getting run status:', error);
      throw error;
    }
  }

  async getRunResults(runId: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Apify API key not initialized');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/actor-runs/${runId}/dataset/items`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          }
        }
      );

      const results = response.data as ApifyRunResult;
      return results.items;
    } catch (error) {
      console.error('Error getting run results:', error);
      throw error;
    }
  }

  async waitForRunToFinish(runId: string, checkInterval = 5000): Promise<void> {
    while (true) {
      const status = await this.getRunStatus(runId);
      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
}

export const apifyService = new ApifyService();