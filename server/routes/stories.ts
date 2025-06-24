import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { directusApi } from '../directus';

const router = express.Router();

// Create a new story
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, campaignId, slides } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Creating story:', { title, campaignId, slidesCount: slides?.length });

    // Create story content in campaign_content collection
    const storyData = {
      campaign_id: campaignId,
      user_id: userId,
      title: title || 'Новая история',
      content_type: 'story',
      status: 'draft',
      content: '', // Empty content for stories
      metadata: JSON.stringify({ 
        slides: slides || [],
        storyType: 'instagram',
        format: '9:16'
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
          content_type: { _eq: 'story' }
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

// Create a new story
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, campaignId, slides } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Creating story:', { title, campaignId, slidesCount: slides?.length });

    // Create story content in campaign_content collection
    const storyData = {
      campaign_id: campaignId,
      user_id: userId,
      title: title || 'Новая история',
      content_type: 'story',
      status: 'draft',
      content: '', // Empty content for stories
      metadata: JSON.stringify({ 
        slides: slides || [],
        storyType: 'instagram',
        format: '9:16'
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

// Update story - SPECIFIC ROUTE FOR STORIES ONLY  
router.patch('/story/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slides } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] 🎯 PATCH REQUEST - UPDATING EXISTING STORY:', id, { title, slidesCount: slides?.length });

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

    const story = await directusCrud.read('campaign_content', id);

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
export default router;