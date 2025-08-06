import express from 'express';
import { log } from '../utils/logger';
import { directusStorageService } from '../services/directus-crud';

const router = express.Router();

// Сохранение Stories с JSON и изображением  
router.post('/stories/save', async (req, res) => {
  try {
    const { campaignId, storyJson, imageDataUrl } = req.body;
    const userId = req.user?.id;

    if (!campaignId || !storyJson || !imageDataUrl || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Требуются: campaignId, storyJson, imageDataUrl'
      });
    }

    // Конвертируем base64 в Buffer для загрузки в Directus
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Создаем уникальное имя файла
    const fileName = `story-${Date.now()}-${campaignId}.jpg`;

    // Здесь можно загрузить изображение в Directus Files или внешнее хранилище
    // Пока сохраняем только JSON данные
    const storyRecord = {
      user_id: userId,
      campaign_id: campaignId,
      title: `Instagram Story ${new Date().toLocaleDateString()}`,
      story_json: storyJson,
      image_url: null, // TODO: загрузить изображение
      status: 'draft',
      created_at: new Date().toISOString(),
      metadata: {
        width: storyJson.width,
        height: storyJson.height,
        elementsCount: storyJson.elements.length,
        exportedAt: new Date().toISOString()
      }
    };

    // Сохраняем в коллекцию stories (нужно создать в Directus)
    const result = await directusStorageService.create('stories', storyRecord);

    log('stories-api', `Story сохранена: ${result.id} для кампании ${campaignId}`);

    res.json({
      success: true,
      data: {
        storyId: result.id,
        fileName,
        storyJson
      }
    });

  } catch (error) {
    console.error('Error saving story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save story'
    });
  }
});

// Получение Stories для кампании
router.get('/stories', async (req, res) => {
  try {
    const { campaignId } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const filter = {
      user_id: userId,
      ...(campaignId ? { campaign_id: campaignId } : {})
    };

    const stories = await directusStorageService.list('stories', {
      filter,
      sort: ['-created_at']
    });

    res.json({
      success: true,
      data: stories
    });

  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stories'
    });
  }
});

// Публикация Stories в Instagram через Graph API
router.post('/stories/:storyId/publish', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { instagramPageId, accessToken } = req.body;
    const userId = req.user?.id;

    if (!storyId || !instagramPageId || !accessToken || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Требуются: storyId, instagramPageId, accessToken'
      });
    }

    // Получаем Stories из базы
    const story = await directusStorageService.getById('stories', storyId);

    if (!story || story.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    // TODO: Реализовать публикацию через Instagram Graph API
    // 1. Конвертировать JSON в изображение (если не сохранено)
    // 2. Загрузить изображение в Instagram API
    // 3. Опубликовать как Story

    // Заглушка для примера
    const mockPublishResult = {
      instagram_story_id: `story_${Date.now()}`,
      published_at: new Date().toISOString(),
      story_url: `https://instagram.com/stories/account/${Date.now()}`
    };

    // Обновляем статус Stories
    await directusStorageService.update('stories', storyId, {
      status: 'published',
      published_at: mockPublishResult.published_at,
      instagram_story_id: mockPublishResult.instagram_story_id,
      story_url: mockPublishResult.story_url
    });

    log('stories-api', `Story опубликована: ${storyId} в Instagram`);

    res.json({
      success: true,
      data: mockPublishResult
    });

  } catch (error) {
    console.error('Error publishing story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish story'
    });
  }
});

// Экспорт изображения Stories
router.get('/stories/:storyId/export', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { format = 'jpeg' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Получаем Stories
    const story = await directusStorageService.getById('stories', storyId);

    if (!story || story.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    if (story.image_url) {
      // Если изображение уже сохранено, возвращаем URL
      res.json({
        success: true,
        data: {
          imageUrl: story.image_url,
          format: format
        }
      });
    } else {
      // TODO: Генерируем изображение из JSON
      res.status(400).json({
        success: false,
        error: 'Image not available for this story'
      });
    }

  } catch (error) {
    console.error('Error exporting story:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export story'
    });
  }
});

export default router;