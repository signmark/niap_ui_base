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

    // Очищаем токен от пробелов и других невалидных символов
    const cleanToken = accessToken.toString().trim().replace(/\s+/g, '');
    console.log('🔍 [YOUTUBE-CHANNEL] Original token length:', accessToken.toString().length);
    console.log('🔍 [YOUTUBE-CHANNEL] Clean token length:', cleanToken.length);
    console.log('🔍 [YOUTUBE-CHANNEL] Getting channel info for token:', cleanToken.substring(0, 20) + '...');

    console.log('🔍 [YOUTUBE-CHANNEL] Using OAuth token for channel info (no API key needed for mine=true)');

    // Запрашиваем информацию о канале через YouTube Data API v3
    // Для запросов с mine=true используем только OAuth токен без API ключа
    // API ключ и OAuth токен должны быть из одного проекта Google Cloud
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`,
      {
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
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