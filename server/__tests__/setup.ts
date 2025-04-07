/**
 * Настройка для тестов SMM Manager
 * Этот файл содержит общие настройки и моки для всех тестов
 */

import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs';

// Устанавливаем переменные окружения для тестов
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
process.env.TELEGRAM_CHAT_ID = '-1002302366310';
process.env.VK_API_TOKEN = 'vk1.a.0jlmORGkgmds1qIB5btPIIuT1FZ8C_bkGpCcowI9Ml214neQFgVMiYEnePWq48txdx3D7oTtKbEvgnEifytkkyjv1FvooFsI0y_YYPX8Cw__525Tnqt_H7C9hEEdmsqHXExr4Q3DK7CL0quCvnhrhN368Ter9yFLe6buYgpnamBXwUx4yZnRJPdBVfnPmObtZRrXw7NaZJboCqAK8sXLEA';
process.env.VK_GROUP_ID = 'club228626989';

// Константы для тестов
export const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
export const USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13';

// Исправление для Jest с ESM и TypeScript
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Устанавливаем тайм-аут для всех тестов
jest.setTimeout(30000);

// Мокируем axios
jest.mock('axios');
jest.mock('form-data');

// Настраиваем моки для всех тестов
beforeAll(() => {
  // Переопределяем console.error, чтобы подавить ошибки во время тестов
  const originalConsoleError = console.error;
  global.console.error = function (message: any, ...args: any[]) {
    // Игнорируем ошибки, связанные с axios и моками
    if (message && typeof message === 'string' && 
        (message.includes('axios') || message.includes('mock') || message.includes('test'))) {
      return;
    }
    originalConsoleError(message, ...args);
  };

  // Переопределяем console.warn, чтобы подавить предупреждения во время тестов
  const originalConsoleWarn = console.warn;
  global.console.warn = function (message: any, ...args: any[]) {
    // Игнорируем предупреждения, связанные с тестами
    if (message && typeof message === 'string' && 
        (message.includes('test') || message.includes('mock'))) {
      return;
    }
    originalConsoleWarn(message, ...args);
  };

  // Настраиваем мок для axios
  const mockAxios = axios as jest.Mocked<typeof axios>;
  
  // Мокируем успешные ответы для разных API
  mockAxios.post.mockImplementation((url) => {
    // Мок для Telegram API
    if (url.includes('telegram') || url.includes('sendMessage') || url.includes('sendPhoto') || url.includes('sendMediaGroup')) {
      return Promise.resolve({
        data: {
          ok: true,
          result: {
            message_id: 12345,
            chat: { id: -1002302366310, type: 'channel' },
            date: Math.floor(Date.now() / 1000),
            text: 'Тестовое сообщение'
          }
        }
      });
    }
    
    // Мок для VK API
    if (url.includes('vk.com/method')) {
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
      
      return Promise.resolve({
        data: {
          response: {}
        }
      });
    }
    
    // Мок для Directus API
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
    
    // Общий мок для других запросов
    return Promise.resolve({ data: { success: true } });
  });
  
  // Мокируем GET запросы
  mockAxios.get.mockImplementation((url) => {
    // Мок для Directus API
    if (url.includes('directus') && url.includes('/api/campaigns')) {
      return Promise.resolve({
        data: {
          data: [
            {
              id: CAMPAIGN_ID,
              name: 'Тестовая кампания',
              user_id: USER_ID,
              socialMediaSettings: {
                telegram: {
                  token: process.env.TELEGRAM_BOT_TOKEN,
                  chatId: process.env.TELEGRAM_CHAT_ID
                },
                vk: {
                  token: process.env.VK_API_TOKEN,
                  groupId: process.env.VK_GROUP_ID
                }
              }
            }
          ]
        }
      });
    }
    
    if (url.includes('directus') && url.includes(`/api/campaigns/${CAMPAIGN_ID}`)) {
      return Promise.resolve({
        data: {
          data: {
            id: CAMPAIGN_ID,
            name: 'Тестовая кампания',
            user_id: USER_ID,
            socialMediaSettings: {
              telegram: {
                token: process.env.TELEGRAM_BOT_TOKEN,
                chatId: process.env.TELEGRAM_CHAT_ID
              },
              vk: {
                token: process.env.VK_API_TOKEN,
                groupId: process.env.VK_GROUP_ID
              }
            }
          }
        }
      });
    }
    
    // Общий мок для других запросов
    return Promise.resolve({ data: { success: true } });
  });

  // Настраиваем мок для FormData
  const mockFormData = FormData as jest.MockedClass<typeof FormData>;
  mockFormData.prototype.append = jest.fn();
  mockFormData.prototype.getHeaders = jest.fn(() => ({}));
  mockFormData.prototype.getBoundary = jest.fn(() => 'test-boundary');
  
  // Создаем мок для директории с тестовыми изображениями
  const testImagesDir = path.join(__dirname, '../..', 'test-images');
  if (!fs.existsSync(testImagesDir)) {
    fs.mkdirSync(testImagesDir, { recursive: true });
  }
  
  // Создаем тестовое изображение, если его нет
  const testImagePath = path.join(testImagesDir, 'test-image.jpg');
  if (!fs.existsSync(testImagePath)) {
    // Создаем минимальное JPEG изображение
    const minimalJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00,
      0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0xff, 0xc4, 0x00, 0x14, 0x10,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xd2, 0xcf, 0x20, 0xff, 0xd9
    ]);
    fs.writeFileSync(testImagePath, minimalJpeg);
  }
});

// Очистка после всех тестов
afterAll(() => {
  jest.resetAllMocks();
});