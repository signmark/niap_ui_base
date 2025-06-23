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

// Create a new story
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { title, campaignId, slides } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Create story content
    const storyData = {
      campaign_id: campaignId,
      user_id: userId,
      title,
      content_type: 'story',
      status: 'draft',
      metadata: JSON.stringify({ slides: slides || [] })
    };

    const story = await directusCrud.create('campaign_content', storyData);

    res.json({ success: true, data: story });
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Update story
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slides } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updateData = {
      title,
      metadata: JSON.stringify({ slides: slides || [] }),
      updated_at: new Date().toISOString()
    };

    const story = await directusCrud.update('campaign_content', id, updateData);

    res.json({ success: true, data: story });
  } catch (error) {
    console.error('Error updating story:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Get story by ID
router.get('/:id', authenticateUser, async (req, res) => {
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

// Delete story
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify ownership
    const story = await directusCrud.read('campaign_content', id);
    if (!story || story.user_id !== userId) {
      return res.status(404).json({ error: 'Story not found' });
    }

    await directusCrud.delete('campaign_content', id);

    res.json({ success: true, message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// Publish story
router.post('/:id/publish', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { platforms, scheduledAt } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get story
    const story = await directusCrud.read('campaign_content', id);
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

    const updatedStory = await directusCrud.update('campaign_content', id, updateData);

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