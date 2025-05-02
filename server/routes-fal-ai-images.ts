import express, { Express } from 'express';
import { falAiUniversalService, FalAiGenerateOptions } from './services/fal-ai-universal';
import { falAiJuggernautService } from './services/fal-ai-juggernaut';

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
        description: 'Быстрая базовая модель FAL.AI (рекомендуется)' 
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
        id: 'rundiffusion-fal/juggernaut-flux-lora', 
        name: 'Juggernaut Flux Lora', 
        description: 'Высочайшее качество изображений' 
      },
      { 
        id: 'rundiffusion-fal/juggernaut-flux/lightning', 
        name: 'Juggernaut Flux Lightning', 
        description: 'Баланс скорости и качества' 
      },
      { 
        id: 'fal-ai/flux-lora', 
        name: 'Flux Lora', 
        description: 'Альтернативная Flux модель' 
      },
      { 
        id: 'fal-ai/juggernaut-xl-v9', 
        name: 'Juggernaut XL', 
        description: 'Детализированные реалистичные изображения' 
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

// Генерация изображения с использованием универсального сервиса по API
router.post('/api/fal-ai-images', async (req, res) => {
  try {
    // Валидация запроса
    const { prompt, negativePrompt, width, height, numImages, model, stylePreset } = req.body;
    
    console.log(`[api] Приняты параметры размера: ${width}x${height}, стиль: ${stylePreset || 'не указан'}`);
    
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
      width: parseInt(width) || 1024,
      height: parseInt(height) || 1024,
      numImages: parseInt(numImages) || 1,
      model: model || 'schnell', // Используем Schnell по умолчанию
      token,
      stylePreset // Добавляем передачу параметра стиля
    };

    // Выбираем правильный сервис в зависимости от модели
    console.log(`[api] Запрос на генерацию изображения с моделью ${generateOptions.model}`);
    
    let imageUrls: string[] = [];
    
    // Определяем, какой сервис использовать для генерации изображений
    // Разделяем модели на категории для корректной обработки
    const isJuggernautModel = 
      model === 'rundiffusion-fal/juggernaut-flux-lora' || 
      model === 'rundiffusion-fal/juggernaut-flux/lightning' ||
      model === 'fal-ai/flux-lora';
    
    const isStandardModel = 
      model === 'stable-diffusion-xl' || 
      model === 'fal-ai/fast-sdxl' || 
      model === 'fal-ai/lcm-sdxl' ||
      model === 'fal-ai/juggernaut-xl-v9' ||
      model === 'fal-ai/illusion-xl-v1' ||
      model === 'fooocus';
      
    const isSchnellModel = model === 'schnell';
    
    // Перенаправляем запрос на соответствующий сервис
    if (isJuggernautModel) {
      // Инициализируем сервис Juggernaut с API ключом
      falAiJuggernautService.initialize(token);
      
      // Создаем параметры специально для Juggernaut моделей
      const juggernautOptions = {
        prompt,
        negativePrompt,
        width: parseInt(width) || 1024,
        height: parseInt(height) || 1024,
        numImages: parseInt(numImages) || 1,
        model: model,
        stylePreset // Добавляем параметр стиля для Juggernaut моделей
      };
      
      console.log(`[api] Отправляем запрос к Juggernaut с размером ${parseInt(width) || 1024}x${parseInt(height) || 1024} и стилем ${stylePreset || 'не указан'}`);
      
      console.log(`[api] Используем специализированный сервис для модели Juggernaut: ${model}`);
      imageUrls = await falAiJuggernautService.generateImages(juggernautOptions);
    } else if (isSchnellModel) {
      console.log(`[api] Используем специальный endpoint для модели Schnell`);
      // Для Schnell используем прямой endpoint через falAiUniversalService, но указываем специфический путь
      imageUrls = await falAiUniversalService.generateWithSchnell({
        prompt,
        negativePrompt,
        width: parseInt(width) || 1024,
        height: parseInt(height) || 1024,
        numImages: parseInt(numImages) || 1,
        token,
        stylePreset // Передаём параметр стиля для модели Schnell
      });
      
      console.log(`[api] Отправляем запрос к Schnell с размером ${parseInt(width) || 1024}x${parseInt(height) || 1024} и стилем ${stylePreset || 'не указан'}`);
    } else {
      // Для других стандартных моделей используем универсальный сервис
      console.log(`[api] Используем универсальный сервис для модели: ${model}`);
      imageUrls = await falAiUniversalService.generateImages(generateOptions);
    }

    // Проверяем результат и форматируем его для тестовых скриптов
    if (imageUrls && imageUrls.length > 0) {
      console.log(`[api] Успешно получено ${imageUrls.length} изображений`);
      
      // Логирование для отладки
      imageUrls.forEach((url, index) => {
        console.log(`[api] Изображение ${index + 1}: ${url}`);
      });
      
      // Отправляем результат в формате, совместимом с тестами
      res.json({
        success: true,
        images: imageUrls
      });
    } else {
      console.warn(`[api] Сервис вернул пустой массив URL изображений`);
      res.json({
        success: false,
        images: [],
        error: "Не удалось получить URL изображений"
      });
    }
  } catch (error: any) {
    console.error('[api] Ошибка при генерации изображения:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Не удалось сгенерировать изображение'
    });
  }
});

export default router;