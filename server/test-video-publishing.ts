import { Router } from "express";
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { socialPublishingWithImgurService } from './services/social-publishing-with-imgur';

const router = Router();

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
    fs.appendFileSync('logs/video-test.log', `${formattedMessage}\n`);
  } catch (error) {
    console.error(`Ошибка записи в лог-файл: ${error}`);
  }
}

// Создаем директорию для логов, если она не существует
try {
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
  }
} catch (error) {
  console.error('Ошибка при создании директории логов:', error);
}

// URL в S3 Beget для тестового видео
let cachedVideoUrl: string | null = null;
let cachedThumbnailUrl: string | null = null;

/**
 * Подготавливает URL тестового видео, используя уже загруженное видео на Beget S3
 */
async function ensureTestVideoUploaded() {
  // Используем уже загруженное видео из Beget S3
  const videoUrl = "https://6e679636ae90-ridiculous-seth.s3.ru1.storage.beget.cloud/videos/4a2c032c-a542-4518-bd8a-f10b69eb885f-mov_bbb.mp4";
  const thumbnailUrl = null;
  
  log(`Используем уже загруженное видео: ${videoUrl}`, 'video-test');
  
  // Сохраняем URL видео для повторного использования
  cachedVideoUrl = videoUrl;
  cachedThumbnailUrl = thumbnailUrl;
  
  return { 
    videoUrl: cachedVideoUrl, 
    thumbnailUrl: cachedThumbnailUrl 
  };
}

/**
 * Маршрут для проверки статуса тестового видео
 */
router.get('/video-status', async (req, res) => {
  try {
    const status = {
      hasVideo: fs.existsSync(path.join(process.cwd(), 'attached_assets', 'Test.webm')),
      cachedVideoUrl: cachedVideoUrl,
      cachedThumbnailUrl: cachedThumbnailUrl,
      hasBegetS3Keys: !!(process.env.BEGET_S3_ACCESS_KEY && process.env.BEGET_S3_SECRET_KEY)
    };
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Маршрут для загрузки и публикации тестового видео в Instagram
 */
router.post('/publish-test-video-instagram', async (req, res) => {
  try {
    // Получаем параметры из запроса
    const { token, businessAccountId } = req.body;
    
    if (!token || !businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать token и businessAccountId для Instagram'
      });
    }
    
    // Загружаем тестовое видео, если оно еще не загружено
    const { videoUrl, thumbnailUrl } = await ensureTestVideoUploaded();
    
    // Формируем тестовый контент для публикации
    const testContent = {
      id: `test-${Date.now()}`,
      userId: 'test-user',
      campaignId: 'test-campaign',
      content: 'Тестовая публикация видео в Instagram с помощью улучшенного механизма загрузки #test #video',
      title: 'Тест публикации видео',
      contentType: 'video',
      imageUrl: thumbnailUrl,
      videoUrl: videoUrl,
      additionalImages: null,
      additionalMedia: null,
      createdAt: new Date(),
      scheduledAt: null,
      socialPlatforms: ['instagram'],
      hashtags: ['test', 'video'],
      keywords: ['тест', 'видео'],
      links: [],
      prompt: '',
      status: 'draft',
      source: 'manual',
      metadata: {}
    };
    
    // Выполняем публикацию через Instagram API
    log('Отправляем запрос на публикацию тестового видео в Instagram...', 'video-test');
    
    // Прямой запрос к тестовому API
    const instagramApiResponse = await axios.post('http://0.0.0.0:5000/api/test-instagram/instagram-post', {
      token,
      businessAccountId,
      videoUrl,
      imageUrl: thumbnailUrl || undefined,
      caption: testContent.content
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Возвращаем результат
    res.json({
      success: true,
      result: instagramApiResponse.data,
      videoDetails: {
        videoUrl,
        thumbnailUrl
      }
    });
  } catch (error) {
    log(`Ошибка при публикации видео: ${error.message}`, 'video-test');
    
    // Логируем дополнительные детали ошибки, если они доступны
    if (error.response) {
      log(`Детали ошибки API: ${JSON.stringify(error.response.data)}`, 'video-test');
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Маршрут для отображения HTML-формы тестирования публикации видео
 */
router.get('/test-video-form', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Тестирование публикации видео в Instagram</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #3b5998; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="text"] { width: 100%; padding: 8px; box-sizing: border-box; }
        button { background: #3b5998; color: white; border: none; padding: 10px 15px; cursor: pointer; }
        .note { background: #f8f9fa; padding: 10px; border-left: 4px solid #3b5998; margin: 15px 0; }
        #result { margin-top: 20px; background: #f8f9fa; padding: 15px; white-space: pre-wrap; }
        #status { margin: 20px 0; background: #e9f7ef; padding: 10px; }
        .status-item { margin: 5px 0; }
        .status-ok { color: green; }
        .status-error { color: red; }
      </style>
    </head>
    <body>
      <h1>Тестирование публикации видео в Instagram</h1>
      
      <div id="status">
        <h3>Статус тестового окружения:</h3>
        <div id="statusContent">Загрузка...</div>
      </div>
      
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
        
        <button type="submit">Опубликовать тестовое видео</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        // Загружаем статус тестового окружения
        async function loadStatus() {
          try {
            const response = await fetch('/api/test-video/video-status');
            const data = await response.json();
            
            const statusHtml = Object.entries(data.status).map(([key, value]) => {
              const statusClass = value ? 'status-ok' : 'status-error';
              return '<div class="status-item ' + statusClass + '"><strong>' + key + ':</strong> ' + value + '</div>';
            }).join('');
            
            document.getElementById('statusContent').innerHTML = statusHtml;
          } catch (error) {
            document.getElementById('statusContent').innerHTML = 
              '<div class="status-error">Ошибка получения статуса: ' + error.message + '</div>';
          }
        }
        
        // Загружаем статус при загрузке страницы
        loadStatus();
        
        // Обработчик отправки формы
        document.getElementById('testForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const result = document.getElementById('result');
          result.innerHTML = 'Отправка запроса на публикацию тестового видео...';
          
          const formData = {
            token: document.getElementById('token').value,
            businessAccountId: document.getElementById('businessAccountId').value
          };
          
          try {
            const response = await fetch('/api/test-video/publish-test-video-instagram', {
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

export default router;