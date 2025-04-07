/**
 * Тесты интеграции для бэкенда SMM менеджера
 * Проверяет корректность отправки сообщений через различные социальные сети
 * и правильность форматирования контента
 */

import { TelegramService } from '../services/social/telegram-service';
import { VkService } from '../services/social/vk-service';
import { InstagramService } from '../services/social/instagram-service';
import { DirectusAuthManager } from '../services/directus/directus-auth-manager';
import { generateTestContent, mockTelegramAPIResponse } from './test-utils';
import axios from 'axios';
import FormData from 'form-data';
import { DatabaseStorage } from '../storage';

// Моки для зависимостей
jest.mock('axios');
jest.mock('form-data');
jest.mock('../services/directus/directus-auth-manager');
jest.mock('../storage');

// Константы для тестов
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13';
const TELEGRAM_TOKEN = '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = '-1002302366310';
const VK_TOKEN = 'vk1.a.0jlmORGkgmds1qIB5btPIIuT1FZ8C_bkGpCcowI9Ml214neQFgVMiYEnePWq48txdx3D7oTtKbEvgnEifytkkyjv1FvooFsI0y_YYPX8Cw__525Tnqt_H7C9hEEdmsqHXExr4Q3DK7CL0quCvnhrhN368Ter9yFLe6buYgpnamBXwUx4yZnRJPdBVfnPmObtZRrXw7NaZJboCqAK8sXLEA';
const VK_GROUP_ID = 'club228626989';

describe('Бэкенд SMM менеджера: интеграционные тесты', () => {
  // Настройка тестового окружения перед каждым тестом
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Настраиваем мок для axios
    const mockAxios = axios as jest.Mocked<typeof axios>;
    mockAxios.post.mockImplementation((url) => {
      if (url.includes('sendMessage')) {
        return Promise.resolve({ 
          data: {
            ok: true,
            result: {
              message_id: 12345,
              chat: { id: Number(TELEGRAM_CHAT_ID), type: 'channel' },
              date: Math.floor(Date.now() / 1000),
              text: 'Тестовое сообщение'
            }
          }
        });
      }
      
      if (url.includes('sendPhoto')) {
        return Promise.resolve({
          data: {
            ok: true,
            result: {
              message_id: 12346,
              chat: { id: Number(TELEGRAM_CHAT_ID), type: 'channel' },
              date: Math.floor(Date.now() / 1000),
              photo: [{ file_id: 'test_photo_id' }],
              caption: 'Тестовая подпись к фото'
            }
          }
        });
      }
      
      if (url.includes('sendMediaGroup')) {
        return Promise.resolve({
          data: {
            ok: true,
            result: [
              {
                message_id: 12347,
                chat: { id: Number(TELEGRAM_CHAT_ID), type: 'channel' },
                date: Math.floor(Date.now() / 1000),
                photo: [{ file_id: 'test_photo_id_1' }]
              },
              {
                message_id: 12348,
                chat: { id: Number(TELEGRAM_CHAT_ID), type: 'channel' },
                date: Math.floor(Date.now() / 1000),
                photo: [{ file_id: 'test_photo_id_2' }]
              }
            ]
          }
        });
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
      
      if (url.includes('media/upload')) {
        // Имитация успешной загрузки медиа в Instagram
        return Promise.resolve({
          data: {
            id: '17889455559133624'
          }
        });
      }
      
      if (url.includes('media/publish')) {
        // Имитация успешной публикации в Instagram
        return Promise.resolve({
          data: {
            id: '17889455559133624'
          }
        });
      }
      
      // По умолчанию возвращаем успешный ответ
      return Promise.resolve({ data: { success: true } });
    });
    
    // Настраиваем мок для FormData
    const mockFormData = FormData as jest.MockedClass<typeof FormData>;
    mockFormData.prototype.append = jest.fn();
    mockFormData.prototype.getHeaders = jest.fn(() => ({}));
    mockFormData.prototype.getBoundary = jest.fn(() => 'test-boundary');
  });
  
  // Группа тестов для TelegramService
  describe('TelegramService', () => {
    let telegramService: TelegramService;
    
    beforeEach(() => {
      telegramService = new TelegramService();
      
      // Мокируем внутренние методы сервиса
      telegramService.getCampaignSettings = jest.fn().mockResolvedValue({
        token: TELEGRAM_TOKEN,
        chatId: TELEGRAM_CHAT_ID
      });
      
      telegramService.generatePostUrl = jest.fn().mockImplementation((chatId, messageId) => {
        return `https://t.me/c/${chatId.toString().replace('-100', '')}/` + messageId;
      });
    });
    
    test('Должен отправлять простой текст в Telegram', async () => {
      const content = generateTestContent({
        id: '1',
        title: 'Тест простого текста',
        text: 'Это простой текст без форматирования',
        image_url: null,
        social_platforms: ['telegram'],
        campaignId: CAMPAIGN_ID
      });
      
      const result = await telegramService.publishContent(content);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageUrl).toContain('t.me/c/');
      expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('sendMessage'),
        expect.objectContaining({
          chat_id: TELEGRAM_CHAT_ID,
          text: expect.any(String),
          parse_mode: 'HTML'
        })
      );
    });
    
    test('Должен отправлять HTML-форматированный текст в Telegram', async () => {
      const content = generateTestContent({
        id: '2',
        title: 'Тест HTML форматирования',
        text: '<b>Жирный текст</b> и <i>курсив</i> с <a href="https://example.com">ссылкой</a>',
        image_url: null,
        social_platforms: ['telegram'],
        campaignId: CAMPAIGN_ID
      });
      
      const result = await telegramService.publishContent(content);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageUrl).toContain('t.me/c/');
      expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('sendMessage'),
        expect.objectContaining({
          chat_id: TELEGRAM_CHAT_ID,
          text: expect.stringContaining('<b>Жирный текст</b>'),
          parse_mode: 'HTML'
        })
      );
    });
    
    test('Должен отправлять изображение с текстом в Telegram', async () => {
      const content = generateTestContent({
        id: '3',
        title: 'Тест изображения с текстом',
        text: 'Текст с <b>форматированием</b>',
        image_url: 'https://example.com/image.jpg',
        social_platforms: ['telegram'],
        campaignId: CAMPAIGN_ID
      });
      
      const result = await telegramService.publishContent(content);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageUrl).toContain('t.me/c/');
      expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('sendPhoto'),
        expect.objectContaining({
          chat_id: TELEGRAM_CHAT_ID,
          photo: 'https://example.com/image.jpg',
          caption: expect.stringContaining('форматированием'),
          parse_mode: 'HTML'
        })
      );
    });
    
    test('Должен отправлять несколько изображений с текстом в Telegram', async () => {
      const content = generateTestContent({
        id: '4',
        title: 'Тест множественных изображений',
        text: 'Текст для группы изображений',
        image_url: 'https://example.com/image1.jpg',
        additional_images: [
          'https://example.com/image2.jpg',
          'https://example.com/image3.jpg'
        ],
        social_platforms: ['telegram'],
        campaignId: CAMPAIGN_ID
      });
      
      const result = await telegramService.publishContent(content);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageUrl).toContain('t.me/c/');
      expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('sendMediaGroup'),
        expect.objectContaining({
          chat_id: TELEGRAM_CHAT_ID,
          media: expect.arrayContaining([
            expect.objectContaining({
              type: 'photo',
              media: 'https://example.com/image1.jpg',
              caption: expect.stringContaining('Текст для группы изображений'),
              parse_mode: 'HTML'
            })
          ])
        })
      );
    });
    
    test('Должен обрабатывать ошибки API Telegram', async () => {
      // Переопределяем мок для этого конкретного теста
      const mockAxios = axios as jest.Mocked<typeof axios>;
      mockAxios.post.mockRejectedValueOnce({
        response: {
          data: {
            ok: false,
            error_code: 400,
            description: 'Bad Request: chat not found'
          }
        }
      });
      
      const content = generateTestContent({
        id: '5',
        title: 'Тест обработки ошибок',
        text: 'Тестовый текст',
        image_url: null,
        social_platforms: ['telegram'],
        campaignId: CAMPAIGN_ID
      });
      
      const result = await telegramService.publishContent(content);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bad Request');
      expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
    });
  });
  
  // Группа тестов для VkService
  describe('VkService', () => {
    let vkService: VkService;
    
    beforeEach(() => {
      vkService = new VkService();
      
      // Мокируем внутренние методы сервиса
      vkService.getCampaignSettings = jest.fn().mockResolvedValue({
        token: VK_TOKEN,
        groupId: VK_GROUP_ID
      });
    });
    
    test('Должен публиковать простой текст в VK', async () => {
      const content = generateTestContent({
        id: '6',
        title: 'Тест простого текста для VK',
        text: 'Это простой текст без форматирования для VK',
        image_url: null,
        social_platforms: ['vk'],
        campaignId: CAMPAIGN_ID
      });
      
      const result = await vkService.publishContent(content);
      
      expect(result.success).toBe(true);
      expect(result.postId).toBe(12345);
      expect(result.postUrl).toContain('vk.com/wall');
      expect(vkService.getCampaignSettings).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('wall.post'),
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.any(Object)
        })
      );
    });
    
    test('Должен публиковать текст и изображение в VK', async () => {
      const content = generateTestContent({
        id: '7',
        title: 'Тест изображения для VK',
        text: 'Текст с изображением для VK',
        image_url: 'https://example.com/image.jpg',
        social_platforms: ['vk'],
        campaignId: CAMPAIGN_ID
      });
      
      // Мокируем axios для этого конкретного теста
      const mockAxios = axios as jest.Mocked<typeof axios>;
      mockAxios.post.mockImplementation((url) => {
        if (url.includes('photos.getWallUploadServer')) {
          return Promise.resolve({
            data: {
              response: {
                upload_url: 'https://pu.vk.com/c12345/upload.php'
              }
            }
          });
        }
        if (url.includes('upload.php')) {
          return Promise.resolve({
            data: {
              server: 123456,
              photo: 'photo-content-base64',
              hash: 'photo-hash-123'
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
        return Promise.resolve({ data: {} });
      });
      
      const result = await vkService.publishContent(content);
      
      expect(result.success).toBe(true);
      expect(result.postId).toBe(12345);
      expect(result.postUrl).toContain('vk.com/wall');
      expect(vkService.getCampaignSettings).toHaveBeenCalledTimes(1);
      // Проверяем запрос на получение URL для загрузки фото
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('photos.getWallUploadServer'),
        expect.any(FormData),
        expect.any(Object)
      );
    });
    
    test('Должен обрабатывать ошибки API VK', async () => {
      // Переопределяем мок для этого конкретного теста
      const mockAxios = axios as jest.Mocked<typeof axios>;
      mockAxios.post.mockRejectedValueOnce({
        response: {
          data: {
            error: {
              error_code: 15,
              error_msg: 'Access denied: user is deactivated'
            }
          }
        }
      });
      
      const content = generateTestContent({
        id: '8',
        title: 'Тест обработки ошибок VK',
        text: 'Тестовый текст для VK',
        image_url: null,
        social_platforms: ['vk'],
        campaignId: CAMPAIGN_ID
      });
      
      const result = await vkService.publishContent(content);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
      expect(vkService.getCampaignSettings).toHaveBeenCalledTimes(1);
    });
  });
  
  // Дополнительные тесты форматирования контента
  describe('Форматирование контента', () => {
    let telegramService: TelegramService;
    let vkService: VkService;
    
    beforeEach(() => {
      telegramService = new TelegramService();
      vkService = new VkService();
      
      // Мокируем методы получения настроек
      telegramService.getCampaignSettings = jest.fn().mockResolvedValue({
        token: TELEGRAM_TOKEN,
        chatId: TELEGRAM_CHAT_ID
      });
      
      vkService.getCampaignSettings = jest.fn().mockResolvedValue({
        token: VK_TOKEN,
        groupId: VK_GROUP_ID
      });
    });
    
    test('Telegram сохраняет HTML-форматирование', async () => {
      const htmlContent = '<b>Жирный</b> <i>курсив</i> <u>подчеркнутый</u> <s>зачеркнутый</s> <a href="https://example.com">ссылка</a>';
      
      const content = generateTestContent({
        id: '9',
        title: 'Тест HTML-форматирования',
        text: htmlContent,
        image_url: null,
        social_platforms: ['telegram'],
        campaignId: CAMPAIGN_ID
      });
      
      await telegramService.publishContent(content);
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('sendMessage'),
        expect.objectContaining({
          text: expect.stringContaining(htmlContent),
          parse_mode: 'HTML'
        })
      );
    });
    
    test('VK конвертирует HTML в собственный формат', async () => {
      const htmlContent = '<b>Жирный</b> <i>курсив</i> <u>подчеркнутый</u> <s>зачеркнутый</s> <a href="https://example.com">ссылка</a>';
      
      const content = generateTestContent({
        id: '10',
        title: 'Тест HTML-форматирования для VK',
        text: htmlContent,
        image_url: null,
        social_platforms: ['vk'],
        campaignId: CAMPAIGN_ID
      });
      
      await vkService.publishContent(content);
      
      // VK API должен получить текст без HTML-тегов или с преобразованными тегами
      const mockFormData = FormData.prototype.append as jest.Mock;
      const appendCalls = mockFormData.mock.calls;
      
      // Ищем вызов, где был добавлен message
      const messageCall = appendCalls.find(call => call[0] === 'message');
      expect(messageCall).toBeDefined();
      
      // Текст не должен содержать HTML-теги
      const messageText = messageCall ? messageCall[1] : '';
      expect(messageText).not.toContain('<b>');
      expect(messageText).not.toContain('</b>');
      expect(messageText).not.toContain('<i>');
      expect(messageText).not.toContain('</i>');
      
      // Но должен содержать оригинальный текст
      expect(messageText).toContain('Жирный');
      expect(messageText).toContain('курсив');
      expect(messageText).toContain('подчеркнутый');
      expect(messageText).toContain('зачеркнутый');
      expect(messageText).toContain('ссылка');
    });
  });
});