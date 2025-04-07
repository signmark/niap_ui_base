/**
 * Тесты для Telegram сервиса
 * Проверяет корректность публикации контента в Telegram
 */

import axios from 'axios';
import { DirectusAuthManager } from '../services/directus-auth-manager';
import { TelegramService } from '../services/social/telegram-service';
import { 
  mockTelegramAPIResponse, 
  generateTestContent, 
  generateFormattedHtmlContent,
  TEST_TELEGRAM_BOT_TOKEN,
  TEST_TELEGRAM_CHAT_ID
} from './test-utils';
import { mocks, config } from './setup';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TelegramService', () => {
  let telegramService: TelegramService;
  let directusAuthManager: DirectusAuthManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    directusAuthManager = mocks.authManager as unknown as DirectusAuthManager;
    telegramService = new TelegramService(directusAuthManager);
    
    // Добавляем метод для получения настроек прямо в экземпляр
    (telegramService as any).getCampaignSettings = jest.fn().mockResolvedValue({
      telegram: {
        token: TEST_TELEGRAM_BOT_TOKEN,
        chatId: TEST_TELEGRAM_CHAT_ID
      }
    });
    
    // Сбрасываем моки axios
    mockedAxios.post.mockClear();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Генерация URL сообщения', () => {
    it('должен формировать корректный URL сообщения для публичного канала', async () => {
      // Моки для API ответов
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('sendMessage')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(12345) });
        }
        if (url.includes('getChat')) {
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
      
      // Получаем информацию о чате сначала, чтобы сохранить username
      await (telegramService as any).getChatInfo(TEST_TELEGRAM_CHAT_ID, TEST_TELEGRAM_BOT_TOKEN);
      
      // Формируем URL с использованием сохраненного username
      const result = await (telegramService as any).generatePostUrl(TEST_TELEGRAM_CHAT_ID, TEST_TELEGRAM_CHAT_ID, 12345);
      
      // Проверяем результат
      expect(result).toBe('https://t.me/test_channel/12345');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('getChat'),
        expect.objectContaining({ chat_id: TEST_TELEGRAM_CHAT_ID })
      );
    });
    
    it('должен формировать корректный URL сообщения для приватного канала', async () => {
      // Моки для API ответов
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('sendMessage')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(12345) });
        }
        if (url.includes('getChat')) {
          return Promise.resolve({
            data: {
              ok: true,
              result: {
                id: Number(TEST_TELEGRAM_CHAT_ID),
                type: 'channel',
                title: 'Private Channel',
                // Приватный канал - нет username
              }
            }
          });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Получаем информацию о чате сначала, чтобы сбросить значение username
      await (telegramService as any).getChatInfo(TEST_TELEGRAM_CHAT_ID, TEST_TELEGRAM_BOT_TOKEN);
      
      // Вручную обнуляем username для проверки генерации URL для приватного канала
      (telegramService as any).currentChatUsername = undefined;
      
      // Формируем URL
      const result = await (telegramService as any).generatePostUrl(TEST_TELEGRAM_CHAT_ID, TEST_TELEGRAM_CHAT_ID, 12345);
      
      // Проверяем результат - должен использовать формат для приватных каналов
      expect(result).toBe(`https://t.me/c/${TEST_TELEGRAM_CHAT_ID.replace('-100', '')}/12345`);
    });
  });
  
  describe('Публикация текстовых сообщений', () => {
    it('должен корректно публиковать только текстовое сообщение', async () => {
      const messageId = 12345;
      
      // Мокируем ответ API Telegram
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('sendMessage')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(messageId) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Создаем тестовый контент
      const testContent = generateTestContent({
        id: 'test-content-id',
        title: 'Test Post',
        text: 'This is a test message',
        image_url: null,
        social_platforms: ['telegram']
      });
      
      // Публикуем контент
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем успешность публикации
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(messageId);
      
      // Проверяем, что был выполнен корректный API вызов
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('sendMessage'),
        expect.objectContaining({
          chat_id: TEST_TELEGRAM_CHAT_ID,
          text: testContent.content,
          parse_mode: 'HTML'
        })
      );
    });
    
    it('должен корректно обрабатывать HTML-форматирование', async () => {
      const messageId = 12346;
      const formattedText = generateFormattedHtmlContent();
      
      // Мокируем ответ API Telegram
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('sendMessage')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(messageId) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Создаем тестовый контент с HTML форматированием
      const testContent = generateTestContent({
        id: 'test-formatted-content-id',
        title: 'Test Formatted Post',
        text: formattedText,
        image_url: null,
        social_platforms: ['telegram']
      });
      
      // Публикуем контент
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем успешность публикации
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(messageId);
      
      // Проверяем, что был выполнен корректный API вызов с HTML режимом парсинга
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('sendMessage'),
        expect.objectContaining({
          chat_id: TEST_TELEGRAM_CHAT_ID,
          text: formattedText,
          parse_mode: 'HTML'
        })
      );
    });
  });
  
  describe('Публикация сообщений с медиа', () => {
    it('должен корректно публиковать одно изображение с текстом', async () => {
      const messageId = 12347;
      
      // Мокируем ответ API Telegram
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('sendPhoto')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(messageId) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Создаем тестовый контент с изображением
      const testContent = generateTestContent({
        id: 'test-image-content-id',
        title: 'Test Image Post',
        text: 'This is a post with image',
        image_url: 'https://example.com/test-image.jpg',
        social_platforms: ['telegram']
      });
      
      // Публикуем контент
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем успешность публикации
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(messageId);
      
      // Проверяем, что был выполнен корректный API вызов с отправкой фото
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('sendPhoto'),
        expect.objectContaining({
          chat_id: TEST_TELEGRAM_CHAT_ID,
          photo: testContent.imageUrl,
          caption: testContent.content,
          parse_mode: 'HTML'
        })
      );
    });
    
    it('должен корректно публиковать несколько изображений с текстом', async () => {
      const messageId = 12348;
      
      // Мокируем ответ API Telegram
      mockedAxios.post.mockImplementation(url => {
        if (url.includes('sendMediaGroup')) {
          return Promise.resolve({ data: mockTelegramAPIResponse(messageId) });
        }
        return Promise.resolve({ data: {} });
      });
      
      // Создаем тестовый контент с несколькими изображениями
      const testContent = generateTestContent({
        id: 'test-multi-image-content-id',
        title: 'Test Multi Image Post',
        text: 'This is a post with multiple images',
        image_url: 'https://example.com/test-image-1.jpg',
        additional_images: [
          'https://example.com/test-image-2.jpg',
          'https://example.com/test-image-3.jpg'
        ],
        social_platforms: ['telegram']
      });
      
      // Публикуем контент
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем успешность публикации
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(messageId);
      
      // Проверяем, что был выполнен корректный API вызов с медиа группой
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('sendMediaGroup'),
        expect.objectContaining({
          chat_id: TEST_TELEGRAM_CHAT_ID,
          media: expect.arrayContaining([
            expect.objectContaining({
              type: 'photo',
              media: testContent.imageUrl,
              caption: testContent.content,
              parse_mode: 'HTML'
            }),
            expect.objectContaining({
              type: 'photo',
              media: testContent.additionalImages![0]
            }),
            expect.objectContaining({
              type: 'photo',
              media: testContent.additionalImages![1]
            })
          ])
        })
      );
    });
  });
});