/**
 * Публикация Instagram Stories
 * 
 * Этот скрипт выполняет публикацию контента в Instagram как Stories
 * с использованием встроенного API приложения
 * 
 * Запуск: node instagram-stories-publisher.js [CONTENT_ID]
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Загружаем переменные окружения из .env
dotenv.config();

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// ID контента (берем из аргументов или используем значение по умолчанию)
const CONTENT_ID = process.argv[2] || 'e8936ebf-75d3-4dd1-9f85-1970f186b219';

// URL API и настройки
const API_URL = process.env.API_URL || 'http://localhost:5000';
// Используем токен из .env (постоянный API ключ для Directus)
const ADMIN_TOKEN = "wj9Z9srRD0QVROTOC3BNSfY97yKKu-vF";

// Функция для вывода в консоль с цветом и меткой времени
function log(message, type = 'info') {
  const now = new Date().toLocaleTimeString();
  let prefix = '';
  let color = colors.blue;
  
  switch (type) {
    case 'error':
      prefix = 'ОШИБКА';
      color = colors.red;
      break;
    case 'success':
      prefix = 'УСПЕХ';
      color = colors.green;
      break;
    case 'warning':
      prefix = 'ВНИМАНИЕ';
      color = colors.yellow;
      break;
    case 'highlight':
      prefix = 'ВАЖНО';
      color = colors.magenta;
      break;
    case 'step':
      prefix = 'ШАГ';
      color = colors.cyan;
      break;
    default:
      prefix = 'ИНФО';
      break;
  }
  
  console.log(`${color}[${now}] [${prefix}] ${message}${colors.reset}`);
}

/**
 * Получает информацию о контенте
 * @param {string} contentId ID контента
 * @returns {Promise<Object>} Данные контента
 */
async function getContentInfo(contentId) {
  try {
    log(`Получение информации о контенте ${contentId}`, 'step');
    
    const headers = {
      'Authorization': `Bearer ${ADMIN_TOKEN}`
    };
    
    const response = await fetch(`${API_URL}/api/campaign-content/${contentId}`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка запроса: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.data) {
      throw new Error('Получен пустой ответ от API');
    }
    
    log(`Успешно получены данные контента: "${data.data.title}"`, 'success');
    return data.data;
  } catch (error) {
    log(`Не удалось получить информацию о контенте: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Анализирует контент на наличие медиафайлов
 * @param {Object} content Объект контента
 * @returns {Object} Объект с информацией о медиа
 */
function analyzeContentMedia(content) {
  log('Анализ медиаконтента для публикации в сторис', 'step');
  
  const mediaInfo = {
    hasImage: false,
    hasVideo: false,
    hasAdditionalImages: false,
    imageUrl: null,
    videoUrl: null,
    additionalImages: []
  };
  
  // Проверка основного изображения
  if (content.imageUrl) {
    mediaInfo.hasImage = true;
    mediaInfo.imageUrl = content.imageUrl;
    log(`Найдено основное изображение: ${content.imageUrl}`, 'success');
  }
  
  // Проверка основного видео
  if (content.videoUrl) {
    mediaInfo.hasVideo = true;
    mediaInfo.videoUrl = content.videoUrl;
    log(`Найдено основное видео: ${content.videoUrl}`, 'success');
  }
  
  // Проверка дополнительных изображений
  if (content.additionalImages) {
    try {
      let additionalImages = content.additionalImages;
      
      // Если это строка, пробуем распарсить JSON
      if (typeof additionalImages === 'string') {
        try {
          additionalImages = JSON.parse(additionalImages);
          log('Успешно распарсены дополнительные изображения из JSON', 'success');
        } catch (e) {
          log(`Не удалось распарсить дополнительные изображения как JSON: ${e.message}`, 'warning');
        }
      }
      
      // Если это массив, обрабатываем его
      if (Array.isArray(additionalImages) && additionalImages.length > 0) {
        additionalImages.forEach((img, index) => {
          let imgUrl = img;
          
          // Если это объект с полем url
          if (typeof img === 'object' && img !== null && img.url) {
            imgUrl = img.url;
          }
          
          if (typeof imgUrl === 'string') {
            mediaInfo.hasAdditionalImages = true;
            mediaInfo.additionalImages.push(imgUrl);
            log(`Найдено дополнительное изображение #${index+1}: ${imgUrl}`, 'success');
          }
        });
      }
    } catch (error) {
      log(`Ошибка при обработке дополнительных изображений: ${error.message}`, 'error');
    }
  }
  
  // Проверка полей, специфичных для stories
  const storyFields = [
    'storyMedia',
    'storyMediaFiles',
    'storiesMedia',
    'mediaFiles'
  ];
  
  for (const field of storyFields) {
    if (content[field]) {
      log(`Проверка поля ${field} для сторис...`, 'step');
      
      try {
        let mediaField = content[field];
        
        // Если это строка, пробуем распарсить JSON
        if (typeof mediaField === 'string') {
          try {
            mediaField = JSON.parse(mediaField);
            log(`Успешно распарсено поле ${field} из JSON`, 'success');
          } catch (e) {
            // Если это просто URL-строка
            if (mediaField.startsWith('http')) {
              const isVideo = mediaField.toLowerCase().endsWith('.mp4') || 
                             mediaField.toLowerCase().includes('video');
              
              if (isVideo) {
                mediaInfo.hasVideo = true;
                mediaInfo.videoUrl = mediaField;
                log(`Найдено видео в поле ${field}: ${mediaField}`, 'success');
              } else {
                mediaInfo.hasImage = true;
                mediaInfo.imageUrl = mediaField;
                log(`Найдено изображение в поле ${field}: ${mediaField}`, 'success');
              }
            } else {
              log(`Не удалось распарсить поле ${field} как JSON и это не URL`, 'warning');
            }
            continue;
          }
        }
        
        // Если это массив, обрабатываем первый элемент
        if (Array.isArray(mediaField) && mediaField.length > 0) {
          const firstItem = mediaField[0];
          
          // Если это строка (URL)
          if (typeof firstItem === 'string') {
            const isVideo = firstItem.toLowerCase().endsWith('.mp4') || 
                           firstItem.toLowerCase().includes('video');
            
            if (isVideo) {
              mediaInfo.hasVideo = true;
              mediaInfo.videoUrl = firstItem;
              log(`Найдено видео в ${field}[0]: ${firstItem}`, 'success');
            } else {
              mediaInfo.hasImage = true;
              mediaInfo.imageUrl = firstItem;
              log(`Найдено изображение в ${field}[0]: ${firstItem}`, 'success');
            }
          } 
          // Если это объект с полем url
          else if (typeof firstItem === 'object' && firstItem !== null && firstItem.url) {
            const isVideo = firstItem.url.toLowerCase().endsWith('.mp4') || 
                           firstItem.url.toLowerCase().includes('video');
            
            if (isVideo) {
              mediaInfo.hasVideo = true;
              mediaInfo.videoUrl = firstItem.url;
              log(`Найдено видео в ${field}[0].url: ${firstItem.url}`, 'success');
            } else {
              mediaInfo.hasImage = true;
              mediaInfo.imageUrl = firstItem.url;
              log(`Найдено изображение в ${field}[0].url: ${firstItem.url}`, 'success');
            }
          }
        }
        // Если это объект с полем url
        else if (typeof mediaField === 'object' && mediaField !== null && mediaField.url) {
          const isVideo = mediaField.url.toLowerCase().endsWith('.mp4') || 
                         mediaField.url.toLowerCase().includes('video');
          
          if (isVideo) {
            mediaInfo.hasVideo = true;
            mediaInfo.videoUrl = mediaField.url;
            log(`Найдено видео в ${field}.url: ${mediaField.url}`, 'success');
          } else {
            mediaInfo.hasImage = true;
            mediaInfo.imageUrl = mediaField.url;
            log(`Найдено изображение в ${field}.url: ${mediaField.url}`, 'success');
          }
        }
      } catch (error) {
        log(`Ошибка при обработке поля ${field}: ${error.message}`, 'error');
      }
    }
  }
  
  // Если не нашли ни видео, ни изображения, выводим предупреждение
  if (!mediaInfo.hasImage && !mediaInfo.hasVideo && !mediaInfo.hasAdditionalImages) {
    log('Не найдено медиа для публикации в сторис', 'warning');
  }
  
  return mediaInfo;
}

/**
 * Публикует Instagram Stories через API
 * @param {string} contentId ID контента
 * @param {Object} content Данные контента
 * @returns {Promise<Object>} Результат публикации
 */
async function publishInstagramStory(contentId, content) {
  try {
    log(`Публикация Instagram Stories для контента ${contentId}`, 'step');
    
    // Получаем campaignId из контента
    const campaignId = content.campaignId;
    
    if (!campaignId) {
      throw new Error('Не найден ID кампании (campaignId) для данного контента');
    }
    
    log(`Используем ID кампании: ${campaignId}`, 'info');
    
    // Формируем заголовки запроса с токеном авторизации
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`
    };
    
    // Отображаем частично токен для отладки (первые 10 символов)
    if (ADMIN_TOKEN) {
      const maskedToken = ADMIN_TOKEN.substring(0, 10) + '...';
      log(`Используем токен авторизации: ${maskedToken}`, 'info');
    } else {
      log('ВНИМАНИЕ: Токен авторизации не найден в переменных окружения', 'warning');
    }
    
    // Отправляем запрос на публикацию
    log(`Отправка запроса на ${API_URL}/api/publish/instagram/stories`, 'step');
    
    const response = await fetch(`${API_URL}/api/publish/instagram/stories`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        contentId: contentId,
        campaignId: campaignId
      })
    });
    
    const data = await response.json();
    
    // Анализируем результат
    if (response.ok && data.success) {
      log('Stories успешно опубликованы!', 'success');
      log(`Детали: ${JSON.stringify(data, null, 2)}`, 'success');
      return data;
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      log(`Ошибка при публикации: ${errorMessage}`, 'error');
      
      // Если ошибка связана с авторизацией, выводим дополнительную информацию
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('авторизац')) {
        log('Проблема с авторизацией. Проверьте токен в .env файле (DIRECTUS_ADMIN_TOKEN)', 'warning');
      }
      
      // Если ошибка связана с отсутствием медиа
      if (errorMessage.includes('изображение') || errorMessage.includes('видео') || errorMessage.includes('media')) {
        log('Проблема с медиаконтентом. Убедитесь, что контент содержит медиафайлы', 'warning');
      }
      
      throw new Error(errorMessage);
    }
  } catch (error) {
    log(`Критическая ошибка при публикации: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    console.log(`${colors.yellow}======================================================${colors.reset}`);
    console.log(`${colors.yellow}      ПУБЛИКАЦИЯ INSTAGRAM STORIES${colors.reset}`);
    console.log(`${colors.yellow}======================================================${colors.reset}`);
    
    log(`ID контента: ${CONTENT_ID}`, 'highlight');
    log(`API URL: ${API_URL}`, 'highlight');
    
    // Проверяем наличие токена
    if (!ADMIN_TOKEN) {
      log('ДИРЕКТИВНЫЙ ТОКЕН НЕ НАЙДЕН В .ENV ФАЙЛЕ!', 'error');
      log('Добавьте DIRECTUS_ADMIN_TOKEN в .env файл и повторите попытку', 'error');
      return;
    }
    
    // Шаг 1: Получаем информацию о контенте
    const content = await getContentInfo(CONTENT_ID);
    
    // Проверяем наличие campaignId
    if (!content.campaignId) {
      log('ОШИБКА: у контента отсутствует campaignId!', 'error');
      log('Необходимо, чтобы контент был привязан к кампании', 'error');
      return;
    }
    
    log(`Кампания контента (campaignId): ${content.campaignId}`, 'success');
    
    // Шаг 2: Анализируем медиа в контенте
    const mediaInfo = analyzeContentMedia(content);
    
    // Шаг 3: Показываем сводку о контенте
    console.log(`${colors.yellow}------------------------------------------------------${colors.reset}`);
    console.log(`${colors.cyan}СВОДКА О КОНТЕНТЕ:${colors.reset}`);
    console.log(`${colors.cyan}Заголовок:${colors.reset} ${content.title || 'Не указан'}`);
    console.log(`${colors.cyan}Тип контента:${colors.reset} ${content.contentType || 'Не указан'}`);
    console.log(`${colors.cyan}ID кампании:${colors.reset} ${content.campaignId || 'Не указан'}`);
    console.log(`${colors.cyan}Наличие основного изображения:${colors.reset} ${mediaInfo.hasImage ? 'Да' : 'Нет'}`);
    console.log(`${colors.cyan}Наличие основного видео:${colors.reset} ${mediaInfo.hasVideo ? 'Да' : 'Нет'}`);
    console.log(`${colors.cyan}Наличие дополнительных изображений:${colors.reset} ${mediaInfo.hasAdditionalImages ? 'Да' : 'Нет'}`);
    console.log(`${colors.yellow}------------------------------------------------------${colors.reset}`);
    
    // Шаг 4: Публикуем сторис
    log('Начинаем публикацию Instagram Stories...', 'highlight');
    const result = await publishInstagramStory(CONTENT_ID, content);
    
    // Шаг 5: Выводим результат
    console.log(`${colors.yellow}======================================================${colors.reset}`);
    console.log(`${colors.green}ПУБЛИКАЦИЯ ЗАВЕРШЕНА${colors.reset}`);
    
    // Сохраняем результат в файл для отладки
    const logFilename = `instagram_stories_${CONTENT_ID}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(logFilename, JSON.stringify({
      content: {
        id: content.id,
        title: content.title,
        contentType: content.contentType,
        campaignId: content.campaignId
      },
      mediaInfo: mediaInfo,
      result: result
    }, null, 2));
    
    log(`Результаты сохранены в файл: ${logFilename}`, 'success');
    console.log(`${colors.yellow}======================================================${colors.reset}`);
    
  } catch (error) {
    console.log(`${colors.red}======================================================${colors.reset}`);
    console.log(`${colors.red}КРИТИЧЕСКАЯ ОШИБКА: ${error.message}${colors.reset}`);
    console.log(`${colors.red}======================================================${colors.reset}`);
    process.exit(1);
  }
}

// Запускаем основную функцию
main();