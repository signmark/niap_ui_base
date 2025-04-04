import { Express, Request, Response } from 'express';
import { log } from './utils/logger';
import { claudeService } from './services/claude';
import { apiKeyService } from './services/api-keys';

/**
 * Регистрирует маршруты для работы с Claude AI API
 * 
 * @param app Express приложение
 */
export function registerClaudeRoutes(app: Express) {
  // Вспомогательная функция для получения токена из запроса
  const getAuthTokenFromRequest = (req: Request): string | null => {
    const authHeader = req.headers.authorization;
    return authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) // Убираем 'Bearer ' из начала
      : null;
  };
  
  // Промежуточное ПО для аутентификации запросов
  const authenticateUser = (req: Request, res: Response, next: any) => {
    // Получаем токен из заголовка авторизации
    const token = getAuthTokenFromRequest(req);
      
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация'
      });
    }
    next();
  };

  // Маршрут для улучшения текста с помощью Claude AI
  app.post('/api/claude/improve-text', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { text, prompt } = req.body;
      
      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Необходимо указать текст для улучшения'
        });
      }
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Необходимо указать инструкции для улучшения текста'
        });
      }

      // Проверяем наличие API ключа для Claude
      // Получаем токен для доступа к Directus API
      const token = getAuthTokenFromRequest(req);
      
      try {
        // Получаем userId из токена, если возможно
        let userId = null;
        if (token) {
          try {
            // @ts-ignore - используем глобальную переменную для доступа к directusApiManager
            const directusApi = global['directusApiManager']?.getDirectusClient();
            const userResponse = await directusApi.get('/users/me', {
              headers: { Authorization: `Bearer ${token}` }
            });
            userId = userResponse?.data?.data?.id;
            console.log(`Получен пользователь для Claude API: ${userId}`);
          } catch (error) {
            console.error("Ошибка при получении информации о пользователе:", error);
          }
        }
        
        const enhancedText = await claudeService.improveText(text, prompt, userId);
        
        return res.json({
          success: true,
          text: enhancedText
        });
      } catch (error: any) {
        if (error.message.includes('CLAUDE_API_KEY not found')) {
          return res.status(403).json({
            success: false,
            error: 'API ключ Claude не найден',
            needApiKey: true
          });
        }
        throw error;
      }
    } catch (error: any) {
      log(`[claude] Ошибка при улучшении текста: ${error.message}`);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при улучшении текста'
      });
    }
  });

  // Маршрут для сохранения API ключа Claude
  app.post('/api/claude/save-api-key', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'Необходимо указать API ключ'
        });
      }
      
      // Получаем токен для доступа к Directus API
      const token = getAuthTokenFromRequest(req);
      
      // Получаем userId из токена
      let userId = null;
      if (token) {
        try {
          // @ts-ignore - используем глобальную переменную для доступа к directusApiManager
          const directusApi = global['directusApiManager']?.getDirectusClient();
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
          console.log(`Получен пользователь для сохранения API ключа Claude: ${userId}`);
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
          return res.status(401).json({
            success: false,
            error: 'Не удалось получить информацию о пользователе'
          });
        }
      }
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Не удалось получить идентификатор пользователя'
        });
      }
      
      // Сохраняем API ключ
      const saved = await apiKeyService.saveApiKey(userId, 'claude', apiKey, token ? token : undefined);
      
      if (saved) {
        return res.json({
          success: true,
          message: 'API ключ успешно сохранен'
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Не удалось сохранить API ключ'
        });
      }
    } catch (error: any) {
      log(`[claude] Ошибка при сохранении API ключа: ${error.message}`);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при сохранении API ключа'
      });
    }
  });
}