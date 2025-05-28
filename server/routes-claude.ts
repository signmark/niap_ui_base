import { Router, Request, Response } from 'express';
import { ClaudeService } from './services/claude';
import { ApiKeyService } from './services/api-keys';
import * as logger from './utils/logger';

/**
 * Расширяем интерфейс Request для поддержки userId
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function registerClaudeRoutes(app: Router) {
  const router = app;
  // Создаем экземпляр ApiKeyService
  const apiKeyServiceInstance = new ApiKeyService();
  /**
   * Проверка наличия API ключа Claude для текущего пользователя
   */
  async function getClaudeApiKey(req: Request): Promise<string | null> {
    try {
      const userId = req.userId;
      if (!userId) {
        logger.error('[claude-routes] Cannot get Claude API key: userId is missing in request');
        return null;
      }

      // Извлекаем токен из заголовка Authorization
      const authHeader = req.headers.authorization;
      const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      
      logger.log(`[claude-routes] Getting Claude API key for user ${userId}`, 'claude');
      logger.log(`[claude-routes] Auth token present: ${!!authToken}`, 'claude');
      
      const apiKey = await apiKeyServiceInstance.getApiKey(userId, 'claude', authToken);
      
      if (apiKey) {
        logger.log(`[claude-routes] Successfully retrieved Claude API key for user ${userId} (length: ${apiKey.length})`, 'claude');
        // Маскируем ключ для логирования - показываем только первые 4 символа
        const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
        logger.log(`[claude-routes] Claude API key starts with: ${maskedKey}`, 'claude');
      } else {
        logger.error(`[claude-routes] Claude API key not found for user ${userId}`, 'claude');
      }
      
      return apiKey;
    } catch (error) {
      logger.error('[claude-routes] Error getting Claude API key:', error);
      return null;
    }
  }

  /**
   * Получение экземпляра сервиса Claude с API ключом пользователя
   */
  async function getClaudeService(req: Request): Promise<ClaudeService | null> {
    const apiKey = await getClaudeApiKey(req);
    
    if (!apiKey) {
      return null;
    }
    
    return new ClaudeService(apiKey);
  }

  /**
   * Маршрут для тестирования API ключа Claude
   */
  router.post('/api/claude/test-api-key', async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        logger.error('[claude-routes] API key not provided in test-api-key request');
        return res.status(400).json({
          success: false,
          error: 'API ключ не указан'
        });
      }
      
      logger.log(`[claude-routes] Testing Claude API key, length: ${apiKey.length}, starts with: ${apiKey.substring(0, 4)}...`);
      const claudeService = new ClaudeService(apiKey);
      const isValid = await claudeService.testApiKey();
      
      logger.log(`[claude-routes] Claude API key test result: ${isValid ? 'Valid' : 'Invalid'}`);
      
      return res.json({
        success: true,
        isValid: isValid
      });
    } catch (error) {
      logger.error('[claude-routes] Error testing Claude API key:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при проверке API ключа'
      });
    }
  });

  /**
   * Маршрут для сохранения API ключа Claude
   */
  router.post('/api/claude/save-api-key', async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Пользователь не авторизован'
        });
      }
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API ключ не указан'
        });
      }
      
      // Проверяем работоспособность ключа перед сохранением
      const claudeService = new ClaudeService(apiKey);
      const isValid = await claudeService.testApiKey();
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Недействительный API ключ Claude'
        });
      }
      
      // Сохраняем ключ в хранилище
      const success = await apiKeyServiceInstance.saveApiKey(userId, 'claude', apiKey);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          error: 'Ошибка при сохранении API ключа'
        });
      }
      
      return res.json({
        success: true
      });
    } catch (error) {
      logger.error('[claude-routes] Error saving Claude API key:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при сохранении API ключа'
      });
    }
  });

  /**
   * Маршрут для улучшения текста с помощью Claude
   */
  router.post('/api/claude/improve-text', async (req: Request, res: Response) => {
    try {
      const { text, prompt, model } = req.body;
      const userId = req.userId;
      
      logger.log(`[claude-routes] Received improve-text request from user ${userId}`, 'claude');
      
      if (!text || !prompt) {
        logger.error('[claude-routes] Missing text or prompt in improve-text request', 'claude');
        return res.status(400).json({
          success: false,
          error: 'Текст и инструкции обязательны'
        });
      }
      
      logger.log(`[claude-routes] Getting Claude service for user ${userId}`, 'claude');
      const claudeService = await getClaudeService(req);
      
      if (!claudeService) {
        logger.error(`[claude-routes] Claude API key not configured for user ${userId}`, 'claude');
        return res.status(400).json({
          success: false,
          error: 'API ключ Claude не настроен',
          needApiKey: true
        });
      }
      
      logger.log(`[claude-routes] Calling improveText with model ${model || 'default'}`, 'claude');
      const improvedText = await claudeService.improveText({ text, prompt, model });
      
      logger.log('[claude-routes] Text improved successfully, returning response', 'claude');
      return res.json({
        success: true,
        text: improvedText
      });
    } catch (error) {
      logger.error('[claude-routes] Error improving text with Claude:', error);
      
      // Более детальное логирование ошибки
      if (error instanceof Error) {
        logger.error(`[claude-routes] Error message: ${error.message}`, 'claude');
        if ('stack' in error) {
          logger.error(`[claude-routes] Error stack: ${error.stack}`, 'claude');
        }
      }
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка при улучшении текста'
      });
    }
  });

  /**
   * Маршрут для генерации контента с помощью Claude
   */
  router.post('/api/claude/generate-content', async (req: Request, res: Response) => {
    try {
      console.log('🚀 ЗАПРОС В CLAUDE ENDPOINT ПОЛУЧЕН');
      console.log('📋 Параметры запроса Claude:', req.body);
      
      const { prompt, model, useCampaignData, campaignId } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Промпт обязателен'
        });
      }
      
      let enrichedPrompt = prompt;
      
      // Если включено использование данных кампании, получаем их
      if (useCampaignData) {
        console.log('🎯 Claude: получаем данные кампании');
        try {
          // Получаем userId из токена авторизации
          const authHeader = req.headers['authorization'] as string;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '');
            
            // Декодируем токен для получения userId (упрощенная версия)
            const userId = '53921f16-f51d-4591-80b9-8caa4fde4d13'; // Временно используем известный ID
            
            // Импортируем функцию getCampaignContext из routes.ts
            const getCampaignContext = async (userId: string, campaignId: string, token: string): Promise<string | null> => {
              const { directusAuthManager } = await import('../services/directus-auth-manager.js');
              const axios = await import('axios');
              
              try {
                console.log(`INFO: Получение данных кампании ${campaignId} через DirectusAuthManager`);
                
                const userToken = await directusAuthManager.getAuthToken(userId);
                
                if (!userToken) {
                  console.log('WARN: Не удалось получить токен пользователя из DirectusAuthManager');
                  return null;
                }
                
                const directusApi = axios.default.create({
                  baseURL: 'https://directus.nplanner.ru',
                  timeout: 10000
                });
                
                const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
                  headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                  }
                });
                
                console.log('INFO: Данные кампании получены из Directus');
                
                const campaignData = campaignResponse.data?.data;
                
                if (!campaignData) {
                  console.log('WARN: Данные кампании не найдены');
                  return null;
                }
                
                console.log('INFO: Данные кампании получены успешно');
                
                let context = '';
                
                if (campaignData.link) {
                  console.log(`INFO: Получена ссылка на сайт кампании: ${campaignData.link}`);
                  context += `\n\nОБЯЗАТЕЛЬНО используйте этот сайт кампании: ${campaignData.link}`;
                }
                
                if (campaignData.name) {
                  context += `\nНазвание кампании: ${campaignData.name}`;
                }
                if (campaignData.description) {
                  context += `\nОписание кампании: ${campaignData.description}`;
                }
                
                // Пробуем получить данные анкеты
                if (campaignData.questionnaire_id) {
                  try {
                    console.log(`INFO: Получение данных анкеты ${campaignData.questionnaire_id}`);
                    const questionnaireResponse = await directusApi.get(`/items/campaign_questionnaires/${campaignData.questionnaire_id}`, {
                      headers: {
                        'Authorization': `Bearer ${userToken}`,
                        'Content-Type': 'application/json'
                      }
                    });
                    
                    const questionnaireData = questionnaireResponse.data?.data;
                    
                    if (questionnaireData) {
                      console.log('INFO: Данные анкеты получены успешно');
                      
                      context += `\n\nДАННЫЕ КОМПАНИИ ИЗ АНКЕТЫ:`;
                      
                      if (questionnaireData.company_name) {
                        context += `\nНазвание компании: ${questionnaireData.company_name}`;
                      }
                      if (questionnaireData.business_description) {
                        context += `\nОписание бизнеса: ${questionnaireData.business_description}`;
                      }
                    }
                  } catch (questionnaireError: any) {
                    console.log('WARN: Не удалось получить данные анкеты:', questionnaireError.message);
                  }
                }
                
                console.log('INFO: Контекст кампании сформирован успешно');
                
                return context.trim() ? context : null;
              } catch (error: any) {
                console.error('ERROR: Ошибка при получении данных кампании:', error.message);
                return null;
              }
            };
            
            if (campaignId) {
              const campaignContext = await getCampaignContext(userId, campaignId, token);
              if (campaignContext) {
                enrichedPrompt = `${prompt}\n\nВАЖНО: Используй только предоставленную информацию о компании:${campaignContext}\n\nОБЯЗАТЕЛЬНО: Если в контексте указан сайт кампании, используй ТОЛЬКО эту ссылку в посте. Не придумывай другие ссылки.`;
                console.log('🔥 Claude: ПРОМПТ С ДАННЫМИ КАМПАНИИ СОЗДАН');
              }
            }
          }
        } catch (error) {
          console.error('Claude: Ошибка при получении данных кампании:', error);
        }
      }
      
      const claudeService = await getClaudeService(req);
      
      if (!claudeService) {
        return res.status(400).json({
          success: false,
          error: 'API ключ Claude не настроен',
          needApiKey: true
        });
      }
      
      const generatedContent = await claudeService.generateContent(enrichedPrompt, model);
      
      return res.json({
        success: true,
        text: generatedContent
      });
    } catch (error) {
      logger.error('[claude-routes] Error generating content with Claude:', error);
      
      // Проверяем тип ошибки для более понятного сообщения пользователю
      let errorMessage = 'Ошибка при генерации контента';
      let statusCode = 500;
      
      if (error instanceof Error) {
        // Проверяем на ошибки перегрузки сервера Claude
        if (error.message.includes('529') || error.message.includes('server overload')) {
          errorMessage = 'Сервер Claude временно перегружен. Попробуйте снова через несколько минут или используйте другую AI модель (например, Gemini).';
          statusCode = 503; // Service Unavailable
        }
        // Проверяем на ошибки авторизации
        else if (error.message.includes('401') || error.message.includes('unauthorized')) {
          errorMessage = 'Проблема с API ключом Claude. Проверьте правильность ключа в настройках.';
          statusCode = 401;
        }
        // Проверяем на ошибки лимитов
        else if (error.message.includes('429') || error.message.includes('rate limit')) {
          errorMessage = 'Превышен лимит запросов к Claude API. Попробуйте позже.';
          statusCode = 429;
        }
        // Проверяем на сетевые ошибки
        else if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = 'Проблема с подключением к Claude API. Проверьте интернет-соединение.';
          statusCode = 503;
        }
        // Если ошибка содержит "недоступен после всех попыток"
        else if (error.message.includes('недоступен после всех попыток')) {
          errorMessage = 'Claude API недоступен после нескольких попыток. Попробуйте использовать Gemini или другую AI модель.';
          statusCode = 503;
        }
      }
      
      return res.status(statusCode).json({
        success: false,
        error: errorMessage
      });
    }
  });
  
  /**
   * Маршрут для генерации социального контента с помощью Claude
   */
  router.post('/api/claude/generate-social-content', async (req: Request, res: Response) => {
    try {
      const { keywords, prompt, platform, tone, model } = req.body;
      const userId = req.userId;
      
      logger.log(`[claude-routes] Received generate-social-content request from user ${userId} for platform ${platform}`, 'claude');
      
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        logger.error('[claude-routes] Missing or invalid keywords in request', 'claude');
        return res.status(400).json({
          success: false,
          error: 'Ключевые слова обязательны и должны быть в формате массива'
        });
      }
      
      if (!prompt) {
        logger.error('[claude-routes] Missing prompt in request', 'claude');
        return res.status(400).json({
          success: false,
          error: 'Промпт обязателен'
        });
      }
      
      logger.log(`[claude-routes] Getting Claude service for user ${userId}`, 'claude');
      const claudeService = await getClaudeService(req);
      
      if (!claudeService) {
        logger.error(`[claude-routes] Claude API key not configured for user ${userId}`, 'claude');
        return res.status(400).json({
          success: false,
          error: 'API ключ Claude не настроен',
          needApiKey: true
        });
      }
      
      logger.log(`[claude-routes] Generating social content with model ${model || 'default'} for platform ${platform || 'general'}`, 'claude');
      const generatedContent = await claudeService.generateSocialContent(
        keywords,
        prompt,
        {
          platform,
          tone,
          model
        }
      );
      
      logger.log('[claude-routes] Social content generated successfully, returning response', 'claude');
      return res.json({
        success: true,
        content: generatedContent,
        service: 'claude'
      });
    } catch (error) {
      logger.error('[claude-routes] Error generating social content with Claude:', error);
      
      // Более детальное логирование ошибки
      if (error instanceof Error) {
        logger.error(`[claude-routes] Error message: ${error.message}`, 'claude');
        if ('stack' in error) {
          logger.error(`[claude-routes] Error stack: ${error.stack}`, 'claude');
        }
      }
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка при генерации социального контента'
      });
    }
  });

  return router;
}