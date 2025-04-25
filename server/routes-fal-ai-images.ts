import express, { Express } from 'express';
import { falAiUniversalService, FalAiGenerateOptions } from './services/fal-ai-universal';

// Создаем роутер для маршрутов FAL.AI
const router = express.Router();

// Функция для регистрации маршрутов в Express приложении
export function registerFalAiImageRoutes(app: Express) {
  app.use('/', router);
  console.log('[express] FAL.AI Universal Image Generation routes registered');
}

// Получить список доступных моделей
router.get('/api/fal-ai-models', async (req, res) => {
  try {
    // Статический список поддерживаемых моделей FAL.AI
    // Использует официальные имена моделей, проверенные в фактической работе
    const models = [
      { 
        id: 'schnell', 
        name: 'Schnell', 
        description: 'Оригинальная модель FAL.AI (рекомендуется)' 
      },
      { 
        id: 'fal-ai/fast-sdxl', 
        name: 'Fast SDXL', 
        description: 'Быстрая генерация с высоким качеством' 
      },
      { 
        id: 'fal-ai/lcm-sdxl', 
        name: 'LCM-SDXL', 
        description: 'Сверхбыстрая генерация (ниже качество)' 
      },
      { 
        id: 'fal-ai/juggernaut-xl-v9', 
        name: 'Juggernaut XL', 
        description: 'Детализированные реалистичные изображения' 
      },
      { 
        id: 'fal-ai/juggernaut-xl-v7', 
        name: 'Juggernaut XL V7', 
        description: 'Высококачественная генерация с детализацией' 
      },
      { 
        id: 'fal-ai/illusion-xl-v1', 
        name: 'Illusion XL', 
        description: 'Художественные и креативные изображения' 
      }
    ];

    res.json({
      success: true,
      models
    });
  } catch (error) {
    console.error('[api] Ошибка при получении списка моделей:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось получить список моделей'
    });
  }
});

// Генерация изображения с использованием универсального сервиса
router.post('/api/generate-universal-image', async (req, res) => {
  try {
    // Валидация запроса
    const { prompt, negativePrompt, width, height, numImages, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Не указан промт для генерации'
      });
    }

    // Получаем токен авторизации из заголовка или используем FAL_AI_API_KEY из переменных окружения
    const authHeader = req.headers.authorization || '';
    let token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      // Используем сохраненный API ключ, если заголовок не предоставлен
      token = process.env.FAL_AI_API_KEY || '';
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Отсутствует токен авторизации'
        });
      }
      console.log('[api] Используем FAL_AI_API_KEY из переменных окружения');
    }

    // Создаем параметры для генерации
    const generateOptions: FalAiGenerateOptions = {
      prompt,
      negativePrompt,
      width: width || 1024,
      height: height || 1024,
      numImages: numImages || 1,
      model: model || 'schnell', // Используем Schnell по умолчанию
      token
    };

    // Вызываем универсальный сервис для генерации
    console.log(`[api] Запрос на генерацию изображения с моделью ${generateOptions.model}`);
    const imageUrls = await falAiUniversalService.generateImages(generateOptions);

    res.json({
      success: true,
      data: imageUrls
    });
  } catch (error: any) {
    console.error('[api] Ошибка при генерации изображения:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Не удалось сгенерировать изображение'
    });
  }
});

export default router;