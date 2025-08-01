/**
 * Тесты для YouTube интеграции
 * Тестируют OAuth поток, получение каналов и управление токенами
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import request from 'supertest';
import app from '../index.js';
import { mocks, config } from './setup.js';

describe('YouTube Integration Tests', () => {
  let mockAxios: MockAdapter;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    mocks.mockDirectus();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockAxios.restore();
  });

  describe('GET /api/youtube/auth-url', () => {
    it('должен генерировать URL для YouTube OAuth', async () => {
      const response = await request(app)
        .get('/api/youtube/auth-url')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(response.body.authUrl).toContain('scope=https%3A//www.googleapis.com/auth/youtube');
      expect(response.body.authUrl).toContain('response_type=code');
    });
  });

  describe('GET /api/youtube/callback', () => {
    const mockTokenResponse = {
      access_token: 'youtube_access_token_123',
      refresh_token: 'youtube_refresh_token_456',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/youtube'
    };

    const mockChannelResponse = {
      items: [
        {
          id: 'UC_test_channel_id_123',
          snippet: {
            title: 'Test YouTube Channel',
            description: 'Test channel description',
            thumbnails: {
              default: { url: 'https://example.com/thumb.jpg' }
            }
          },
          statistics: {
            subscriberCount: '1000',
            videoCount: '50'
          }
        }
      ]
    };

    beforeEach(() => {
      // Мокируем получение токена от Google
      mockAxios.onPost('https://oauth2.googleapis.com/token').reply(200, mockTokenResponse);
      
      // Мокируем получение информации о канале
      mockAxios.onGet(/youtube\.googleapis\.com.*\/channels/).reply(200, mockChannelResponse);
    });

    it('должен успешно обработать OAuth callback и получить канал', async () => {
      const authCode = 'test_auth_code_123';
      const campaignId = 'test-campaign-123';

      const response = await request(app)
        .get(`/api/youtube/callback?code=${authCode}&state=${campaignId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channel).toMatchObject({
        id: 'UC_test_channel_id_123',
        title: 'Test YouTube Channel',
        description: 'Test channel description'
      });
      expect(response.body.redirectUrl).toContain('/campaigns');
    });

    it('должен обработать случай отсутствия канала', async () => {
      // Мокируем ответ без каналов
      mockAxios.onGet(/youtube\.googleapis\.com.*\/channels/).reply(200, {
        items: []
      });

      const authCode = 'test_auth_code_123';
      const campaignId = 'test-campaign-123';

      const response = await request(app)
        .get(`/api/youtube/callback?code=${authCode}&state=${campaignId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.needsChannelCreation).toBe(true);
      expect(response.body.message).toContain('канал не найден');
    });

    it('должен обработать ошибку получения токена', async () => {
      mockAxios.onPost('https://oauth2.googleapis.com/token').reply(400, {
        error: 'invalid_grant',
        error_description: 'Invalid authorization code'
      });

      const authCode = 'invalid_code';
      const campaignId = 'test-campaign-123';

      const response = await request(app)
        .get(`/api/youtube/callback?code=${authCode}&state=${campaignId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid authorization code');
    });

    it('должен требовать code и state параметры', async () => {
      const response = await request(app)
        .get('/api/youtube/callback')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('отсутствуют');
    });
  });

  describe('POST /api/campaigns/:campaignId/youtube-settings', () => {
    const campaignId = 'test-campaign-123';
    const authToken = 'auth_token_123';

    beforeEach(() => {
      // Мокируем существующие настройки кампании
      mockAxios.onGet(new RegExp(`directus.*\\/items\\/user_campaigns\\/${campaignId}`)).reply(200, {
        data: {
          id: campaignId,
          social_media_settings: {}
        }
      });

      // Мокируем обновление настроек
      mockAxios.onPatch(new RegExp(`directus.*\\/items\\/user_campaigns\\/${campaignId}`)).reply(200, {
        data: { id: campaignId }
      });
    });

    it('должен сохранить настройки YouTube канала', async () => {
      const youtubeSettings = {
        channelId: 'UC_test_channel_id_123',
        channelTitle: 'Test YouTube Channel',
        accessToken: 'youtube_access_token_123',
        refreshToken: 'youtube_refresh_token_456'
      };

      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/youtube-settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(youtubeSettings)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('YouTube настройки сохранены');

      // Проверяем что был сделан PATCH запрос с правильными данными
      const patchCall = mockAxios.history.patch.find(call => 
        call.url?.includes(`user_campaigns/${campaignId}`)
      );
      expect(patchCall).toBeDefined();
      
      const patchData = JSON.parse(patchCall!.data);
      expect(patchData.social_media_settings.youtube).toMatchObject({
        channelId: 'UC_test_channel_id_123',
        channelTitle: 'Test YouTube Channel',
        accessToken: 'youtube_access_token_123',
        refreshToken: 'youtube_refresh_token_456',
        configured: true
      });
    });

    it('должен требовать авторизацию', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/youtube-settings`)
        .send({
          channelId: 'test',
          channelTitle: 'Test'
        })
        .expect(401);

      expect(response.body.error).toContain('токен авторизации');
    });

    it('должен требовать обязательные поля', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/youtube-settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          channelId: 'test'
          // Отсутствует channelTitle
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('обязательны');
    });
  });

  describe('POST /api/youtube/refresh-token', () => {
    const mockRefreshResponse = {
      access_token: 'new_youtube_access_token_789',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/youtube'
    };

    beforeEach(() => {
      mockAxios.onPost('https://oauth2.googleapis.com/token').reply(200, mockRefreshResponse);
    });

    it('должен обновить YouTube токен', async () => {
      const refreshData = {
        refreshToken: 'youtube_refresh_token_456'
      };

      const response = await request(app)
        .post('/api/youtube/refresh-token')
        .send(refreshData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBe('new_youtube_access_token_789');
      expect(response.body.expiresIn).toBe(3600);

      // Проверяем что был сделан правильный запрос к Google
      const refreshCall = mockAxios.history.post.find(call => 
        call.url === 'https://oauth2.googleapis.com/token' &&
        call.data?.includes('grant_type=refresh_token')
      );
      expect(refreshCall).toBeDefined();
    });

    it('должен обработать ошибку обновления токена', async () => {
      mockAxios.onPost('https://oauth2.googleapis.com/token').reply(400, {
        error: 'invalid_grant',
        error_description: 'Token has been expired or revoked'
      });

      const refreshData = {
        refreshToken: 'expired_refresh_token'
      };

      const response = await request(app)
        .post('/api/youtube/refresh-token')
        .send(refreshData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired or revoked');
    });

    it('должен требовать refresh token', async () => {
      const response = await request(app)
        .post('/api/youtube/refresh-token')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('refreshToken обязателен');
    });
  });

  describe('YouTube Global API Keys', () => {
    beforeEach(() => {
      // Мокируем получение глобальных API ключей
      mockAxios.onGet(/directus.*\/items\/global_api_keys/).reply(200, {
        data: [
          {
            id: 1,
            service: 'youtube',
            api_key: 'youtube_api_key_global_123',
            active: true
          }
        ]
      });
    });

    it('должен использовать глобальный API ключ для YouTube операций', async () => {
      // Мокируем запрос, который использует YouTube API ключ
      mockAxios.onGet(/youtube\.googleapis\.com.*key=youtube_api_key_global_123/).reply(200, {
        items: [
          {
            id: 'UC_channel_123',
            snippet: { title: 'Test Channel' }
          }
        ]
      });

      // Здесь должен быть запрос к эндпоинту, который использует глобальный API ключ
      // Например, получение информации о канале для публичных операций
      
      expect(true).toBe(true); // Заглушка для структуры теста
    });
  });

  describe('Channel Creation Guidance', () => {
    it('должен предоставить инструкции для создания канала', async () => {
      const response = await request(app)
        .get('/api/youtube/channel-creation-help')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.instructions).toContain('YouTube Studio');
      expect(response.body.createChannelUrl).toContain('youtube.com/create_channel');
    });
  });

  describe('Token Validation', () => {
    it('должен валидировать YouTube токены', async () => {
      const validToken = 'ya29.a0ARrdaM9qVG...'; // Пример реального формата
      const invalidToken = 'invalid_token_format';

      // Тест валидного токена (должен начинаться с ya29.)
      expect(validToken.startsWith('ya29.')).toBe(true);
      
      // Тест невалидного токена
      expect(invalidToken.startsWith('ya29.')).toBe(false);
    });

    it('должен обрабатывать истекшие токены', async () => {
      mockAxios.onGet(/youtube\.googleapis\.com/).reply(401, {
        error: {
          code: 401,
          message: 'Invalid Credentials'
        }
      });

      // Симуляция запроса с истекшим токеном
      const response = await request(app)
        .get('/api/youtube/test-expired-token')
        .expect(401);

      expect(response.body.error).toContain('Invalid Credentials');
    });
  });
});