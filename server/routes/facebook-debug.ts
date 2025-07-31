import express from 'express';
import axios from 'axios';

const router = express.Router();

// Проверка разрешений Facebook токена
router.get('/facebook/debug-token', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    console.log('🔍 [FB-DEBUG] Проверяем разрешения токена:', token.toString().substring(0, 20) + '...');

    // Проверяем разрешения токена
    const debugResponse = await axios.get(`https://graph.facebook.com/me/permissions`, {
      params: {
        access_token: token
      }
    });

    console.log('📋 [FB-DEBUG] Разрешения токена:', JSON.stringify(debugResponse.data, null, 2));

    // Проверяем информацию о пользователе
    const meResponse = await axios.get(`https://graph.facebook.com/me`, {
      params: {
        access_token: token,
        fields: 'id,name,email'
      }
    });

    console.log('👤 [FB-DEBUG] Информация о пользователе:', JSON.stringify(meResponse.data, null, 2));

    // Получаем страницы пользователя
    const pagesResponse = await axios.get(`https://graph.facebook.com/me/accounts`, {
      params: {
        access_token: token,
        fields: 'id,name,access_token,category'
      }
    });

    console.log('📄 [FB-DEBUG] Страницы пользователя:', JSON.stringify(pagesResponse.data, null, 2));

    res.json({
      success: true,
      permissions: debugResponse.data.data,
      user: meResponse.data,
      pages: pagesResponse.data.data
    });

  } catch (error) {
    console.error('❌ [FB-DEBUG] Ошибка проверки токена:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка проверки токена',
      details: error.response?.data || error.message
    });
  }
});

export default router;