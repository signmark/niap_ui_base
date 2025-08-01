import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { directusApi } from '../directus';
import { log } from '../utils/logger';

const router = express.Router();

/**
 * Campaign Routes
 * Handles CRUD operations for marketing campaigns
 */

// Get all campaigns for the authenticated user
router.get('/', authenticateUser, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const token = req.user.token;

    log('campaigns', `Getting campaigns for user ID: ${userId}`);

    // Get campaigns from Directus
    const response = await directusApi.request({
      method: 'GET',
      url: '/items/campaigns',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        filter: {
          user_created: {
            _eq: userId
          }
        },
        sort: ['-date_created'],
        fields: [
          'id',
          'name',
          'description',
          'status',
          'target_audience',
          'budget',
          'start_date',
          'end_date',
          'date_created',
          'date_updated'
        ]
      }
    });

    const campaigns = response.data || [];
    
    log('campaigns', `Retrieved ${campaigns.length} campaigns for user ${userId}`);
    res.json({ data: campaigns });

  } catch (error: any) {
    log('campaigns', `Error getting campaigns: ${error.message}`);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get a specific campaign by ID
router.get('/:id', authenticateUser, async (req: any, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.user.id;
    const token = req.user.token;

    log('campaigns', `Getting campaign ${campaignId} for user ${userId}`);

    // Get campaign from Directus
    const response = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${campaignId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        fields: [
          'id',
          'name',
          'description',
          'status',
          'target_audience',
          'budget',
          'start_date',
          'end_date',
          'date_created',
          'date_updated',
          'user_created'
        ]
      }
    });

    const campaign = response.data;

    // Verify user owns this campaign
    if (campaign.user_created !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    log('campaigns', `Successfully retrieved campaign ${campaignId}`);
    res.json({ data: campaign });

  } catch (error: any) {
    log('campaigns', `Error getting campaign ${req.params.id}: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// Create a new campaign
router.post('/', authenticateUser, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const token = req.user.token;
    const campaignData = req.body;

    // Validate required fields
    if (!campaignData.name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    log('campaigns', `Creating new campaign "${campaignData.name}" for user ${userId}`);

    // Prepare campaign data for Directus
    const newCampaign = {
      name: campaignData.name,
      description: campaignData.description || '',
      status: campaignData.status || 'draft',
      target_audience: campaignData.target_audience || '',
      budget: campaignData.budget || null,
      start_date: campaignData.start_date || null,
      end_date: campaignData.end_date || null,
      user_created: userId
    };

    // Create campaign in Directus
    const response = await directusApi.request({
      method: 'POST',
      url: '/items/campaigns',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: newCampaign
    });

    const createdCampaign = response.data;

    log('campaigns', `Successfully created campaign ${createdCampaign.id}`);
    res.status(201).json({ data: createdCampaign });

  } catch (error: any) {
    log('campaigns', `Error creating campaign: ${error.message}`);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Update an existing campaign
router.patch('/:id', authenticateUser, async (req: any, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.user.id;
    const token = req.user.token;
    const updateData = req.body;

    log('campaigns', `Updating campaign ${campaignId} for user ${userId}`);

    // First, verify user owns this campaign
    const existingResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${campaignId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        fields: ['user_created']
      }
    });

    if (existingResponse.data.user_created !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update campaign in Directus
    const response = await directusApi.request({
      method: 'PATCH',
      url: `/items/campaigns/${campaignId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: updateData
    });

    const updatedCampaign = response.data;

    log('campaigns', `Successfully updated campaign ${campaignId}`);
    res.json({ data: updatedCampaign });

  } catch (error: any) {
    log('campaigns', `Error updating campaign ${req.params.id}: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Delete a campaign
router.delete('/:id', authenticateUser, async (req: any, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.user.id;
    const token = req.user.token;

    log('campaigns', `Deleting campaign ${campaignId} for user ${userId}`);

    // First, verify user owns this campaign
    const existingResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${campaignId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        fields: ['user_created']
      }
    });

    if (existingResponse.data.user_created !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete campaign from Directus
    await directusApi.request({
      method: 'DELETE',
      url: `/items/campaigns/${campaignId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    log('campaigns', `Successfully deleted campaign ${campaignId}`);
    res.json({ message: 'Campaign deleted successfully' });

  } catch (error: any) {
    log('campaigns', `Error deleting campaign ${req.params.id}: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// Get campaign statistics
router.get('/:id/stats', authenticateUser, async (req: any, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.user.id;
    const token = req.user.token;

    log('campaigns', `Getting stats for campaign ${campaignId}`);

    // Verify user owns this campaign first
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

    // Get campaign content count
    const contentResponse = await directusApi.request({
      method: 'GET',
      url: '/items/campaign_content',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        filter: {
          campaign_id: {
            _eq: campaignId
          }
        },
        aggregate: {
          count: '*'
        }
      }
    });

    // Get campaign keywords count
    const keywordsResponse = await directusApi.request({
      method: 'GET',
      url: '/items/campaign_keywords',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        filter: {
          campaign_id: {
            _eq: campaignId
          }
        },
        aggregate: {
          count: '*'
        }
      }
    });

    const stats = {
      content_count: contentResponse.data?.[0]?.count || 0,
      keywords_count: keywordsResponse.data?.[0]?.count || 0
    };

    log('campaigns', `Retrieved stats for campaign ${campaignId}`);
    res.json({ data: stats });

  } catch (error: any) {
    log('campaigns', `Error getting campaign stats: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.status(500).json({ error: 'Failed to get campaign statistics' });
  }
});

export default router;