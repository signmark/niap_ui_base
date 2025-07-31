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
        fields: 'id,name,access_token,category,tasks'
      },
      timeout: 10000
    });

    const allAccounts = response.data.data || [];
    
    console.log('🔵 [FACEBOOK-PAGES] All accounts from Facebook API:', allAccounts.map((account: any) => ({
      id: account.id,
      name: account.name,
      category: account.category,
      tasks: account.tasks
    })));
    
    // Фильтруем только Facebook СТРАНИЦЫ, исключаем группы
    // Проверяем: есть ли у account поле tasks - это признак страницы
    // Группы возвращаются через другой endpoint и не имеют tasks
    const pages = allAccounts.filter((account: any) => {
      console.log(`🔍 [FACEBOOK-PAGES] Checking account ${account.name} (${account.id}):`, {
        category: account.category,
        hasTasks: !!account.tasks,
        tasks: account.tasks || 'none'
      });
      
      // Проверяем что это страница, а не группа
      // У страниц есть tasks, у групп их нет в этом endpoint
      if (!account.tasks || !Array.isArray(account.tasks)) {
        console.log(`❌ [FACEBOOK-PAGES] Skipping ${account.name} - no tasks (likely group)`);
        return false;
      }
      
      // Дополнительно проверяем наличие нужных разрешений для публикации
      const hasManagetasks = account.tasks.includes('MANAGE');
      const hasCreateContent = account.tasks.includes('CREATE_CONTENT');
      
      if (!hasManagetasks || !hasCreateContent) {
        console.log(`❌ [FACEBOOK-PAGES] Skipping ${account.name} - insufficient permissions`);
        return false;
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

export default router;