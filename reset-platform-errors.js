/**
 * Скрипт для сброса ошибок с текстом "Platform [object Object] is not supported yet"
 * в запланированных публикациях
 * 
 * Запуск: node reset-platform-errors.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем конфигурацию из файла .env
dotenv.config();

// Определяем функцию для логирования
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Аутентификация и получение токена
 * @returns {Promise<string|null>} Токен аутентификации или null
 */
async function authenticate() {
  try {
    // Используем логин/пароль
    const authUrl = `${process.env.DIRECTUS_URL || 'https://directus.nplanner.ru'}/auth/login`;
    const response = await axios.post(authUrl, {
      email: process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com',
      password: process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7'
    });

    if (response.data && response.data.data && response.data.data.access_token) {
      log(`Успешно получен токен доступа через аутентификацию`);
      return response.data.data.access_token;
    } else {
      log('Неверный формат ответа при аутентификации');
      return null;
    }
  } catch (error) {
    log(`Ошибка аутентификации: ${error.message}`);
    return null;
  }
}

/**
 * Получает все запланированные публикации
 * @param {string} token Токен аутентификации
 * @returns {Promise<Array|null>} Массив запланированных публикаций или null
 */
async function getScheduledContent(token) {
  try {
    // Запрашиваем запланированные публикации
    const url = `${process.env.DIRECTUS_URL || 'https://directus.nplanner.ru'}/items/campaign_content`;
    const params = {
      filter: {
        status: {
          _eq: 'scheduled'
        }
      }
    };

    const response = await axios.get(url, {
      params,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data && response.data.data) {
      log(`Получено ${response.data.data.length} запланированных публикаций`);
      return response.data.data;
    } else {
      log('Неверный формат ответа при получении запланированных публикаций');
      return null;
    }
  } catch (error) {
    log(`Ошибка при получении запланированных публикаций: ${error.message}`);
    return null;
  }
}

/**
 * Фильтрует контент, содержащий ошибку "Platform [object Object] is not supported yet"
 * @param {Array} content Массив контента
 * @returns {Array} Отфильтрованный массив контента
 */
function filterContentWithObjectErrors(content) {
  return content.filter(item => {
    if (!item.social_platforms) return false;
    
    // Преобразуем из строки в объект, если необходимо
    let socialPlatforms = item.social_platforms;
    if (typeof socialPlatforms === 'string') {
      try {
        socialPlatforms = JSON.parse(socialPlatforms);
      } catch (e) {
        return false;
      }
    }
    
    // Проверяем каждую платформу на наличие ошибки
    for (const platform in socialPlatforms) {
      const settings = socialPlatforms[platform];
      if (settings && settings.error && 
          (settings.error.includes('[object Object]') || 
           settings.error.includes('is not supported yet'))) {
        return true;
      }
    }
    
    return false;
  });
}

/**
 * Обновляет статус платформы для содержимого
 * @param {string} contentId ID содержимого
 * @param {object} socialPlatforms Объект социальных платформ
 * @param {string} token Токен аутентификации
 * @returns {Promise<boolean>} Результат обновления
 */
async function updateSocialPlatforms(contentId, socialPlatforms, token) {
  try {
    const url = `${process.env.DIRECTUS_URL || 'https://directus.nplanner.ru'}/items/campaign_content/${contentId}`;
    
    // Создаем обновленную версию без ошибок
    const updatedPlatforms = {};
    
    for (const platform in socialPlatforms) {
      const settings = socialPlatforms[platform];
      updatedPlatforms[platform] = {
        ...settings,
        status: 'pending',  // Меняем на pending для повторной попытки
        error: null         // Очищаем ошибку
      };
    }
    
    const response = await axios.patch(url, {
      social_platforms: updatedPlatforms
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 200) {
      log(`Успешно обновлены платформы для ${contentId}`);
      return true;
    } else {
      log(`Неудачное обновление платформ для ${contentId}: ${response.status}`);
      return false;
    }
  } catch (error) {
    log(`Ошибка при обновлении платформ для ${contentId}: ${error.message}`);
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Аутентификация
    const token = await authenticate();
    if (!token) {
      log('Не удалось получить токен аутентификации');
      return;
    }
    
    // Получаем запланированные публикации
    const scheduledContent = await getScheduledContent(token);
    if (!scheduledContent) {
      log('Не удалось получить запланированные публикации');
      return;
    }
    
    // Фильтруем контент с ошибками объектов
    const contentWithErrors = filterContentWithObjectErrors(scheduledContent);
    log(`Найдено ${contentWithErrors.length} публикаций с ошибками объектов`);
    
    // Обновляем платформы для каждого элемента
    let successCount = 0;
    for (const content of contentWithErrors) {
      log(`Обработка публикации ${content.id}`);
      
      // Преобразуем из строки в объект, если необходимо
      let socialPlatforms = content.social_platforms;
      if (typeof socialPlatforms === 'string') {
        try {
          socialPlatforms = JSON.parse(socialPlatforms);
        } catch (e) {
          log(`Ошибка парсинга social_platforms для ${content.id}: ${e.message}`);
          continue;
        }
      }
      
      // Обновляем платформы
      const success = await updateSocialPlatforms(content.id, socialPlatforms, token);
      if (success) {
        successCount++;
      }
    }
    
    log(`Успешно обновлено ${successCount} из ${contentWithErrors.length} публикаций`);
  } catch (error) {
    log(`Глобальная ошибка: ${error.message}`);
  }
}

// Запускаем основную функцию
main();