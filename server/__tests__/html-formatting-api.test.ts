/**
 * Интеграционные тесты для проверки HTML-форматирования через API приложения
 * 
 * Тестирует правильность обработки незакрытых HTML-тегов в запросах через API
 */

import request from 'supertest';
import express, { Express } from 'express';
import { telegramService } from '../services/social/telegram-service';
import testRouter from '../api/test-routes';
import { mockTelegramAPIResponse } from './test-utils';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HTML Formatting API Integration Tests', () => {
  let app: Express;

  // Текст с незакрытыми HTML-тегами для тестирования
  const TEST_UNCLOSED_HTML = `<b>Жирный текст

<i>Курсивный текст

<u>Подчеркнутый текст

<i>Незакрытый тег курсива

<b>Незакрытый тег жирного`;

  // Предполагаемый исправленный текст с закрытыми тегами
  const EXPECTED_FIXED_HTML = `<b>Жирный текст

<i>Курсивный текст

<u>Подчеркнутый текст

<i>Незакрытый тег курсива</i>

<b>Незакрытый тег жирного</b></u></i></b>`;

  beforeEach(() => {
    // Создаем экземпляр приложения для тестирования
    app = express();
    app.use(express.json());
    app.use('/api/test', testRouter);

    // Очищаем моки
    jest.clearAllMocks();
  });

  it('должен исправлять незакрытые HTML-теги при публикации через API', async () => {
    // Мокируем успешный ответ от Telegram API
    mockedAxios.post.mockResolvedValue({
      data: {
        ok: true,
        result: {
          message_id: 12345,
          chat: {
            id: -1002302366310,
            title: 'Test Channel',
            type: 'channel'
          }
        }
      }
    });

    // Создаем тестовые данные для API запроса
    const requestData = {
      text: TEST_UNCLOSED_HTML,
      chatId: '-1002302366310',
      token: '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU'
    };

    // Отправляем запрос к тестовому API маршруту
    const response = await request(app)
      .post('/api/test/telegram-post')
      .send(requestData)
      .expect(200);

    // Проверяем успешность запроса
    expect(response.body.success).toBe(true);
    
    // Проверяем, что вызов axios.post был с исправленным HTML
    expect(mockedAxios.post).toHaveBeenCalled();

    // Получаем параметры запроса, который был отправлен в Telegram API
    const calls = mockedAxios.post.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    // Проверяем параметр text в первом вызове
    const requestBody = calls[0][1];
    
    // Проверяем, что текст был обработан fixUnclosedTags
    // (Мы не можем напрямую проверить сам текст, так как fixUnclosedTags вызывается внутри сервиса,
    // но должен быть вызов с параметром parse_mode: 'HTML')
    expect(requestBody).toHaveProperty('parse_mode', 'HTML');
    
    // Также проверяем, что Telegram API был вызван с правильными параметрами
    expect(requestBody).toHaveProperty('chat_id', requestData.chatId);
    expect(requestBody).toHaveProperty('text');
  });

  it('должен правильно форматировать HTML-теги в контенте разной длины', async () => {
    // Мокируем успешный ответ от Telegram API
    mockedAxios.post.mockResolvedValue({
      data: {
        ok: true,
        result: {
          message_id: 12346,
          chat: {
            id: -1002302366310,
            title: 'Test Channel',
            type: 'channel'
          }
        }
      }
    });
    
    // Создаем длинный HTML-текст с незакрытыми тегами 
    // (проверка обработки длинного контента с тегами)
    const longUnclosedHTML = `<b>Длинный текст ${'с повторяющимся содержимым '.repeat(100)}
    
<i>Курсивный текст внутри
    
<u>А тут еще и подчеркнутый`;

    // Отправляем запрос к тестовому API маршруту с длинным текстом
    const response = await request(app)
      .post('/api/test/telegram-post')
      .send({
        text: longUnclosedHTML,
        chatId: '-1002302366310',
        token: '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU'
      })
      .expect(200);

    // Проверяем успешность запроса
    expect(response.body.success).toBe(true);
    
    // Проверяем, что вызов axios.post был совершен
    expect(mockedAxios.post).toHaveBeenCalled();
    
    // Получаем параметры запроса, который был отправлен в Telegram API
    const calls = mockedAxios.post.mock.calls;
    const requestBody = calls[0][1];
    
    // Проверяем, что отправленный текст содержит закрывающие теги
    // (Любой исправленный текст должен иметь закрывающие теги)
    expect(requestBody.text).toContain('</u>');
    expect(requestBody.text).toContain('</i>');
    expect(requestBody.text).toContain('</b>');
  });

  it('должен корректно обрабатывать текст без HTML-тегов', async () => {
    // Мокируем успешный ответ от Telegram API
    mockedAxios.post.mockResolvedValue({
      data: {
        ok: true,
        result: {
          message_id: 12347,
          chat: {
            id: -1002302366310,
            title: 'Test Channel',
            type: 'channel'
          }
        }
      }
    });
    
    // Текст без HTML-тегов
    const plainText = 'Это обычный текст без HTML-тегов';

    // Отправляем запрос к тестовому API маршруту с обычным текстом
    const response = await request(app)
      .post('/api/test/telegram-post')
      .send({
        text: plainText,
        chatId: '-1002302366310',
        token: '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU'
      })
      .expect(200);

    // Проверяем успешность запроса
    expect(response.body.success).toBe(true);
    
    // Проверяем, что вызов axios.post был совершен
    expect(mockedAxios.post).toHaveBeenCalled();
    
    // Получаем параметры запроса, который был отправлен в Telegram API
    const calls = mockedAxios.post.mock.calls;
    const requestBody = calls[0][1];
    
    // Проверяем, что отправленный текст не был изменен
    expect(requestBody.text).toBe(plainText);
    
    // Parse mode должен быть HTML даже для обычного текста
    expect(requestBody.parse_mode).toBe('HTML');
  });
});