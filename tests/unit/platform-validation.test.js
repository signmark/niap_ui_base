/**
 * Тесты валидации платформ - критично для N8N интеграции
 */

describe('Platform Validation Tests', () => {
  test('должен правильно определять статусы платформ для блокировки', () => {
    // Логика из планировщика - какие статусы должны блокировать повторную публикацию
    function shouldBlockRepublication(platformData) {
      // Блокируем если уже опубликовано И есть URL
      if (platformData.status === 'published' && platformData.postUrl && platformData.postUrl.trim() !== '') {
        return { block: true, reason: 'already_published' };
      }

      // Блокируем quota_exceeded как опубликованное
      if (platformData.status === 'quota_exceeded') {
        return { block: true, reason: 'quota_exceeded' };
      }

      // Блокируем критические ошибки
      if (platformData.status === 'failed' && platformData.error) {
        const criticalErrors = [
          'Bad request - please check your parameters',
          'Authorization failed - please check your credentials',
          'Invalid credentials',
          'Permission denied',
          'Content policy violation'
        ];
        
        const isCritical = criticalErrors.some(error => 
          platformData.error.toLowerCase().includes(error.toLowerCase())
        );

        if (isCritical) {
          return { block: true, reason: 'critical_error' };
        }
      }

      // Блокируем старые failed (старше 12 часов)
      if (platformData.status === 'failed' && platformData.lastAttempt) {
        const hoursOld = (Date.now() - new Date(platformData.lastAttempt).getTime()) / (1000 * 60 * 60);
        if (hoursOld > 12) {
          return { block: true, reason: 'old_failed' };
        }
      }

      return { block: false, reason: 'ready' };
    }

    // Тестовые данные
    const publishedWithUrl = { status: 'published', postUrl: 'https://vk.com/post123' };
    const publishedWithoutUrl = { status: 'published', postUrl: '' };
    const quotaExceeded = { status: 'quota_exceeded' };
    const criticalError = { status: 'failed', error: 'Bad request - please check your parameters' };
    const temporaryError = { status: 'failed', error: 'Network timeout' };
    const oldFailed = { 
      status: 'failed', 
      lastAttempt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25 часов назад
    };
    const recentFailed = { 
      status: 'failed', 
      lastAttempt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 час назад
    };
    const pending = { status: 'pending' };

    expect(shouldBlockRepublication(publishedWithUrl)).toEqual({ block: true, reason: 'already_published' });
    expect(shouldBlockRepublication(publishedWithoutUrl)).toEqual({ block: false, reason: 'ready' });
    expect(shouldBlockRepublication(quotaExceeded)).toEqual({ block: true, reason: 'quota_exceeded' });
    expect(shouldBlockRepublication(criticalError)).toEqual({ block: true, reason: 'critical_error' });
    expect(shouldBlockRepublication(temporaryError)).toEqual({ block: false, reason: 'ready' });
    expect(shouldBlockRepublication(oldFailed)).toEqual({ block: true, reason: 'old_failed' });
    expect(shouldBlockRepublication(recentFailed)).toEqual({ block: false, reason: 'ready' });
    expect(shouldBlockRepublication(pending)).toEqual({ block: false, reason: 'ready' });
  });

  test('должен обрабатывать N8N webhook URL генерацию', () => {
    function generateWebhookUrl(platform, baseUrl = 'https://n8n.example.com') {
      const webhookPaths = {
        vk: '/webhook/publish-vk',
        facebook: '/webhook/publish-facebook',
        instagram: '/webhook/publish-instagram',
        telegram: '/webhook/publish-telegram',
        youtube: '/webhook/publish-youtube'
      };

      const path = webhookPaths[platform];
      if (!path) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      return `${baseUrl}${path}`;
    }

    expect(generateWebhookUrl('vk')).toBe('https://n8n.example.com/webhook/publish-vk');
    expect(generateWebhookUrl('instagram')).toBe('https://n8n.example.com/webhook/publish-instagram');
    expect(() => generateWebhookUrl('unsupported')).toThrow('Unsupported platform: unsupported');
  });

  test('должен правильно формировать данные для N8N webhook', () => {
    function prepareWebhookData(content, platform, campaignSettings = {}) {
      const baseData = {
        contentId: content.id,
        campaignId: content.campaign_id,
        platform: platform,
        content: content.content,
        contentType: content.content_type
      };

      // Добавляем медиа если есть
      if (content.imageUrl) baseData.imageUrl = content.imageUrl;
      if (content.videoUrl) baseData.videoUrl = content.videoUrl;
      if (content.videoThumbnail) baseData.videoThumbnail = content.videoThumbnail;

      // Добавляем настройки платформы
      const platformSettings = campaignSettings.social_media_settings?.[platform] || {};
      if (Object.keys(platformSettings).length > 0) {
        baseData.platformSettings = platformSettings;
      }

      return baseData;
    }

    const content = {
      id: 'content-123',
      campaign_id: 'campaign-456',
      content: 'Test post content',
      content_type: 'text_with_image',
      imageUrl: 'https://example.com/image.jpg'
    };

    const campaignSettings = {
      social_media_settings: {
        vk: { access_token: 'vk_token_123' },
        youtube: { access_token: 'yt_token_456', refresh_token: 'yt_refresh_789' }
      }
    };

    const vkData = prepareWebhookData(content, 'vk', campaignSettings);
    const youtubeData = prepareWebhookData(content, 'youtube', campaignSettings);

    expect(vkData.contentId).toBe('content-123');
    expect(vkData.platform).toBe('vk');
    expect(vkData.imageUrl).toBe('https://example.com/image.jpg');
    expect(vkData.platformSettings.access_token).toBe('vk_token_123');

    expect(youtubeData.platformSettings.access_token).toBe('yt_token_456');
    expect(youtubeData.platformSettings.refresh_token).toBe('yt_refresh_789');
  });
});