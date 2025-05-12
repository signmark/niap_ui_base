/**
 * Улучшенный скрипт для тестирования получения ID публикации Instagram Stories
 * 
 * Этот скрипт публикует тестовую историю в Instagram и получает её
 * расширенную информацию, включая дополнительное поле instagramStoryId
 * 
 * Запуск: node test-instagram-story-id-improved.js [imageUrl]
 */

const axios = require('axios');
const FormData = require('form-data');
const dotenv = require('dotenv');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Загружаем переменные окружения
dotenv.config();

// Константы для логирования
const LOG_LEVELS = {
  INFO: 'info',
  ERROR: 'error',
  SUCCESS: 'success',
  DEBUG: 'debug',
  WARNING: 'warning'
};

// Имя лог-файла
const LOG_FILE = `instagram_story_id_test_${new Date().toISOString().replace(/[:.]/g, '')}.log`;

// Функция для логирования сообщений
function log(message, type = LOG_LEVELS.INFO) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  
  // Выводим сообщение в консоль
  console.log(logMessage);
  
  // Записываем в лог-файл
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
  
  return message;
}

/**
 * Публикует историю в Instagram и возвращает подробную информацию об ID и URL
 * @param {string} imageUrl URL изображения для публикации в качестве истории
 * @param {string} caption Подпись для истории (опционально)
 * @returns {Promise<Object>} Результат публикации с подробной информацией
 */
async function publishInstagramStory(imageUrl, caption = 'Тестовая публикация истории с улучшенным ID') {
  try {
    log('Начинаем публикацию Instagram Stories...', LOG_LEVELS.INFO);
    
    // Получаем токен и ID бизнес-аккаунта из переменных окружения
    const token = process.env.INSTAGRAM_TOKEN;
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    
    if (!token || !businessAccountId) {
      throw new Error('Отсутствуют учетные данные Instagram API. Проверьте переменные окружения INSTAGRAM_TOKEN и INSTAGRAM_BUSINESS_ACCOUNT_ID');
    }
    
    // Шаг 1: Создаем контейнер для медиа
    log(`Создание контейнера для медиа: ${imageUrl}`, LOG_LEVELS.DEBUG);
    
    const containerFormData = new FormData();
    containerFormData.append('image_url', imageUrl);
    containerFormData.append('media_type', 'STORIES');
    
    if (caption) {
      containerFormData.append('caption', caption);
    }
    
    const containerResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${businessAccountId}/media`,
      containerFormData,
      {
        params: {
          access_token: token
        },
        headers: {
          ...containerFormData.getHeaders()
        }
      }
    );
    
    const mediaContainerId = containerResponse.data.id;
    log(`Контейнер для медиа создан с ID: ${mediaContainerId}`, LOG_LEVELS.SUCCESS);
    
    // Шаг 2: Публикуем историю
    log('Публикация истории...', LOG_LEVELS.DEBUG);
    
    const publishFormData = new FormData();
    publishFormData.append('creation_id', mediaContainerId);
    
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${businessAccountId}/media_publish`,
      publishFormData,
      {
        params: {
          access_token: token
        },
        headers: {
          ...publishFormData.getHeaders()
        }
      }
    );
    
    const storyId = publishResponse.data.id;
    log(`История успешно опубликована с ID: ${storyId}`, LOG_LEVELS.SUCCESS);
    
    // Шаг 3: Получаем дополнительную информацию о публикации
    // Выполняем запрос к API Instagram для получения подробной информации о медиа
    log('Получение дополнительной информации о публикации...', LOG_LEVELS.DEBUG);
    
    const mediaInfoResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${storyId}`,
      {
        params: {
          fields: 'id,media_type,media_url,timestamp,username',
          access_token: token
        }
      }
    );
    
    // Форматируем результат
    const igUsername = process.env.INSTAGRAM_USERNAME || process.env.IG_USERNAME || 'it.zhdanov';
    const storyUrl = `https://www.instagram.com/stories/${igUsername}/`;
    const now = new Date();
    
    // Добавляем дополнительное поле instagramStoryId
    const result = {
      success: true,
      storyId,
      storyUrl,
      mediaContainerId,
      creationTime: now.toISOString(),
      igUsername,
      instagramStoryId: storyId, // Новое поле для хранения ID истории
      // Дополнительная информация из запроса к API
      mediaInfo: mediaInfoResponse.data,
      // Метаданные для тестирования
      testId: uuidv4(),
      timestamp: now.getTime()
    };
    
    log(`Полные данные о публикации: ${JSON.stringify(result, null, 2)}`, LOG_LEVELS.SUCCESS);
    
    return result;
  } catch (error) {
    const errorMessage = error.response?.data || error.message || 'Неизвестная ошибка';
    log(`Ошибка при публикации истории: ${JSON.stringify(errorMessage)}`, LOG_LEVELS.ERROR);
    throw error;
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    // Определяем URL изображения (используем аргумент командной строки или значение по умолчанию)
    const imageUrl = process.argv[2] || 'https://picsum.photos/1080/1920';
    
    log(`Запуск теста публикации Instagram Stories с улучшенным ID`, LOG_LEVELS.INFO);
    log(`Используемое изображение: ${imageUrl}`, LOG_LEVELS.INFO);
    
    // Публикуем историю и получаем результат
    const result = await publishInstagramStory(imageUrl);
    
    // Выводим результат
    log('=====================================', LOG_LEVELS.INFO);
    log('Результат публикации истории в Instagram:', LOG_LEVELS.SUCCESS);
    log(`ID истории (обычный): ${result.storyId}`, LOG_LEVELS.SUCCESS);
    log(`ID истории (улучшенный): ${result.instagramStoryId}`, LOG_LEVELS.SUCCESS);
    log(`URL истории: ${result.storyUrl}`, LOG_LEVELS.SUCCESS);
    log(`Имя пользователя Instagram: ${result.igUsername}`, LOG_LEVELS.INFO);
    log(`Время создания: ${result.creationTime}`, LOG_LEVELS.INFO);
    log('=====================================', LOG_LEVELS.INFO);
    
    return result;
  } catch (error) {
    log('=====================================', LOG_LEVELS.ERROR);
    log('Ошибка при выполнении теста публикации:', LOG_LEVELS.ERROR);
    log(error.message || JSON.stringify(error), LOG_LEVELS.ERROR);
    log('=====================================', LOG_LEVELS.ERROR);
    process.exit(1);
  }
}

// Запускаем основную функцию скрипта
main();