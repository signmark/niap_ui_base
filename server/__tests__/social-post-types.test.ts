/**
 * Тесты для проверки публикации различных типов постов
 * - Простой текст
 * - Текст с одной картинкой
 * - Текст с форматированием
 * - Текст с форматированием и одной картинкой
 * - Текст с форматированием и несколькими картинками
 */
import axios from 'axios';
import { TelegramService } from '../services/social/telegram-service';
import { VkService } from '../services/social/vk-service';
import { generateTestContent, generateSocialSettings, mockTelegramAPIResponse } from './test-utils';

// Мокаем axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Публикация постов разных типов', () => {
  let telegramService: TelegramService;
  let vkService: VkService;
  const campaignId = '46868c44-c6a4-4bed-accf-9ad07bba790e';
  const telegramSettings = {
    token: '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU',
    chatId: '-1002302366310'
  };
  const vkSettings = {
    token: 'test-vk-token',
    groupId: 'club228626989'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const settings = generateSocialSettings({
      telegram: telegramSettings,
      vk: vkSettings
    });
    
    telegramService = new TelegramService();
    vkService = new VkService();

    // Мокаем метод getCampaignSettings, чтобы он возвращал наши тестовые настройки
    telegramService.getCampaignSettings = jest.fn().mockResolvedValue(settings.telegram);
    vkService.getCampaignSettings = jest.fn().mockResolvedValue(settings.vk);
    
    // Мокаем загрузку изображения для VK
    mockedAxios.post.mockImplementation((url) => {
      if (url.includes('photos.getWallUploadServer')) {
        return Promise.resolve({
          data: {
            response: {
              upload_url: 'https://example.com/upload'
            }
          }
        });
      }
      if (url.includes('photos.saveWallPhoto')) {
        return Promise.resolve({
          data: {
            response: [{
              id: 123456,
              owner_id: -123456789
            }]
          }
        });
      }
      if (url.includes('wall.post')) {
        return Promise.resolve({
          data: {
            response: {
              post_id: 123456
            }
          }
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  // 1. Тест публикации простого текста
  test('публикация простого текста', async () => {
    const content = generateTestContent({
      id: 'test-plain-text',
      title: 'Простой текстовый пост',
      text: 'Это простой текстовый пост без форматирования и изображений.',
      image_url: null,
      additional_images: [],
      social_platforms: ['telegram', 'vk'],
      campaignId
    });

    // Мокируем ответ от Telegram API
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('sendMessage')) {
        return Promise.resolve({
          data: mockTelegramAPIResponse(12345)
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Публикация в Telegram
    const telegramResult = await telegramService.publishContent(content);
    
    // Проверяем, что запрос к Telegram API был выполнен с правильными параметрами
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: telegramSettings.chatId,
          text: content.text
        })
      })
    );
    
    // Проверяем результат публикации
    expect(telegramResult.success).toBe(true);
    
    // Публикация в VK
    const vkResult = await vkService.publishContent(content);
    
    // Проверяем, что запрос к VK API был выполнен с правильными параметрами
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('wall.post'),
      expect.any(URLSearchParams)
    );
    
    // Проверяем результат публикации
    expect(vkResult.success).toBe(true);
  });

  // 2. Тест публикации текста с одной картинкой
  test('публикация текста с одной картинкой', async () => {
    const content = generateTestContent({
      id: 'test-text-with-image',
      title: 'Пост с текстом и картинкой',
      text: 'Это пост с текстом и одной картинкой.',
      image_url: 'https://example.com/test-image.jpg',
      additional_images: [],
      social_platforms: ['telegram', 'vk'],
      campaignId
    });

    // Мокируем ответ от Telegram API для отправки фото
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('sendPhoto')) {
        return Promise.resolve({
          data: mockTelegramAPIResponse(12346)
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Публикация в Telegram
    const telegramResult = await telegramService.publishContent(content);
    
    // Проверяем, что запрос к Telegram API был выполнен с правильными параметрами
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('sendPhoto'),
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: telegramSettings.chatId,
          photo: content.image_url,
          caption: content.text
        })
      })
    );
    
    // Проверяем результат публикации
    expect(telegramResult.success).toBe(true);
    
    // Публикация в VK
    const vkResult = await vkService.publishContent(content);
    
    // Проверяем результат публикации
    expect(vkResult.success).toBe(true);
  });

  // 3. Тест публикации текста с форматированием
  test('публикация текста с форматированием', async () => {
    const formattedText = '<b>Жирный текст</b>, <i>курсив</i> и <a href="https://example.com">ссылка</a>';
    
    const content = generateTestContent({
      id: 'test-formatted-text',
      title: 'Пост с форматированным текстом',
      text: formattedText,
      image_url: null,
      additional_images: [],
      social_platforms: ['telegram', 'vk'],
      campaignId
    });

    // Мокируем ответ от Telegram API
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('sendMessage')) {
        return Promise.resolve({
          data: mockTelegramAPIResponse(12347)
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Публикация в Telegram
    const telegramResult = await telegramService.publishContent(content);
    
    // Проверяем, что запрос к Telegram API был выполнен с правильными параметрами и HTML-форматированием
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: telegramSettings.chatId,
          text: formattedText,
          parse_mode: 'HTML'
        })
      })
    );
    
    // Проверяем результат публикации
    expect(telegramResult.success).toBe(true);
    
    // Публикация в VK
    const vkResult = await vkService.publishContent(content);
    
    // Проверяем результат публикации
    expect(vkResult.success).toBe(true);
  });

  // 4. Тест публикации текста с форматированием и одной картинкой
  test('публикация текста с форматированием и одной картинкой', async () => {
    const formattedText = '<b>Жирный текст</b>, <i>курсив</i> и <a href="https://example.com">ссылка</a>';
    
    const content = generateTestContent({
      id: 'test-formatted-text-with-image',
      title: 'Пост с форматированным текстом и картинкой',
      text: formattedText,
      image_url: 'https://example.com/test-image2.jpg',
      additional_images: [],
      social_platforms: ['telegram', 'vk'],
      campaignId
    });

    // Мокируем ответ от Telegram API
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('sendPhoto')) {
        return Promise.resolve({
          data: mockTelegramAPIResponse(12348)
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Публикация в Telegram
    const telegramResult = await telegramService.publishContent(content);
    
    // Проверяем, что запрос к Telegram API был выполнен с правильными параметрами и HTML-форматированием
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('sendPhoto'),
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: telegramSettings.chatId,
          photo: content.image_url,
          caption: formattedText,
          parse_mode: 'HTML'
        })
      })
    );
    
    // Проверяем результат публикации
    expect(telegramResult.success).toBe(true);
    
    // Публикация в VK
    const vkResult = await vkService.publishContent(content);
    
    // Проверяем результат публикации
    expect(vkResult.success).toBe(true);
  });

  // 5. Тест публикации текста с форматированием и несколькими картинками
  test('публикация текста с форматированием и несколькими картинками', async () => {
    const formattedText = '<b>Жирный текст</b>, <i>курсив</i> и <a href="https://example.com">ссылка</a>';
    
    const content = generateTestContent({
      id: 'test-formatted-text-with-multiple-images',
      title: 'Пост с форматированным текстом и несколькими картинками',
      text: formattedText,
      image_url: 'https://example.com/test-image3.jpg',
      additional_images: [
        'https://example.com/additional-image1.jpg',
        'https://example.com/additional-image2.jpg'
      ],
      social_platforms: ['telegram', 'vk'],
      campaignId
    });

    // Мокируем ответ от Telegram API
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('sendMediaGroup')) {
        return Promise.resolve({
          data: mockTelegramAPIResponse(12349)
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Публикация в Telegram
    const telegramResult = await telegramService.publishContent(content);
    
    // Проверяем, что для нескольких изображений был вызван sendMediaGroup
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('sendMediaGroup'),
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: telegramSettings.chatId,
          media: expect.any(String) // JSON с массивом медиа-объектов
        })
      })
    );
    
    // Проверяем, что в медиа-данных есть 3 изображения (основное + 2 дополнительных)
    const mediaCall = mockedAxios.get.mock.calls.find(call => call[0].includes('sendMediaGroup'));
    if (mediaCall) {
      const mediaParam = JSON.parse(mediaCall[1].params.media);
      expect(mediaParam.length).toBe(3);
      expect(mediaParam[0].type).toBe('photo');
      expect(mediaParam[0].media).toBe(content.image_url);
      expect(mediaParam[0].caption).toBe(formattedText);
      expect(mediaParam[0].parse_mode).toBe('HTML');
    }
    
    // Проверяем результат публикации
    expect(telegramResult.success).toBe(true);
    
    // Публикация в VK
    const vkResult = await vkService.publishContent(content);
    
    // Проверяем результат публикации
    expect(vkResult.success).toBe(true);
  });
});