/**
 * Тестовые маршруты для проверки отправки видео в Telegram
 */

import { Router, Request, Response } from 'express';
import { log } from '../utils/logger';
import { storage } from '../storage';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { telegramServiceFix } from '../services/social/telegram-service-fix';
import { DirectusAuthManager } from '../directus-auth';

// Инициализируем роутер
export const telegramVideoRouter = Router();

// Константы из .env
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL || '';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD || '';

/**
 * Получает токен администратора через прямой запрос к API
 * @returns {Promise<string|null>} Токен администратора или null в случае ошибки
 */
async function getDirectAdminToken(): Promise<string | null> {
  try {
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      return response.data.data.access_token;
    }
    
    return null;
  } catch (error: any) {
    log(`Ошибка при получении admin токена: ${error.message}`, 'telegram-video-test');
    return null;
  }
}

/**
 * Проверка отправки видео в Telegram
 * POST /api/telegram-video/send-test
 */
telegramVideoRouter.post('/send-test', async (req: Request, res: Response) => {
  try {
    const { contentId, telegramToken, telegramChatId } = req.body;
    
    if (!contentId || !telegramToken || !telegramChatId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId, telegramToken и telegramChatId'
      });
    }
    
    // Получаем контент из базы данных
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // Проверяем наличие видео
    if (!content.videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'У контента отсутствует видео (поле videoUrl)'
      });
    }
    
    log(`Тестовая отправка видео в Telegram: ${content.videoUrl}`, 'telegram-video-test');
    
    // Используем исправленный сервис для отправки видео
    const result = await telegramServiceFix.publishToTelegram(
      content,
      { token: telegramToken, chatId: telegramChatId }
    );
    
    if (result.status === 'published') {
      return res.json({
        success: true,
        postUrl: result.postUrl,
        messageId: result.messageId,
        publishedAt: result.publishedAt
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Неизвестная ошибка при публикации'
      });
    }
  } catch (error: any) {
    log(`Ошибка при тестировании отправки видео: ${error.message}`, 'telegram-video-test');
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Отправка тестового видео напрямую из файла
 * POST /api/telegram-video/send-local-file
 */
telegramVideoRouter.post('/send-local-file', async (req: Request, res: Response) => {
  try {
    const { telegramToken, telegramChatId, videoPath, caption } = req.body;
    
    if (!telegramToken || !telegramChatId || !videoPath) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать telegramToken, telegramChatId и videoPath'
      });
    }
    
    log(`Отправка локального файла в Telegram: ${videoPath}`, 'telegram-video-test');
    
    // Проверяем существование файла
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        success: false,
        error: `Файл не найден: ${videoPath}`
      });
    }
    
    // Читаем файл
    const videoBuffer = fs.readFileSync(videoPath);
    const fileName = path.basename(videoPath);
    
    // Подготавливаем FormData
    const formData = new FormData();
    formData.append('chat_id', telegramChatId);
    formData.append('caption', caption || 'Тестовое видео');
    formData.append('parse_mode', 'HTML');
    formData.append('video', videoBuffer, { filename: fileName });
    
    // Отправляем запрос
    const response = await axios.post(
      `https://api.telegram.org/bot${telegramToken}/sendVideo`,
      formData,
      {
        headers: {
          ...formData.getHeaders()
        }
      }
    );
    
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      
      // Форматируем URL публикации
      let postUrl;
      if (telegramChatId.startsWith('@')) {
        // Для публичных каналов и групп с username
        const username = telegramChatId.substring(1);
        postUrl = `https://t.me/${username}/${messageId}`;
      } else if (telegramChatId.startsWith('-100')) {
        // Для приватных каналов и супергрупп
        const channelId = telegramChatId.substring(4);
        postUrl = `https://t.me/c/${channelId}/${messageId}`;
      } else if (telegramChatId.startsWith('-')) {
        // Для групп
        const groupId = telegramChatId.substring(1);
        postUrl = `https://t.me/c/${groupId}/${messageId}`;
      } else {
        // Для персональных чатов
        postUrl = `https://t.me/c/${telegramChatId}/${messageId}`;
      }
      
      return res.json({
        success: true,
        messageId,
        postUrl,
        response: response.data
      });
    } else {
      return res.status(500).json({
        success: false,
        error: response.data
      });
    }
  } catch (error: any) {
    log(`Ошибка при отправке локального файла: ${error.message}`, 'telegram-video-test');
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Получение информации о чате Telegram
 * POST /api/telegram-video/check-chat
 */
telegramVideoRouter.post('/check-chat', async (req: Request, res: Response) => {
  try {
    const { telegramToken, telegramChatId } = req.body;
    
    if (!telegramToken || !telegramChatId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать telegramToken и telegramChatId'
      });
    }
    
    log(`Проверка чата Telegram: ${telegramChatId}`, 'telegram-video-test');
    
    // Отправляем запрос на получение информации о чате
    const response = await axios.get(
      `https://api.telegram.org/bot${telegramToken}/getChat`,
      {
        params: {
          chat_id: telegramChatId
        }
      }
    );
    
    if (response.data && response.data.ok) {
      const chatInfo = response.data.result;
      
      return res.json({
        success: true,
        chatInfo
      });
    } else {
      return res.status(500).json({
        success: false,
        error: response.data
      });
    }
  } catch (error: any) {
    log(`Ошибка при проверке чата: ${error.message}`, 'telegram-video-test');
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Неизвестная ошибка'
    });
  }
});

/**
 * Создание тестовой страницы для проверки видео
 * GET /api/telegram-video/test-ui
 */
telegramVideoRouter.get('/test-ui', (req: Request, res: Response) => {
  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Тест отправки видео в Telegram</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 {
          color: #2c3e50;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        form {
          background: #f9f9f9;
          border: 1px solid #ddd;
          padding: 20px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        input, textarea {
          width: 100%;
          padding: 8px;
          margin-bottom: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        button {
          background: #3498db;
          color: white;
          border: none;
          padding: 10px 15px;
          cursor: pointer;
          border-radius: 4px;
        }
        button:hover {
          background: #2980b9;
        }
        pre {
          background: #2c3e50;
          color: #ecf0f1;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
          white-space: pre-wrap;
        }
        .error {
          color: #e74c3c;
        }
        .success {
          color: #27ae60;
        }
      </style>
    </head>
    <body>
      <h1>Тест отправки видео в Telegram</h1>
      
      <h2>Проверка чата</h2>
      <form id="chatForm">
        <label for="tgToken">Токен бота:</label>
        <input type="text" id="tgToken" name="telegramToken" required>
        
        <label for="tgChatId">ID чата:</label>
        <input type="text" id="tgChatId" name="telegramChatId" required>
        
        <button type="submit">Проверить чат</button>
      </form>
      
      <h2>Отправка по ID контента</h2>
      <form id="contentForm">
        <label for="contentId">ID контента:</label>
        <input type="text" id="contentId" name="contentId" required>
        
        <label for="tgToken2">Токен бота:</label>
        <input type="text" id="tgToken2" name="telegramToken" required>
        
        <label for="tgChatId2">ID чата:</label>
        <input type="text" id="tgChatId2" name="telegramChatId" required>
        
        <button type="submit">Отправить видео из контента</button>
      </form>
      
      <h2>Отправка локального файла</h2>
      <form id="fileForm">
        <label for="videoPath">Путь к файлу:</label>
        <input type="text" id="videoPath" name="videoPath" value="/uploads/videos/1744618438894-91400502-mov_bbb.mp4" required>
        
        <label for="caption">Подпись:</label>
        <textarea id="caption" name="caption" rows="3">Тестовое видео из локального файла</textarea>
        
        <label for="tgToken3">Токен бота:</label>
        <input type="text" id="tgToken3" name="telegramToken" required>
        
        <label for="tgChatId3">ID чата:</label>
        <input type="text" id="tgChatId3" name="telegramChatId" required>
        
        <button type="submit">Отправить локальный файл</button>
      </form>
      
      <h2>Результат</h2>
      <pre id="result">Запустите тест...</pre>
      
      <script>
        // Синхронизация токенов и ID чатов между формами
        document.getElementById('tgToken').addEventListener('input', (e) => {
          document.getElementById('tgToken2').value = e.target.value;
          document.getElementById('tgToken3').value = e.target.value;
        });
        
        document.getElementById('tgChatId').addEventListener('input', (e) => {
          document.getElementById('tgChatId2').value = e.target.value;
          document.getElementById('tgChatId3').value = e.target.value;
        });
        
        // Обработчик формы проверки чата
        document.getElementById('chatForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const resultElement = document.getElementById('result');
          resultElement.innerHTML = 'Отправка запроса...';
          
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          
          try {
            const response = await fetch('/api/telegram-video/check-chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              resultElement.innerHTML = '<span class="success">✅ Чат успешно проверен!</span>\\n' + 
                JSON.stringify(result, null, 2);
            } else {
              resultElement.innerHTML = '<span class="error">❌ Ошибка при проверке чата</span>\\n' + 
                JSON.stringify(result, null, 2);
            }
          } catch (error) {
            resultElement.innerHTML = '<span class="error">❌ Ошибка при отправке запроса</span>\\n' + 
              error.message;
          }
        });
        
        // Обработчик формы отправки по ID контента
        document.getElementById('contentForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const resultElement = document.getElementById('result');
          resultElement.innerHTML = 'Отправка запроса...';
          
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          
          try {
            const response = await fetch('/api/telegram-video/send-test', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              resultElement.innerHTML = '<span class="success">✅ Видео успешно отправлено!</span>\\n' + 
                JSON.stringify(result, null, 2);
              
              if (result.postUrl) {
                resultElement.innerHTML += '\\n\\n<a href="' + result.postUrl + '" target="_blank">Открыть публикацию</a>';
              }
            } else {
              resultElement.innerHTML = '<span class="error">❌ Ошибка при отправке видео</span>\\n' + 
                JSON.stringify(result, null, 2);
            }
          } catch (error) {
            resultElement.innerHTML = '<span class="error">❌ Ошибка при отправке запроса</span>\\n' + 
              error.message;
          }
        });
        
        // Обработчик формы отправки локального файла
        document.getElementById('fileForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const resultElement = document.getElementById('result');
          resultElement.innerHTML = 'Отправка запроса...';
          
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          
          try {
            const response = await fetch('/api/telegram-video/send-local-file', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              resultElement.innerHTML = '<span class="success">✅ Файл успешно отправлен!</span>\\n' + 
                JSON.stringify(result, null, 2);
              
              if (result.postUrl) {
                resultElement.innerHTML += '\\n\\n<a href="' + result.postUrl + '" target="_blank">Открыть публикацию</a>';
              }
            } else {
              resultElement.innerHTML = '<span class="error">❌ Ошибка при отправке файла</span>\\n' + 
                JSON.stringify(result, null, 2);
            }
          } catch (error) {
            resultElement.innerHTML = '<span class="error">❌ Ошибка при отправке запроса</span>\\n' + 
              error.message;
          }
        });
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});