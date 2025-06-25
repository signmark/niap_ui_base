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

// Маршрут для Stories генератора изображений
router.post('/api/generate-image', async (req, res) => {
  try {
    console.log(`[generate-image] Получен запрос на генерацию изображения для Stories`);
    
    const { 
      prompt, 
      negative_prompt, 
      num_images, 
      model, 
      style_preset, 
      image_size, 
      save_prompt, 
      campaign_id, 
      content_id 
    } = req.body;

    // Получаем токен пользователя
    const userToken = req.headers.authorization?.replace('Bearer ', '');
    if (!userToken) {
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация'
      });
    }

    // Парсим размеры из строки формата "1024x1024"
    let width = 1024;
    let height = 1024;
    
    if (image_size && typeof image_size === 'string' && image_size.includes('x')) {
      const [w, h] = image_size.split('x').map(s => parseInt(s.trim()));
      width = w || 1024;
      height = h || 1024;
    }

    console.log(`[generate-image] Параметры: промт="${prompt?.substring(0, 50)}...", модель=${model}, размер=${width}x${height}, количество=${num_images}`);

    // Получаем токен FAL.AI из переменных окружения
    const falAiToken = process.env.FAL_AI_API_KEY;
    if (!falAiToken) {
      return res.status(500).json({
        success: false,
        error: 'API ключ FAL.AI не настроен на сервере'
      });
    }

    // Создаем параметры для генерации
    const generateOptions = {
      prompt: prompt || '',
      negativePrompt: negative_prompt || '',
      width,
      height,
      numImages: parseInt(num_images) || 1,
      model: model || 'schnell',
      token: falAiToken,
      stylePreset: style_preset
    };

    console.log(`[generate-image] Вызываем falAiUniversalService.generateImages`);
    
    // Генерируем изображения
    const imageUrls = await falAiUniversalService.generateImages(generateOptions);
    
    console.log(`[generate-image] Получен результат:`, {
      imageCount: imageUrls?.length || 0,
      firstImageUrl: imageUrls?.[0]?.substring(0, 50) + '...' || 'нет изображений'
    });

    // Проверяем результат
    if (!imageUrls || imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Изображения не были сгенерированы. Попробуйте другую модель или промт.'
      });
    }

    // Возвращаем успешный результат
    return res.json({
      success: true,
      images: imageUrls
    });

  } catch (error: any) {
    console.error('[generate-image] Ошибка:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Внутренняя ошибка сервера'
    });
  }
});

// Генерация изображения с использованием универсального сервиса по API
router.post('/api/fal-ai-images', async (req, res) => {
  try {
    // Валидация запроса
    const { prompt, negativePrompt, width, height, numImages, model, stylePreset, imageSize } = req.body;
    
    console.log(`[api] Приняты параметры: ${
      imageSize ? `формат: ${imageSize}` : `размер: ${width}x${height}`
    }, стиль: ${stylePreset || 'не указан'}`);
    
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
    const generateOptions: any = {
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
      const juggernautOptions: any = {
        prompt,
        negativePrompt,
        numImages: parseInt(numImages) || 1,
        model: model,
        stylePreset, // Добавляем параметр стиля для Juggernaut моделей
      };
      
      // Добавляем либо строковый формат, либо числовые значения ширины/высоты
      if (imageSize) {
        console.log(`[api] Отправляем запрос к Juggernaut с форматом ${imageSize} и стилем ${stylePreset || 'не указан'}`);
        juggernautOptions.imageSize = imageSize;
      } else {
        console.log(`[api] Отправляем запрос к Juggernaut с размером ${parseInt(width) || 1024}x${parseInt(height) || 1024} и стилем ${stylePreset || 'не указан'}`);
        juggernautOptions.width = parseInt(width) || 1024;
        juggernautOptions.height = parseInt(height) || 1024;
      }
      
      console.log(`[api] Используем специализированный сервис для модели Juggernaut: ${model}`);
      imageUrls = await falAiJuggernautService.generateImages(juggernautOptions);
    } else if (isSchnellModel) {
      console.log(`[api] Используем специальный endpoint для модели Schnell`);
      
      // Создаем объект параметров для Schnell
      const schnellOptions: any = {
        prompt,
        negativePrompt,
        numImages: parseInt(numImages) || 1,
        token,
        stylePreset // Передаём параметр стиля для модели Schnell
      };
      
      // Добавляем либо строковый формат, либо числовые значения ширины/высоты
      if (imageSize) {
        console.log(`[api] Отправляем запрос к Schnell с форматом ${imageSize} и стилем ${stylePreset || 'не указан'}`);
        schnellOptions.imageSize = imageSize;
      } else {
        console.log(`[api] Отправляем запрос к Schnell с размером ${parseInt(width) || 1024}x${parseInt(height) || 1024} и стилем ${stylePreset || 'не указан'}`);
        schnellOptions.width = parseInt(width) || 1024;
        schnellOptions.height = parseInt(height) || 1024;
      }
      
      // Для Schnell используем прямой endpoint через falAiUniversalService, но указываем специфический путь
      imageUrls = await falAiUniversalService.generateWithSchnell(schnellOptions);
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