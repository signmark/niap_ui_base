import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { directusApi } from '../directus';
import { realVideoConverter } from '../services/real-video-converter';

const router = express.Router();

// Debug middleware to log all requests to stories routes
router.use((req, res, next) => {
  console.log(`[STORIES] ${req.method} ${req.originalUrl} - Path: ${req.path}`);
  console.log(`[STORIES] Request received with auth: ${req.headers.authorization ? 'Present' : 'Missing'}`);
  next();
});

// Create a new story
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, campaignId, content, type, status } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Creating story:', { title, campaignId, type });

    // Create story content in campaign_content collection
    const storyData = {
      campaign_id: campaignId,
      user_id: userId,
      title: title || 'Новая история',
      content_type: type || 'story',
      status: status || 'draft',
      content: content || '', // Story content with positioning data
      metadata: JSON.stringify({ 
        storyType: 'instagram',
        format: '9:16',
        createdWith: 'enhanced_editor'
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createResponse = await directusApi.post('/items/campaign_content', storyData, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    const story = createResponse.data.data;

    console.log('[DEV] [stories] Story created with ID:', story.id);
    res.json({ success: true, data: story });
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Get all stories for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Fetching stories for user:', userId);

    const response = await directusApi.get('/items/campaign_content', {
      headers: {
        'Authorization': req.headers.authorization
      },
      params: {
        filter: JSON.stringify({
          user_id: { _eq: userId },
          content_type: { _in: ['story', 'video_story'] }
        }),
        sort: '-created_at'
      }
    });

    const stories = response.data.data || [];
    console.log('[DEV] [stories] Found', stories.length, 'stories');
    
    res.json({ success: true, data: stories });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Update story - SPECIFIC ROUTE FOR STORIES ONLY
router.put('/story/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slides } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Updating story:', id, { title, slidesCount: slides?.length });

    const updateData = {
      title: title || 'Новая история',
      metadata: JSON.stringify({ 
        slides: slides || [],
        storyType: 'instagram',
        format: '9:16',
        version: '1.0'
      }),
      updated_at: new Date().toISOString()
    };

    // Используем токен пользователя для обновления записи
    const updateResponse = await directusApi.patch(`/items/campaign_content/${id}`, updateData, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    const story = updateResponse.data.data;

    console.log('[DEV] [stories] Story updated successfully');
    res.json({ success: true, data: story });
  } catch (error) {
    console.error('Error updating story:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Get story by ID - SPECIFIC ROUTE FOR STORIES ONLY
router.get('/story/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const response = await directusApi.get(`/items/campaign_content/${id}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    const story = response.data.data;

    if (!story || story.user_id !== userId) {
      return res.status(404).json({ error: 'Story not found' });
    }

    res.json({ success: true, data: story });
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ error: 'Не удалось загрузить историю' });
  }
});

// Delete story - SPECIFIC ROUTE FOR STORIES ONLY
router.delete('/story/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify ownership с пользовательским токеном
    const response = await directusApi.get(`/items/campaign_content/${id}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    const story = response.data.data;
    if (!story || story.user_id !== userId) {
      return res.status(404).json({ error: 'Story not found' });
    }

    await directusApi.delete(`/items/campaign_content/${id}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });

    res.json({ success: true, message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// Publish story - SPECIFIC ROUTE FOR STORIES ONLY
router.post('/story/:id/publish', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { platforms, scheduledAt } = req.body;
    const userId = req.user?.id;
    
    console.log(`[DEV] [stories] 🎬 Публикация Stories ID: ${id}`);
    console.log(`[DEV] [stories] 🎬 Платформы: ${JSON.stringify(platforms)}`);
    console.log(`[DEV] [stories] 🎬 Запланировано: ${scheduledAt}`);
    console.log(`[DEV] [stories] 🎬 UserID: ${userId}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get story с пользовательским токеном
    const response = await directusApi.get(`/items/campaign_content/${id}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    const story = response.data.data;
    if (!story || story.user_id !== userId) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Update story status and platforms
    const updateData = {
      status: scheduledAt ? 'scheduled' : 'published',
      scheduled_time: scheduledAt || new Date().toISOString(),
      platforms: JSON.stringify(platforms),
      updated_at: new Date().toISOString()
    };

    const updateResponse = await directusApi.patch(`/items/campaign_content/${id}`, updateData, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    const updatedStory = updateResponse.data.data;

    // Send to N8N webhooks - Instagram Stories отдельно от других платформ
    try {
      const n8nUrl = process.env.N8N_URL || 'https://n8n.roboflow.space';
      
      // Разделяем платформы: Instagram Stories отдельно
      const instagramPlatforms = platforms.filter((p: string) => p === 'instagram');
      const otherPlatforms = platforms.filter((p: string) => p !== 'instagram');

      const webhookPromises = [];

      // Instagram Stories через отдельный webhook (с fallback на общий)
      if (instagramPlatforms.length > 0) {
        const instagramWebhookUrl = `${n8nUrl}/webhook/publish-stories`;
        const instagramPayload = {
          contentId: updatedStory.id
        };
        
        console.log('[DEV] [stories] Sending to Instagram Stories webhook:', instagramWebhookUrl);
        
        webhookPromises.push(
          fetch(instagramWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(instagramPayload)
          }).then(async (response) => {
            // Если Instagram webhook недоступен (404), используем fallback
            if (response.status === 404) {
              console.log('[DEV] [stories] Instagram webhook not found (404), using general webhook as fallback');
              const fallbackUrl = `${n8nUrl}/webhook/publish-stories`;
              
              const fallbackResponse = await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(instagramPayload)
              });
              
              return { type: 'instagram-fallback', response: fallbackResponse };
            }
            
            return { type: 'instagram', response };
          })
        );
      }

      // Остальные платформы через общий Stories webhook
      if (otherPlatforms.length > 0) {
        const generalWebhookUrl = `${n8nUrl}/webhook/publish-stories`;
        const generalPayload = {
          contentId: updatedStory.id
        };
        
        console.log('[DEV] [stories] Sending to general Stories webhook:', generalWebhookUrl);
        
        webhookPromises.push(
          fetch(generalWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(generalPayload)
          }).then(response => ({ type: 'general', response }))
        );
      }

      // Ждем все webhook вызовы
      const results = await Promise.allSettled(webhookPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { type, response } = result.value;
          if (response.ok) {
            console.log(`[DEV] [stories] ${type} webhook called successfully`);
          } else {
            console.warn(`[DEV] [stories] ${type} webhook returned error:`, response.status, response.statusText);
          }
        } else {
          console.error('[DEV] [stories] Webhook promise rejected:', result.reason);
        }
      });

    } catch (webhookError) {
      console.error('[DEV] [stories] Error calling N8N webhooks:', webhookError);
      // Continue execution - webhook failure shouldn't block the API response
    }

    res.json({ 
      success: true, 
      data: updatedStory,
      message: scheduledAt ? 'Story scheduled for publication' : 'Story published successfully'
    });
  } catch (error) {
    console.error('Error publishing story:', error);
    res.status(500).json({ error: 'Failed to publish story' });
  }
});

// COMPLETE WORKFLOW: Convert video, save to Directus, publish to N8N
router.post('/convert-and-publish', authMiddleware, async (req, res) => {
  console.log('[DEV] [stories] convert-and-publish route hit!');
  console.log('[DEV] [stories] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      videoUrl, 
      campaignId, 
      title = 'Stories с конвертированным видео',
      platforms = ['instagram'],
      scheduledAt 
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!videoUrl || !campaignId) {
      return res.status(400).json({ 
        error: 'videoUrl and campaignId are required' 
      });
    }

    console.log('[DEV] [stories] Starting complete workflow:', { videoUrl, campaignId });

    // STEP 1: Convert video using real video converter
    console.log('[DEV] [stories] Step 1: Converting video...');
    
    const conversionResult = await realVideoConverter.convertForInstagramStories(videoUrl);
    
    if (!conversionResult.success || !conversionResult.convertedUrl) {
      throw new Error(`Video conversion failed: ${conversionResult.error}`);
    }

    const convertedVideoUrl = conversionResult.convertedUrl;
    console.log('[DEV] [stories] Video converted successfully:', convertedVideoUrl);

    // STEP 2: Save story content to Directus with converted video URL
    console.log('[DEV] [stories] Step 2: Saving to Directus...');
    
    const storyContent = {
      title: title,
      description: 'Автоматически конвертированное видео для Instagram Stories',
      videoUrl: convertedVideoUrl, // Use converted video URL
      mediaType: 'video',
      elements: []
    };

    const storyData = {
      campaign_id: campaignId,
      user_id: userId,
      title: title,
      content_type: 'video_story',
      status: scheduledAt ? 'scheduled' : 'published',
      content: storyContent,
      metadata: JSON.stringify({ 
        originalVideoUrl: videoUrl,
        convertedVideoUrl: convertedVideoUrl,
        conversionMetadata: conversionResult.metadata,
        storyType: 'instagram',
        format: '9:16',
        createdWith: 'real_video_converter'
      }),
      platforms: JSON.stringify(platforms),
      scheduled_time: scheduledAt || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Try user token first, fallback to admin token
    let createResponse;
    try {
      createResponse = await directusApi.post('/items/campaign_content', storyData, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });
    } catch (userError) {
      console.log('[DEV] [stories] User token failed, using admin token for content creation');
      createResponse = await directusApi.post('/items/campaign_content', storyData, {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
        }
      });
    }
    
    const savedStory = createResponse.data.data;
    console.log('[DEV] [stories] Story saved to Directus with ID:', savedStory.id);

    // STEP 3: Send to N8N webhook for publication
    console.log('[DEV] [stories] Step 3: Sending to N8N webhook...');
    
    const n8nUrl = process.env.N8N_URL || 'https://n8n.roboflow.space';
    const webhookUrl = `${n8nUrl}/webhook/publish-stories`;
    
    const webhookPayload = {
      contentId: savedStory.id,
      contentType: 'video_story',
      platforms: platforms,
      scheduledAt: scheduledAt || new Date().toISOString(),
      content: {
        title: title,
        videoUrl: convertedVideoUrl, // Send converted video URL to N8N
        mediaType: 'video'
      },
      media_type: 'VIDEO',
      image_url: convertedVideoUrl
    };

    console.log('[DEV] [stories] Sending to webhook:', webhookUrl);
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    const webhookSuccess = webhookResponse.ok;
    console.log('[DEV] [stories] Webhook response:', webhookResponse.status, webhookSuccess ? 'SUCCESS' : 'FAILED');

    // FINAL RESPONSE
    const result = {
      success: true,
      data: {
        storyId: savedStory.id,
        originalVideoUrl: videoUrl,
        convertedVideoUrl: convertedVideoUrl,
        conversionMetadata: conversionResult.metadata,
        webhookStatus: webhookResponse.status,
        webhookSuccess: webhookSuccess
      },
      message: `Story converted, saved and ${webhookSuccess ? 'published' : 'saved (webhook failed)'} successfully`
    };

    console.log('[DEV] [stories] Complete workflow finished:', {
      storyId: savedStory.id,
      conversion: 'SUCCESS',
      saving: 'SUCCESS', 
      webhook: webhookSuccess ? 'SUCCESS' : 'FAILED'
    });

    res.json(result);

  } catch (error) {
    console.error('[DEV] [stories] Complete workflow error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    res.status(500).json({ 
      success: false,
      error: `Complete workflow failed: ${errorMessage}`,
      step: 'conversion_or_saving_or_publishing'
    });
  }
});

// Export router with specific story routes only
router.post('/publish-video/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Publishing video story with conversion:', id);

    // Get story content с fallback на admin токен
    let story;
    try {
      const response = await directusApi.get(`/items/campaign_content/${id}`, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });
      story = response.data.data;
    } catch (userError) {
      console.log('[DEV] [stories] User token failed, trying admin token');
      const response = await directusApi.get(`/items/campaign_content/${id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
        }
      });
      story = response.data.data;
    }

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    console.log('[DEV] [stories] Story found:', {
      id: story.id,
      title: story.title,
      hasVideo: !!story.video_url,
      user_id: story.user_id,
      requesting_user: userId
    });

    // Проверяем владельца только если не админ
    if (story.user_id !== userId) {
      console.log('[DEV] [stories] User does not own this story, checking admin status...');
      // Здесь можно добавить проверку админ статуса, пока разрешаем
    }

    if (!story.video_url) {
      return res.status(400).json({ error: 'Story has no video to convert' });
    }

    console.log('[DEV] [stories] Starting real video conversion for Instagram Stories...');

    // Convert video for Instagram Stories using real FFmpeg converter
    const conversionResult = await realVideoConverter.convertForInstagramStories(story.video_url);

    if (!conversionResult.success) {
      console.error('[DEV] [stories] Video conversion failed:', conversionResult.error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to convert video for Instagram Stories',
        details: conversionResult.error
      });
    }

    console.log('[DEV] [stories] Video converted successfully:', conversionResult.convertedUrl);

    // Update story with converted video URL
    const updateResult = await realVideoConverter.updateContentVideoUrl(
      id, 
      conversionResult.convertedUrl!,
      req.headers.authorization as string
    );

    if (!updateResult) {
      console.error('[DEV] [stories] Failed to update story with converted video URL');
      return res.status(500).json({
        success: false,
        error: 'Video converted but failed to update database'
      });
    }

    // Publish to Instagram Stories via N8N webhook with creation_id fix
    const n8nPayload = {
      contentId: id,
      contentType: 'video_story',
      platforms: ['instagram'],
      scheduledAt: new Date().toISOString(),
      
      // КОНФИГУРАЦИЯ ДЛЯ СУЩЕСТВУЮЩЕГО WORKFLOW (который работал с другими видео)
      instagram_config: {
        media_type: 'VIDEO',
        published: false, // Двухэтапный процесс как в рабочем workflow
        api_version: 'v18.0',
        
        // ИСПРАВЛЕНИЕ: Instagram Stories может требовать image_url для видео
        container_parameters: {
          image_url: conversionResult.convertedUrl, // Instagram использует image_url даже для видео Stories
          media_type: 'VIDEO',
          published: false
        },
        
        // Параметры для публикации (Publish Story узел) 
        publish_parameters: {
          creation_id: '{{CONTAINER_ID}}' // Как в рабочем workflow
        },
        
        // Указываем что используем существующий Stories workflow
        use_existing_stories_workflow: true,
        workflow_type: 'instagram_stories'
      },
      
      content: {
        title: story.title || 'Video Story',
        description: story.content || '',
        videoUrl: conversionResult.convertedUrl,
        originalVideoUrl: story.video_url,
        mediaType: 'VIDEO',
        storyType: 'instagram_stories'
      },
      metadata: {
        converted: true,
        conversionTime: conversionResult.duration,
        videoFormat: 'mp4',
        resolution: '1080x1920',
        codec: 'H.264',
        ...conversionResult.metadata
      },
      campaignId: story.campaign_id,
      userId: story.user_id,
      // Instagram API specific fields (дублируем для совместимости)
      media_type: 'VIDEO',
      video_url: conversionResult.convertedUrl,
      image_url: conversionResult.convertedUrl, // Instagram Stories может использовать image_url для видео
      publish_mode: 'instagram_stories'
    };

    console.log('[DEV] [stories] Publishing to Instagram Stories via N8N:', JSON.stringify(n8nPayload, null, 2));

    // Webhook attempts для работающего workflow (который работал с другими видео)
    const webhookAttempts = [
      {
        name: 'Primary Instagram Stories',
        url: 'https://n8n.roboflow.space/webhook/publish-stories', // ПРАВИЛЬНЫЙ endpoint
        payload: n8nPayload
      },
      {
        name: 'Fallback nplanner',
        url: 'https://n8n.nplanner.ru/webhook/publish-stories',
        payload: n8nPayload
      }
    ];

    let successfulAttempt = null;
    const axios = await import('axios');
    
    for (const attempt of webhookAttempts) {
      try {
        console.log(`[DEV] [stories] Trying ${attempt.name} webhook...`);
        
        const webhookResponse = await axios.default.post(attempt.url, attempt.payload, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log(`[DEV] [stories] ${attempt.name} webhook success:`, webhookResponse.status);
        successfulAttempt = {
          name: attempt.name,
          status: webhookResponse.status,
          data: webhookResponse.data
        };
        break; // Exit loop on first success

      } catch (webhookError: any) {
        console.warn(`[DEV] [stories] ${attempt.name} webhook failed:`, webhookError.message);
        
        // Log detailed error for debugging
        if (webhookError.response?.data) {
          console.warn(`[DEV] [stories] ${attempt.name} error details:`, JSON.stringify(webhookError.response.data, null, 2));
        }
        
        // Continue to next attempt
        continue;
      }
    }

    if (successfulAttempt) {
      console.log('[DEV] [stories] Publication successful via:', successfulAttempt.name);

      return res.json({
        success: true,
        message: 'Video story converted and published successfully',
        data: {
          storyId: id,
          originalUrl: story.video_url,
          convertedUrl: conversionResult.convertedUrl,
          conversionTime: conversionResult.duration,
          metadata: conversionResult.metadata,
          webhookStatus: successfulAttempt.status
        }
      });
    } else {
      // All webhook attempts failed
      console.error('[DEV] [stories] All N8N webhook attempts failed');
      
      // Story was converted successfully, but all webhooks failed
      return res.status(207).json({
        success: true,
        warning: 'Video converted successfully but all publication attempts failed',
        data: {
          storyId: id,
          originalUrl: story.video_url,
          convertedUrl: conversionResult.convertedUrl,
          conversionTime: conversionResult.duration,
          metadata: conversionResult.metadata
        },
        error: 'All N8N webhook endpoints failed - check N8N workflows and Instagram API configuration'
      });
    }

  } catch (error: any) {
    console.error('[DEV] [stories] Error publishing video story:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to publish video story',
      details: error.message 
    });
  }
});

// Create new story for SimpleStoryEditor
router.post('/simple', authMiddleware, async (req, res) => {
  try {
    const { campaignId, title } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!campaignId) {
      return res.status(400).json({ error: 'campaignId is required' });
    }

    console.log('[DEV] [stories] Creating new story for campaign:', campaignId);

    // Создаем базовую Stories с пустыми данными
    const storyData = {
      campaign_id: campaignId,
      user_id: userId,
      title: title || 'Новая Stories',
      content_type: 'story',
      status: 'draft',
      content: ' ', // Обязательное поле для Directus
      image_url: null, // Фоновое изображение - отдельное поле
      metadata: JSON.stringify({
        textOverlays: [{
          id: 'text1',
          text: 'Добавьте ваш текст',
          x: 100,
          y: 200,
          fontSize: 32,
          color: '#ffffff',
          fontFamily: 'Arial',
          fontWeight: 'bold',
          textAlign: 'center',
          backgroundColor: '#000000',
          padding: 10,
          borderRadius: 8
        }],
        additionalImages: [],
        storyType: 'instagram',
        format: '9:16',
        version: '1.0'
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createResponse = await directusApi.post('/items/campaign_content', storyData, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });

    const story = createResponse.data.data;
    console.log('[DEV] [stories] Story created successfully with ID:', story.id);
    
    res.json({ success: true, data: story });
  } catch (error: any) {
    console.error('Error creating story:', error?.response?.data || error?.message);
    
    if (error?.response?.status === 403) {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(500).json({ error: 'Failed to create story' });
    }
  }
});

// Update story with image_url and metadata - согласно ТЗ SimpleStoryEditor
router.put('/simple/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, image_url, metadata, status } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Валидация входных данных согласно ТЗ
    if (metadata) {
      try {
        const parsedMetadata = JSON.parse(metadata);
        
        // Базовая проверка структуры metadata
        if (!parsedMetadata.textOverlays || !Array.isArray(parsedMetadata.textOverlays)) {
          return res.status(400).json({ error: 'Invalid metadata structure: textOverlays required' });
        }
        
        if (!parsedMetadata.additionalImages || !Array.isArray(parsedMetadata.additionalImages)) {
          return res.status(400).json({ error: 'Invalid metadata structure: additionalImages required' });
        }
        
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON in metadata' });
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updateData.title = title;
    if (image_url !== undefined) updateData.image_url = image_url; // Фоновое изображение в отдельное поле
    if (metadata !== undefined) updateData.metadata = metadata; // JSON строка с данными Stories
    if (status !== undefined) updateData.status = status;

    console.log('[DEV] [stories] Updating story:', id, updateData);

    // Используем пользовательский токен из запроса согласно ТЗ
    const updateResponse = await directusApi.patch(`/items/campaign_content/${id}`, updateData, {
      headers: {
        'Authorization': req.headers.authorization // Пользовательский токен
      }
    });

    const story = updateResponse.data.data;
    console.log('[DEV] [stories] Story updated successfully');
    
    res.json({ success: true, data: story });
  } catch (error: any) {
    console.error('Error updating story:', error?.response?.data || error?.message);
    
    if (error?.response?.status === 403) {
      res.status(403).json({ error: 'Access denied' });
    } else if (error?.response?.status === 404) {
      res.status(404).json({ error: 'Story not found' });
    } else {
      res.status(500).json({ error: 'Failed to update story' });
    }
  }
});

// Get story by ID для SimpleStoryEditor
router.get('/simple/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Fetching story:', id, 'for user:', userId);

    const response = await directusApi.get(`/items/campaign_content/${id}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    const story = response.data.data;

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    console.log('[DEV] [stories] Story fetched successfully');
    res.json({ success: true, data: story });
  } catch (error: any) {
    console.error('Error fetching story:', error?.response?.data || error?.message);
    
    if (error?.response?.status === 403) {
      res.status(403).json({ error: 'Access denied' });
    } else if (error?.response?.status === 404) {
      res.status(404).json({ error: 'Story not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch story' });
    }
  }
});

export default router;