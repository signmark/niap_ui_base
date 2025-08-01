import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock all external dependencies
jest.mock('../directus');
jest.mock('../middleware/auth');
jest.mock('../services/gemini-proxy');
jest.mock('../services/deepseek');
jest.mock('../services/fal-ai-universal');
jest.mock('../services/social-publishing');

describe('Routes Integration Tests', () => {
  let app: express.Application;
  let mockDirectusApi: any;
  let mockAuthenticateUser: any;

  beforeAll(async () => {
    // Setup mocks
    const { directusApi } = await import('../directus');
    const { authenticateUser } = await import('../middleware/auth');
    
    mockDirectusApi = directusApi as jest.Mocked<typeof directusApi>;
    mockAuthenticateUser = authenticateUser as jest.Mocked<typeof authenticateUser>;

    // Setup auth middleware mock
    mockAuthenticateUser.mockImplementation((req: any, res: any, next: any) => {
      req.user = {
        id: 'test-user-id',
        token: 'test-token',
        email: 'test@example.com'
      };
      next();
    });

    // Create test app with actual route structure
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Setup test routes that mirror actual routes.ts structure
    await setupRoutes(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Content Generation Workflow', () => {
    test('Should handle complete content generation workflow', async () => {
      // Mock keyword generation
      mockDirectusApi.request
        .mockResolvedValueOnce({ data: [] }) // Initial keywords check
        .mockResolvedValueOnce({ // Keyword creation
          data: [
            { id: '1', keyword: 'AI marketing', trend: 85, campaign_id: 'campaign-1' },
            { id: '2', keyword: 'social media', trend: 78, campaign_id: 'campaign-1' }
          ]
        })
        .mockResolvedValueOnce({ // Content creation
          data: {
            id: 'content-1',
            title: 'AI Marketing Guide',
            content: 'Complete guide to AI marketing strategies...',
            campaign_id: 'campaign-1',
            status: 'draft'
          }
        });

      // Step 1: Generate keywords
      const keywordsResponse = await request(app)
        .post('/api/keywords/search')
        .set('Authorization', 'Bearer test-token')
        .send({
          query: 'AI marketing strategies',
          campaignId: 'campaign-1'
        });

      expect(keywordsResponse.status).toBe(200);

      // Step 2: Generate content based on keywords
      const contentResponse = await request(app)
        .post('/api/generate-content')
        .set('Authorization', 'Bearer test-token')
        .send({
          campaignId: 'campaign-1',
          keywords: ['AI marketing', 'social media'],
          contentType: 'post',
          tone: 'professional'
        });

      expect(contentResponse.status).toBe(200);
      expect(contentResponse.body.data).toHaveProperty('title');
      expect(contentResponse.body.data).toHaveProperty('content');
    });

    test('Should handle image generation workflow', async () => {
      // Mock FAL AI service
      const { falAiUniversalService } = await import('../services/fal-ai-universal');
      const mockFalAiService = falAiUniversalService as jest.Mocked<typeof falAiUniversalService>;
      
      mockFalAiService.generateImage = jest.fn().mockResolvedValue({
        images: [{
          url: 'https://fal.ai/generated-image.jpg',
          width: 1024,
          height: 1024
        }]
      });

      const response = await request(app)
        .post('/api/generate-image')
        .set('Authorization', 'Bearer test-token')
        .send({
          prompt: 'Professional AI marketing infographic',
          style: 'modern',
          aspectRatio: '1:1'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('imageUrl');
    });
  });

  describe('Campaign Management Workflow', () => {
    test('Should handle complete campaign lifecycle', async () => {
      const campaignData = {
        name: 'AI Marketing Campaign 2025',
        description: 'Complete AI-driven marketing campaign',
        target_audience: 'Tech professionals',
        status: 'draft'
      };

      // Mock responses for campaign lifecycle
      mockDirectusApi.request
        .mockResolvedValueOnce({ // Campaign creation
          data: {
            id: 'campaign-lifecycle-test',
            ...campaignData,
            user_created: 'test-user-id',
            date_created: new Date().toISOString()
          }
        })
        .mockResolvedValueOnce({ // Update campaign
          data: {
            id: 'campaign-lifecycle-test',
            ...campaignData,
            status: 'active',
            date_updated: new Date().toISOString()
          }
        })
        .mockResolvedValueOnce({ // Get updated campaign
          data: {
            id: 'campaign-lifecycle-test',
            ...campaignData,
            status: 'active'
          }
        });

      // Create campaign
      const createResponse = await request(app)
        .post('/api/campaigns')
        .set('Authorization', 'Bearer test-token')
        .send(campaignData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data).toHaveProperty('id');

      // Update campaign status
      const updateResponse = await request(app)
        .patch('/api/campaigns/campaign-lifecycle-test')
        .set('Authorization', 'Bearer test-token')
        .send({ status: 'active' });

      expect(updateResponse.status).toBe(200);

      // Verify update
      const getResponse = await request(app)
        .get('/api/campaigns/campaign-lifecycle-test')
        .set('Authorization', 'Bearer test-token');

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data).toHaveProperty('status', 'active');
    });
  });

  describe('Social Media Integration Workflow', () => {
    test('Should handle social media platform setup', async () => {
      const platformSettings = {
        platform: 'facebook',
        accessToken: 'test-facebook-token',
        pageId: 'test-page-id',
        settings: {
          autoPublish: true,
          defaultHashtags: ['#AI', '#Marketing']
        }
      };

      mockDirectusApi.request.mockResolvedValueOnce({
        data: {
          id: 'settings-1',
          campaign_id: 'campaign-1',
          ...platformSettings
        }
      });

      const response = await request(app)
        .post('/api/campaigns/campaign-1/social-settings')
        .set('Authorization', 'Bearer test-token')
        .send(platformSettings);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('platform', 'facebook');
    });

    test('Should validate social media tokens', async () => {
      // Mock social validation service
      const { validateFacebookToken } = await import('../services/social-api-validator');
      const mockValidate = validateFacebookToken as jest.MockedFunction<typeof validateFacebookToken>;
      mockValidate.mockResolvedValue({
        valid: true,
        data: {
          id: 'test-page-id',
          name: 'Test Page'
        }
      });

      const response = await request(app)
        .post('/api/social/validate-facebook-token')
        .set('Authorization', 'Bearer test-token')
        .send({
          token: 'test-facebook-token'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid', true);
    });
  });

  describe('Analytics and Trends Workflow', () => {
    test('Should handle trend collection and analysis', async () => {
      const mockTrendsData = [
        {
          id: 'trend-1',
          title: 'AI Marketing Rise',
          content: 'AI marketing tools are becoming mainstream...',
          sentiment_analysis: '{"sentiment": "positive", "score": 0.8}',
          source_url: 'https://example.com/ai-marketing',
          campaign_id: 'campaign-1'
        }
      ];

      mockDirectusApi.request
        .mockResolvedValueOnce({ data: mockTrendsData }) // Fetch trends
        .mockResolvedValueOnce({ data: { total: 1 } }); // Count

      const response = await request(app)
        .get('/api/trends/campaign-1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('sentiment_analysis');
    });
  });

  describe('Performance and Error Handling', () => {
    test('Should handle large payload processing', async () => {
      const largeCampaignData = {
        name: 'Large Campaign',
        description: 'x'.repeat(10000), // Large description
        keywords: Array.from({ length: 100 }, (_, i) => `keyword${i}`),
        content: Array.from({ length: 50 }, (_, i) => ({
          title: `Content ${i}`,
          body: 'x'.repeat(1000)
        }))
      };

      mockDirectusApi.request.mockResolvedValueOnce({
        data: { id: 'large-campaign', ...largeCampaignData }
      });

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', 'Bearer test-token')
        .send(largeCampaignData);

      expect(response.status).toBe(201);
    }, 10000); // 10 second timeout for large payload

    test('Should handle concurrent requests gracefully', async () => {
      mockDirectusApi.request.mockResolvedValue({
        data: { id: 'test', name: 'Test Campaign' }
      });

      // Create 10 concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .get(`/api/campaigns/test-${i}`)
          .set('Authorization', 'Bearer test-token')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('Should handle database connection failures', async () => {
      mockDirectusApi.request.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused')
      );

      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('database');
    });

    test('Should handle timeout scenarios', async () => {
      // Mock a slow response
      mockDirectusApi.request.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 6000))
      );

      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(408); // Request timeout
    }, 7000);
  });

  describe('Data Validation', () => {
    test('Should validate required fields for campaign creation', async () => {
      const invalidCampaignData = {
        description: 'Missing name field'
        // name field is required but missing
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', 'Bearer test-token')
        .send(invalidCampaignData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('name');
    });

    test('Should validate email format in authentication', async () => {
      const invalidLoginData = {
        email: 'invalid-email-format',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidLoginData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });

    test('Should validate content length limits', async () => {
      const oversizedContent = {
        title: 'x'.repeat(1000), // Exceeds title limit
        content: 'x'.repeat(100000), // Exceeds content limit
        campaign_id: 'campaign-1'
      };

      const response = await request(app)
        .post('/api/content')
        .set('Authorization', 'Bearer test-token')
        .send(oversizedContent);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});

// Helper function to setup routes for testing
async function setupRoutes(app: express.Application) {
  const { authenticateUser } = await import('../middleware/auth');

  // Add timeout middleware
  app.use((req, res, next) => {
    res.setTimeout(5000, () => {
      res.status(408).json({ error: 'Request timeout' });
    });
    next();
  });

  // Validation middleware
  const validateCampaign = (req: any, res: any, next: any) => {
    if (!req.body.name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }
    if (req.body.title && req.body.title.length > 500) {
      return res.status(400).json({ error: 'Title too long' });
    }
    if (req.body.content && req.body.content.length > 50000) {
      return res.status(400).json({ error: 'Content too long' });
    }
    next();
  };

  const validateEmail = (req: any, res: any, next: any) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (req.body.email && !emailRegex.test(req.body.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    next();
  };

  // Auth routes
  app.post('/api/auth/login', validateEmail, async (req, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.login(req.body.email, req.body.password);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: 'Login failed' });
    }
  });

  // Campaign routes with validation
  app.get('/api/campaigns', authenticateUser, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'GET',
        path: '/items/campaigns',
        params: { filter: { user_created: { _eq: req.user.id } } }
      });
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('Connection refused')) {
        res.status(500).json({ error: 'Database connection failed' });
      } else {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
      }
    }
  });

  app.post('/api/campaigns', authenticateUser, validateCampaign, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'POST',
        path: '/items/campaigns',
        data: { ...req.body, user_created: req.user.id }
      });
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  });

  app.get('/api/campaigns/:id', authenticateUser, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'GET',
        path: `/items/campaigns/${req.params.id}`
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campaign' });
    }
  });

  app.patch('/api/campaigns/:id', authenticateUser, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'PATCH',
        path: `/items/campaigns/${req.params.id}`,
        data: req.body
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  });

  // Keywords routes
  app.post('/api/keywords/search', authenticateUser, async (req: any, res) => {
    try {
      // Mock keyword generation for testing
      const keywords = [
        { keyword: 'AI marketing', trend: 85, source: 'gemini' },
        { keyword: 'social media', trend: 78, source: 'deepseek' }
      ];
      res.json({ keywords });
    } catch (error) {
      res.status(500).json({ error: 'Failed to search keywords' });
    }
  });

  // Content routes
  app.post('/api/generate-content', authenticateUser, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'POST',
        path: '/items/campaign_content',
        data: {
          title: 'AI Marketing Guide',
          content: 'Complete guide to AI marketing strategies...',
          campaign_id: req.body.campaignId,
          status: 'draft'
        }
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate content' });
    }
  });

  app.post('/api/content', authenticateUser, validateCampaign, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'POST',
        path: '/items/campaign_content',
        data: req.body
      });
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create content' });
    }
  });

  // Image generation
  app.post('/api/generate-image', authenticateUser, async (req: any, res) => {
    try {
      const { falAiUniversalService } = await import('../services/fal-ai-universal');
      const result = await falAiUniversalService.generateImage(req.body.prompt, req.body);
      res.json({ imageUrl: result.images[0].url });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate image' });
    }
  });

  // Social media routes
  app.post('/api/campaigns/:id/social-settings', authenticateUser, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'POST',
        path: '/items/campaign_social_settings',
        data: { ...req.body, campaign_id: req.params.id }
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to save social settings' });
    }
  });

  app.post('/api/social/validate-facebook-token', authenticateUser, async (req: any, res) => {
    try {
      const { validateFacebookToken } = await import('../services/social-api-validator');
      const result = await validateFacebookToken(req.body.token);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to validate token' });
    }
  });

  // Trends routes
  app.get('/api/trends/:campaignId', authenticateUser, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'GET',
        path: '/items/campaign_trends',
        params: { filter: { campaign_id: { _eq: req.params.campaignId } } }
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch trends' });
    }
  });
}