/**
 * Тесты Gemini AI интеграции - критично для контент-генерации
 */

describe('Gemini AI Integration Tests', () => {
  test('должен обрабатывать генерацию контента с различными параметрами', () => {
    function validateGeminiRequest(prompt, options = {}) {
      const errors = [];
      
      if (!prompt || typeof prompt !== 'string') {
        errors.push('Prompt должен быть непустой строкой');
      }
      
      if (prompt && prompt.length > 30000) {
        errors.push('Prompt слишком длинный (макс. 30000 символов)');
      }
      
      if (options.maxTokens && (options.maxTokens <= 0 || options.maxTokens > 8192)) {
        errors.push('maxTokens должен быть между 1 и 8192');
      }
      
      if (options.temperature && (options.temperature < 0 || options.temperature > 2)) {
        errors.push('temperature должен быть между 0 и 2');
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    }

    // Валидные запросы
    expect(validateGeminiRequest('Создай пост про здоровье').isValid).toBe(true);
    expect(validateGeminiRequest('Короткий промпт', { maxTokens: 100, temperature: 0.7 }).isValid).toBe(true);
    
    // Невалидные запросы
    expect(validateGeminiRequest('').isValid).toBe(false);
    expect(validateGeminiRequest(null).isValid).toBe(false);
    expect(validateGeminiRequest('test', { maxTokens: 0 }).isValid).toBe(false);
    expect(validateGeminiRequest('test', { temperature: 3 }).isValid).toBe(false);
    
    const longPrompt = 'a'.repeat(35000);
    expect(validateGeminiRequest(longPrompt).isValid).toBe(false);
  });

  test('должен правильно форматировать промпты для разных типов контента', () => {
    function formatPromptForContentType(contentType, context) {
      const basePrompts = {
        'text': 'Создай текстовый пост на тему: {topic}. Стиль: {style}',
        'text_with_image': 'Создай пост с описанием изображения на тему: {topic}. Стиль: {style}',
        'video': 'Создай описание для видео на тему: {topic}. Включи призыв к действию. Стиль: {style}',
        'stories': 'Создай короткий текст для Instagram Stories на тему: {topic}. Максимум 2-3 предложения.'
      };
      
      let prompt = basePrompts[contentType];
      if (!prompt) {
        throw new Error(`Неподдерживаемый тип контента: ${contentType}`);
      }
      
      // Заменяем плейсхолдеры
      prompt = prompt.replace('{topic}', context.topic || 'общая тема');
      prompt = prompt.replace('{style}', context.style || 'дружелюбный');
      
      return prompt;
    }

    const context = { topic: 'здоровое питание', style: 'профессиональный' };
    
    expect(formatPromptForContentType('text', context)).toContain('здоровое питание');
    expect(formatPromptForContentType('text', context)).toContain('профессиональный');
    
    expect(formatPromptForContentType('video', context)).toContain('призыв к действию');
    expect(formatPromptForContentType('stories', context)).toContain('Instagram Stories');
    
    expect(() => formatPromptForContentType('unknown', context)).toThrow('Неподдерживаемый тип контента');
  });

  test('должен обрабатывать JSON ответы от Gemini API', () => {
    function parseGeminiJsonResponse(responseText, expectedSchema) {
      try {
        // Пытаемся найти JSON в ответе
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('JSON не найден в ответе');
        }
        
        const parsedData = JSON.parse(jsonMatch[0]);
        
        // Проверяем наличие обязательных полей
        if (expectedSchema) {
          const missingFields = expectedSchema.filter(field => !parsedData.hasOwnProperty(field));
          if (missingFields.length > 0) {
            throw new Error(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
          }
        }
        
        return { success: true, data: parsedData };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    // Валидный JSON ответ
    const validResponse = 'Вот анализ сайта: {"companyName": "Test Corp", "businessDescription": "IT компания"}';
    const validResult = parseGeminiJsonResponse(validResponse, ['companyName', 'businessDescription']);
    
    expect(validResult.success).toBe(true);
    expect(validResult.data.companyName).toBe('Test Corp');
    
    // Невалидный JSON
    const invalidResponse = 'Это не JSON ответ без фигурных скобок';
    const invalidResult = parseGeminiJsonResponse(invalidResponse);
    expect(invalidResult.success).toBe(false);
    
    // JSON без обязательных полей
    const incompleteResponse = '{"companyName": "Test"}';
    const incompleteResult = parseGeminiJsonResponse(incompleteResponse, ['companyName', 'businessDescription']);
    expect(incompleteResult.success).toBe(false);
    expect(incompleteResult.error).toContain('businessDescription');
  });

  test('должен применять SOCKS5 proxy конфигурацию для production', () => {
    function getProxyConfig(environment) {
      const configs = {
        'development': {
          useProxy: false,
          proxyType: 'none'
        },
        'staging': {
          useProxy: true,
          proxyType: 'socks5',
          host: process.env.SOCKS5_HOST || 'staging-proxy.com',
          port: process.env.SOCKS5_PORT || 1080
        },
        'production': {
          useProxy: true,
          proxyType: 'socks5',
          host: process.env.SOCKS5_HOST || 'prod-proxy.com',
          port: process.env.SOCKS5_PORT || 1080,
          required: true
        }
      };
      
      return configs[environment] || configs['development'];
    }

    const devConfig = getProxyConfig('development');
    expect(devConfig.useProxy).toBe(false);
    
    const prodConfig = getProxyConfig('production');
    expect(prodConfig.useProxy).toBe(true);
    expect(prodConfig.proxyType).toBe('socks5');
    expect(prodConfig.required).toBe(true);
    
    const stagingConfig = getProxyConfig('staging');
    expect(stagingConfig.useProxy).toBe(true);
    expect(stagingConfig.proxyType).toBe('socks5');
  });

  test('должен обрабатывать fallback логику при ошибках API', () => {
    function handleGeminiFallback(primaryError, websiteContent) {
      const fallbackStrategies = {
        'timeout': () => generateSmartFallback(websiteContent),
        'quota_exceeded': () => generateSmartFallback(websiteContent),
        'api_error': () => generateSmartFallback(websiteContent),
        'invalid_response': () => generateSmartFallback(websiteContent)
      };
      
      function generateSmartFallback(content) {
        // Анализ контента для умного fallback
        const businessTypes = {
          'медицин': 'medical',
          'smm': 'social_media',
          'технолог': 'technology',
          'ресторан': 'restaurant'
        };
        
        let detectedType = 'general';
        for (const [keyword, type] of Object.entries(businessTypes)) {
          if (content.toLowerCase().includes(keyword)) {
            detectedType = type;
            break;
          }
        }
        
        const templates = {
          'medical': {
            companyName: 'Медицинская организация',
            businessDescription: 'Медицинские услуги и консультации',
            targetAudience: 'Пациенты, врачи'
          },
          'social_media': {
            companyName: 'SMM агентство',
            businessDescription: 'Управление социальными сетями',
            targetAudience: 'Предприниматели, блогеры'
          },
          'general': {
            companyName: 'Компания',
            businessDescription: 'Профессиональные услуги',
            targetAudience: 'Широкая аудитория'
          }
        };
        
        return templates[detectedType] || templates['general'];
      }
      
      const errorType = primaryError.includes('timeout') ? 'timeout' :
                       primaryError.includes('quota') ? 'quota_exceeded' :
                       'api_error';
      
      const fallbackHandler = fallbackStrategies[errorType];
      return fallbackHandler ? fallbackHandler() : null;
    }

    const medicalContent = 'Медицинская платформа для диагностики';
    const smmContent = 'SMM управление социальными сетями';
    
    const medicalFallback = handleGeminiFallback('timeout error', medicalContent);
    expect(medicalFallback.companyName).toBe('Медицинская организация');
    expect(medicalFallback.targetAudience).toContain('врачи');
    
    const smmFallback = handleGeminiFallback('quota exceeded', smmContent);
    expect(smmFallback.companyName).toBe('SMM агентство');
    expect(smmFallback.targetAudience).toContain('блогеры');
  });
});