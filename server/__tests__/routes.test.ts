/**
 * Тесты для API маршрутов
 */
import supertest from 'supertest';
import { app } from '../app';
import { telegramService } from '../services/social/telegram-service';

// Мокаем модули и функции, которые будут использоваться в тестах
jest.mock('../services/social/telegram-service', () => ({
  telegramService: {
    publishToTelegram: jest.fn(),
    formatTelegramUrl: jest.fn(),
  }
}));

// Инициализируем supertest с нашим приложением
const request = supertest(app);

describe('API Routes', () => {
  // Очищаем моки после каждого теста
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Telegram API endpoints', () => {
    test('should successfully send message to Telegram', async () => {
      // Устанавливаем успешный ответ мока
      const mockResponse = { 
        success: true, 
        messageId: 12345,
        postUrl: 'https://t.me/channel/12345'
      };
      
      (telegramService.publishToTelegram as jest.Mock).mockResolvedValue(mockResponse);
      
      // Выполняем запрос к API
      const response = await request
        .post('/api/test/telegram-post')
        .send({
          text: 'Тестовое сообщение',
          chatId: '-1002302366310',
          token: 'test-token',
          imageUrl: 'https://example.com/image.jpg'
        });
      
      // Проверяем результат
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('postUrl');
      expect(telegramService.publishToTelegram).toHaveBeenCalledTimes(1);
    });
    
    test('should handle error when sending message to Telegram', async () => {
      // Устанавливаем ответ мока с ошибкой
      (telegramService.publishToTelegram as jest.Mock).mockRejectedValue(new Error('Failed to send message'));
      
      // Выполняем запрос к API
      const response = await request
        .post('/api/test/telegram-post')
        .send({
          text: 'Тестовое сообщение',
          chatId: '-1002302366310',
          token: 'test-token'
        });
      
      // Проверяем результат
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();
      expect(telegramService.publishToTelegram).toHaveBeenCalledTimes(1);
    });
    
    test('should return 400 when required parameters are missing', async () => {
      // Выполняем запрос к API без обязательных параметров
      const response = await request
        .post('/api/test/telegram-post')
        .send({
          // Отсутствуют обязательные параметры
        });
      
      // Проверяем результат
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(telegramService.publishToTelegram).not.toHaveBeenCalled();
    });
  });
});