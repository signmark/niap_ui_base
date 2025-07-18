/**
 * Упрощенные тесты логики планировщика для рефакторинга
 */

describe('Scheduler Logic Tests', () => {
  test('должен правильно определять платформы готовые к публикации', () => {
    const platforms = {
      vk: { status: 'published', postUrl: 'https://vk.com/post123' },
      instagram: { status: 'pending' },
      facebook: { status: 'failed', error: 'Bad request - please check your parameters' },
      telegram: { status: 'failed', error: 'Network timeout' }
    };

    // Логика из планировщика
    function shouldSkipPlatform(platformData) {
      // Пропускаем уже опубликованные
      if (platformData.status === 'published' && platformData.postUrl && platformData.postUrl.trim() !== '') {
        return true;
      }

      // Пропускаем критические ошибки
      if (platformData.status === 'failed' && platformData.error) {
        const criticalErrors = [
          'Bad request - please check your parameters',
          'Authorization failed - please check your credentials',
          'Invalid credentials',
          'Permission denied'
        ];
        
        return criticalErrors.some(error => 
          platformData.error.toLowerCase().includes(error.toLowerCase())
        );
      }

      return false;
    }

    expect(shouldSkipPlatform(platforms.vk)).toBe(true); // Уже опубликовано
    expect(shouldSkipPlatform(platforms.instagram)).toBe(false); // Готово к публикации
    expect(shouldSkipPlatform(platforms.facebook)).toBe(true); // Критическая ошибка
    expect(shouldSkipPlatform(platforms.telegram)).toBe(false); // Временная ошибка, можно повторить
  });

  test('должен правильно обрабатывать время публикации', () => {
    const currentTime = new Date();
    
    function isReadyToPublish(content) {
      if (!content.scheduledAt) return true;
      return new Date(content.scheduledAt) <= currentTime;
    }

    const futureContent = {
      scheduledAt: new Date(currentTime.getTime() + 60 * 60 * 1000).toISOString() // +1 час
    };
    
    const pastContent = {
      scheduledAt: new Date(currentTime.getTime() - 60 * 60 * 1000).toISOString() // -1 час
    };

    expect(isReadyToPublish(futureContent)).toBe(false);
    expect(isReadyToPublish(pastContent)).toBe(true);
    expect(isReadyToPublish({})).toBe(true); // без scheduledAt
  });

  test('должен пропускать старые failed статусы', () => {
    const currentTime = new Date();
    
    function shouldSkipOldFailed(lastAttempt, hoursThreshold = 12) {
      if (!lastAttempt) return false;
      const lastAttemptDate = new Date(lastAttempt);
      const hoursOld = (currentTime.getTime() - lastAttemptDate.getTime()) / (1000 * 60 * 60);
      return hoursOld > hoursThreshold;
    }

    const oldTime = new Date(currentTime.getTime() - 25 * 60 * 60 * 1000); // 25 часов назад
    const recentTime = new Date(currentTime.getTime() - 1 * 60 * 60 * 1000); // 1 час назад

    expect(shouldSkipOldFailed(oldTime.toISOString())).toBe(true);
    expect(shouldSkipOldFailed(recentTime.toISOString())).toBe(false);
    expect(shouldSkipOldFailed(null)).toBe(false);
  });

  test('должен правильно парсить JSON платформ', () => {
    function parsePlatformData(data) {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch (e) {
          return null;
        }
      }
      return data;
    }

    const validJson = '{"vk":{"status":"pending"},"telegram":{"status":"published"}}';
    const invalidJson = 'invalid json';
    const objectData = { instagram: { status: 'failed' } };

    expect(parsePlatformData(validJson)).toEqual({
      vk: { status: 'pending' },
      telegram: { status: 'published' }
    });
    expect(parsePlatformData(invalidJson)).toBeNull();
    expect(parsePlatformData(objectData)).toEqual(objectData);
  });
});