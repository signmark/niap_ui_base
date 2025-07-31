import express from 'express';
import { GlobalApiKeysService } from '../services/global-api-keys.js';

const router = express.Router();

// Получение информации о YouTube канале по access token
router.get('/youtube/channel-info', async (req, res) => {
  console.log('🔍 [YOUTUBE-CHANNEL] Request received for channel info');
  console.log('🔍 [YOUTUBE-CHANNEL] Query params:', req.query);
  
  try {
    const { accessToken } = req.query;
    
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Access token is required'
      });
    }

    console.log('🔍 [YOUTUBE-CHANNEL] Getting channel info for token:', accessToken.toString().substring(0, 20) + '...');

    // Получаем системный YouTube API ключ
    const globalApiKeysService = new GlobalApiKeysService();
    const youtubeApiKey = await globalApiKeysService.getGlobalApiKey('YOUTUBE_API_KEY' as any);
    
    console.log('🔍 [YOUTUBE-CHANNEL] Retrieved YouTube API key:', youtubeApiKey ? 'Found' : 'Not found');
    
    if (!youtubeApiKey) {
      console.error('❌ [YOUTUBE-CHANNEL] YouTube API key not found in global settings');
      return res.status(500).json({
        success: false,
        error: 'YouTube API key not configured'
      });
    }

    console.log('✅ [YOUTUBE-CHANNEL] Using system YouTube API key:', youtubeApiKey.substring(0, 10) + '...');

    // Запрашиваем информацию о канале через YouTube Data API v3
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&access_token=${accessToken}&key=${youtubeApiKey}`
    );

    if (!channelResponse.ok) {
      const errorData = await channelResponse.text();
      console.error('❌ [YOUTUBE-CHANNEL] YouTube API error:', errorData);
      return res.status(channelResponse.status).json({
        success: false,
        error: `YouTube API error: ${channelResponse.statusText}`,
        details: errorData
      });
    }

    const channelData = await channelResponse.json();
    console.log('📊 [YOUTUBE-CHANNEL] YouTube API response:', JSON.stringify(channelData, null, 2));

    if (!channelData.items || channelData.items.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No YouTube channel found for this access token'
      });
    }

    const channel = channelData.items[0];
    const channelInfo = {
      channelId: channel.id,
      channelTitle: channel.snippet.title,
      channelDescription: channel.snippet.description,
      thumbnails: channel.snippet.thumbnails,
      subscriberCount: channel.statistics.subscriberCount,
      viewCount: channel.statistics.viewCount,
      videoCount: channel.statistics.videoCount,
      publishedAt: channel.snippet.publishedAt
    };

    console.log('✅ [YOUTUBE-CHANNEL] Channel info extracted:', {
      channelId: channelInfo.channelId,
      title: channelInfo.channelTitle,
      subscribers: channelInfo.subscriberCount
    });

    res.json({
      success: true,
      channelInfo
    });

  } catch (error) {
    console.error('❌ [YOUTUBE-CHANNEL] Error getting channel info:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;