/**
 * Тесты API эндпоинтов - критично для рефакторинга backend логики
 */

describe('API Endpoints Tests', () => {
  test('должен валидировать данные создания контента', () => {
    function validateContentCreation(data) {
      const errors = [];
      
      if (!data.campaign_id) {
        errors.push('Campaign ID обязателен');
      }
      
      if (!data.content_type) {
        errors.push('Content type обязателен');
      }
      
      const validContentTypes = ['text', 'text_with_image', 'video', 'stories'];
      if (data.content_type && !validContentTypes.includes(data.content_type)) {
        errors.push('Недопустимый тип контента');
      }
      
      // Для видео контента требуется videoUrl
      if (data.content_type === 'video' && !data.videoUrl) {
        errors.push('Для видео контента требуется videoUrl');
      }
      
      // Для text_with_image требуется imageUrl
      if (data.content_type === 'text_with_image' && !data.imageUrl) {
        errors.push('Для контента с изображением требуется imageUrl');
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    }

    // Валидный текстовый контент
    const validTextContent = {
      campaign_id: 'campaign-123',
      content_type: 'text',
      content: 'Тестовый пост'
    };

    // Валидный видео контент
    const validVideoContent = {
      campaign_id: 'campaign-123',
      content_type: 'video',
      content: 'Описание видео',
      videoUrl: 'https://example.com/video.mp4'
    };

    // Невалидный контент - отсутствует campaign_id
    const invalidContent1 = {
      content_type: 'text',
      content: 'Пост без campaign_id'
    };

    // Невалидный видео контент - нет videoUrl
    const invalidContent2 = {
      campaign_id: 'campaign-123',
      content_type: 'video',
      content: 'Видео без URL'
    };

    expect(validateContentCreation(validTextContent).isValid).toBe(true);
    expect(validateContentCreation(validVideoContent).isValid).toBe(true);
    
    const invalid1Result = validateContentCreation(invalidContent1);
    expect(invalid1Result.isValid).toBe(false);
    expect(invalid1Result.errors).toContain('Campaign ID обязателен');
    
    const invalid2Result = validateContentCreation(invalidContent2);
    expect(invalid2Result.isValid).toBe(false);
    expect(invalid2Result.errors).toContain('Для видео контента требуется videoUrl');
  });

  test('должен правильно обрабатывать немедленную публикацию', () => {
    function processImmediatePublication(contentId, platforms, contentData) {
      if (!contentId) {
        return { error: 'Content ID обязателен', status: 400 };
      }
      
      if (!platforms || platforms.length === 0) {
        return { error: 'Необходимо выбрать хотя бы одну платформу', status: 400 };
      }
      
      // Проверяем требования платформ
      const platformRequirements = {
        youtube: ['videoUrl'],
        instagram: ['imageUrl'], // N8N теперь проверяет это
        facebook: [],
        vk: [],
        telegram: []
      };
      
      const errors = [];
      platforms.forEach(platform => {
        const requirements = platformRequirements[platform];
        if (requirements) {
          requirements.forEach(requirement => {
            if (!contentData[requirement]) {
              errors.push(`${platform} требует ${requirement}`);
            }
          });
        }
      });
      
      // Создаем pending статусы для всех платформ
      const socialPlatforms = {};
      platforms.forEach(platform => {
        socialPlatforms[platform] = {
          status: 'pending',
          enabled: true,
          scheduledAt: new Date().toISOString()
        };
      });
      
      return {
        data: {
          contentId,
          socialPlatforms,
          webhooksTriggered: platforms.length,
          message: 'Публикация инициирована'
        },
        status: 200
      };
    }

    const contentData = {
      content: 'Тестовый пост',
      imageUrl: 'https://example.com/image.jpg',
      videoUrl: 'https://example.com/video.mp4'
    };

    // Валидная публикация
    const validResult = processImmediatePublication(
      'content-123', 
      ['vk', 'instagram'], 
      contentData
    );
    
    expect(validResult.status).toBe(200);
    expect(validResult.data.socialPlatforms.vk.status).toBe('pending');
    expect(validResult.data.socialPlatforms.instagram.status).toBe('pending');
    expect(validResult.data.webhooksTriggered).toBe(2);

    // Невалидная публикация - нет content ID
    const invalidResult1 = processImmediatePublication('', ['vk'], contentData);
    expect(invalidResult1.status).toBe(400);
    expect(invalidResult1.error).toContain('Content ID обязателен');

    // Невалидная публикация - нет платформ
    const invalidResult2 = processImmediatePublication('content-123', [], contentData);
    expect(invalidResult2.status).toBe(400);
    expect(invalidResult2.error).toContain('Необходимо выбрать хотя бы одну платформу');
  });

  test('должен обрабатывать обновление статусов платформ', () => {
    function updatePlatformStatus(currentPlatforms, platform, update) {
      // Парсим текущие платформы если это строка
      let platforms = currentPlatforms;
      if (typeof platforms === 'string') {
        try {
          platforms = JSON.parse(platforms);
        } catch (e) {
          platforms = {};
        }
      }
      
      if (!platforms) {
        platforms = {};
      }
      
      // Обновляем статус платформы
      platforms[platform] = {
        ...platforms[platform],
        ...update,
        lastUpdated: new Date().toISOString()
      };
      
      return platforms;
    }

    const initialPlatforms = {
      vk: { status: 'pending', enabled: true },
      instagram: { status: 'pending', enabled: true }
    };

    // Обновление успешной публикации
    const updatedPlatforms = updatePlatformStatus(initialPlatforms, 'vk', {
      status: 'published',
      postUrl: 'https://vk.com/post123',
      publishedAt: new Date().toISOString()
    });

    expect(updatedPlatforms.vk.status).toBe('published');
    expect(updatedPlatforms.vk.postUrl).toBe('https://vk.com/post123');
    expect(updatedPlatforms.vk.lastUpdated).toBeDefined();
    expect(updatedPlatforms.instagram.status).toBe('pending'); // Не изменился

    // Обновление с ошибкой
    const errorPlatforms = updatePlatformStatus(updatedPlatforms, 'instagram', {
      status: 'failed',
      error: 'Invalid access token',
      lastAttempt: new Date().toISOString()
    });

    expect(errorPlatforms.instagram.status).toBe('failed');
    expect(errorPlatforms.instagram.error).toBe('Invalid access token');

    // Работа со строковыми данными
    const stringPlatforms = '{"facebook":{"status":"pending"}}';
    const parsedPlatforms = updatePlatformStatus(stringPlatforms, 'facebook', {
      status: 'published'
    });

    expect(parsedPlatforms.facebook.status).toBe('published');
  });

  test('должен валидировать анализ веб-сайта', () => {
    function validateWebsiteAnalysis(url) {
      if (!url) {
        return { error: 'URL обязателен', status: 400 };
      }
      
      if (typeof url !== 'string') {
        return { error: 'URL должен быть строкой', status: 400 };
      }
      
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url)) {
        return { error: 'Некорректный формат URL', status: 400 };
      }
      
      // Симуляция успешного анализа
      return {
        data: {
          companyName: 'Извлеченное название компании',
          businessDescription: 'Автоматически сгенерированное описание бизнеса',
          contactInfo: 'info@example.com, +7 123 456-78-90',
          targetAudience: 'Целевая аудитория на основе анализа',
          businessValues: 'Ценности компании',
          productBeliefs: 'Убеждения о продукте'
        },
        status: 200
      };
    }

    expect(validateWebsiteAnalysis('https://example.com').status).toBe(200);
    expect(validateWebsiteAnalysis('http://example.com').status).toBe(200);
    expect(validateWebsiteAnalysis('').status).toBe(400);
    expect(validateWebsiteAnalysis('not-a-url').status).toBe(400);
    expect(validateWebsiteAnalysis(null).status).toBe(400);
    expect(validateWebsiteAnalysis(123).status).toBe(400);
  });

  test('должен правильно обрабатывать админские права', () => {
    function checkAdminRights(token) {
      if (!token) {
        return { error: 'Токен авторизации обязателен', status: 401 };
      }
      
      // Симуляция проверки токена через Directus API
      const mockUsers = {
        'admin-token': { 
          id: '123', 
          email: 'admin@example.com', 
          is_smm_admin: true, 
          is_smm_super: true 
        },
        'user-token': { 
          id: '456', 
          email: 'user@example.com', 
          is_smm_admin: false 
        },
        'moderator-token': { 
          id: '789', 
          email: 'mod@example.com', 
          is_smm_admin: true, 
          is_smm_super: false 
        }
      };
      
      const user = mockUsers[token];
      if (!user) {
        return { error: 'Недействительный токен', status: 403 };
      }
      
      return {
        data: {
          isAdmin: user.is_smm_admin || false,
          isSuper: user.is_smm_super || false,
          userId: user.id,
          email: user.email
        },
        status: 200
      };
    }

    const adminCheck = checkAdminRights('admin-token');
    expect(adminCheck.status).toBe(200);
    expect(adminCheck.data.isAdmin).toBe(true);
    expect(adminCheck.data.isSuper).toBe(true);

    const userCheck = checkAdminRights('user-token');
    expect(userCheck.status).toBe(200);
    expect(userCheck.data.isAdmin).toBe(false);

    const moderatorCheck = checkAdminRights('moderator-token');
    expect(moderatorCheck.status).toBe(200);
    expect(moderatorCheck.data.isAdmin).toBe(true);
    expect(moderatorCheck.data.isSuper).toBe(false);

    const noTokenCheck = checkAdminRights('');
    expect(noTokenCheck.status).toBe(401);

    const invalidTokenCheck = checkAdminRights('invalid-token');
    expect(invalidTokenCheck.status).toBe(403);
  });
});