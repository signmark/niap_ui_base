/**
 * Тест публикации видео в Instagram через Graph API
 * 
 * Этот скрипт тестирует процесс публикации видео в Instagram, включая:
 * 1. Создание контейнера для медиа
 * 2. Ожидание обработки видео с проверкой статуса
 * 3. Публикацию обработанного контейнера
 * 
 * Запуск: node instagram-video-test.js
 */
import axios from 'axios';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения из .env.instagram файла
dotenv.config({ path: '.env.instagram' });

// Функция для логирования с меткой времени
function log(message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`${timestamp} [Instagram Test] ${message}`);
}

// Пауза выполнения на указанное количество миллисекунд
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Проверяет статус обработки видео и публикует его, когда оно готово
 * @param {string} containerId ID контейнера медиа
 * @param {string} token Токен доступа Instagram API
 * @param {string} businessAccountId ID бизнес-аккаунта
 * @returns {Object} Результат публикации
 */
async function checkAndPublishVideo(containerId, token, businessAccountId) {
  // Базовый URL для проверки статуса и публикации
  const baseUrl = `https://graph.facebook.com/v18.0`;
  // URL для получения статуса обработки видео
  const statusUrl = `${baseUrl}/${containerId}?fields=status_code,status&access_token=${token}`;
  // URL для публикации контейнера
  const publishUrl = `${baseUrl}/${businessAccountId}/media_publish?access_token=${token}`;
  
  // Максимальное количество попыток проверки статуса
  const maxRetries = 12;
  // Начальная задержка между проверками статуса (в мс)
  let delay = 10000; // 10 секунд
  
  log(`Начинаем проверку статуса обработки видео для контейнера ${containerId}`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Ждем перед проверкой статуса
      log(`Ожидание ${delay/1000} секунд перед проверкой...`);
      await sleep(delay);
      
      log(`Попытка ${i+1}/${maxRetries}: проверка статуса видео ${containerId}`);
      
      // Проверяем статус обработки видео
      const statusResponse = await axios.get(statusUrl, {
        timeout: 30000
      });
      
      // Логируем ответ для отладки
      log(`Статус видео: ${JSON.stringify(statusResponse.data)}`);
      
      // Проверяем, завершена ли обработка видео
      if (statusResponse.data && statusResponse.data.status_code === 'FINISHED') {
        log(`Видео успешно обработано, публикуем`);
        
        // Публикуем обработанное видео
        const publishResponse = await axios.post(publishUrl, {
          creation_id: containerId
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });
        
        log(`Ответ публикации: ${JSON.stringify(publishResponse.data)}`);
        
        // Проверяем успешность публикации
        if (publishResponse.data && publishResponse.data.id) {
          // Получаем ID публикации
          const postId = publishResponse.data.id;
          // Получаем permalink на основе ID
          const permalink = await getInstagramPermalink(postId, token);
          
          return {
            success: true,
            postId: postId,
            permalink: permalink
          };
        } else {
          return {
            success: false,
            error: 'Ошибка публикации видео после обработки: отсутствует ID публикации'
          };
        }
      } else if (statusResponse.data && statusResponse.data.status_code === 'ERROR') {
        // Если статус ERROR, прекращаем попытки
        return {
          success: false,
          error: `Ошибка обработки видео: ${statusResponse.data.status || 'неизвестная ошибка'}`
        };
      } else if (statusResponse.data && statusResponse.data.status_code === 'IN_PROGRESS') {
        // Если видео все еще обрабатывается, увеличиваем задержку для следующей попытки
        delay = Math.min(delay * 1.5, 60000); // Максимум 60 секунд между проверками
        log(`Видео все еще обрабатывается, следующая проверка через ${delay/1000} секунд`);
      } else {
        // Неизвестный статус
        log(`Неизвестный статус обработки видео: ${statusResponse.data?.status_code || 'статус не получен'}`);
      }
    } catch (error) {
      log(`Ошибка при проверке статуса видео: ${error.message}`);
      // Если ошибка в API, продолжаем попытки
      if (error.response) {
        log(`Ответ API при ошибке: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
  
  // Если после всех попыток видео не опубликовано
  return {
    success: false,
    error: 'Превышено максимальное количество попыток проверки статуса видео'
  };
}

/**
 * Получает permalink публикации из API Instagram
 * @param {string} postId ID публикации
 * @param {string} token Токен доступа
 * @returns {string|null} URL публикации или null в случае ошибки
 */
async function getInstagramPermalink(postId, token) {
  try {
    const url = `https://graph.facebook.com/v18.0/${postId}?fields=permalink&access_token=${token}`;
    
    log(`Запрос permalink для публикации ${postId}`);
    
    const response = await axios.get(url, {
      timeout: 30000
    });
    
    if (response.data && response.data.permalink) {
      log(`Получен permalink: ${response.data.permalink}`);
      return response.data.permalink;
    } else {
      log(`Ответ API не содержит permalink: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    log(`Ошибка при получении permalink: ${error.message}`);
    return null;
  }
}

/**
 * Публикует видео в Instagram
 * @returns {Promise<Object>} Результат публикации
 */
async function publishVideoToInstagram() {
  try {
    // Извлекаем параметры из переменных окружения
    const token = process.env.INSTAGRAM_TOKEN;
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    
    // Проверяем наличие необходимых параметров
    if (!token || !businessAccountId) {
      log('Ошибка: Отсутствуют токен или ID бизнес-аккаунта. Проверьте переменные окружения.');
      return {
        success: false,
        error: 'Отсутствуют настройки Instagram API (токен или ID бизнес-аккаунта)'
      };
    }
    
    log(`Начинаем публикацию в Instagram с использованием бизнес-аккаунта: ${businessAccountId}`);
    
    // URL видео для публикации (передается как аргумент или используется тестовое)
    const videoUrl = process.argv[2] || 'https://6e679636ae90-ridiculous-seth.s3.ru1.storage.beget.cloud/videos/converted_079fea9f-8d1e-4498-8708-827c657c9c4f.mp4';
    
    // Подготавливаем текст для отправки
    const caption = 'Тестовая публикация видео из системы SMM Manager. #test #video #reels';
    
    log(`Этап 1 - создание контейнера для видео`);
    
    // Создаем URL для Instagram Graph API
    const baseUrl = 'https://graph.facebook.com/v18.0';
    
    // Формируем URL запроса для создания контейнера
    const containerUrl = `${baseUrl}/${businessAccountId}/media`;
    
    // Подготавливаем параметры запроса
    const containerParams = {
      video_url: videoUrl,
      media_type: 'REELS',
      caption: caption,
      access_token: token,
      thumb_offset: 0,
      share_to_feed: true
    };
    
    log(`Отправка запроса на создание контейнера для видео: ${videoUrl}`);
    
    // Отправляем запрос на создание контейнера
    const containerResponse = await axios.post(
      containerUrl, 
      containerParams, 
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000 // 2 минуты для видео
      }
    );
    
    log(`Ответ API (создание контейнера): ${JSON.stringify(containerResponse.data)}`);
    
    // Проверка на наличие содержательного ответа
    if (!containerResponse.data) {
      return {
        success: false,
        error: 'Получен пустой ответ от Instagram API при создании контейнера'
      };
    }
    
    // Проверяем успешность создания контейнера
    if (!containerResponse.data.id) {
      // Пытаемся найти описание ошибки в ответе
      const errorMsg = containerResponse.data.error ? 
        `${containerResponse.data.error.code}: ${containerResponse.data.error.message}` : 
        'Неизвестная ошибка при создании контейнера';
      
      return {
        success: false,
        error: errorMsg
      };
    }
    
    // Сохраняем ID контейнера для дальнейшего использования
    const containerId = containerResponse.data.id;
    
    log(`Видео создано в контейнере ${containerId}, ожидаем обработки...`);
    
    // Проверяем статус обработки видео и публикуем его, когда готово
    return await checkAndPublishVideo(containerId, token, businessAccountId);
    
  } catch (error) {
    log(`Исключение при публикации: ${error.message}`);
    
    // Дополнительное логирование для ответа API
    if (error.response && error.response.data) {
      log(`Детали ошибки API: ${JSON.stringify(error.response.data)}`);
    }
    
    // Обработка распространенных ошибок
    let errorMessage = `Ошибка при публикации в Instagram: ${error.message}`;
    
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      
      if (apiError.code === 190) {
        errorMessage = 'Недействительный токен доступа. Пожалуйста, обновите токен в настройках.';
      } else if (apiError.code === 4) {
        errorMessage = 'Ограничение частоты запросов. Пожалуйста, повторите попытку позже.';
      } else if (apiError.code === 10) {
        errorMessage = 'Ошибка разрешений API. Проверьте, что приложение имеет необходимые разрешения.';
      } else {
        errorMessage = `Ошибка API Instagram: ${apiError.message} (код ${apiError.code})`;
      }
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Главная функция для запуска теста
async function main() {
  log('=== Запуск теста публикации видео в Instagram ===');
  
  try {
    const result = await publishVideoToInstagram();
    
    if (result.success) {
      log(`✅ Публикация успешна!`);
      log(`ID публикации: ${result.postId}`);
      log(`URL публикации: ${result.permalink || 'не предоставлен API'}`);
    } else {
      log(`❌ Ошибка публикации: ${result.error}`);
    }
  } catch (error) {
    log(`❌ Непредвиденная ошибка: ${error.message}`);
  }
  
  log('=== Тест публикации видео в Instagram завершен ===');
}

// Запускаем тест
main();