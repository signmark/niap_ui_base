import { Router, Request, Response } from 'express';
import { VertexAIGeminiService } from './services/vertex-ai-gemini';

const router = Router();

export function registerVertexAIRoutes(app: Router) {
  console.log('[vertex-ai-routes] Регистрация маршрутов Vertex AI Gemini...');

  // Тестирование подключения к Vertex AI
  router.get('/api/vertex-ai/test', async (req: Request, res: Response) => {
    try {
      const vertexService = new VertexAIGeminiService();
      const isWorking = await vertexService.testConnection();
      
      res.json({
        success: isWorking,
        message: isWorking ? 'Vertex AI подключение работает' : 'Ошибка подключения к Vertex AI',
        service: 'vertex-ai-gemini'
      });
    } catch (error: any) {
      console.error('[vertex-ai-routes] Ошибка тестирования:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        service: 'vertex-ai-gemini'
      });
    }
  });

  // Генерация контента с помощью Vertex AI Gemini
  router.post('/api/vertex-ai/generate-content', async (req: Request, res: Response) => {
    try {
      const { prompt, model = 'gemini-2.0-flash-002' } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Промпт обязателен'
        });
      }

      console.log(`[vertex-ai-routes] Генерация контента с моделью ${model}`);
      
      const vertexService = new VertexAIGeminiService();
      const generatedContent = await vertexService.generateContent(prompt, model);
      
      res.json({
        success: true,
        content: generatedContent,
        model: model,
        service: 'vertex-ai-gemini'
      });
    } catch (error: any) {
      console.error('[vertex-ai-routes] Ошибка генерации контента:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        service: 'vertex-ai-gemini'
      });
    }
  });

  // Генерация контента для социальных сетей
  router.post('/api/vertex-ai/generate-social-content', async (req: Request, res: Response) => {
    try {
      const { 
        prompt, 
        platform = 'instagram', 
        tone = 'дружелюбный', 
        keywords = [],
        model = 'gemini-2.0-flash-002'
      } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Промпт обязателен'
        });
      }

      console.log(`[vertex-ai-routes] Генерация контента для ${platform} с тоном ${tone}`);
      
      const vertexService = new VertexAIGeminiService();
      const generatedContent = await vertexService.generateSocialContent(prompt, platform, tone, keywords);
      
      res.json({
        success: true,
        content: generatedContent,
        platform: platform,
        tone: tone,
        model: model,
        service: 'vertex-ai-gemini'
      });
    } catch (error: any) {
      console.error('[vertex-ai-routes] Ошибка генерации social контента:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        service: 'vertex-ai-gemini'
      });
    }
  });

  // Получение доступных моделей
  router.get('/api/vertex-ai/models', async (req: Request, res: Response) => {
    try {
      const vertexService = new VertexAIGeminiService();
      const models = vertexService.getAvailableModels();
      
      res.json({
        success: true,
        models: models,
        service: 'vertex-ai-gemini'
      });
    } catch (error: any) {
      console.error('[vertex-ai-routes] Ошибка получения моделей:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        service: 'vertex-ai-gemini'
      });
    }
  });

  app.use(router);
  console.log('[vertex-ai-routes] Маршруты Vertex AI Gemini зарегистрированы');
}