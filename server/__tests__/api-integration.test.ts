/**
 * API интеграционные тесты для SMM Manager
 * Тесты проверяют реальное взаимодействие с API и обработку различных сценариев
 */

import supertest from 'supertest';
import { app } from '../app';
import { mockTelegramAPIResponse } from './test-utils';
import axios from 'axios';
import FormData from 'form-data';

jest.mock('axios');
jest.mock('form-data');

const request = supertest(app);

// Константы для тестов
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const TELEGRAM_TOKEN = '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = '-1002302366310';
const VK_TOKEN = 'vk1.a.0jlmORGkgmds1qIB5btPIIuT1FZ8C_bkGpCcowI9Ml214neQFgVMiYEnePWq48txdx3D7oTtKbEvgnEifytkkyjv1FvooFsI0y_YYPX8Cw__525Tnqt_H7C9hEEdmsqHXExr4Q3DK7CL0quCvnhrhN368Ter9yFLe6buYgpnamBXwUx4yZnRJPdBVfnPmObtZRrXw7NaZJboCqAK8sXLEA';
const VK_GROUP_ID = 'club228626989';

// Данные пользователя для тестов
const mockUserCredentials = {
  email: 'test@example.com',
  password: 'test123'
};

// Токен авторизации для тестов
let authToken: string;

// Конфигурация тестов
describe('SMM Manager API', () => {
  beforeAll(async () => {
    // Мокируем axios для внешних API
    const mockAxios = axios as jest.Mocked<typeof axios>;
    mockAxios.post.mockImplementation((url) => {
      if (url.includes('sendMessage')) {
        return Promise.resolve({ data: mockTelegramAPIResponse(12345) });
      }
      if (url.includes('sendMediaGroup')) {
        return Promise.resolve({ data: mockTelegramAPIResponse(12346) });
      }
      if (url.includes('photos.getWallUploadServer')) {
        return Promise.resolve({
          data: {
            response: {
              upload_url: 'https://pu.vk.com/c12345/upload.php'
            }
          }
        });
      }
      if (url.includes('photos.saveWallPhoto')) {
        return Promise.resolve({
          data: {
            response: [{
              id: 123456,
              owner_id: -228626989
            }]
          }
        });
      }
      if (url.includes('wall.post')) {
        return Promise.resolve({
          data: {
            response: {
              post_id: 12345
            }
          }
        });
      }
      // Мок для Directus
      if (url.includes('directus') && url.includes('auth/login')) {
        return Promise.resolve({
          data: {
            data: {
              access_token: 'mock-directus-token',
              refresh_token: 'mock-directus-refresh-token'
            }
          }
        });
      }
      return Promise.resolve({ data: { success: true } });
    });
    
    mockAxios.get.mockImplementation((url) => {
      if (url.includes('directus') && url.includes('campaign')) {
        return Promise.resolve({
          data: {
            data: {
              id: CAMPAIGN_ID,
              socialMediaSettings: {
                telegram: {
                  token: TELEGRAM_TOKEN,
                  chatId: TELEGRAM_CHAT_ID
                },
                vk: {
                  token: VK_TOKEN,
                  groupId: VK_GROUP_ID
                }
              }
            }
          }
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    // Настраиваем мок для FormData
    const mockFormData = FormData as jest.MockedClass<typeof FormData>;
    mockFormData.prototype.append = jest.fn();
    mockFormData.prototype.getHeaders = jest.fn(() => ({}));
    mockFormData.prototype.getBoundary = jest.fn(() => 'test-boundary');
    
    // Получаем токен авторизации для тестов
    const loginResponse = await request
      .post('/api/auth/login')
      .send(mockUserCredentials);
    
    if (loginResponse.body.success) {
      authToken = loginResponse.body.data.token;
    } else {
      console.warn('Не удалось авторизоваться для тестов. Используем моковый токен.');
      authToken = 'mock-auth-token';
    }
  });
  
  // Сбрасываем моки после всех тестов
  afterAll(() => {
    jest.resetAllMocks();
  });
  
  /**
   * Группа тестов для API аутентификации
   */
  describe('Аутентификация', () => {
    test('POST /api/auth/login должен успешно авторизовать пользователя', async () => {
      const response = await request
        .post('/api/auth/login')
        .send(mockUserCredentials);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
    });
    
    test('GET /api/auth/me должен возвращать данные авторизованного пользователя', async () => {
      const response = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email');
    });
    
    test('GET /api/auth/me должен возвращать ошибку для неавторизованного запроса', async () => {
      const response = await request
        .get('/api/auth/me');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  /**
   * Группа тестов для API кампаний
   */
  describe('Кампании', () => {
    test('GET /api/campaigns должен возвращать список кампаний', async () => {
      const response = await request
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    test('GET /api/campaigns/:id должен возвращать детали кампании', async () => {
      const response = await request
        .get(`/api/campaigns/${CAMPAIGN_ID}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', CAMPAIGN_ID);
    });
    
    test('GET /api/campaigns/:id/settings должен возвращать настройки кампании', async () => {
      const response = await request
        .get(`/api/campaigns/${CAMPAIGN_ID}/settings`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('socialMediaSettings');
    });
  });
  
  /**
   * Группа тестов для API публикации контента
   */
  describe('Публикация контента', () => {
    // Тестовый контент для публикации
    const testContent = {
      title: 'Тестовый пост для API',
      content: 'Это текст тестового поста с <b>форматированием</b>',
      contentType: 'text',
      campaignId: CAMPAIGN_ID,
      socialPlatforms: ['telegram', 'vk'],
      imageUrl: 'https://example.com/test-image.jpg'
    };
    
    // ID созданного контента для использования в других тестах
    let createdContentId: string;
    
    test('POST /api/publish/content должен создавать новый контент', async () => {
      const response = await request
        .post('/api/publish/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testContent);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      
      // Сохраняем ID созданного контента
      createdContentId = response.body.data.id;
    });
    
    test('GET /api/publish/content/:id должен возвращать созданный контент', async () => {
      // Пропускаем, если ID не был получен
      if (!createdContentId) {
        console.warn('Пропуск теста: ID контента не получен');
        return;
      }
      
      const response = await request
        .get(`/api/publish/content/${createdContentId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', createdContentId);
      expect(response.body.data).toHaveProperty('content', testContent.content);
    });
    
    test('POST /api/publish/now должен публиковать контент', async () => {
      // Пропускаем, если ID не был получен
      if (!createdContentId) {
        console.warn('Пропуск теста: ID контента не получен');
        return;
      }
      
      const response = await request
        .post('/api/publish/now')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: createdContentId,
          platforms: ['telegram', 'vk']
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(Array.isArray(response.body.data.results)).toBe(true);
      
      // Проверяем результаты публикации
      const results = response.body.data.results;
      expect(results.length).toBe(2); // Telegram и VK
      
      // Проверяем результат публикации для Telegram
      const telegramResult = results.find((r: any) => r.platform === 'telegram');
      expect(telegramResult).toBeDefined();
      expect(telegramResult.success).toBe(true);
      expect(telegramResult).toHaveProperty('messageUrl');
      
      // Проверяем результат публикации для VK
      const vkResult = results.find((r: any) => r.platform === 'vk');
      expect(vkResult).toBeDefined();
      expect(vkResult.success).toBe(true);
      expect(vkResult).toHaveProperty('postUrl');
    });
    
    test('POST /api/publish/schedule должен планировать публикацию контента', async () => {
      // Пропускаем, если ID не был получен
      if (!createdContentId) {
        console.warn('Пропуск теста: ID контента не получен');
        return;
      }
      
      // Время публикации через 1 час
      const scheduledTime = new Date();
      scheduledTime.setHours(scheduledTime.getHours() + 1);
      
      const response = await request
        .post('/api/publish/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: createdContentId,
          scheduledAt: scheduledTime.toISOString(),
          platforms: ['telegram', 'vk']
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('scheduledAt');
    });
    
    test('GET /api/publish/scheduled должен возвращать список запланированных публикаций', async () => {
      const response = await request
        .get('/api/publish/scheduled')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
  
  /**
   * Группа тестов для API обработки ошибок
   */
  describe('Обработка ошибок', () => {
    test('GET /api/non-existent-endpoint должен возвращать 404', async () => {
      const response = await request
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
    
    test('POST /api/publish/now с некорректными данными должен возвращать ошибку', async () => {
      const response = await request
        .post('/api/publish/now')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Отсутствует обязательный параметр contentId
          platforms: ['telegram']
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });
    
    test('POST /api/publish/now с несуществующим ID контента должен возвращать ошибку', async () => {
      const response = await request
        .post('/api/publish/now')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: 'non-existent-id',
          platforms: ['telegram']
        });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  /**
   * Тесты для социальных сетей с форматированием
   */
  describe('Формирование контента для соцсетей', () => {
    test('HTML-форматирование должно сохраняться для Telegram', async () => {
      const htmlContent = {
        title: 'HTML форматирование',
        content: '<b>Жирный</b> <i>курсив</i> <u>подчеркнутый</u> <a href="https://example.com">ссылка</a>',
        contentType: 'text',
        campaignId: CAMPAIGN_ID,
        socialPlatforms: ['telegram']
      };
      
      const response = await request
        .post('/api/test/format')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: htmlContent,
          platform: 'telegram'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('formattedContent');
      
      // Проверяем сохранение HTML-тегов для Telegram
      const formattedContent = response.body.data.formattedContent;
      expect(formattedContent).toContain('<b>');
      expect(formattedContent).toContain('<i>');
      expect(formattedContent).toContain('<u>');
      expect(formattedContent).toContain('<a href=');
    });
    
    test('HTML-форматирование должно конвертироваться для VK', async () => {
      const htmlContent = {
        title: 'HTML форматирование',
        content: '<b>Жирный</b> <i>курсив</i> <u>подчеркнутый</u> <a href="https://example.com">ссылка</a>',
        contentType: 'text',
        campaignId: CAMPAIGN_ID,
        socialPlatforms: ['vk']
      };
      
      const response = await request
        .post('/api/test/format')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: htmlContent,
          platform: 'vk'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('formattedContent');
      
      // Проверяем, что HTML-теги были удалены или преобразованы для VK
      const formattedContent = response.body.data.formattedContent;
      expect(formattedContent).not.toContain('<b>');
      expect(formattedContent).not.toContain('</b>');
      
      // Но содержимое тегов должно сохраниться
      expect(formattedContent).toContain('Жирный');
      expect(formattedContent).toContain('курсив');
      expect(formattedContent).toContain('подчеркнутый');
      expect(formattedContent).toContain('ссылка');
      expect(formattedContent).toContain('https://example.com');
    });
  });
});