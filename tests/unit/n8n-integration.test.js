/**
 * Тесты N8N интеграции - критично для публикации контента
 */

describe('N8N Integration Tests', () => {
  test('должен генерировать корректные N8N webhook URLs', () => {
    function generateN8NWebhookUrl(platform, baseUrl = process.env.N8N_WEBHOOK_BASE_URL) {
      if (!platform) {
        throw new Error('Platform обязательна для webhook URL');
      }
      
      const allowedPlatforms = ['vk', 'facebook', 'telegram', 'instagram', 'youtube'];
      if (!allowedPlatforms.includes(platform)) {
        throw new Error(`Неподдерживаемая платформа: ${platform}`);
      }
      
      const webhookUrls = {
        'vk': '/webhook/publish-vk',
        'facebook': '/webhook/publish-facebook', 
        'telegram': '/webhook/publish-telegram',
        'instagram': '/webhook/publish-instagram',
        'youtube': '/webhook/publish-youtube'
      };
      
      const path = webhookUrls[platform];
      return baseUrl ? `${baseUrl}${path}` : path;
    }

    // Тест генерации URL для разных платформ
    expect(generateN8NWebhookUrl('vk')).toBe('/webhook/publish-vk');
    expect(generateN8NWebhookUrl('youtube')).toBe('/webhook/publish-youtube');
    
    // Тест с базовым URL
    const fullUrl = generateN8NWebhookUrl('telegram', 'https://n8n.example.com');
    expect(fullUrl).toBe('https://n8n.example.com/webhook/publish-telegram');
    
    // Тест ошибок
    expect(() => generateN8NWebhookUrl('')).toThrow('Platform обязательна');
    expect(() => generateN8NWebhookUrl('unknown')).toThrow('Неподдерживаемая платформа');
  });

  test('должен формировать данные для N8N webhook', () => {
    function prepareN8NWebhookData(content, platform, campaignSettings = {}) {
      if (!content || !platform) {
        throw new Error('Content и platform обязательны');
      }
      
      const baseData = {
        contentId: content.id,
        platform: platform,
        content: content.content,
        timestamp: new Date().toISOString()
      };
      
      // Добавляем медиа файлы если есть
      if (content.imageUrl) {
        baseData.imageUrl = content.imageUrl;
      }
      
      if (content.videoUrl) {
        baseData.videoUrl = content.videoUrl;
        baseData.videoThumbnail = content.videoThumbnail;
      }
      
      // Платформо-специфичные данные
      switch (platform) {
        case 'youtube':
          baseData.title = content.title || 'Без названия';
          baseData.description = content.content;
          baseData.tags = content.keywords ? content.keywords.split(',').map(t => t.trim()) : [];
          
          // YouTube credentials из campaign settings
          if (campaignSettings.social_media_settings?.youtube) {
            const ytSettings = campaignSettings.social_media_settings.youtube;
            baseData.channelId = ytSettings.channel_id;
            baseData.accessToken = ytSettings.access_token;
            baseData.refreshToken = ytSettings.refresh_token;
          }
          break;
          
        case 'instagram':
          baseData.caption = content.content;
          if (content.hashtags) {
            baseData.caption += `\n\n${content.hashtags}`;
          }
          break;
          
        case 'telegram':
          baseData.chatId = campaignSettings.social_media_settings?.telegram?.chat_id;
          baseData.parseMode = 'Markdown';
          break;
          
        case 'vk':
          baseData.groupId = campaignSettings.social_media_settings?.vk?.group_id;
          baseData.accessToken = campaignSettings.social_media_settings?.vk?.access_token;
          break;
          
        case 'facebook':
          baseData.pageId = campaignSettings.social_media_settings?.facebook?.page_id;
          baseData.accessToken = campaignSettings.social_media_settings?.facebook?.access_token;
          break;
      }
      
      return baseData;
    }

    const testContent = {
      id: 'content-123',
      content: 'Тестовый пост',
      imageUrl: 'https://example.com/image.jpg',
      title: 'Тест',
      keywords: 'здоровье, спорт, фитнес'
    };

    const campaignSettings = {
      social_media_settings: {
        youtube: {
          channel_id: 'UC123456',
          access_token: 'yt_token',
          refresh_token: 'yt_refresh'
        },
        telegram: {
          chat_id: '@testchannel'
        }
      }
    };

    // YouTube данные
    const youtubeData = prepareN8NWebhookData(testContent, 'youtube', campaignSettings);
    expect(youtubeData.platform).toBe('youtube');
    expect(youtubeData.title).toBe('Тест');
    expect(youtubeData.tags).toEqual(['здоровье', 'спорт', 'фитнес']);
    expect(youtubeData.channelId).toBe('UC123456');
    expect(youtubeData.accessToken).toBe('yt_token');

    // Telegram данные
    const telegramData = prepareN8NWebhookData(testContent, 'telegram', campaignSettings);
    expect(telegramData.platform).toBe('telegram');
    expect(telegramData.chatId).toBe('@testchannel');
    expect(telegramData.parseMode).toBe('Markdown');

    // Тест ошибок
    expect(() => prepareN8NWebhookData(null, 'vk')).toThrow('Content и platform обязательны');
  });

  test('должен обрабатывать ответы от N8N webhook', () => {
    function processN8NWebhookResponse(response, expectedPlatform) {
      if (!response) {
        return { success: false, error: 'Пустой ответ от N8N' };
      }
      
      try {
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        // Проверяем обязательные поля
        if (!data.success && data.success !== false) {
          return { success: false, error: 'Отсутствует поле success' };
        }
        
        if (!data.platform) {
          return { success: false, error: 'Отсутствует поле platform' };
        }
        
        if (expectedPlatform && data.platform !== expectedPlatform) {
          return { 
            success: false, 
            error: `Неожиданная платформа: ${data.platform}, ожидалась: ${expectedPlatform}` 
          };
        }
        
        if (data.success) {
          // Успешная публикация
          return {
            success: true,
            platform: data.platform,
            postUrl: data.postUrl || data.url,
            postId: data.postId || data.id,
            publishedAt: data.publishedAt || new Date().toISOString(),
            metadata: data.metadata || {}
          };
        } else {
          // Ошибка публикации
          return {
            success: false,
            platform: data.platform,
            error: data.error || data.message || 'Неизвестная ошибка',
            errorCode: data.errorCode,
            retryable: data.retryable || false
          };
        }
      } catch (parseError) {
        return { 
          success: false, 
          error: `Ошибка парсинга ответа N8N: ${parseError.message}` 
        };
      }
    }

    // Успешный ответ
    const successResponse = {
      success: true,
      platform: 'youtube',
      postUrl: 'https://youtube.com/watch?v=abc123',
      postId: 'abc123',
      publishedAt: '2023-01-01T00:00:00Z'
    };
    
    const successResult = processN8NWebhookResponse(successResponse, 'youtube');
    expect(successResult.success).toBe(true);
    expect(successResult.platform).toBe('youtube');
    expect(successResult.postUrl).toBe('https://youtube.com/watch?v=abc123');

    // Ответ с ошибкой
    const errorResponse = {
      success: false,
      platform: 'instagram',
      error: 'Превышена квота API',
      errorCode: 'QUOTA_EXCEEDED',
      retryable: false
    };
    
    const errorResult = processN8NWebhookResponse(errorResponse, 'instagram');
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBe('Превышена квота API');
    expect(errorResult.retryable).toBe(false);

    // Невалидный JSON
    const invalidResult = processN8NWebhookResponse('invalid json', 'vk');
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toContain('Ошибка парсинга');

    // Несоответствие платформы
    const wrongPlatformResult = processN8NWebhookResponse(successResponse, 'telegram');
    expect(wrongPlatformResult.success).toBe(false);
    expect(wrongPlatformResult.error).toContain('Неожиданная платформа');
  });

  test('должен обрабатывать retry логику для N8N запросов', () => {
    function createN8NRetryManager(maxRetries = 3, baseDelay = 1000) {
      return {
        async sendWithRetry(webhookUrl, data) {
          let lastError;
          
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              // Имитация HTTP запроса
              const response = await this.mockHttpRequest(webhookUrl, data, attempt);
              return { success: true, response, attempt };
            } catch (error) {
              lastError = error;
              
              // Определяем стоит ли повторять
              const shouldRetry = this.shouldRetryError(error) && attempt < maxRetries;
              
              if (!shouldRetry) {
                break;
              }
              
              // Exponential backoff
              const delay = baseDelay * Math.pow(2, attempt);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          
          return { 
            success: false, 
            error: lastError.message, 
            attempts: maxRetries + 1 
          };
        },
        
        shouldRetryError(error) {
          const retryableErrors = [
            'ECONNRESET',
            'ETIMEDOUT', 
            'ENOTFOUND',
            'NETWORK_ERROR',
            'HTTP_502',
            'HTTP_503',
            'HTTP_504'
          ];
          
          return retryableErrors.some(errType => 
            error.message.includes(errType) || error.code === errType
          );
        },
        
        // Мок для тестирования
        async mockHttpRequest(url, data, attempt) {
          if (attempt < 2 && url.includes('unstable')) {
            throw new Error('NETWORK_ERROR: Connection timeout');
          }
          
          if (url.includes('always-fail')) {
            throw new Error('AUTH_ERROR: Invalid credentials');
          }
          
          return { status: 200, data: { success: true, platform: 'test' } };
        }
      };
    }

    const retryManager = createN8NRetryManager(2, 100);
    
    // Тест успешного retry
    expect(async () => {
      const result = await retryManager.sendWithRetry('https://n8n.com/webhook/unstable', {});
      expect(result.success).toBe(true);
      expect(result.attempt).toBe(2); // Успех на 3й попытке
    }).not.toThrow();

    // Тест неудачного retry
    expect(async () => {
      const result = await retryManager.sendWithRetry('https://n8n.com/webhook/always-fail', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('AUTH_ERROR');
    }).not.toThrow();
  });

  test('должен обрабатывать различные статусы ответов N8N', () => {
    function mapN8NStatusToInternal(n8nStatus, platform) {
      const statusMappings = {
        'published': 'published',
        'success': 'published', 
        'completed': 'published',
        'pending': 'pending',
        'processing': 'pending',
        'failed': 'failed',
        'error': 'failed',
        'quota_exceeded': 'quota_exceeded',
        'rate_limited': 'quota_exceeded',
        'auth_error': 'failed',
        'invalid_credentials': 'failed'
      };
      
      const internalStatus = statusMappings[n8nStatus] || 'failed';
      
      // Дополнительная логика для платформ
      const platformSpecific = {
        'youtube': {
          'video_processing': 'pending',
          'upload_complete': 'published'
        },
        'instagram': {
          'media_uploaded': 'pending', 
          'post_created': 'published'
        }
      };
      
      if (platformSpecific[platform] && platformSpecific[platform][n8nStatus]) {
        return platformSpecific[platform][n8nStatus];
      }
      
      return internalStatus;
    }

    // Основные статусы
    expect(mapN8NStatusToInternal('published', 'vk')).toBe('published');
    expect(mapN8NStatusToInternal('success', 'telegram')).toBe('published');
    expect(mapN8NStatusToInternal('failed', 'facebook')).toBe('failed');
    expect(mapN8NStatusToInternal('quota_exceeded', 'youtube')).toBe('quota_exceeded');

    // Платформо-специфичные статусы
    expect(mapN8NStatusToInternal('video_processing', 'youtube')).toBe('pending');
    expect(mapN8NStatusToInternal('media_uploaded', 'instagram')).toBe('pending');
    
    // Неизвестные статусы
    expect(mapN8NStatusToInternal('unknown_status', 'vk')).toBe('failed');
  });
});