/**
 * Тестовые маршруты для проверки API публикации контента
 * 
 * Этот файл содержит тестовые маршруты для проверки работы API публикации контента
 * в различные социальные сети, включая специальные маршруты для проверки HTML-форматирования
 * в Telegram.
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { telegramService } from '../services/social/telegram-service';
import { CampaignContent } from '../../shared/types';

// Создаем роутер
const router = express.Router();

// Базовый маршрут для проверки работоспособности API
router.get('/', async (req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'API для тестирования доступно',
    timestamp: new Date().toISOString()
  });
});

/**
 * Маршрут для прямой отправки HTML-текста в Telegram
 * 
 * Этот маршрут используется для тестирования метода sendRawHtmlToTelegram
 * и проверки корректного форматирования HTML-текста при отправке в Telegram.
 * 
 * Принимает:
 * - text: HTML-текст для отправки
 * - chatId: ID чата для отправки (опционально, по умолчанию берется из .env)
 */
router.post('/raw-html-telegram', async (req: Request, res: Response) => {
  try {
    const { text, chatId, autoFixHtml = true } = req.body; // Включаем автоисправление по умолчанию
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует текст для отправки (параметр text)'
      });
    }
    
    // Используем указанный chatId или значение из .env
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID || undefined;
    
    if (!targetChatId) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует ID чата Telegram. Укажите его в запросе или в .env'
      });
    }
    
    console.log(`[Test API] Отправка HTML-текста в Telegram, чат ID: ${targetChatId}`);
    console.log(`[Test API] Текст: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    console.log(`[Test API] Автоисправление HTML: ${autoFixHtml ? 'включено' : 'отключено'}`);

    // Подготавливаем текст для отправки
    let processedText = text;
    
    // Если autoFixHtml=true, предварительно исправляем незакрытые теги
    if (autoFixHtml) {
      // Используем агрессивный метод для исправления всех возможных проблем с HTML тегами
      processedText = telegramService.aggressiveTagFixer(text);
      console.log(`[Test API] Текст после агрессивного исправления HTML: ${processedText.substring(0, 100)}${processedText.length > 100 ? '...' : ''}`);
    }
    
    // Инициализируем сервис с токеном и ID чата
    telegramService.initialize(
      process.env.TELEGRAM_BOT_TOKEN || '',
      targetChatId
    );
    
    // Используем прямой метод отправки HTML-текста
    // Внутри метода также производится автоматическое исправление тегов
    const result = await telegramService.sendRawHtmlToTelegram(processedText);
    
    // Если result.success === true то отправка прошла успешно,
    // в результате есть messageId и messageUrl
    console.log(`[Test API] Результат отправки: ${JSON.stringify(result)}`);
    
    // Возвращаем результат клиенту
    return res.json({
      success: result.success,
      messageId: result.messageId,
      messageUrl: result.messageUrl,
      chatId: targetChatId,
      text: text,
      result: result.result || result,
      ...(result.error ? { error: result.error } : {})
    });
  } catch (error: any) {
    console.error('[Test API] Ошибка при отправке HTML в Telegram:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Маршрут для тестирования оптимизированной публикации в Telegram с HTML-форматированием
 * 
 * Этот маршрут позволяет тестировать всю цепочку публикации контента в Telegram,
 * включая обработку HTML-форматирования, но используя оптимизированный метод publishToPlatform
 * с прямой отправкой HTML.
 * 
 * Принимает:
 * - content: Текст с HTML-форматированием
 * - chatId: ID чата для отправки (опционально, берется из .env)
 * - imageUrl: URL изображения для отправки (опционально)
 */
router.post('/optimized-platform-publish', async (req: Request, res: Response) => {
  try {
    const { content, chatId, imageUrl } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует контент для публикации (параметр content)'
      });
    }
    
    // Используем указанный chatId или значение из .env
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID || undefined;
    
    if (!targetChatId) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует ID чата Telegram. Укажите его в запросе или в .env'
      });
    }
    
    console.log(`[Test API] Оптимизированная публикация в Telegram, чат ID: ${targetChatId}`);
    console.log(`[Test API] Контент: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    
    // Применяем агрессивное исправление HTML к контенту для повышения надежности
    let processedContent = telegramService.aggressiveTagFixer(content);
    console.log(`[Test API] Контент после агрессивного исправления HTML: ${processedContent.substring(0, 100)}${processedContent.length > 100 ? '...' : ''}`);
    
    // Создаем тестовый контент для публикации
    const testContent: CampaignContent = {
      id: uuidv4(),
      title: 'Тестовая публикация',
      content: processedContent, // Используем исправленный контент
      contentType: 'text',
      imageUrl: imageUrl || null,
      additionalImages: [],
      status: 'draft',
      userId: 'test-user',
      campaignId: 'test-campaign',
      socialPlatforms: ['telegram'],
      createdAt: new Date(),
      hashtags: [],
      links: [],
      metadata: {}
    };
    
    // Настраиваем параметры для Telegram
    const telegramSettings = {
      token: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: targetChatId
    };
    
    // Инициализируем telegramService с нашими настройками
    telegramService.initialize(
      telegramSettings.token,
      telegramSettings.chatId
    );
    
    // Публикуем контент с использованием оптимизированного метода
    const result = await telegramService.publishToPlatform(testContent);
    
    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось опубликовать контент в Telegram',
        details: 'Нет ответа от сервиса публикации'
      });
    }
    
    console.log(`[Test API] Публикация успешно отправлена, URL: ${result.postUrl}`);
    
    return res.json({
      success: true,
      messageId: result.messageId,
      postUrl: result.postUrl,
      chatId: targetChatId,
      content: content,
      result: result
    });
  } catch (error: any) {
    console.error('[Test API] Ошибка при публикации в Telegram:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Маршрут для тестирования публикации в Instagram
 * Этот маршрут принимает токен и ID бизнес-аккаунта напрямую в запросе,
 * что облегчает тестирование без необходимости настройки кампании
 */
router.post('/instagram-post', async (req: Request, res: Response) => {
  try {
    const { token, businessAccountId, imageUrl, caption } = req.body;
    
    if (!token || !businessAccountId || !imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать token, businessAccountId и imageUrl'
      });
    }
    
    console.log(`[Test API] Тестовая публикация в Instagram, businessAccountId: ${businessAccountId}`);
    console.log(`[Test API] Изображение: ${imageUrl}`);
    console.log(`[Test API] Подпись: ${caption ? caption.substring(0, 50) + '...' : 'не указана'}`);
    
    // Создаем тестовый контент
    const testContent: CampaignContent = {
      id: uuidv4(),
      userId: 'test-user',
      campaignId: 'test-campaign',
      title: 'Тестовая публикация в Instagram',
      content: caption || 'Тестовая подпись для Instagram',
      contentType: 'image',
      imageUrl: imageUrl,
      additionalImages: [],
      status: 'draft',
      socialPlatforms: ['instagram'],
      createdAt: new Date(),
      hashtags: [],
      links: [],
      metadata: {}
    };
    
    // Выполняем запрос к Instagram Graph API
    try {
      // 1. Создаем медиа-контейнер
      console.log('[Test API] Создание медиа-контейнера...');
      const containerResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${businessAccountId}/media`,
        {
          image_url: imageUrl,
          caption: caption || ''
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            access_token: token
          }
        }
      );
      
      if (!containerResponse.data || !containerResponse.data.id) {
        return res.status(500).json({
          success: false,
          error: 'Не удалось создать медиа-контейнер в Instagram',
          details: containerResponse.data
        });
      }
      
      const containerId = containerResponse.data.id;
      console.log(`[Test API] Медиа-контейнер создан, ID: ${containerId}`);
      
      // 2. Публикуем медиа-контейнер
      console.log('[Test API] Публикация медиа-контейнера...');
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${businessAccountId}/media_publish`,
        {
          creation_id: containerId
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            access_token: token
          }
        }
      );
      
      if (!publishResponse.data || !publishResponse.data.id) {
        return res.status(500).json({
          success: false,
          error: 'Не удалось опубликовать медиа в Instagram',
          details: publishResponse.data
        });
      }
      
      const postId = publishResponse.data.id;
      console.log(`[Test API] Публикация создана, ID: ${postId}`);
      
      // 3. Получаем permalink на публикацию
      console.log('[Test API] Получение постоянной ссылки на публикацию...');
      const permalinkResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${postId}`,
        {
          params: {
            fields: 'permalink',
            access_token: token
          }
        }
      );
      
      const permalink = permalinkResponse.data?.permalink || null;
      console.log(`[Test API] Постоянная ссылка получена: ${permalink}`);
      
      return res.json({
        success: true,
        containerId: containerId,
        postId: postId,
        permalink: permalink,
        businessAccountId: businessAccountId
      });
    } catch (apiError: any) {
      console.error('[Test API] Ошибка Instagram API:', apiError);
      
      // Получаем подробности ошибки из ответа Instagram API
      const apiResponse = apiError.response?.data;
      
      return res.status(500).json({
        success: false,
        error: 'Ошибка при взаимодействии с Instagram API',
        message: apiError.message,
        details: apiResponse || apiError
      });
    }
  } catch (error: any) {
    console.error('[Test API] Ошибка при тестировании публикации в Instagram:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Специальный маршрут для тестирования функции агрессивного исправления HTML тегов
 */
router.post('/fix-html', (req: Request, res: Response) => {
  try {
    const { text, aggressive = false } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует текст для исправления (параметр text)'
      });
    }
    
    console.log(`[Test API] Запрос на исправление HTML: ${text}`);
    console.log(`[Test API] Режим исправления: ${aggressive ? 'агрессивный' : 'обычный'}`);
    
    // Определяем метод исправления в зависимости от режима
    let fixedText;
    if (aggressive) {
      fixedText = telegramService.aggressiveTagFixer(text);
      console.log(`[Test API] Результат агрессивного исправления: ${fixedText}`);
    } else {
      fixedText = telegramService.fixUnclosedTags(text);
      console.log(`[Test API] Результат обычного исправления: ${fixedText}`);
    }
    
    return res.json({
      success: true,
      originalText: text,
      fixedText: fixedText,
      aggressive: aggressive
    });
  } catch (error: any) {
    console.error('[Test API] Ошибка при исправлении HTML:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Маршрут для получения списка доступных ID контента
 * который может использоваться для тестирования публикации
 */
router.get('/list-content-ids', async (req: Request, res: Response) => {
  try {
    console.log(`[Test API] Запрос на получение списка ID контента`);
    
    // Используем DirectusAuthManager для авторизации
    const { directusAuthManager } = await import('../services/directus');
    const { directusCrud } = await import('../services/directus');
    
    // Пробуем авторизоваться как администратор
    try {
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Отсутствуют учетные данные администратора в переменных окружения'
        });
      }
      
      // Авторизуемся в Directus
      const authResult = await directusAuthManager.login(email, password);
      console.log(`[Test API] Успешная авторизация в Directus как администратор (userId: ${authResult.userId})`);
      
      // Получаем последние 20 элементов контента через directusCrud
      const contentItems = await directusCrud.list('campaign_content', {
        sort: ['-date_created'], // Directus использует date_created как стандартное поле даты создания
        limit: 20,
        authToken: authResult.token
      });
      
      if (contentItems && contentItems.length > 0) {
        const contentList = contentItems.map((item: any) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          contentType: item.content_type,
          hasImage: !!item.image_url,
          contentPreview: item.content ? item.content.substring(0, 100) + (item.content.length > 100 ? '...' : '') : null
        }));
        
        console.log(`[Test API] Получено ${contentList.length} элементов контента`);
        
        return res.json({
          success: true,
          count: contentList.length,
          data: contentList
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'Элементы контента не найдены'
        });
      }
    } catch (authError: any) {
      console.error(`[Test API] Ошибка авторизации в Directus: ${authError.message}`);
      return res.status(401).json({
        success: false,
        error: 'Ошибка авторизации в Directus',
        message: authError.message
      });
    }
  } catch (error: any) {
    console.error(`[Test API] Ошибка при получении списка ID контента: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при получении списка ID контента',
      message: error.message
    });
  }
});

/**
 * Маршрут для получения контента по ID с последующей публикацией в Telegram
 * Этот маршрут получает контент из Directus и публикует его в Telegram,
 * используя настройки из .env или переданные в запросе
 */
router.post('/publish-content-by-id', async (req: Request, res: Response) => {
  try {
    const { contentId, telegramToken, telegramChatId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать ID контента (contentId)'
      });
    }
    
    // Используем переданные настройки или берем из .env
    const token = telegramToken || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TEST_TOKEN;
    const chatId = telegramChatId || process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_TEST_CHAT_ID;
    
    if (!token || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'Не указаны настройки Telegram (token и chatId). Передайте их в запросе или задайте в .env'
      });
    }
    
    console.log(`[Test API] Получение контента по ID: ${contentId}`);
    console.log(`[Test API] Использование настроек: chatId=${chatId}`);
    
    try {
      // Авторизуемся как администратор для получения контента
      const { directusAuthManager } = await import('../services/directus');
      const { directusCrud } = await import('../services/directus');
      
      const email = process.env.DIRECTUS_ADMIN_EMAIL;
      const password = process.env.DIRECTUS_ADMIN_PASSWORD;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Отсутствуют учетные данные администратора в переменных окружения'
        });
      }
      
      // Авторизуемся в Directus
      const authResult = await directusAuthManager.login(email, password);
      console.log(`[Test API] Успешная авторизация в Directus как администратор (userId: ${authResult.userId})`);
      
      // Получаем контент напрямую из хранилища
      const { storage } = await import('../storage');
      const content = await storage.getCampaignContentById(contentId);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          error: `Контент с ID ${contentId} не найден`
        });
      }
      
      console.log(`[Test API] Контент получен: ${content.title}`);
      console.log(`[Test API] Тип контента: ${content.contentType}`);
      console.log(`[Test API] HTML текст: ${content.content.substring(0, 100)}${content.content.length > 100 ? '...' : ''}`);
      
      // Инициализируем telegramService с нашими настройками
      telegramService.initialize(token, chatId);
      
      // Публикуем контент с использованием метода publishToPlatform
      const result = await telegramService.publishToPlatform(content);
      
      if (!result) {
        return res.status(500).json({
          success: false,
          error: 'Не удалось опубликовать контент в Telegram',
          details: 'Нет ответа от сервиса публикации'
        });
      }
      
      console.log(`[Test API] Публикация успешно отправлена, URL: ${result.postUrl}`);
      
      // Обновляем статус публикации в хранилище
      const { socialPublishingService } = await import('../services/social/index');
      await socialPublishingService.updatePublicationStatus(
        contentId,
        'telegram',
        result
      );
      
      return res.json({
        success: true,
        contentId: contentId,
        messageId: result.messageId,
        postUrl: result.postUrl,
        chatId: chatId,
        result: result
      });
    } catch (authError: any) {
      console.error(`[Test API] Ошибка авторизации или получения данных: ${authError.message}`);
      return res.status(401).json({
        success: false,
        error: 'Ошибка авторизации или получения данных',
        message: authError.message
      });
    }
  } catch (error: any) {
    console.error('[Test API] Ошибка при публикации контента в Telegram:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;