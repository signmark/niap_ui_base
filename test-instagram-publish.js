/**
 * Скрипт для тестирования публикации видео в Instagram
 * Запуск: node test-instagram-publish.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const VIDEO_URL = 'https://6e679636ae90-ridiculous-seth.s3.ru1.storage.beget.cloud/videos/502775ff-85fb-45ec-b7cd-fe2adc16dca9-mov_bbb.mp4';
const CAPTION = 'Тестовая публикация видео #test #instagram';

/**
 * Логирование с сохранением в файл
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  console.log(logMessage);
  fs.appendFileSync('instagram-test-publish.log', logMessage + '\n');
}

/**
 * Шаг 1: Получение доступа к API Directus
 */
async function getDirectusToken() {
  try {
    log('Получение токена Directus admin...');
    
    // Читаем .env файл для получения учетных данных
    const envContent = fs.readFileSync('.env', 'utf-8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    });
    
    const email = envVars.DIRECTUS_ADMIN_EMAIL;
    const password = envVars.DIRECTUS_ADMIN_PASSWORD;
    
    if (!email || !password) {
      throw new Error('Отсутствуют учетные данные администратора Directus в .env файле');
    }
    
    const response = await axios.post('https://directus.nplanner.ru/auth/login', {
      email,
      password
    });
    
    if (!response.data || !response.data.data || !response.data.data.access_token) {
      throw new Error('Не удалось получить токен доступа');
    }
    
    const token = response.data.data.access_token;
    log('Токен Directus admin успешно получен');
    
    return token;
  } catch (error) {
    log(`Ошибка при получении токена Directus: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Шаг 2: Получение настроек Instagram из кампании
 */
async function getInstagramSettings(token) {
  try {
    log('Получение настроек Instagram...');
    
    // Используем фиксированную кампанию для тестов
    const campaignId = '46868c44-c6a4-4bed-accf-9ad07bba790e';
    
    const response = await axios.get(`https://directus.nplanner.ru/items/campaigns/${campaignId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.data || !response.data.data) {
      throw new Error('Не удалось получить данные кампании');
    }
    
    const campaign = response.data.data;
    
    if (!campaign.social_media_settings || !campaign.social_media_settings.instagram) {
      throw new Error('Отсутствуют настройки Instagram в кампании');
    }
    
    const instagramSettings = campaign.social_media_settings.instagram;
    
    if (!instagramSettings.token || !instagramSettings.business_account_id) {
      throw new Error('Отсутствует токен или ID бизнес-аккаунта Instagram');
    }
    
    log(`Настройки Instagram успешно получены: business_account_id = ${instagramSettings.business_account_id}`);
    
    return {
      token: instagramSettings.token,
      businessAccountId: instagramSettings.business_account_id
    };
  } catch (error) {
    log(`Ошибка при получении настроек Instagram: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Шаг 3: Обработка видео для Instagram
 */
async function processVideo(videoUrl) {
  try {
    log(`Начинаем обработку видео: ${videoUrl}`);
    
    const response = await axios.post('http://localhost:5000/api/process-video-for-instagram', {
      videoUrl
    });
    
    if (!response.data || !response.data.processedVideoUrl) {
      throw new Error('Не удалось обработать видео для Instagram');
    }
    
    const processedVideoUrl = response.data.processedVideoUrl;
    log(`Видео успешно обработано: ${processedVideoUrl}`);
    
    return processedVideoUrl;
  } catch (error) {
    log(`Ошибка при обработке видео: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
    
    // Если API обработки недоступен, используем оригинальное видео
    log('Используем оригинальное видео без обработки');
    return videoUrl;
  }
}

/**
 * Шаг 4: Публикация видео в Instagram
 */
async function publishToInstagram(videoUrl, caption, instagramSettings) {
  try {
    log(`Начинаем публикацию видео в Instagram: ${videoUrl}`);
    
    // Шаг 4.1: Создание контейнера для видео
    log('Создаем контейнер для видео...');
    
    const createContainerUrl = `https://graph.facebook.com/v18.0/${instagramSettings.businessAccountId}/media`;
    const containerResponse = await axios.post(createContainerUrl, {
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption
    }, {
      params: {
        access_token: instagramSettings.token
      }
    });
    
    if (!containerResponse.data || !containerResponse.data.id) {
      throw new Error('Не удалось создать контейнер для видео');
    }
    
    const containerId = containerResponse.data.id;
    log(`Контейнер успешно создан: ${containerId}`);
    
    // Шаг 4.2: Ожидание готовности контейнера
    log('Ожидаем готовности контейнера...');
    
    // Начальная задержка для обработки видео на стороне Instagram
    await new Promise(resolve => setTimeout(resolve, 40000));
    
    // Проверяем статус контейнера
    let containerStatus = null;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      attempts++;
      log(`Проверка статуса контейнера (попытка ${attempts}/${maxAttempts})...`);
      
      try {
        const statusResponse = await axios.get(`https://graph.facebook.com/v18.0/${containerId}`, {
          params: {
            fields: 'status_code,status',
            access_token: instagramSettings.token
          }
        });
        
        containerStatus = statusResponse.data;
        log(`Статус контейнера: ${JSON.stringify(containerStatus)}`);
        
        if (containerStatus.status_code === 'FINISHED') {
          log('Контейнер готов к публикации');
          break;
        } else if (containerStatus.status_code === 'ERROR') {
          throw new Error(`Ошибка обработки видео на стороне Instagram: ${containerStatus.status}`);
        } else {
          log(`Видео еще не готово (статус: ${containerStatus.status_code}), ожидаем 30 секунд...`);
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      } catch (error) {
        log(`Ошибка при проверке статуса контейнера: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
    
    if (!containerStatus || containerStatus.status_code !== 'FINISHED') {
      throw new Error('Превышено время ожидания готовности контейнера');
    }
    
    // Шаг 4.3: Публикация контейнера
    log('Публикуем контейнер...');
    
    const publishUrl = `https://graph.facebook.com/v18.0/${instagramSettings.businessAccountId}/media_publish`;
    const publishResponse = await axios.post(publishUrl, {
      creation_id: containerId
    }, {
      params: {
        access_token: instagramSettings.token
      }
    });
    
    if (!publishResponse.data || !publishResponse.data.id) {
      throw new Error('Не удалось опубликовать видео');
    }
    
    const mediaId = publishResponse.data.id;
    log(`Видео успешно опубликовано: ${mediaId}`);
    
    // Шаг 4.4: Получение permalink публикации
    log('Получаем ссылку на публикацию...');
    
    const mediaResponse = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
      params: {
        fields: 'permalink',
        access_token: instagramSettings.token
      }
    });
    
    let permalink = null;
    
    if (mediaResponse.data && mediaResponse.data.permalink) {
      permalink = mediaResponse.data.permalink;
      log(`Ссылка на публикацию: ${permalink}`);
    } else {
      log('Не удалось получить ссылку на публикацию');
    }
    
    return {
      success: true,
      mediaId,
      permalink
    };
  } catch (error) {
    log(`Ошибка при публикации в Instagram: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * Основная функция
 */
async function main() {
  // Создаем файл лога или очищаем существующий
  fs.writeFileSync('instagram-test-publish.log', '');
  
  try {
    log('Запуск тестовой публикации видео в Instagram');
    
    // Шаг 1: Получение доступа к API Directus
    const token = await getDirectusToken();
    
    // Шаг 2: Получение настроек Instagram
    const instagramSettings = await getInstagramSettings(token);
    
    // Шаг 3: Обработка видео для Instagram
    const processedVideoUrl = await processVideo(VIDEO_URL);
    
    // Шаг 4: Публикация видео
    const result = await publishToInstagram(processedVideoUrl, CAPTION, instagramSettings);
    
    // Вывод результата
    if (result.success) {
      log('==== УСПЕХ ====');
      log(`Видео успешно опубликовано в Instagram!`);
      if (result.permalink) {
        log(`Ссылка на публикацию: ${result.permalink}`);
      }
    } else {
      log('==== ОШИБКА ====');
      log(`Не удалось опубликовать видео: ${result.error}`);
      if (result.details) {
        log(`Детали ошибки: ${JSON.stringify(result.details)}`);
      }
    }
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`);
  }
}

// Запуск скрипта
main().catch(error => {
  console.error('Ошибка в main():', error);
});