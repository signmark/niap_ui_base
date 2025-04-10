/**
 * Скрипт для исправления ошибки "Platform [object Object] is not supported yet"
 * в запланированных публикациях
 * 
 * Запуск: node fix-platform-errors.js
 */

const axios = require('axios');

/**
 * Функция для логирования сообщений
 * @param {string} message Сообщение для логирования
 */
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Аутентификация и получение токена
 * @returns {Promise<string|null>} Токен аутентификации или null
 */
async function authenticate() {
  try {
    const email = process.env.DIRECTUS_ADMIN_EMAIL;
    const password = process.env.DIRECTUS_ADMIN_PASSWORD;
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';

    if (!email || !password) {
      log('Не найдены учетные данные администратора в переменных окружения');
      return null;
    }

    const response = await axios.post(`${directusUrl}/auth/login`, {
      email,
      password
    });

    if (response.data && response.data.data && response.data.data.access_token) {
      log('Авторизация успешна');
      return response.data.data.access_token;
    } else {
      log('Не удалось получить токен администратора');
      return null;
    }
  } catch (error) {
    log(`Ошибка при получении токена: ${error.message}`);
    return null;
  }
}

/**
 * Получает запланированные публикации
 * @param {string} token Токен аутентификации
 * @returns {Promise<Array|null>} Массив запланированных публикаций или null
 */
async function getScheduledContent(token) {
  try {
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    // Фильтр для получения всех публикаций со статусом "scheduled"
    const filter = {
      status: { _eq: 'scheduled' }
    };

    const response = await axios.get(`${directusUrl}/items/campaign_content`, {
      params: {
        filter: JSON.stringify(filter),
        sort: 'scheduled_at'
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const scheduledContent = response.data.data;
    log(`Получено ${scheduledContent.length} запланированных публикаций`);
    return scheduledContent;
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
  const filteredContent = content.filter(item => {
    // Проверяем поле social_platforms
    const socialPlatforms = item.social_platforms || {};
    
    // Преобразуем в объект, если строка
    let platforms = socialPlatforms;
    if (typeof socialPlatforms === 'string') {
      try {
        platforms = JSON.parse(socialPlatforms);
      } catch (e) {
        log(`Ошибка при разборе JSON для ${item.id}: ${e.message}`);
        return false;
      }
    }
    
    // Проверяем наличие ошибки "Platform [object Object] is not supported yet"
    let hasObjectError = false;
    Object.values(platforms).forEach(platform => {
      if (platform && platform.error && platform.error.includes('[object Object]')) {
        hasObjectError = true;
      }
    });
    
    return hasObjectError;
  });
  
  log(`Найдено ${filteredContent.length} публикаций с ошибкой "[object Object]"`);
  return filteredContent;
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
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    // Исправляем ошибки платформ
    const fixedPlatforms = { ...socialPlatforms };
    
    // Проверяем и исправляем каждую платформу
    for (const [platform, settings] of Object.entries(fixedPlatforms)) {
      if (settings && settings.error && settings.error.includes('[object Object]')) {
        // Сбрасываем ошибку и устанавливаем статус pending
        fixedPlatforms[platform] = {
          ...settings,
          status: 'pending',
          error: null
        };
        log(`Исправлена ошибка для платформы ${platform} в контенте ${contentId}`);
      }
    }
    
    // Обновляем контент в Directus
    await axios.patch(`${directusUrl}/items/campaign_content/${contentId}`, {
      social_platforms: fixedPlatforms
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    log(`Успешно обновлены социальные платформы для контента ${contentId}`);
    return true;
  } catch (error) {
    log(`Ошибка при обновлении социальных платформ для ${contentId}: ${error.message}`);
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  log('Запуск скрипта для исправления ошибок "[object Object]" в запланированных публикациях');
  
  // Аутентификация
  const token = await authenticate();
  if (!token) {
    log('Не удалось пройти аутентификацию. Проверьте учетные данные и доступность API.');
    return;
  }
  
  // Получаем запланированные публикации
  const scheduledContent = await getScheduledContent(token);
  if (!scheduledContent || scheduledContent.length === 0) {
    log('Запланированных публикаций не найдено.');
    return;
  }
  
  // Фильтруем контент с ошибками [object Object]
  const contentWithErrors = filterContentWithObjectErrors(scheduledContent);
  if (contentWithErrors.length === 0) {
    log('Публикаций с ошибкой "[object Object]" не найдено.');
    return;
  }
  
  // Исправляем ошибки в каждой публикации
  let successCount = 0;
  for (const content of contentWithErrors) {
    log(`Исправление ошибок в контенте ${content.id}`);
    
    // Преобразуем social_platforms в объект, если строка
    let socialPlatforms = content.social_platforms;
    if (typeof socialPlatforms === 'string') {
      try {
        socialPlatforms = JSON.parse(socialPlatforms);
      } catch (e) {
        log(`Ошибка при разборе JSON для ${content.id}: ${e.message}`);
        continue;
      }
    }
    
    // Обновляем социальные платформы
    const success = await updateSocialPlatforms(content.id, socialPlatforms, token);
    if (success) {
      successCount++;
    }
  }
  
  log(`Завершено. Исправлено ошибок: ${successCount}/${contentWithErrors.length}`);
}

// Выполняем основную функцию
main().catch(error => {
  log(`Критическая ошибка: ${error.message}`);
});