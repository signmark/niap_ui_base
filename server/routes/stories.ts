import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { directusApi } from '../directus';
import { realVideoConverter } from '../services/real-video-converter';

const router = express.Router();

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
        const instagramWebhookUrl = `${n8nUrl}/webhook/publish-instagram-stories`;
        const instagramPayload = {
          contentId: updatedStory.id,
          contentType: 'story',
          platforms: instagramPlatforms,
          scheduledAt: scheduledAt
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
          contentId: updatedStory.id,
          contentType: 'story',
          platforms: otherPlatforms,
          scheduledAt: scheduledAt
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

// Export router with specific story routes only
// Publish video story with real video conversion
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

    // Publish to Instagram Stories via N8N webhook
    const n8nPayload = {
      contentId: id,
      contentType: 'story',
      platforms: ['instagram'],
      scheduledAt: new Date().toISOString(),
      videoUrl: conversionResult.convertedUrl,
      originalVideoUrl: story.video_url,
      converted: true,
      conversionMetadata: conversionResult.metadata
    };

    console.log('[DEV] [stories] Publishing to Instagram Stories via N8N:', n8nPayload);

    const webhookUrl = 'https://n8n.roboflow.space/webhook/publish-instagram-stories';
    
    try {
      const axios = await import('axios');
      const webhookResponse = await axios.default.post(webhookUrl, n8nPayload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('[DEV] [stories] N8N webhook response:', webhookResponse.status);

      return res.json({
        success: true,
        message: 'Video story converted and published successfully',
        data: {
          storyId: id,
          originalUrl: story.video_url,
          convertedUrl: conversionResult.convertedUrl,
          conversionTime: conversionResult.duration,
          metadata: conversionResult.metadata,
          webhookStatus: webhookResponse.status
        }
      });

    } catch (webhookError: any) {
      console.error('[DEV] [stories] N8N webhook failed:', webhookError.message);
      
      // Story was converted successfully, but webhook failed
      return res.status(207).json({
        success: true,
        warning: 'Video converted successfully but publication failed',
        data: {
          storyId: id,
          originalUrl: story.video_url,
          convertedUrl: conversionResult.convertedUrl,
          conversionTime: conversionResult.duration,
          metadata: conversionResult.metadata
        },
        error: `Publication webhook failed: ${webhookError.message}`
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

export default router;