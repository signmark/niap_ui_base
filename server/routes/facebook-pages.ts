import express from 'express';
import axios from 'axios';

const router = express.Router();

// GET /api/facebook/pages - получение Facebook страниц пользователя
router.get('/pages', async (req, res) => {
  try {
    console.log('🔵 [FACEBOOK-PAGES] Request received with query params:', req.query);
    const { token, access_token } = req.query;
    const accessToken = token || access_token;

    console.log('🔵 [FACEBOOK-PAGES] Extracted tokens:', {
      token: token ? (token as string).substring(0, 20) + '...' : 'null',
      access_token: access_token ? (access_token as string).substring(0, 20) + '...' : 'null',
      accessToken: accessToken ? (accessToken as string).substring(0, 20) + '...' : 'null'
    });

    if (!accessToken) {
      console.log('❌ [FACEBOOK-PAGES] No access token provided');
      return res.status(400).json({
        error: 'Access token is required'
      });
    }

    console.log('🔵 [FACEBOOK-PAGES] Fetching Facebook pages with token:', (accessToken as string).substring(0, 20) + '...');

    // Получаем страницы пользователя через Facebook Graph API
    const response = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,access_token,category,tasks'
      },
      timeout: 10000
    });

    const pages = response.data.data || [];
    
    console.log('🔵 [FACEBOOK-PAGES] Facebook pages fetched successfully:', {
      count: pages.length,
      pages: pages.map((p: any) => ({ id: p.id, name: p.name, category: p.category }))
    });

    res.json({
      pages: pages
    });

  } catch (error: any) {
    console.error('❌ [FACEBOOK-PAGES] Error fetching Facebook pages:', error.response?.data || error.message);
    
    let errorMessage = 'Не удалось получить страницы Facebook';
    
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      if (fbError.code === 190) {
        errorMessage = 'Недействительный токен доступа';
      } else if (fbError.code === 104) {
        errorMessage = 'Недостаточно прав для доступа к страницам';
      } else {
        errorMessage = fbError.message || errorMessage;
      }
    }

    res.status(400).json({
      error: errorMessage
    });
  }
});

export default router;