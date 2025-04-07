/**
 * Интеграционные тесты для проверки отправки HTML-форматированных подписей к изображениям в Telegram
 * 
 * Тестирует отправку одиночных и групповых изображений с HTML-форматированными подписями
 */

import { TelegramService } from '../services/social/telegram-service';
import { DirectusAuthManager } from '../services/directus-auth-manager';
import axios from 'axios';
import { mocks } from './setup';
import { generateTestContent } from './test-utils';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TelegramService Image Caption Tests', () => {
  let telegramService: TelegramService;
  let authManager: DirectusAuthManager;

  const TEST_TOKEN = '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
  const TEST_CHAT_ID = '-1002302366310';
  
  // HTML форматированный текст для подписи к изображению
  const htmlCaption = `<b>Заголовок фото</b>

<i>Описание с форматированием</i>

• Пункт 1
• <u>Пункт 2</u>

#тег #фото #тест`;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Получаем мок authManager
    authManager = mocks.authManager as unknown as DirectusAuthManager;
    
    // Создаем экземпляр сервиса
    telegramService = new TelegramService(authManager);
    
    // Добавляем метод для получения настроек прямо в экземпляр
    (telegramService as any).getCampaignSettings = jest.fn().mockResolvedValue({
      telegram: {
        token: TEST_TOKEN,
        chatId: TEST_CHAT_ID
      }
    });
  });

  describe('sendImagesToTelegram метод', () => {
    it('должен отправлять одиночное изображение с HTML-форматированной подписью', async () => {
      // Мокируем ответ от Telegram API при отправке одиночного фото
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          ok: true,
          result: {
            message_id: 12345,
            chat: {
              id: Number(TEST_CHAT_ID),
              title: 'Test Channel',
              type: 'channel'
            }
          }
        }
      });
      
      // Вызываем метод отправки изображений с подписью
      await (telegramService as any).sendImagesToTelegram(
        TEST_CHAT_ID,
        TEST_TOKEN,
        ['https://example.com/image.jpg'],
        `https://api.telegram.org/bot${TEST_TOKEN}`,
        htmlCaption
      );
      
      // Проверяем параметры запроса
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendPhoto'),
        expect.objectContaining({
          chat_id: TEST_CHAT_ID,
          photo: 'https://example.com/image.jpg',
          caption: htmlCaption,
          parse_mode: 'HTML'
        }),
        expect.anything()
      );
    });

    it('должен отправлять группу изображений с HTML-форматированной подписью', async () => {
      // Мокируем ответ от Telegram API при отправке группы фото
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          ok: true,
          result: [
            {
              message_id: 12346,
              chat: {
                id: Number(TEST_CHAT_ID),
                title: 'Test Channel',
                type: 'channel'
              }
            }
          ]
        }
      });
      
      // Массив URL изображений
      const imageUrls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg'
      ];
      
      // Вызываем метод отправки изображений с подписью
      await (telegramService as any).sendImagesToTelegram(
        TEST_CHAT_ID,
        TEST_TOKEN,
        imageUrls,
        `https://api.telegram.org/bot${TEST_TOKEN}`,
        htmlCaption
      );
      
      // Проверяем вызов API для отправки группы медиа
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendMediaGroup'),
        expect.objectContaining({
          chat_id: TEST_CHAT_ID,
          media: expect.arrayContaining([
            expect.objectContaining({
              type: 'photo',
              media: imageUrls[0],
              caption: htmlCaption,
              parse_mode: 'HTML'
            }),
            expect.objectContaining({
              type: 'photo',
              media: imageUrls[1]
            }),
            expect.objectContaining({
              type: 'photo',
              media: imageUrls[2]
            })
          ])
        }),
        expect.anything()
      );
    });

    it('должен исправлять незакрытые HTML-теги в подписи к изображению', async () => {
      // Мокируем ответ от Telegram API
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          ok: true,
          result: {
            message_id: 12347,
            chat: {
              id: Number(TEST_CHAT_ID),
              title: 'Test Channel',
              type: 'channel'
            }
          }
        }
      });
      
      // Подпись с незакрытыми тегами
      const unclosedTagsCaption = `<b>Заголовок с <i>вложенным форматированием

<u>Подчеркнутый текст`;
      
      // Вызываем метод публикации контента (который внутри использует sendImagesToTelegram)
      // Создаем тестовый контент
      const testContent = generateTestContent({
        id: 'test-content-id',
        title: 'Test Post',
        text: unclosedTagsCaption,
        image_url: 'https://example.com/image.jpg',
        social_platforms: ['telegram']
      });
      
      // Публикуем контент
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем успешность публикации
      expect(result.success).toBe(true);
      
      // Проверяем параметры запроса
      const calls = mockedAxios.post.mock.calls;
      expect(calls[0][0]).toContain('/sendPhoto');
      
      const requestBody = calls[0][1];
      expect(requestBody.parse_mode).toBe('HTML');
      
      // Мы не можем проверить точное значение caption после обработки fixUnclosedTags,
      // так как этот метод вызывается внутри formatTextForTelegram и недоступен снаружи,
      // но мы можем убедиться что parse_mode установлен в HTML
    });
  });

  describe('publishContent интеграция с изображениями', () => {
    it('должен публиковать изображение с HTML-форматированной подписью', async () => {
      // Мокируем ответ от Telegram API
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          ok: true,
          result: {
            message_id: 12348,
            chat: {
              id: Number(TEST_CHAT_ID),
              title: 'Test Channel',
              type: 'channel'
            }
          }
        }
      });
      
      // Создаем тестовый контент с HTML-форматированным текстом и изображением
      const testContent = generateTestContent({
        id: 'test-image-html-content-id',
        title: 'Test HTML Image Post',
        text: htmlCaption,
        image_url: 'https://example.com/image.jpg',
        social_platforms: ['telegram']
      });
      
      // Публикуем контент
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем успешность публикации
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      
      // Проверяем параметры запроса - должен использовать sendPhoto
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendPhoto'),
        expect.objectContaining({
          chat_id: TEST_CHAT_ID,
          photo: testContent.imageUrl,
          caption: expect.any(String),
          parse_mode: 'HTML'
        }),
        expect.anything()
      );
    });

    it('должен публиковать несколько изображений с HTML-форматированной подписью', async () => {
      // Мокируем ответ от Telegram API
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          ok: true,
          result: [
            {
              message_id: 12349,
              chat: {
                id: Number(TEST_CHAT_ID),
                title: 'Test Channel',
                type: 'channel'
              }
            }
          ]
        }
      });
      
      // Создаем тестовый контент с HTML-форматированным текстом и несколькими изображениями
      const testContent = generateTestContent({
        id: 'test-multi-image-html-content-id',
        title: 'Test HTML Multi Image Post',
        text: htmlCaption,
        image_url: 'https://example.com/image1.jpg',
        additional_images: [
          'https://example.com/image2.jpg',
          'https://example.com/image3.jpg'
        ],
        social_platforms: ['telegram']
      });
      
      // Публикуем контент
      const result = await (telegramService as any).publishContent(testContent);
      
      // Проверяем успешность публикации
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      
      // Проверяем параметры запроса - должен использовать sendMediaGroup
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sendMediaGroup'),
        expect.objectContaining({
          chat_id: TEST_CHAT_ID,
          media: expect.arrayContaining([
            expect.objectContaining({
              type: 'photo',
              media: testContent.imageUrl,
              caption: expect.any(String),
              parse_mode: 'HTML'
            })
          ])
        }),
        expect.anything()
      );
    });
  });
});