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

// GET /api/facebook/instagram-connected-pages - получение Facebook страниц связанных с Instagram Business аккаунтами
router.get('/instagram-connected-pages', async (req, res) => {
  try {
    console.log('🟣 [FACEBOOK-IG-PAGES] === INSTAGRAM CONNECTED PAGES ENDPOINT CALLED ===');
    console.log('🟣 [FACEBOOK-IG-PAGES] Request received with query params:', req.query);
    const { token, access_token, campaignId } = req.query;
    const accessToken = token || access_token;

    if (!accessToken) {
      console.log('❌ [FACEBOOK-IG-PAGES] No access token provided');
      return res.status(400).json({
        error: 'Access token is required'
      });
    }

    console.log('🔵 [FACEBOOK-IG-PAGES] Using Instagram OAuth token to find connected pages...');

    // Пробуем различные подходы для получения Instagram Business аккаунтов
    console.log('🔵 [FACEBOOK-IG-PAGES] Trying different approaches to find Instagram Business accounts...');

    // Подход 1: Пробуем получить Instagram Business Account напрямую
    try {
      const igMeResponse = await axios.get(`https://graph.facebook.com/v18.0/me`, {
        params: {
          access_token: accessToken,
          fields: 'id,name'
        },
        timeout: 10000
      });

      const igUser = igMeResponse.data;
      console.log('🔵 [FACEBOOK-IG-PAGES] Instagram user info:', igUser);

      // Пробуем найти connected_facebook_page для этого аккаунта
      try {
        const businessResponse = await axios.get(`https://graph.facebook.com/v18.0/${igUser.id}`, {
          params: {
            access_token: accessToken,
            fields: 'connected_facebook_page'
          },
          timeout: 10000
        });

        if (businessResponse.data.connected_facebook_page) {
          const facebookPageId = businessResponse.data.connected_facebook_page.id;
          console.log('✅ [FACEBOOK-IG-PAGES] Found connected Facebook page:', facebookPageId);
          
          // Получаем информацию о Facebook странице
          const pageResponse = await axios.get(`https://graph.facebook.com/v18.0/${facebookPageId}`, {
            params: {
              access_token: accessToken,
              fields: 'id,name,category,access_token'
            },
            timeout: 10000
          });

          const facebookPage = pageResponse.data;
          
          const connectedPages = [{
            facebook_page: {
              id: facebookPage.id,
              name: facebookPage.name,
              category: facebookPage.category,
              access_token: facebookPage.access_token || accessToken
            },
            instagram_account: {
              id: igUser.id,
              username: igUser.name,
              name: igUser.name,
              profile_picture_url: null,
              followers_count: null
            }
          }];

          console.log('✅ [FACEBOOK-IG-PAGES] Connected page found via Instagram Business account:', {
            facebook: facebookPage.name,
            instagram: igUser.name
          });

          return res.json({
            success: true,
            connected_pages: connectedPages
          });
        }
      } catch (businessError: any) {
        console.log('⚠️ [FACEBOOK-IG-PAGES] No connected Facebook page found for current Instagram account:', businessError.response?.data?.error?.message || 'Unknown error');
      }
    } catch (igError: any) {
      console.log('⚠️ [FACEBOOK-IG-PAGES] Error accessing Instagram account info:', igError.response?.data?.error?.message || 'Unknown error');
    }

    // Подход 2: Получаем Facebook страницы с связанными Instagram аккаунтами
    try {
      console.log('🔵 [FACEBOOK-IG-PAGES] Getting Facebook pages with connected Instagram accounts...');
      const pagesResponse = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,category,access_token,connected_instagram_account'
        },
        timeout: 10000
      });

      if (pagesResponse.data.data && pagesResponse.data.data.length > 0) {
        console.log('✅ [FACEBOOK-IG-PAGES] Found Facebook pages via Instagram OAuth:', pagesResponse.data.data.length);
        console.log('🔍 [FACEBOOK-IG-PAGES] Raw API response structure:', JSON.stringify(pagesResponse.data, null, 2));
        
        const connectedPages = [];
        
        // Обрабатываем каждую страницу и проверяем наличие connected_instagram_account
        for (const page of pagesResponse.data.data) {
          console.log('🔍 [FACEBOOK-IG-PAGES] Page details:', JSON.stringify(page, null, 2));
          if (page.connected_instagram_account) {
            console.log('✅ [FACEBOOK-IG-PAGES] Page has connected Instagram account:', page.name, '→', page.connected_instagram_account.id);
            
            // Получаем детальную информацию об Instagram аккаунте
            try {
              const igInfoResponse = await axios.get(`https://graph.facebook.com/v18.0/${page.connected_instagram_account.id}`, {
                params: {
                  access_token: page.access_token || accessToken,
                  fields: 'id,username,name,profile_picture_url,followers_count'
                },
                timeout: 10000
              });

              connectedPages.push({
                facebook_page: {
                  id: page.id,
                  name: page.name,
                  category: page.category,
                  access_token: page.access_token || accessToken
                },
                instagram_account: {
                  id: igInfoResponse.data.id,
                  username: igInfoResponse.data.username,
                  name: igInfoResponse.data.name,
                  profile_picture_url: igInfoResponse.data.profile_picture_url,
                  followers_count: igInfoResponse.data.followers_count
                }
              });
            } catch (igInfoError: any) {
              console.log('⚠️ [FACEBOOK-IG-PAGES] Could not get Instagram account details for page', page.name, ':', igInfoError.response?.data?.error?.message || 'Unknown error');
              
              // Добавляем с базовой информацией из connected_instagram_account
              connectedPages.push({
                facebook_page: {
                  id: page.id,
                  name: page.name,
                  category: page.category,
                  access_token: page.access_token || accessToken
                },
                instagram_account: {
                  id: page.connected_instagram_account.id,
                  username: `IG_${page.connected_instagram_account.id}`,
                  name: `Instagram Account ${page.connected_instagram_account.id}`,
                  profile_picture_url: null,
                  followers_count: null
                }
              });
            }
          } else {
            console.log('⚠️ [FACEBOOK-IG-PAGES] Page has no connected Instagram account:', page.name);
          }
        }

        if (connectedPages.length > 0) {
          console.log('✅ [FACEBOOK-IG-PAGES] Found connected Instagram-Facebook pages:', connectedPages.length);
          return res.json({
            success: true,
            connected_pages: connectedPages
          });
        }
      }
    } catch (pagesError: any) {
      console.log('⚠️ [FACEBOOK-IG-PAGES] Error getting Facebook pages via Instagram token:', pagesError.response?.data?.error?.message || 'Unknown error');
    }

    // Альтернативный подход: если у нас есть campaignId, проверяем Instagram настройки кампании
    if (campaignId) {
      console.log('🔵 [FACEBOOK-IG-PAGES] Checking campaign Instagram settings for connected pages...');
      
      try {
        // Получаем Instagram аккаунты из кампании
        const directusResponse = await axios.get(`${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`
          },
          params: {
            fields: 'social_media_settings'
          }
        });

        const campaign = directusResponse.data.data;
        if (campaign?.social_media_settings?.instagram?.accounts) {
          const instagramAccounts = campaign.social_media_settings.instagram.accounts;
          
          const connectedPages = [];
          
          for (const igAccount of instagramAccounts) {
            // Попробуем найти связанную Facebook страницу для каждого Instagram аккаунта
            try {
              const igResponse = await axios.get(`https://graph.facebook.com/v18.0/${igAccount.id}`, {
                params: {
                  access_token: accessToken,
                  fields: 'connected_facebook_page'
                },
                timeout: 5000
              });

              if (igResponse.data.connected_facebook_page) {
                const facebookPageId = igResponse.data.connected_facebook_page.id;
                
                const pageResponse = await axios.get(`https://graph.facebook.com/v18.0/${facebookPageId}`, {
                  params: {
                    access_token: accessToken,
                    fields: 'id,name,category,access_token'
                  },
                  timeout: 5000
                });

                connectedPages.push({
                  facebook_page: {
                    id: pageResponse.data.id,
                    name: pageResponse.data.name,
                    category: pageResponse.data.category,
                    access_token: pageResponse.data.access_token || accessToken
                  },
                  instagram_account: {
                    id: igAccount.id,
                    username: igAccount.username,
                    name: igAccount.name,
                    profile_picture_url: igAccount.profile_picture_url,
                    followers_count: igAccount.followers_count
                  }
                });
              }
            } catch (igError: any) {
              console.log(`⚠️ [FACEBOOK-IG-PAGES] No connected Facebook page for Instagram ${igAccount.username}:`, igError.response?.data?.error?.message || 'Unknown error');
            }
          }

          if (connectedPages.length > 0) {
            console.log('✅ [FACEBOOK-IG-PAGES] Connected pages found via campaign settings:', connectedPages.length);
            
            return res.json({
              success: true,
              connected_pages: connectedPages
            });
          }
        }
      } catch (campaignError: any) {
        console.log('⚠️ [FACEBOOK-IG-PAGES] Error checking campaign Instagram settings:', campaignError.message);
      }
    }

    // Если ничего не найдено
    res.json({
      success: true,
      connected_pages: [],
      message: 'Не найдено Facebook страниц связанных с Instagram Business аккаунтами'
    });

  } catch (error: any) {
    console.error('❌ [FACEBOOK-IG-PAGES] Error fetching Instagram connected pages:', error.response?.data || error.message);
    
    let errorMessage = 'Не удалось получить связанные Instagram страницы';
    
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      if (fbError.code === 190) {
        errorMessage = 'Недействительный токен доступа';
      } else if (fbError.code === 104) {
        errorMessage = 'Недостаточно прав для доступа к Instagram данным';
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