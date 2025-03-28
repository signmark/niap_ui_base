/**
 * Сервис для авторизации Instagram через OAuth Facebook
 */
import axios from 'axios';
import { Request, Response } from 'express';
import { directusApi } from '../directus';

// Конфигурация приложения Facebook/Instagram
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '4071290253194999';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'f9c0b00de0167bd519ba37052858a069';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const REDIRECT_URI = `${BASE_URL}/api/auth/instagram/callback`;

/**
 * Инициирует OAuth поток авторизации для Instagram
 */
export async function initiateInstagramAuth(req: Request, res: Response) {
  const userId = req.user?.id;
  
  // Если пользователь не авторизован, возвращаем ошибку
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Требуется авторизация'
    });
  }
  
  // Формируем URL для авторизации через Facebook
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${FACEBOOK_APP_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `state=${userId}&` + // Используем userId как state для безопасности
    `scope=instagram_basic,instagram_content_publish,pages_read_engagement,pages_show_list`;
  
  // Перенаправляем пользователя на страницу авторизации Facebook
  return res.redirect(authUrl);
}

/**
 * Обрабатывает коллбек после авторизации Instagram
 */
export async function handleInstagramCallback(req: Request, res: Response) {
  try {
    const { code, state: userId } = req.query;
    
    // Проверяем наличие кода авторизации
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует код авторизации'
      });
    }
    
    // Проверяем наличие идентификатора пользователя
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует идентификатор пользователя'
      });
    }
    
    // Запрашиваем токен доступа
    const tokenResponse = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${FACEBOOK_APP_ID}&` +
      `client_secret=${FACEBOOK_APP_SECRET}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `code=${code}`
    );
    
    const { access_token: longLivedToken } = tokenResponse.data;
    
    if (!longLivedToken) {
      return res.status(400).json({
        success: false,
        error: 'Не удалось получить токен доступа'
      });
    }
    
    // Получаем страницы пользователя (бизнес-аккаунты)
    const pagesResponse = await axios.get(`https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedToken}`);
    const pages = pagesResponse.data.data || [];
    
    if (pages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдено ни одной бизнес-страницы Facebook, связанной с Instagram. Убедитесь, что ваша страница Facebook имеет связанный бизнес-аккаунт Instagram.'
      });
    }
    
    // Для каждой страницы проверяем наличие связанного Instagram аккаунта
    let instagramAccountId = null;
    let pageAccessToken = null;
    let pageName = null;
    
    for (const page of pages) {
      try {
        const instagramResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
        );
        
        if (instagramResponse.data.instagram_business_account) {
          instagramAccountId = instagramResponse.data.instagram_business_account.id;
          pageAccessToken = page.access_token;
          pageName = page.name;
          break;
        }
      } catch (error) {
        console.error(`Ошибка получения Instagram аккаунта для страницы ${page.name}:`, error);
      }
    }
    
    if (!instagramAccountId || !pageAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'Не найден бизнес-аккаунт Instagram, связанный с вашими страницами Facebook'
      });
    }
    
    // Сохраняем токены в профиль пользователя
    try {
      // Проверяем существующие API ключи пользователя
      const apiKeysResponse = await directusApi.get('/items/user_api_keys', {
        params: {
          filter: {
            user_id: { _eq: userId },
            service_name: { _eq: 'instagram' }
          }
        },
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}` 
        }
      });
      
      const existingKeys = apiKeysResponse.data?.data || [];
      
      if (existingKeys.length > 0) {
        // Обновляем существующий ключ
        await directusApi.patch(`/items/user_api_keys/${existingKeys[0].id}`, {
          api_key: pageAccessToken,
          additional_data: JSON.stringify({
            instagram_account_id: instagramAccountId,
            page_name: pageName
          })
        }, {
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}` 
          }
        });
      } else {
        // Создаем новый ключ
        await directusApi.post('/items/user_api_keys', {
          user_id: userId,
          service_name: 'instagram',
          api_key: pageAccessToken,
          additional_data: JSON.stringify({
            instagram_account_id: instagramAccountId,
            page_name: pageName
          })
        }, {
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}` 
          }
        });
      }
      
      // Успешно сохранили токены
      console.log(`Instagram токен успешно сохранен для пользователя ${userId}`);
      
      // Перенаправляем пользователя на страницу настроек с успешным сообщением
      return res.redirect('/settings?instagram_auth=success');
    } catch (error) {
      console.error('Ошибка сохранения токена Instagram:', error);
      return res.status(500).json({
        success: false,
        error: 'Не удалось сохранить токен Instagram'
      });
    }
  } catch (error) {
    console.error('Ошибка при обработке коллбека Instagram:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера при обработке авторизации Instagram'
    });
  }
}

/**
 * Проверяет и получает текущие настройки Instagram
 */
export async function getInstagramSettings(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация'
      });
    }
    
    // Получаем настройки Instagram из базы данных
    const apiKeysResponse = await directusApi.get('/items/user_api_keys', {
      params: {
        filter: {
          user_id: { _eq: userId },
          service_name: { _eq: 'instagram' }
        }
      },
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}` 
      }
    });
    
    const instagramKeys = apiKeysResponse.data?.data || [];
    
    if (instagramKeys.length === 0) {
      return res.json({
        success: true,
        data: {
          connected: false,
          message: 'Instagram не подключен'
        }
      });
    }
    
    // Разбираем дополнительные данные
    let additionalData: { page_name?: string; instagram_account_id?: string } = {};
    try {
      additionalData = JSON.parse(instagramKeys[0].additional_data || '{}') as {
        page_name?: string;
        instagram_account_id?: string;
      };
    } catch (e) {
      console.error('Ошибка парсинга дополнительных данных Instagram:', e);
    }
    
    // Проверяем валидность токена
    try {
      const checkResponse = await axios.get(
        `https://graph.facebook.com/v18.0/me?access_token=${instagramKeys[0].api_key}`
      );
      
      if (checkResponse.data && checkResponse.data.id) {
        return res.json({
          success: true,
          data: {
            connected: true,
            pageName: additionalData.page_name || 'Страница Facebook',
            instagramId: additionalData.instagram_account_id || 'Не указано',
            message: 'Instagram успешно подключен'
          }
        });
      }
    } catch (error) {
      // Токен недействителен
      return res.json({
        success: true,
        data: {
          connected: false,
          error: 'Токен Instagram недействителен, требуется повторная авторизация',
          message: 'Требуется повторная авторизация'
        }
      });
    }
    
    // По умолчанию считаем, что подключение активно
    return res.json({
      success: true,
      data: {
        connected: true,
        pageName: additionalData.page_name || 'Страница Facebook',
        instagramId: additionalData.instagram_account_id || 'Не указано',
        message: 'Instagram подключен'
      }
    });
  } catch (error) {
    console.error('Ошибка получения настроек Instagram:', error);
    return res.status(500).json({
      success: false,
      error: 'Не удалось получить настройки Instagram'
    });
  }
}