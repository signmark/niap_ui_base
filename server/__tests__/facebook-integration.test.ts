/**
 * Тесты для Facebook интеграции
 * Тестируют логику обработки данных, валидацию токенов и форматирование
 */

import axios from 'axios';
import { mocks, config } from './setup.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Facebook Integration Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get?.mockClear();
    mockedAxios.post?.mockClear();
    mockedAxios.patch?.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/facebook/pages', () => {
    const mockPages = [
      {
        id: '677089708819410',
        name: 'SMM Manager',
        access_token: 'page_token_123',
        category: 'Software',
        tasks: ['ANALYZE', 'ADVERTISE', 'MESSAGING', 'MODERATE']
      },
      {
        id: '234567890123456',
        name: 'Test Page',
        access_token: 'page_token_456',
        category: 'Business',
        tasks: ['ANALYZE', 'ADVERTISE']
      }
    ];

    it('должен успешно получить список Facebook страниц', async () => {
      const userToken = 'test_user_token';
      
      // Мокируем ответ Facebook API
      mockAxios.onGet(/graph\.facebook\.com.*\/me\/accounts/).reply(200, {
        data: mockPages
      });

      const response = await request(app)
        .get(`/api/facebook/pages?token=${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pages).toHaveLength(2);
      expect(response.body.pages[0]).toMatchObject({
        id: '677089708819410',
        name: 'SMM Manager',
        category: 'Software'
      });
      expect(response.body.pages[0].access_token).toBe('page_token_123');
    });

    it('должен обработать ошибку API Facebook', async () => {
      const userToken = 'invalid_token';
      
      // Мокируем ошибку Facebook API
      mockAxios.onGet(/graph\.facebook\.com.*\/me\/accounts/).reply(400, {
        error: {
          message: 'Invalid OAuth access token.',
          type: 'OAuthException'
        }
      });

      const response = await request(app)
        .get(`/api/facebook/pages?token=${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid OAuth access token');
    });

    it('должен требовать токен', async () => {
      const response = await request(app)
        .get('/api/facebook/pages')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('токен обязателен');
    });
  });

  describe('GET /api/facebook/page-token/:pageId', () => {
    const pageId = '677089708819410';
    const userToken = 'test_user_token';
    
    it('должен получить токен конкретной страницы', async () => {
      const mockPageToken = {
        id: pageId,
        name: 'SMM Manager',
        access_token: 'specific_page_token_123',
        category: 'Software'
      };

      // Мокируем запрос токена страницы
      mockAxios.onGet(new RegExp(`graph\\.facebook\\.com.*\\/${pageId}\\?.*access_token`)).reply(200, mockPageToken);

      const response = await request(app)
        .get(`/api/facebook/page-token/${pageId}?token=${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.page.id).toBe(pageId);
      expect(response.body.page.access_token).toBe('specific_page_token_123');
    });

    it('должен обработать ошибку при получении токена страницы', async () => {
      mockAxios.onGet(new RegExp(`graph\\.facebook\\.com.*\\/${pageId}`)).reply(404, {
        error: {
          message: 'Page not found',
          type: 'GraphMethodException'
        }
      });

      const response = await request(app)
        .get(`/api/facebook/page-token/${pageId}?token=${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Page not found');
    });
  });

  describe('POST /api/campaigns/:campaignId/facebook-settings', () => {
    const campaignId = 'test-campaign-123';
    const authToken = 'auth_token_123';

    beforeEach(() => {
      // Мокируем существующие настройки кампании
      mockAxios.onGet(new RegExp(`directus.*\\/items\\/user_campaigns\\/${campaignId}`)).reply(200, {
        data: {
          id: campaignId,
          social_media_settings: {
            instagram: {
              token: 'existing_instagram_token'
            }
          }
        }
      });

      // Мокируем обновление настроек
      mockAxios.onPatch(new RegExp(`directus.*\\/items\\/user_campaigns\\/${campaignId}`)).reply(200, {
        data: { id: campaignId }
      });
    });

    it('должен сохранить настройки Facebook с токеном страницы', async () => {
      const facebookSettings = {
        token: 'page_token_123',
        pageId: '677089708819410',
        pageName: 'SMM Manager',
        userToken: 'user_token_456'
      };

      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/facebook-settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(facebookSettings)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Facebook настройки сохранены успешно');

      // Проверяем что был сделан PATCH запрос с правильными данными
      const patchCall = mockAxios.history.patch.find(call => 
        call.url?.includes(`user_campaigns/${campaignId}`)
      );
      expect(patchCall).toBeDefined();
      
      const patchData = JSON.parse(patchCall!.data);
      expect(patchData.social_media_settings.facebook).toMatchObject({
        token: 'page_token_123',
        pageId: '677089708819410',
        pageName: 'SMM Manager',
        userToken: 'user_token_456',
        configured: true,
        tokenType: 'page'
      });
    });

    it('должен сохранить настройки с пользовательским токеном как основным', async () => {
      const facebookSettings = {
        token: 'user_token_only',
        pageId: '677089708819410',
        pageName: 'SMM Manager'
      };

      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/facebook-settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(facebookSettings)
        .expect(200);

      expect(response.body.success).toBe(true);

      const patchCall = mockAxios.history.patch.find(call => 
        call.url?.includes(`user_campaigns/${campaignId}`)
      );
      const patchData = JSON.parse(patchCall!.data);
      
      expect(patchData.social_media_settings.facebook).toMatchObject({
        token: 'user_token_only',
        userToken: 'user_token_only',
        tokenType: 'user'
      });
    });

    it('должен требовать авторизацию', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/facebook-settings`)
        .send({
          token: 'some_token',
          pageId: '123',
          pageName: 'Test'
        })
        .expect(401);

      expect(response.body.error).toContain('токен авторизации');
    });

    it('должен требовать обязательные поля', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/facebook-settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: 'some_token'
          // Отсутствуют pageId и pageName
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('обязательны');
    });
  });

  describe('Instagram Token Integration', () => {
    it('должен использовать Instagram токен как пользовательский токен для Facebook', async () => {
      const instagramToken = 'instagram_long_lived_token';
      const mockPages = [
        {
          id: '677089708819410',
          name: 'SMM Manager',
          access_token: 'page_token_from_instagram',
          category: 'Software'
        }
      ];

      // Мокируем получение страниц через Instagram токен
      mockAxios.onGet(/graph\.facebook\.com.*\/me\/accounts/).reply(200, {
        data: mockPages
      });

      const response = await request(app)
        .get(`/api/facebook/pages?token=${instagramToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pages).toHaveLength(1);
      expect(response.body.pages[0].name).toBe('SMM Manager');
      
      // Проверяем что запрос был сделан с Instagram токеном
      const facebookCall = mockAxios.history.get.find(call => 
        call.url?.includes('graph.facebook.com') && 
        call.url?.includes(instagramToken)
      );
      expect(facebookCall).toBeDefined();
    });
  });

  describe('Token Validation', () => {
    it('должен обнаруживать поврежденные токены', async () => {
      const corruptedToken = 'Facebook Wizard: some corrupted data';
      
      const response = await request(app)
        .get(`/api/facebook/pages?token=${encodeURIComponent(corruptedToken)}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('поврежден');
    });

    it('должен отклонять короткие токены', async () => {
      const shortToken = 'short';
      
      const response = await request(app)
        .get(`/api/facebook/pages?token=${shortToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('действительный токен');
    });
  });
});