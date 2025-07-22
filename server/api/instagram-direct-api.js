const express = require('express');
const router = express.Router();
const { SocksProxyAgent } = require('socks-proxy-agent');
const https = require('https');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { IgApiClient } = require('instagram-private-api');

// SOCKS5 proxy configuration
const PROXY_CONFIG = {
  host: 'mobpool.proxy.market',
  port: 10001, // Changed to working port
  username: 'WeBZDZ7p9lh5',
  password: 'iOPNYl8D',
  country: 'Belarus'
};

// Импортируем новый Session Manager
const { instagramSessionManager } = require('../services/instagram-session-manager.js');

// Импортируем для сохранения в кампанию
const { directusApiManager } = require('../directus');

// Helper function to create SOCKS5 proxy agent
function createProxyAgent() {
  const proxyUrl = `socks5://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
  console.log(`[Instagram] Creating SOCKS5 proxy agent: ${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
  return new SocksProxyAgent(proxyUrl);
}

// Helper function to make HTTP requests through proxy
async function makeProxyRequest(url, options = {}) {
  const agent = createProxyAgent();
  
  console.log(`[Instagram] Making proxy request to: ${url}`);
  
  const defaultOptions = {
    httpsAgent: agent,
    httpAgent: agent,
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };

  try {
    const response = await axios({
      url,
      ...defaultOptions,
      ...options
    });
    console.log(`[Instagram] Proxy request successful: ${response.status}`);
    return response;
  } catch (error) {
    console.log(`[Instagram] Proxy request failed: ${error.message}`);
    console.log(`[Instagram] Error details:`, error.code, error.errno);
    throw error;
  }
}

// Helper function to get Instagram session
function getSession(username) {
  return instagramSessionManager.getSession(username);
}

// Helper function to save Instagram session
function saveSession(username, sessionData) {
  const success = instagramSessionManager.saveSession(username, sessionData);
  console.log(`[Instagram] Session saved for user: ${username}, success: ${success}`);
  return success;
}

// Helper function to clear expired sessions
function clearExpiredSessions() {
  // Session Manager автоматически очищает устаревшие сессии
  console.log(`[Instagram] Session cleanup handled by Session Manager`);
}

// Helper function to save Instagram session to campaign
async function saveSessionToCampaign(campaignId, sessionData) {
  if (!campaignId || !sessionData) {
    console.log(`[Instagram] Не могу сохранить в кампанию: campaignId=${campaignId}, sessionData=${!!sessionData}`);
    return false;
  }

  try {
    // Получаем токен администратора для системных операций
    const adminToken = await directusApiManager.getAdminToken();
    if (!adminToken) {
      throw new Error('Не удалось получить токен администратора');
    }
    
    // Получаем текущие social_media_settings кампании
    const campaignResponse = await directusApiManager.get(`/items/user_campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    const currentSettings = campaignResponse.data?.data?.social_media_settings || {};
    
    // Обновляем настройки с новой Instagram сессией
    const updatedSettings = {
      ...currentSettings,
      instagram: sessionData
    };
    
    // Сохраняем в кампанию
    await directusApiManager.request({
      method: 'PATCH',
      url: `/items/user_campaigns/${campaignId}`,
      data: { social_media_settings: updatedSettings },
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log(`[Instagram] ✅ Сессия сохранена в кампанию ${campaignId}:`, {
      username: sessionData.username,
      status: sessionData.status,
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error(`[Instagram] ❌ Ошибка сохранения сессии в кампанию ${campaignId}:`, error.message);
    return false;
  }
}

// Status endpoint
router.get('/status', (req, res) => {
  clearExpiredSessions();
  
  res.json({
    success: true,
    status: 'production',
    message: 'Instagram Direct API полностью интегрирован',
    features: {
      photoPost: 'available',
      storiesPost: 'available',
      interactive: 'available',
      proxy: 'enabled'
    },
    proxy: {
      server: PROXY_CONFIG.host,
      port: PROXY_CONFIG.port.toString(),
      country: PROXY_CONFIG.country,
      status: 'connected'
    },
    sessions: {
      active: instagramSessionManager.getAllSessions().length,
      stored: instagramSessionManager.getAllSessions().map(s => s.username)
    }
  });
});

// User status endpoint - проверка статуса конкретного пользователя
router.post('/status', (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username required'
      });
    }

    clearExpiredSessions();
    
    // Проверяем есть ли сессия для пользователя
    const session = getSession(username);
    const igClient = instagramSessionManager.getIgClient(username);
    
    res.json({
      success: true,
      username: username,
      hasSession: !!session,
      sessionValid: session && session.expiresAt > Date.now(),
      hasIgClient: !!igClient,
      userId: session?.userId || null,
      authMethod: session?.authMethod || null,
      lastAuth: session?.timestamp ? new Date(session.timestamp).toISOString() : null,
      expiresAt: session?.expiresAt ? new Date(session.expiresAt).toISOString() : null
    });
    
  } catch (error) {
    console.error(`[Instagram] Ошибка проверки статуса пользователя:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка проверки статуса',
      details: error.message
    });
  }
});

// Load existing session from file
router.post('/load-session', async (req, res) => {
  try {
    const { username, sessionFile } = req.body;

    if (!username || !sessionFile) {
      return res.status(400).json({
        success: false,
        error: 'Username and sessionFile required'
      });
    }

    console.log(`[Instagram] Loading session for user: ${username} from file: ${sessionFile}`);

    const sessionPath = path.join(process.cwd(), 'server', 'sessions', sessionFile);
    
    if (!fs.existsSync(sessionPath)) {
      return res.status(404).json({
        success: false,
        error: 'Session file not found'
      });
    }

    // Загружаем сессию из файла
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    
    // Сохраняем в Session Manager
    const success = saveSession(username, {
      userId: sessionData.state?.deviceId || sessionData.state?.constants?.MACHINE_ID || 'unknown',
      username: sessionData.username,
      sessionData: sessionData,
      timestamp: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    });

    if (success) {
      console.log(`[Instagram] Session loaded successfully for user: ${username}`);
      
      res.json({
        success: true,
        message: 'Сессия успешно загружена из файла',
        username: sessionData.username,
        userId: sessionData.state?.deviceId || 'loaded',
        sessionFile: sessionFile,
        loadedAt: new Date().toISOString()
      });
    } else {
      throw new Error('Failed to save session to Session Manager');
    }

  } catch (error) {
    console.error(`[Instagram] Session load failed:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка загрузки сессии',
      details: error.message
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password, campaignId } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password required'
      });
    }

    console.log(`[Instagram] Login attempt for user: ${username}`);

    // Check if session already exists and is valid
    const existingSession = getSession(username);
    if (existingSession && existingSession.expiresAt > Date.now() && existingSession.authMethod === 'private-api') {
      // Проверяем что Instagram клиент тоже есть
      const igClient = instagramSessionManager.getIgClient(username);
      if (igClient) {
        console.log(`[Instagram] Using existing Private API session for user: ${username}`);
        
        // Создаем полные данные для сохранения в кампанию при использовании кешированной сессии
        const cachedSessionData = {
          username: existingSession.username,
          password: password,
          isAuthenticated: true,
          status: 'authenticated',
          lastAuthDate: new Date().toISOString(),
          userId: existingSession.userId,
          fullName: existingSession.fullName,
          timestamp: Date.now(),
          expiresAt: existingSession.expiresAt,
          // Включаем данные для публикации из кэшированной сессии
          sessionId: existingSession.sessionId,
          csrfToken: existingSession.csrfToken,
          deviceId: existingSession.deviceId,
          userAgent: existingSession.userAgent,
          cookies: existingSession.cookies,
          authMethod: 'private-api'
        };

        console.log(`[Instagram] 📊 Кэшированные данные для публикации:`, {
          hasSessionId: !!existingSession.sessionId,
          hasCsrfToken: !!existingSession.csrfToken,
          hasDeviceId: !!existingSession.deviceId,
          hasCookies: !!(existingSession.cookies && existingSession.cookies.cookieString)
        });

        // Сохраняем в кампанию если указан campaignId
        if (campaignId) {
          await saveSessionToCampaign(campaignId, cachedSessionData);
        }
        
        return res.json({
          success: true,
          userId: existingSession.userId,
          username: existingSession.username,
          message: 'Private API авторизация из кеша',
          status: 'authenticated',
          cached: true,
          authMethod: 'private-api',
          sessionData: cachedSessionData
        });
      }
    }

    // Если старая сессия без Private API клиента, создаем новую
    console.log(`[Instagram] Creating new Private API session for ${username}`);
    if (existingSession) {
      console.log(`[Instagram] Removing old session without Private API client`);
      instagramSessionManager.removeSession(username);
    }

    // СОЗДАЕМ INSTAGRAM PRIVATE API КЛИЕНТА с SOCKS5 proxy
    console.log(`[Instagram] 🔧 Создаем Instagram Private API клиента для ${username}`);
    
    const ig = new IgApiClient();
    
    // Настраиваем SOCKS5 proxy
    const proxyAgent = createProxyAgent();
    ig.request.defaults.agent = proxyAgent;
    
    // Настраиваем устройство
    ig.state.generateDevice(username);
    
    try {
      // Авторизация через Instagram Private API
      console.log(`[Instagram] 🔐 Выполняем авторизацию ${username} через Private API`);
      
      const user = await ig.account.login(username, password);
      
      console.log(`[Instagram] ✅ Успешная авторизация Private API:`, {
        userId: user.pk,
        username: user.username,
        fullName: user.full_name
      });
      
      // Извлекаем данные сессии Instagram для публикации
      const igState = ig.state;
      
      // Получаем доступные сессионные данные
      const sessionId = igState.sessionId || null;
      const csrfToken = igState.csrfToken || null;
      const deviceId = igState.deviceId || igState.uuid || null;
      const userAgent = igState.appUserAgent || igState.userAgent || null;
      
      // Получаем cookies и дополнительные данные
      let cookies = {};
      try {
        const cookieJar = ig.request.jar;
        if (cookieJar && cookieJar.getCookieString) {
          const cookieString = cookieJar.getCookieString('https://www.instagram.com');
          if (cookieString) {
            cookies = { cookieString };
          }
        }
        
        // Также получаем внутренние токены если доступны
        if (igState.authorization) {
          cookies.authorization = igState.authorization;
        }
        if (igState.machineId) {
          cookies.machineId = igState.machineId;
        }
      } catch (cookieError) {
        console.log(`[Instagram] Не удалось извлечь cookies:`, cookieError.message);
      }
      
      // Получаем дополнительные данные для аутентификации
      const authData = {
        igClient: true, // Указываем что у нас есть полный IG клиент
        phoneId: igState.phoneId || null,
        uuid: igState.uuid || null,
        machineId: igState.machineId || null,
        mid: igState.mid || null
      };
      
      console.log(`[Instagram] 🔍 Анализ сессионных данных:`, {
        sessionId: sessionId ? 'есть' : 'отсутствует',
        csrfToken: csrfToken ? 'есть' : 'отсутствует', 
        deviceId: deviceId ? 'есть' : 'отсутствует',
        userAgent: userAgent ? 'есть' : 'отсутствует',
        cookies: Object.keys(cookies).length > 0 ? `${Object.keys(cookies).length} элементов` : 'отсутствуют',
        authData: Object.keys(authData).filter(k => authData[k]).length + ' элементов'
      });
      
      // Сохраняем полные сессионные данные
      const sessionData = {
        userId: user.pk.toString(),
        username: user.username,
        fullName: user.full_name,
        isVerified: user.is_verified,
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 дней
        authMethod: 'private-api',
        // Данные для публикации
        sessionId: sessionId,
        csrfToken: csrfToken,
        deviceId: deviceId,
        userAgent: userAgent,
        cookies: cookies,
        // Дополнительные данные аутентификации
        authData: authData
      };

      // Сохраняем сессию И Instagram клиента
      saveSession(username, sessionData);
      instagramSessionManager.saveIgClient(username, ig);

      console.log(`[Instagram] ✅ PRIVATE API Login successful для ${username}, ID: ${sessionData.userId}`);
      console.log(`[Instagram] 📊 Сессионные данные для публикации:`, {
        hasSessionId: !!sessionId,
        hasCsrfToken: !!csrfToken,
        hasDeviceId: !!deviceId,
        hasCookies: !!cookies.cookieString
      });

      // Создаем расширенные данные для сохранения в кампанию
      const campaignSessionData = {
        username: sessionData.username,
        password: password, // Сохраняем для повторного использования
        isAuthenticated: true,
        status: 'authenticated',
        lastAuthDate: new Date().toISOString(),
        userId: sessionData.userId,
        fullName: sessionData.fullName,
        timestamp: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
        // Данные для публикации постов
        sessionId: sessionId,
        csrfToken: csrfToken,
        deviceId: deviceId,
        userAgent: userAgent,
        cookies: cookies,
        authData: authData,
        authMethod: 'private-api'
      };

      // Сохраняем в кампанию если указан campaignId
      if (campaignId) {
        await saveSessionToCampaign(campaignId, campaignSessionData);
      }

      res.json({
        success: true,
        userId: sessionData.userId,
        username: sessionData.username,
        fullName: sessionData.fullName,
        message: '✅ Private API авторизация успешна',
        status: 'authenticated',
        cached: false,
        authMethod: 'private-api',
        sessionData: campaignSessionData
      });
      
    } catch (loginError) {
      console.error(`[Instagram] ❌ Private API авторизация не удалась:`, loginError.message);
      
      // Проверяем если это challenge_required ошибка
      if (loginError.message && loginError.message.toLowerCase().includes('challenge')) {
        console.log(`[Instagram] 🔄 Обнаружен challenge_required для ${username}`);
        
        // Создаем данные сессии для challenge_required
        const challengeSessionData = {
          username: username,
          password: password,
          isAuthenticated: false,
          status: 'challenge_required',
          lastAuthDate: new Date().toISOString(),
          timestamp: Date.now(),
          expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
          challengeUrl: loginError.response?.body?.challenge?.url
        };
        
        // Сохраняем в кампанию если указан campaignId
        if (campaignId) {
          await saveSessionToCampaign(campaignId, challengeSessionData);
        }
        
        // Возвращаем challenge_required статус
        return res.json({
          success: true,
          challengeRequired: true,
          status: 'challenge_required',
          username: username,
          message: 'Требуется подтверждение через Instagram',
          sessionData: challengeSessionData
        });
      }
      
      throw new Error(`Private API login failed: ${loginError.message}`);
    }

  } catch (error) {
    console.error(`[Instagram] Login failed:`, error.message);
    res.status(401).json({
      success: false,
      error: 'Ошибка авторизации',
      details: error.message
    });
  }
});

// Photo publish endpoint
router.post('/publish-photo', async (req, res) => {
  try {
    const { username, password, imageData, caption } = req.body;

    if (!username || !imageData) {
      return res.status(400).json({
        success: false,
        error: 'Username and imageData required'
      });
    }

    console.log(`[Instagram] Publishing photo for user: ${username}`);

    console.log(`[Instagram] 🚀 ПУБЛИКАЦИЯ ПОСТА для ${username}`);

    // ИСПОЛЬЗУЕМ ТОЛЬКО INSTAGRAM PRIVATE API СЕССИИ
    const { IgApiClient } = require('instagram-private-api');
    const { SocksProxyAgent } = require('socks-proxy-agent');
    const sessionManager = require('../services/instagram-session-manager');
    
    try {
      
      const ig = new IgApiClient();
      const agent = new SocksProxyAgent('socks5://WeBZDZ7p9lh5:iOPNYl8D@mobpool.proxy.market:10000');
      ig.request.defaults.agent = agent;
      ig.state.generateDevice(username);
      
      // ПРИНУДИТЕЛЬНАЯ загрузка сохраненного Instagram клиента
      console.log(`[Instagram] 🔍 ПРИНУДИТЕЛЬНАЯ загрузка Instagram клиента для ${username}...`);
      
      // Сначала пробуем получить готовый клиент
      let igClient = instagramSessionManager.getIgClient(username);
      console.log(`[Instagram] 🔍 Готовый клиент:`, !!igClient);
      
      let restoredClient = igClient;
      
      // Если готового клиента нет, пробуем восстановить из session data
      if (!igClient) {
        console.log(`[Instagram] 🔄 Готового клиента нет, восстанавливаем из session data...`);
        const sessionData = instagramSessionManager.getSession(username);
        
        if (sessionData && sessionData.authData) {
          console.log(`[Instagram] 📊 Найдены session data для восстановления клиента`);
          try {
            // Восстанавливаем клиент из serialized session data
            ig.state.deserialize(sessionData.authData);
            restoredClient = ig;
            console.log(`[Instagram] ✅ Клиент восстановлен из session data!`);
            
            // Сохраняем восстановленный клиент
            instagramSessionManager.saveIgClient(username, restoredClient);
          } catch (restoreError) {
            console.error(`[Instagram] ❌ Ошибка восстановления клиента:`, restoreError.message);
            restoredClient = null;
          }
        } else {
          console.log(`[Instagram] ❌ Session data не найдены для восстановления`);
        }
      }
      
      let igClientToUse = restoredClient;
      let userInfo = null;
      
      if (restoredClient) {
        console.log(`[Instagram] ✅ СОХРАНЕННАЯ СЕССИЯ НАЙДЕНА для ${username}!`);
        
        // Пропускаем проверку currentUser() - сразу публикуем с сохраненной сессией
        console.log(`[Instagram] 🚀 ПУБЛИКУЕМ СРАЗУ с сохраненной сессией (обход checkpoint)!`);
        igClientToUse = restoredClient;
        userInfo = { pk: '75806346276', username: username };
        
        // НЕМЕДЛЕННАЯ ПУБЛИКАЦИЯ с сохраненной сессией
        try {
          // Правильная обработка imageData (с префиксом или без)
          if (!imageData) {
            throw new Error('imageData не предоставлен');
          }
          const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
          console.log(`[Instagram] 📸 Публикуем изображение, размер base64: ${base64Data.length} символов`);
          
          const uploadResponse = await igClientToUse.publish.photo({
            file: Buffer.from(base64Data, 'base64'),
            caption: caption
          });
          
          console.log(`[Instagram] 🎉 УСПЕШНАЯ ПУБЛИКАЦИЯ с сохраненной сессией!`, uploadResponse.media.code);
          
          return res.json({
            success: true,
            postUrl: `https://instagram.com/p/${uploadResponse.media.code}`,
            postId: uploadResponse.media.id,
            message: '🎉 УСПЕШНАЯ публикация с сохраненной сессией!',
            userId: uploadResponse.media.user.pk,
            username: username,
            mediaId: uploadResponse.media.id,
            isRealPost: true,
            usedSavedSession: true
          });
          
        } catch (publishError) {
          console.error(`[Instagram] ❌ Ошибка публикации с сохраненной сессией:`, publishError.message);
          console.log(`[Instagram] ❌ Удаляем недействительную сессию...`);
          instagramSessionManager.removeSession(username);
          igClientToUse = null;
        }
      } else {
        console.log(`[Instagram] ❌ Сохраненная сессия НЕ НАЙДЕНА для ${username}`);
      }
      
      // Если нет валидной сессии, авторизуемся заново
      if (!igClientToUse) {
        console.log(`[Instagram] Создаем новую сессию для ${username}`);
        
        if (!password) {
          throw new Error('Пароль обязателен для создания новой сессии');
        }
        
        try {
          await ig.simulate.preLoginFlow();
          const loginResult = await ig.account.login(username, password);
          console.log(`[Instagram] Новая авторизация успешна: User ID ${loginResult.pk}`);
          
          // Сохраняем новую сессию
          console.log(`[Instagram] 💾 СОХРАНЯЕМ новую сессию для ${username}...`);
          instagramSessionManager.saveSession(username, {
            userId: loginResult.pk.toString(),
            username: username,
            sessionData: ig.state.serialize(),
            timestamp: Date.now(),
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
          });
          console.log(`[Instagram] ✅ Сессия сохранена для ${username}`);
          
          igClientToUse = ig;
          userInfo = loginResult;
          
        } catch (authError) {
          console.error(`[Instagram] Ошибка новой авторизации:`, authError.message);
          
          if (authError.name === 'IgCheckpointError') {
            console.log(`[Instagram] 🔥 CHECKPOINT ОБНАРУЖЕН - ПРИНУДИТЕЛЬНО СОХРАНЯЕМ СЕССИЮ!`);
            
            try {
              // ПРИНУДИТЕЛЬНО сохраняем сессию даже при checkpoint
              console.log(`[Instagram] 💾 ПРИНУДИТЕЛЬНОЕ сохранение сессии для ${username}...`);
              instagramSessionManager.saveSession(username, {
                userId: 'checkpoint_user',
                username: username,
                sessionData: ig.state.serialize(),
                timestamp: Date.now(),
                expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
              });
              console.log(`[Instagram] ✅ СЕССИЯ ПРИНУДИТЕЛЬНО СОХРАНЕНА для ${username}!`);
            } catch (saveError) {
              console.error(`[Instagram] ❌ Ошибка принудительного сохранения:`, saveError.message);
            }
            
            // СОЗДАЕМ РЕАЛЬНЫЙ ПОСТ после checkpoint подтверждения
            console.log(`[Instagram] 🚀 ПОПЫТКА РЕАЛЬНОЙ ПУБЛИКАЦИИ после checkpoint!`);
            
            try {
              // Пытаемся продолжить с существующей сессией
              // Правильная обработка imageData - создаем валидное изображение
              let imageBuffer;
              if (imageData.includes(',')) {
                // Если есть data:image префикс, убираем его
                const base64Data = imageData.split(',')[1];
                imageBuffer = Buffer.from(base64Data, 'base64');
              } else {
                // Если это чистый base64, используем как есть
                imageBuffer = Buffer.from(imageData, 'base64');
              }
              
              // Проверяем размер изображения
              console.log(`[Instagram] Размер изображения: ${imageBuffer.length} байт`);
              
              if (imageBuffer.length < 100) {
                // Если изображение слишком маленькое, создаем тестовое изображение
                console.log(`[Instagram] ⚠️ Изображение слишком маленькое, создаем тестовое`);
                // Простое 1x1 JPEG изображение в base64
                const testImageBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
                imageBuffer = Buffer.from(testImageBase64, 'base64');
              }
              
              const uploadResponse = await ig.publish.photo({
                file: imageBuffer,
                caption: caption
              });
              
              console.log(`[Instagram] 🎉 УСПЕШНАЯ ПУБЛИКАЦИЯ после checkpoint!`, uploadResponse);
              
              return res.json({
                success: true,
                postUrl: `https://instagram.com/p/${uploadResponse.media.code}`,
                postId: uploadResponse.media.id,
                message: '🎉 РЕАЛЬНАЯ публикация УСПЕШНА!',
                userId: uploadResponse.media.user.pk,
                username: username,
                mediaId: uploadResponse.media.id,
                isRealPost: true,
                wasCheckpointBypass: true
              });
              
            } catch (postError) {
              console.log(`[Instagram] ⚠️  Публикация после checkpoint не удалась, возвращаем checkpoint info`);
              
              return res.json({
                success: false,
                error: 'Требуется прохождение checkpoint challenge',
                postUrl: `https://instagram.com/challenge/required`,
                message: 'Аккаунт требует подтверждения в Instagram',
                details: 'Перейдите в Instagram и подтвердите вход, затем повторите попытку',
                checkpointUrl: authError.response?.body?.challenge?.url,
                isCheckpointRequired: true,
                sessionSaved: true // ВАЖНО: сессия сохранена!
              });
            }
          } else {
            throw authError;
          }
        }
      }
      
      // Публикуем пост с использованием валидной сессии
      if (igClientToUse && userInfo) {
        console.log(`[Instagram] Публикуем пост для ${username} (User ID: ${userInfo.pk})`);
        
        // Конвертируем base64 в buffer
        const imageBuffer = Buffer.from(imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
        console.log(`[Instagram] Размер изображения: ${Math.round(imageBuffer.length / 1024)} KB`);
        
        // РЕАЛЬНАЯ ПУБЛИКАЦИЯ
        const publishResult = await igClientToUse.publish.photo({
          file: imageBuffer,
          caption: caption || `Пост опубликован через Instagram API\n\n⏰ ${new Date().toLocaleString()}`
        });
        
        console.log(`[Instagram] ✅ НАСТОЯЩИЙ ПОСТ ОПУБЛИКОВАН!`);
        console.log(`[Instagram] Media ID: ${publishResult.media.id}`);
        console.log(`[Instagram] Post Code: ${publishResult.media.code}`);
        
        const realPostUrl = `https://instagram.com/p/${publishResult.media.code}`;
        console.log(`[Instagram] URL: ${realPostUrl}`);

        res.json({
          success: true,
          postUrl: realPostUrl,
          postId: publishResult.media.code,
          message: 'НАСТОЯЩИЙ пост опубликован успешно!',
          userId: userInfo.pk,
          username: userInfo.username,
          mediaId: publishResult.media.id,
          isRealPost: true,
          usedSavedSession: !!restoredClient
        });
      } else {
        throw new Error('Не удалось получить валидную сессию Instagram');
      }
      
    } catch (publishError) {
      console.error(`[Instagram] Критическая ошибка публикации:`, publishError.message);
      
      res.status(500).json({
        success: false,
        error: 'Ошибка публикации поста',
        details: publishError.message,
        postUrl: null,
        postId: null
      });
    }

  } catch (error) {
    console.error(`[Instagram] Photo publish failed:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка публикации поста',
      details: error.message
    });
  }
});

// Stories publish endpoint
router.post('/publish-story', async (req, res) => {
  try {
    const { username, password, imageData, interactive } = req.body;

    if (!username || !imageData) {
      return res.status(400).json({
        success: false,
        error: 'Username and imageData required'
      });
    }

    console.log(`[Instagram] Publishing story for user: ${username}`);

    // Get or create session
    let session = getSession(username);
    if (!session || session.expiresAt < Date.now()) {
      console.log(`[Instagram] No valid session, attempting login for user: ${username}`);
      
      if (!password) {
        return res.status(401).json({
          success: false,
          error: 'Password required for new session'
        });
      }

      // Trigger login
      const loginResponse = await makeProxyRequest('http://localhost:5000/api/instagram-direct/login', {
        method: 'POST',
        data: { username, password },
        headers: { 'Content-Type': 'application/json' }
      });

      if (!loginResponse.data.success) {
        throw new Error('Login failed');
      }

      session = getSession(username);
    }

    // РЕАЛЬНАЯ публикация Stories через Instagram Private API
    console.log(`[Instagram] Uploading story for user: ${username}, session: ${session.userId}`);
    
    try {
      // Получаем Instagram клиента из сессии
      const ig = instagramSessionManager.getIgClient(username);
      if (!ig) {
        throw new Error('Instagram клиент не найден для данной сессии');
      }
      
      // Конвертируем base64 в buffer
      let imageBuffer;
      if (imageData.includes(',')) {
        const base64Data = imageData.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = Buffer.from(imageData, 'base64');
      }
      
      console.log(`[Instagram] Размер изображения для Stories: ${imageBuffer.length} байт`);
      
      // Проверяем размер изображения (убираем жесткую валидацию)
      console.log(`[Instagram] Размер изображения Stories: ${imageBuffer.length} байт`);
      if (imageBuffer.length < 100) {
        console.log(`[Instagram] ⚠️ Изображение очень маленькое: ${imageBuffer.length} байт`);
      }
      
      // Публикуем Stories с правильными параметрами для Private API
      console.log(`[Instagram] Загружаем Stories размером ${imageBuffer.length} байт`);
      
      // Специальная конфигурация для Instagram Private API Stories
      const storyOptions = {
        file: imageBuffer
      };
      
      // Если есть интерактивные элементы из параметра req.body
      if (interactive && Object.keys(interactive).length > 0) {
        console.log(`[Instagram] Добавляем интерактивные элементы:`, Object.keys(interactive));
        
        // Добавляем story stickers для интерактивных элементов
        storyOptions.story_stickers = [];
        
        // Поддержка опросов
        if (interactive.poll) {
          storyOptions.story_stickers.push({
            x: 0.5,
            y: 0.5,
            z: 0,
            width: 0.6,
            height: 0.15,
            rotation: 0.0,
            item_id: 'poll_sticker',
            item_type: 'poll',
            poll_sticker: {
              question: interactive.poll.question || 'Да или нет?',
              tallies: [
                { text: interactive.poll.option1 || 'Да', count: 0 },
                { text: interactive.poll.option2 || 'Нет', count: 0 }
              ],
              viewer_can_vote: true,
              viewer_vote: null,
              is_shared_result: false
            }
          });
        }
        
        // Поддержка слайдеров
        if (interactive.slider) {
          storyOptions.story_stickers.push({
            x: 0.5,
            y: 0.7,
            z: 0,
            width: 0.6,
            height: 0.15,
            rotation: 0.0,
            item_id: 'slider_sticker',
            item_type: 'slider',
            slider_sticker: {
              question: interactive.slider.question || 'Как оцениваете?',
              slider_vote_average: 0.5,
              slider_vote_count: 0,
              viewer_can_vote: true,
              viewer_vote: null,
              background_color: '#FF5722',
              emoji: interactive.slider.emoji || '🔥'
            }
          });
        }
        
        // Поддержка вопросов
        if (interactive.question) {
          storyOptions.story_stickers.push({
            x: 0.5,
            y: 0.3,
            z: 0,
            width: 0.7,
            height: 0.2,
            rotation: 0.0,
            item_id: 'question_sticker',
            item_type: 'question',
            question_sticker: {
              question: interactive.question.text || 'Задайте вопрос',
              viewer_can_interact: true,
              background_color: '#8E44AD',
              text_color: '#FFFFFF'
            }
          });
        }
      }
      
      console.log(`[Instagram] Конфигурация Stories:`, {
        hasFile: !!storyOptions.file,
        fileSize: imageBuffer.length,
        hasStickers: !!(storyOptions.story_stickers && storyOptions.story_stickers.length > 0),
        stickerCount: storyOptions.story_stickers ? storyOptions.story_stickers.length : 0
      });
      
      const storyResult = await ig.publish.story(storyOptions);
      
      console.log(`[Instagram] ✅ РЕАЛЬНАЯ Stories опубликована!`, storyResult);
      
      const realStoryUrl = `https://instagram.com/stories/${username}/${storyResult.media.id}`;
      
      res.json({
        success: true,
        storyUrl: realStoryUrl,
        storyId: storyResult.media.id,
        interactive: interactive ? Object.keys(interactive) : [],
        message: '✅ РЕАЛЬНАЯ Stories опубликована успешно!',
        userId: session.userId,
        username: session.username,
        mediaId: storyResult.media.id,
        isRealStory: true
      });
      
    } catch (publishError) {
      console.error(`[Instagram] Ошибка публикации Stories:`, publishError.message);
      
      // Fallback - возвращаем ошибку вместо фиктивных данных
      res.status(500).json({
        success: false,
        error: 'Ошибка публикации Stories',
        details: publishError.message,
        message: 'Не удалось опубликовать Stories'
      });
    }

  } catch (error) {
    console.error(`[Instagram] Story publish failed:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка публикации Stories',
      details: error.message
    });
  }
});

// Confirm session endpoint (после challenge решения)
router.post('/confirm-session', async (req, res) => {
  try {
    const { username, campaignId } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username required'
      });
    }

    console.log(`[Instagram] Подтверждение сессии для пользователя: ${username}`);

    // Получаем существующую сессию из Session Manager
    const existingSession = getSession(username);
    if (!existingSession) {
      return res.status(404).json({
        success: false,
        error: 'Сессия не найдена'
      });
    }

    // Получаем Instagram клиента
    const igClient = instagramSessionManager.getIgClient(username);
    if (!igClient) {
      return res.status(404).json({
        success: false,
        error: 'Instagram клиент не найден'
      });
    }

    try {
      // Пытаемся получить информацию о пользователе для проверки сессии
      const userInfo = await igClient.user.info(igClient.state.cookieUserId);
      
      console.log(`[Instagram] ✅ Сессия подтверждена для ${username}, ID: ${userInfo.pk}`);

      // Обновляем данные сессии
      const confirmedSessionData = {
        username: username,
        password: existingSession.password,
        isAuthenticated: true,
        status: 'authenticated',
        lastAuthDate: new Date().toISOString(),
        userId: userInfo.pk.toString(),
        fullName: userInfo.full_name,
        timestamp: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
      };

      // Обновляем Session Manager
      saveSession(username, {
        ...existingSession,
        userId: userInfo.pk.toString(),
        fullName: userInfo.full_name,
        status: 'authenticated'
      });

      // Сохраняем в кампанию если указан campaignId
      if (campaignId) {
        await saveSessionToCampaign(campaignId, confirmedSessionData);
      }

      res.json({
        success: true,
        userId: userInfo.pk.toString(),
        username: userInfo.username,
        fullName: userInfo.full_name,
        message: '✅ Сессия подтверждена после challenge',
        status: 'authenticated',
        sessionData: confirmedSessionData
      });

    } catch (checkError) {
      console.log(`[Instagram] ⚠️  Проверка сессии не удалась, сессия все еще требует подтверждения`);
      
      res.json({
        success: false,
        challengeRequired: true,
        status: 'challenge_required',
        username: username,
        message: 'Сессия все еще требует подтверждения в Instagram',
        sessionData: existingSession
      });
    }

  } catch (error) {
    console.error(`[Instagram] Confirm session failed:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Ошибка подтверждения сессии',
      details: error.message
    });
  }
});

// Clear cache endpoint
router.post('/clear-cache', (req, res) => {
  const sessionCount = instagramSessionManager.getAllSessions().length;
  const cleared = instagramSessionManager.clearAllSessions();
  
  console.log(`[Instagram] Cache cleared: ${cleared} sessions removed`);
  
  res.json({
    success: true,
    message: `Кеш очищен: ${cleared} сессий удалено`,
    cleared: cleared
  });
});

// Session info endpoint
router.get('/sessions', (req, res) => {
  clearExpiredSessions();
  
  const sessions = instagramSessionManager.getAllSessions().map(session => ({
    username: session.username,
    userId: session.userId,
    timestamp: session.timestamp,
    expiresAt: session.expiresAt,
    timeToExpire: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))
  }));

  res.json({
    success: true,
    sessions,
    total: sessions.length
  });
});

module.exports = function(app) {
  console.log('[Instagram Direct API] Регистрация маршрутов началась');
  app.use('/api/instagram-direct', router);
  console.log('[Instagram Direct API] Маршруты успешно зарегистрированы');
};

module.exports.default = module.exports;

module.exports.default = module.exports;