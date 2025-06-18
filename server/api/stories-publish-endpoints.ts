/**
 * Stories Publishing Endpoints для N8N Integration
 * Endpoints которые N8N workflow может вызывать для публикации Stories
 */

import express from 'express';
import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import { log } from '../utils/logger';

/**
 * Простой генератор изображения Stories для тестирования
 */
async function generateSimpleStoriesImage(storyData: any): Promise<string> {
  // Для тестирования возвращаем статичное изображение Stories
  // В реальной системе здесь должен быть полноценный генератор
  const slides = storyData.slides || [];
  const slideCount = slides.length;
  
  // Симулируем генерацию изображения
  const mockImageUrl = `https://via.placeholder.com/1080x1920/FF6B6B/FFFFFF.png?text=Stories+${slideCount}+slides`;
  
  log(`[Stories Generator] Сгенерировано тестовое изображение: ${mockImageUrl}`, 'stories-publish');
  
  return mockImageUrl;
}

const router = express.Router();

/**
 * Endpoint для публикации интерактивных Instagram Stories через instagrapi
 */
router.post('/publish-interactive', async (req, res) => {
  try {
    const { contentId, storyData, instagramCredentials } = req.body;
    
    log(`[Stories Interactive] Публикация интерактивного Stories contentId: ${contentId}`, 'stories-publish');

    if (!contentId || !storyData) {
      return res.status(400).json({
        success: false,
        error: 'Необходимы contentId и storyData'
      });
    }

    // Проверяем наличие интерактивных элементов
    const hasInteractive = storyData.slides?.some((slide: any) => 
      slide.elements?.some((element: any) => 
        ['poll', 'quiz', 'slider', 'question'].includes(element.type)
      )
    ) || false;

    if (!hasInteractive) {
      return res.status(400).json({
        success: false,
        error: 'Stories не содержит интерактивных элементов'
      });
    }

    // Генерируем изображение Stories с интерактивными элементами
    const imageResponse = await axios.post('http://localhost:5000/generate-stories', {
      metadata: { storyData }
    });

    if (!imageResponse.data.success) {
      throw new Error('Ошибка генерации изображения Stories');
    }

    const imageUrl = imageResponse.data.imageUrl;

    // Вызываем Python скрипт для публикации через instagrapi
    const pythonScript = path.join(__dirname, '../services/instagrapi-stories.py');
    
    const pythonProcess = spawn('python3', [
      pythonScript,
      '--content-id', contentId,
      '--image-url', imageUrl,
      '--story-data', JSON.stringify(storyData),
      '--credentials', JSON.stringify(instagramCredentials || {})
    ]);

    let pythonOutput = '';
    let pythonError = '';

    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(pythonOutput);
          
          log(`[Stories Interactive] Успешно опубликовано: ${contentId}`, 'stories-publish');
          
          res.json({
            success: true,
            method: 'instagrapi',
            contentId,
            result,
            imageUrl,
            hasInteractive: true
          });
        } catch (e) {
          log(`[Stories Interactive] Ошибка парсинга результата: ${e}`, 'stories-publish');
          res.status(500).json({
            success: false,
            error: 'Ошибка обработки результата публикации'
          });
        }
      } else {
        log(`[Stories Interactive] Ошибка Python процесса: ${pythonError}`, 'stories-publish');
        res.status(500).json({
          success: false,
          error: `Ошибка публикации: ${pythonError}`
        });
      }
    });

  } catch (error: any) {
    log(`[Stories Interactive] Общая ошибка: ${error.message}`, 'stories-publish');
    res.status(500).json({
      success: false,
      error: `Ошибка публикации интерактивных Stories: ${error.message}`
    });
  }
});

/**
 * Endpoint для публикации обычных Instagram Stories через inst-oauth.smmniap.pw API
 */
router.post('/publish-static', async (req, res) => {
  try {
    const { contentId, storyData, instagramCredentials } = req.body;
    
    log(`[Stories Static] Публикация статичного Stories contentId: ${contentId}`, 'stories-publish');

    if (!contentId || !storyData) {
      return res.status(400).json({
        success: false,
        error: 'Необходимы contentId и storyData'
      });
    }

    // Создаем простое изображение Stories (временно, для тестирования)
    const imageUrl = await generateSimpleStoriesImage(storyData);

    // Проверяем наличие учетных данных
    const username = instagramCredentials?.username;
    const password = instagramCredentials?.password;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют Instagram учетные данные (username, password)'
      });
    }

    // Публикуем через inst-oauth.smmniap.pw API
    const publishPayload = {
      username: username,
      password: password,
      media_urls: [imageUrl],
      type: "story",
      caption: storyData.caption || ""
    };

    log(`[Stories Static] Отправляем запрос к inst-oauth API: ${JSON.stringify(publishPayload)}`, 'stories-publish');

    const publishResponse = await axios.post(
      'https://inst-oauth.smmniap.pw/api/posts/create',
      publishPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 секунд таймаут
      }
    );

    log(`[Stories Static] Ответ от inst-oauth API: ${JSON.stringify(publishResponse.data)}`, 'stories-publish');

    // Проверяем успешность публикации
    if (publishResponse.data && publishResponse.data.success !== false) {
      log(`[Stories Static] Успешно опубликовано: ${contentId}`, 'stories-publish');

      res.json({
        success: true,
        method: 'inst_oauth_api',
        contentId,
        publishResult: publishResponse.data,
        imageUrl,
        hasInteractive: false,
        postUrl: publishResponse.data.post_url || publishResponse.data.url
      });
    } else {
      throw new Error(`API вернул ошибку: ${publishResponse.data.error || 'Unknown error'}`);
    }

  } catch (error: any) {
    log(`[Stories Static] Ошибка: ${error.message}`, 'stories-publish');
    
    // Детальный лог ошибки для отладки
    if (error.response) {
      log(`[Stories Static] HTTP Status: ${error.response.status}`, 'stories-publish');
      log(`[Stories Static] Response Data: ${JSON.stringify(error.response.data)}`, 'stories-publish');
    }
    
    res.status(500).json({
      success: false,
      error: `Ошибка публикации статичных Stories: ${error.message}`,
      details: error.response?.data || null
    });
  }
});

/**
 * Endpoint для получения Stories контента по ID (для N8N)
 */
router.get('/content/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    
    log(`[Stories Content] Получение контента: ${contentId}`, 'stories-publish');

    // Получаем контент из Directus
    const contentResponse = await axios.get(
      `${process.env.DIRECTUS_URL}/items/campaign_content/${contentId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
        }
      }
    );

    const content = contentResponse.data.data;
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Контент не найден'
      });
    }

    // Проверяем, что это Stories контент
    if (content.content_type !== 'stories') {
      return res.status(400).json({
        success: false,
        error: 'Контент не является Stories'
      });
    }

    // Извлекаем Stories данные из metadata
    const metadata = content.additional_media || {};
    const storyData = metadata.storyData || {};
    
    // Проверяем интерактивные элементы
    const hasInteractive = storyData.slides?.some((slide: any) => 
      slide.elements?.some((element: any) => 
        ['poll', 'quiz', 'slider', 'question'].includes(element.type)
      )
    ) || false;

    // Получаем типы интерактивных элементов
    const interactiveTypes: string[] = [];
    if (storyData.slides) {
      storyData.slides.forEach((slide: any) => {
        if (slide.elements) {
          slide.elements.forEach((element: any) => {
            if (['poll', 'quiz', 'slider', 'question'].includes(element.type) && 
                !interactiveTypes.includes(element.type)) {
              interactiveTypes.push(element.type);
            }
          });
        }
      });
    }

    res.json({
      success: true,
      content: {
        id: content.id,
        title: content.title,
        content: content.content,
        contentType: content.content_type,
        storyData,
        hasInteractive,
        interactiveTypes,
        platforms: content.social_platforms || {},
        status: content.status,
        slidesCount: storyData.slides?.length || 0
      }
    });

  } catch (error: any) {
    log(`[Stories Content] Ошибка: ${error.message}`, 'stories-publish');
    res.status(500).json({
      success: false,
      error: `Ошибка получения контента: ${error.message}`
    });
  }
});

/**
 * Endpoint для обновления статуса Stories контента (для N8N)
 */
router.patch('/status/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { status, publishedAt, postUrl, error } = req.body;
    
    log(`[Stories Status] Обновление статуса: ${contentId} -> ${status}`, 'stories-publish');

    const updateData: any = { status };
    
    if (publishedAt) {
      updateData.published_at = publishedAt;
    }
    
    if (postUrl) {
      // Сохраняем URL в social_platforms
      updateData.social_platforms = {
        instagram: {
          selected: true,
          status: status,
          postUrl: postUrl
        }
      };
    }

    if (error) {
      updateData.social_platforms = {
        instagram: {
          selected: true,
          status: 'error',
          error: error
        }
      };
    }

    // Обновляем статус в Directus
    await axios.patch(
      `${process.env.DIRECTUS_URL}/items/campaign_content/${contentId}`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    log(`[Stories Status] Статус обновлен: ${contentId}`, 'stories-publish');

    res.json({
      success: true,
      contentId,
      status,
      updated: Object.keys(updateData)
    });

  } catch (error: any) {
    log(`[Stories Status] Ошибка: ${error.message}`, 'stories-publish');
    res.status(500).json({
      success: false,
      error: `Ошибка обновления статуса: ${error.message}`
    });
  }
});

export default router;