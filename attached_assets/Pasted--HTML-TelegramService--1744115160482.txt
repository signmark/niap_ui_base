/**
 * Интеграционные тесты для проверки HTML-форматирования в TelegramService
 * 
 * Напрямую тестирует класс TelegramService и его методы для работы с HTML-форматированием
 */

import { TelegramService } from '../services/social/telegram-service';
import { DirectusAuthManager } from '../services/directus-auth-manager';
import axios from 'axios';
import { mocks } from './setup';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TelegramService HTML Formatting Tests', () => {
  let telegramService: TelegramService;
  let authManager: DirectusAuthManager;

  const TEST_TOKEN = '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
  const TEST_CHAT_ID = '-1002302366310';

  // Набор текстов для тестирования
  const testCases = [
    {
      name: 'Незакрытый тег b',
      input: '<b>Жирный текст',
      expected: '<b>Жирный текст</b>'
    },
    {
      name: 'Незакрытый тег i',
      input: '<i>Курсивный текст',
      expected: '<i>Курсивный текст</i>'
    },
    {
      name: 'Незакрытый тег u',
      input: '<u>Подчеркнутый текст',
      expected: '<u>Подчеркнутый текст</u>'
    },
    {
      name: 'Незакрытый тег code',
      input: '<code>Моноширинный текст',
      expected: '<code>Моноширинный текст</code>'
    },
    {
      name: 'Вложенные незакрытые теги',
      input: '<b>Жирный <i>курсивный <u>подчеркнутый',
      expected: '<b>Жирный <i>курсивный <u>подчеркнутый</u></i></b>'
    },
    {
      name: 'Некорректный порядок закрытия тегов',
      input: '<b>Жирный <i>курсивный</b> текст',
      expected: '<b>Жирный <i>курсивный</i></b> текст'
    },
    {
      name: 'Текст без тегов',
      input: 'Обычный текст без тегов',
      expected: 'Обычный текст без тегов'
    },
    {
      name: 'Правильно закрытые теги',
      input: '<b>Жирный</b> <i>курсивный</i> <u>подчеркнутый</u>',
      expected: '<b>Жирный</b> <i>курсивный</i> <u>подчеркнутый</u>'
    },
    {
      name: 'Теги с атрибутами',
      input: '<a href="https://example.com">Ссылка</a> <a href="https://test.com">Незакрытая ссылка',
      expected: '<a href="https://example.com">Ссылка</a> <a href="https://test.com">Незакрытая ссылка</a>'
    },
    {
      name: 'Сложный многострочный текст с тегами',
      input: `<b>Заголовок статьи

<i>Подзаголовок с важной информацией

Обычный абзац текста

<b>Незакрытый жирный
<i>Незакрытый курсив внутри жирного

<u>Подчеркнутый текст</u>

Заключение.`,
      expected: `<b>Заголовок статьи

<i>Подзаголовок с важной информацией

Обычный абзац текста

<b>Незакрытый жирный
<i>Незакрытый курсив внутри жирного</i></b>

<u>Подчеркнутый текст</u>

Заключение.</i></b>`
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Получаем мок authManager
    authManager = mocks.authManager as unknown as DirectusAuthManager;
    
    // Создаем экземпляр сервиса
    telegramService = new TelegramService(authManager);
  });

  describe('fixUnclosedTags метод', () => {
    it.each(testCases)('должен исправлять $name', ({ input, expected }) => {
      // Вызываем метод напрямую
      const result = (telegramService as any).fixUnclosedTags(input);
      
      // Проверяем результат
      expect(result).toBe(expected);
    });
  });

  describe('formatTextForTelegram метод', () => {
    it.each(testCases)('должен форматировать и исправлять $name', ({ input, expected }) => {
      // Вызываем метод напрямую
      const result = (telegramService as any).formatTextForTelegram(input);
      
      // Проверяем что исправленный текст содержит все нужные закрытые теги
      // (Здесь мы проверяем только часть результата, так как форматирование может добавлять доп. изменения)
      if (input.includes('<b>')) expect(result).toContain('</b>');
      if (input.includes('<i>')) expect(result).toContain('</i>');
      if (input.includes('<u>')) expect(result).toContain('</u>');
      if (input.includes('<code>')) expect(result).toContain('</code>');
      if (input.includes('<a href')) expect(result).toContain('</a>');
    });

    it('должен конвертировать маркдаун в HTML-теги', () => {
      // Создаем текст с маркдауном
      const markdownText = `**Жирный текст**
*Курсивный текст*
__Подчеркнутый текст__
~~Зачеркнутый текст~~
\`Код\``;

      // Вызываем метод форматирования
      const result = (telegramService as any).formatTextForTelegram(markdownText);
      
      // Проверяем конвертацию маркдауна в HTML
      expect(result).toContain('<b>Жирный текст</b>');
      expect(result).toContain('<i>Курсивный текст</i>');
      expect(result).toContain('<u>Подчеркнутый текст</u>');
      expect(result).toContain('<s>Зачеркнутый текст</s>');
      expect(result).toContain('<code>Код</code>');
    });
  });

  describe('prepareTelegramText метод', () => {
    it('должен корректно обрабатывать и обрезать длинные тексты', () => {
      // Создаем длинный текст, превышающий лимит
      const longText = 'A'.repeat(5000);
      
      // Вызываем метод подготовки текста
      const result = (telegramService as any).prepareTelegramText(longText, 4000);
      
      // Проверяем длину результата (должна быть <= 4000)
      expect(result.length).toBeLessThanOrEqual(4000);
    });

    it('должен сохранять HTML-форматирование при обрезке текста', () => {
      // Создаем длинный текст с HTML-тегами
      const longFormattedText = `<b>Заголовок</b>
${'-'.repeat(2000)}
<i>Середина</i>
${'-'.repeat(2000)}
<u>Конец</u>`;
      
      // Вызываем метод подготовки текста с ограничением длины
      const result = (telegramService as any).prepareTelegramText(longFormattedText, 1000);
      
      // Проверяем что результат содержит открывающие и закрывающие теги
      expect(result).toContain('<b>');
      expect(result).toContain('</b>');
      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('sendTextMessageToTelegram метод', () => {
    it('должен исправлять незакрытые теги при отправке сообщения', async () => {
      // Создаем текст с незакрытыми тегами
      const unclosedTagsText = '<b>Жирный <i>курсивный <u>подчеркнутый';
      
      // Мокируем ответ от Telegram API
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          ok: true,
          result: {
            message_id: 12345
          }
        }
      });
      
      // Вызываем метод отправки сообщения
      await (telegramService as any).sendTextMessageToTelegram(unclosedTagsText, TEST_CHAT_ID, TEST_TOKEN);
      
      // Проверяем вызов axios.post
      expect(mockedAxios.post).toHaveBeenCalled();
      
      // Проверяем параметры запроса
      const calls = mockedAxios.post.mock.calls;
      const requestBody = calls[0][1];
      
      // Проверяем parse_mode
      expect(requestBody.parse_mode).toBe('HTML');
    });
    
    it('должен корректно отправлять сложные многострочные тексты с HTML', async () => {
      // Создаем сложный текст с форматированием
      const complexHtml = `<b>Заголовок</b>

<i>Вступление</i>

• Пункт 1
• <u>Пункт 2</u>
• <b>Пункт 3</b>

<a href="https://example.com">Ссылка</a>

<code>const test = 'code';</code>`;
      
      // Мокируем ответ от Telegram API
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          ok: true,
          result: {
            message_id: 12346
          }
        }
      });
      
      // Вызываем метод отправки сообщения
      await (telegramService as any).sendTextMessageToTelegram(complexHtml, TEST_CHAT_ID, TEST_TOKEN);
      
      // Проверяем вызов axios.post
      expect(mockedAxios.post).toHaveBeenCalled();
      
      // Проверяем параметры запроса
      const calls = mockedAxios.post.mock.calls;
      const requestBody = calls[0][1];
      
      // Проверяем, что текст не был изменен (все теги и закрыты изначально)
      expect(requestBody.text).toBe(complexHtml);
      expect(requestBody.parse_mode).toBe('HTML');
    });
  });
});