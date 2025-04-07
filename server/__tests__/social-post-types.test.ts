/**
 * Тесты для различных типов публикаций в социальных сетях
 * Проверяет функциональность разных типов контента для публикации
 */

import axios from 'axios';
import { TelegramService } from '../services/social/telegram-service';
import { VkService } from '../services/social/vk-service';
import { DirectusAuthManager } from '../services/directus-auth-manager';
import { 
  mockTelegramAPIResponse, 
  mockVkAPIResponse,
  generateTestContent, 
  generateFormattedHtmlContent,
  TEST_TELEGRAM_BOT_TOKEN,
  TEST_TELEGRAM_CHAT_ID,
  TEST_VK_API_TOKEN,
  TEST_VK_GROUP_ID
} from './test-utils';
import { mocks, config } from './setup';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Типы публикаций в социальных сетях', () => {
  let telegramService: TelegramService;
  let vkService: VkService;
  let directusAuthManager: DirectusAuthManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Инициализируем сервисы
    directusAuthManager = mocks.authManager as unknown as DirectusAuthManager;
    telegramService = new TelegramService(directusAuthManager);
    vkService = new VkService(directusAuthManager);
    
    // Добавляем методы получения настроек прямо в экземпляры
    (telegramService as any).getCampaignSettings = jest.fn().mockResolvedValue({
      telegram: {
        token: TEST_TELEGRAM_BOT_TOKEN,
        chatId: TEST_TELEGRAM_CHAT_ID
      }
    });
    
    (vkService as any).getCampaignSettings = jest.fn().mockResolvedValue({
      vk: {
        token: TEST_VK_API_TOKEN,
        groupId: TEST_VK_GROUP_ID
      }
    });
    
    // Сбрасываем моки axios
    mockedAxios.post.mockClear();
    mockedAxios.get.mockClear();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Публикация простого текста', () => {
    it('должен успешно публиковать простой текст в Telegram', async () => {
      // Мокируем ответ API Telegram
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('/sendMessage')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(12345) });
        }
        if (url.includes('/getChat')) {
          return Promise.resolve({
            data: {
              ok: true,
              result: {
                id: Number(TEST_TELEGRAM_CHAT_ID),
                type: 'channel',
                username: 'test_channel'
              }
            }
          });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с простым текстом
      const testContent = generateTestContent({
        id: 'simple-text-post',
        title: 'Simple Text Post',
        text: 'This is a simple text post without any formatting or media.',
        image_url: null,
        social_platforms: ['telegram']
      });
      
      // Публикуем контент в Telegram
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({
          chat_id: TEST_TELEGRAM_CHAT_ID,
          text: testContent.content
        })
      );
    });
    
    it('должен успешно публиковать простой текст в VK', async () => {
      const postId = 98765;
      
      // Мокируем ответ API VK
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('wall.post')) {
          return Promise.resolve({ data: mockVkAPIResponse(postId) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с простым текстом
      const testContent = generateTestContent({
        id: 'simple-text-post-vk',
        title: 'Simple Text Post VK',
        text: 'This is a simple text post for VK.',
        image_url: null,
        social_platforms: ['vk']
      });
      
      // Публикуем контент в VK
      const result = await (vkService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      const postCall = mockedAxios.post.mock.calls.find(call => call[0].includes('wall.post'));
      expect(postCall).toBeDefined();
    });
  });
  
  describe('Публикация с HTML-форматированием', () => {
    it('должен корректно обрабатывать HTML-форматирование в Telegram', async () => {
      // Мокируем ответ API Telegram
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('/sendMessage')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(12346) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с HTML-форматированием
      const formattedHtml = generateFormattedHtmlContent();
      const testContent = generateTestContent({
        id: 'html-formatted-post',
        title: 'HTML Formatted Post',
        text: formattedHtml,
        image_url: null,
        social_platforms: ['telegram']
      });
      
      // Публикуем контент в Telegram
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({
          chat_id: TEST_TELEGRAM_CHAT_ID,
          text: formattedHtml,
          parse_mode: 'HTML'
        })
      );
    });
    
    it('должен преобразовывать HTML-форматирование в простой текст для VK', async () => {
      const postId = 98766;
      
      // Мокируем ответ API VK
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('wall.post')) {
          return Promise.resolve({ data: mockVkAPIResponse(postId) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с HTML-форматированием
      const formattedHtml = generateFormattedHtmlContent();
      const testContent = generateTestContent({
        id: 'html-formatted-post-vk',
        title: 'HTML Formatted Post VK',
        text: formattedHtml,
        image_url: null,
        social_platforms: ['vk']
      });
      
      // Публикуем контент в VK
      const result = await (vkService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      const postCall = mockedAxios.post.mock.calls.find(call => call[0].includes('wall.post'));
      expect(postCall).toBeDefined();
      expect(postCall![1].get('message')).not.toContain('<b>');
      expect(postCall![1].get('message')).not.toContain('<i>');
    });
  });
  
  describe('Публикация с одним изображением', () => {
    it('должен успешно публиковать пост с одним изображением в Telegram', async () => {
      // Мокируем ответ API Telegram
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('/sendPhoto')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(12347) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с одним изображением
      const testContent = generateTestContent({
        id: 'single-image-post',
        title: 'Single Image Post',
        text: 'This is a post with a single image.',
        image_url: 'https://example.com/test-image.jpg',
        social_platforms: ['telegram']
      });
      
      // Публикуем контент в Telegram
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendPhoto'),
        expect.objectContaining({
          chat_id: TEST_TELEGRAM_CHAT_ID,
          photo: testContent.imageUrl,
          caption: testContent.content
        })
      );
    });
    
    it('должен успешно публиковать пост с одним изображением в VK', async () => {
      const postId = 98767;
      const uploadUrl = 'https://example.com/vk-upload-url';
      const photoId = 123456;
      const ownerId = -parseInt(TEST_VK_GROUP_ID.replace('club', ''));
      
      // Мокируем ответы API VK
      mockedAxios.get.mockImplementation(url => {
        if (url.includes('photos.getWallUploadServer')) {
          return Promise.resolve({ 
            data: { 
              response: { 
                upload_url: uploadUrl 
              } 
            } 
          });
        }
        return Promise.resolve({ data: {} });
      });
      
      mockedAxios.post.mockImplementation(url => {
        if (url === uploadUrl) {
          return Promise.resolve({ 
            data: { 
              server: 1, 
              photo: '[]', 
              hash: 'test-hash' 
            } 
          });
        }
        
        if (url.includes('photos.saveWallPhoto')) {
          return Promise.resolve({ 
            data: { 
              response: [{ 
                id: photoId, 
                owner_id: ownerId 
              }] 
            } 
          });
        }
        
        if (url.includes('wall.post')) {
          return Promise.resolve({ data: mockVkAPIResponse(postId) });
        }
        
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с одним изображением
      const testContent = generateTestContent({
        id: 'single-image-post-vk',
        title: 'Single Image Post VK',
        text: 'This is a post with a single image for VK.',
        image_url: 'https://example.com/test-image.jpg',
        social_platforms: ['vk']
      });
      
      // Публикуем контент в VK
      const result = await (vkService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      const postCall = mockedAxios.post.mock.calls.find(call => call[0].includes('wall.post'));
      expect(postCall).toBeDefined();
      expect(postCall![1].get('attachments')).toBeDefined();
    });
  });
  
  describe('Публикация с несколькими изображениями', () => {
    it('должен успешно публиковать пост с несколькими изображениями в Telegram', async () => {
      // Мокируем ответ API Telegram
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('/sendMediaGroup')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(12348) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с несколькими изображениями
      const testContent = generateTestContent({
        id: 'multi-image-post',
        title: 'Multi Image Post',
        text: 'This is a post with multiple images.',
        image_url: 'https://example.com/test-image1.jpg',
        additional_images: [
          'https://example.com/test-image2.jpg',
          'https://example.com/test-image3.jpg'
        ],
        social_platforms: ['telegram']
      });
      
      // Публикуем контент в Telegram
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      const mediaGroup = mockedAxios.post.mock.calls.find(call => call[0].includes('/sendMediaGroup'));
      expect(mediaGroup).toBeDefined();
      expect(mediaGroup![1].media.length).toBe(3);
    });
    
    it('должен успешно публиковать пост с несколькими изображениями в VK', async () => {
      const postId = 98768;
      const uploadUrl = 'https://example.com/vk-upload-url';
      const ownerId = -parseInt(TEST_VK_GROUP_ID.replace('club', ''));
      
      // Мокируем ответы API VK
      mockedAxios.get.mockImplementation(url => {
        if (url.includes('photos.getWallUploadServer')) {
          return Promise.resolve({ 
            data: { 
              response: { 
                upload_url: uploadUrl 
              } 
            } 
          });
        }
        return Promise.resolve({ data: {} });
      });
      
      mockedAxios.post.mockImplementation((url, data) => {
        if (url === uploadUrl) {
          return Promise.resolve({ 
            data: { 
              server: 1, 
              photo: '[]', 
              hash: 'test-hash' 
            } 
          });
        }
        
        if (url.includes('photos.saveWallPhoto')) {
          return Promise.resolve({ 
            data: { 
              response: [{ 
                id: Math.floor(Math.random() * 1000), 
                owner_id: ownerId 
              }] 
            } 
          });
        }
        
        if (url.includes('wall.post')) {
          return Promise.resolve({ data: mockVkAPIResponse(postId) });
        }
        
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с несколькими изображениями
      const testContent = generateTestContent({
        id: 'multi-image-post-vk',
        title: 'Multi Image Post VK',
        text: 'This is a post with multiple images for VK.',
        image_url: 'https://example.com/test-image1.jpg',
        additional_images: [
          'https://example.com/test-image2.jpg',
          'https://example.com/test-image3.jpg'
        ],
        social_platforms: ['vk']
      });
      
      // Публикуем контент в VK
      const result = await (vkService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      const postCall = mockedAxios.post.mock.calls.find(call => call[0].includes('wall.post'));
      expect(postCall).toBeDefined();
    });
  });
  
  describe('Публикация с хэштегами и ключевыми словами', () => {
    it('должен включать хэштеги в пост для Telegram', async () => {
      // Мокируем ответ API Telegram
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('/sendMessage')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(12349) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с хэштегами
      const testContent = generateTestContent({
        id: 'post-with-hashtags',
        title: 'Post With Hashtags',
        text: 'This is a post with hashtags.',
        image_url: null,
        social_platforms: ['telegram'],
        hashtags: ['test', 'hashtags', 'example']
      });
      
      // Публикуем контент в Telegram
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      const messageCall = mockedAxios.post.mock.calls.find(call => call[0].includes('/sendMessage'));
      expect(messageCall![1].text).toContain('#test');
    });
    
    it('должен включать хэштеги в пост для VK', async () => {
      const postId = 98769;
      
      // Мокируем ответ API VK
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('wall.post')) {
          return Promise.resolve({ data: mockVkAPIResponse(postId) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Тестовый контент с хэштегами
      const testContent = generateTestContent({
        id: 'post-with-hashtags-vk',
        title: 'Post With Hashtags VK',
        text: 'This is a post with hashtags for VK.',
        image_url: null,
        social_platforms: ['vk'],
        hashtags: ['test', 'hashtags', 'example']
      });
      
      // Публикуем контент в VK
      const result = await (vkService as any).publishContent(testContent);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      const postCall = mockedAxios.post.mock.calls.find(call => call[0].includes('wall.post'));
      expect(postCall![1].get('message')).toContain('#test');
    });
  });
});