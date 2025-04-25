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
    // Статический список поддерживаемых моделей
    // В будущем можно сделать динамическое получение с помощью FAL API
    const models = [
      { 
        id: 'flux/juggernaut-xl-lightning', 
        name: 'Juggernaut Flux Lightning', 
        description: 'Быстрая и высококачественная генерация' 
      },
      { 
        id: 'flux/juggernaut-xl-lora', 
        name: 'Juggernaut Flux Lora', 
        description: 'Детализированные художественные изображения' 
      },
      { 
        id: 'flux/flux-lora', 
        name: 'Flux Lora', 
        description: 'Базовая модель Flux' 
      },
      { 
        id: 'schnell', 
        name: 'Schnell', 
        description: 'Оригинальная модель FAL.AI' 
      },
      { 
        id: 'fooocus', 
        name: 'Fooocus', 
        description: 'Усовершенствованная композиция' 
      },
      { 
        id: 'fast-sdxl', 
        name: 'Fast SDXL', 
        description: 'Быстрая версия SDXL' 
      },
      { 
        id: 'sdxl', 
        name: 'SDXL', 
        description: 'Высококачественная модель с широкими возможностями' 
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

    // Получаем токен авторизации из заголовка
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Отсутствует токен авторизации'
      });
    }

    // Создаем параметры для генерации
    const generateOptions: FalAiGenerateOptions = {
      prompt,
      negativePrompt,
      width: width || 1024,
      height: height || 1024,
      numImages: numImages || 1,
      model: model || 'flux/juggernaut-xl-lightning',
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