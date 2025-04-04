import { Express, Request, Response } from 'express';
import { claudeService } from './services/claude';
import { apiKeyService } from './services/api-keys';

/**
 * Регистрирует маршруты для работы с Claude AI API
 * @param app Экземпляр Express приложения
 */
export function registerClaudeRoutes(app: Express): void {
  /**
   * Маршрут для улучшения текста с помощью Claude AI
   * Принимает текст и инструкции, возвращает улучшенный текст
   * Требует авторизованного пользователя
   */
  app.post('/api/claude/improve-text', async (req: Request, res: Response) => {
    try {
      // Получаем токен авторизации из заголовка запроса
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }

      const authToken = authHeader.substring(7);
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
      }

      const { text, prompt } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Не указан текст для улучшения' });
      }

      if (!prompt) {
        return res.status(400).json({ error: 'Не указаны инструкции по улучшению' });
      }

      // Проверяем наличие API ключа Claude
      const claudeApiKey = await apiKeyService.getApiKey(req.user.id, 'claude', authToken);
      if (!claudeApiKey) {
        return res.status(400).json({ 
          error: 'API ключ Claude не найден',
          needApiKey: true
        });
      }

      // Улучшаем текст с помощью Claude AI
      const improvedText = await claudeService.improveText(text, prompt, req.user.id, authToken);

      return res.status(200).json({ 
        success: true,
        text: improvedText 
      });
    } catch (error) {
      console.error('Ошибка при улучшении текста:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('API ключ') || error.message.includes('API key')) {
          return res.status(400).json({ 
            error: error.message,
            needApiKey: true
          });
        }
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'Неизвестная ошибка при улучшении текста' });
    }
  });

  /**
   * Маршрут для генерации текста с помощью Claude AI
   * Принимает инструкции, возвращает сгенерированный текст
   * Требует авторизованного пользователя
   */
  app.post('/api/claude/generate-text', async (req: Request, res: Response) => {
    try {
      // Получаем токен авторизации из заголовка запроса
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }

      const authToken = authHeader.substring(7);
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
      }

      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Не указаны инструкции для генерации текста' });
      }

      // Проверяем наличие API ключа Claude
      const claudeApiKey = await apiKeyService.getApiKey(req.user.id, 'claude', authToken);
      if (!claudeApiKey) {
        return res.status(400).json({ 
          error: 'API ключ Claude не найден',
          needApiKey: true
        });
      }

      // Генерируем текст с помощью Claude AI
      const generatedText = await claudeService.generateText(prompt, req.user.id, authToken);

      return res.status(200).json({ 
        success: true,
        text: generatedText 
      });
    } catch (error) {
      console.error('Ошибка при генерации текста:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('API ключ') || error.message.includes('API key')) {
          return res.status(400).json({ 
            error: error.message,
            needApiKey: true
          });
        }
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'Неизвестная ошибка при генерации текста' });
    }
  });

  /**
   * Маршрут для проверки наличия API ключа Claude AI
   * Возвращает статус наличия ключа
   * Требует авторизованного пользователя
   */
  app.get('/api/claude/check-api-key', async (req: Request, res: Response) => {
    try {
      // Получаем токен авторизации из заголовка запроса
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }

      const authToken = authHeader.substring(7);
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
      }

      // Проверяем наличие API ключа Claude
      const claudeApiKey = await apiKeyService.getApiKey(req.user.id, 'claude', authToken);
      
      return res.status(200).json({ 
        success: true,
        hasApiKey: !!claudeApiKey
      });
    } catch (error) {
      console.error('Ошибка при проверке API ключа Claude:', error);
      
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'Неизвестная ошибка при проверке API ключа' });
    }
  });

  /**
   * Маршрут для сохранения API ключа Claude AI
   * Принимает ключ, сохраняет его в хранилище
   * Требует авторизованного пользователя
   */
  app.post('/api/claude/save-api-key', async (req: Request, res: Response) => {
    try {
      // Получаем токен авторизации из заголовка запроса
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }

      const authToken = authHeader.substring(7);
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
      }

      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: 'Не указан API ключ' });
      }

      // Сохраняем API ключ Claude
      const saved = await apiKeyService.saveApiKey(req.user.id, 'claude', apiKey, authToken);
      
      if (!saved) {
        return res.status(500).json({ error: 'Не удалось сохранить API ключ' });
      }

      return res.status(200).json({ 
        success: true,
        message: 'API ключ Claude успешно сохранен'
      });
    } catch (error) {
      console.error('Ошибка при сохранении API ключа Claude:', error);
      
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'Неизвестная ошибка при сохранении API ключа' });
    }
  });
}