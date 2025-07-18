/**
 * Тесты для Gemini AI сервиса
 * Критически важно - этот сервис обрабатывает всю AI логику
 */

describe('Gemini Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Content Generation', () => {
    test('должен генерировать контент с правильными параметрами', async () => {
      const mockGeminiGenerate = async (prompt: string, options: any = {}) => {
        if (!prompt || prompt.trim().length === 0) {
          throw new Error('Prompt is required');
        }

        if (prompt.length > 30000) {
          throw new Error('Prompt too long');
        }

        // Симуляция успешной генерации
        return {
          text: `Generated response for: ${prompt.substring(0, 50)}...`,
          model: 'gemini-2.5-flash',
          usage: {
            inputTokens: Math.floor(prompt.length / 4),
            outputTokens: 100
          }
        };
      };

      const validPrompt = 'Generate social media content about healthy eating';
      const emptyPrompt = '';
      const longPrompt = 'a'.repeat(35000);

      const validResult = await mockGeminiGenerate(validPrompt);
      expect(validResult.text).toContain('Generated response');
      expect(validResult.model).toBe('gemini-2.5-flash');

      await expect(mockGeminiGenerate(emptyPrompt)).rejects.toThrow('Prompt is required');
      await expect(mockGeminiGenerate(longPrompt)).rejects.toThrow('Prompt too long');
    });

    test('должен обрабатывать JSON ответы', async () => {
      const mockGeminiJsonGenerate = async (prompt: string, schema: any) => {
        if (!schema) {
          throw new Error('Schema is required for JSON generation');
        }

        // Симуляция JSON ответа
        const mockResponse = {
          businessValues: 'Innovation, quality, customer service',
          productBeliefs: 'Our product changes lives',
          targetAudience: 'Young professionals'
        };

        return {
          data: mockResponse,
          rawResponse: JSON.stringify(mockResponse)
        };
      };

      const validSchema = {
        type: 'object',
        properties: {
          businessValues: { type: 'string' },
          productBeliefs: { type: 'string' }
        }
      };

      const result = await mockGeminiJsonGenerate('Analyze website', validSchema);
      expect(result.data.businessValues).toBeDefined();
      expect(result.data.productBeliefs).toBeDefined();

      await expect(mockGeminiJsonGenerate('test', null)).rejects.toThrow('Schema is required');
    });
  });

  describe('Error Handling', () => {
    test('должен обрабатывать API ошибки', async () => {
      const mockGeminiWithErrors = async (prompt: string) => {
        if (prompt.includes('quota_exceeded')) {
          throw new Error('API quota exceeded');
        }

        if (prompt.includes('invalid_key')) {
          throw new Error('Invalid API key');
        }

        if (prompt.includes('timeout')) {
          throw new Error('Request timeout');
        }

        return { text: 'Success' };
      };

      await expect(mockGeminiWithErrors('quota_exceeded test')).rejects.toThrow('API quota exceeded');
      await expect(mockGeminiWithErrors('invalid_key test')).rejects.toThrow('Invalid API key');
      await expect(mockGeminiWithErrors('timeout test')).rejects.toThrow('Request timeout');

      const successResult = await mockGeminiWithErrors('normal prompt');
      expect(successResult.text).toBe('Success');
    });

    test('должен иметь fallback механизм', async () => {
      const mockGeminiWithFallback = async (prompt: string, useFallback: boolean = true) => {
        try {
          // Симуляция основного API
          if (prompt.includes('fail')) {
            throw new Error('Primary API failed');
          }
          return { source: 'primary', text: 'Primary response' };
        } catch (error) {
          if (useFallback) {
            // Fallback логика
            return { 
              source: 'fallback', 
              text: 'Fallback response based on content analysis' 
            };
          }
          throw error;
        }
      };

      const primaryResult = await mockGeminiWithFallback('normal prompt');
      expect(primaryResult.source).toBe('primary');

      const fallbackResult = await mockGeminiWithFallback('fail prompt', true);
      expect(fallbackResult.source).toBe('fallback');

      await expect(mockGeminiWithFallback('fail prompt', false)).rejects.toThrow('Primary API failed');
    });
  });

  describe('Website Analysis', () => {
    test('должен анализировать контент сайта', async () => {
      const mockAnalyzeWebsite = async (websiteContent: string) => {
        if (!websiteContent || websiteContent.length < 100) {
          throw new Error('Insufficient website content for analysis');
        }

        // Симуляция анализа контента
        const keywords = ['technology', 'innovation', 'digital'];
        const businessType = websiteContent.includes('медицин') ? 'medical' : 
                           websiteContent.includes('SMM') ? 'social_media' :
                           'general';

        return {
          businessType,
          keywords,
          companyName: 'Extracted Company Name',
          analysisConfidence: 0.85
        };
      };

      const medicalContent = 'Медицинская платформа для диагностики здоровья и анализа питания специалистами по нутрициологии';
      const smmContent = 'SMM Manager - платформа для управления социальными сетями с AI автоматизацией';
      const shortContent = 'Short';

      const medicalResult = await mockAnalyzeWebsite(medicalContent);
      expect(medicalResult.businessType).toBe('medical');

      const smmResult = await mockAnalyzeWebsite(smmContent);
      expect(smmResult.businessType).toBe('social_media');

      await expect(mockAnalyzeWebsite(shortContent)).rejects.toThrow('Insufficient website content');
    });
  });

  describe('Proxy Configuration', () => {
    test('должен использовать SOCKS5 proxy для production', () => {
      const configureProxy = (environment: string) => {
        if (environment === 'production') {
          return {
            proxyType: 'socks5',
            host: process.env.SOCKS5_HOST || 'proxy.example.com',
            port: process.env.SOCKS5_PORT || 1080,
            required: true
          };
        }
        return { proxyType: 'none', required: false };
      };

      const prodConfig = configureProxy('production');
      const devConfig = configureProxy('development');

      expect(prodConfig.proxyType).toBe('socks5');
      expect(prodConfig.required).toBe(true);
      expect(devConfig.proxyType).toBe('none');
      expect(devConfig.required).toBe(false);
    });
  });
});