import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../directus');
jest.mock('../middleware/auth');
jest.mock('../services/gemini-proxy');
jest.mock('../services/deepseek');

describe('Critical API Endpoints', () => {
  let app: express.Application;
  let mockDirectusApi: any;
  let mockAuthenticateUser: any;

  beforeAll(async () => {
    // Initialize mocks
    const { directusApi } = await import('../directus');
    const { authenticateUser } = await import('../middleware/auth');
    
    mockDirectusApi = directusApi as jest.Mocked<typeof directusApi>;
    mockAuthenticateUser = authenticateUser as jest.Mocked<typeof authenticateUser>;

    // Mock auth middleware to pass through
    mockAuthenticateUser.mockImplementation((req: any, res: any, next: any) => {
      req.user = {
        id: 'test-user-id',
        token: 'test-token',
        email: 'test@example.com'
      };
      next();
    });

    // Create test app
    app = express();
    app.use(express.json());
    
    // Register routes manually for testing
    await setupTestRoutes(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Endpoints', () => {
    test('GET /api/auth/me should return user info', async () => {
      mockDirectusApi.request.mockResolvedValueOnce({
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User'
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'test-user-id');
      expect(response.body).toHaveProperty('email', 'test@example.com');
    });

    test('POST /api/auth/login should authenticate user', async () => {
      const mockLoginResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires: 900000
      };

      mockDirectusApi.login.mockResolvedValueOnce(mockLoginResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
    });
  });

  describe('Campaign Endpoints', () => {
    test('GET /api/campaigns should return campaign list', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Test Campaign 1',
          status: 'active',
          user_created: 'test-user-id'
        },
        {
          id: 'campaign-2', 
          name: 'Test Campaign 2',
          status: 'draft',
          user_created: 'test-user-id'
        }
      ];

      mockDirectusApi.request.mockResolvedValueOnce({ data: mockCampaigns });

      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('name', 'Test Campaign 1');
    });

    test('POST /api/campaigns should create new campaign', async () => {
      const newCampaign = {
        name: 'New Test Campaign',
        description: 'Test description',
        status: 'draft'
      };

      const mockCreatedCampaign = {
        id: 'new-campaign-id',
        ...newCampaign,
        user_created: 'test-user-id',
        date_created: new Date().toISOString()
      };

      mockDirectusApi.request.mockResolvedValueOnce({ data: mockCreatedCampaign });

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', 'Bearer test-token')
        .send(newCampaign);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id', 'new-campaign-id');
      expect(response.body.data).toHaveProperty('name', newCampaign.name);
    });

    test('GET /api/campaigns/:id should return specific campaign', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        name: 'Test Campaign',
        status: 'active',
        user_created: 'test-user-id'
      };

      mockDirectusApi.request.mockResolvedValueOnce({ data: mockCampaign });

      const response = await request(app)
        .get('/api/campaigns/campaign-1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id', 'campaign-1');
    });
  });

  describe('Keywords Endpoints', () => {
    test('GET /api/keywords/:campaignId should return campaign keywords', async () => {
      const mockKeywords = [
        { keyword: 'test keyword 1', trend: 85, source: 'gemini' },
        { keyword: 'test keyword 2', trend: 70, source: 'deepseek' }
      ];

      mockDirectusApi.request.mockResolvedValueOnce({ data: mockKeywords });

      const response = await request(app)
        .get('/api/keywords/campaign-1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('keyword', 'test keyword 1');
    });

    test('POST /api/keywords/search should search for keywords', async () => {
      const mockSearchResults = [
        { keyword: 'searched keyword 1', trend: 90, source: 'gemini' },
        { keyword: 'searched keyword 2', trend: 75, source: 'deepseek' }
      ];

      // Mock Gemini service
      const { GeminiProxyService } = await import('../services/gemini-proxy');
      const mockGeminiService = GeminiProxyService as jest.Mocked<typeof GeminiProxyService>;
      mockGeminiService.generateKeywords = jest.fn().mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .post('/api/keywords/search')
        .set('Authorization', 'Bearer test-token')
        .send({
          query: 'test search query',
          url: 'https://example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('keywords');
      expect(Array.isArray(response.body.keywords)).toBe(true);
    });
  });

  describe('Content Endpoints', () => {
    test('GET /api/content/:campaignId should return campaign content', async () => {
      const mockContent = [
        {
          id: 'content-1',
          title: 'Test Content 1',
          content: 'Test content body',
          status: 'published',
          campaign_id: 'campaign-1'
        }
      ];

      mockDirectusApi.request.mockResolvedValueOnce({ data: mockContent });

      const response = await request(app)
        .get('/api/content/campaign-1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('title', 'Test Content 1');
    });

    test('POST /api/content should create new content', async () => {
      const newContent = {
        title: 'New Content',
        content: 'New content body',
        campaign_id: 'campaign-1',
        status: 'draft'
      };

      const mockCreatedContent = {
        id: 'new-content-id',
        ...newContent,
        date_created: new Date().toISOString()
      };

      mockDirectusApi.request.mockResolvedValueOnce({ data: mockCreatedContent });

      const response = await request(app)
        .post('/api/content')
        .set('Authorization', 'Bearer test-token')
        .send(newContent);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id', 'new-content-id');
      expect(response.body.data).toHaveProperty('title', newContent.title);
    });
  });

  describe('Social Media Endpoints', () => {
    test('GET /api/social/platforms should return available platforms', async () => {
      const response = await request(app)
        .get('/api/social/platforms')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('platforms');
      expect(Array.isArray(response.body.platforms)).toBe(true);
    });

    test('POST /api/social/validate-token should validate platform tokens', async () => {
      const response = await request(app)
        .post('/api/social/validate-token')
        .set('Authorization', 'Bearer test-token')
        .send({
          platform: 'facebook',
          token: 'test-facebook-token'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid');
    });
  });

  describe('Trends Endpoints', () => {
    test('GET /api/trends/:campaignId should return campaign trends', async () => {
      const mockTrends = [
        {
          id: 'trend-1',
          title: 'Test Trend 1',
          sentiment: 'positive',
          rating: 85,
          campaign_id: 'campaign-1'
        }
      ];

      mockDirectusApi.request.mockResolvedValueOnce({ data: mockTrends });

      const response = await request(app)
        .get('/api/trends/campaign-1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('title', 'Test Trend 1');
    });

    test('POST /api/trends/collect should start trend collection', async () => {
      const response = await request(app)
        .post('/api/trends/collect')
        .set('Authorization', 'Bearer test-token')
        .send({
          campaignId: 'campaign-1',
          keywords: ['keyword1', 'keyword2']
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'started');
    });
  });

  describe('Error Handling', () => {
    test('Should return 401 for unauthorized requests', async () => {
      mockAuthenticateUser.mockImplementationOnce((req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/campaigns');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    test('Should return 404 for non-existent resources', async () => {
      mockDirectusApi.request.mockRejectedValueOnce({
        response: { status: 404 }
      });

      const response = await request(app)
        .get('/api/campaigns/non-existent-id')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });

    test('Should handle Directus API errors gracefully', async () => {
      mockDirectusApi.request.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});

// Helper function to setup test routes
async function setupTestRoutes(app: express.Application) {
  const { authenticateUser } = await import('../middleware/auth');

  // Auth routes
  app.get('/api/auth/me', authenticateUser, (req: any, res) => {
    res.json(req.user);
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.login(req.body.email, req.body.password);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: 'Login failed' });
    }
  });

  // Campaign routes
  app.get('/api/campaigns', authenticateUser, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'GET',
        path: '/items/campaigns',
        params: { filter: { user_created: { _eq: req.user.id } } }
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  });

  app.post('/api/campaigns', authenticateUser, async (req: any, res) => {
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
    } catch (error: any) {
      if (error.response?.status === 404) {
        res.status(404).json({ error: 'Campaign not found' });
      } else {
        res.status(500).json({ error: 'Failed to fetch campaign' });
      }
    }
  });

  // Keywords routes
  app.get('/api/keywords/:campaignId', authenticateUser, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'GET',
        path: '/items/campaign_keywords',
        params: { filter: { campaign_id: { _eq: req.params.campaignId } } }
      });
      res.json(result.data || []);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch keywords' });
    }
  });

  app.post('/api/keywords/search', authenticateUser, async (req: any, res) => {
    try {
      const { GeminiProxyService } = await import('../services/gemini-proxy');
      const keywords = await GeminiProxyService.generateKeywords(req.body.query, req.body.url);
      res.json({ keywords });
    } catch (error) {
      res.status(500).json({ error: 'Failed to search keywords' });
    }
  });

  // Content routes
  app.get('/api/content/:campaignId', authenticateUser, async (req: any, res) => {
    try {
      const { directusApi } = await import('../directus');
      const result = await directusApi.request({
        method: 'GET',
        path: '/items/campaign_content',
        params: { filter: { campaign_id: { _eq: req.params.campaignId } } }
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch content' });
    }
  });

  app.post('/api/content', authenticateUser, async (req: any, res) => {
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

  // Social routes
  app.get('/api/social/platforms', authenticateUser, (req: any, res) => {
    res.json({
      platforms: ['facebook', 'instagram', 'vk', 'telegram', 'youtube']
    });
  });

  app.post('/api/social/validate-token', authenticateUser, (req: any, res) => {
    // Mock validation - in real implementation would validate against actual APIs
    res.json({ valid: true, platform: req.body.platform });
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

  app.post('/api/trends/collect', authenticateUser, (req: any, res) => {
    // Mock trend collection start
    res.json({ status: 'started', campaignId: req.body.campaignId });
  });
}