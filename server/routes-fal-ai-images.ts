import { Express, Request, Response } from 'express';
import { log } from './utils/logger';
import { falAiUniversalService } from './services/fal-ai-universal';

/**
 * Регистрирует универсальный интерфейс для работы с различными моделями генерации изображений FAL.AI
 * Поддерживает различные модели (schnell, sdxl, fast-sdxl, fooocus и др.)
 * 
 * @param app Express приложение
 */
export function registerFalAiImageRoutes(app: Express) {
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

  // Маршрут для генерации изображений через универсальный интерфейс FAL.AI
  app.post('/api/generate-universal-image', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { prompt, negativePrompt, width, height, numImages, model } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Необходимо указать промпт для генерации'
        });
      }
      
      const token = getAuthTokenFromRequest(req) || '';
      
      log(`[fal-ai-images] Запрос на генерацию изображения: модель=${model || 'sdxl'}, количество=${numImages || 1}`);
      
      const results = await falAiUniversalService.generateImages({
        prompt,
        negativePrompt,
        width,
        height,
        numImages,
        model,
        token
      });
      
      return res.json({
        success: true,
        data: results
      });
    } catch (error: any) {
      log(`[fal-ai-images] Ошибка при генерации изображения: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при генерации изображения'
      });
    }
  });

  // Маршрут для проверки статуса API FAL.AI
  app.get('/api/fal-ai-status', async (_req: Request, res: Response) => {
    try {
      // Упрощенная проверка статуса
      return res.json({
        success: true,
        status: {
          available: true,
          message: 'FAL.AI API доступен'
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при проверке статуса API'
      });
    }
  });

  // Маршрут для получения списка доступных моделей FAL.AI
  app.get('/api/fal-ai-models', async (_req: Request, res: Response) => {
    try {
      // Список поддерживаемых моделей
      const models = [
        {
          id: 'fast-sdxl',
          name: 'Fast SDXL',
          description: 'Быстрая версия Stable Diffusion XL'
        },
        {
          id: 'sdxl',
          name: 'Stable Diffusion XL',
          description: 'Полная версия Stable Diffusion XL'
        },
        {
          id: 'schnell',
          name: 'Schnell',
          description: 'Schnell - высококачественная модель для быстрой генерации'
        },
        {
          id: 'fooocus',
          name: 'Fooocus',
          description: 'Fooocus - мощная модель с продвинутой композицией'
        },
        {
          id: 'rundiffusion-fal/juggernaut-flux/lightning',
          name: 'Rundiffusion Juggernaut Flux Lightning',
          description: 'Генерация видео - Средняя скорость и качество',
          type: 'video'
        },
        {
          id: 'rundiffusion-fal/juggernaut-flux-lora',
          name: 'Rundiffusion Juggernaut Flux Lora',
          description: 'Генерация видео - Топовое качество',
          type: 'video'
        }
      ];
      
      return res.json({
        success: true,
        models
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при получении списка моделей'
      });
    }
  });
}