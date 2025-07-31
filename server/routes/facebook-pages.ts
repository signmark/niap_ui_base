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

    // Сначала получаем user ID
    const userResponse = await axios.get(`https://graph.facebook.com/v18.0/me`, {
      params: {
        access_token: accessToken,
        fields: 'id,name'
      },
      timeout: 10000
    });

    const userId = userResponse.data.id;
    console.log('🔵 [FACEBOOK-PAGES] User ID obtained:', userId);

    // Теперь получаем страницы пользователя через /{user-id}/accounts
    const response = await axios.get(`https://graph.facebook.com/v18.0/${userId}/accounts`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,access_token,category,tasks,link,fan_count,about'
      },
      timeout: 10000
    });

    const allAccounts = response.data.data || [];
    
    console.log('🔵 [FACEBOOK-PAGES] All accounts from Facebook API:', allAccounts.map((account: any) => ({
      id: account.id,
      name: account.name,
      category: account.category,
      tasks: account.tasks,
      link: account.link,
      fan_count: account.fan_count
    })));
    
    // Фильтруем только Facebook СТРАНИЦЫ, исключаем группы и личные профили
    const pages = allAccounts.filter((account: any) => {
      console.log(`🔍 [FACEBOOK-PAGES] Checking account ${account.name} (${account.id}):`, {
        category: account.category,
        hasTasks: !!account.tasks,
        tasks: account.tasks || 'none',
        link: account.link,
        fan_count: account.fan_count
      });
      
      // Проверяем что это страница, а не группа
      if (!account.tasks || !Array.isArray(account.tasks)) {
        console.log(`❌ [FACEBOOK-PAGES] Skipping ${account.name} - no tasks (likely group or profile)`);
        return false;
      }
      
      // Исключаем личные профили по URL
      // Личные профили имеют URL формата profile.php?id= или facebook.com/profile.php
      if (account.link && (
        account.link.includes('profile.php?id=') || 
        account.link.includes('/profile.php') ||
        account.link.match(/facebook\.com\/[a-z]+\.[a-z]+\.[\d]+$/)
      )) {
        console.log(`❌ [FACEBOOK-PAGES] Skipping ${account.name} - personal profile detected by URL pattern`);
        return false;
      }
      
      // Исключаем аккаунты с категорией "Person" или без категории (часто личные профили)
      if (!account.category || account.category === 'Person') {
        console.log(`❌ [FACEBOOK-PAGES] Skipping ${account.name} - no category or Person category`);
        return false;
      }
      
      // Проверяем наличие нужных разрешений для публикации
      const hasManageTasks = account.tasks.includes('MANAGE');
      const hasCreateContent = account.tasks.includes('CREATE_CONTENT');
      
      if (!hasManageTasks || !hasCreateContent) {
        console.log(`❌ [FACEBOOK-PAGES] Skipping ${account.name} - insufficient permissions`);
        return false;
      }
      
      // Дополнительная проверка: у настоящих страниц обычно есть fan_count
      // Личные профили могут не иметь этого поля
      if (account.fan_count === undefined) {
        console.log(`⚠️ [FACEBOOK-PAGES] Warning: ${account.name} has no fan_count - might be personal profile`);
      }
      
      console.log(`✅ [FACEBOOK-PAGES] Valid page found: ${account.name}`);
      return true;
    });
    
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

// GET /api/facebook/page-token - получение токена конкретной страницы
router.get('/page-token/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    const { token, access_token } = req.query;
    const accessToken = token || access_token;

    console.log(`🔵 [FACEBOOK-PAGE-TOKEN] Getting token for page ${pageId}`);

    if (!accessToken) {
      return res.status(400).json({
        error: 'Access token is required'
      });
    }

    // Получаем информацию о странице напрямую
    const pageResponse = await axios.get(`https://graph.facebook.com/v18.0/${pageId}`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,access_token,category'
      },
      timeout: 10000
    });

    const pageData = pageResponse.data;
    
    console.log(`🔵 [FACEBOOK-PAGE-TOKEN] Page token retrieved for ${pageData.name}:`, {
      id: pageData.id,
      name: pageData.name,
      category: pageData.category,
      hasToken: !!pageData.access_token,
      tokenPreview: pageData.access_token ? pageData.access_token.substring(0, 20) + '...' : 'none'
    });

    res.json({
      success: true,
      page: {
        id: pageData.id,
        name: pageData.name,
        category: pageData.category,
        access_token: pageData.access_token
      }
    });

  } catch (error: any) {
    console.error(`❌ [FACEBOOK-PAGE-TOKEN] Error getting page token:`, error.response?.data || error.message);
    
    let errorMessage = 'Не удалось получить токен страницы';
    
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      if (fbError.code === 190) {
        errorMessage = 'Недействительный токен доступа';
      } else if (fbError.code === 104) {
        errorMessage = 'Недостаточно прав для доступа к странице';
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