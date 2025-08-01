import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { directusApi } from '../directus';
import { log } from '../utils/logger';

const router = express.Router();

/**
 * Trends Routes
 * Handles trend collection, analysis, and sentiment rating for campaigns
 */

// Get trends for a specific campaign
router.get('/:campaignId', authenticateUser, async (req: any, res) => {
  try {
    const campaignId = req.params.campaignId;
    const userId = req.user.id;
    const token = req.user.token;

    log('trends', `Getting trends for campaign ${campaignId}, user ${userId}`);

    // First verify user has access to this campaign
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

    // Get trends from Directus
    const trendsResponse = await directusApi.request({
      method: 'GET',
      url: '/items/campaign_trends',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        filter: {
          campaign_id: {
            _eq: campaignId
          }
        },
        sort: ['-date_created'],
        fields: [
          'id',
          'title',
          'content',
          'source_url',
          'sentiment_analysis',
          'rating',
          'date_created',
          'source_type'
        ]
      }
    });

    const trends = trendsResponse.data.data || trendsResponse.data || [];

    // Process sentiment analysis for display
    const processedTrends = trends.map((trend: any) => {
      let sentimentDisplay = '😐'; // Default neutral
      
      try {
        if (trend.sentiment_analysis) {
          const sentiment = JSON.parse(trend.sentiment_analysis);
          const score = sentiment.score || 0;
          
          if (score > 0.6) sentimentDisplay = '😊';
          else if (score > 0.2) sentimentDisplay = '🙂';
          else if (score < -0.2) sentimentDisplay = '😕';
          else if (score < -0.6) sentimentDisplay = '😢';
        }
      } catch (error) {
        log('trends', `Error parsing sentiment for trend ${trend.id}: ${error}`);
      }

      return {
        ...trend,
        sentiment_display: sentimentDisplay
      };
    });

    log('trends', `Retrieved ${processedTrends.length} trends for campaign ${campaignId}`);
    res.json({ data: processedTrends });

  } catch (error: any) {
    log('trends', `Error getting trends for campaign ${req.params.campaignId}: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Start trend collection for a campaign
router.post('/collect', authenticateUser, async (req: any, res) => {
  try {
    const { campaignId, keywords, platforms } = req.body;
    const userId = req.user.id;
    const token = req.user.token;

    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID is required' });
    }

    log('trends', `Starting trend collection for campaign ${campaignId}, user ${userId}`);

    // Verify user owns the campaign
    const campaignResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${campaignId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        fields: ['user_created', 'name']
      }
    });

    if (campaignResponse.data.user_created !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create collection task record
    const collectionTask = await directusApi.request({
      method: 'POST',
      url: '/items/trend_collection_tasks',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        campaign_id: campaignId,
        status: 'started',
        keywords: keywords || [],
        platforms: platforms || ['vk', 'telegram'],
        user_created: userId
      }
    });

    log('trends', `Created trend collection task ${collectionTask.data.id} for campaign ${campaignId}`);

    // Here you would typically trigger the actual collection process
    // For now, we'll just return success
    res.json({ 
      status: 'started',
      campaignId,
      taskId: collectionTask.data.id,
      message: 'Trend collection started'
    });

  } catch (error: any) {
    log('trends', `Error starting trend collection: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.status(500).json({ error: 'Failed to start trend collection' });
  }
});

// Analyze a specific source for sentiment
router.post('/analyze-source/:sourceId', authenticateUser, async (req: any, res) => {
  try {
    const sourceId = req.params.sourceId;
    const userId = req.user.id;
    const token = req.user.token;

    log('trends', `Analyzing source ${sourceId} for user ${userId}`);

    // Get the source from Directus
    const sourceResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaign_trends/${sourceId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const source = sourceResponse.data;

    // Verify user has access to this source's campaign
    const campaignResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${source.campaign_id}`,
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

    // Perform sentiment analysis (mock implementation for now)
    const sentimentAnalysis = {
      sentiment: Math.random() > 0.5 ? 'positive' : 'negative',
      score: (Math.random() - 0.5) * 2, // -1 to 1
      confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1
      analyzed_at: new Date().toISOString()
    };

    // Update the source with sentiment analysis
    await directusApi.request({
      method: 'PATCH',
      url: `/items/campaign_trends/${sourceId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        sentiment_analysis: JSON.stringify(sentimentAnalysis),
        rating: Math.floor(sentimentAnalysis.score * 50 + 50) // Convert to 0-100 scale
      }
    });

    log('trends', `Completed sentiment analysis for source ${sourceId}`);
    res.json({ 
      sourceId,
      analysis: sentimentAnalysis,
      message: 'Sentiment analysis completed'
    });

  } catch (error: any) {
    log('trends', `Error analyzing source ${req.params.sourceId}: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Source not found' });
    }
    
    res.status(500).json({ error: 'Failed to analyze source' });
  }
});

// Get trend collection status
router.get('/collection-status/:campaignId', authenticateUser, async (req: any, res) => {
  try {
    const campaignId = req.params.campaignId;
    const userId = req.user.id;
    const token = req.user.token;

    log('trends', `Getting collection status for campaign ${campaignId}`);

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

    // Get latest collection task
    const taskResponse = await directusApi.request({
      method: 'GET',
      url: '/items/trend_collection_tasks',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        filter: {
          campaign_id: {
            _eq: campaignId
          }
        },
        sort: ['-date_created'],
        limit: 1
      }
    });

    const latestTask = taskResponse.data?.[0];

    if (!latestTask) {
      return res.json({ 
        status: 'not_started',
        message: 'No collection tasks found'
      });
    }

    res.json({
      status: latestTask.status,
      taskId: latestTask.id,
      startedAt: latestTask.date_created,
      keywords: latestTask.keywords,
      platforms: latestTask.platforms
    });

  } catch (error: any) {
    log('trends', `Error getting collection status: ${error.message}`);
    res.status(500).json({ error: 'Failed to get collection status' });
  }
});

// Update trend rating manually
router.patch('/:trendId/rating', authenticateUser, async (req: any, res) => {
  try {
    const trendId = req.params.trendId;
    const { rating } = req.body;
    const userId = req.user.id;
    const token = req.user.token;

    if (rating === undefined || rating < 0 || rating > 100) {
      return res.status(400).json({ error: 'Rating must be between 0 and 100' });
    }

    log('trends', `Updating rating for trend ${trendId} to ${rating}`);

    // Get trend to verify access
    const trendResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaign_trends/${trendId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const trend = trendResponse.data;

    // Verify user owns the campaign
    const campaignResponse = await directusApi.request({
      method: 'GET',
      url: `/items/campaigns/${trend.campaign_id}`,
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

    // Update rating
    await directusApi.request({
      method: 'PATCH',
      url: `/items/campaign_trends/${trendId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: { rating }
    });

    log('trends', `Successfully updated rating for trend ${trendId}`);
    res.json({ message: 'Rating updated successfully' });

  } catch (error: any) {
    log('trends', `Error updating trend rating: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Trend not found' });
    }
    
    res.status(500).json({ error: 'Failed to update rating' });
  }
});

export default router;