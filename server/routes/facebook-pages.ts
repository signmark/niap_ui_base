import express from 'express';
import axios from 'axios';

const router = express.Router();

// GET /api/facebook/pages - получение Facebook страниц пользователя
router.get('/pages', async (req, res) => {
  try {
    const { access_token } = req.query;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'Access token is required'
      });
    }

    console.log('🔵 [FACEBOOK-PAGES] Fetching Facebook pages with token:', (access_token as string).substring(0, 20) + '...');

    // Получаем страницы пользователя через Facebook Graph API
    const response = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
      params: {
        access_token,
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
      success: true,
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
      success: false,
      error: errorMessage
    });
  }
});

export default router;