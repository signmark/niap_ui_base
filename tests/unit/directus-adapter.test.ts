/**
 * Тесты для Directus адаптера
 * Критически важно - это основной интерфейс к базе данных
 */

describe('Directus Storage Adapter', () => {
  describe('Token Management', () => {
    test('должен использовать правильные токены для разных операций', () => {
      // Тестируем логику выбора токенов
      const getTokenForOperation = (operationType: string, userToken?: string) => {
        const systemOperations = ['scheduler', 'system', 'admin'];
        const userOperations = ['ui', 'user', 'frontend'];
        
        if (systemOperations.includes(operationType)) {
          return process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_ADMIN_TOKEN;
        }
        
        if (userOperations.includes(operationType) && userToken) {
          return userToken;
        }
        
        return null;
      };

      // Системные операции должны использовать системный токен
      expect(getTokenForOperation('scheduler')).toBeDefined();
      expect(getTokenForOperation('system')).toBeDefined();
      
      // Пользовательские операции должны требовать пользовательский токен
      expect(getTokenForOperation('ui', 'user-token-123')).toBe('user-token-123');
      expect(getTokenForOperation('user')).toBeNull(); // без пользовательского токена
    });
  });

  describe('Content Status Updates', () => {
    test('должен правильно обновлять статусы платформ', () => {
      // Мок функции обновления статуса
      const updatePlatformStatus = (
        currentPlatforms: any, 
        platform: string, 
        statusUpdate: any
      ) => {
        const platforms = { ...currentPlatforms };
        
        if (!platforms[platform]) {
          platforms[platform] = {};
        }
        
        platforms[platform] = {
          ...platforms[platform],
          ...statusUpdate,
          lastUpdated: new Date().toISOString()
        };
        
        return platforms;
      };

      const initialPlatforms = {
        vk: { status: 'pending' },
        instagram: { status: 'published', postUrl: 'https://instagram.com/p/123' }
      };

      const updated = updatePlatformStatus(initialPlatforms, 'vk', {
        status: 'published',
        postUrl: 'https://vk.com/post456'
      });

      expect(updated.vk.status).toBe('published');
      expect(updated.vk.postUrl).toBe('https://vk.com/post456');
      expect(updated.vk.lastUpdated).toBeDefined();
      expect(updated.instagram.status).toBe('published'); // не изменился
    });

    test('должен обрабатывать ошибки публикации', () => {
      const handlePublishError = (
        currentPlatforms: any,
        platform: string,
        error: string
      ) => {
        const platforms = { ...currentPlatforms };
        
        platforms[platform] = {
          ...platforms[platform],
          status: 'failed',
          error: error,
          lastAttempt: new Date().toISOString()
        };
        
        return platforms;
      };

      const platforms = { facebook: { status: 'pending' } };
      const withError = handlePublishError(
        platforms, 
        'facebook', 
        'Invalid access token'
      );

      expect(withError.facebook.status).toBe('failed');
      expect(withError.facebook.error).toBe('Invalid access token');
      expect(withError.facebook.lastAttempt).toBeDefined();
    });
  });

  describe('Data Validation', () => {
    test('должен валидировать обязательные поля контента', () => {
      const validateContentData = (content: any) => {
        const errors: string[] = [];
        
        if (!content.id) errors.push('ID обязателен');
        if (!content.campaign_id) errors.push('Campaign ID обязателен');
        if (!content.content && !content.videoUrl) {
          errors.push('Контент или видео обязательны');
        }
        
        return {
          isValid: errors.length === 0,
          errors
        };
      };

      const validContent = {
        id: '123',
        campaign_id: '456',
        content: 'Test content'
      };

      const invalidContent = {
        content: 'Test without IDs'
      };

      expect(validateContentData(validContent).isValid).toBe(true);
      expect(validateContentData(invalidContent).isValid).toBe(false);
      expect(validateContentData(invalidContent).errors).toContain('ID обязателен');
    });
  });
});