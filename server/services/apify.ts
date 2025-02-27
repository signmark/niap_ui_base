import axios from 'axios';

interface ApifyRunResponse {
  id: string;
  actId: string;
  status: string;
}

interface ApifyRunResult {
  items: any[];
}

export class ApifyService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.apify.com/v2';

  constructor() {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      throw new Error('APIFY_API_KEY environment variable is not set');
    }
    this.apiKey = apiKey;
    console.log('Apify service initialized with API key');
  }

  async runInstagramScraper(username: string): Promise<string> {
    try {
      console.log(`Starting Instagram scraper for username: ${username}`);

      // Simplified request body matching screenshot example
      const requestData = {
        username: [username],
        resultsLimit: 10
      };

      console.log('Apify API Request:', {
        url: `${this.baseUrl}/acts/zuzka~instagram-post-scraper/runs`,
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        data: requestData
      });

      const response = await axios.post(
        `${this.baseUrl}/acts/zuzka~instagram-post-scraper/runs`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Apify API Response:', response.data);

      const runData = response.data as ApifyRunResponse;
      console.log('Run created with ID:', runData.id);
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
    try {
      console.log(`Checking status for run ${runId}`);
      const response = await axios.get(
        `${this.baseUrl}/actor-runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
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
    try {
      console.log(`Fetching results for run ${runId}`);
      const response = await axios.get(
        `${this.baseUrl}/actor-runs/${runId}/dataset/items`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
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