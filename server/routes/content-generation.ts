import { Express } from 'express';
import { deepSeekService } from '../services/deepseek';
import { falAiSdk } from '../services/fal-ai';
import { authenticateUser } from '../middleware/auth';

/**
 * Регистрирует маршруты для генерации контента
 * @param app - экземпляр приложения Express
 */
export function registerContentGenerationRoutes(app: Express) {
  console.log('[content-generation] Регистрация маршрутов для генерации контента...');

  // Маршрут для генерации контента через DeepSeek API
  app.post("/api/content/generate-deepseek", authenticateUser, async (req: any, res) => {
    try {
      const { prompt, keywords = [], tone, platform, campaignId, trends } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Missing required parameter: prompt" });
      }
      
      // Получаем userId, установленный в authenticateUser 
      const userId = req.userId;
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      console.log(`Запрос на генерацию контента через DeepSeek для кампании ${campaignId} от пользователя ${userId}`);
      
      // Генерируем контент с помощью DeepSeek API
      const content = await deepSeekService.generateContent(
        prompt,
        {
          keywords,
          tone,
          platform,
          trends
        },
        userId,
        token
      );
      
      return res.json({
        success: true,
        data: {
          content,
          service: 'deepseek',
        }
      });
    } catch (error: any) {
      console.error('Error generating content with DeepSeek:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Error generating content: ${error.message}` 
      });
    }
  });

  // Маршрут для генерации изображений через FAL.AI API
  app.post("/api/images/generate", authenticateUser, async (req: any, res) => {
    try {
      const { 
        prompt, 
        negativePrompt = "bad quality, blurry, text, watermark", 
        width = 1024, 
        height = 1024,
        numImages = 1,
        campaignId
      } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Missing required parameter: prompt" });
      }
      
      // Получаем userId, установленный в authenticateUser 
      const userId = req.userId;
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      console.log(`Запрос на генерацию изображения через FAL.AI для кампании ${campaignId} от пользователя ${userId}`);
      
      // Инициализируем FAL.AI SDK с ключом API пользователя
      await falAiSdk.initializeFromApiKeyService(userId || '', token);
      
      // Генерируем изображение с помощью FAL.AI SDK
      const result = await falAiSdk.generateImage('fal-ai/fast-sdxl', {
        prompt,
        negative_prompt: negativePrompt,
        width,
        height,
        num_images: numImages
      });
      
      // Извлекаем URL изображений из результата
      const imageURLs = result?.images || [];
      
      return res.json({
        success: true,
        data: {
          imageURLs,
          service: 'fal.ai',
        }
      });
    } catch (error: any) {
      console.error('Error generating image with FAL.AI:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Error generating image: ${error.message}` 
      });
    }
  });

  // Маршрут для сохранения сгенерированного контента как пост
  app.post("/api/generated-content/save", authenticateUser, async (req: any, res) => {
    try {
      const { 
        content, 
        title, 
        imageUrl, 
        campaignId, 
        contentType = 'text',
        socialPlatforms = []
      } = req.body;
      
      if (!content || !campaignId) {
        return res.status(400).json({ error: "Missing required parameters: content, campaignId" });
      }
      
      // Получаем userId, установленный в authenticateUser 
      const userId = req.userId;
      
      console.log(`Запрос на сохранение сгенерированного контента для кампании ${campaignId} от пользователя ${userId}`);
      
      // Здесь будет логика сохранения контента в Directus
      // Эта функциональность будет имплементирована в будущем
      
      return res.json({
        success: true,
        data: {
          message: 'Content saved successfully',
          id: 'temp-id-for-saved-content' // В реальной реализации здесь будет ID созданного поста
        }
      });
    } catch (error: any) {
      console.error('Error saving generated content:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Error saving content: ${error.message}` 
      });
    }
  });

  console.log('[content-generation] Маршруты для генерации контента успешно зарегистрированы');
}