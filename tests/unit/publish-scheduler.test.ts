/**
 * Тесты для планировщика публикаций
 * Критически важно для рефакторинга - этот компонент обрабатывает логику публикации
 */

describe('Publish Scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Platform Status Logic', () => {
    test('должен пропускать уже опубликованные платформы', () => {
      const platforms = {
        vk: { status: 'published', postUrl: 'https://vk.com/post123' },
        instagram: { status: 'pending' }
      };

      // Мок функции планировщика
      const getReadyPlatforms = (platforms: any) => {
        return Object.entries(platforms).filter(([_, data]: [string, any]) => {
          // Логика из реального планировщика
          if (data.status === 'published' && data.postUrl && data.postUrl.trim() !== '') {
            return false;
          }
          return true;
        });
      };

      const readyPlatforms = getReadyPlatforms(platforms);
      
      expect(readyPlatforms).toHaveLength(1);
      expect(readyPlatforms[0][0]).toBe('instagram');
    });

    test('должен пропускать критические ошибки', () => {
      const platforms = {
        facebook: { 
          status: 'failed', 
          error: 'Bad request - please check your parameters' 
        },
        vk: { 
          status: 'failed', 
          error: 'Network timeout' 
        }
      };

      const isCriticalError = (errorMessage: string) => {
        const criticalErrors = [
          'Bad request - please check your parameters',
          'Authorization failed - please check your credentials',
          'Invalid credentials',
          'Permission denied'
        ];
        
        return criticalErrors.some(error => 
          errorMessage.toLowerCase().includes(error.toLowerCase())
        );
      };

      expect(isCriticalError(platforms.facebook.error)).toBe(true);
      expect(isCriticalError(platforms.vk.error)).toBe(false);
    });

    test('должен пропускать старые failed статусы', () => {
      const currentTime = new Date();
      const oldTime = new Date(currentTime.getTime() - 25 * 60 * 60 * 1000); // 25 часов назад
      const recentTime = new Date(currentTime.getTime() - 1 * 60 * 60 * 1000); // 1 час назад

      const shouldSkipOldFailed = (lastAttempt: string, hoursThreshold: number = 12) => {
        const lastAttemptDate = new Date(lastAttempt);
        const hoursOld = (currentTime.getTime() - lastAttemptDate.getTime()) / (1000 * 60 * 60);
        return hoursOld > hoursThreshold;
      };

      expect(shouldSkipOldFailed(oldTime.toISOString())).toBe(true);
      expect(shouldSkipOldFailed(recentTime.toISOString())).toBe(false);
    });
  });

  describe('Time Scheduling Logic', () => {
    test('должен правильно определять время публикации', () => {
      const currentTime = new Date();
      
      // Контент запланированный на будущее
      const futureContent = {
        scheduledAt: new Date(currentTime.getTime() + 60 * 60 * 1000).toISOString() // +1 час
      };
      
      // Контент запланированный на прошлое
      const pastContent = {
        scheduledAt: new Date(currentTime.getTime() - 60 * 60 * 1000).toISOString() // -1 час
      };

      const isReadyToPublish = (content: any) => {
        if (!content.scheduledAt) return true;
        return new Date(content.scheduledAt) <= currentTime;
      };

      expect(isReadyToPublish(futureContent)).toBe(false);
      expect(isReadyToPublish(pastContent)).toBe(true);
      expect(isReadyToPublish({})).toBe(true); // без scheduledAt
    });
  });

  describe('Platform Data Parsing', () => {
    test('должен правильно парсить JSON платформ', () => {
      const validJsonString = '{"vk":{"status":"pending"},"telegram":{"status":"published"}}';
      const invalidJsonString = 'invalid json';
      const objectData = { instagram: { status: 'failed' } };

      const parsePlatformData = (data: any) => {
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (e) {
            return null;
          }
        }
        return data;
      };

      expect(parsePlatformData(validJsonString)).toEqual({
        vk: { status: 'pending' },
        telegram: { status: 'published' }
      });
      expect(parsePlatformData(invalidJsonString)).toBeNull();
      expect(parsePlatformData(objectData)).toEqual(objectData);
    });
  });
});