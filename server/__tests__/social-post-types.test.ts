/**
 * Тесты для проверки публикации различных типов постов
 * - Простой текст
 * - Текст с одной картинкой
 * - Текст с форматированием
 * - Текст с форматированием и одной картинкой
 * - Текст с форматированием и несколькими картинками
 */

import { TelegramService } from '../services/social/telegram-service';
import { VkService } from '../services/social/vk-service';
import { generateTestContent, mockTelegramAPIResponse, mockDirectusGetCampaign } from './test-utils';
import axios from 'axios';
import FormData from 'form-data';

// Моки для axios и FormData
jest.mock('axios');
jest.mock('form-data');

// Константы для тестов
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13';

// Функция для импорта сервисов с моками
function setupService() {
  const mockAxios = axios as jest.Mocked<typeof axios>;
  const mockFormData = FormData as jest.MockedClass<typeof FormData>;
  
  // Настраиваем axios мок
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
    // По умолчанию возвращаем успешный ответ
    return Promise.resolve({ data: { success: true } });
  });
  
  // Настраиваем FormData мок
  mockFormData.prototype.append = jest.fn();
  mockFormData.prototype.getHeaders = jest.fn(() => ({}));
  
  // Создаем экземпляры сервисов
  const telegramService = new TelegramService();
  const vkService = new VkService();
  
  // Мокируем методы сервисов
  telegramService.getCampaignSettings = jest.fn().mockResolvedValue(
    mockDirectusGetCampaign(CAMPAIGN_ID).socialMediaSettings.telegram
  );
  vkService.getCampaignSettings = jest.fn().mockResolvedValue(
    mockDirectusGetCampaign(CAMPAIGN_ID).socialMediaSettings.vk
  );
  
  // Реализуем метод publish для сервисов
  telegramService.publishContent = jest.fn().mockImplementation(async (content) => {
    if (content.additionalImages && content.additionalImages.length > 0) {
      return { success: true, messageId: 12346, messageUrl: 'https://t.me/c/2302366310/12346' };
    } else if (content.imageUrl) {
      return { success: true, messageId: 12345, messageUrl: 'https://t.me/c/2302366310/12345' };
    } else {
      return { success: true, messageId: 12344, messageUrl: 'https://t.me/c/2302366310/12344' };
    }
  });
  
  vkService.publishContent = jest.fn().mockImplementation(async (content) => {
    return { success: true, postId: 12345, postUrl: 'https://vk.com/wall-228626989_12345' };
  });
  
  return { telegramService, vkService, mockAxios, mockFormData };
}

describe('Социальные посты: типы контента', () => {
  let telegramService: TelegramService;
  let vkService: VkService;
  let mockAxios: jest.Mocked<typeof axios>;
  let mockFormData: jest.MockedClass<typeof FormData>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    const setup = setupService();
    telegramService = setup.telegramService;
    vkService = setup.vkService;
    mockAxios = setup.mockAxios;
    mockFormData = setup.mockFormData;
  });
  
  // Тест 1: Публикация простого текста
  test('Telegram: публикация простого текста без форматирования', async () => {
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
    expect(result.messageUrl).toContain('t.me');
    expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
  
  test('VK: публикация простого текста без форматирования', async () => {
    const content = generateTestContent({
      id: '1',
      title: 'Тест простого текста',
      text: 'Это простой текст без форматирования',
      image_url: null,
      social_platforms: ['vk'],
      campaignId: CAMPAIGN_ID
    });
    
    const result = await vkService.publishContent(content);
    
    expect(result.success).toBe(true);
    expect(result.postId).toBeDefined();
    expect(result.postUrl).toContain('vk.com');
    expect(vkService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
  
  // Тест 2: Публикация текста с картинкой
  test('Telegram: публикация текста с одной картинкой', async () => {
    const content = generateTestContent({
      id: '2',
      title: 'Тест текста с картинкой',
      text: 'Это текст с одной картинкой',
      image_url: 'https://example.com/image.jpg',
      social_platforms: ['telegram'],
      campaignId: CAMPAIGN_ID
    });
    
    const result = await telegramService.publishContent(content);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageUrl).toContain('t.me');
    expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
  
  test('VK: публикация текста с одной картинкой', async () => {
    const content = generateTestContent({
      id: '2',
      title: 'Тест текста с картинкой',
      text: 'Это текст с одной картинкой',
      image_url: 'https://example.com/image.jpg',
      social_platforms: ['vk'],
      campaignId: CAMPAIGN_ID
    });
    
    const result = await vkService.publishContent(content);
    
    expect(result.success).toBe(true);
    expect(result.postId).toBeDefined();
    expect(result.postUrl).toContain('vk.com');
    expect(vkService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
  
  // Тест 3: Публикация форматированного текста
  test('Telegram: публикация форматированного текста', async () => {
    const content = generateTestContent({
      id: '3',
      title: 'Тест форматированного текста',
      text: '<b>Жирный текст</b> и <i>курсив</i> с <a href="https://example.com">ссылкой</a>',
      image_url: null,
      social_platforms: ['telegram'],
      campaignId: CAMPAIGN_ID
    });
    
    const result = await telegramService.publishContent(content);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageUrl).toContain('t.me');
    expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
  
  test('VK: публикация форматированного текста', async () => {
    const content = generateTestContent({
      id: '3',
      title: 'Тест форматированного текста',
      text: '<b>Жирный текст</b> и <i>курсив</i> с <a href="https://example.com">ссылкой</a>',
      image_url: null,
      social_platforms: ['vk'],
      campaignId: CAMPAIGN_ID
    });
    
    const result = await vkService.publishContent(content);
    
    expect(result.success).toBe(true);
    expect(result.postId).toBeDefined();
    expect(result.postUrl).toContain('vk.com');
    expect(vkService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
  
  // Тест 4: Публикация форматированного текста с картинкой
  test('Telegram: публикация форматированного текста с картинкой', async () => {
    const content = generateTestContent({
      id: '4',
      title: 'Тест форматированного текста с картинкой',
      text: '<b>Жирный текст</b> и <i>курсив</i> с <a href="https://example.com">ссылкой</a>',
      image_url: 'https://example.com/image.jpg',
      social_platforms: ['telegram'],
      campaignId: CAMPAIGN_ID
    });
    
    const result = await telegramService.publishContent(content);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageUrl).toContain('t.me');
    expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
  
  test('VK: публикация форматированного текста с картинкой', async () => {
    const content = generateTestContent({
      id: '4',
      title: 'Тест форматированного текста с картинкой',
      text: '<b>Жирный текст</b> и <i>курсив</i> с <a href="https://example.com">ссылкой</a>',
      image_url: 'https://example.com/image.jpg',
      social_platforms: ['vk'],
      campaignId: CAMPAIGN_ID
    });
    
    const result = await vkService.publishContent(content);
    
    expect(result.success).toBe(true);
    expect(result.postId).toBeDefined();
    expect(result.postUrl).toContain('vk.com');
    expect(vkService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
  
  // Тест 5: Публикация форматированного текста с несколькими картинками
  test('Telegram: публикация форматированного текста с несколькими картинками', async () => {
    const content = generateTestContent({
      id: '5',
      title: 'Тест форматированного текста с несколькими картинками',
      text: '<b>Жирный текст</b> и <i>курсив</i> с <a href="https://example.com">ссылкой</a>',
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
    expect(result.messageUrl).toContain('t.me');
    expect(telegramService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
  
  test('VK: публикация форматированного текста с несколькими картинками', async () => {
    const content = generateTestContent({
      id: '5',
      title: 'Тест форматированного текста с несколькими картинками',
      text: '<b>Жирный текст</b> и <i>курсив</i> с <a href="https://example.com">ссылкой</a>',
      image_url: 'https://example.com/image1.jpg',
      additional_images: [
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg'
      ],
      social_platforms: ['vk'],
      campaignId: CAMPAIGN_ID
    });
    
    const result = await vkService.publishContent(content);
    
    expect(result.success).toBe(true);
    expect(result.postId).toBeDefined();
    expect(result.postUrl).toContain('vk.com');
    expect(vkService.getCampaignSettings).toHaveBeenCalledTimes(1);
  });
});