/**
 * Вспомогательные функции для тестов
 */

// Мок данных для тестирования
export const mockCampaignContent = {
  id: 'test-content-123',
  campaign_id: 'test-campaign-456',
  content: 'Test social media content',
  content_type: 'text',
  status: 'draft',
  social_platforms: {
    vk: { status: 'pending', enabled: true },
    instagram: { status: 'published', postUrl: 'https://instagram.com/p/123' }
  },
  scheduledAt: null,
  date_created: '2025-01-01T00:00:00Z'
};

export const mockCampaign = {
  id: 'test-campaign-456',
  name: 'Test Campaign',
  user_id: 'test-user-789',
  business_questionnaire: {
    companyName: 'Test Company',
    businessDescription: 'Test business description',
    targetAudience: 'Test audience'
  }
};

export const mockDirectusResponse = {
  data: [mockCampaignContent],
  meta: {
    total_count: 1,
    filter_count: 1
  }
};

// Утилиты для создания тестовых данных
export const createMockContent = (overrides: Partial<typeof mockCampaignContent> = {}) => {
  return {
    ...mockCampaignContent,
    ...overrides,
    id: overrides.id || `test-content-${Date.now()}`
  };
};

export const createMockPlatformStatus = (platform: string, status: string = 'pending') => {
  return {
    [platform]: {
      status,
      enabled: true,
      lastUpdated: new Date().toISOString()
    }
  };
};

// Мок функций для планировщика
export const mockSchedulerFunctions = {
  isReadyToPublish: (content: any) => {
    if (!content.scheduledAt) return true;
    return new Date(content.scheduledAt) <= new Date();
  },

  shouldSkipPlatform: (platformData: any) => {
    // Пропускаем уже опубликованные
    if (platformData.status === 'published' && platformData.postUrl) {
      return true;
    }

    // Пропускаем критические ошибки
    if (platformData.status === 'failed' && platformData.error) {
      const criticalErrors = [
        'Bad request - please check your parameters',
        'Invalid credentials',
        'Permission denied'
      ];
      
      return criticalErrors.some(error => 
        platformData.error.toLowerCase().includes(error.toLowerCase())
      );
    }

    // Пропускаем старые failed
    if (platformData.status === 'failed' && platformData.lastAttempt) {
      const hoursOld = (Date.now() - new Date(platformData.lastAttempt).getTime()) / (1000 * 60 * 60);
      return hoursOld > 12;
    }

    return false;
  },

  updatePlatformStatus: (platforms: any, platform: string, update: any) => {
    return {
      ...platforms,
      [platform]: {
        ...platforms[platform],
        ...update,
        lastUpdated: new Date().toISOString()
      }
    };
  }
};

// Мок API ответов
export const mockApiResponses = {
  success: (data: any) => ({
    status: 200,
    data: { data, meta: { total_count: Array.isArray(data) ? data.length : 1 } }
  }),

  error: (message: string, status: number = 400) => ({
    status,
    error: message
  }),

  directusSuccess: (items: any[]) => ({
    status: 200,
    data: {
      data: items,
      meta: {
        total_count: items.length,
        filter_count: items.length
      }
    }
  })
};

// Валидация тестовых данных
export const validateTestData = {
  isValidContent: (content: any) => {
    const required = ['id', 'campaign_id'];
    return required.every(field => content[field]);
  },

  isValidPlatformStatus: (status: any) => {
    const validStatuses = ['draft', 'pending', 'published', 'failed'];
    return validStatuses.includes(status.status);
  },

  hasRequiredFields: (obj: any, fields: string[]) => {
    return fields.every(field => obj.hasOwnProperty(field) && obj[field] !== undefined);
  }
};

// Симуляция временных задержек для тестирования
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Очистка тестовых данных
export const cleanup = {
  clearMocks: () => {
    jest.clearAllMocks();
  },

  resetEnvironment: () => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.DISABLE_PUBLISHING = 'true';
  }
};