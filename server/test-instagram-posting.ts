import { Express, Request, Response } from 'express';
import { log } from './utils/logger';
import { VideoProcessor } from './services/video-processor';
import { InstagramService } from './services/social/instagram-service';
import { directusApi } from './directus';
import axios from 'axios';
import * as crypto from 'crypto';

// Создаем экземпляр процессора видео
const videoProcessor = new VideoProcessor();
const instagramService = new InstagramService();

/**
 * Регистрирует тестовые маршруты для Instagram API
 * @param app Express приложение
 */
export function registerInstagramTestRoutes(app: Express) {
  log('Регистрация тестовых маршрутов для Instagram...');

  // Интерфейс для тестовой страницы
  app.get('/test/instagram-video', (req: Request, res: Response) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Тест обработки видео для Instagram</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .container { display: flex; flex-direction: column; gap: 20px; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; }
          input[type="text"], textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
          button { background: #4a56e2; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
          button:hover { background: #3a46c2; }
          .result { margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9; }
          .video-container { margin-top: 20px; }
          .video-container video { max-width: 100%; border: 1px solid #ddd; }
          .loading { display: none; margin: 20px 0; text-align: center; }
          .error { color: red; }
          .success { color: green; }
        </style>
      </head>
      <body>
        <h1>Тестирование обработки видео для Instagram</h1>
        
        <div class="container">
          <form id="videoForm">
            <div class="form-group">
              <label for="videoUrl">URL видео:</label>
              <input type="text" id="videoUrl" name="videoUrl" placeholder="https://example.com/video.mp4" required>
            </div>
            
            <div class="form-group">
              <label for="caption">Подпись к видео:</label>
              <textarea id="caption" name="caption" rows="4" placeholder="Введите подпись к видео"></textarea>
            </div>
            
            <div class="form-group">
              <button type="submit">Обработать видео</button>
            </div>
          </form>
          
          <div class="loading" id="loadingIndicator">
            Обработка видео... Это может занять некоторое время.
          </div>
          
          <div class="result" id="resultContainer" style="display: none;">
            <h3>Результат обработки:</h3>
            <div id="resultMessage"></div>
            
            <div class="video-container" id="videoContainer" style="display: none;">
              <h4>Оригинальное видео:</h4>
              <video id="originalVideo" controls></video>
              
              <h4>Обработанное видео для Instagram:</h4>
              <video id="processedVideo" controls></video>
              
              <div class="form-group" style="margin-top: 20px;">
                <button id="publishButton" style="display: none;">Опубликовать в Instagram</button>
              </div>
            </div>
          </div>
          
          <div class="result" id="publishResult" style="display: none;">
            <h3>Результат публикации:</h3>
            <div id="publishMessage"></div>
          </div>
        </div>
        
        <script>
          document.getElementById('videoForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const videoUrl = document.getElementById('videoUrl').value;
            const caption = document.getElementById('caption').value;
            
            // Показываем индикатор загрузки
            document.getElementById('loadingIndicator').style.display = 'block';
            document.getElementById('resultContainer').style.display = 'none';
            document.getElementById('publishResult').style.display = 'none';
            
            try {
              const response = await fetch('/api/test/process-video', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videoUrl, caption })
              });
              
              const result = await response.json();
              
              // Скрываем индикатор загрузки
              document.getElementById('loadingIndicator').style.display = 'none';
              document.getElementById('resultContainer').style.display = 'block';
              
              if (result.success) {
                // Отображаем успешный результат
                document.getElementById('resultMessage').innerHTML = '<div class="success">' + result.message + '</div>';
                document.getElementById('videoContainer').style.display = 'block';
                
                // Устанавливаем видео
                const originalVideo = document.getElementById('originalVideo');
                originalVideo.src = videoUrl;
                
                const processedVideo = document.getElementById('processedVideo');
                processedVideo.src = result.processedVideoUrl;
                
                // Показываем кнопку публикации
                const publishButton = document.getElementById('publishButton');
                publishButton.style.display = 'block';
                publishButton.dataset.videoUrl = result.processedVideoUrl;
                publishButton.dataset.caption = caption;
              } else {
                // Отображаем ошибку
                document.getElementById('resultMessage').innerHTML = '<div class="error">Ошибка: ' + result.error + '</div>';
                document.getElementById('videoContainer').style.display = 'none';
              }
            } catch (error) {
              // Скрываем индикатор загрузки и отображаем ошибку
              document.getElementById('loadingIndicator').style.display = 'none';
              document.getElementById('resultContainer').style.display = 'block';
              document.getElementById('resultMessage').innerHTML = '<div class="error">Ошибка: ' + error.message + '</div>';
              document.getElementById('videoContainer').style.display = 'none';
            }
          });
          
          // Обработчик кнопки публикации
          document.getElementById('publishButton').addEventListener('click', async function() {
            const videoUrl = this.dataset.videoUrl;
            const caption = this.dataset.caption;
            
            // Показываем индикатор загрузки
            document.getElementById('loadingIndicator').style.display = 'block';
            document.getElementById('publishResult').style.display = 'none';
            
            try {
              const response = await fetch('/api/test/publish-to-instagram', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videoUrl, caption })
              });
              
              const result = await response.json();
              
              // Скрываем индикатор загрузки
              document.getElementById('loadingIndicator').style.display = 'none';
              document.getElementById('publishResult').style.display = 'block';
              
              if (result.success) {
                // Отображаем успешный результат
                document.getElementById('publishMessage').innerHTML = '<div class="success">Видео успешно опубликовано!</div>';
                if (result.permalink) {
                  document.getElementById('publishMessage').innerHTML += '<p>Ссылка на публикацию: <a href="' + result.permalink + '" target="_blank">' + result.permalink + '</a></p>';
                }
              } else {
                // Отображаем ошибку
                document.getElementById('publishMessage').innerHTML = '<div class="error">Ошибка публикации: ' + result.error + '</div>';
                if (result.details) {
                  document.getElementById('publishMessage').innerHTML += '<p>Детали ошибки: ' + JSON.stringify(result.details) + '</p>';
                }
              }
            } catch (error) {
              // Скрываем индикатор загрузки и отображаем ошибку
              document.getElementById('loadingIndicator').style.display = 'none';
              document.getElementById('publishResult').style.display = 'block';
              document.getElementById('publishMessage').innerHTML = '<div class="error">Ошибка: ' + error.message + '</div>';
            }
          });
        </script>
      </body>
      </html>
    `);
  });

  // API для обработки видео
  app.post('/api/test/process-video', async (req: Request, res: Response) => {
    try {
      const { videoUrl, caption } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({ success: false, error: 'URL видео не указан' });
      }
      
      log(`[Test] Начинаем обработку видео: ${videoUrl}`);
      
      // Обрабатываем видео с помощью VideoProcessor
      const processedVideoUrl = await videoProcessor.processVideoForSocialMedia(videoUrl, 'instagram');
      
      log(`[Test] Видео успешно обработано: ${processedVideoUrl}`);
      
      return res.json({
        success: true,
        message: 'Видео успешно обработано',
        originalVideoUrl: videoUrl,
        processedVideoUrl,
        caption
      });
    } catch (error) {
      log(`[Test] Ошибка при обработке видео: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API для публикации в Instagram
  app.post('/api/test/publish-to-instagram', async (req: Request, res: Response) => {
    try {
      const { videoUrl, caption } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({ success: false, error: 'URL видео не указан' });
      }
      
      log(`[Test] Начинаем публикацию видео в Instagram: ${videoUrl}`);
      
      // Получаем настройки Instagram из хардкода (в реальном приложении берем из базы данных)
      const instagramSettings = await getInstagramSettings();
      
      if (!instagramSettings) {
        return res.status(500).json({ success: false, error: 'Не удалось получить настройки Instagram' });
      }
      
      // Создаем тестовый контент для публикации
      const content = {
        id: crypto.randomUUID(),
        content: caption || 'Тестовая публикация',
        title: 'Тест Instagram API',
        imageUrl: null,
        videoUrl: videoUrl,
        contentType: 'video',
        additionalImages: [],
        hashtags: ['test', 'instagram', 'api'],
        keywords: [],
        status: 'draft',
        userId: '53921f16-f51d-4591-80b9-8caa4fde4d13', // Тестовый ID пользователя
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e', // Тестовый ID кампании
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        socialPlatforms: {
          instagram: {
            enabled: true,
            status: 'pending'
          }
        }
      };
      
      // Публикуем видео в Instagram
      const result = await instagramService.publishToInstagram(
        content,
        instagramSettings.token,
        instagramSettings.businessAccountId
      );
      
      log(`[Test] Результат публикации: ${JSON.stringify(result)}`);
      
      if (result.success) {
        return res.json({
          success: true,
          message: 'Видео успешно опубликовано в Instagram',
          permalink: result.url,
          mediaId: result.mediaId
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Не удалось опубликовать видео в Instagram',
          details: result
        });
      }
    } catch (error) {
      log(`[Test] Ошибка при публикации в Instagram: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data || error
      });
    }
  });

  // Тестовый маршрут для проверки обработки видео
  app.get('/api/test/instagram-video-status', async (req: Request, res: Response) => {
    try {
      const containerId = req.query.containerId as string;
      
      if (!containerId) {
        return res.status(400).json({ success: false, error: 'ID контейнера не указан' });
      }
      
      // Получаем настройки Instagram из базы данных
      const instagramSettings = await getInstagramSettings();
      
      if (!instagramSettings) {
        return res.status(500).json({ success: false, error: 'Не удалось получить настройки Instagram' });
      }
      
      // Проверяем статус контейнера
      const statusUrl = `https://graph.facebook.com/v18.0/${containerId}?fields=status_code,status,permalink&access_token=${instagramSettings.token}`;
      log(`[Test] Проверка статуса контейнера: ${containerId}`);
      
      const response = await axios.get(statusUrl);
      
      return res.json({
        success: true,
        status: response.data
      });
    } catch (error) {
      log(`[Test] Ошибка при проверке статуса: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data || error
      });
    }
  });

  log('Тестовые маршруты для Instagram успешно зарегистрированы');
}

/**
 * Получает настройки Instagram из кампании
 */
async function getInstagramSettings() {
  try {
    // Используем фиксированную кампанию для тестов
    const campaignId = '46868c44-c6a4-4bed-accf-9ad07bba790e';
    
    // Получаем токен администратора
    const adminResponse = await directusApi.post('/auth/login', {
      email: process.env.DIRECTUS_ADMIN_EMAIL,
      password: process.env.DIRECTUS_ADMIN_PASSWORD
    });
    
    if (!adminResponse.data || !adminResponse.data.data || !adminResponse.data.data.access_token) {
      log('[Test] Не удалось авторизоваться в Directus как администратор');
      return null;
    }
    
    const adminToken = adminResponse.data.data.access_token;
    
    // Получаем настройки кампании
    const campaignResponse = await directusApi.get(`/items/campaigns/${campaignId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    
    if (!campaignResponse.data || !campaignResponse.data.data) {
      log('[Test] Не удалось получить данные кампании');
      return null;
    }
    
    const campaign = campaignResponse.data.data;
    
    // Проверяем настройки Instagram
    if (!campaign.social_media_settings || !campaign.social_media_settings.instagram) {
      log('[Test] Отсутствуют настройки Instagram в кампании');
      return null;
    }
    
    const instagramSettings = campaign.social_media_settings.instagram;
    
    if (!instagramSettings.token || !instagramSettings.business_account_id) {
      log('[Test] Отсутствует токен или ID бизнес-аккаунта Instagram');
      return null;
    }
    
    return {
      token: instagramSettings.token,
      businessAccountId: instagramSettings.business_account_id
    };
  } catch (error) {
    log(`[Test] Ошибка при получении настроек Instagram: ${error.message}`);
    return null;
  }
}