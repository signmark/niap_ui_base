/**
 * Direct publishing endpoint that bypasses database updates
 * Focuses purely on content publishing to social platforms
 */

import express from 'express';
import axios from 'axios';
import { log } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * Direct content publishing without database dependencies
 */
router.post('/publish/now-direct', authMiddleware, async (req, res) => {
  try {
    const { contentId, platforms } = req.body;
    
    log(`[Direct Publishing] Publishing content ${contentId} to platforms: ${JSON.stringify(platforms)}`);
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Content ID required'
      });
    }
    
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Platforms array required'
      });
    }
    
    // Get authentication token for publishing
    let adminToken = process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_ADMIN_TOKEN;
    
    if (!adminToken) {
      try {
        const { directusAuthManager } = await import('../services/directus-auth-manager');
        const envConfig = (await import('../utils/environment-detector')).detectEnvironment();
        const authResult = await directusAuthManager.login(envConfig.adminEmail, envConfig.adminPassword);
        adminToken = authResult.token;
      } catch (authError: any) {
        log(`[Direct Publishing] Authentication failed: ${authError.message}`);
        return res.status(500).json({
          success: false,
          error: 'Authentication failed'
        });
      }
    }
    
    // Clean token format
    adminToken = adminToken.replace(/^Bearer\s+/i, '');
    
    const publishResults = [];
    
    // Publish to each platform
    for (const platform of platforms) {
      try {
        log(`[Direct Publishing] Publishing to ${platform}`);
        
        let result;
        if (platform === 'facebook') {
          // Direct Facebook API
          const appBaseUrl = process.env.APP_URL || `http://0.0.0.0:${process.env.PORT || 5000}`;
          const facebookWebhookUrl = `${appBaseUrl}/api/facebook-webhook-direct`;
          
          const facebookResponse = await axios.post(facebookWebhookUrl, { contentId }, {
            timeout: 30000
          });
          result = facebookResponse.data;
        } else {
          // N8N webhook for other platforms
          const n8nUrl = process.env.N8N_URL || process.env.VITE_N8N_URL || 'https://n8n.nplanner.ru';
          const webhookUrl = `${n8nUrl}/webhook/publish-${platform}`;
          
          const response = await axios.post(webhookUrl, { contentId }, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
          });
          result = response.data;
        }
        
        publishResults.push({
          platform,
          success: true,
          result
        });
        
        log(`[Direct Publishing] Successfully published to ${platform}`);
      } catch (error: any) {
        log(`[Direct Publishing] Failed to publish to ${platform}: ${error.message}`);
        
        publishResults.push({
          platform,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = publishResults.filter(r => r.success).length;
    
    return res.json({
      success: true,
      message: `Content published to ${successCount}/${platforms.length} platforms`,
      results: publishResults
    });
    
  } catch (error: any) {
    log(`[Direct Publishing] Critical error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: `Publishing failed: ${error.message}`
    });
  }
});

export default router;