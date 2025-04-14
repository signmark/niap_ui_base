import { Router } from "express";
import fs from 'fs';
import axios from 'axios';

/**
 * Логирование с поддержкой записи в файл и на консоль
 * @param {string} message Сообщение для логирования
 * @param {string} source Источник сообщения для категоризации
 */
function log(message: string, source: string = 'api') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}][${source}] ${message}`;
  console.log(formattedMessage);
  
  // Запись в файл логов
  try {
    fs.appendFileSync('logs/instagram.log', `${formattedMessage}\n`);
  } catch (error) {
    console.error(`Ошибка записи в лог-файл: ${error}`);
  }
}

const router = Router();

// Добавляем GET метод для получения информации о тестовом API
router.get('/info', (req, res) => {
  res.json({
    apiEndpoints: {
      postVideo: "/api/test-instagram/instagram-post",
      postImage: "/api/test-instagram/instagram-post",
      checkStatus: "/api/test-instagram/check-container-status"
    },
    parametersRequired: {
      token: "Instagram Access Token",
      businessAccountId: "Instagram Business Account ID",
      caption: "Текст публикации (необязательно)",
      videoUrl: "URL видео для публикации видео", 
      imageUrl: "URL изображения для публикации изображения"
    },
    examples: {
      videoPost: {
        token: "EXAMPLE_TOKEN",
        businessAccountId: "EXAMPLE_BUSINESS_ID",
        caption: "Тестовое описание видео",
        videoUrl: "https://example.com/sample-video.mp4"
      }
    }
  });
});

/**
 * Маршрут для проверки статуса контейнера
 */
router.get('/check-container-status', async (req, res) => {
  try {
    const { containerId, token, businessAccountId } = req.query;
    
    if (!containerId || !token || !businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать containerId, token и businessAccountId'
      });
    }
    
    log(`Проверка статуса контейнера ${containerId}`, 'instagram-test-api');
    
    // Формируем запрос на проверку статуса
    const statusUrl = `https://graph.facebook.com/v17.0/${containerId}`;
    const statusParams = {
      access_token: token,
      fields: 'status_code,status_message,error_info'
    };
    
    const statusResponse = await axios.get(statusUrl, { 
      params: statusParams,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    // Логируем результат
    fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] ПРОВЕРКА СТАТУСА ${containerId}: ${JSON.stringify(statusResponse.data)}\n`);
    
    // Определяем готовность контейнера
    const status = statusResponse.data?.status_code || 'UNKNOWN';
    const statusMessage = statusResponse.data?.status_message || null;
    const isReady = status === 'FINISHED';
    const errorInfo = statusResponse.data?.error_info || null;
    
    // Возвращаем результат
    return res.json({
      success: true,
      containerId,
      status,
      statusMessage,
      isReady,
      errorInfo,
      message: isReady ? 'Контейнер готов к публикации' : 'Контейнер ещё не готов'
    });
  } catch (error) {
    // Логируем ошибку
    const errorMessage = error.response?.data?.error?.message || error.message;
    fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] ОШИБКА ПРОВЕРКИ СТАТУСА: ${errorMessage}\n`);
    
    return res.status(500).json({
      success: false,
      error: `Ошибка при проверке статуса: ${errorMessage}`
    });
  }
});

// Добавляем GET метод для отображения формы тестирования при открытии в браузере
router.get('/instagram-post', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Тестирование API Instagram</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #3b5998; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="text"], textarea { width: 100%; padding: 8px; box-sizing: border-box; }
        button { background: #3b5998; color: white; border: none; padding: 10px 15px; cursor: pointer; }
        .note { background: #f8f9fa; padding: 10px; border-left: 4px solid #3b5998; margin: 15px 0; }
        #result { margin-top: 20px; background: #f8f9fa; padding: 15px; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <h1>Тестирование публикации в Instagram</h1>
      <div class="note">
        <strong>Примечание:</strong> Для работы этого API вам потребуются действующий токен Instagram и ID бизнес-аккаунта.
      </div>
      
      <form id="testForm">
        <div class="form-group">
          <label for="token">Instagram Access Token:</label>
          <input type="text" id="token" name="token" placeholder="Токен доступа Instagram" required>
        </div>
        
        <div class="form-group">
          <label for="businessAccountId">Business Account ID:</label>
          <input type="text" id="businessAccountId" name="businessAccountId" placeholder="ID бизнес-аккаунта" required>
        </div>
        
        <div class="form-group">
          <label for="imageUrl">URL изображения:</label>
          <input type="text" id="imageUrl" name="imageUrl" placeholder="https://example.com/image.jpg">
        </div>
        
        <div class="form-group">
          <label for="videoUrl">URL видео:</label>
          <input type="text" id="videoUrl" name="videoUrl" placeholder="https://example.com/video.mp4">
        </div>
        
        <div class="form-group">
          <label for="caption">Подпись к публикации:</label>
          <textarea id="caption" name="caption" rows="4" placeholder="Текст публикации..."></textarea>
        </div>
        
        <div class="note">
          <strong>Важно:</strong> Необходимо указать хотя бы один из URL: изображения или видео.
        </div>
        
        <button type="submit">Протестировать публикацию</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        document.getElementById('testForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const result = document.getElementById('result');
          result.innerHTML = 'Отправка запроса...';
          
          const formData = {
            token: document.getElementById('token').value,
            businessAccountId: document.getElementById('businessAccountId').value,
            imageUrl: document.getElementById('imageUrl').value || null,
            videoUrl: document.getElementById('videoUrl').value || null,
            caption: document.getElementById('caption').value || null
          };
          
          if (!formData.imageUrl && !formData.videoUrl) {
            result.innerHTML = 'Ошибка: укажите хотя бы один URL (изображения или видео)';
            return;
          }
          
          try {
            const response = await fetch('/api/test-instagram/instagram-post', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            result.innerHTML = 'Результат:\n' + JSON.stringify(data, null, 2);
          } catch (error) {
            result.innerHTML = 'Ошибка:\n' + error.message;
          }
        });
      </script>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Тестовый маршрут для проверки публикации в Instagram
 * Использует напрямую Instagram Graph API без промежуточных сервисов
 */
router.post('/instagram-post', async (req, res) => {
  try {
    // Получаем параметры из запроса
    const { token, businessAccountId, imageUrl, videoUrl, caption } = req.body;
    
    // Проверяем наличие обязательных параметров
    if (!token || !businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать token и businessAccountId'
      });
    }
    
    // Проверяем наличие медиа
    if (!imageUrl && !videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать хотя бы одно медиа (imageUrl или videoUrl)'
      });
    }
    
    // Логирование запроса
    const logEntry = `[${new Date().toISOString()}] TEST REQUEST: ${JSON.stringify({
      caption: caption ? 'присутствует' : 'отсутствует',
      imageUrl: imageUrl ? 'присутствует' : 'отсутствует',
      videoUrl: videoUrl ? 'присутствует' : 'отсутствует',
      token: token ? 'присутствует' : 'отсутствует',
      businessAccountId: businessAccountId || 'отсутствует'
    })}\n`;
    
    fs.appendFileSync('logs/instagram.log', logEntry);
    
    // Шаг 1: Создание контейнера для медиа
    const baseUrl = 'https://graph.facebook.com/v17.0';
    const containerUrl = `${baseUrl}/${businessAccountId}/media`;
    
    // Подготавливаем параметры в зависимости от типа медиа
    const containerParams: any = {
      access_token: token,
      caption: caption || 'Тестовый пост для Instagram'
    };
    
    // Добавляем URL медиа в соответствии с типом
    if (videoUrl) {
      // Проверка правильности кодирования URL видео
      let encodedVideoUrl = videoUrl;
      // Если URL содержит символы, которые могут требовать кодирования, перекодируем его
      if (videoUrl.includes(' ') || /[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/.test(videoUrl)) {
        // Декодируем сначала, чтобы избежать двойного кодирования
        try {
          const decodedUrl = decodeURIComponent(videoUrl);
          encodedVideoUrl = encodeURIComponent(decodedUrl);
          log(`URL видео был перекодирован для обеспечения совместимости`, 'instagram-test-api');
        } catch (e) {
          // Если произошла ошибка при декодировании, используем исходный URL
          log(`Предупреждение: не удалось перекодировать URL видео: ${e.message}`, 'instagram-test-api');
        }
      }
      
      // Используем REELS вместо VIDEO согласно новым требованиям API
      containerParams.media_type = 'REELS';
      containerParams.video_url = encodedVideoUrl;
      
      // Добавляем параметр thumb_offset для указания кадра для обложки
      containerParams.thumb_offset = 5;
      
      // Проверяем доступность URL видео перед отправкой
      try {
        const urlTestResponse = await axios.head(encodedVideoUrl, { 
          timeout: 5000,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }).catch(e => {
          log(`Внимание! URL видео может быть недоступен: ${e.message}`, 'instagram-test-api');
          fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] Ошибка проверки URL: ${e.message}\n`);
          return null;
        });
          
        if (urlTestResponse) {
          log(`URL видео проверен, статус: ${urlTestResponse.status}`, 'instagram-test-api');
          fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] URL доступен, статус: ${urlTestResponse.status}\n`);
          
          // Проверяем заголовки на наличие Content-Type и Content-Length
          const contentType = urlTestResponse.headers['content-type'];
          const contentLength = urlTestResponse.headers['content-length'];
          
          if (contentType) {
            fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] Content-Type: ${contentType}\n`);
            
            // Проверка на соответствие формату видео
            if (!contentType.includes('video/') && !contentType.includes('application/octet-stream')) {
              log(`Внимание! URL может не содержать видео (Content-Type: ${contentType})`, 'instagram-test-api');
            }
          }
          
          if (contentLength) {
            const sizeMB = parseInt(contentLength) / (1024 * 1024);
            fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] Размер файла: ${sizeMB.toFixed(2)} MB\n`);
            
            // Проверка на размер файла
            if (sizeMB > 100) {
              log(`Внимание! Размер видео (${sizeMB.toFixed(2)} MB) может превышать допустимый для Instagram`, 'instagram-test-api');
            }
          }
        }
      } catch (checkError) {
        log(`Ошибка при проверке URL видео: ${checkError.message}`, 'instagram-test-api');
        fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] Ошибка анализа видео: ${checkError.message}\n`);
      }
      
      // Если есть изображение, используем его как обложку
      if (imageUrl) {
        // Также проверяем и кодируем URL миниатюры при необходимости
        let encodedImageUrl = imageUrl;
        if (imageUrl.includes(' ') || /[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/.test(imageUrl)) {
          try {
            const decodedImgUrl = decodeURIComponent(imageUrl);
            encodedImageUrl = encodeURIComponent(decodedImgUrl);
            log(`URL изображения был перекодирован`, 'instagram-test-api');
          } catch (e) {
            log(`Предупреждение: не удалось перекодировать URL изображения: ${e.message}`, 'instagram-test-api');
          }
        }
        containerParams.thumbnail_url = encodedImageUrl;
        log(`Добавляем URL обложки видео: ${encodedImageUrl.substring(0, 50)}...`, 'instagram-test-api');
      }
    } else {
      // Если это не видео, используем изображение
      // Кодируем URL изображения при необходимости
      let encodedImageUrl = imageUrl;
      if (imageUrl.includes(' ') || /[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/.test(imageUrl)) {
        try {
          const decodedImgUrl = decodeURIComponent(imageUrl);
          encodedImageUrl = encodeURIComponent(decodedImgUrl);
          log(`URL изображения был перекодирован`, 'instagram-test-api');
        } catch (e) {
          log(`Предупреждение: не удалось перекодировать URL изображения: ${e.message}`, 'instagram-test-api');
        }
      }
      containerParams.image_url = encodedImageUrl;
    }
    
    // Логируем параметры запроса
    const paramLog = `[${new Date().toISOString()}] CONTAINER PARAMS: ${JSON.stringify({
      url: containerUrl,
      ...containerParams,
      access_token: 'скрыт для безопасности'
    })}\n`;
    fs.appendFileSync('logs/instagram.log', paramLog);
    
    // Отправляем запрос на создание контейнера
    const containerResponse = await axios.post(containerUrl, containerParams, {
      headers: { 'Content-Type': 'application/json' },
      timeout: videoUrl ? 120000 : 60000 // Увеличенный таймаут для видео
    });
    
    // Логируем ответ API
    const containerLog = `[${new Date().toISOString()}] CONTAINER RESPONSE: ${JSON.stringify(containerResponse.data)}\n`;
    fs.appendFileSync('logs/instagram.log', containerLog);
    
    // Проверяем успешность создания контейнера
    if (!containerResponse.data || !containerResponse.data.id) {
      const errorMsg = containerResponse.data.error ? 
        `${containerResponse.data.error.code}: ${containerResponse.data.error.message}` : 
        'Неизвестная ошибка при создании контейнера';
      
      fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] CONTAINER ERROR: ${errorMsg}\n`);
      
      return res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
    
    // Получаем ID контейнера
    const containerId = containerResponse.data.id;
    fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] CONTAINER ID: ${containerId}\n`);
    
    // Шаг 2: Ожидание обработки видео и публикация контейнера
    const publishUrl = `${baseUrl}/${businessAccountId}/media_publish`;
    const publishParams = {
      access_token: token,
      creation_id: containerId
    };
    
    // Логируем параметры запроса на публикацию
    const publishParamLog = `[${new Date().toISOString()}] PUBLISH PARAMS: ${JSON.stringify({
      url: publishUrl,
      creation_id: containerId,
      access_token: 'скрыт для безопасности'
    })}\n`;
    fs.appendFileSync('logs/instagram.log', publishParamLog);
    
    // Добавляем увеличенную задержку и механизм повторных попыток
    // Instagram требует значительного времени для обработки видео
    if (videoUrl) {
      const initialWaitLog = `[${new Date().toISOString()}] Начальное ожидание 40 секунд для обработки видео Instagram...\n`;
      fs.appendFileSync('logs/instagram.log', initialWaitLog);
      
      // Первоначальное ожидание перед первой попыткой
      await new Promise(resolve => setTimeout(resolve, 40000)); // 40 секунд начальной задержки для видео
      
      // Максимальное количество попыток публикации
      const maxAttempts = 5; // Увеличиваем до 5 попыток
      let attemptCount = 0;
      let success = false;
      
      // Функция для проверки статуса контейнера
      const checkContainerStatus = async () => {
        try {
          const statusUrl = `${baseUrl}/${containerId}`;
          const statusParams = {
            fields: 'status_code',
            access_token: token
          };
          
          const statusLog = `[${new Date().toISOString()}] Проверка статуса контейнера ${containerId}...\n`;
          fs.appendFileSync('logs/instagram.log', statusLog);
          
          const statusResponse = await axios.get(statusUrl, {
            params: statusParams,
            timeout: 15000 // Увеличен таймаут для проверки статуса
          });
          
          const responseLog = `[${new Date().toISOString()}] Ответ статуса: ${JSON.stringify(statusResponse.data)}\n`;
          fs.appendFileSync('logs/instagram.log', responseLog);
          
          // Возвращаем true если статус FINISHED
          if (statusResponse.data && 
              statusResponse.data.status_code && 
              statusResponse.data.status_code === 'FINISHED') {
            return true;
          }
          
          // Дополнительная проверка для статуса ERROR
          if (statusResponse.data && 
              statusResponse.data.status_code && 
              statusResponse.data.status_code === 'ERROR') {
            const errorStatusLog = `[${new Date().toISOString()}] Instagram вернул статус ERROR для контейнера ${containerId}\n`;
            fs.appendFileSync('logs/instagram.log', errorStatusLog);
          }
          
          return false;
        } catch (error: any) {
          const errorLog = `[${new Date().toISOString()}] Ошибка при проверке статуса: ${error.message}\n`;
          fs.appendFileSync('logs/instagram.log', errorLog);
          
          // Дополнительно логируем данные ответа API при ошибке
          if (error.response && error.response.data) {
            const responseErrorLog = `[${new Date().toISOString()}] Данные ответа при ошибке: ${JSON.stringify(error.response.data)}\n`;
            fs.appendFileSync('logs/instagram.log', responseErrorLog);
          }
          
          return false;
        }
      };
      
      // Цикл повторных попыток публикации с прогрессивным увеличением времени ожидания
      while (attemptCount < maxAttempts && !success) {
        attemptCount++;
        
        // Проверка статуса перед попыткой публикации
        const isReady = await checkContainerStatus();
        
        if (isReady) {
          const readyLog = `[${new Date().toISOString()}] Контейнер видео готов к публикации после ${attemptCount} проверки\n`;
          fs.appendFileSync('logs/instagram.log', readyLog);
          success = true;
        } else if (attemptCount < maxAttempts) {
          // Прогрессивно увеличиваем время ожидания с каждой попыткой
          // 20 сек, затем 30, 40, 50 сек
          const waitTime = 20000 + (attemptCount * 10000);
          const waitLog = `[${new Date().toISOString()}] Видео не готово, ожидание ещё ${waitTime/1000} секунд перед попыткой ${attemptCount+1}...\n`;
          fs.appendFileSync('logs/instagram.log', waitLog);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          const finalAttemptLog = `[${new Date().toISOString()}] Последняя попытка публикации после ${attemptCount} проверок, статус: ${isReady ? 'готов' : 'не готов'}\n`;
          fs.appendFileSync('logs/instagram.log', finalAttemptLog);
        }
      }
    }
    
    // Отправляем запрос на публикацию с улучшенным механизмом повторных попыток
    // Instagram может требовать очень долгой обработки для REELS
    let publishResponse;
    let maxPublishRetries = 8; // Увеличиваем максимальное количество попыток публикации до 8
    let publishRetryCount = 0;
    let publishSuccess = false;
    
    // Функция для проверки готовности контейнера к публикации с расширенным логированием
    const checkBeforePublish = async () => {
      try {
        const statusUrl = `${baseUrl}/${containerId}`;
        const statusParams = {
          // Запрашиваем расширенные поля для лучшей диагностики
          fields: 'status_code,status,error_info',
          access_token: token
        };
        
        const statusCheckLog = `[${new Date().toISOString()}] Дополнительная проверка готовности контейнера перед публикацией...\n`;
        fs.appendFileSync('logs/instagram.log', statusCheckLog);
        
        // Проверка через IP разных регионов может быть полезна
        // Добавляем уникальный timestamp для избежания кэширования
        const statusResponse = await axios.get(`${statusUrl}?_nocache=${Date.now()}`, {
          params: statusParams,
          timeout: 15000,
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (statusResponse.data) {
          // Подробно логируем весь ответ для анализа
          const statusLog = `[${new Date().toISOString()}] Полный ответ о статусе контейнера: ${JSON.stringify(statusResponse.data)}\n`;
          fs.appendFileSync('logs/instagram.log', statusLog);
          
          // Проверяем наличие ошибок в ответе
          if (statusResponse.data.error_info) {
            const errorInfoLog = `[${new Date().toISOString()}] Обнаружена информация об ошибке: ${JSON.stringify(statusResponse.data.error_info)}\n`;
            fs.appendFileSync('logs/instagram.log', errorInfoLog);
          }
          
          // Возвращаем true, если статус FINISHED
          if (statusResponse.data.status_code === 'FINISHED') {
            const readyLog = `[${new Date().toISOString()}] Контейнер имеет статус FINISHED, готов к публикации\n`;
            fs.appendFileSync('logs/instagram.log', readyLog);
            return true;
          } else {
            // Логируем неготовность с указанием конкретного статуса
            const notReadyLog = `[${new Date().toISOString()}] Контейнер не готов, текущий статус: ${statusResponse.data.status_code || 'не указан'}\n`;
            fs.appendFileSync('logs/instagram.log', notReadyLog);
          }
        }
        return false;
      } catch (error: any) {
        const errorLog = `[${new Date().toISOString()}] Ошибка при проверке готовности контейнера: ${error.message}\n`;
        fs.appendFileSync('logs/instagram.log', errorLog);
        
        // Логируем подробную информацию об ошибке, включая заголовки ответа
        if (error.response) {
          const responseErrorLog = `[${new Date().toISOString()}] Детали ошибки проверки статуса:\n` +
                                  `Код: ${error.response.status}\n` + 
                                  `Заголовки: ${JSON.stringify(error.response.headers)}\n` +
                                  `Данные: ${JSON.stringify(error.response.data)}\n`;
          fs.appendFileSync('logs/instagram.log', responseErrorLog);
        }
        
        return false;
      }
    };
    
    while (publishRetryCount < maxPublishRetries && !publishSuccess) {
      try {
        // Перед отправкой запроса на публикацию проверяем готовность контейнера
        // Это помогает избежать ошибки "Media container not ready"
        const isContainerReady = await checkBeforePublish();
        
        if (!isContainerReady && publishRetryCount > 0) {
          const notReadyLog = `[${new Date().toISOString()}] Контейнер всё ещё не готов, но пробуем отправить запрос на публикацию\n`;
          fs.appendFileSync('logs/instagram.log', notReadyLog);
        }
        
        // Логируем попытку
        const retryLog = `[${new Date().toISOString()}] Попытка публикации ${publishRetryCount + 1} из ${maxPublishRetries}\n`;
        fs.appendFileSync('logs/instagram.log', retryLog);
        
        publishResponse = await axios.post(publishUrl, publishParams, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 90000 // Увеличенный таймаут для видео (1.5 минуты)
        });
        
        // Проверяем успешность публикации
        if (publishResponse.data && publishResponse.data.id) {
          publishSuccess = true;
          const successLog = `[${new Date().toISOString()}] Успешно опубликовано после ${publishRetryCount + 1} попыток\n`;
          fs.appendFileSync('logs/instagram.log', successLog);
        } else {
          throw new Error('Отсутствует ID публикации в ответе');
        }
      } catch (publishError: any) {
        publishRetryCount++;
        
        // Подробно логируем ошибку публикации
        const detailedErrorLog = `[${new Date().toISOString()}] Ошибка публикации #${publishRetryCount}: ${publishError.message}\n`;
        fs.appendFileSync('logs/instagram.log', detailedErrorLog);
        
        if (publishError.response?.data) {
          const responseErrorLog = `[${new Date().toISOString()}] Данные ответа: ${JSON.stringify(publishError.response.data)}\n`;
          fs.appendFileSync('logs/instagram.log', responseErrorLog);
        }
        
        // Если это последняя попытка, просто пробросим ошибку
        if (publishRetryCount >= maxPublishRetries) {
          const finalErrorLog = `[${new Date().toISOString()}] Исчерпаны все попытки публикации (${maxPublishRetries}), финальная ошибка: ${publishError.message}\n`;
          fs.appendFileSync('logs/instagram.log', finalErrorLog);
          throw publishError;
        }
        
        // Проверяем конкретные коды ошибок и сообщения, которые могут указывать на проблему с готовностью видео
        // Расширенный список кодов ошибок и шаблонов сообщений на основе всех рекомендаций
        const isMediaNotReady = 
            // Коды ошибок, связанные с неготовностью контейнера
            publishError.response?.data?.error?.code === 9007 || // "Media container not ready"
            publishError.response?.data?.error?.code === 2207 || // Другой возможный код ошибки
            publishError.response?.data?.error?.code === 190 ||  // Ошибка валидации токена или параметров
            publishError.response?.data?.error?.code === 10901 || // "Error creating container" - может нуждаться в повторной попытке
            publishError.response?.data?.error?.code === 10900 || // "Invalid parameters" - возможно из-за кэширования
            publishError.response?.data?.error?.code === 36 ||    // "Access token expired" - может требовать обновления токена
            
            // Проверяем текст сообщения на различные варианты ошибок неготовности
            (publishError.response?.data?.error?.message || '').includes('Media ID is not available') ||
            (publishError.response?.data?.error?.message || '').includes('not ready') ||
            (publishError.response?.data?.error?.message || '').includes('still being processed') ||
            (publishError.response?.data?.error?.message || '').includes('being uploaded') ||
            (publishError.response?.data?.error?.message || '').includes('wait') ||
            (publishError.response?.data?.error?.message || '').includes('try again') ||
            (publishError.response?.data?.error?.message || '').includes('processing') ||
            (publishError.response?.data?.error?.message || '').includes('temporary') ||
            (publishError.response?.data?.error?.message || '').includes('unavailable') ||
            (publishError.response?.data?.error?.message || '').includes('retry') ||
            
            // Проверка на возможные проблемы CDN
            (publishError.message || '').includes('timeout') ||
            (publishError.message || '').includes('network') ||
            
            // Проверка на региональные проблемы
            (publishError.response?.data?.error?.message || '').includes('region') ||
            (publishError.response?.data?.error?.message || '').includes('country') ||
            (publishError.response?.data?.error?.message || '').includes('location');
            
        // Логируем дополнительную информацию о типе ошибки для анализа
        if (isMediaNotReady) {
            fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] Классифицирована как ВРЕМЕННАЯ ошибка, будет выполнен повтор\n`);
        } else {
            fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] Классифицирована как КРИТИЧЕСКАЯ ошибка, повтор может не помочь\n`);
        }
        
        // Прогрессивно увеличиваем время ожидания с каждой попыткой
        // Начинаем с 30 секунд и увеличиваем квадратично
        const waitTime = 30000 * (publishRetryCount * publishRetryCount / 2 + 1);
        const errorLog = `[${new Date().toISOString()}] ${isMediaNotReady ? 'Медиаданные не готовы' : 'Произошла ошибка'}, ожидание ${waitTime/1000} секунд перед следующей попыткой (${publishRetryCount + 1}/${maxPublishRetries})\n`;
        fs.appendFileSync('logs/instagram.log', errorLog);
        
        // Ожидаем перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Если не медиа не готово, повторно проверяем статус контейнера после ожидания
        if (isMediaNotReady) {
          const additionalCheckLog = `[${new Date().toISOString()}] Выполняем дополнительную проверку статуса после ожидания\n`;
          fs.appendFileSync('logs/instagram.log', additionalCheckLog);
          await checkBeforePublish();
        }
      }
    }
    
    // Логируем ответ API
    const publishLog = `[${new Date().toISOString()}] PUBLISH RESPONSE: ${JSON.stringify(publishResponse.data)}\n`;
    fs.appendFileSync('logs/instagram.log', publishLog);
    
    // Проверяем успешность публикации
    if (!publishResponse.data || !publishResponse.data.id) {
      const errorMsg = publishResponse.data.error ? 
        `${publishResponse.data.error.code}: ${publishResponse.data.error.message}` : 
        'Неизвестная ошибка при публикации';
      
      fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] PUBLISH ERROR: ${errorMsg}\n`);
      
      return res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
    
    // Получаем ID публикации
    const mediaId = publishResponse.data.id;
    
    // Шаг 3: Получение постоянной ссылки на публикацию
    const mediaInfoUrl = `${baseUrl}/${mediaId}`;
    const mediaInfoParams = {
      fields: 'permalink',
      access_token: token
    };
    
    // Логируем параметры запроса на получение информации
    const infoParamLog = `[${new Date().toISOString()}] INFO PARAMS: ${JSON.stringify({
      url: mediaInfoUrl,
      fields: 'permalink',
      access_token: 'скрыт для безопасности'
    })}\n`;
    fs.appendFileSync('logs/instagram.log', infoParamLog);
    
    // Отправляем запрос на получение информации о публикации
    const mediaInfoResponse = await axios.get(mediaInfoUrl, {
      params: mediaInfoParams,
      timeout: 30000
    });
    
    // Логируем ответ API
    const infoLog = `[${new Date().toISOString()}] INFO RESPONSE: ${JSON.stringify(mediaInfoResponse.data)}\n`;
    fs.appendFileSync('logs/instagram.log', infoLog);
    
    // Получаем постоянную ссылку или формируем стандартную
    let permalink = '';
    if (mediaInfoResponse.data && mediaInfoResponse.data.permalink) {
      permalink = mediaInfoResponse.data.permalink;
    } else {
      permalink = `https://www.instagram.com/p/${mediaId}/`;
    }
    
    // Формируем успешный ответ
    const successResponse = {
      success: true,
      mediaId: mediaId,
      permalink: permalink,
      containerCreationTime: new Date(),
      publishTime: new Date()
    };
    
    // Логируем успешный результат
    const successLog = `[${new Date().toISOString()}] SUCCESS: ${JSON.stringify(successResponse)}\n`;
    fs.appendFileSync('logs/instagram.log', successLog);
    
    // Возвращаем успешный результат
    return res.json(successResponse);
  } catch (error) {
    // Логируем ошибку
    const errorLog = `[${new Date().toISOString()}] ERROR: ${error.message || error}\n`;
    if (error.response && error.response.data) {
      fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] ERROR RESPONSE: ${JSON.stringify(error.response.data)}\n`);
    }
    fs.appendFileSync('logs/instagram.log', errorLog);
    
    // Возвращаем ошибку
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

export default router;