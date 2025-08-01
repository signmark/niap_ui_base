import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { directusApi } from '../directus';
import { log } from '../utils/logger';

const router = express.Router();

/**
 * Stories Routes
 * Handles Instagram Stories creation, editing, and management
 */

// Get stories for a specific campaign
router.get('/:campaignId', authenticateUser, async (req: any, res) => {
  try {
    const campaignId = req.params.campaignId;
    const userId = req.user.id;
    const token = req.user.token;

    log('stories', `Getting stories for campaign ${campaignId}, user ${userId}`);

    // Verify user has access to this campaign
    const campaignResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${campaignId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        fields: ['user_created']
      }
    });

    const campaignData = campaignResponse.data.data || campaignResponse.data;
    if (campaignData.user_created !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get stories from campaign_content with story type
    const storiesResponse = await directusApi.request({
      method: 'GET',
      url: '/items/campaign_content',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        filter: {
          campaign_id: {
            _eq: campaignId
          },
          content_type: {
            _eq: 'story'
          }
        },
        sort: ['-date_created'],
        fields: [
          'id',
          'title',
          'content',
          'metadata',
          'date_created',
          'status'
        ]
      }
    });

    const stories = storiesResponse.data.data || storiesResponse.data || [];

    log('stories', `Retrieved ${stories.length} stories for campaign ${campaignId}`);
    res.json({ data: stories });

  } catch (error: any) {
    log('stories', `Error getting stories: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Create a new story
router.post('/', authenticateUser, async (req: any, res) => {
  try {
    const { campaignId, title, slides, template } = req.body;
    const userId = req.user.id;
    const token = req.user.token;

    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID is required' });
    }

    log('stories', `Creating new story for campaign ${campaignId}`);

    // Verify user owns the campaign
    const campaignResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${campaignId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        fields: ['user_created']
      }
    });

    if (campaignResponse.data.user_created !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create story metadata
    const storyMetadata = {
      slides: slides || [],
      template: template || 'default',
      created_by: userId,
      version: 1
    };

    // Create story in campaign_content
    const storyResponse = await directusApi.request({
      method: 'POST',
      url: '/items/campaign_content',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        campaign_id: campaignId,
        title: title || 'Untitled Story',
        content_type: 'story',
        status: 'draft',
        metadata: JSON.stringify(storyMetadata)
      }
    });

    const createdStory = storyResponse.data;

    log('stories', `Successfully created story ${createdStory.id}`);
    res.status(201).json({ data: createdStory });

  } catch (error: any) {
    log('stories', `Error creating story: ${error.message}`);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Update an existing story
router.patch('/:storyId', authenticateUser, async (req: any, res) => {
  try {
    const storyId = req.params.storyId;
    const updateData = req.body;
    const userId = req.user.id;
    const token = req.user.token;

    log('stories', `Updating story ${storyId}`);

    // Get existing story
    const storyResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaign_content/${storyId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const story = storyResponse.data;

    // Verify user owns the campaign
    const campaignResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${story.campaign_id}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        fields: ['user_created']
      }
    });

    if (campaignResponse.data.user_created !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update story metadata if slides are provided
    let updatedMetadata = story.metadata;
    if (updateData.slides) {
      try {
        const currentMetadata = JSON.parse(story.metadata || '{}');
        updatedMetadata = JSON.stringify({
          ...currentMetadata,
          slides: updateData.slides,
          updated_by: userId,
          updated_at: new Date().toISOString()
        });
      } catch (error) {
        log('stories', `Error parsing story metadata: ${error}`);
      }
    }

    // Update story
    const updateResponse = await directusApi.request({
      method: 'PATCH',
      url: `/items/campaign_content/${storyId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        title: updateData.title || story.title,
        status: updateData.status || story.status,
        metadata: updatedMetadata
      }
    });

    const updatedStory = updateResponse.data;

    log('stories', `Successfully updated story ${storyId}`);
    res.json({ data: updatedStory });

  } catch (error: any) {
    log('stories', `Error updating story: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Delete a story
router.delete('/:storyId', authenticateUser, async (req: any, res) => {
  try {
    const storyId = req.params.storyId;
    const userId = req.user.id;
    const token = req.user.token;

    log('stories', `Deleting story ${storyId}`);

    // Get story to verify access
    const storyResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaign_content/${storyId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const story = storyResponse.data;

    // Verify user owns the campaign
    const campaignResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${story.campaign_id}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        fields: ['user_created']
      }
    });

    if (campaignResponse.data.user_created !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete story
    await directusApi.request({
      method: 'DELETE',
      url: `/items/campaign_content/${storyId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    log('stories', `Successfully deleted story ${storyId}`);
    res.json({ message: 'Story deleted successfully' });

  } catch (error: any) {
    log('stories', `Error deleting story: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;