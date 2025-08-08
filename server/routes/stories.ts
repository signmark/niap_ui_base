import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { directusApi } from '../directus';

const router = express.Router();

// Create a new story (supports both multi-slide and simple stories)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, campaign_id, campaignId, slides, metadata, image_url, content_type } = req.body;
    const userId = req.user?.id;
    const finalCampaignId = campaign_id || campaignId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Creating story:', { 
      title, 
      campaignId: finalCampaignId, 
      slidesCount: slides?.length, 
      metadata, 
      image_url,
      content_type 
    });

    // Determine story type based on metadata or slides
    let storyMetadata;
    if (metadata) {
      // Simple story from frontend
      storyMetadata = metadata;
    } else if (slides) {
      // Multi-slide story
      storyMetadata = { 
        slides: slides,
        storyType: 'instagram',
        format: '9:16',
        type: 'multi'
      };
    } else {
      // Default empty story
      storyMetadata = { 
        slides: [],
        storyType: 'instagram',
        format: '9:16',
        type: 'multi'
      };
    }

    // Create story content in campaign_content collection
    const storyData = {
      campaign_id: finalCampaignId,
      user_id: userId,
      title: title || 'Новая история',
      content_type: content_type || 'story',
      status: 'draft',
      content: '', // Empty content for stories
      image_url: image_url || null, // Support for simple stories with single image
      metadata: JSON.stringify(storyMetadata),
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

// Update story - SPECIFIC ROUTE FOR STORIES ONLY
router.put('/story/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slides, metadata } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Updating story:', id, { title, slidesCount: slides?.length, metadata });

    // Determine story type based on metadata or slides
    let storyMetadata;
    if (metadata) {
      // Simple story update
      storyMetadata = metadata;
    } else if (slides) {
      // Multi-slide story update
      storyMetadata = { 
        slides: slides,
        storyType: 'instagram',
        format: '9:16',
        type: 'multi',
        version: '1.0'
      };
    } else {
      // Keep existing metadata if none provided
      storyMetadata = { 
        slides: [],
        storyType: 'instagram',
        format: '9:16',
        type: 'multi',
        version: '1.0'
      };
    }

    const updateData = {
      title: title || 'Новая история',
      metadata: JSON.stringify(storyMetadata),
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

    console.log('[DEV] [stories] Fetching story by ID:', id);

    const response = await directusApi.get(`/items/campaign_content/${id}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });

    const story = response.data.data;
    
    // Verify user has access to this story
    if (story.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('[DEV] [stories] Story fetched successfully');
    res.json({ success: true, data: story });
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// Delete story
router.delete('/story/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[DEV] [stories] Deleting story:', id);

    // First verify the story belongs to the user
    const getResponse = await directusApi.get(`/items/campaign_content/${id}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });

    const story = getResponse.data.data;
    if (story.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete the story
    await directusApi.delete(`/items/campaign_content/${id}`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });

    console.log('[DEV] [stories] Story deleted successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;