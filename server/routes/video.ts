import express from 'express';
// Using authenticateUser middleware from routes.ts
const authenticateUser = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.directus_session_token;
    
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (cookieToken) {
      token = cookieToken;
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Set user info for the request
    req.user = { id: 'user-id', token };
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication error' });
  }
};
import { directusCrud } from '../services/directus-crud';

const router = express.Router();

// Create video content
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      campaignId, 
      videoUrl, 
      thumbnailUrl, 
      platforms, 
      tags, 
      scheduling 
    } = req.body;
    
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const videoData = {
      campaign_id: campaignId,
      user_id: userId,
      title,
      content: description,
      content_type: 'video-text',
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      platforms: JSON.stringify(platforms),
      scheduled_time: scheduling?.scheduledDate || null,
      metadata: JSON.stringify({
        tags: tags || [],
        scheduling: scheduling || {}
      }),
      status: 'draft'
    };

    const video = await directusCrud.create('campaign_content', videoData);

    res.json({ success: true, data: video });
  } catch (error) {
    console.error('Error creating video content:', error);
    res.status(500).json({ error: 'Failed to create video content' });
  }
});

// Update video content
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      videoUrl, 
      thumbnailUrl, 
      platforms, 
      tags, 
      scheduling 
    } = req.body;
    
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updateData = {
      title,
      content: description,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      platforms: JSON.stringify(platforms),
      scheduled_time: scheduling?.scheduledDate || null,
      metadata: JSON.stringify({
        tags: tags || [],
        scheduling: scheduling || {}
      }),
      updated_at: new Date().toISOString()
    };

    const video = await directusCrud.update('campaign_content', id, updateData);

    res.json({ success: true, data: video });
  } catch (error) {
    console.error('Error updating video content:', error);
    res.status(500).json({ error: 'Failed to update video content' });
  }
});

// Get video content by ID
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const video = await directusCrud.read('campaign_content', id);

    if (!video || video.user_id !== userId) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ success: true, data: video });
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Publish video
router.post('/:id/publish', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { platforms, scheduledAt } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get video
    const video = await directusCrud.read('campaign_content', id);
    if (!video || video.user_id !== userId) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Update video status and platforms
    const updateData = {
      status: scheduledAt ? 'scheduled' : 'published',
      scheduled_time: scheduledAt || new Date().toISOString(),
      platforms: JSON.stringify(platforms),
      updated_at: new Date().toISOString()
    };

    const updatedVideo = await directusCrud.update('campaign_content', id, updateData);

    // Here you would integrate with N8n for actual publishing
    // For now, we'll just update the status

    res.json({ 
      success: true, 
      data: updatedVideo,
      message: scheduledAt ? 'Video scheduled for publication' : 'Video published successfully'
    });
  } catch (error) {
    console.error('Error publishing video:', error);
    res.status(500).json({ error: 'Failed to publish video' });
  }
});

export default router;