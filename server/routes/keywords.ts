import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { directusApi } from '../directus';
import { GeminiProxyService } from '../services/gemini-proxy';
import { deepseekService } from '../services/deepseek';
import { log } from '../utils/logger';

const router = express.Router();

/**
 * Keywords Routes
 * Handles keyword management, search, and analysis for campaigns
 */

// Cache for keyword results to improve performance
const keywordCache = new Map<string, { results: any[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get keywords for a specific campaign
router.get('/:campaignId', authenticateUser, async (req: any, res) => {
  try {
    const campaignId = req.params.campaignId;
    const userId = req.user.id;
    const token = req.user.token;

    log('keywords', `Getting keywords for campaign ${campaignId}, user ${userId}`);

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

    if (campaignResponse.data.user_created !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get keywords from Directus
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
        sort: ['-trend', '-date_created'],
        fields: [
          'id',
          'keyword',
          'trend',
          'source',
          'difficulty',
          'search_volume',
          'date_created'
        ]
      }
    });

    const keywords = keywordsResponse.data || [];

    log('keywords', `Retrieved ${keywords.length} keywords for campaign ${campaignId}`);
    res.json(keywords);

  } catch (error: any) {
    log('keywords', `Error getting keywords for campaign ${req.params.campaignId}: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// Search for keywords using AI services
router.post('/search', authenticateUser, async (req: any, res) => {
  try {
    const { query, url, campaignId } = req.body;
    const userId = req.user.id;
    const token = req.user.token;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    log('keywords', `Searching keywords for query: "${query}", user ${userId}`);

    // Create cache key
    const cacheKey = `${query}-${url || 'no-url'}`.toLowerCase();
    
    // Check cache first
    const cached = keywordCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      log('keywords', `Returning cached results for query: "${query}"`);
      return res.json({ keywords: cached.results, cached: true });
    }

    // Generate keywords using AI services
    const keywordPromises = [];

    // Use Gemini for keyword generation
    keywordPromises.push(
      GeminiProxyService.generateKeywords(query, url)
        .then(keywords => keywords.map((k: any) => ({ ...k, source: 'gemini' })))
        .catch(error => {
          log('keywords', `Gemini keyword generation failed: ${error.message}`);
          return [];
        })
    );

    // Use DeepSeek for additional keywords
    keywordPromises.push(
      deepseekService.generateKeywords(query, url)
        .then(keywords => keywords.map((k: any) => ({ ...k, source: 'deepseek' })))
        .catch(error => {
          log('keywords', `DeepSeek keyword generation failed: ${error.message}`);
          return [];
        })
    );

    // Wait for all keyword generation services
    const keywordResults = await Promise.all(keywordPromises);
    
    // Merge and deduplicate keywords
    const allKeywords = keywordResults.flat();
    const uniqueKeywords = mergeKeywords(allKeywords);

    // Cache the results
    keywordCache.set(cacheKey, {
      results: uniqueKeywords,
      timestamp: Date.now()
    });

    // If campaignId is provided, save keywords to the campaign
    if (campaignId && uniqueKeywords.length > 0) {
      try {
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

        if (campaignResponse.data.user_created === userId) {
          // Save top keywords to campaign
          const topKeywords = uniqueKeywords.slice(0, 10);
          const keywordPromises = topKeywords.map(keyword => 
            directusApi.request({
              method: 'POST',
              url: '/items/campaign_keywords',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              data: {
                campaign_id: campaignId,
                keyword: keyword.keyword,
                trend: keyword.trend || 50,
                source: keyword.source,
                difficulty: keyword.difficulty || null,
                search_volume: keyword.search_volume || null
              }
            }).catch(error => {
              // Ignore duplicate key errors
              if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
                log('keywords', `Error saving keyword "${keyword.keyword}": ${error.message}`);
              }
            })
          );
          
          await Promise.all(keywordPromises);
          log('keywords', `Saved ${topKeywords.length} keywords to campaign ${campaignId}`);
        }
      } catch (error: any) {
        log('keywords', `Error saving keywords to campaign: ${error.message}`);
      }
    }

    log('keywords', `Generated ${uniqueKeywords.length} unique keywords for query: "${query}"`);
    res.json({ keywords: uniqueKeywords });

  } catch (error: any) {
    log('keywords', `Error searching keywords: ${error.message}`);
    res.status(500).json({ error: 'Failed to search keywords' });
  }
});

// Analyze keywords for SEO difficulty and search volume
router.post('/analyze', authenticateUser, async (req: any, res) => {
  try {
    const { keywords } = req.body;
    const userId = req.user.id;

    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords array is required' });
    }

    log('keywords', `Analyzing ${keywords.length} keywords for user ${userId}`);

    // Analyze keywords using Gemini
    const analysisPromises = keywords.map(async (keyword: string) => {
      try {
        const analysis = await GeminiProxyService.analyzeKeyword(keyword);
        return {
          keyword,
          difficulty: analysis.difficulty || 'medium',
          search_volume: analysis.search_volume || 'unknown',
          competition: analysis.competition || 'medium',
          suggestions: analysis.suggestions || []
        };
      } catch (error: any) {
        log('keywords', `Error analyzing keyword "${keyword}": ${error.message}`);
        return {
          keyword,
          difficulty: 'unknown',
          search_volume: 'unknown',
          competition: 'unknown',
          suggestions: []
        };
      }
    });

    const analysisResults = await Promise.all(analysisPromises);

    log('keywords', `Completed analysis for ${analysisResults.length} keywords`);
    res.json({ analysis: analysisResults });

  } catch (error: any) {
    log('keywords', `Error analyzing keywords: ${error.message}`);
    res.status(500).json({ error: 'Failed to analyze keywords' });
  }
});

// Add keywords to a campaign
router.post('/:campaignId/add', authenticateUser, async (req: any, res) => {
  try {
    const campaignId = req.params.campaignId;
    const { keywords } = req.body;
    const userId = req.user.id;
    const token = req.user.token;

    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords array is required' });
    }

    log('keywords', `Adding ${keywords.length} keywords to campaign ${campaignId}`);

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

    // Add keywords to campaign
    const addPromises = keywords.map((keywordData: any) => 
      directusApi.request({
        method: 'POST',
        url: '/items/campaign_keywords',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data: {
          campaign_id: campaignId,
          keyword: keywordData.keyword || keywordData,
          trend: keywordData.trend || 50,
          source: keywordData.source || 'manual',
          difficulty: keywordData.difficulty || null,
          search_volume: keywordData.search_volume || null
        }
      }).catch(error => {
        // Ignore duplicate key errors
        if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          throw error;
        }
      })
    );

    await Promise.all(addPromises);

    log('keywords', `Successfully added keywords to campaign ${campaignId}`);
    res.json({ message: 'Keywords added successfully' });

  } catch (error: any) {
    log('keywords', `Error adding keywords to campaign: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.status(500).json({ error: 'Failed to add keywords' });
  }
});

// Remove a keyword from a campaign
router.delete('/:campaignId/:keywordId', authenticateUser, async (req: any, res) => {
  try {
    const { campaignId, keywordId } = req.params;
    const userId = req.user.id;
    const token = req.user.token;

    log('keywords', `Removing keyword ${keywordId} from campaign ${campaignId}`);

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

    // Delete keyword
    await directusApi.request({
      method: 'DELETE',
      url: `/items/campaign_keywords/${keywordId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    log('keywords', `Successfully removed keyword ${keywordId}`);
    res.json({ message: 'Keyword removed successfully' });

  } catch (error: any) {
    log('keywords', `Error removing keyword: ${error.message}`);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    
    res.status(500).json({ error: 'Failed to remove keyword' });
  }
});

// Helper function to merge and deduplicate keywords
function mergeKeywords(allKeywords: any[]): any[] {
  const keywordMap = new Map<string, any>();
  
  // Process keywords from different sources
  allKeywords.forEach(keyword => {
    if (!keyword?.keyword) return;
    
    const key = keyword.keyword.toLowerCase().trim();
    if (!keywordMap.has(key)) {
      keywordMap.set(key, {
        keyword: keyword.keyword,
        trend: keyword.trend || 50,
        source: keyword.source || 'unknown',
        difficulty: keyword.difficulty || null,
        search_volume: keyword.search_volume || null
      });
    } else {
      // If keyword exists, prefer higher trend scores
      const existing = keywordMap.get(key);
      if (keyword.trend > existing.trend) {
        keywordMap.set(key, { ...existing, trend: keyword.trend, source: keyword.source });
      }
    }
  });
  
  // Convert back to array and sort by trend
  return Array.from(keywordMap.values())
    .sort((a, b) => (b.trend || 0) - (a.trend || 0))
    .slice(0, 20); // Limit to top 20 keywords
}

export default router;