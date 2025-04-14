import { Router } from "express";
import fs from 'fs';
import axios from 'axios';

/**
 * Логирование с поддержкой записи в файл и на консоль
 * @param {string} message Сообщение для логирования
 * @param {string} source Источник сообщения для категоризации
 */
function log(message: string, source: string = 'instagram-status') {
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

/**
 * Маршрут для проверки статуса контейнера в Instagram
 */
router.get('/check-status', async (req, res) => {
  try {
    const { containerId, token } = req.query;
    
    if (!containerId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать containerId и token'
      });
    }
    
    log(`Проверка статуса контейнера ${containerId}`);
    
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

/**
 * Маршрут для публикации медиа после проверки статуса
 */
router.post('/publish-media', async (req, res) => {
  try {
    const { containerId, token, businessAccountId } = req.body;
    
    if (!containerId || !token || !businessAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать containerId, token и businessAccountId'
      });
    }
    
    log(`Попытка публикации медиа с контейнером ${containerId}`);
    
    // URL для публикации
    const publishUrl = `https://graph.facebook.com/v17.0/${businessAccountId}/media_publish`;
    const publishParams = {
      access_token: token,
      creation_id: containerId
    };
    
    // Логируем параметры запроса
    fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] ПУБЛИКАЦИЯ КОНТЕЙНЕРА ${containerId}\n`);
    
    // Отправляем запрос на публикацию
    const publishResponse = await axios.post(publishUrl, publishParams, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    // Логируем ответ
    fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] РЕЗУЛЬТАТ ПУБЛИКАЦИИ: ${JSON.stringify(publishResponse.data)}\n`);
    
    // Проверяем успешность публикации
    if (publishResponse.data && publishResponse.data.id) {
      const postId = publishResponse.data.id;
      return res.json({
        success: true,
        message: 'Публикация успешно создана',
        postId,
        postUrl: `https://www.instagram.com/p/${postId}/`
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Ответ получен, но ID публикации отсутствует'
      });
    }
  } catch (error) {
    // Логируем ошибку
    const errorMessage = error.response?.data?.error?.message || error.message;
    const errorCode = error.response?.data?.error?.code || 'unknown';
    
    fs.appendFileSync('logs/instagram.log', `[${new Date().toISOString()}] ОШИБКА ПУБЛИКАЦИИ: ${errorMessage} (код: ${errorCode})\n`);
    
    // Проверяем специальные ошибки
    const isProcessingError = 
      errorCode === 9007 || // "Media ID is not available"
      (errorMessage || '').includes('не готов') ||
      (errorMessage || '').includes('not ready') ||
      (errorMessage || '').includes('обрабатывает') ||
      (errorMessage || '').includes('processing') ||
      (errorMessage || '').includes('wait');
    
    if (isProcessingError) {
      return res.status(202).json({ // 202 Accepted - запрос принят, но обработка не завершена
        success: false,
        error: 'Видео все еще обрабатывается Instagram. Попробуйте проверить статус позже.',
        isProcessingError: true,
        containerId
      });
    }
    
    return res.status(500).json({
      success: false,
      error: `Ошибка публикации: ${errorMessage} (код: ${errorCode})`
    });
  }
});

/**
 * Маршрут для отображения формы проверки статуса и публикации
 */
router.get('/status-checker', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Проверка статуса и публикация в Instagram</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #3b5998; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="text"] { width: 100%; padding: 8px; box-sizing: border-box; }
        button { background: #3b5998; color: white; border: none; padding: 10px 15px; cursor: pointer; margin-right: 10px; }
        .note { background: #f8f9fa; padding: 10px; border-left: 4px solid #3b5998; margin: 15px 0; }
        #result { margin-top: 20px; background: #f8f9fa; padding: 15px; white-space: pre-wrap; }
        .status-ready { color: green; font-weight: bold; }
        .status-pending { color: orange; font-weight: bold; }
        .status-error { color: red; font-weight: bold; }
        .button-container { margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Проверка статуса и публикация в Instagram</h1>
      <div class="note">
        <strong>Примечание:</strong> Этот инструмент позволяет проверить статус обработки видео в Instagram и опубликовать его, когда оно будет готово.
      </div>
      
      <form id="statusForm">
        <div class="form-group">
          <label for="token">Instagram Access Token:</label>
          <input type="text" id="token" name="token" placeholder="Токен доступа Instagram" required>
        </div>
        
        <div class="form-group">
          <label for="businessAccountId">Business Account ID:</label>
          <input type="text" id="businessAccountId" name="businessAccountId" placeholder="ID бизнес-аккаунта" required>
        </div>
        
        <div class="form-group">
          <label for="containerId">Container ID:</label>
          <input type="text" id="containerId" name="containerId" placeholder="ID контейнера медиа" required>
        </div>
        
        <div class="button-container">
          <button type="button" id="checkStatusBtn">Проверить статус</button>
          <button type="button" id="publishBtn" disabled>Опубликовать</button>
        </div>
      </form>
      
      <div id="result"></div>
      
      <script>
        // Элемент для вывода результатов
        const result = document.getElementById('result');
        
        // Кнопки
        const checkStatusBtn = document.getElementById('checkStatusBtn');
        const publishBtn = document.getElementById('publishBtn');
        
        // Проверка статуса
        checkStatusBtn.addEventListener('click', async function() {
          const token = document.getElementById('token').value;
          const containerId = document.getElementById('containerId').value;
          
          if (!token || !containerId) {
            result.innerHTML = 'Ошибка: необходимо указать token и containerId';
            return;
          }
          
          result.innerHTML = 'Проверка статуса...';
          
          try {
            const response = await fetch(\`/api/instagram-status/check-status?containerId=\${containerId}&token=\${token}\`);
            const data = await response.json();
            
            let statusHtml = '';
            if (data.success) {
              const statusClass = data.isReady ? 'status-ready' : 'status-pending';
              statusHtml = \`
                <h3>Статус контейнера:</h3>
                <p><strong>ID контейнера:</strong> \${data.containerId}</p>
                <p><strong>Статус:</strong> <span class="\${statusClass}">\${data.status}</span></p>
                <p><strong>Сообщение:</strong> \${data.statusMessage || 'Нет сообщения'}</p>
                <p><strong>Готовность:</strong> <span class="\${statusClass}">\${data.isReady ? 'ГОТОВ' : 'НЕ ГОТОВ'}</span></p>
                <p><strong>Системное сообщение:</strong> \${data.message}</p>
              \`;
              
              // Если контейнер готов, разблокируем кнопку публикации
              publishBtn.disabled = !data.isReady;
            } else {
              statusHtml = \`
                <h3>Ошибка проверки статуса:</h3>
                <p class="status-error">\${data.error}</p>
              \`;
              publishBtn.disabled = true;
            }
            
            result.innerHTML = statusHtml;
          } catch (error) {
            result.innerHTML = \`Ошибка: \${error.message}\`;
            publishBtn.disabled = true;
          }
        });
        
        // Публикация медиа
        publishBtn.addEventListener('click', async function() {
          const token = document.getElementById('token').value;
          const businessAccountId = document.getElementById('businessAccountId').value;
          const containerId = document.getElementById('containerId').value;
          
          if (!token || !businessAccountId || !containerId) {
            result.innerHTML = 'Ошибка: необходимо указать все параметры';
            return;
          }
          
          result.innerHTML = 'Публикация...';
          
          try {
            const response = await fetch('/api/instagram-status/publish-media', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ token, businessAccountId, containerId })
            });
            
            const data = await response.json();
            
            if (data.success) {
              result.innerHTML = \`
                <h3 class="status-ready">Публикация успешна!</h3>
                <p><strong>ID публикации:</strong> \${data.postId}</p>
                <p><strong>URL публикации:</strong> <a href="\${data.postUrl}" target="_blank">\${data.postUrl}</a></p>
                <p><strong>Сообщение:</strong> \${data.message}</p>
              \`;
            } else {
              const statusClass = data.isProcessingError ? 'status-pending' : 'status-error';
              result.innerHTML = \`
                <h3 class="\${statusClass}">Публикация не удалась</h3>
                <p>\${data.error}</p>
              \`;
            }
          } catch (error) {
            result.innerHTML = \`Ошибка: \${error.message}\`;
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