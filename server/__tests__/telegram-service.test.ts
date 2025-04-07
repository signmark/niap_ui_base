/**
 * Тесты для Telegram сервиса
 */
import axios from 'axios';
import { TelegramService } from '../services/social/telegram-service';
import { mockTelegramAPIResponse, generateTestContent, generateSocialSettings } from './test-utils';

// Мокаем axios для имитации API-вызовов
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TelegramService', () => {
  let telegramService: TelegramService;
  
  // Тестовые данные
  const CHAT_ID = '-1002302366310';
  const TELEGRAM_TOKEN = 'test-telegram-token';
  const MESSAGE_ID = 12345;
  
  beforeEach(() => {
    // Создаем новый экземпляр сервиса перед каждым тестом
    telegramService = new TelegramService();
    
    // Очищаем все моки
    jest.clearAllMocks();
  });
  
  describe('formatTelegramUrl', () => {
    test('should format URL for channel with username', () => {
      const chatId = '@test_channel';
      const formattedChatId = 'test_channel';
      const messageId = 12345;
      const chatUsername = 'test_channel';
      
      const url = telegramService.formatTelegramUrl(chatId, formattedChatId, messageId, chatUsername);
      
      expect(url).toBe('https://t.me/test_channel/12345');
    });
    
    test('should format URL for chat with numeric ID', () => {
      const chatId = '-1001234567890';
      const formattedChatId = '1234567890';
      const messageId = 12345;
      
      const url = telegramService.formatTelegramUrl(chatId, formattedChatId, messageId);
      
      // Для числовых ID должен использовать формат c/chatId/messageId
      expect(url).toBe('https://t.me/c/1234567890/12345');
    });
    
    test('should handle missing message ID', () => {
      const chatId = '@test_channel';
      const formattedChatId = 'test_channel';
      
      const url = telegramService.formatTelegramUrl(chatId, formattedChatId);
      
      // Без message ID должен возвращать только ссылку на канал
      expect(url).toBe('https://t.me/test_channel');
    });
  });
  
  describe('publishToTelegram', () => {
    test('should successfully publish text and single image to Telegram', async () => {
      // Настраиваем мок axios для имитации успешного ответа от Telegram API
      mockedAxios.post.mockResolvedValueOnce({ data: mockTelegramAPIResponse(MESSAGE_ID) });
      
      // Создаем тестовый контент с одним изображением
      const content = generateTestContent({
        text: 'Тестовый текст с <b>форматированием</b>',
        image_url: 'https://example.com/test-image.jpg',
        additional_images: []
      });
      
      // Создаем тестовые настройки
      const settings = generateSocialSettings({
        telegram: { token: TELEGRAM_TOKEN, chatId: CHAT_ID }
      });
      
      // Выполняем публикацию
      const result = await telegramService.publishToTelegram(content, settings.telegram);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      expect(result.postId).toBe(MESSAGE_ID.toString());
      expect(result.postUrl).toContain('/12345');
      
      // Проверяем, что был вызван правильный эндпоинт Telegram API с правильными параметрами
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post.mock.calls[0][0]).toContain('sendPhoto');
      expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty('photo');
      expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty('caption');
      expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty('parse_mode', 'HTML');
    });
    
    test('should successfully publish text and multiple images to Telegram', async () => {
      // Настраиваем мок axios для имитации успешного ответа от Telegram API
      mockedAxios.post.mockResolvedValueOnce({ data: mockTelegramAPIResponse(MESSAGE_ID) });
      
      // Создаем тестовый контент с несколькими изображениями
      const content = generateTestContent({
        text: 'Тестовый текст с <b>форматированием</b>',
        image_url: 'https://example.com/test-image.jpg',
        additional_images: [
          'https://example.com/additional-image-1.jpg', 
          'https://example.com/additional-image-2.jpg'
        ]
      });
      
      // Создаем тестовые настройки
      const settings = generateSocialSettings({
        telegram: { token: TELEGRAM_TOKEN, chatId: CHAT_ID }
      });
      
      // Выполняем публикацию
      const result = await telegramService.publishToTelegram(content, settings.telegram);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      expect(result.postId).toBe(MESSAGE_ID.toString());
      expect(result.postUrl).toContain('/12345');
      
      // Проверяем, что был вызван правильный эндпоинт Telegram API с правильными параметрами
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post.mock.calls[0][0]).toContain('sendMediaGroup');
      expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty('media');
      expect(mockedAxios.post.mock.calls[0][1].media).toHaveLength(3); // 1 основное + 2 дополнительных
    });
    
    test('should successfully publish text only to Telegram', async () => {
      // Настраиваем мок axios для имитации успешного ответа от Telegram API
      mockedAxios.post.mockResolvedValueOnce({ data: mockTelegramAPIResponse(MESSAGE_ID) });
      
      // Создаем тестовый контент только с текстом
      const content = generateTestContent({
        text: 'Тестовый текст без изображений',
        image_url: '',
        additional_images: []
      });
      
      // Создаем тестовые настройки
      const settings = generateSocialSettings({
        telegram: { token: TELEGRAM_TOKEN, chatId: CHAT_ID }
      });
      
      // Выполняем публикацию
      const result = await telegramService.publishToTelegram(content, settings.telegram);
      
      // Проверяем результат
      expect(result.success).toBe(true);
      expect(result.postId).toBe(MESSAGE_ID.toString());
      expect(result.postUrl).toContain('/12345');
      
      // Проверяем, что был вызван правильный эндпоинт Telegram API с правильными параметрами
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post.mock.calls[0][0]).toContain('sendMessage');
      expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty('text');
      expect(mockedAxios.post.mock.calls[0][1]).toHaveProperty('parse_mode', 'HTML');
    });
    
    test('should handle error from Telegram API', async () => {
      // Настраиваем мок axios для имитации ошибки от Telegram API
      mockedAxios.post.mockRejectedValueOnce(new Error('Telegram API error'));
      
      // Создаем тестовый контент
      const content = generateTestContent();
      
      // Создаем тестовые настройки
      const settings = generateSocialSettings({
        telegram: { token: TELEGRAM_TOKEN, chatId: CHAT_ID }
      });
      
      // Выполняем публикацию и ожидаем ошибку
      await expect(telegramService.publishToTelegram(content, settings.telegram))
        .rejects.toThrow();
      
      // Проверяем, что был вызван API
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });
});