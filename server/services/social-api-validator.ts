/**
 * Сервис для проверки API ключей социальных сетей
 * Валидирует ключи и учетные данные, предоставляя информацию о их статусе
 */

import axios from 'axios';

// Интерфейс для результата проверки API ключа
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
  if (!token) {
    return { isValid: false, message: "Токен не предоставлен" };
  }

  try {
    // Telegram Bot API - получение информации о боте
    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    
    if (response.data && response.data.ok) {
      const botInfo = response.data.result;
      return { 
        isValid: true, 
        message: `Бот подключен: ${botInfo.first_name} (@${botInfo.username})`,
        details: botInfo
      };
    } else {
      return { 
        isValid: false, 
        message: "Не удалось получить информацию о боте",
        details: response.data 
      };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.description || error.message || "Неизвестная ошибка";
    return { 
      isValid: false, 
      message: `Ошибка при проверке токена: ${errorMessage}`,
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
  if (!token) {
    return { isValid: false, message: "Токен не предоставлен" };
  }

  try {
    // VK API - получение информации о пользователе или группе
    let apiUrl = `https://api.vk.com/method/users.get?v=5.131&access_token=${token}`;
    
    // Если предоставлен ID группы, проверяем доступ к группе
    if (groupId) {
      apiUrl = `https://api.vk.com/method/groups.getById?group_id=${groupId}&v=5.131&access_token=${token}`;
    }
    
    const response = await axios.get(apiUrl);
    
    if (response.data && response.data.response) {
      if (groupId && response.data.response.length > 0) {
        const groupInfo = response.data.response[0];
        return { 
          isValid: true, 
          message: `Группа подключена: ${groupInfo.name}`,
          details: groupInfo
        };
      } else if (!groupId && response.data.response.length > 0) {
        const userInfo = response.data.response[0];
        return { 
          isValid: true, 
          message: `Пользователь подключен: ${userInfo.first_name} ${userInfo.last_name}`,
          details: userInfo
        };
      } else {
        return { 
          isValid: false, 
          message: "Не удалось получить информацию о пользователе или группе",
          details: response.data
        };
      }
    } else {
      return { 
        isValid: false, 
        message: "Неверный ответ от VK API",
        details: response.data
      };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.error_msg || error.message || "Неизвестная ошибка";
    return { 
      isValid: false, 
      message: `Ошибка при проверке токена: ${errorMessage}`,
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
  if (!token) {
    return { isValid: false, message: "Токен не предоставлен" };
  }

  try {
    // Facebook Graph API - проверка токена
    const response = await axios.get(`https://graph.facebook.com/v16.0/me?access_token=${token}`);
    
    if (response.data && response.data.id) {
      return { 
        isValid: true, 
        message: `Аккаунт подключен: ${response.data.name || response.data.id}`,
        details: response.data
      };
    } else {
      return { 
        isValid: false, 
        message: "Неверный ответ от Instagram API",
        details: response.data
      };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message || "Неизвестная ошибка";
    return { 
      isValid: false, 
      message: `Ошибка при проверке токена: ${errorMessage}`,
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
  if (!token) {
    return { isValid: false, message: "Токен не предоставлен" };
  }

  try {
    // Facebook Graph API - базовая проверка токена
    let apiUrl = `https://graph.facebook.com/v16.0/me?access_token=${token}`;
    
    // Если предоставлен ID страницы, проверяем доступ к странице
    if (pageId) {
      apiUrl = `https://graph.facebook.com/v16.0/${pageId}?fields=name,id,access_token&access_token=${token}`;
    }
    
    const response = await axios.get(apiUrl);
    
    if (response.data && response.data.id) {
      if (pageId && response.data.id === pageId) {
        return { 
          isValid: true, 
          message: `Страница подключена: ${response.data.name}`,
          details: response.data
        };
      } else if (!pageId) {
        return { 
          isValid: true, 
          message: `Аккаунт подключен: ${response.data.name || response.data.id}`,
          details: response.data
        };
      } else {
        return { 
          isValid: false, 
          message: "ID страницы не соответствует полученному ответу",
          details: response.data
        };
      }
    } else {
      return { 
        isValid: false, 
        message: "Неверный ответ от Facebook API",
        details: response.data
      };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message || "Неизвестная ошибка";
    return { 
      isValid: false, 
      message: `Ошибка при проверке токена: ${errorMessage}`,
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
  if (!apiKey) {
    return { isValid: false, message: "API ключ не предоставлен" };
  }

  try {
    // YouTube Data API - поиск простого запроса для проверки ключа
    let apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${apiKey}`;
    
    // Если предоставлен ID канала, проверяем информацию о канале
    if (channelId) {
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`;
    }
    
    const response = await axios.get(apiUrl);
    
    if (response.data) {
      if (channelId && response.data.items && response.data.items.length > 0) {
        const channelInfo = response.data.items[0].snippet;
        return { 
          isValid: true, 
          message: `Канал подключен: ${channelInfo.title}`,
          details: channelInfo
        };
      } else {
        return { 
          isValid: true, 
          message: "API ключ действителен",
          details: { 
            itemsReturned: response.data.items ? response.data.items.length : 0,
            pageInfo: response.data.pageInfo
          }
        };
      }
    } else {
      return { 
        isValid: false, 
        message: "Неверный ответ от YouTube API",
        details: response.data
      };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message || "Неизвестная ошибка";
    return { 
      isValid: false, 
      message: `Ошибка при проверке API ключа: ${errorMessage}`,
      details: error.response?.data
    };
  }
}