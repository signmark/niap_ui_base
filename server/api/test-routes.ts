/**
 * Тестовые маршруты API
 * Используются для тестирования различных функций без изменения основного кода
 */
import express, { Request, Response } from 'express';
import { telegramService } from '../services/social/telegram-service';
import { instagramService } from '../services/social/instagram-service';
import { socialPublishingService } from '../services/social/index';
import { storage } from '../storage';
import { log } from '../utils/logger';
import axios from 'axios';

// Создаем роутер для тестовых маршрутов
const testRouter = express.Router();

// Middleware для обработки GET запросов к маршрутам -post
testRouter.get('/instagram-post', (req: Request, res: Response) => {
  // Устанавливаем заголовки для предотвращения кэширования и указания типа контента
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  return res.status(400).json({
    success: false,
    error: 'Этот маршрут требует POST-запрос с данными',
    method: 'POST',
    requiredParams: ['text', 'token', 'businessAccountId', 'imageUrl'],
    example: {
      text: "Тестовый пост для Instagram",
      token: "EAA...",
      businessAccountId: "17841422577074562",
      imageUrl: "https://i.imgur.com/example.jpg"
    }
  });
});

/**
 * Тестовый маршрут для проверки форматирования текста для Telegram
 * POST /api/test/format-telegram
 */
testRouter.post('/format-telegram', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    // Проверяем наличие обязательного параметра
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Обязательный параметр: text'
      });
    }
    
    console.log(`[Test API] Запрос на форматирование текста для Telegram`);
    console.log(`[Test API] Исходный текст: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    
    // Используем функцию из сервиса для форматирования текста
    let formattedText = telegramService.formatTextForTelegram(text);
    
    // Применяем агрессивный исправитель тегов для закрытия всех тегов
    formattedText = telegramService.aggressiveTagFixer(formattedText);
    
    console.log(`[Test API] Отформатированный текст: ${formattedText.substring(0, 100)}${formattedText.length > 100 ? '...' : ''}`);
    
    // Возвращаем результат
    return res.json({
      success: true,
      originalText: text,
      formattedText: formattedText,
      containsHtml: formattedText.includes('<') && formattedText.includes('>')
    });
  } catch (error: any) {
    console.error('Ошибка при форматировании текста для Telegram:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Обработчик GET запросов для тестового маршрута Telegram
 * GET /api/test/telegram-post
 */
testRouter.get('/telegram-post', (req: Request, res: Response) => {
  // Устанавливаем заголовки для предотвращения кэширования и указания типа контента
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  return res.status(400).json({
    success: false,
    error: 'Этот маршрут требует POST-запрос с данными',
    method: 'POST',
    requiredParams: ['text', 'chatId', 'token'],
    example: {
      text: "Тестовое сообщение для Telegram",
      chatId: "-1002302366310", 
      token: "7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU"
    }
  });
});

/**
 * Тестовый маршрут для проверки отправки сообщений в Telegram
 * POST /api/test/telegram-post
 */
testRouter.post('/telegram-post', async (req: Request, res: Response) => {
  try {
    const { text, chatId, token, imageUrl, additionalImages } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!text || !chatId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные параметры: text, chatId и token'
      });
    }
    
    // Формируем тестовый контент в соответствии с ожидаемой структурой для publishToTelegram
    const testContent = {
      id: 'test-id',
      title: 'Тестовый заголовок',
      content: text, // Используем content вместо text
      contentType: 'text',
      imageUrl: imageUrl || '',
      additionalImages: additionalImages || [],
      status: 'draft',
      userId: 'test-user',
      campaignId: 'test-campaign',
      socialPlatforms: ['telegram'],
      createdAt: new Date(),
      hashtags: [],
      links: [],
      metadata: {}
    };
    
    // Отправляем тестовое сообщение в Telegram
    const result = await telegramService.publishContent(testContent, {
      telegram: {
        token,
        chatId
      }
    });
    
    // Логируем результат для отладки
    console.log(`[Test API] Результат отправки в Telegram: ${JSON.stringify(result)}`);
    
    // Возвращаем обработанный результат
    return res.json({
      success: true,
      messageId: result.messageId,
      postUrl: result.postUrl,
      platform: result.platform,
      status: result.status,
      data: result
    });
  } catch (error: any) {
    console.error('Ошибка при отправке сообщения в Telegram:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для проверки обработки пустого messageId
 * POST /api/test/telegram-post-empty-msgid
 */
testRouter.post('/telegram-post-empty-msgid', async (req: Request, res: Response) => {
  try {
    const { text, chatId, token, messageId } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!chatId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные параметры: chatId и token'
      });
    }
    
    console.log(`[Test API] Тест формирования URL с пустым messageId: "${messageId}"`);
    
    // Получаем информацию о чате для определения username
    const chatInfo = await telegramService.getChatInfo(chatId, token);
    console.log(`[Test API] Получена информация о чате:`, chatInfo);
    
    // Форматируем chatId для API
    let formattedChatId = chatId;
    if (!chatId.startsWith('@') && !chatId.startsWith('-') && !isNaN(Number(chatId))) {
      formattedChatId = `-100${chatId}`;
    }
    
    // Вызываем функцию formatTelegramUrl
    const url = telegramService.formatTelegramUrl(
      chatId, 
      formattedChatId, 
      messageId, // Передаем messageId как есть, даже если пустая строка
      chatInfo?.username
    );
    
    // Возвращаем результат
    return res.json({
      success: true,
      postUrl: url,
      formattedChatId,
      originalChatId: chatId,
      messageId: messageId || null,
      chatUsername: chatInfo?.username || null
    });
  } catch (error: any) {
    console.error('[Test API] Ошибка при тестировании формирования URL с пустым messageId:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для проверки форматирования URL Telegram
 * GET /api/test/telegram-url
 */
testRouter.get('/telegram-url', (req: Request, res: Response) => {
  try {
    const { chatId, messageId, chatUsername } = req.query;
    
    // Проверяем наличие обязательных параметров
    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: 'Обязательный параметр: chatId'
      });
    }
    
    // Форматируем chatId для API
    let formattedChatId = chatId as string;
    if (formattedChatId.startsWith('@')) {
      formattedChatId = formattedChatId.substring(1);
    } else if (formattedChatId.startsWith('-100')) {
      formattedChatId = formattedChatId.substring(4);
    }
    
    // Форматируем URL
    const url = telegramService.formatTelegramUrl(
      chatId as string,
      formattedChatId,
      messageId ? Number(messageId) : undefined,
      chatUsername as string | undefined
    );
    
    // Возвращаем результат
    return res.json({
      success: true,
      data: {
        url,
        originalChatId: chatId,
        formattedChatId,
        messageId: messageId || null,
        chatUsername: chatUsername || null
      }
    });
  } catch (error: any) {
    console.error('Ошибка при форматировании URL Telegram:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для проверки исправления незакрытых HTML-тегов
 * POST /api/test/fix-html-tags
 */
testRouter.post('/fix-html-tags', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Обязательный параметр: text'
      });
    }
    
    console.log(`[Test API] Запрос на исправление HTML-тегов`);
    console.log(`[Test API] Исходный текст: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    
    // Используем функцию из сервиса для исправления тегов
    // Создаем временный экземпляр TelegramService для доступа к приватным методам
    const tempTelegramService = telegramService;
    
    // Применяем метод исправления тегов
    const fixedWithBasic = tempTelegramService.fixUnclosedTags(text);
    
    // Форматируем текст для Telegram через публичный API метод
    const formattedText = tempTelegramService.formatTextForTelegram(text);
    
    // Возвращаем результаты обработки
    return res.json({
      success: true,
      originalText: text,
      fixedWithBasic,
      formattedText,
      comparison: {
        originalLength: text.length,
        basicFixLength: fixedWithBasic.length,
        formattedTextLength: formattedText.length
      }
    });
  } catch (error: any) {
    console.error('[Test API] Ошибка при исправлении HTML-тегов:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для проверки HTML-форматирования с использованием настроек кампании
 * POST /api/test/telegram-html
 */
testRouter.post('/telegram-html', async (req: Request, res: Response) => {
  // Устанавливаем правильный Content-Type для ответа
  res.setHeader('Content-Type', 'application/json');
  try {
    const { text, campaignId } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!text || !campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные параметры: text и campaignId'
      });
    }
    
    console.log(`[Test API] Запрос на тестирование HTML-форматирования для кампании ${campaignId}`);
    
    // Получаем настройки кампании и токен администратора
    
    // Получаем токен администратора
    const adminToken = await storage.getAdminToken();
    console.log(`[Test API] Токен администратора: ${adminToken ? 'получен' : 'не получен'}`);
    
    const campaign = await storage.getCampaignById(campaignId);
    
    if (!campaign || !campaign.settings) {
      return res.status(404).json({
        success: false,
        error: 'Кампания не найдена или не имеет настроек'
      });
    }
    
    console.log(`[Test API] Получены настройки кампании: ${JSON.stringify(campaign.settings)}`);
    
    // Проверяем настройки Telegram
    if (!campaign.settings.telegram || !campaign.settings.telegram.token || !campaign.settings.telegram.chatId) {
      return res.status(400).json({
        success: false,
        error: 'В настройках кампании отсутствуют настройки Telegram'
      });
    }
    
    // Формируем тестовый контент
    const testContent = {
      id: `test-${Date.now()}`,
      title: 'Тест HTML-форматирования',
      content: text,
      contentType: 'text',
      imageUrl: '',
      additionalImages: [],
      status: 'draft',
      userId: 'test-user',
      campaignId: campaignId,
      socialPlatforms: ['telegram'],
      createdAt: new Date(),
      hashtags: [],
      links: [],
      metadata: {}
    };
    
    // Отправляем тестовое сообщение в Telegram с настройками из кампании
    const result = await telegramService.publishContent(testContent, {
      telegram: {
        token: campaign.settings.telegram.token,
        chatId: campaign.settings.telegram.chatId
      }
    });
    
    // Логируем результат для отладки
    console.log(`[Test API] Результат отправки HTML-сообщения: ${JSON.stringify(result)}`);
    
    // Возвращаем результат
    return res.json({
      success: true,
      postUrl: result.postUrl,
      platform: result.platform,
      status: result.status,
      data: result
    });
  } catch (error: any) {
    console.error('[Test API] Ошибка при тестировании HTML-форматирования:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для проверки форматирования HTML для Telegram на стороне клиента
 * POST /api/test/format-client-html
 * 
 * Пример использования:
 * POST /api/test/format-client-html
 * Body: {"html": "<p>Тестовый <strong>жирный</strong> текст с <em>курсивом</em> и эмодзи 🎉</p>"}
 */
testRouter.post('/format-client-html', async (req: Request, res: Response) => {
  try {
    const { html } = req.body;
    
    // Проверяем наличие обязательного параметра
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'Обязательный параметр: html'
      });
    }
    
    log(`[Test API] Запрос на проверку форматирования HTML для Telegram на стороне клиента`, 'test');
    log(`[Test API] Исходный HTML: ${html.substring(0, 100)}${html.length > 100 ? '...' : ''}`, 'test');
    
    // 1. Серверный формат - TelegramService.formatTextForTelegram
    const serverFormatted = telegramService.formatTextForTelegram(html);
    
    // 2. Серверный формат с агрессивным исправлением
    const serverFormattedAggressive = telegramService.aggressiveTagFixer(serverFormatted);
    
    // 3. Клиентский формат (имитация того, что мы делаем в компоненте)
    let clientFormatted = html;
    
    // Заменяем эквивалентные теги на поддерживаемые Telegram форматы
    clientFormatted = clientFormatted
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
      .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
      .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '<s>$1</s>')
      .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '<s>$1</s>');
    
    // Обрабатываем блочные элементы, добавляя переносы строк
    clientFormatted = clientFormatted
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n');
    
    // Обрабатываем списки
    clientFormatted = clientFormatted
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
      .replace(/<(?:ul|ol)[^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi, '$1\n');
    
    // Убираем лишние переносы строк (более 2 подряд)
    clientFormatted = clientFormatted.replace(/\n{3,}/g, '\n\n');
    
    // 4. Серверный формат через агрессивный isSuccess
    const isHtmlValid = telegramService.isValidHtmlForTelegram(html);
    
    // Отладочный вывод
    const debugInfo = {
      originalLength: html.length,
      serverFormattedLength: serverFormatted.length,
      serverFormattedAggressiveLength: serverFormattedAggressive.length,
      clientFormattedLength: clientFormatted.length,
      containsHtmlTags: html.includes('<') && html.includes('>'),
      serverFormattedContainsHtmlTags: serverFormatted.includes('<') && serverFormatted.includes('>'),
      serverFormattedAggressiveContainsHtmlTags: serverFormattedAggressive.includes('<') && serverFormattedAggressive.includes('>'),
      clientFormattedContainsHtmlTags: clientFormatted.includes('<') && clientFormatted.includes('>')
    };
    
    // Анализ проблем
    const problems = [];
    
    // Проверяем незакрытые теги
    const openTagCount = (text: string) => (text.match(/<[^\/][^>]*>/g) || []).length;
    const closeTagCount = (text: string) => (text.match(/<\/[^>]*>/g) || []).length;
    
    const originalOpenTags = openTagCount(html);
    const originalCloseTags = closeTagCount(html);
    
    if (originalOpenTags !== originalCloseTags) {
      problems.push(`Незакрытые теги в исходном HTML: открывающих ${originalOpenTags}, закрывающих ${originalCloseTags}`);
    }
    
    // Возвращаем результат
    return res.json({
      success: true,
      original: html,
      serverFormatted,
      serverFormattedAggressive,
      clientFormatted,
      isHtmlValid,
      debug: debugInfo,
      problems
    });
  } catch (error: any) {
    log(`[Test API] Ошибка при проверке форматирования HTML: ${error.message}`, 'test');
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для тестирования публикации в Instagram через UI
 * POST /api/test/instagram-ui-test
 * 
 * Пример использования:
 * POST /api/test/instagram-ui-test
 * Body: {
 *   "text": "Тестовый пост для Instagram",
 *   "imageUrl": "https://picsum.photos/800/800",
 *   "campaignId": "46868c44-c6a4-4bed-accf-9ad07bba790e"
 * }
 */
testRouter.post('/instagram-ui-test', async (req: Request, res: Response) => {
  try {
    const { text, imageUrl, campaignId } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!text || !imageUrl || !campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные параметры: text, imageUrl и campaignId'
      });
    }
    
    log(`[Instagram UI Test API] Запрос на публикацию в Instagram через UI`, 'test');
    log(`[Instagram UI Test API] Текст (начало): ${text?.substring(0, 50)}...`, 'test');
    log(`[Instagram UI Test API] Campaign ID: ${campaignId}`, 'test');
    log(`[Instagram UI Test API] Image URL: ${imageUrl?.substring(0, 30)}...`, 'test');
    
    // Получаем настройки кампании и токен администратора
    const adminToken = await storage.getAdminToken();
    log(`[Instagram UI Test API] Токен администратора: ${adminToken ? 'получен' : 'не получен'}`, 'test');
    
    const campaign = await storage.getCampaignById(campaignId);
    
    if (!campaign || !campaign.settings) {
      return res.status(404).json({
        success: false,
        error: 'Кампания не найдена или не имеет настроек'
      });
    }
    
    log(`[Instagram UI Test API] Получены настройки кампании: ${JSON.stringify(campaign.settings)}`, 'test');
    
    // Проверяем настройки Instagram
    if (!campaign.settings.instagram || !campaign.settings.instagram.token || !campaign.settings.instagram.businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'В настройках кампании отсутствуют настройки Instagram'
      });
    }
    
    // Создаем уникальный ID для контента
    const contentId = `instagram-ui-test-${Date.now()}`;
    
    // Создаем тестовый контент с обязательными полями
    const testContent = {
      id: contentId,
      userId: 'test-user',
      campaignId: campaignId,
      title: 'Instagram UI Test',
      content: text,
      contentType: 'image',
      imageUrl: imageUrl,
      additionalImages: [],
      status: 'draft',
      socialPlatforms: ['instagram'],
      createdAt: new Date(),
      publishedAt: null,
      scheduledAt: null,
      hashtags: [],
      links: [],
      videoUrl: null,
      prompt: null,
      keywords: [],
      metadata: {}
    };
    
    // Используем socialPublishingService для симуляции вызова из UI
    const result = await socialPublishingService.publishToPlatform(
      testContent, 
      'instagram', 
      campaign.settings
    );
    
    // Возвращаем результат
    return res.json({
      success: result.status === 'published',
      platform: 'instagram',
      status: result.status,
      postUrl: result.postUrl || null,
      error: result.error || null,
      contentId: contentId,
      result
    });
  } catch (error: any) {
    log(`[Instagram UI Test API] Ошибка: ${error.message}`, 'test');
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для прямой отправки HTML и эмодзи в Telegram
 * POST /api/test/telegram-emoji-html
 * 
 * Пример использования:
 * POST /api/test/telegram-emoji-html
 * Body: {
 *   "text": "<b>Жирный текст</b>, <i>курсив</i> и эмодзи 🎉",
 *   "campaignId": "46868c44-c6a4-4bed-accf-9ad07bba790e"
 * }
 */
testRouter.post('/telegram-emoji-html', async (req: Request, res: Response) => {
  try {
    const { text, campaignId } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!text || !campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Обязательные параметры: text и campaignId'
      });
    }
    
    log(`[Test API] Запрос на отправку HTML и эмодзи в Telegram`, 'test');
    log(`[Test API] Текст: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`, 'test');
    
    // Получаем настройки кампании с дополнительной отладкой
    // Используем глобальный экземпляр storage с явной авторизацией
    
    // Сначала получаем админский токен для авторизации
    const adminToken = await storage.getAdminToken();
    console.log(`[Test API] Админский токен получен: ${adminToken ? 'да' : 'нет'}`);
    
    // Затем получаем кампанию
    console.log(`[Test API] Запрашиваем кампанию ${campaignId}`);
    const campaign = await storage.getCampaignById(campaignId);
    
    console.log(`[Test API] Получены данные кампании: ${JSON.stringify(campaign)}`);
    
    // Если кампания не получена, пробуем получить из логов (для отладки)
    if (!campaign) {
      console.log(`[Test API] Не удалось получить кампанию, используем тестовые данные`);
      
      // Создаем тестовые настройки для Telegram (для тестирования)
      return res.status(500).json({
        success: false,
        error: `Не удалось получить настройки кампании. ID: ${campaignId}`,
        adminToken: adminToken ? 'Токен получен' : 'Токен не получен'
      });
    }
    
    if (!campaign || !campaign.settings || !campaign.settings.telegram) {
      return res.status(404).json({
        success: false,
        error: 'Кампания не найдена или не имеет настроек Telegram'
      });
    }
    
    const { token, chatId } = campaign.settings.telegram;
    
    if (!token || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'В настройках кампании отсутствуют token или chatId для Telegram'
      });
    }
    
    // Подготавливаем сообщение с использованием улучшенного клиентского форматирования
    let formattedHtml = text;
    
    // 1. Обработка ссылок - сначала обрабатываем их, чтобы сохранить href атрибуты
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    formattedHtml = formattedHtml.replace(linkRegex, (match: string, url: string, text: string) => {
      return `<a href="${url}">${text}</a>`;
    });
    
    // 2. Заменяем эквивалентные теги на поддерживаемые Telegram форматы
    formattedHtml = formattedHtml
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '<b>$1</b>')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '<i>$1</i>')
      .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
      .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>')
      .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '<s>$1</s>')
      .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '<s>$1</s>')
      .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '<s>$1</s>');
    
    // 3. Обрабатываем блочные элементы, добавляя переносы строк
    formattedHtml = formattedHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n');
    
    // 4. Обрабатываем списки
    formattedHtml = formattedHtml
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
      .replace(/<(?:ul|ol)[^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi, '$1\n');
    
    // 5. Удаляем все оставшиеся HTML-теги, которые не поддерживаются Telegram
    const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
    const tagRegex = new RegExp(`<(?!\/?(?:${supportedTags.join('|')})(?:\\s|>))[^>]*>`, 'gi');
    formattedHtml = formattedHtml.replace(tagRegex, '');
    
    // 6. Проверяем баланс открывающих и закрывающих тегов
    const fixUnclosedTags = (html: string): string => {
      let result = html;
      
      // Простая проверка на балансировку тегов
      supportedTags.forEach(tag => {
        const openingTags = (result.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`,'gi')) || []).length;
        const closingTags = (result.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
        
        // Если открывающих тегов больше, добавляем закрывающие
        if (openingTags > closingTags) {
          const diff = openingTags - closingTags;
          result += `${Array(diff).fill(`</${tag}>`).join('')}`;
        }
      });
      
      return result;
    };
    
    formattedHtml = fixUnclosedTags(formattedHtml);
    
    // 7. Убираем лишние переносы строк (более 2 подряд)
    formattedHtml = formattedHtml.replace(/\n{3,}/g, '\n\n');
    
    // Отправляем текст в Telegram
    const messageBody = {
      chat_id: chatId,
      text: formattedHtml,
      parse_mode: 'HTML',
      protect_content: false,
      disable_notification: false
    };
    
    // Отправляем запрос в API Telegram
    const baseUrl = `https://api.telegram.org/bot${token}`;
    const response = await axios.post(`${baseUrl}/sendMessage`, messageBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true
    });
    
    // Проверяем результат
    if (response.status === 200 && response.data && response.data.ok) {
      log(`[Test API] Сообщение успешно отправлено в Telegram, message_id: ${response.data?.result?.message_id}`, 'test');
      
      // Формируем URL сообщения
      let messageUrl = '';
      let formattedChatId = chatId;
      
      // Форматируем chatId для URL
      if (formattedChatId.startsWith('@')) {
        formattedChatId = formattedChatId.substring(1);
        messageUrl = `https://t.me/${formattedChatId}/${response.data?.result?.message_id}`;
      } else if (formattedChatId.startsWith('-100')) {
        formattedChatId = formattedChatId.substring(4);
        messageUrl = `https://t.me/c/${formattedChatId}/${response.data?.result?.message_id}`;
      } else {
        messageUrl = `https://t.me/c/${formattedChatId}/${response.data?.result?.message_id}`;
      }
      
      return res.json({
        success: true,
        message_id: response.data?.result?.message_id,
        message_url: messageUrl,
        original_text: text,
        formatted_text: formattedHtml
      });
    } else {
      log(`[Test API] Ошибка при отправке сообщения в Telegram: ${JSON.stringify(response.data)}`, 'test');
      
      // В случае ошибки пробуем отправить обычный текст без HTML
      if (formattedHtml.includes('<') && formattedHtml.includes('>')) {
        log(`[Test API] Пробуем отправить обычный текст без HTML-форматирования`, 'test');
        
        const plainText = text.replace(/<[^>]*>/g, '');
        const plainMessageBody = {
          chat_id: chatId,
          text: plainText,
          disable_notification: false
        };
        
        const plainResponse = await axios.post(`${baseUrl}/sendMessage`, plainMessageBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
          validateStatus: () => true
        });
        
        if (plainResponse.status === 200 && plainResponse.data && plainResponse.data.ok) {
          log(`[Test API] Сообщение успешно отправлено без HTML-форматирования, message_id: ${plainResponse.data?.result?.message_id}`, 'test');
          
          return res.json({
            success: true,
            message_id: plainResponse.data?.result?.message_id,
            original_text: text,
            formatted_text: plainText,
            note: 'Отправлено без HTML-форматирования из-за ошибки',
            error: response.data?.description || 'Ошибка при отправке HTML',
            html_error: true
          });
        }
      }
      
      return res.status(500).json({
        success: false,
        error: response.data?.description || 'Ошибка при отправке сообщения',
        original_text: text,
        formatted_text: formattedHtml
      });
    }
  } catch (error: any) {
    log(`[Test API] Исключение при отправке сообщения в Telegram: ${error.message}`, 'test');
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Тестовый маршрут для публикации в Instagram
 * POST /api/test/instagram-post
 * 
 * Используется для прямого тестирования публикации в Instagram без авторизации
 */
testRouter.post('/instagram-post', async (req: Request, res: Response) => {
  // Явно устанавливаем тип контента как JSON и добавляем предотвращение кэширования
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.removeHeader('X-Powered-By');
  
  try {
    // Обработка параметров
    let text = '';
    let token = '';
    let businessAccountId = '';
    let imageUrl = '';
    
    // Проверяем, пришел ли запрос как JSON или как form-data
    if (req.headers['content-type']?.includes('application/json')) {
      // JSON запрос
      text = req.body.text || '';
      token = req.body.token || '';
      businessAccountId = req.body.businessAccountId || '';
      imageUrl = req.body.imageUrl || '';
    } else {
      // Form-data запрос
      text = req.body.text || '';
      token = req.body.token || '';
      businessAccountId = req.body.businessAccountId || '';
      imageUrl = req.body.imageUrl || '';
    }
    
    // Проверяем обязательные параметры
    if (!text || !token || !businessAccountId || !imageUrl) {
      // Создаем объект ошибки
      const errorResponse = {
        success: false,
        error: 'Обязательные параметры: text, token, businessAccountId и imageUrl',
        receivedParams: {
          text: !!text,
          token: !!token,
          businessAccountId: !!businessAccountId,
          imageUrl: !!imageUrl
        }
      };
      
      // Отправляем JSON-ответ
      return res.status(400).end(JSON.stringify(errorResponse));
    }
    
    // Логируем входные данные (без токенов)
    log(`[Instagram Test API] Запрос на публикацию в Instagram`, 'test');
    log(`[Instagram Test API] Текст (начало): ${text?.substring(0, 50)}...`, 'test');
    log(`[Instagram Test API] Business Account ID: ${businessAccountId}`, 'test');
    log(`[Instagram Test API] Image URL: ${imageUrl?.substring(0, 30)}...`, 'test');
    
    // Создаем тестовый контент с обязательными полями
    const testContent = {
      id: 'instagram-test-' + Date.now(),
      userId: 'test-user',
      campaignId: 'test-campaign',
      title: 'Instagram Test',
      content: text,
      contentType: 'image',
      imageUrl: imageUrl,
      additionalImages: [],
      status: 'draft',
      socialPlatforms: ['instagram'],
      createdAt: new Date(),
      publishedAt: null,
      scheduledAt: null,
      hashtags: [],
      links: [],
      videoUrl: null,
      prompt: null,
      keywords: [],
      metadata: {}
    };
    
    // Создаем настройки Instagram
    const instagramSettings = {
      token,
      accessToken: null,
      businessAccountId
    };
    
    // Публикуем с использованием сервиса Instagram
    log(`[Instagram Test API] Отправка запроса в Instagram API`, 'test');
    const result = await instagramService.publishToInstagram(testContent, instagramSettings);
    
    // Возвращаем результат
    return res.json({
      success: result.status === 'published',
      platform: 'instagram',
      status: result.status,
      postUrl: result.postUrl || null,
      error: result.error || null,
      result
    });
  } catch (error: any) {
    // Логируем ошибку
    log(`[Instagram Test API] Ошибка при публикации: ${error.message}`, 'test');
    if (error.response) {
      log(`[Instagram Test API] Ответ API: ${JSON.stringify(error.response.data)}`, 'test');
    }
    
    // Убедимся, что отправляем JSON и устанавливаем корректный код ошибки
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || null
    });
  }
});

export default testRouter;