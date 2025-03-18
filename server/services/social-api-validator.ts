/**
 * Сервис для проверки API ключей социальных сетей
 * Валидирует ключи и учетные данные, предоставляя информацию о их статусе
 */

import axios from 'axios';
import { log } from '../utils/logger';

/**
 * Результат проверки API ключа
 */
export interface ApiKeyValidationResult {
  isValid: boolean;
  message: string;
  details?: any;
}

/**
 * Проверяет токен Telegram бота
 * @param token API токен Telegram бота
 * @returns Результат проверки
 */
export async function validateTelegramToken(token: string): Promise<ApiKeyValidationResult> {
  try {
    log(`Проверка токена Telegram: ${token.slice(0, 5)}...`, 'api-validator');
    
    // Запрос к Telegram API для получения информации о боте
    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`, {
      timeout: 10000
    });
    
    if (response.data && response.data.ok) {
      const botInfo = response.data.result;
      return {
        isValid: true,
        message: `Бот успешно авторизован: ${botInfo.first_name} (@${botInfo.username})`,
        details: botInfo
      };
    } else {
      return {
        isValid: false,
        message: 'Некорректный формат ответа от Telegram API',
        details: response.data
      };
    }
  } catch (error: any) {
    log(`Ошибка при проверке токена Telegram: ${error.message}`, 'api-validator');
    
    let message = 'Ошибка при проверке токена';
    if (axios.isAxiosError(error)) {
      message = error.response?.data?.description || 
                error.response?.data?.error || 
                error.message;
    }
    
    return {
      isValid: false,
      message: message,
      details: error.response?.data
    };
  }
}

/**
 * Проверяет токен доступа VK
 * @param token Токен доступа VK API
 * @param groupId ID группы (опционально)
 * @returns Результат проверки
 */
export async function validateVkToken(token: string, groupId?: string): Promise<ApiKeyValidationResult> {
  try {
    log(`Проверка токена VK: ${token.slice(0, 5)}...${groupId ? ` для группы ${groupId}` : ''}`, 'api-validator');
    
    // Запрос к VK API для получения информации о пользователе
    const response = await axios.get('https://api.vk.com/method/users.get', {
      params: {
        access_token: token,
        v: '5.131'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.response && Array.isArray(response.data.response)) {
      const userInfo = response.data.response[0];
      
      // Если указан ID группы, проверяем права на публикацию
      if (groupId) {
        try {
          const groupResponse = await axios.get('https://api.vk.com/method/groups.getById', {
            params: {
              group_id: groupId,
              access_token: token,
              v: '5.131'
            }
          });
          
          if (groupResponse.data && groupResponse.data.response && Array.isArray(groupResponse.data.response)) {
            const groupInfo = groupResponse.data.response[0];
            return {
              isValid: true,
              message: `Токен валиден. Пользователь: ${userInfo.first_name} ${userInfo.last_name}, Группа: ${groupInfo.name}`,
              details: {
                user: userInfo,
                group: groupInfo
              }
            };
          }
        } catch (groupError: any) {
          return {
            isValid: false,
            message: `Токен валиден, но ошибка при проверке группы: ${groupError.message}`,
            details: {
              user: userInfo,
              groupError: groupError.response?.data
            }
          };
        }
      }
      
      return {
        isValid: true,
        message: `Токен валиден. Пользователь: ${userInfo.first_name} ${userInfo.last_name}`,
        details: userInfo
      };
    } else {
      return {
        isValid: false,
        message: 'Некорректный формат ответа от VK API',
        details: response.data
      };
    }
  } catch (error: any) {
    log(`Ошибка при проверке токена VK: ${error.message}`, 'api-validator');
    
    let message = 'Ошибка при проверке токена';
    if (axios.isAxiosError(error)) {
      message = error.response?.data?.error_description || 
                error.response?.data?.error?.error_msg || 
                error.message;
    }
    
    return {
      isValid: false,
      message: message,
      details: error.response?.data
    };
  }
}

/**
 * Проверяет токен доступа Instagram (Facebook Graph API)
 * @param token Токен доступа Instagram API
 * @returns Результат проверки
 */
export async function validateInstagramToken(token: string): Promise<ApiKeyValidationResult> {
  try {
    log(`Проверка токена Instagram: ${token.slice(0, 5)}...`, 'api-validator');
    
    // Запрос к Facebook Graph API для получения информации о токене
    const response = await axios.get('https://graph.facebook.com/v16.0/me', {
      params: {
        access_token: token,
        fields: 'id,name,instagram_business_account'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.id) {
      // Проверяем наличие привязанного бизнес-аккаунта Instagram
      const hasInstagramAccount = response.data.instagram_business_account && response.data.instagram_business_account.id;
      
      if (hasInstagramAccount) {
        return {
          isValid: true,
          message: `Токен Facebook валиден, Instagram бизнес-аккаунт подключен: ID ${response.data.instagram_business_account.id}`,
          details: response.data
        };
      } else {
        return {
          isValid: false,
          message: 'Токен Facebook валиден, но Instagram бизнес-аккаунт не подключен',
          details: response.data
        };
      }
    } else {
      return {
        isValid: false,
        message: 'Некорректный формат ответа от Facebook Graph API',
        details: response.data
      };
    }
  } catch (error: any) {
    log(`Ошибка при проверке токена Instagram: ${error.message}`, 'api-validator');
    
    let message = 'Ошибка при проверке токена';
    if (axios.isAxiosError(error)) {
      message = error.response?.data?.error?.message || 
                error.response?.data?.error_description || 
                error.message;
    }
    
    return {
      isValid: false,
      message: message,
      details: error.response?.data
    };
  }
}

/**
 * Проверяет токен доступа Facebook
 * @param token Токен доступа Facebook API
 * @param pageId ID страницы Facebook (опционально)
 * @returns Результат проверки
 */
export async function validateFacebookToken(token: string, pageId?: string): Promise<ApiKeyValidationResult> {
  try {
    log(`Проверка токена Facebook: ${token.slice(0, 5)}...${pageId ? ` для страницы ${pageId}` : ''}`, 'api-validator');
    
    // Запрос к Facebook Graph API для получения информации о токене
    const response = await axios.get('https://graph.facebook.com/v16.0/me', {
      params: {
        access_token: token,
        fields: 'id,name,accounts'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.id) {
      // Если указан ID страницы, проверяем доступ к ней
      if (pageId && response.data.accounts && response.data.accounts.data) {
        const page = response.data.accounts.data.find((p: any) => p.id === pageId);
        
        if (page) {
          return {
            isValid: true,
            message: `Токен валиден. Пользователь: ${response.data.name}, Страница: ${page.name}`,
            details: {
              user: response.data,
              page: page
            }
          };
        } else {
          return {
            isValid: false,
            message: `Токен валиден, но страница с ID ${pageId} не найдена`,
            details: response.data
          };
        }
      }
      
      return {
        isValid: true,
        message: `Токен валиден. Пользователь: ${response.data.name}`,
        details: response.data
      };
    } else {
      return {
        isValid: false,
        message: 'Некорректный формат ответа от Facebook Graph API',
        details: response.data
      };
    }
  } catch (error: any) {
    log(`Ошибка при проверке токена Facebook: ${error.message}`, 'api-validator');
    
    let message = 'Ошибка при проверке токена';
    if (axios.isAxiosError(error)) {
      message = error.response?.data?.error?.message || 
                error.response?.data?.error_description || 
                error.message;
    }
    
    return {
      isValid: false,
      message: message,
      details: error.response?.data
    };
  }
}

/**
 * Проверяет API ключ YouTube (Google API)
 * @param apiKey API ключ Google
 * @param channelId ID канала YouTube (опционально)
 * @returns Результат проверки
 */
export async function validateYoutubeApiKey(apiKey: string, channelId?: string): Promise<ApiKeyValidationResult> {
  try {
    log(`Проверка API ключа YouTube: ${apiKey.slice(0, 5)}...${channelId ? ` для канала ${channelId}` : ''}`, 'api-validator');
    
    // Запрос к YouTube API для получения информации о каналах
    let url = 'https://www.googleapis.com/youtube/v3/channels';
    let params: any = {
      key: apiKey,
      part: 'snippet,contentDetails,statistics'
    };
    
    // Если указан ID канала, проверяем именно его
    if (channelId) {
      params.id = channelId;
    } else {
      // Иначе просто проверяем валидность API ключа, запрашивая самые популярные каналы
      params.chart = 'mostPopular';
      params.maxResults = 1;
    }
    
    const response = await axios.get(url, {
      params: params,
      timeout: 10000
    });
    
    if (response.data && response.data.items) {
      if (channelId && response.data.items.length === 0) {
        return {
          isValid: false,
          message: `API ключ валиден, но канал с ID ${channelId} не найден`,
          details: response.data
        };
      }
      
      return {
        isValid: true,
        message: channelId 
          ? `API ключ валиден. Канал: ${response.data.items[0]?.snippet?.title || 'Не указано'}`
          : 'API ключ YouTube валиден',
        details: response.data
      };
    } else {
      return {
        isValid: false,
        message: 'Некорректный формат ответа от YouTube API',
        details: response.data
      };
    }
  } catch (error: any) {
    log(`Ошибка при проверке API ключа YouTube: ${error.message}`, 'api-validator');
    
    let message = 'Ошибка при проверке API ключа';
    if (axios.isAxiosError(error)) {
      message = error.response?.data?.error?.message || 
                error.response?.data?.error?.errors?.[0]?.reason || 
                error.message;
    }
    
    return {
      isValid: false,
      message: message,
      details: error.response?.data
    };
  }
}