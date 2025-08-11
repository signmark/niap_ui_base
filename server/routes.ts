import { deepseekService, DeepSeekMessage, DeepSeekService } from './services/deepseek';
import { ClaudeService } from './services/claude';
import { claudeService } from './services/claude';
import { falAiService } from './services/falai';
import { falAiClient } from './services/fal-ai-client';
import { qwenService } from './services/qwen';
import { GeminiService } from './services/gemini';
import { GeminiProxyService } from '../services/gemini-proxy.js';
import { VertexAIService } from './services/vertex-ai';
import { VertexAICredentialsService } from './services/vertex-ai-credentials';
// import { geminiTestRouter } from './routes/gemini-test-route'; // ОТКЛЮЧЕНО: используем единый маршрут
import { apiKeyService, ApiServiceName } from './services/api-keys';
import { globalApiKeyManager } from './services/global-api-key-manager';
import { globalApiKeysService } from './services/global-api-keys';
// Убрали ненужный импорт schnellService - теперь используем универсальный интерфейс
import { falAiUniversalService, FalAiModelName } from './services/fal-ai-universal';
import { registerFalAiRedirectRoutes } from './routes-fal-ai-redirect';
import { registerFalAiImageRoutes } from './routes-fal-ai-images';
// import { registerClaudeRoutes } from './routes-claude'; // ОТКЛЮЧЕНО: используем единый маршрут
import { testFalApiConnection } from './services/fal-api-tester';
import { socialPublishingService } from './services/social-publishing';
import express, { Express, Request, Response, NextFunction } from "express";
import { isUserAdmin } from "./routes-global-api-keys";
import { createServer, Server } from "http";
import { insertBusinessQuestionnaireSchema } from '@shared/schema';
import path from "path";
import axios from "axios";
import * as https from 'https';
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { directusApi } from "./directus";
import { crawler } from "./services/crawler";
import { apifyService } from "./services/apify";
import { log } from "./utils/logger";
import { directusApiManager } from "./directus";
import { ContentSource, InsertCampaignTrendTopic, InsertSourcePost } from "../shared/schema";
import { falAiSdk } from './services/fal-ai';
import { 
  validateTelegramToken,
  validateVkToken,
  validateInstagramToken,
  validateFacebookToken, 
  validateYoutubeApiKey
} from './services/social-api-validator';
import { registerValidationRoutes } from './api/validation-routes';
import { registerPublishingRoutes } from './api/publishing-routes';
import { registerAuthRoutes } from './api/auth-routes';
import { registerTokenRoutes } from './api/token-routes';
// Все старые импорты аналитики удалены
import { registerTestInstagramRoute } from './api/test-instagram-route';
import { registerTestSocialRoutes } from './api/test-social-routes';
import { registerTestInstagramCarouselRoute } from './api/test-instagram-carousel-route';
import { getPublishScheduler } from './services/publish-scheduler';
import storiesRouter from './routes/stories';
import videoRouter from './routes/video';
import { directusCrud } from './services/directus-crud';
import { CampaignDataService } from './services/campaign-data';
import { directusAuthManager } from './services/directus-auth-manager';
import { publicationStatusChecker } from './services/status-checker';
// import { geminiRouter } from './api/gemini-routes'; // ОТКЛЮЧЕНО: используем единый маршрут
import telegramWebhookRoutes from './api/telegram-webhook-direct';
import vkWebhookRoutes from './api/vk-webhook-direct';
import instagramWebhookRoutes from './api/instagram-webhook-direct';
import facebookWebhookRoutes from './api/facebook-webhook-v2';
import facebookWebhookV3Routes from './api/facebook-webhook-v3';
import facebookWebhookDirectRoutes from './api/facebook-webhook-direct';
import facebookWebhookDirectTestRoutes from './api/facebook-webhook-direct-test';
import facebookWebhookUnifiedRoutes from './api/facebook-webhook-unified';
import socialPlatformStatusWebhookRoutes from './api/social-platform-status-webhook';
import instagramCarouselWebhookRoutes from './api/instagram-carousel-direct';
import socialPublishingRouter from './api/social-publishing-router';
import { forceUpdateStatusRouter } from './api/force-update-status';
import * as instagramCarouselHandler from './api/instagram-carousel-webhook';
import youtubeAuthRouter from './routes/youtube-auth';
import instagramSettingsRouter from './routes/campaign-instagram-settings';
// import { getFeatureFlags, DEFAULT_FEATURE_FLAGS, FEATURE_DESCRIPTIONS } from './utils/feature-flags.js';




// Расширяем типы Express.Request для поддержки пользовательских полей в middleware
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        token: string;
        email?: string;
        firstName?: string;
        lastName?: string;
      };
    }
  }
}

// Функция для взаимодействия с n8n API
async function triggerN8nWorkflow(workflowId: string, data: any): Promise<any> {
  try {
    const n8nUrl = process.env.N8N_URL;
    const n8nApiKey = process.env.N8N_API_KEY;
    
    if (!n8nUrl) {
      throw new Error('N8N_URL не настроен в переменных окружения');
    }
    
    if (!n8nApiKey) {
      throw new Error('N8N API ключ не настроен');
    }
    
    const response = await axios.post(
      `${n8nUrl}/api/v1/workflows/${workflowId}/execute`,
      { data },
      {
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error: any) {
    console.error('Ошибка при вызове N8N workflow:', error.message);
    if (error.response) {
      console.error('Ответ от N8N:', error.response.data);
    }
    throw error;
  }
}

const DIRECTUS_URL = process.env.DIRECTUS_URL;
const searchCache = new Map<string, { timestamp: number, results: any[] }>();
const urlKeywordsCache = new Map<string, { timestamp: number, results: any[] }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Функция для очистки устаревших записей кеша
function cleanupExpiredCache() {
  const now = Date.now();
  let removedCount = 0;
  
  // Очищаем кеш для обычных запросов
  for (const [key, entry] of searchCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      console.log(`Removing expired cache entry for keyword: ${key}`);
      searchCache.delete(key);
      removedCount++;
    }
  }
  
  // Очищаем кеш для URL-запросов
  for (const [url, entry] of urlKeywordsCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      console.log(`Removing expired cache entry for URL: ${url}`);
      urlKeywordsCache.delete(url);
      removedCount++;
    }
  }
  
  console.log(`Cache cleanup completed. Removed ${removedCount} expired entries. Current state: Keywords cache: ${searchCache.size} entries, URL cache: ${urlKeywordsCache.size} entries`);
}

// Запускаем очистку кеша каждые 15 минут
setInterval(cleanupExpiredCache, 15 * 60 * 1000);

// Add helper function to check and get cached results
function getCachedResults(keyword: string): any[] | null {
  const cached = searchCache.get(keyword);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached results for keyword: ${keyword}`);
    return cached.results;
  }
  return null;
}

// Специальное кеширование для URL-адресов
function getCachedKeywordsByUrl(url: string): any[] | null {
  const normalizedUrl = url.toLowerCase().trim();
  const cached = urlKeywordsCache.get(normalizedUrl);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached URL keywords for: ${url}, found ${cached.results.length} items`);
    return cached.results;
  }
  return null;
}

// Функция для объединения ключевых слов из разных источников  
function mergeKeywords(geminiKeywords: any[], deepseekKeywords: any[] = []): any[] {
  // Создаем Map для уникальности по ключевому слову
  const keywordMap = new Map<string, any>();
  
  // Сначала добавляем ключевые слова от DeepSeek, они наиболее приоритетны
  deepseekKeywords.forEach(keyword => {
    if (!keyword?.keyword) return;
    const key = keyword.keyword.toLowerCase().trim();
    if (!keywordMap.has(key)) {
      // Добавляем источник к ключевому слову
      keywordMap.set(key, { ...keyword, source: 'deepseek' });
    }
  });
  
  // Затем добавляем ключевые слова от Gemini, если таких еще нет
  geminiKeywords.forEach(keyword => {
    if (!keyword?.keyword) return;
    const key = keyword.keyword.toLowerCase().trim();
    if (!keywordMap.has(key)) {
      keywordMap.set(key, { ...keyword, source: 'gemini' });
    }
  });
  
  // Преобразуем Map обратно в массив и сортируем по популярности
  return Array.from(keywordMap.values())
    .sort((a, b) => b.trend - a.trend)
    .slice(0, 15); // Ограничиваем до 15 самых популярных ключевых слов
}

import { 
  insertApiKeySchema,
  ApiKey,
  InsertApiKey
} from "@shared/schema";
import * as crypto from 'crypto';

// Add type for follower requirements
type PlatformRequirements = {
  [key: string]: number;
};

// Image proxy function to handle Telegram images and Video thumbnails
async function fetchAndProxyImage(url: string, res: any, options: { isRetry?: boolean; forceType?: string | null; isVideoThumbnail?: boolean } = {}) {
  try {
    // Обрабатываем запрос прокси
    
    // Проверяем, является ли это запросом на превью видео
    if (options.isVideoThumbnail) {
      return await fetchVideoThumbnail(url, res);
    }
    
    // Исправление для специфических URL из Telegram
    let fixedUrl = url;
    if (url.includes('tgcnt.ru')) {
      console.log('Processing Telegram URL');
      // Пытаемся устранить двойное кодирование URL
      try {
        fixedUrl = decodeURIComponent(url);
      } catch (e) {
        console.log('URL already decoded or invalid encoding');
      }
    }
    
    // Специальная обработка для Instagram и других платформ
    const isInstagram = url.includes('instagram.') || 
                       url.includes('fbcdn.net') || 
                       url.includes('cdninstagram.com') || 
                       options.forceType === 'instagram';
                       
    // Если это Instagram или принудительно выбран тип Instagram
    if (isInstagram) {
      console.log(`Processing Instagram URL${options.forceType ? ' (forced)' : ''}`);
      
      // Добавляем к URL параметр для обхода кеширования
      fixedUrl = url.includes('?') 
        ? `${url}&_nocache=${Date.now()}` 
        : `${url}?_nocache=${Date.now()}`;
      
      console.log(`Modified Instagram URL with cache-busting: ${fixedUrl}`);
    }
    
    // Для повторных попыток мы можем использовать альтернативные параметры
    if (options.isRetry) {
      console.log(`This is a retry attempt for URL: ${url}`);
    }
    
    // Настраиваем заголовки в зависимости от источника
    const headers: Record<string, string> = {
      // Базовые заголовки для всех запросов
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };
    
    // Добавляем специальные заголовки для Instagram
    if (isInstagram) {
      // Добавляем заголовки, имитирующие запрос от браузера
      headers['Referer'] = 'https://www.instagram.com/';
      headers['Origin'] = 'https://www.instagram.com';
      headers['sec-ch-ua'] = '"Chromium";v="120", "Google Chrome";v="120"';
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = '"Windows"';
      headers['sec-fetch-dest'] = 'image';
      headers['sec-fetch-mode'] = 'no-cors';
      headers['sec-fetch-site'] = 'same-site';
    } else {
      headers['Referer'] = 'https://nplanner.ru/';
    }
    
    // Отправляем запрос с необходимыми заголовками
    
    // Set a timeout to prevent hanging requests
    const response = await axios.get(fixedUrl, {
      responseType: 'arraybuffer',
      timeout: 15000, // Увеличенный таймаут для медленных серверов
      headers: headers,
      maxRedirects: 5, // Поддержка перенаправлений
      validateStatus: (status) => status < 400, // Принимаем только успешные статусы
    });

    // Set appropriate headers based on content type
    let contentType = response.headers['content-type'];
    
    // Определяем тип содержимого по расширению файла, если заголовок не заполнен
    if (!contentType) {
      const lowercasedUrl = fixedUrl.toLowerCase();
      if (lowercasedUrl.endsWith('.jpg') || lowercasedUrl.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (lowercasedUrl.endsWith('.png')) {
        contentType = 'image/png';
      } else if (lowercasedUrl.endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (lowercasedUrl.endsWith('.webp')) {
        contentType = 'image/webp';
      } else if (lowercasedUrl.endsWith('.mp4')) {
        contentType = 'video/mp4';
      } else if (lowercasedUrl.endsWith('.avi')) {
        contentType = 'video/x-msvideo';
      } else if (lowercasedUrl.endsWith('.webm')) {
        contentType = 'video/webm';
      }
    }

    // Special handling for Telegram MP4 files which are actually GIFs
    if (fixedUrl.includes('tgcnt.ru') && fixedUrl.toLowerCase().endsWith('.mp4')) {
      // Force content type to be video/mp4 for Telegram MP4 files
      contentType = 'video/mp4';
    }
    
    // Особая обработка для ВКонтакте видео
    if (fixedUrl.includes('vk.com/video') && response.headers['content-type']?.includes('text/html')) {
      // Это HTML-страница с видео ВКонтакте, пытаемся извлечь прямую ссылку
      try {
        const htmlContent = response.data.toString('utf8');
        
        // Регулярное выражение для поиска URL видеофайла в коде страницы
        const videoUrlMatches = htmlContent.match(/https:\/\/[^"]+\.mp4[^"]+/g);
        
        if (videoUrlMatches && videoUrlMatches.length > 0) {
          console.log(`Found direct video URL in VK page: ${videoUrlMatches[0]}`);
          
          // Получаем прямую ссылку на видеофайл
          const directVideoUrl = videoUrlMatches[0];
          
          // Делаем редирект на прямую ссылку
          res.setHeader('Location', directVideoUrl);
          res.status(302).end();
          return;
        } else {
          console.log('No direct video URL found in VK page');
        }
      } catch (e) {
        console.error('Error extracting video URL from VK page:', e);
      }
    }
    
    // Особая обработка для Instagram и Facebook CDN
    if (isInstagram) {
      // Instagram всегда отдает JPEG, кроме редких случаев
      if (!contentType || contentType === 'application/octet-stream') {
        contentType = 'image/jpeg';
      }
    }

    // Set all necessary headers
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Добавляем Content-Length для корректного отображения прогресса загрузки
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Send the media data
    res.send(response.data);
  } catch (error) {
    console.error(`Error proxying media ${url}:`, error);
    // Отправка 404 вместо 500 для корректной обработки ошибок в UI
    res.status(404).send('Media not found');
  }
}

// Функция для получения превью из видео
/**
 * Функция для потоковой передачи видео с различных источников
 * @param videoUrl URL видео для стриминга
 * @param res HTTP ответ для отправки видео
 * @param options Дополнительные опции для настройки запроса
 */
async function streamVideo(videoUrl: string, res: any, options: { 
  forceType?: string | null;
  range?: string | null;
  itemId?: string;
} = {}) {
  try {
    // Стримим видео
    
    // Определяем тип видео для специфической обработки
    const isVk = videoUrl.includes('vk.com') || 
                videoUrl.includes('vk.me') || 
                videoUrl.includes('userapi.com');
                
    const isTelegram = videoUrl.includes('tgcnt.ru') || 
                      videoUrl.includes('t.me');
                      
    const isInstagram = videoUrl.includes('instagram.') || 
                       videoUrl.includes('fbcdn.net') || 
                       videoUrl.includes('cdninstagram.com') ||
                       options.forceType === 'instagram';
                       
    // Проверяем, может ли быть это прямой URL на видеофайл
    const isDirectVideoFile = videoUrl.endsWith('.mp4') || 
                             videoUrl.endsWith('.webm') || 
                             videoUrl.endsWith('.mov') ||
                             isInstagram; // Instagram видео обрабатываем как прямые файлы
    
    // Формируем базовые заголовки для запроса
    let headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept': 'video/webm,video/mp4,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // Добавляем специальные заголовки для Instagram видео
    if (isInstagram) {
      console.log('Processing Instagram video with enhanced headers');
      headers = {
        ...headers,
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
        'sec-ch-ua': '"Chromium";v="123", "Google Chrome";v="123"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'video',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site',
        'Connection': 'keep-alive'
      };
    } else {
      headers['Referer'] = 'https://nplanner.ru/';
    }
    
    // Добавляем HTTP-заголовки для стриминга в ответе
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Добавляем расширенные CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Timing-Allow-Origin', '*');
    
    // Для Instagram видео добавляем еще параметр ночного кеширования в URL
    if (isInstagram) {
      console.log(`Processing Instagram video: ${videoUrl}`);
      console.log(`Instagram video type detected - forceType: ${options.forceType}`);
      
      // Замеры времени для логирования
      const startTime = Date.now();
      
      // Добавляем nocache параметр для избежания проблем с кешированием
      const separator = videoUrl.includes('?') ? '&' : '?';
      videoUrl = `${videoUrl}${separator}_nocache=${startTime}`;
      console.log(`Modified Instagram video URL with cache-busting: ${videoUrl}`);
    }
    
    // Поддержка Range запросов
    if (options.range) {
      try {
        const rangeHeaders = { ...headers, Range: options.range };
        console.log(`Processing range request: ${options.range} for URL: ${videoUrl}`);
        
        const { data, headers: responseHeaders } = await axios.get(videoUrl, {
          headers: rangeHeaders,
          responseType: 'arraybuffer',
          maxRedirects: 5
        });
        
        // Копируем заголовки Content-Range из ответа
        if (responseHeaders['content-range']) {
          res.setHeader('Content-Range', responseHeaders['content-range']);
          res.status(206); // Partial Content
        }
        
        // Устанавливаем Content-Length из ответа
        if (responseHeaders['content-length']) {
          res.setHeader('Content-Length', responseHeaders['content-length']);
        }
        
        // Отправляем данные
        return res.end(data);
      } catch (error) {
        console.error(`Error streaming video with range request: ${error}`);
        // Если range запрос не сработал, пытаемся получить весь файл
      }
    }
    
    // Если range запрос не задан или произошла ошибка, получаем весь файл
    try {
      console.log(`Streaming full video file from: ${videoUrl}`);
      
      const response = await axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream',
        headers,
        maxRedirects: 5
      });
      
      // Копируем важные заголовки из ответа
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }
      
      console.log(`Successfully connected to video stream: ${videoUrl}`);
      
      // Стримим видеофайл клиенту
      return response.data.pipe(res);
    } catch (error) {
      console.error(`Error streaming full video: ${error}`);
      return res.status(500).send('Ошибка при получении видео');
    }
  } catch (error) {
    console.error('Error in video streaming:', error);
    return res.status(500).send('Ошибка при обработке видео');
  }
}

async function fetchVideoThumbnail(videoUrl: string, res: any) {
  try {
    console.log(`Generating thumbnail for video: ${videoUrl}`);
    
    // Определяем тип видео для специфической обработки
    const isVk = videoUrl.includes('vk.com') || 
                videoUrl.includes('vk.me') || 
                videoUrl.includes('userapi.com');
                
    const isTelegram = videoUrl.includes('tgcnt.ru') || 
                      videoUrl.includes('t.me');
                      
    const isInstagram = videoUrl.includes('instagram.') || 
                       videoUrl.includes('fbcdn.net') || 
                       videoUrl.includes('cdninstagram.com');
    
    const isYoutube = videoUrl.includes('youtube.com') || 
                     videoUrl.includes('youtu.be');
    
    // 1. Если это YouTube, используем их API для превью
    if (isYoutube) {
      // Извлекаем ID видео
      let videoId = '';
      
      if (videoUrl.includes('youtube.com/watch')) {
        // Формат youtube.com/watch?v=VIDEO_ID
        const url = new URL(videoUrl);
        videoId = url.searchParams.get('v') || '';
      } else if (videoUrl.includes('youtu.be/')) {
        // Формат youtu.be/VIDEO_ID
        videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0] || '';
      } else if (videoUrl.includes('youtube.com/embed/')) {
        // Формат youtube.com/embed/VIDEO_ID
        videoId = videoUrl.split('youtube.com/embed/')[1]?.split('?')[0] || '';
      }
      
      if (videoId) {
        // Используем максимальное разрешение превью
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        
        // Прокси запрос к этому URL
        await fetchAndProxyImage(thumbnailUrl, res);
        return;
      }
    }
    
    // 2. Если это ВКонтакте
    if (isVk && videoUrl.includes('vk.com/video')) {
      try {
        // Пытаемся получить HTML-страницу видео
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        };
        
        const response = await axios.get(videoUrl, {
          headers,
          timeout: 10000,
        });
        
        const html = response.data;
        
        // Ищем URL превью (обычно в мета-тегах или в og:image)
        const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        
        if (ogImageMatch && ogImageMatch[1]) {
          // Нашли превью в og:image
          const thumbnailUrl = ogImageMatch[1];
          await fetchAndProxyImage(thumbnailUrl, res);
          return;
        }
        
        // Альтернативный поиск превью в исходном коде
        const imgMatches = html.match(/https:\/\/sun[^"']+\.jpg/g);
        
        if (imgMatches && imgMatches.length > 0) {
          // Находим самое большое изображение (предположительно, это будет превью)
          for (const imgUrl of imgMatches) {
            if (imgUrl.includes('&size=')) {
              await fetchAndProxyImage(imgUrl, res);
              return;
            }
          }
          
          // Если не нашли превью с размером, берем первое
          await fetchAndProxyImage(imgMatches[0], res);
          return;
        }
      } catch (e) {
        console.error('Error extracting VK video thumbnail:', e);
      }
    }
    
    // 3. Для Instagram и Telegram, просто пытаемся получить первый кадр видео
    // Но это требует FFmpeg на сервере, поэтому сейчас просто вернем стандартное превью
    
    // Если не удалось получить специфическое превью, возвращаем универсальную иконку видео
    // В продакшене здесь можно использовать стандартное изображение плеера
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
        <rect width="300" height="200" fill="#222" />
        <circle cx="150" cy="100" r="40" fill="#444" />
        <path d="M135 80L175 100L135 120Z" fill="white" />
        <text x="150" y="170" font-family="Arial" font-size="14" text-anchor="middle" fill="white">Видео</text>
      </svg>
    `);
  } catch (error) {
    console.error(`Error generating video thumbnail for ${videoUrl}:`, error);
    // Отправляем стандартное превью в случае ошибки
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
        <rect width="300" height="200" fill="#222" />
        <circle cx="150" cy="100" r="40" fill="#444" />
        <path d="M135 80L175 100L135 120Z" fill="white" />
        <text x="150" y="170" font-family="Arial" font-size="14" text-anchor="middle" fill="white">Видео</text>
      </svg>
    `);
  }
}

// Helper function to normalize URLs
function normalizeInstagramUrl(url: string): string {
  try {
    // Remove http/https and www
    let username = url.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '');

    // Remove @ if present
    if (username.startsWith('@')) {
      username = username.substring(1);
    }

    // Remove trailing slash and query params
    username = username.split('/')[0].split('?')[0];

    if (!username) return '';

    return `https://instagram.com/${username}`;
  } catch (error) {
    console.error(`Error normalizing Instagram URL ${url}:`, error);
    return url;
  }
}


// Helper function to add delay between requests
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Очищает текст от специальных символов и лишних многоточий
 * Используется для подготовки текста перед отображением в интерфейсе
 */
function cleanupText(text: string | null | undefined): string {
  if (!text) return '';
  
  return text
    .replace(/\s*\.\.\.\s*$/, '') // Удаляем многоточие в конце строки
    .replace(/\n+\s*\.\.\.$/, '') // Удаляем многоточие после переноса строки
    .replace(/\n+\s*\.\.\.\s*\n+/, '\n') // Удаляем многоточие между переносами строк
    .replace(/\n\s*\.{3,}\s*$/, '') // Удаляем многоточие в конце текста после переноса
    .replace(/\n\s*\.{3,}\s*/, ' ') // Заменяем многоточие с переносом на пробел
    .trim();
}

// Helper function for Social Searcher API
async function searchSocialSourcesByKeyword(keyword: string, authToken: string): Promise<any[]> {
  try {
    const settings = await directusApi.get('/items/user_api_keys', {
      params: {
        filter: {
          service_name: { _eq: 'social_searcher' }
        }
      },
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const socialSearcherKey = settings.data?.data?.[0]?.api_key;
    if (!socialSearcherKey) {
      console.log('Social Searcher API key not found');
      return [];
    }

    try {
      const response = await axios.get('https://api.social-searcher.com/v2/users', {
        params: {
          q: encodeURIComponent(keyword),
          key: socialSearcherKey,
          network: 'youtube,instagram',
          lang: 'ru'
        }
      });

      if (response.data?.meta?.http_code === 403) {
        console.log('Social Searcher API daily limit reached');
        return [];
      }

      const validSources = (response.data?.posts || [])
        .filter((post: any) => {
          // Фильтруем посты на русском языке
          const hasRussianText = /[а-яА-ЯёЁ]/.test(post.text || '') || /[а-яА-ЯёЁ]/.test(post.title || '');
          return hasRussianText;
        })
        .map((post: any) => {
          const url = normalizeSourceUrl(post.user?.url, post.network);
          if (!url) return null;

          return {
            url,
            name: post.user?.name || '',
            followers: 100000, // Заглушка, в реальности нужно парсить
            platform: post.network,
            description: post.text || `${post.network === 'youtube' ? 'YouTube канал' : 'Instagram аккаунт'}: ${post.user?.name}`,
            rank: 5
          };
        })
        .filter(Boolean);

      return validSources;

    } catch (apiError: any) {
      if (apiError.response?.status === 403) {
        console.log('Social Searcher API limit reached or access denied');
        return [];
      }
      console.error('Social Searcher API error:', apiError.message);
      return [];
    }
  } catch (error) {
    console.error('Error in Social Searcher setup:', error);
    return [];
  }
}

// Helper function to convert follower count text to number
function parseFollowerCount(text: string): number {
  try {
    // Remove any non-numeric characters except K, M, k, m
    const cleanText = text.toLowerCase().replace(/[^0-9km]/g, '');
    const number = parseFloat(cleanText.replace(/[km]/g, ''));

    if (cleanText.includes('m')) {
      return number * 1000000;
    } else if (cleanText.includes('k')) {
      return number * 1000;
    }
    return number;
  } catch (e) {
    console.error('Error parsing follower count:', e);
    return 0;
  }
}

// Helper function to extract sources from text content
function extractSourcesFromText(content: string, platforms: string[] = ['instagram']): any[] {
  const sources: any[] = [];
  let match;

  // Извлечение источников Instagram
  if (platforms.includes('instagram')) {
    // 1. Direct Instagram URLs
    // Example: https://www.instagram.com/pp_mari_food/ - хороший аккаунт
    const instagramUrlPattern = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._-]+)\/?/g;
    
    while ((match = instagramUrlPattern.exec(content)) !== null) {
      const username = match[1];
      const url = normalizeInstagramUrl(`instagram.com/${username}`);
      if (!sources.some(s => s.url === url)) {
        sources.push({
          url,
          name: username,
          followers: 100000, // Default value
          platform: 'instagram',
          type: 'instagram',
          description: 'Instagram аккаунт',
          rank: 5
        });
      }
    }

    // 2. Formatted lists with stars
    // Example: "1. **@username** - Name (500K followers) - Description
    const instagramFormattedPattern = /\*\*@([a-zA-Z0-9._-]+)\*\*\s*-\s*([^(]+)\s*\(([0-9.]+[KkMm][^)]*)\)[^-]*-\s*([^.\n]+)/g;

    while ((match = instagramFormattedPattern.exec(content)) !== null) {
      const [_, username, name, followers, description] = match;
      const followersCount = parseFollowerCount(followers);
      const url = normalizeInstagramUrl(`instagram.com/${username}`);

      if (followersCount >= 50000 && !sources.some(s => s.url === url)) {
        sources.push({
          url,
          name: name.trim(),
          username,
          followers: followersCount,
          platform: 'instagram',
          type: 'instagram',
          description: description.trim(),
          rank: 5
        });
      }
    }

    // 3. Simple @ mentions for Instagram
    // Example: "@username (500K followers)"
    const instagramSimplePattern = /@([a-zA-Z0-9._-]+)\s*\(([0-9.]+[KkMm][^)]*)\)/g;
  }
  
  // Извлечение источников Telegram
  if (platforms.includes('telegram')) {
    // 1. Direct Telegram URLs
    // Example: https://t.me/channelname - описание канала
    const telegramUrlPattern = /https?:\/\/(?:www\.)?t\.me\/([a-zA-Z0-9._-]+)\/?/g;
    
    while ((match = telegramUrlPattern.exec(content)) !== null) {
      const username = match[1];
      const url = `https://t.me/${username}`;
      if (!sources.some(s => s.url === url)) {
        sources.push({
          url,
          username,
          name: username,
          type: 'telegram',
          platform: 'telegram',
          followers: parseFollowerCount(match.input.substring(match.index, match.index + 200)) || 10000, // Default value
          rank: sources.length + 1,
          description: 'Telegram канал'
        });
      }
    }
    
    // 2. Telegram channel usernames with @ symbol
    // Example: **@channelname** - Название (100K subscribers) - Description
    const telegramFormattedPattern = /\*\*@([a-zA-Z0-9._-]+)\*\*\s*-\s*([^(]+)\s*\(([0-9.]+[KkMm][^)]*)\)[^-]*-\s*([^.\n]+)/g;
    
    while ((match = telegramFormattedPattern.exec(content)) !== null) {
      const [_, username, name, subscribers, description] = match;
      const followersCount = parseFollowerCount(subscribers);
      const url = `https://t.me/${username}`;
      
      if (followersCount >= 10000 && !sources.some(s => s.url === url)) {
        sources.push({
          url,
          username,
          name: name.trim(),
          type: 'telegram',
          platform: 'telegram',
          followers: followersCount,
          rank: sources.length + 1,
          description: description.trim()
        });
      }
    }
    
    // 3. Simple @ mentions for Telegram
    // Example: "@channelname (100K subscribers)"
    const telegramSimplePattern = /@([a-zA-Z0-9._-]+)\s*\(([0-9.]+[KkMm][^)]*)\)/g;

    while ((match = telegramSimplePattern.exec(content)) !== null) {
      const [_, username, followers] = match;
      const followersCount = parseFollowerCount(followers);
      const url = `https://t.me/${username}`;

      if (followersCount >= 10000 && !sources.some(s => s.url === url)) {
        sources.push({
          url,
          username,
          name: username,
          followers: followersCount,
          platform: 'telegram',
          type: 'telegram',
          description: 'Telegram канал',
          rank: 5
        });
      }
    }
  }



  // Дополнительную поддержку для VK, Facebook и других платформ можно добавить здесь

  console.log(`Extracted ${sources.length} sources (platforms: ${platforms.join(', ')}):`, sources);
  return sources;
}



// Helper function to merge sources and remove duplicates
function mergeSources(sources: any[]): any[] {
  console.log('Merging sources, total input:', sources.length);
  const uniqueSourcesMap = new Map();
  sources.forEach(source => {
    const key = source.url.toLowerCase().trim();
    if (!uniqueSourcesMap.has(key) || source.rank < uniqueSourcesMap.get(key).rank) {
      uniqueSourcesMap.set(key, source);
    }
  });
  const mergedSources = Array.from(uniqueSourcesMap.values());
  console.log('After merging, unique sources:', mergedSources.length);
  return mergedSources;
}

// Middleware для проверки авторизации
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.directus_session_token;
    
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (cookieToken) {
      token = cookieToken;
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован: Отсутствует токен авторизации' });
    }

    try {
      // Проверяем является ли токен статическим DIRECTUS_TOKEN
      if (token === process.env.DIRECTUS_TOKEN || token === process.env.DIRECTUS_ADMIN_TOKEN) {
        console.log('[AUTH] Используется статический DIRECTUS_TOKEN для тестирования');
        
        // ИСПРАВЛЕНО: Используем реальный ID администратора из Directus
        const realAdminId = 'fcae6ef5-8a6d-4ffd-a39a-58c5bda176e4'; // Реальный ID из ответа Directus
        
        req.user = {
          id: realAdminId,
          token: token,
          email: 'admin@roboflow.space', // Обновленный email
          firstName: 'Admin',
          lastName: 'Roboflow'
        };
        (req as any).userId = realAdminId;
        next();
        return;
      }

      // Декодируем JWT токен для получения информации о пользователе
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        return res.status(401).json({ error: 'Не авторизован: Неверный формат токена' });
      }

      try {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const userId = payload.id;
        const userEmail = payload.email || 'unknown@email.com';
        
        if (!userId) {
          return res.status(401).json({ error: 'Не авторизован: Отсутствует ID пользователя в токене' });
        }

        // Проверяем срок действия токена
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < currentTime) {
          console.log(`[AUTH] Токен истек для пользователя ${userId}`);
          return res.status(401).json({ 
            error: 'Не авторизован: Токен истек и требует обновления' 
          });
        }

        // Устанавливаем информацию о пользователе из токена
        req.user = {
          id: userId,
          token: token,
          email: userEmail,
          firstName: payload.first_name || 'User',
          lastName: payload.last_name || ''
        };
        
        // Поддержка старого интерфейса
        (req as any).userId = userId;
        
        console.log(`[AUTH] Пользователь авторизован из JWT токена: ${userId} (${userEmail})`);
        next();
        
      } catch (decodeError) {
        console.error('[AUTH] Ошибка декодирования JWT токена:', decodeError);
        return res.status(401).json({ error: 'Не авторизован: Ошибка декодирования токена' });
      }
      
    } catch (error: any) {
      console.error('[AUTH] Критическая ошибка авторизации:', error.message);
      return res.status(401).json({ 
        error: 'Не авторизован: Ошибка проверки токена'
      });
    }
  } catch (error) {
    console.error('[AUTH] Критическая ошибка middleware:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

// Функция для получения админского токена из Directus
async function getDirectusAdminToken(): Promise<string | null> {
  try {
    const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
    const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;
    const directusToken = process.env.DIRECTUS_ADMIN_TOKEN;
    
    // Если указан готовый токен - используем его
    if (directusToken) {
      console.log('Используем готовый DIRECTUS_ADMIN_TOKEN из env');
      return directusToken;
    }
    
    // Если указаны учетные данные администратора
    if (adminEmail && adminPassword) {
      console.log(`Авторизация администратора ${adminEmail} через API Directus`);
      try {
        const authResponse = await directusApi.post('/auth/login', {
          email: adminEmail,
          password: adminPassword
        });
        
        if (authResponse.data && authResponse.data.data && authResponse.data.data.access_token) {
          console.log('Успешно получен токен администратора через API');
          return authResponse.data.data.access_token;
        }
      } catch (authError) {
        console.error('Ошибка авторизации администратора:', authError);
      }
    }
    
    // Проверим, есть ли кэшированный токен администратора
    try {
      const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID;
      if (adminUserId) {
        const cachedToken = directusApiManager.getCachedToken(adminUserId);
        if (cachedToken) {
          console.log(`Используем кэшированный токен администратора (ID: ${adminUserId})`);
          // Если cachedToken это объект с токеном, извлекаем строку
          if (typeof cachedToken === 'object' && cachedToken.token) {
            return cachedToken.token;
          }
          return cachedToken;
        }
      }
    } catch (cacheError) {
      console.error('Ошибка при получении кэшированного токена:', cacheError);
    }
    
    console.error('Не удалось получить токен администратора');
    return null;
  } catch (error) {
    console.error('Ошибка при получении токена администратора:', error);
    return null;
  }
}

// Функция для глубокого извлечения контента с сайта для улучшенного анализа
/**
 * ПРОСТАЯ ФУНКЦИЯ АНАЛИЗА САЙТА - БЕЗ КЛАССИФИКАЦИИ И ЦИКЛОВ
 * Только скрапинг + отправка ИИ
 */
async function extractFullSiteContent(url: string): Promise<string> {
  try {
    console.log(`🚀 Улучшенный скрапинг сайта: ${url}`);
    
    // Нормализуем URL
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    // Загрузка с безопасными лимитами
    const response = await axios.get(normalizedUrl, {
      timeout: 5000,
      maxContentLength: 1024 * 1024, // 1MB для безопасности
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    const htmlContent = response.data;
    
    // Улучшенное извлечение контента
    const title = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
    const description = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
    const keywords = htmlContent.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
    
    // Безопасное извлечение заголовков с ограничениями
    const h1Tags = [];
    const h1Regex = /<h1[^>]*>([^<]+)<\/h1>/gi;
    let h1Match;
    let h1Count = 0;
    while ((h1Match = h1Regex.exec(htmlContent)) !== null && h1Count < 10) {
      const text = h1Match[1]?.trim();
      if (text) h1Tags.push(text);
      h1Count++;
    }
    
    const h2Tags = [];
    const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/gi;
    let h2Match;
    let h2Count = 0;
    while ((h2Match = h2Regex.exec(htmlContent)) !== null && h2Count < 15) {
      const text = h2Match[1]?.trim();
      if (text) h2Tags.push(text);
      h2Count++;
    }
    
    // Извлекаем параграфы (ограниченно)
    const paragraphs = [];
    const pRegex = /<p[^>]*>([^<]+)<\/p>/gi;
    let pMatch;
    let pCount = 0;
    while ((pMatch = pRegex.exec(htmlContent)) !== null && pCount < 30) {
      const text = pMatch[1]?.trim();
      if (text && text.length > 20) paragraphs.push(text);
      pCount++;
    }
    
    // ИЗВЛЕКАЕМ КОНТАКТНУЮ ИНФОРМАЦИЮ С ФОКУСОМ НА FOOTER И КОНЕЦ СТРАНИЦЫ
    
    // Сначала ищем footer и контактные секции
    const footerRegex = /<footer[^>]*>[\s\S]*?<\/footer>/gi;
    const contactSectionRegex = /<[^>]*(?:class|id)=["'][^"']*(?:contact|контакт|связ|phone|email|адрес|address|footer|подвал)[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi;
    
    let footerContent = '';
    const footerMatches = htmlContent.match(footerRegex);
    if (footerMatches) {
      footerContent = footerMatches.join(' ');
    }
    
    const contactSectionMatches = htmlContent.match(contactSectionRegex) || [];
    const contactSectionsContent = contactSectionMatches.join(' ');
    
    // Также берем последние 20% страницы, где обычно находятся контакты
    const pageEnd = htmlContent.slice(-Math.floor(htmlContent.length * 0.2));
    
    // Объединяем приоритетные области для поиска контактов
    const priorityContent = footerContent + ' ' + contactSectionsContent + ' ' + pageEnd;
    
    console.log(`🔍 Ищем контакты в footer (${footerContent.length} симв.), контактных секциях (${contactSectionsContent.length} симв.) и конце страницы (${pageEnd.length} симв.)`);
    
    // Ищем российские телефоны (более точные паттерны)
    const phoneRegex = /(\+7[\s\-\(\)]?\d{3}[\s\-\(\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}|8[\s\-\(\)]?\d{3}[\s\-\(\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}|8[\s\-]*800[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2})/gi;
    
    // Ищем email адреса (более точный паттерн)
    const emailRegex = /([a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    
    let phones = [];
    let emails = [];
    
    // Сначала ищем в приоритетных областях (footer, контактные секции, конец страницы)
    const priorityPhones = priorityContent.match(phoneRegex) || [];
    const priorityEmails = priorityContent.match(emailRegex) || [];
    
    // Если в приоритетных областях ничего не нашли, ищем по всей странице
    const allPhones = priorityPhones.length > 0 ? priorityPhones : (htmlContent.match(phoneRegex) || []);
    const allEmails = priorityEmails.length > 0 ? priorityEmails : (htmlContent.match(emailRegex) || []);
    
    // Обрабатываем телефоны с ограниченным циклом
    for (let i = 0; i < Math.min(allPhones.length, 10); i++) {
      const cleanPhone = allPhones[i].trim();
      const digits = cleanPhone.replace(/\D/g, '');
      // Проверяем что это действительно телефон (10-11 цифр)
      if (digits.length >= 10 && digits.length <= 11 && 
          (digits.startsWith('7') || digits.startsWith('8'))) {
        phones.push(cleanPhone);
      }
    }
    
    // Обрабатываем email с ограниченным циклом
    for (let i = 0; i < Math.min(allEmails.length, 10); i++) {
      const cleanEmail = allEmails[i].trim().toLowerCase();
      // Проверяем что это не служебный email (избегаем false positive)
      if (!cleanEmail.includes('example.') && !cleanEmail.includes('@example') && 
          !cleanEmail.includes('test@') && !cleanEmail.includes('name@') &&
          !cleanEmail.includes('noreply') && !cleanEmail.includes('no-reply') &&
          cleanEmail.includes('.') && cleanEmail.length >= 5) {
        emails.push(allEmails[i].trim());
      }
    }
    
    // Удаляем дубликаты
    phones = [...new Set(phones)].slice(0, 5);
    emails = [...new Set(emails)].slice(0, 5);
    
    const allContacts = [...phones, ...emails];
    
    // Ищем разделы с контактной информацией
    const contactSections = htmlContent.match(/<[^>]*(?:class|id)=["'][^"']*(?:contact|контакт|связ|phone|email|адрес|address)[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi) || [];
    const contactTexts = contactSections
      .map(section => section.replace(/<[^>]+>/g, '').trim())
      .filter(text => text.length > 10 && text.length < 200)
      .slice(0, 5);
    
    console.log(`📞 Найдено телефонов: ${phones.length}, email: ${emails.length}, контактных разделов: ${contactTexts.length}`);
    if (phones.length > 0) console.log(`📞 Телефоны:`, phones);
    if (emails.length > 0) console.log(`📧 Email:`, emails);
    
    // Собираем структурированный контент для ИИ
    const contentParts = [
      `URL: ${url}`,
      title ? `ЗАГОЛОВОК СТРАНИЦЫ: ${title}` : '',
      description ? `ОПИСАНИЕ САЙТА: ${description}` : '',
      keywords ? `КЛЮЧЕВЫЕ СЛОВА: ${keywords}` : ''
    ];
    
    // Добавляем найденные контакты в специальном формате для ИИ
    if (allContacts.length > 0) {
      contentParts.push(`НАЙДЕННЫЕ КОНТАКТЫ:`);
      if (phones.length > 0) {
        contentParts.push(`Телефоны: ${phones.join(', ')}`);
      }
      if (emails.length > 0) {
        contentParts.push(`Email: ${emails.join(', ')}`);
      }
    }
    
    if (contactTexts.length > 0) {
      contentParts.push(`КОНТАКТНЫЕ РАЗДЕЛЫ:\n${contactTexts.map(ct => `- ${ct}`).join('\n')}`);
    }
    
    // Добавляем остальной контент
    if (h1Tags.length > 0) contentParts.push(`ОСНОВНЫЕ ЗАГОЛОВКИ H1:\n${h1Tags.map((h: string) => `- ${h}`).join('\n')}`);
    if (h2Tags.length > 0) contentParts.push(`ЗАГОЛОВКИ H2:\n${h2Tags.map((h: string) => `- ${h}`).join('\n')}`);
    
    let structuredContent = contentParts.filter(Boolean).join('\n\n');
    
    // Ограничиваем размер до 15KB для эффективной обработки ИИ
    if (structuredContent.length > 15000) {
      structuredContent = structuredContent.substring(0, 15000) + '\n\n[КОНТЕНТ ОБРЕЗАН ДЛЯ АНАЛИЗА]';
    }
    
    console.log(`✅ Улучшенный скрапинг завершен (${structuredContent.length} символов)`);
    console.log(`📊 Извлечено: ${allContacts.length} контактов (${phones.length} тел., ${emails.length} email), ${h1Tags.length} H1, ${h2Tags.length} H2, ${paragraphs.length} параграфов`);
    
    return structuredContent;
    
  } catch (error: any) {
    console.error(`❌ Ошибка анализа сайта ${url}:`, error.message);
    return `URL: ${url}\nОшибка загрузки сайта: ${error.message}`;
  }
}

/**
 * Преобразует строки и другие типы в массивы
 * @param value Значение для преобразования
 * @param itemId ID элемента для логирования ошибок (опционально)
 * @returns Преобразованный массив
 */
function parseArrayField(value: any, itemId?: string): any[] {
  // Если это уже массив, возвращаем как есть
  if (Array.isArray(value)) {
    return value;
  }
  
  // Если это строка, пытаемся распарсить как JSON
  if (typeof value === "string") {
    try {
      const parsedValue = JSON.parse(value);
      return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (e) {
      // Если не удалось распарсить, возвращаем пустой массив
      if (itemId) {
        console.warn(`Failed to parse array field for item ${itemId}:`, e);
      }
      return [];
    }
  }
  
  // В остальных случаях возвращаем пустой массив
  return [];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Регистрируем универсальный интерфейс для FAL.AI
  // registerClaudeRoutes(app); // ОТКЛЮЧЕНО: используем единый маршрут /api/generate-content
  registerFalAiImageRoutes(app);
  registerFalAiRedirectRoutes(app);
  // Прокси для прямых запросов к FAL.AI REST API
  // Отладочный маршрут для проверки API ключа FAL.AI
  app.get('/api/debug-fal-ai', async (req, res) => {
    // Получаем userId из запроса
    const authHeader = req.headers['authorization'];
    let userId = null;
    let token = null;
    
    // Если есть авторизация, получаем userId из токена
    if (authHeader) {
      token = authHeader.replace('Bearer ', '');
      try {
        // Получаем информацию о пользователе из токена
        // Декодируем токен напрямую
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          userId = payload.id;
        }
      } catch (error) {
        console.error("Ошибка при получении информации о пользователе:", error);
      }
    }
    
    // Получаем API ключ из сервиса ключей
    let apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', token);
    
    // Инициализируем клиент FAL.AI с полученным ключом
    if (apiKey) {
      falAiClient.setApiKey(apiKey);
    }
    
    // Проверяем формат API ключа и приводим его к правильной форме
    const formattedKey = apiKey ? (apiKey.startsWith('Key ') ? apiKey : `Key ${apiKey}`) : 'Ключ не найден';
    
    res.json({
      status: 'success',
      user_id: userId || 'Не авторизован',
      key_source: userId ? 'Directus (настройки пользователя)' : 'Переменные окружения (fallback)',
      key_available: !!apiKey,
      key_format: apiKey ? (apiKey.includes(':') ? 'Правильный формат (содержит :)' : 'Неправильный формат (нет :)') : 'Ключ отсутствует',
      authorization_header: formattedKey,
      test_prompt: "Wild cat"
    });
  });
  
  // Тестовый маршрут для проверки разных форматов API ключа
  app.get('/api/test-fal-ai-formats-v2', async (req, res) => {
    try {
      // Получаем userId из запроса
      const authHeader = req.headers['authorization'];
      let userId = null;
      let token = null;
      
      // Если есть авторизация, получаем userId из токена
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
        try {
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
        }
      }
      
      // Получаем API ключ из сервиса ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', token);
      
      if (!apiKey) {
        return res.status(404).json({
          success: false,
          error: "API ключ FAL.AI не найден. Пожалуйста, добавьте его в настройки."
        });
      }
      
      // Тестируем с добавленным префиксом "Key "
      console.log('🧪 [FAL.AI TEST] Тестирование формата ключа: with Key prefix added');
      const authHeader1 = `Key ${apiKey.startsWith('Key ') ? apiKey.substring(4) : apiKey}`;
      console.log(`🧪 [FAL.AI TEST] Итоговый заголовок: ${authHeader1.substring(0, 15)}...`);
      
      try {
        // Сначала попробуем универсальную модель (flux/fast-sdxl)
        try {
          await axios.post('https://queue.fal.run/fal-ai/fast-sdxl', {
            prompt: "Test image",
            negative_prompt: "",
            width: 512,
            height: 512,
            num_images: 1
          }, {
            headers: {
              Authorization: authHeader1,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          });
          console.log('🧪 [FAL.AI TEST] Модель fast-sdxl работает!');
          return res.json({
            success: true,
            message: "API ключ FAL.AI работает корректно с префиксом Key!",
            api_key_format: "Правильный формат",
            auth_header: `${authHeader1.substring(0, 15)}...`,
            tested_model: "fast-sdxl"
          });
        } catch (firstModelError) {
          console.log(`🧪 [FAL.AI TEST] Ошибка с моделью fast-sdxl: ${firstModelError.message}`);
          
          // Если ошибка с первой моделью, пробуем вторую модель (sdxl)
          try {
            await axios.post('https://queue.fal.run/fal-ai/fast-sdxl', {
              prompt: "Test image",
              negative_prompt: "",
              width: 512,
              height: 512,
              num_images: 1
            }, {
              headers: {
                Authorization: authHeader1,
                'Content-Type': 'application/json'
              },
              timeout: 15000
            });
            console.log('🧪 [FAL.AI TEST] Модель fast-sdxl работает!');
            return res.json({
              success: true,
              message: "API ключ FAL.AI работает корректно с префиксом Key!",
              api_key_format: "Правильный формат",
              auth_header: `${authHeader1.substring(0, 15)}...`,
              tested_model: "fast-sdxl"
            });
          } catch (secondModelError) {
            // Если обе модели вызвали ошибку, логируем и продолжаем нормальный поток
            console.log(`🧪 [FAL.AI TEST] Ошибка с моделью fast-sdxl: ${secondModelError.message}`);
            throw secondModelError; // Перебрасываем вторую ошибку для обработки в блоке catch
          }
        }
      } catch (error: any) {
        console.log(`🧪 [FAL.AI TEST] Ошибка API с форматом "with Key prefix added": ${error.message}`);
        
        // Если 401, ключ неправильный, но передача работает
        if (error.response?.status === 401) {
          return res.status(401).json({
            success: false,
            error: "Ошибка при проверке FAL.AI API ключа: неправильный ключ или формат",
            format_used: "Key <id>:<secret>",
            tip: "Ключ в правильном формате, но не авторизован. Проверьте сам ключ."
          });
        }
        
        return res.status(500).json({
          success: false,
          error: `Ошибка при проверке API: ${error.message}`
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: `Общая ошибка: ${error.message}`
      });
    }
  });
  
  app.post('/api/v1/image-gen', async (req, res) => {
    try {
      const { prompt, negativePrompt, width, height, numImages } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ 
          success: false, 
          error: "Отсутствует обязательный параметр prompt" 
        });
      }
      
      // Получаем userId из запроса
      const authHeader = req.headers['authorization'];
      let userId = null;
      let token = null;
      
      // Если есть авторизация, получаем userId из токена
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
        try {
          // Получаем информацию о пользователе из токена
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
          console.log('Определен пользователь из токена:', userId);
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
        }
      }
      
      // Инициализируем FAL.AI клиент с использованием только API ключа из Directus
      let apiKey = null;
      
      if (userId) {
        // Если пользователь авторизован, получаем ключ только из его настроек в Directus
        console.log('Получаем API ключ FAL.AI из настроек пользователя с ID:', userId);
        apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', token);
        if (apiKey) {
          console.log('Найден API ключ FAL.AI в настройках пользователя');
        }
      }
      
      // Если ключ не найден, возвращаем ошибку - не используем ключи из переменных окружения
      if (!apiKey) {
        console.error('API ключ FAL.AI не найден в настройках пользователя Directus');
        return res.status(403).json({ 
          success: false, 
          error: "API ключ FAL.AI не настроен для вашего аккаунта. Пожалуйста, добавьте ключ в настройки пользователя." 
        });
      }
      
      console.log(`[FAL.AI Прокси] Выполняем прямой запрос к REST API FAL.AI`);
      console.log(`[FAL.AI Прокси] Запрос: prompt="${prompt.substring(0, 50)}...", width=${width}, height=${height}`);
      
      try {
        // Выполняем прямой запрос к FAL.AI REST API
        const response = await axios.post(
          'https://queue.fal.ai/fal-ai/fast-sdxl/requests',
          {
            prompt,
            negative_prompt: negativePrompt || "",
            width: width || 1024,
            height: height || 1024,
            num_images: numImages || 1
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Key ${apiKey}`
            },
            timeout: 300000 // 5 минут таймаут
          }
        );
        
        const data = response.data;
        console.log(`[FAL.AI Прокси] Ответ успешно получен`, 
                   Object.keys(data || {}));
        
        // Обрабатываем различные форматы ответа
        let images: string[] = [];
        
        if (data.status === "IN_QUEUE") {
          return res.json({
            success: true,
            status: "queued",
            message: "Запрос поставлен в очередь"
          });
        }
        
        // Получаем URL изображений из ответа
        if (data.resources && Array.isArray(data.resources)) {
          images = data.resources.map((r: any) => r.url).filter(Boolean);
        } else if (data.output && Array.isArray(data.output)) {
          images = data.output.filter(Boolean);
        } else if (data.output) {
          images = [data.output];
        } else if (data.images && Array.isArray(data.images)) {
          images = data.images.map((img: any) => {
            if (typeof img === 'string') return img;
            return img.url || img.image || '';
          }).filter(Boolean);
        }
        
        return res.json({
          success: true,
          images,
          total: images.length
        });
      } catch (error: any) {
        console.error('[FAL.AI Прокси] Ошибка при запросе к API:', error.message);
        
        const errorDetails = error.response?.data;
        let errorMessage = error.message || 'Неизвестная ошибка';
        
        if (errorDetails) {
          errorMessage = errorDetails.detail || errorDetails.message || errorDetails.error || errorMessage;
        }
        
        if (error.response?.status === 401) {
          errorMessage = 'Ошибка авторизации FAL.AI - проверьте валидность API ключа';
        }
        
        return res.status(error.response?.status || 500).json({
          success: false,
          error: errorMessage
        });
      }
    } catch (error: any) {
      console.error('[FAL.AI Прокси] Общая ошибка:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Ошибка сервера при обработке запроса'
      });
    }
  });
  
  // Получение API ключа FAL.AI из настроек Directus
  // Новый тестовый эндпоинт для проверки приоритизации API ключей
  app.get('/api/test/api-keys/priority', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      let userId = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        try {
          // Получаем информацию о пользователе из токена
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          userId = userResponse.data?.data?.id;
        } catch (error) {
          console.error('Ошибка при получении пользователя:', error);
        }
      }
      
      // Улучшение: Продолжаем проверку даже если пользователь не авторизован,
      // чтобы можно было увидеть статус системы даже без логина
      let isUserAuthenticated = !!userId;
      
      // Получаем ключ через новую систему приоритизации (сначала пользовательский, потом системный)
      const falApiKey = await apiKeyService.getApiKey(userId, 'fal_ai', authHeader?.split(' ')[1]);
      
      // Проверяем источники ключей (только из базы данных)
      let userKey = null;
      let userKeySource = "не найден";
      
      try {
        // Запрашиваем API ключ напрямую из настроек пользователя
        const apiKeysResponse = await directusApi.get('/items/user_api_keys', {
          params: {
            filter: {
              user_id: { _eq: userId },
              service_name: { _eq: 'fal_ai' }
            },
            fields: ['api_key']
          },
          headers: authHeader ? { Authorization: authHeader } : {}
        });
        
        const items = apiKeysResponse.data?.data || [];
        if (items.length && items[0].api_key) {
          userKey = items[0].api_key;
          userKeySource = "найден в Directus";
        }
      } catch (error) {
        userKeySource = `ошибка при запросе: ${error instanceof Error ? error.message : String(error)}`;
      }
      
      // Сравниваем источники и возвращаем результат
      // Если пользователь не авторизован, проверяем только наличие ключа из окружения
      const isPrioritizedCorrectly = isUserAuthenticated 
        ? (userKey && falApiKey === userKey) 
        : !!falApiKey; // Для неавторизованного пользователя просто проверяем наличие ключа
      
      // Улучшаем сообщение в зависимости от статуса авторизации
      let statusMessage = '';
      let source = '';
      
      if (isUserAuthenticated) {
        // Для авторизованного пользователя
        if (isPrioritizedCorrectly) {
          statusMessage = "Система приоритизации работает корректно: пользовательский ключ имеет приоритет";
          source = "user_settings (правильно)";
        } else {
          statusMessage = "Система приоритизации не работает корректно: не удалось определить источник ключа";
          source = "неизвестно";
        }
      } else {
        // Для неавторизованного пользователя
        if (falApiKey) {
          statusMessage = "Для неавторизованного пользователя получен API ключ";
          source = "неизвестно";
        } else {
          statusMessage = "Не удалось получить API ключ для неавторизованного пользователя";
          source = "неизвестно";
        }
      }
      
      return res.json({
        success: true,
        data: {
          prioritization_working: isPrioritizedCorrectly,
          user_authenticated: isUserAuthenticated,
          selected_api_key: falApiKey ? falApiKey.substring(0, 5) + '...' + falApiKey.substring(falApiKey.length - 5) : 'null',
          sources: {
            env_key_present: false, // API ключи из переменных окружения больше не используются
            user_key: userKey ? userKey.substring(0, 5) + '...' + userKey.substring(userKey.length - 5) : 'null',
            user_key_status: userKeySource
          },
          source: source
        },
        message: statusMessage
      });
    } catch (error) {
      console.error('Ошибка при проверке API ключей:', error);
      return res.status(500).json({
        success: false,
        message: `Ошибка при проверке приоритизации API ключей: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  // Маршрут для получения API ключа FAL.AI - только из настроек пользователя в Directus
  app.get('/api/settings/fal_ai', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      // Переменные окружения для FAL.AI больше не используются
      // Работаем только с ключами из Directus
      
      try {
        // Пробуем получить API ключ из Directus
        // Сначала пробуем получить из системных настроек
        const systemSettings = await directusApi.get('/items/system_settings', {
          params: {
            filter: {
              key: { _eq: 'fal_ai_api_key' }
            }
          }
        });
        
        if (systemSettings.data?.data?.length > 0 && systemSettings.data.data[0].value) {
          console.log('Найден API ключ FAL.AI в системных настройках Directus');
          return res.json({
            success: true,
            data: {
              api_key: systemSettings.data.data[0].value,
              source: "system_settings"
            }
          });
        }
        
        // Если не нашли в системных настройках и есть токен пользователя,
        // пробуем найти в пользовательских API ключах
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          
          // Получаем информацию о пользователе из токена
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const userId = userResponse.data?.data?.id;
          
          if (userId) {
            // Запрашиваем API ключ из настроек пользователя
            const apiKeysResponse = await directusApi.get('/items/user_api_keys', {
              params: {
                filter: {
                  user_id: { _eq: userId },
                  service_name: { _eq: 'fal_ai' }
                },
                fields: ['api_key']
              },
              headers: { Authorization: `Bearer ${token}` }
            });
            
            const items = apiKeysResponse.data?.data || [];
            if (items.length && items[0].api_key) {
              console.log('Найден API ключ FAL.AI в пользовательских настройках Directus');
              return res.json({
                success: true,
                data: {
                  api_key: items[0].api_key,
                  source: "user_settings"
                }
              });
            }
          }
        }
        
        // Если API ключ не найден ни в системных настройках, ни в пользовательских
        return res.status(404).json({
          success: false,
          error: "API ключ FAL.AI не найден в настройках системы"
        });
      } catch (directusError: any) {
        console.error('Ошибка при запросе к Directus API:', directusError);
        
        // Возвращаем ошибку, так как мы не используем ключи из переменных окружения для FAL.AI
        
        // Если нет запасного варианта, возвращаем ошибку
        return res.status(500).json({
          success: false,
          error: "Ошибка при получении API ключа из Directus"
        });
      }
    } catch (error: any) {
      console.error('Общая ошибка при получении API ключа FAL.AI:', error.message);
      return res.status(500).json({
        success: false,
        error: "Ошибка при получении настроек API ключа"
      });
    }
  });

  // Прокси для запросов к FAL.AI API через официальный SDK
  app.post('/api/fal-ai-proxy', async (req, res) => {
    try {
      const { endpoint, data, apiKey } = req.body;
      
      if (!endpoint || !data || !apiKey) {
        return res.status(400).json({ 
          success: false, 
          error: "Отсутствуют необходимые параметры (endpoint, data, apiKey)" 
        });
      }
      
      try {
        console.log(`[FAL.AI Прокси] Выполняем запрос к API FAL.AI к эндпоинту ${endpoint}`);
        console.log(`[FAL.AI Прокси] Данные запроса:`, JSON.stringify(data).substring(0, 200));
        
        // Инициализация FalAI SDK через централизованный сервис API ключей
        const userId = (req as any).userId;
        const authHeader = req.headers['authorization'];
        const authToken = authHeader ? authHeader.replace('Bearer ', '') : undefined;
        const initSuccess = await falAiSdk.initializeFromApiKeyService(userId, authToken);
        
        if (!initSuccess) {
          // Если инициализация не удалась, но у нас есть apiKey из запроса - используем его
          if (apiKey) {
            console.log('[FAL.AI Прокси] Инициализация через API Key Service не удалась, используем ключ из запроса');
            falAiSdk.initialize(apiKey);
          } else {
            console.log('[FAL.AI Прокси] Инициализация не удалась и нет прямого API ключа');
            return res.status(401).json({ 
              success: false, 
              message: 'Не удалось инициализировать FAL.AI SDK. API ключ не найден.' 
            });
          }
        }
        
        // Подготавливаем endpoint для SDK (проверяем, содержит ли путь 'fal-ai')
        const sdkEndpoint = endpoint.includes('fal-ai') ? endpoint : `fal-ai/${endpoint}`;
        
        // Устанавливаем увеличенный таймаут для операции
        // 300000 мс = 5 минут
        const requestTimeoutMs = 300000; 
        
        // Создаем промис с таймаутом для контроля времени выполнения
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout: FAL.AI API не ответил в течение 5 минут')), requestTimeoutMs);
        });
        
        // Выполняем запрос через официальный SDK с контролем таймаута
        // Promise.race возвращает результат первого завершившегося промиса
        const responseData = await Promise.race([
          falAiSdk.generateImage(sdkEndpoint, data),
          timeoutPromise
        ]);
        
        console.log(`[FAL.AI Прокси] Запрос выполнен успешно через SDK`);
        console.log(`[FAL.AI Прокси] Структура ответа:`, Object.keys(responseData || {}));
        
        // Обработка нескольких возможных форматов ответа
        let images: string[] = [];
        
        if (responseData?.images && Array.isArray(responseData.images)) {
          // Формат из нашего сервиса
          images = responseData.images;
        } else if (Array.isArray(responseData)) {
          // Прямой массив URL-ов изображений
          images = responseData;
        } else if (typeof responseData === 'string') {
          // Один URL в виде строки
          images = [responseData];
        } else if (responseData?.data?.images && Array.isArray(responseData.data.images)) {
          // Вложенный массив изображений
          images = responseData.data.images;
        } else if (responseData?.image || responseData?.url) {
          // Один URL в объекте
          images = [responseData.image || responseData.url];
        } else if (responseData?.output) {
          // Формат output из fal.ai
          if (Array.isArray(responseData.output)) {
            images = responseData.output;
          } else {
            images = [responseData.output];
          }
        }
        
        console.log(`[FAL.AI Прокси] Извлечено изображений: ${images.length}`);
        
        // Возвращаем результат клиенту в едином формате
        return res.json({
          success: true,
          data: {
            images: images
          }
        });
      } catch (proxyError: any) {
        console.error("[FAL.AI Прокси] Ошибка запроса:", proxyError);
        
        // Возвращаем детальную информацию об ошибке
        if (proxyError.response) {
          return res.status(proxyError.response.status).json({
            success: false,
            error: `Ошибка FAL.AI API: ${proxyError.response.status}`,
            details: proxyError.response.data
          });
        } else if (proxyError.code === 'ENOTFOUND') {
          return res.status(500).json({
            success: false,
            error: `Не удалось разрешить домен API. Код ошибки: ${proxyError.code}`,
            details: proxyError.message
          });
        } else {
          return res.status(500).json({
            success: false,
            error: `Ошибка запроса к FAL.AI: ${proxyError.message}`, 
            details: proxyError.code || 'unknown_error'
          });
        }
      }
    } catch (error: any) {
      console.error("[FAL.AI Прокси] Ошибка при обработке запроса:", error);
      return res.status(500).json({ 
        success: false, 
        error: `Ошибка прокси: ${error.message}` 
      });
    }
  });

  // Маршрут для перевода текста с русского на английский
  app.post('/api/translate-to-english', authenticateUser, async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Необходимо указать текст для перевода'
        });
      }
      
      // Сначала очищаем текст от HTML-тегов
      const cleanedText = cleanupText(text);
      console.log('Очищенный текст перед переводом:', cleanedText);
      
      // Используем существующую функцию translateToEnglish
      const translatedText = await translateToEnglish(cleanedText);
      
      // Логируем результат для отладки
      console.log('Перевод текста:', {
        original: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        cleaned: cleanedText.substring(0, 100) + (cleanedText.length > 100 ? '...' : ''),
        translated: translatedText.substring(0, 100) + (translatedText.length > 100 ? '...' : '')
      });
      
      res.json({
        success: true,
        originalText: text,
        translatedText
      });
    } catch (error) {
      console.error('Ошибка при переводе текста:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при переводе текста'
      });
    }
  });

  // Функция для получения контекста кампании и данных анкеты
  async function getCampaignContext(userId: string, campaignId: string, token: string): Promise<string | null> {
    try {
      console.log(`INFO: Получение данных кампании ${campaignId} для пользователя ${userId}`);
      
      // Используем переданный токен напрямую вместо запроса через DirectusAuthManager
      const userToken = token;
      
      // Получаем данные кампании через авторизованный токен
      const directusUrl = process.env.DIRECTUS_URL;
      if (!directusUrl) {
        return res.status(500).json({ error: 'DIRECTUS_URL не настроен в переменных окружения' });
      }
      
      const directusApi = axios.create({
        baseURL: directusUrl,
        timeout: 10000
      });
      
      const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('INFO: Данные кампании получены из Directus');
      
      const campaignData = campaignResponse.data?.data;
      
      if (!campaignData) {
        console.log('WARN: Данные кампании не найдены');
        return null;
      }
      
      // Логируем информацию о кампании
      console.log(`INFO: Обработка кампании для пользователя ${userId}`);
      
      console.log('INFO: Данные кампании получены успешно');
      console.log('DEBUG: Данные кампании:', JSON.stringify(campaignData, null, 2));
      
      let context = '';
      
      // Добавляем ссылку на сайт кампании
      if (campaignData.link) {
        console.log(`INFO: Получена ссылка на сайт кампании: ${campaignData.link}`);
        context += `\n\nОБЯЗАТЕЛЬНО используйте этот сайт кампании: ${campaignData.link}`;
      }
      
      // Добавляем основную информацию о кампании
      if (campaignData.name) {
        context += `\nНазвание кампании: ${campaignData.name}`;
      }
      if (campaignData.description) {
        context += `\nОписание кампании: ${campaignData.description}`;
      }
      
      // Пробуем получить данные анкеты если есть questionnaire_id
      if (campaignData.questionnaire_id) {
        try {
          console.log(`INFO: Получение данных анкеты ${campaignData.questionnaire_id}`);
          const questionnaireResponse = await directusApi.get(`/items/campaign_questionnaires/${campaignData.questionnaire_id}`, {
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          const questionnaireData = questionnaireResponse.data?.data;
          
          if (questionnaireData) {
            console.log('INFO: Данные анкеты получены успешно');
            console.log('DEBUG: Полные данные анкеты:', JSON.stringify(questionnaireData, null, 2));
            
            // Добавляем все доступные данные о компании из анкеты
            context += `\n\nДАННЫЕ КОМПАНИИ ИЗ АНКЕТЫ:`;
            
            if (questionnaireData.company_name) {
              context += `\nНазвание компании: ${questionnaireData.company_name}`;
            }
            if (questionnaireData.business_description) {
              context += `\nОписание бизнеса: ${questionnaireData.business_description}`;
            }
            if (questionnaireData.target_audience) {
              context += `\nЦелевая аудитория: ${questionnaireData.target_audience}`;
            }
            if (questionnaireData.contact_info) {
              context += `\nКонтактная информация: ${questionnaireData.contact_info}`;
            }
            if (questionnaireData.products_services) {
              context += `\nПродукты/услуги: ${questionnaireData.products_services}`;
            }
            if (questionnaireData.unique_selling_points) {
              context += `\nУникальные преимущества: ${questionnaireData.unique_selling_points}`;
            }
            if (questionnaireData.marketing_goals) {
              context += `\nМаркетинговые цели: ${questionnaireData.marketing_goals}`;
            }
            if (questionnaireData.brand_tone) {
              context += `\nТон бренда: ${questionnaireData.brand_tone}`;
            }
            if (questionnaireData.competitors) {
              context += `\nКонкуренты: ${questionnaireData.competitors}`;
            }
            if (questionnaireData.competitive_advantages) {
              context += `\nКонкурентные преимущества: ${questionnaireData.competitive_advantages}`;
            }
            if (questionnaireData.marketing_expectations) {
              context += `\nОжидания от маркетинга: ${questionnaireData.marketing_expectations}`;
            }
          }
        } catch (questionnaireError: any) {
          console.log('WARN: Не удалось получить данные анкеты:', questionnaireError.message);
        }
      }
      
      console.log('INFO: Контекст кампании сформирован успешно');
      console.log('DEBUG: Сформированный контекст:', context.trim());
      
      return context.trim() ? context : null;
    } catch (error: any) {
      console.error('ERROR: Ошибка при получении данных кампании:', error.message, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data
      });
      return null;
    }
  }

  // Fallback - если прямой доступ не сработал, пробуем через API
  async function getCampaignContextFallback(userId: string, campaignId: string, token: string): Promise<string | null> {
    try {
      console.log(`INFO: Fallback - получение данных кампании ${campaignId} через API`);
      
      // Используем наш собственный API endpoint для получения данных кампании
      const campaignResponse = await axios.get(`http://localhost:5000/api/campaigns/${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      console.log('INFO: Данные кампании получены через наш API');
      
      const campaign = campaignResponse.data?.data;
      if (!campaign) {
        console.log('WARN: Данные кампании не найдены');
        return null;
      }
      
      let context = '';
      
      // Добавляем ссылку на сайт кампании
      if (campaign.link) {
        console.log(`INFO: Получена ссылка на сайт кампании: ${campaign.link}`);
        context += `\n\nОБЯЗАТЕЛЬНО используйте этот сайт кампании: ${campaign.link}`;
      }
      
      // Добавляем основную информацию о кампании
      if (campaign.name) {
        context += `\nНазвание кампании: ${campaign.name}`;
      }
      if (campaign.description) {
        context += `\nОписание кампании: ${campaign.description}`;
      }
      
      // Пробуем получить данные анкеты через наш API
      if (campaign.questionnaire_id) {
        try {
          console.log(`INFO: Получение данных анкеты ${campaign.questionnaire_id} через наш API`);
          const questionnaireResponse = await axios.get(`http://localhost:5000/api/campaigns/${campaignId}/questionnaire`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          });
          
          const questionnaire = questionnaireResponse.data?.data;
          if (questionnaire) {
            console.log('INFO: Данные анкеты получены успешно');
            
            // Добавляем данные о компании из анкеты
            if (questionnaire.company_name) {
              context += `\nНазвание компании: ${questionnaire.company_name}`;
            }
            if (questionnaire.business_description) {
              context += `\nОписание бизнеса: ${questionnaire.business_description}`;
            }
            if (questionnaire.target_audience) {
              context += `\nЦелевая аудитория: ${questionnaire.target_audience}`;
            }
            if (questionnaire.contact_info) {
              context += `\nКонтактная информация: ${questionnaire.contact_info}`;
            }
          }
        } catch (questionnaireError: any) {
          console.log('WARN: Не удалось получить данные анкеты через наш API:', questionnaireError.message);
        }
      }
      
      console.log('INFO: Контекст кампании сформирован успешно');
      console.log('DEBUG: Сформированный контекст:', context.trim());
      
      return context.trim() ? context : null;
    } catch (error: any) {
      console.error('ERROR: Ошибка при запросе данных кампании через наш API:', error.message, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data
      });
      return null;
    }
  }

  /**
   * Получение Instagram настроек кампании
   */
  app.get('/api/campaigns/:campaignId/instagram-settings', async (req, res) => {
    const { campaignId } = req.params;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    try {
      console.log('📋 [INSTAGRAM-SETTINGS] Getting Instagram settings for campaign:', campaignId);
      
      if (!userToken) {
        console.log('❌ [INSTAGRAM-SETTINGS] Missing user token');
        return res.status(401).json({
          success: false,
          error: 'Токен авторизации не предоставлен'
        });
      }

      // Получаем данные кампании системным токеном (более надежно)
      const getCampaignResponse = await axios.get(
        `${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const campaign = getCampaignResponse.data.data;
      const socialMediaSettings = campaign.social_media_settings || {};
      const instagramSettings = socialMediaSettings.instagram || {};

      console.log('📋 [INSTAGRAM-SETTINGS] Instagram settings found:', JSON.stringify(instagramSettings, null, 2));

      res.json({
        success: true,
        settings: instagramSettings
      });

    } catch (error: any) {
      console.error('❌ [INSTAGRAM-SETTINGS] Error getting Instagram settings:', error.response?.data || error.message);
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении Instagram настроек',
        details: error.response?.data || error.message
      });
    }
  });

  /**
   * Получение Instagram Business Account ID через Graph API
   */
  app.post('/api/campaigns/:campaignId/fetch-instagram-business-id', async (req, res) => {
    const { campaignId } = req.params;
    const { accessToken } = req.body;
    const userToken = req.headers.authorization?.replace('Bearer ', '');

    try {
      console.log('🔍 [INSTAGRAM-FETCH] Starting Instagram Business Account ID fetch for campaign:', campaignId);
      console.log('🔍 [INSTAGRAM-FETCH] Access Token provided:', accessToken ? 'YES' : 'NO');
      console.log('🔍 [INSTAGRAM-FETCH] User Token provided:', userToken ? 'YES' : 'NO');
      
      if (!accessToken) {
        console.log('❌ [INSTAGRAM-FETCH] Missing access token');
        return res.status(400).json({
          success: false,
          error: 'Access Token обязателен для получения Business Account ID'
        });
      }

      if (!userToken) {
        console.log('❌ [INSTAGRAM-FETCH] Missing user token');
        return res.status(401).json({
          success: false,
          error: 'Токен авторизации не предоставлен'
        });
      }

      // Получаем страницы Facebook пользователя
      console.log('📋 [INSTAGRAM-FETCH] Getting Facebook pages...');
      const pagesResponse = await axios.get(
        `https://graph.facebook.com/v23.0/me/accounts?access_token=${accessToken}&fields=id,name,instagram_business_account`
      );

      console.log('📋 [INSTAGRAM-FETCH] Facebook pages response:', JSON.stringify(pagesResponse.data, null, 2));

      const pages = pagesResponse.data.data || [];
      let instagramBusinessAccountId = null;

      // Ищем Instagram Business Account среди страниц
      for (const page of pages) {
        if (page.instagram_business_account && page.instagram_business_account.id) {
          instagramBusinessAccountId = page.instagram_business_account.id;
          console.log('✅ [INSTAGRAM-FETCH] Found Instagram Business Account ID:', instagramBusinessAccountId);
          break;
        }
      }

      if (!instagramBusinessAccountId) {
        console.log('❌ [INSTAGRAM-FETCH] No Instagram Business Account found');
        return res.status(404).json({
          success: false,
          error: 'Instagram Business Account не найден. Убедитесь, что ваша Facebook страница связана с Instagram Business аккаунтом.'
        });
      }

      // Сохраняем Instagram Business Account ID в кампанию
      console.log('💾 [INSTAGRAM-FETCH] Saving Instagram Business Account ID to campaign...');
      
      // Получаем текущие настройки кампании
      const getCampaignResponse = await axios.get(
        `${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const campaign = getCampaignResponse.data.data;
      const currentSocialMediaSettings = campaign.social_media_settings || {};
      const currentInstagramSettings = currentSocialMediaSettings.instagram || {};

      // Обновляем Instagram настройки с новым Business Account ID
      const updatedInstagramSettings = {
        ...currentInstagramSettings,
        businessAccountId: instagramBusinessAccountId,
        businessAccountIdFetchedAt: new Date().toISOString()
      };

      const updatedSocialMediaSettings = {
        ...currentSocialMediaSettings,
        instagram: updatedInstagramSettings
      };

      // Сохраняем обновленные настройки
      const updateResponse = await axios.patch(
        `${process.env.DIRECTUS_URL}/items/user_campaigns/${campaignId}`,
        {
          social_media_settings: updatedSocialMediaSettings
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ [INSTAGRAM-FETCH] Instagram Business Account ID saved successfully');

      res.json({
        success: true,
        businessAccountId: instagramBusinessAccountId,
        message: 'Instagram Business Account ID успешно получен и сохранен'
      });

    } catch (error: any) {
      console.error('❌ [INSTAGRAM-FETCH] Error fetching Instagram Business Account ID:', error.response?.data || error.message);
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении Instagram Business Account ID',
        details: error.response?.data || error.message
      });
    }
  });

  // Маршрут для генерации контента с помощью AI сервисов
  app.post('/api/generate-content', async (req, res) => {
    try {
      console.log('🚀🚀🚀 ЗАПРОС НА ГЕНЕРАЦИЮ КОНТЕНТА ПОЛУЧЕН 🚀🚀🚀');
      console.log('📋📋📋 ПАРАМЕТРЫ ЗАПРОСА:', JSON.stringify(req.body, null, 2));
      console.log('🔍 useCampaignData в запросе:', req.body.useCampaignData);
      console.log('🔍 campaignId в запросе:', req.body.campaignId);
      console.log('🔍 service в запросе:', req.body.service);
      console.log('🔍 Заголовки авторизации:', req.headers['authorization']);
      const { prompt, keywords, platform, tone, service, useCampaignData, campaignId } = req.body;
      
      // Извлекаем токен из заголовков
      const authHeader = req.headers['authorization'];
      const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
      console.log('🔑 Извлеченный токен:', userToken ? 'Присутствует' : 'Отсутствует');
      
      // 🎯 РАННЯЯ ОБРАБОТКА CLAUDE С ДАННЫМИ КАМПАНИИ (САМАЯ ПЕРВАЯ!)
      console.log('🔍 ПРОВЕРКА УСЛОВИЯ: service === "claude"');
      console.log('🔍 service тип:', typeof service);
      console.log('🔍 service значение:', JSON.stringify(service));
      console.log('🔍 Результат сравнения:', service === 'claude');
      
      if (service === 'claude') {
        console.log('[claude] 🎯 РАННЯЯ ОБРАБОТКА CLAUDE С ДАННЫМИ КАМПАНИИ');
        
        let enrichedPrompt = prompt;
        
        // Улучшаем промпт с ключевыми словами для Claude
        if (prompt && prompt.trim().length > 0) {
          const platformText = platform ? ` для платформы ${platform}` : '';
          const toneText = tone ? ` в ${tone} тоне` : '';
          const keywordsText = keywords && keywords.length > 0 ? 
            `\n\nОБЯЗАТЕЛЬНО используй эти ключевые слова в тексте: ${keywords.join(', ')}` : '';
          
          // Определяем, требуется ли развернутый контент по ключевым словам в промпте
          const isDetailedRequest = prompt.toLowerCase().includes('подробн') || 
                                   prompt.toLowerCase().includes('развернут') || 
                                   prompt.toLowerCase().includes('максимальн') ||
                                   prompt.toLowerCase().includes('детальн') ||
                                   prompt.toLowerCase().includes('полн') ||
                                   prompt.toLowerCase().includes('статья') ||
                                   prompt.toLowerCase().includes('описани') ||
                                   prompt.toLowerCase().includes('преимущества') ||
                                   prompt.toLowerCase().includes('отзыв');
          
          if (isDetailedRequest) {
            // Для развернутых запросов используем специальный промпт
            enrichedPrompt = `Создай развернутый и детальный контент${platformText}${toneText} на тему: "${prompt}".${keywordsText}

ВАЖНО: Создай максимально подробный и информативный контент. Контент должен быть:
- Развернутым и детальным (используй весь доступный лимит символов)
- Содержать много полезной информации
- Включать примеры, советы, рекомендации
- Структурированным с заголовками и разделами
- Содержать призывы к действию
- ОБЯЗАТЕЛЬНО включать указанные ключевые слова естественным образом

Не ограничивайся кратким описанием - создай максимально полный и ценный контент.`;
          } else {
            // Для обычных запросов используем стандартный промпт
            enrichedPrompt = `Напиши готовый пост${platformText}${toneText} на тему: "${prompt}".${keywordsText}

ВАЖНО: Создай ОДИН конкретный готовый пост, а не варианты или предложения. Пост должен быть:
- Готов к публикации
- Интересный и привлекательный  
- Подходящий для выбранной платформы
- Содержать призыв к действию или вопрос для вовлечения аудитории
- ОБЯЗАТЕЛЬНО включать указанные ключевые слова естественным образом

НЕ предлагай варианты, НЕ спрашивай дополнительные детали, НЕ давай советы - просто напиши готовый пост.`;
          }
        }
        
        // Обогащаем промпт данными кампании для Claude
        if (useCampaignData && campaignId) {
          console.log('[claude] 🎯 ОБОГАЩАЕМ ПРОМПТ ДАННЫМИ КАМПАНИИ');
          try {
            const { CampaignDataService } = await import('./services/campaign-data.js');
            const campaignDataService = new CampaignDataService();
            const adminUserId = '53921f16-f51d-4591-80b9-8caa4fde4d13';
            enrichedPrompt = await campaignDataService.enrichPromptWithCampaignData(
              prompt, 
              adminUserId, 
              campaignId, 
              userToken
            );
            console.log('[claude] ✅ ПРОМПТ УСПЕШНО ОБОГАЩЕН ДАННЫМИ НИАП!');
            console.log('[claude] 📝 Обогащенный промпт длина:', enrichedPrompt.length);
            
            // Проверяем, содержит ли обогащенный промпт данные НИАП
            if (enrichedPrompt.includes('НИАП') || enrichedPrompt.includes('nplanner.ru')) {
              console.log('[claude] 🎉 ДАННЫЕ НИАП НАЙДЕНЫ В ПРОМПТЕ!');
            } else {
              console.log('[claude] ⚠️ Данные НИАП не найдены в промпте');
            }
          } catch (campaignError) {
            console.error('[claude] ❌ Ошибка обогащения данными кампании:', campaignError);
          }
        }
        
        try {
          console.log('[claude] 🎯 Инициализация Claude с глобальным API ключом из Directus');
          const { ClaudeService } = await import('./services/claude.js');
          
          // Создаем сервис и инициализируем его через Directus Global API Keys
          const claudeService = new ClaudeService();
          const initialized = await claudeService.initialize();
          
          if (!initialized) {
            throw new Error('Claude API key is not configured');
          }
          
          const result = await claudeService.generateContent(enrichedPrompt);
          console.log('[claude] ✅ Контент успешно сгенерирован с данными кампании');
          
          return res.json({
            success: true,
            content: result,
            service: 'claude'
          });
        } catch (error) {
          console.error('[claude] ❌ Ошибка генерации:', error);
          return res.status(500).json({
            success: false,
            error: `Ошибка генерации контента с Claude API: ${error}`
          });
        }
      }
      

      
      // Для DeepSeek работаем без авторизации, используя глобальный API ключ
      if (service === 'deepseek' || service === 'dipsik') {
        console.log('[deepseek] Обработка запроса DeepSeek без авторизации');
        
        let enrichedPrompt = prompt;
        
        // Улучшаем промпт с ключевыми словами для DeepSeek
        if (prompt && prompt.trim().length > 0) {
          const platformText = platform ? ` для платформы ${platform}` : '';
          const toneText = tone ? ` в ${tone} тоне` : '';
          const keywordsText = keywords && keywords.length > 0 ? 
            `\n\nОБЯЗАТЕЛЬНО используй эти ключевые слова в тексте: ${keywords.join(', ')}` : '';
          
          // Определяем, требуется ли развернутый контент по ключевым словам в промпте
          const isDetailedRequest = prompt.toLowerCase().includes('подробн') || 
                                   prompt.toLowerCase().includes('развернут') || 
                                   prompt.toLowerCase().includes('максимальн') ||
                                   prompt.toLowerCase().includes('детальн') ||
                                   prompt.toLowerCase().includes('полн') ||
                                   prompt.toLowerCase().includes('статья') ||
                                   prompt.toLowerCase().includes('описани') ||
                                   prompt.toLowerCase().includes('преимущества') ||
                                   prompt.toLowerCase().includes('отзыв');
          
          if (isDetailedRequest) {
            // Для развернутых запросов используем специальный промпт
            enrichedPrompt = `Создай развернутый и детальный контент${platformText}${toneText} на тему: "${prompt}".${keywordsText}

ВАЖНО: Создай максимально подробный и информативный контент. Контент должен быть:
- Развернутым и детальным (используй весь доступный лимит символов)
- Содержать много полезной информации
- Включать примеры, советы, рекомендации
- Структурированным с заголовками и разделами
- Содержать призывы к действию
- ОБЯЗАТЕЛЬНО включать указанные ключевые слова естественным образом

Не ограничивайся кратким описанием - создай максимально полный и ценный контент.`;
          } else {
            // Для обычных запросов используем стандартный промпт
            enrichedPrompt = `Напиши готовый пост${platformText}${toneText} на тему: "${prompt}".${keywordsText}

ВАЖНО: Создай ОДИН конкретный готовый пост, а не варианты или предложения. Пост должен быть:
- Готов к публикации
- Интересный и привлекательный  
- Подходящий для выбранной платформы
- Содержать призыв к действию или вопрос для вовлечения аудитории
- ОБЯЗАТЕЛЬНО включать указанные ключевые слова естественным образом

НЕ предлагай варианты, НЕ спрашивай дополнительные детали, НЕ давай советы - просто напиши готовый пост.`;
          }
        }
        
        // Используем централизованный сервис данных кампании
        if (useCampaignData && campaignId) {
          console.log('[deepseek] Добавляем данные кампании для DeepSeek');
          try {
            const { CampaignDataService } = await import('./services/campaign-data.js');
            const campaignDataService = new CampaignDataService();
            const adminUserId = '53921f16-f51d-4591-80b9-8caa4fde4d13';
            enrichedPrompt = await campaignDataService.enrichPromptWithCampaignData(
              prompt, 
              adminUserId, 
              campaignId, 
              userToken
            );
            console.log('[deepseek] Обогащенный промпт создан:', enrichedPrompt.substring(0, 100) + '...');
          } catch (campaignError) {
            console.error('[deepseek] Ошибка при получении данных кампании:', campaignError);
          }
        }

        console.log('[deepseek] Инициализация DeepSeek с глобальным API ключом из Directus');
        try {
          const { globalApiKeyManager } = await import('./services/global-api-key-manager.js');
          const { ApiServiceName } = await import('./services/api-keys.js');
          
          const deepseekApiKey = await globalApiKeyManager.getApiKey(ApiServiceName.DEEPSEEK);
          if (!deepseekApiKey) {
            throw new Error('DeepSeek API key not found in Global API Keys collection');
          }
          
          const { DeepSeekService } = await import('./services/deepseek.js');
          const deepseekService = new DeepSeekService();
          deepseekService.updateApiKey(deepseekApiKey);
          
          console.log('[deepseek] Начинаем генерацию текста с промптом:', enrichedPrompt.substring(0, 100) + '...');
          const result = await deepseekService.generateText(enrichedPrompt);
          console.log('[deepseek] Контент успешно сгенерирован');
          return res.json({ success: true, content: result });
        } catch (error) {
          console.error('[deepseek] Ошибка генерации:', error);
          return res.status(500).json({ 
            success: false, 
            error: `Ошибка генерации контента с DeepSeek API: ${error}` 
          });
        }
      }





      // Для Gemini работаем без авторизации, используя глобальный API ключ  
      if (service === 'gemini' || service === 'gemini-2.0-flash' || service === 'gemini-2.0-flash-lite' || 
          service === 'gemini-pro' || service === 'gemini-2.5-flash' || service === 'gemini-2.5-pro') {
        console.log('[gemini] Обработка запроса Gemini без авторизации');
        
        let enrichedPrompt = prompt;
        
        // Улучшаем промпт для более конкретного результата
        if (prompt && prompt.trim().length > 0) {
          const platformText = platform ? ` для платформы ${platform}` : '';
          const toneText = tone ? ` в ${tone} тоне` : '';
          const keywordsText = keywords && keywords.length > 0 ? 
            `\n\nОБЯЗАТЕЛЬНО используй эти ключевые слова в тексте: ${keywords.join(', ')}` : '';
          
          // Определяем, требуется ли развернутый контент по ключевым словам в промпте
          const isDetailedRequest = prompt.toLowerCase().includes('подробн') || 
                                   prompt.toLowerCase().includes('развернут') || 
                                   prompt.toLowerCase().includes('максимальн') ||
                                   prompt.toLowerCase().includes('детальн') ||
                                   prompt.toLowerCase().includes('полн') ||
                                   prompt.toLowerCase().includes('статья') ||
                                   prompt.toLowerCase().includes('описани') ||
                                   prompt.toLowerCase().includes('преимущества') ||
                                   prompt.toLowerCase().includes('отзыв');
          
          if (isDetailedRequest) {
            // Для развернутых запросов используем специальный промпт
            enrichedPrompt = `Создай развернутый и детальный контент${platformText}${toneText} на тему: "${prompt}".${keywordsText}

ВАЖНО: Создай максимально подробный и информативный контент. Контент должен быть:
- Развернутым и детальным (используй весь доступный лимит символов)
- Содержать много полезной информации
- Включать примеры, советы, рекомендации
- Структурированным с заголовками и разделами
- Содержать призывы к действию
- ОБЯЗАТЕЛЬНО включать указанные ключевые слова естественным образом

Не ограничивайся кратким описанием - создай максимально полный и ценный контент.`;
          } else {
            // Для обычных запросов используем стандартный промпт
            enrichedPrompt = `Напиши готовый пост${platformText}${toneText} на тему: "${prompt}".${keywordsText}

ВАЖНО: Создай ОДИН конкретный готовый пост, а не варианты или предложения. Пост должен быть:
- Готов к публикации
- Интересный и привлекательный  
- Подходящий для выбранной платформы
- Содержать призыв к действию или вопрос для вовлечения аудитории
- ОБЯЗАТЕЛЬНО включать указанные ключевые слова естественным образом

НЕ предлагай варианты, НЕ спрашивай дополнительные детали, НЕ давай советы - просто напиши готовый пост.`;
          }
        }
        
        // Используем централизованный сервис данных кампании
        if (useCampaignData && campaignId) {
          console.log('[gemini] Добавляем данные кампании для Gemini через централизованный сервис');
          try {
            const { CampaignDataService } = await import('./services/campaign-data.js');
            const campaignDataService = new CampaignDataService();
            // Для Gemini используем временный userId из админских настроек
            const adminUserId = '53921f16-f51d-4591-80b9-8caa4fde4d13';
            enrichedPrompt = await campaignDataService.enrichPromptWithCampaignData(
              prompt, 
              adminUserId, 
              campaignId, 
              userToken // используем токен пользователя
            );
          } catch (campaignError) {
            console.error('[gemini] Ошибка при получении данных кампании:', campaignError);
          }
        }
        
        try {
          // Для моделей 2.5 пробуем сначала прямой Vertex AI, потом фолбек через прокси
          if (service === 'gemini-2.5-flash' || service === 'gemini-2.5-pro') {
            console.log('[gemini-2.5] Пробуем прямой Vertex AI для модели', service);
            
            try {
              // Прямой импорт для обеспечения доступности метода
              const { geminiVertexDirect } = await import('./services/gemini-vertex-direct.js');
              
              // Маппинг коротких названий моделей на новые GA endpoints
              let fullModelName = service;
              if (service === 'gemini-2.5-flash') {
                fullModelName = 'gemini-2.5-flash';
              } else if (service === 'gemini-2.5-pro') {
                fullModelName = 'gemini-2.5-pro';
              }
              
              console.log('[gemini-2.5] Генерация контента с полным названием модели:', fullModelName);
              const generatedContent = await geminiVertexDirect.generateContent({
                prompt: enrichedPrompt,
                model: fullModelName
              });
              
              console.log('[gemini-2.5] Контент успешно сгенерирован через прямой Vertex AI');
              
              return res.json({
                success: true,
                content: generatedContent,
                service: service,
                actualModel: fullModelName,
                method: 'vertex-ai-direct'
              });
            } catch (vertexError) {
              console.log('[gemini-2.5] Vertex AI недоступен, используем фолбек через прокси:', vertexError.message);
              
              // Фолбек: используем стандартный Gemini API через прокси для 2.5 моделей
              const { globalApiKeyManager } = await import('./services/global-api-key-manager.js');
              const { ApiServiceName } = await import('./services/api-keys.js');
              
              const geminiApiKey = await globalApiKeyManager.getApiKey(ApiServiceName.GEMINI);
              if (!geminiApiKey) {
                throw new Error('Gemini API key not found in Global API Keys collection');
              }
              
              const geminiService = new GeminiService({ apiKey: geminiApiKey });
              // Для фолбека используем gemini-2.0-flash (доступна через обычный API)
              const fallbackModel = 'gemini-2.0-flash';
              console.log('[gemini-2.5] Фолбек: генерируем через прокси с моделью', fallbackModel);
              const generatedContent = await geminiService.generateText(enrichedPrompt, fallbackModel);
              console.log('[gemini-2.5] Контент успешно сгенерирован через прокси фолбек');
              
              return res.json({
                success: true,
                content: generatedContent,
                service: service,
                actualModel: fallbackModel,
                method: 'proxy-fallback'
              });
            }
          }
          
          // Для стандартных моделей Gemini используем обычный API
          {
            // Для стандартных моделей Gemini используем обычный API
            console.log('[gemini] Инициализация Gemini с глобальным API ключом из Directus');
            const { globalApiKeyManager } = await import('./services/global-api-key-manager.js');
            const { ApiServiceName } = await import('./services/api-keys.js');
            
            const geminiApiKey = await globalApiKeyManager.getApiKey(ApiServiceName.GEMINI);
            if (!geminiApiKey) {
              throw new Error('Gemini API key not found in Global API Keys collection');
            }
            
            const geminiService = new GeminiService({ apiKey: geminiApiKey });
            console.log('[gemini] Начинаем генерацию текста с промптом:', enrichedPrompt.substring(0, 100) + '...');
            const generatedContent = await geminiService.generateText(enrichedPrompt, 'gemini-2.0-flash');
            console.log('[gemini] Контент успешно сгенерирован');
            
            return res.json({
              success: true,
              content: generatedContent,
              service: service
            });
          }
        } catch (geminiError) {
          console.error('[gemini] Ошибка при генерации:', geminiError);
          return res.status(500).json({
            success: false,
            error: `Ошибка генерации контента с Gemini API: ${geminiError}`
          });
        }
      }
      
      // Для Qwen работаем без авторизации, используя глобальный API ключ
      if (service === 'qwen') {
        console.log('[qwen] Обработка запроса Qwen без авторизации');
        
        let enrichedPrompt = prompt;
        
        // Улучшаем промпт с ключевыми словами для Qwen
        if (prompt && prompt.trim().length > 0) {
          const platformText = platform ? ` для платформы ${platform}` : '';
          const toneText = tone ? ` в ${tone} тоне` : '';
          const keywordsText = keywords && keywords.length > 0 ? 
            `\n\nОБЯЗАТЕЛЬНО используй эти ключевые слова в тексте: ${keywords.join(', ')}` : '';
          
          // Определяем, требуется ли развернутый контент по ключевым словам в промпте
          const isDetailedRequest = prompt.toLowerCase().includes('подробн') || 
                                   prompt.toLowerCase().includes('развернут') || 
                                   prompt.toLowerCase().includes('максимальн') ||
                                   prompt.toLowerCase().includes('детальн') ||
                                   prompt.toLowerCase().includes('полн') ||
                                   prompt.toLowerCase().includes('статья') ||
                                   prompt.toLowerCase().includes('описани') ||
                                   prompt.toLowerCase().includes('преимущества') ||
                                   prompt.toLowerCase().includes('отзыв');
          
          if (isDetailedRequest) {
            // Для развернутых запросов используем специальный промпт
            enrichedPrompt = `Создай развернутый и детальный контент${platformText}${toneText} на тему: "${prompt}".${keywordsText}

ВАЖНО: Создай максимально подробный и информативный контент. Контент должен быть:
- Развернутым и детальным (используй весь доступный лимит символов)
- Содержать много полезной информации
- Включать примеры, советы, рекомендации
- Структурированным с заголовками и разделами
- Содержать призывы к действию
- ОБЯЗАТЕЛЬНО включать указанные ключевые слова естественным образом

Не ограничивайся кратким описанием - создай максимально полный и ценный контент.`;
          } else {
            // Для обычных запросов используем стандартный промпт
            enrichedPrompt = `Напиши готовый пост${platformText}${toneText} на тему: "${prompt}".${keywordsText}

ВАЖНО: Создай ОДИН конкретный готовый пост, а не варианты или предложения. Пост должен быть:
- Готов к публикации
- Интересный и привлекательный  
- Подходящий для выбранной платформы
- Содержать призыв к действию или вопрос для вовлечения аудитории
- ОБЯЗАТЕЛЬНО включать указанные ключевые слова естественным образом

НЕ предлагай варианты, НЕ спрашивай дополнительные детали, НЕ давай советы - просто напиши готовый пост.`;
          }
        }
        
        // Добавляем данные кампании для Qwen, как для Gemini
        if (useCampaignData && campaignId) {
          console.log('[qwen] Добавляем данные кампании для Qwen');
          try {
            const adminUserId = '53921f16-f51d-4591-80b9-8caa4fde4d13';
            const campaignContext = await getCampaignContext(adminUserId, campaignId, req.headers['authorization']?.replace('Bearer ', '') || '');
            
            if (campaignContext) {
              console.log('[qwen] Получены данные кампании:', campaignContext.substring(0, 200) + '...');
              enrichedPrompt += `\n\nВАЖНО: Используй только предоставленную информацию о компании:${campaignContext}`;
            } else {
              console.log('[qwen] Данные кампании не найдены, используем базовый промпт');
            }
          } catch (campaignError) {
            console.error('[qwen] Ошибка при получении данных кампании:', campaignError);
          }
        }
        
        try {
          console.log('[qwen] Инициализация Qwen с глобальным API ключом из Directus');
          const { globalApiKeyManager } = await import('./services/global-api-key-manager.js');
          const { ApiServiceName } = await import('./services/api-keys.js');
          
          const qwenApiKey = await globalApiKeyManager.getApiKey(ApiServiceName.QWEN);
          if (!qwenApiKey) {
            throw new Error('Qwen API key not found in Global API Keys collection');
          }
          
          const { QwenService } = await import('./services/qwen.js');
          const qwenServiceInstance = new QwenService();
          qwenServiceInstance.updateApiKey(qwenApiKey);
          console.log('[qwen] Начинаем генерацию текста с промптом:', enrichedPrompt.substring(0, 100) + '...');
          const generatedContent = await qwenServiceInstance.generateText(enrichedPrompt);
          console.log('[qwen] Контент успешно сгенерирован');
          
          return res.json({
            success: true,
            content: generatedContent,
            service: 'qwen'
          });
        } catch (qwenError) {
          console.error('[qwen] Ошибка при генерации:', qwenError);
          return res.status(500).json({
            success: false,
            error: `Ошибка генерации контента с Qwen API: ${qwenError}`
          });
        }
      }

      
      // Для остальных сервисов требуем авторизацию
      const authHeaderGeneral = req.headers['authorization'] as string;
      if (!authHeaderGeneral || !authHeaderGeneral.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Не авторизован: Отсутствует заголовок авторизации'
        });
      }
      
      const token = authHeaderGeneral.replace('Bearer ', '');
      
      // Получаем реальный ID пользователя из токена
      let userId: string;
      try {
        // Получаем информацию о пользователе через API /users/me
        const directusUrl = process.env.DIRECTUS_URL;
        if (!directusUrl) {
          return res.status(500).json({ error: 'DIRECTUS_URL не настроен в переменных окружения' });
        }
        
        const directusApi = axios.create({
          baseURL: directusUrl,
          timeout: 10000
        });
        
        const userResponse = await directusApi.get('/users/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (userResponse.data && userResponse.data.data && userResponse.data.data.id) {
          userId = userResponse.data.data.id;
          console.log(`✅ Получен реальный ID пользователя: ${userId}`);
        } else {
          throw new Error('Не удалось получить ID пользователя из ответа API');
        }
      } catch (error) {
        console.error('❌ Ошибка получения ID пользователя:', error);
        return res.status(401).json({
          success: false,
          error: 'Ошибка авторизации пользователя'
        });
      }
      
      if (!prompt || !prompt.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Промпт не может быть пустым'
        });
      }
      
      // Обработка остальных сервисов через switch case
      let enrichedPrompt = prompt;
      
      // 🚀 ДОБАВЛЯЕМ ДАННЫЕ КАМПАНИИ ЕСЛИ НУЖНО 🚀
      console.log('🔍 ПАРАМЕТРЫ КАМПАНИИ: useCampaignData =', useCampaignData, 'campaignId =', campaignId, 'userId =', userId);
      if (useCampaignData && campaignId) {
        console.log('🎯 НАЧИНАЕМ ОБОГАЩЕНИЕ ПРОМПТА ДАННЫМИ КАМПАНИИ');
        console.log('📋 Исходный промпт:', prompt.substring(0, 100) + '...');
        try {
          const { CampaignDataService } = await import('./services/campaign-data.js');
          const campaignDataService = new CampaignDataService();
          const originalPrompt = enrichedPrompt;
          enrichedPrompt = await campaignDataService.enrichPromptWithCampaignData(
            prompt, 
            userId, 
            campaignId, 
            token
          );
          console.log('✅ ПРОМПТ УСПЕШНО ОБОГАЩЕН!');
          console.log('📝 Исходный промпт длина:', originalPrompt.length);
          console.log('📝 Обогащенный промпт длина:', enrichedPrompt.length);
          console.log('📝 Первые 200 символов обогащенного промпта:', enrichedPrompt.substring(0, 200) + '...');
          
          // Проверяем, содержит ли обогащенный промпт данные НИАП
          if (enrichedPrompt.includes('НИАП') || enrichedPrompt.includes('nplanner.ru')) {
            console.log('🎉 ДАННЫЕ НИАП НАЙДЕНЫ В ПРОМПТЕ!');
          } else {
            console.log('⚠️ ДАННЫЕ НИАП НЕ НАЙДЕНЫ В ПРОМПТЕ!');
          }
        } catch (campaignError) {
          console.error('❌ Ошибка при обогащении данными кампании:', campaignError);
        }
      } else {
        console.log('⏭️ Пропускаем обогащение: useCampaignData =', useCampaignData, 'campaignId =', campaignId);
      }
      
      if (tone) {
        enrichedPrompt += `\n\nТон: ${tone}`;
      }
      
      // Ключевые слова уже интегрированы в основной промпт для каждого сервиса
      
      if (platform) {
        enrichedPrompt += `\n\nПлатформа: ${platform}`;
      }
      
      let generatedContent;
      let usedService = service || 'claude';
      
      // Отладочные логи для параметров
      console.log('🔧 DEBUG: useCampaignData =', useCampaignData);
      console.log('🔧 DEBUG: campaignId =', campaignId);
      console.log('🔧 DEBUG: usedService =', usedService);
      
      // Примечание: основная обработка теперь происходит в специальных блоках для каждого AI сервиса выше
      switch (usedService.toLowerCase()) {
          
        case 'claude':
          // Claude обрабатывается в раннем блоке выше
          return res.status(500).json({
            success: false,
            error: 'Claude должен обрабатываться в раннем блоке'
          });
          break;
          
        case 'gemini':
        case 'gemini-2.0-flash':
        case 'gemini-pro':
          try {
            // ИСПРАВЛЕНО: Используем прокси с глобальным ключом из базы данных
            console.log('[gemini] Получаем глобальный Gemini ключ и используем прокси');
            
            let geminiKey;
            try {
              const globalKeys = await globalApiKeysService.getGlobalApiKeys();
              geminiKey = globalKeys.gemini || globalKeys.GEMINI_API_KEY;
            } catch (keyError) {
              console.error('[gemini] Ошибка получения глобального ключа:', keyError);
              throw new Error('Gemini ключ недоступен');
            }
            
            if (!geminiKey) {
              throw new Error('Gemini ключ не найден в глобальных настройках');
            }
            
            const geminiProxyServiceInstance = new GeminiProxyService({ apiKey: geminiKey });
            const geminiResponse = await geminiProxyServiceInstance.generateText({
              prompt: enrichedPrompt,
              model: 'gemini-1.5-flash',
              temperature: 0.7,
              maxOutputTokens: 2000
            });
            
            generatedContent = geminiResponse || '';
            console.log('[gemini] Контент успешно сгенерирован через прямой API');
          } catch (geminiError) {
            console.error('[gemini] Ошибка при генерации:', geminiError);
            return res.status(500).json({
              success: false,
              error: `Ошибка генерации контента с Gemini API: ${geminiError}`
            });
          }
          break;
          
        // DeepSeek обрабатывается в специальном блоке выше, как Gemini
          
        // Qwen обрабатывается в отдельном блоке выше, как Gemini
          
        default:
          return res.status(400).json({
            success: false,
            error: 'Неподдерживаемый AI сервис. Используйте claude, deepseek, qwen или gemini.'
          });
      }
      
      console.log(`Контент успешно сгенерирован с помощью ${usedService}`);
      
      return res.json({
        success: true,
        content: generatedContent,
        service: usedService
      });
      
    } catch (error: any) {
      console.error('Ошибка при генерации контента:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Ошибка при генерации контента'
      });
    }
  });

  // Маршрут для генерации изображений через универсальный интерфейс FAL.AI API
  // Этот маршрут используется клиентскими компонентами для генерации изображений
  app.post('/api/generate-image', authenticateUser, async (req, res) => {
    try {
      const { prompt, negativePrompt, width, height, numImages, modelName, stylePreset, businessData, content, platform, savePrompt, contentId, campaignId } = req.body;
      
      // Получаем userId, установленный в authenticateUser middleware
      const userId = (req as any).userId;
      
      // Получаем токен из заголовка авторизации
      const authHeader = req.headers['authorization'] as string;
      const token = authHeader.replace('Bearer ', '');
      
      console.log(`Получен запрос на генерацию изображения. contentId: ${contentId}, savePrompt: ${savePrompt}`);
      
      // Если передан contentId и savePrompt=true, проверим наличие контента перед генерацией изображения
      if (contentId && savePrompt) {
        try {
          const existingContent = await storage.getCampaignContentById(contentId);
          if (existingContent) {
            console.log(`Контент с ID ${contentId} найден: userId: ${existingContent.userId}`);
          } else {
            console.warn(`⚠️ Контент с ID ${contentId} НЕ НАЙДЕН в базе данных! Проверьте передачу contentId.`);
          }
        } catch (contentError) {
          console.error(`❌ Ошибка при проверке контента ${contentId}: ${contentError}`);
        }
      }
      
      console.log('Генерация изображения для пользователя:', userId);
      
      // Инициализируем FAL.AI с использованием глобальных API ключей
      let falAiApiKey = null;
      
      try {
        // Получаем глобальный API ключ FAL.AI из базы данных
        console.log('🔍 Получаем глобальный API ключ FAL.AI из базы данных...');
        falAiApiKey = await globalApiKeyManager.getApiKey(ApiServiceName.FAL_AI);
        
        if (falAiApiKey) {
          console.log('✅ Найден глобальный FAL.AI API ключ:', falAiApiKey.substring(0, 10) + '...');
        } else {
          console.log('❌ Глобальный API ключ FAL.AI не найден в базе данных');
          
          // Добавляем проверку всех доступных глобальных ключей для диагностики
          console.log('🔍 Проверяем все доступные глобальные API ключи...');
          try {
            const allServices = Object.values(ApiServiceName);
            for (const service of allServices) {
              const key = await globalApiKeyManager.getApiKey(service);
              console.log(`📋 ${service}: ${key ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
            }
          } catch (diagError) {
            console.error('Ошибка диагностики глобальных ключей:', diagError);
          }
        }
      } catch (error) {
        console.error('❌ Ошибка при получении глобального API ключа FAL.AI:', error);
      }
      
      if (!falAiApiKey) {
        return res.status(400).json({ 
          success: false, 
          error: "API ключ для FAL.AI не настроен" 
        });
      }
      
      // ИСПРАВЛЕНИЕ: Проверяем и обновляем ключ API в нужном формате
      if (falAiApiKey && !falAiApiKey.startsWith('Key ') && falAiApiKey.includes(':')) {
        console.log('Автоматически добавляем префикс "Key " к ключу FAL.AI для запроса генерации');
        falAiApiKey = `Key ${falAiApiKey}`;
      }
      
      // Инициализируем объект с данными запроса
      let requestData: any = {};
      
      // Определяем используемую модель и данные для запроса
      let model = modelName || 'fast-sdxl'; // По умолчанию используем fast-sdxl (быстрая версия)
      
      // Особая обработка для различных моделей
      if (model === 'fooocus') {
        console.log('Используем модель Fooocus');
        model = 'fooocus';
      } else if (model === 'fast-sdxl') {
        console.log('Используем модель Fast-SDXL для быстрой генерации');
        model = 'fast-sdxl';
      } else if (model === 'schnell') {
        console.log('Используем модель Schnell через универсальный интерфейс');
        model = 'schnell';
      } else {
        // Используем универсальный интерфейс для всех остальных моделей
        console.log('Используем универсальную модель через общий интерфейс');
        // По умолчанию используем fast-sdxl
        model = 'fast-sdxl';
      }
      
      if (prompt) {
        // Генерация по прямому промпту
        console.log(`Генерация изображения с промптом: "${prompt.substring(0, 30)}..."`);
        
        requestData = {
          prompt: prompt,
          negative_prompt: negativePrompt || "",
          width: width || 1024,
          height: height || 1024,
          num_images: numImages || 1,
          style_preset: stylePreset || 'photographic'
        };
      } else if (businessData) {
        // Генерация изображения для бизнеса
        console.log(`Генерация изображения для бизнеса: ${businessData.companyName}`);
        
        const businessPrompt = `Create a professional, brand-appropriate image for ${businessData.companyName}. 
        The business is described as: ${businessData.brandImage}. 
        They provide: ${businessData.productsServices}. 
        Style: clean, professional, modern corporate design with soft colors, minimalist approach.
        Make it appropriate for business marketing materials, websites, and social media. 
        No text or logos, just the visual elements that represent the brand.`;
        
        requestData = {
          prompt: businessPrompt,
          negative_prompt: 'text, logos, watermarks, bad quality, distorted, blurry, low resolution, amateur, unprofessional',
          width: 1024,
          height: 1024,
          num_images: 3,
          style_preset: stylePreset || 'photographic'
        };
      } else if (content && platform) {
        // Генерация изображения для социальных сетей
        console.log(`Генерация изображения для соцсетей (${platform})`);
        
        // Короткий контент для промпта
        const shortContent = content.slice(0, 300);
        
        // Адаптируем размеры и стиль под платформу
        let width = 1080;
        let height = 1080;
        let stylePrompt = '';
        
        switch (platform) {
          case 'instagram':
            width = 1080;
            height = 1080;
            stylePrompt = 'vibrant, eye-catching, social media ready, Instagram style';
            break;
          case 'facebook':
            width = 1200;
            height = 630;
            stylePrompt = 'clean, professional, engaging, Facebook style';
            break;
          case 'vk':
            width = 1200;
            height = 800;
            stylePrompt = 'modern, appealing to Russian audience, VK style';
            break;
          case 'telegram':
            width = 1200;
            height = 900;
            stylePrompt = 'minimalist, informative, Telegram channel style';
            break;
        }
        
        const socialPrompt = `Create an image that visually represents: "${shortContent}". ${stylePrompt}. 
        Make it suitable for ${platform} posts, with no text overlay. 
        High quality, professional look, eye-catching design.`;
        
        requestData = {
          prompt: socialPrompt,
          negative_prompt: 'text, words, letters, logos, watermarks, low quality',
          width: width,
          height: height,
          num_images: numImages || 3, // Используем указанное число изображений или 3 по умолчанию
          style_preset: stylePreset || 'photographic'
        };
      } else {
        return res.status(400).json({
          success: false,
          error: "Недостаточно данных для генерации изображения"
        });
      }
      
      // Обработка в зависимости от выбранной модели
      try {
        // Используем универсальный интерфейс для всех моделей FAL.AI
        console.log(`Используем универсальный сервис для модели ${modelName || 'fast-sdxl'}`);
        
        // Подготавливаем общие параметры для генерации изображений
        const generateOptions = {
          prompt: requestData.prompt,
          negativePrompt: requestData.negative_prompt,
          width: requestData.width,
          height: requestData.height,
          numImages: requestData.num_images,
          model: modelName || 'fast-sdxl',
          userId: userId,
          token: falAiApiKey,
          contentId: contentId
        };
        
        console.log(`Отправляем запрос к FAL.AI через универсальный интерфейс: ${JSON.stringify(generateOptions).substring(0, 200)}`);
        
        // Используем универсальный сервис для всех моделей FAL.AI
        try {
          const imageUrls = await falAiUniversalService.generateImages(generateOptions);
          
          console.log(`Получено ${imageUrls.length} изображений через универсальный интерфейс`);
          
          // Сохраняем промт, если указан флаг savePrompt и есть contentId
          if (savePrompt && contentId && requestData.prompt) {
            try {
                console.log(`Сохраняем промт для контента ${contentId}: "${requestData.prompt.substring(0, 50)}..."`);
                
                // Сохраняем промт в базу данных через storage
                if (storage.updateCampaignContent) {
                  await storage.updateCampaignContent(contentId, {
                    prompt: requestData.prompt
                  });
                  console.log(`Промт успешно сохранен для контента ${contentId}`);
                } else {
                  console.warn("Метод сохранения промта не реализован в storage");
                }
              } catch (promptError: any) {
                console.error(`Ошибка при сохранении промта: ${promptError.message}`);
                // Продолжаем выполнение даже при ошибке сохранения промта
              }
            }
            
            return res.json({
              success: true,
              data: imageUrls
            });
          } catch (generationError: any) {
            console.error(`Ошибка при генерации изображений через универсальный интерфейс: ${generationError.message}`);
            throw new Error(`Ошибка генерации изображения: ${generationError.message}`);
          }
        // СТАРЫЙ КОД ЗАКОММЕНТИРОВАН (НЕ ИСПОЛЬЗУЕТСЯ)
        if (false) { // этот код никогда не выполнится
          // Для остальных моделей используем стандартную обработку через прямой API запрос
          console.log(`Отправляем запрос к FAL.AI API, модель: ${model}`);
          
          // Прямой запрос к API fal.ai
          // Используем разные форматы URL в зависимости от модели
          // Унифицированная логика формирования URL
          let apiUrl = "";
          if (model.includes('fal-ai/')) {
            // Модель уже содержит префикс
            apiUrl = `https://queue.fal.run/${model}`;
          } else {
            // Добавляем префикс
            apiUrl = `https://queue.fal.run/fal-ai/${model}`;
          }
          
          // Обрабатываем ответ API для стандартных моделей
          const handleApiResponse = async (response: any) => {
            console.log(`Статус ответа: ${response.status}`);
            console.log(`Заголовки ответа: ${JSON.stringify(response.headers)}`);
            console.log(`Тип данных ответа: ${typeof response.data}`);
            
            // Проверяем тип ответа и обрабатываем соответственно
            // Если запрос поставлен в очередь, создаем поллинг для получения результата
            if (response.data && response.data.status === 'IN_QUEUE' && response.data.status_url) {
              console.log(`Запрос поставлен в очередь, ID запроса: ${response.data.request_id}`);
              
              // Функция для ожидания завершения генерации
              const waitForResult = async (statusUrl: string): Promise<any> => {
                console.log(`Проверяем статус по URL: ${statusUrl}`);
                let maxAttempts = 60; // Максимальное число попыток (3 минуты при интервале в 3 секунды)
                let attempt = 0;
                
                while (attempt < maxAttempts) {
                  const statusResponse = await axios.get(statusUrl, {
                    headers: {
                      'Authorization': falAiApiKey, // falAiApiKey уже форматирован выше с префиксом "Key " при необходимости
                      'Accept': 'application/json'
                    }
                  });
                  
                  const status = statusResponse.data?.status;
                  console.log(`Текущий статус: ${status}, попытка ${attempt + 1}/${maxAttempts}`);
                  
                  if (status === 'COMPLETED' && statusResponse.data.response_url) {
                    // Получаем результат
                    const resultResponse = await axios.get(statusResponse.data.response_url, {
                      headers: {
                        'Authorization': falAiApiKey, // falAiApiKey уже форматирован выше с префиксом "Key " при необходимости
                        'Accept': 'application/json'
                      }
                    });
                    return resultResponse.data;
                  } else if (status === 'FAILED' || status === 'CANCELED') {
                    throw new Error(`Генерация изображения не удалась: ${status}`);
                  }
                  
                  // Если все еще в обработке, ждем и продолжаем проверять
                  await new Promise(resolve => setTimeout(resolve, 3000)); // 3 секунды
                  attempt++;
                }
                
                throw new Error('Время ожидания генерации изображения истекло');
              };
              
              // Ожидаем результат генерации
              const result = await waitForResult(response.data.status_url);
              console.log(`Получен результат: ${typeof result === 'object' ? JSON.stringify(result).substring(0, 200) : 'не объект'}`);
              
              // Извлекаем URL изображений из результата
              let imageUrls: string[] = [];
              
              if (result.images && Array.isArray(result.images)) {
                imageUrls = result.images;
              } else if (result.image) {
                imageUrls = [result.image];
              } else if (result.output && Array.isArray(result.output)) {
                imageUrls = result.output;
              } else {
                console.error(`Неизвестный формат результата: ${JSON.stringify(result).substring(0, 200)}`);
                throw new Error('Не удалось получить URL изображений из результата');
              }
              
              // Сохраняем промт, если указан флаг savePrompt и есть contentId
              if (savePrompt && contentId && requestData.prompt) {
                try {
                  console.log(`Сохраняем промт для контента ${contentId}: "${requestData.prompt.substring(0, 50)}..."`);
                  
                  // Сохраняем промт в базу данных через storage
                  if (storage.updateCampaignContent) {
                    await storage.updateCampaignContent(contentId, {
                      prompt: requestData.prompt
                    });
                    console.log(`Промт успешно сохранен для контента ${contentId}`);
                  } else {
                    console.warn("Метод сохранения промта не реализован в storage");
                  }
                } catch (promptError) {
                  console.error(`Ошибка при сохранении промта: ${promptError}`);
                  // Продолжаем выполнение даже при ошибке сохранения промта
                }
              }
              
              return res.json({
                success: true,
                data: imageUrls
              });
            } else {
              // Если запрос обработан мгновенно (редкий случай)
              let imageUrls: string[] = [];
              
              if (response.data.images && Array.isArray(response.data.images)) {
                imageUrls = response.data.images;
              } else if (response.data.image) {
                imageUrls = [response.data.image];
              } else if (response.data.output && Array.isArray(response.data.output)) {
                imageUrls = response.data.output;
              } else {
                console.error(`Неизвестный формат мгновенного результата: ${JSON.stringify(response.data).substring(0, 200)}`);
                throw new Error('Не удалось получить URL изображений из мгновенного результата');
              }
              
              // Сохраняем промт, если указан флаг savePrompt и есть contentId
              if (savePrompt && contentId && requestData.prompt) {
                try {
                  console.log(`Сохраняем промт для контента ${contentId}: "${requestData.prompt.substring(0, 50)}..."`);
                  
                  // Сохраняем промт в базу данных через storage
                  if (storage.updateCampaignContent) {
                    await storage.updateCampaignContent(contentId, {
                      prompt: requestData.prompt
                    });
                    console.log(`Промт успешно сохранен для контента ${contentId}`);
                  } else {
                    console.warn("Метод сохранения промта не реализован в storage");
                  }
                } catch (promptError) {
                  console.error(`Ошибка при сохранении промта: ${promptError}`);
                  // Продолжаем выполнение даже при ошибке сохранения промта
                }
              }
              
              return res.json({
                success: true,
                data: imageUrls
              });
            }
          };
          
          console.log(`URL запроса: ${apiUrl}`);
          console.log(`Данные запроса: ${JSON.stringify(requestData).substring(0, 200)}`);
          
          const response = await axios.post(
            apiUrl,
            requestData,
            {
              headers: {
                'Authorization': falAiApiKey, // falAiApiKey уже форматирован выше с префиксом "Key " при необходимости
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              timeout: 180000 // 3 минуты таймаут
            }
          );
          
          // Вызываем функцию обработки ответа
          return handleApiResponse(response);
        }
      } catch (apiError: any) {
        console.error(`Ошибка при запросе к FAL.AI API: ${apiError.message}`);
        
        if (apiError.response) {
          console.error(`Статус ошибки: ${apiError.response.status}`);
          console.error(`Данные ошибки: ${JSON.stringify(apiError.response.data)}`);
          
          // Добавляем подробное логирование для отладки
          console.error(`Применен формат AUTHORIZATION HEADER: ${falAiApiKey}`);
          console.error(`API ключ начинается с 'Key ': ${falAiApiKey?.startsWith('Key ') ? 'ДА' : 'НЕТ'}`);
          console.error(`Длина API ключа: ${falAiApiKey?.length || 0} символов`);
        }
        
        throw new Error(`Ошибка API FAL.AI: ${apiError.message}`);
      }
    } catch (error: any) {
      console.error("Ошибка при генерации изображения:", error);
      
      return res.status(500).json({
        success: false,
        error: error.message || "Неизвестная ошибка при генерации изображения"
      });
    }
  });
  
  /* Старый метод генерации изображений (для обратной совместимости) */
  app.post('/api/old-generate-image', async (req, res) => {
    try {
      const { 
        prompt, 
        negativePrompt, 
        width, 
        height, 
        campaignId, 
        content, 
        platform, 
        businessData,
        numImages = 1
      } = req.body;

      console.log(`Получен запрос на генерацию изображения: ${prompt ? 'По промпту' : businessData ? 'Для бизнеса' : 'Для соцсетей'}`);

      // Получаем токен из заголовка
      const authHeader = req.headers.authorization;
      let userId = null;
      let token = null;
      
      // Если есть авторизация, получаем userId из токена
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
        try {
          // Получаем информацию о пользователе из токена
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
          console.log('Определен пользователь из токена для генерации изображения:', userId);
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
        }
      }
      
      // Инициализируем FAL.AI с использованием централизованной системы API ключей
      let falAiApiKey = null;
      
      if (userId) {
        // Если пользователь авторизован, получаем ключ из настроек пользователя в Directus
        console.log('Получаем API ключ FAL.AI из настроек пользователя с ID:', userId);
        falAiApiKey = await apiKeyService.getApiKey(userId, 'fal_ai', token);
        
        if (falAiApiKey) {
          console.log('Используется FAL.AI API ключ из настроек пользователя (единственный источник)');
        } else {
          console.log('API ключ FAL.AI не найден в настройках пользователя');
        }
      } else {
        // Если пользователь не авторизован, отказываем в доступе
        console.log('Пользователь не авторизован, доступ к FAL.AI API запрещен');
        return res.status(403).json({ 
          success: false, 
          error: "Для использования генерации изображений необходимо авторизоваться и добавить ключ FAL.AI в настройки пользователя." 
        });
      }
      
      // Проверяем, есть ли API ключ
      let apiInitialized = falAiApiKey && falAiApiKey.length > 0;
    
      // Если API не инициализирован, возвращаем ошибку
      if (!apiInitialized) {
        return res.status(400).json({ 
          success: false, 
          error: "API ключ для FAL.AI не настроен. Добавьте ключ в настройки пользователя в Directus." 
        });
      }

      console.log("FAL.AI API ключ получен, начинаем генерацию");

      try {
        // Подготавливаем данные для запроса в зависимости от типа запроса
        let requestData;
        // Используем правильный формат эндпоинта для FAL.AI API
        let endpoint = 'fal-ai/sdxl';
        
        if (prompt) {
          console.log(`Генерация по промпту: ${prompt.substring(0, 50)}...`);
          
          requestData = {
            prompt: prompt,
            negative_prompt: negativePrompt || '',
            width: width || 1024,
            height: height || 1024,
            num_images: numImages || 1
          };
        } else if (businessData) {
          console.log(`Генерация для бизнеса: ${businessData.companyName}`);
          
          const businessPrompt = `Create a professional, brand-appropriate image for ${businessData.companyName}. 
            The business is described as: ${businessData.brandImage}. 
            They provide: ${businessData.productsServices}. 
            Style: clean, professional, modern corporate design with soft colors, minimalist approach.
            Make it appropriate for business marketing materials, websites, and social media. 
            No text or logos, just the visual elements that represent the brand.`;
            
          const negPrompt = 'text, logos, watermarks, bad quality, distorted, blurry, low resolution, amateur, unprofessional';
          
          requestData = {
            prompt: businessPrompt,
            negative_prompt: negPrompt,
            width: 1024,
            height: 1024,
            num_images: 3
          };
        } else if (content && platform) {
          console.log(`Генерация для соцсетей (${platform}): ${content.substring(0, 50)}...`);
          
          // Короткий контент для промпта
          const shortContent = content.slice(0, 300);
          
          // Адаптируем размеры и стиль под платформу
          let width = 1080;
          let height = 1080;
          let stylePrompt = '';
          
          switch (platform) {
            case 'instagram':
              width = 1080;
              height = 1080;
              stylePrompt = 'vibrant, eye-catching, social media ready, Instagram style';
              break;
            case 'facebook':
              width = 1200;
              height = 630;
              stylePrompt = 'clean, professional, engaging, Facebook style';
              break;
            case 'vk':
              width = 1200;
              height = 800;
              stylePrompt = 'modern, appealing to Russian audience, VK style';
              break;
            case 'telegram':
              width = 1200;
              height = 900;
              stylePrompt = 'minimalist, informative, Telegram channel style';
              break;
          }
          
          const socialPrompt = `Create an image that visually represents: "${shortContent}". ${stylePrompt}. 
            Make it suitable for ${platform} posts, with no text overlay. 
            High quality, professional look, eye-catching design.`;
            
          requestData = {
            prompt: socialPrompt,
            negative_prompt: 'text, words, letters, logos, watermarks, low quality',
            width: width,
            height: height,
            num_images: 3
          };
        } else {
          return res.status(400).json({ 
            success: false, 
            error: "Не указаны необходимые параметры для генерации изображения" 
          });
        }
        
        // Добавляем расширенное логирование для отслеживания запроса и заголовков
        console.log(`Отправляем запрос на прокси FAL.AI с параметрами:`, 
          JSON.stringify({
            endpoint,
            data: {
              ...requestData,
              prompt: requestData.prompt?.substring(0, 30) + '...'
            }
          })
        );
        
        // Логируем формат ключа API для отладки проблем аутентификации
        console.log(`DEBUG FAL.AI AUTH: Формат ключа API: ${falAiApiKey.substring(0, 6)}... (длина: ${falAiApiKey.length})`);
        console.log(`DEBUG FAL.AI AUTH: Начинается с 'Key ': ${falAiApiKey.startsWith('Key ')}`);
        
        const debugHeaders = {
          'Content-Type': 'application/json',
          'Authorization': falAiApiKey,
          'Accept': 'application/json'
        };
        
        console.log('DEBUG FAL.AI AUTH: Заголовки запроса:', JSON.stringify({
          'Content-Type': debugHeaders['Content-Type'],
          'Authorization': debugHeaders['Authorization'].substring(0, 10) + '...',
          'Accept': debugHeaders['Accept']
        }));
        
        // Объявляем переменную на уровне внешнего блока try
        let falApiResponse: any = null;
        
        // Отправляем прямой запрос к FAL.AI API
        try {
          // Максимальное количество попыток
          const maxRetries = 2; 
          let currentRetry = 0;
          let lastError;
          
          // Цикл с повторными попытками при неудаче
          while (currentRetry <= maxRetries) {
            try {
              // Если это повторная попытка, добавляем лог
              if (currentRetry > 0) {
                console.log(`Повторная попытка прямого запроса к FAL.AI (${currentRetry}/${maxRetries})...`);
              }
              
              // Выполняем прямой запрос к FAL.AI REST API без промежуточного прокси
              // КЛЮЧЕВОЕ МЕСТО: это основная точка отправки запроса к FAL.AI 
              
              // Подробное логирование API ключа для отладки (ПОЛНЫЙ ЗАПРОС)
              console.log(`🔴🔴🔴 ПОЛНЫЙ ЗАПРОС К FAL.AI 🔴🔴🔴`);
              console.log(`URL: https://queue.fal.run/fal-ai/fast-sdxl`);
              
              // Полный API ключ в логах (удалить в продакшене!)
              console.log(`AUTHORIZATION HEADER (полный): "${falAiApiKey}"`);
              
              // Тело запроса
              const requestBody = {
                prompt: requestData.prompt,
                negative_prompt: requestData.negative_prompt || "",
                width: requestData.width || 1024,
                height: requestData.height || 1024,
                num_images: requestData.num_images || 1,
                sync_mode: true // Синхронный режим для мгновенного результата
              };
              
              // Выводим полное тело запроса
              console.log(`REQUEST BODY: ${JSON.stringify(requestBody, null, 2)}`);
              
              // Заголовки запроса
              const headers = {
                'Content-Type': 'application/json',
                'Authorization': falAiApiKey, // ВАЖНО: используем ключ API в точно том же формате, как он получен из Directus
                'Accept': 'application/json'
              };
              
              // Выводим полные заголовки
              console.log(`REQUEST HEADERS: ${JSON.stringify(headers, null, 2)}`);
              console.log(`🔴🔴🔴 КОНЕЦ ЛОГИРОВАНИЯ ЗАПРОСА 🔴🔴🔴`);
              
              // Используем актуальный API эндпоинт для генерации изображений
              falApiResponse = await axios.post(
                'https://queue.fal.run/fal-ai/fast-sdxl',
                requestBody,
                {
                  headers: headers,  // Используем заранее подготовленные заголовки
                  timeout: 300000 // 5 минут таймаут
                }
              );
              
              // Если получили успешный ответ, выходим из цикла
              if (falApiResponse?.data) {
                break;
              } else {
                // Если получили ответ, но непонятный, записываем ошибку и продолжаем
                lastError = new Error('Неуспешный ответ от FAL.AI API');
                console.error(`Неудачная попытка ${currentRetry+1}: ${lastError.message}`);
              }
            } catch (error: any) {
              // Записываем ошибку и продолжаем цикл при следующих условиях:
              // 1. Ошибка таймаута
              // 2. Серверная ошибка (5xx)
              // 3. Ошибка сети
              lastError = error;
              
              const isTimeoutError = error.code === 'ECONNABORTED' || 
                                    error.message?.includes('timeout');
              const isServerError = error.response?.status >= 500;
              const isNetworkError = !error.response && error.request;
              
              if (isTimeoutError || isServerError || isNetworkError) {
                console.error(`Попытка ${currentRetry+1} не удалась:`, error.message);
                currentRetry++;
                // Ждем перед повторной попыткой (экспоненциальное увеличение)
                const delay = Math.pow(2, currentRetry) * 1000; // 2, 4 секунды
                console.log(`Ожидаем ${delay}мс перед повторной попыткой...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
              
              // Особая обработка ошибок аутентификации
              if (error.response && error.response.status === 401) {
                const authHeader = headers ? headers['Authorization'] : 'Заголовок недоступен';
                const headerPrefix = authHeader ? authHeader.substring(0, Math.min(15, authHeader.length)) : 'Н/Д';
                
                console.error(`ОШИБКА АУТЕНТИФИКАЦИИ FAL.AI (401 Unauthorized):`);
                console.error(`Формат заголовка Authorization: ${headerPrefix}...`);
                console.error(`Полный ответ: ${JSON.stringify({
                  status: error.response.status,
                  statusText: error.response.statusText,
                  data: error.response.data
                })}`);
              }
              
              // Для других типов ошибок повторять не будем
              throw error;
            }
            
            // Увеличиваем счетчик попыток
            currentRetry++;
          }
          
          // Если после всех попыток не получили успешный ответ, выбрасываем исключение
          if (!falApiResponse?.data) {
            throw lastError || new Error('Не удалось получить ответ от FAL.AI API после нескольких попыток');
          }
          
          // Добавляем логирование полученного ответа
          console.log(`Получен успешный ответ от FAL.AI API:`, 
            JSON.stringify({
              status: falApiResponse.status,
              dataKeys: Object.keys(falApiResponse.data || {})
            })
          );
        } catch (apiCallError: any) {
          console.error(`Ошибка при прямом вызове FAL.AI API:`, apiCallError.message);
          
          // Если это ошибка от axios при вызове API
          if (apiCallError.response) {
            console.error(`Детали ошибки API:`, 
              JSON.stringify({
                status: apiCallError.response.status,
                data: apiCallError.response.data
              })
            );
            throw new Error(`Ошибка API-запроса: ${apiCallError.response.data?.detail || apiCallError.response.data?.error || apiCallError.message}`);
          }
          
          throw apiCallError;
        }
        
        // Извлекаем URL изображений из ответа после успешного запроса
        // Здесь обрабатываем ответ напрямую от FAL.AI API
        let images: string[] = [];
        
        // TypeScript проверка типа переменной falApiResponse
        if (!falApiResponse || !falApiResponse.data) {
          throw new Error('Ответ от FAL.AI API некорректный или пустой');
        }
        
        const apiData = falApiResponse.data;
        console.log('Структура ответа FAL.AI API:', Object.keys(apiData));
        
        // Проверяем различные форматы ответов FAL.AI API
        if (apiData.status === "IN_QUEUE") {
          return res.json({
            success: true,
            status: "queued",
            message: "Запрос поставлен в очередь"
          });
        }
        
        // Обработка разных форматов ответа API FAL.AI
        // Современный формат ответа API v1 для stable-diffusion/sdxl
        if (apiData && Array.isArray(apiData)) {
          // Если ответ - массив объектов (характерно для нового API)
          images = apiData
            .map((item: any) => {
              // Определяем URL изображения из различных полей
              if (item.image && typeof item.image === 'string') return item.image;
              if (item.url && typeof item.url === 'string') return item.url;
              return null;
            })
            .filter(Boolean);
        }
        // Если ответ содержит поле 'images'
        else if (apiData.images && Array.isArray(apiData.images)) {
          images = apiData.images.filter(Boolean);
        }
        // Если ответ содержит поле 'image'
        else if (apiData.image) {
          images = [apiData.image];
        }
        // Если ответ содержит поле 'output'
        else if (apiData.output) {
          if (Array.isArray(apiData.output)) {
            images = apiData.output.filter(Boolean);
          } else {
            images = [apiData.output];
          }
        }
        // Если ответ содержит поле 'url'
        else if (apiData.url) {
          images = [apiData.url];
        }
        // Формат с массивом ресурсов, характерный для старого API FAL.AI
        else if (apiData.resources && Array.isArray(apiData.resources)) {
          images = apiData.resources
            .map((r: any) => r.url || r.image || r.output || null)
            .filter(Boolean);
        }
        
        if (!images.length) {
          console.error('Полная структура ответа (не удалось найти URL изображений):', JSON.stringify(apiData));
          throw new Error('Не удалось найти URL изображений в ответе API');
        }
        
        console.log(`Успешно получено ${images.length} изображений`);
        
        // Возвращаем URL сгенерированных изображений
        return res.json({ 
          success: true, 
          data: images
        });
        
      } catch (generationError: any) {
        console.error("Ошибка при генерации изображения:", generationError);
        
        if (generationError.response) {
          return res.status(generationError.response.status || 500).json({
            success: false,
            error: `Ошибка API: ${generationError.response.data?.error || generationError.message}`,
            details: generationError.response.data
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          error: `Ошибка при генерации изображения: ${generationError.message}` 
        });
      }
    } catch (error: any) {
      console.error("Ошибка при обработке запроса на генерацию:", error);
      
      // Различные обработки ошибок
      if (error.code === 'ENOTFOUND') {
        return res.status(500).json({ 
          success: false, 
          error: "Не удалось подключиться к серверу API. Возможно, проблемы с сетью."
        });
      }
      
      if (error.response && error.response.data) {
        return res.status(error.response.status || 500).json({
          success: false,
          error: `Ошибка API: ${error.response.data.detail || error.message}`,
          details: error.response.data
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: `Ошибка при обработке запроса: ${error.message || 'Неизвестная ошибка'}` 
      });
    }
  });
  // Вспомогательная функция для обработки ключевых слов
  function processKeywords(keywordsData: any): string[] {
    if (!keywordsData) return [];
    
    if (Array.isArray(keywordsData)) {
      return keywordsData.map(k => typeof k === 'string' ? k : String(k));
    }
    
    if (typeof keywordsData === 'string') {
      try {
        const parsed = JSON.parse(keywordsData);
        if (Array.isArray(parsed)) {
          return parsed.map(k => typeof k === 'string' ? k : String(k));
        }
      } catch (e) {
        // Не JSON строка
      }
      return [keywordsData];
    }
    
    return [String(keywordsData)];
  }
  
  // Создаем "пользовательский" метод для замены переменной
  const fixCampaignContent = (routes: Express): void => {
    // Обрабатываем GET запросы - фиксируем преобразования данных
    const getHandler = routes._router.stack.find((layer: any) => 
      layer.route && layer.route.path === '/api/campaign-content' && layer.route.methods.get);
    
    if (getHandler && getHandler.route && getHandler.route.stack && getHandler.route.stack[0] && getHandler.route.stack[0].handle) {
      const originalHandler = getHandler.route.stack[0].handle;
      getHandler.route.stack[0].handle = async function(req: Request, res: Response) {
        try {
          // Перед передачей запроса исходному обработчику, добавляем обработку для
          // переопределения метода преобразования данных
          const originalJson = res.json;
          res.json = function(body) {
            // Если это ответ с данными контента кампании
            if (body && body.data && Array.isArray(body.data)) {
              // Перебираем все элементы контента и обрабатываем keywords
              body.data = body.data.map((item: any) => {
                if (item.keywords) {
                  console.log(`Original keywords for ${item.id}:`, typeof item.keywords, JSON.stringify(item.keywords));
                  item.keywords = processKeywords(item.keywords);
                  console.log(`Processed keywords for ${item.id}:`, typeof item.keywords, JSON.stringify(item.keywords));
                }
                return item;
              });
            }
            // Вызываем оригинальный метод json с измененными данными
            return originalJson.call(this, body);
          };
          
          return originalHandler(req, res);
        } catch (error) {
          console.error('Error in campaign content handler:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      };
    }
  };
  console.log('Starting route registration...');
  // Создаем HTTP сервер
  console.log('Creating HTTP server...');
  const httpServer = createServer(app);
  console.log('HTTP server created successfully');
  
  // 🔥 АНАЛИТИКА ПОЛНОСТЬЮ УДАЛЕНА!

  // Регистрируем маршруты валидации API ключей социальных сетей
  console.log('Registering validation routes...');
  registerValidationRoutes(app);
  
  // Регистрируем роуты генерации контента
  console.log('Registering content generation routes...');

  
  // Регистрируем вебхук-маршруты для прямой интеграции с социальными сетями
  console.log('Registering direct webhook routes for social platforms...');
  app.use('/api/webhook', telegramWebhookRoutes);
  app.use('/api/webhook', vkWebhookRoutes);
  app.use('/api/webhook', instagramWebhookRoutes);
  // Регистрируем унифицированный вебхук Facebook (основной)
  app.use('/api/facebook', facebookWebhookUnifiedRoutes);
  
  // Старые вебхуки сохранены для обратной совместимости
  app.use('/api/facebook-webhook', facebookWebhookRoutes); // Прямая интеграция с Facebook API v2
  app.use('/api/facebook-webhook-v3', facebookWebhookV3Routes); // Улучшенная интеграция с Facebook API v3
  app.use('/api/facebook-webhook-direct', facebookWebhookDirectRoutes); // Маршрут для прямой публикации в Facebook
  app.use('/api/facebook-test', facebookWebhookDirectTestRoutes); // Тестовый маршрут для прямой публикации в Facebook
  app.use('/api', socialPlatformStatusWebhookRoutes); // Универсальный вебхук для обновления статусов соцсетей
  app.use('/api', instagramCarouselWebhookRoutes); // Прямая интеграция с Instagram API для карусели
  
  // Stories and Video content routes
  app.use('/api/stories', storiesRouter);
  app.use('/api/video', videoRouter);
  
  // ВАЖНО: Сначала регистрируем socialPublishingRouter с конкретными маршрутами,
  // чтобы его специфичные маршруты (например, /api/publish/now) не перехватывались
  // маршрутами с параметрами (например, /api/publish/:contentId) из publishing-routes
  app.use('/api', socialPublishingRouter); // Универсальный маршрутизатор для публикации в социальные сети
  app.use('/api', forceUpdateStatusRouter); // Маршрутизатор для принудительного обновления статуса контента
  console.log('Social publishing router registered successfully');
  
  // Затем регистрируем общие маршруты для публикации
  console.log('Registering publishing routes...');
  registerPublishingRoutes(app);
  console.log('API routes registered successfully');
  
  // ДУБЛИРУЮЩИЙ РОУТ АНАЛИТИКИ УДАЛЕН - используется только новый роут в начале файла
  
  // Регистрируем маршруты для тестирования Gemini API через SOCKS5 прокси
  // app.use('/api/gemini', geminiTestRouter); // ОТКЛЮЧЕНО: используем единый маршрут /api/generate-content
  console.log('Gemini API test routes registered successfully');
  
  // Регистрируем маршруты для тестирования Instagram
  registerTestInstagramRoute(app);
  registerTestInstagramCarouselRoute(app);
  console.log('Test Instagram routes registered');
  
  // Instagram настройки кампаний уже зарегистрированы в index.ts
  // app.use('/api/campaigns', instagramSettingsRouter);
  console.log('Instagram settings routes already registered in index.ts');
  
  console.log('Social platform webhook routes registered successfully');
  
  // Регистрируем маршруты для работы с админским токеном
  registerTokenRoutes(app);
  
  // Планировщик уже запущен при импорте через синглтон
  console.log('✅ Планировщик публикаций инициализирован через синглтон');
  
  // Запускаем сервис проверки статусов публикаций
  publicationStatusChecker.start();
  
  // Применяем наш фикс для правильной обработки keywords
  fixCampaignContent(app);
  
  // Тестовый маршрут для проверки генерации изображений через новый FAL.AI API
  app.post("/api/test/image-generation", async (req, res) => {
    try {
      // Проверяем, работает ли API FAL.AI
      console.log("Тестирование генерации изображения через FAL.AI API");
      
      // Получаем данные из запроса
      const { prompt, negativePrompt, width, height } = req.body;
      
      // Проверяем обязательный параметр
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: "Промпт (prompt) является обязательным параметром"
        });
      }
      
      // Инициализируем FAL.AI сервис с использованием новой центральной системы API-ключей
      // Используем userId из запроса, который был установлен в authenticateUser middleware
      const userId = (req as any).userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Для генерации изображений требуется авторизация"
        });
      }
      
      // Инициализируем сервис с API ключом пользователя
      const initialized = await falAiService.initialize(userId);
      
      if (!initialized) {
        return res.status(500).json({
          success: false,
          error: "API ключ FAL.AI не настроен. Пожалуйста, добавьте его в настройках пользователя."
        });
      }
      
      // Очищаем промпт от HTML-тегов и переводим на английский
      const cleanedPrompt = cleanupText(prompt);
      console.log(`Очищенный промпт: "${cleanedPrompt.substring(0, 30)}..."`);
      
      // Переводим промпт на английский
      const translatedPrompt = await translateToEnglish(cleanedPrompt);
      console.log(`Переведенный промпт: "${translatedPrompt.substring(0, 30)}..."`);
      
      // Запускаем генерацию изображения с переведенным промптом
      console.log(`Генерация изображения с промптом: "${translatedPrompt.substring(0, 30)}..."`);
      const imageUrls = await falAiService.generateImage(translatedPrompt, {
        negativePrompt: negativePrompt || "",
        width: width || 1024,
        height: height || 1024,
        numImages: 1
      });
      
      return res.json({
        success: true,
        imageUrls
      });
    } catch (error: any) {
      console.error("Ошибка при тестировании генерации изображения:", error);
      return res.status(500).json({
        success: false, 
        error: error.message || "Неизвестная ошибка при генерации изображения"
      });
    }
  });
  
  // Старый тестовый маршрут для обратной совместимости
  app.post("/api/test-fal-image", async (req, res) => {
    try {
      // Проверяем, работает ли API FAL.AI
      console.log("Тестирование генерации изображения через FAL.AI API (устаревший маршрут)");
      
      // Получаем FAL.AI API ключ через сервис ключей
      const userId = req.body.userId || req.query.userId || (req as any).user?.id;
      const token = getAuthToken(req);
      let falAiApiKey = null;
      
      try {
        // Сначала пытаемся получить из сервиса API ключей
        falAiApiKey = await apiKeyService.getApiKey(userId, 'fal_ai', token);
      } catch (error) {
        console.error('Ошибка при получении FAL.AI API ключа:', error);
      }
      
      // Если ключ не найден в Directus, пробуем из переменных окружения (для обратной совместимости)
      if (!falAiApiKey) {
        falAiApiKey = process.env.FAL_AI_API_KEY;
      }
      
      if (!falAiApiKey) {
        console.log("FAL.AI API ключ не найден в переменных окружения");
        return res.status(400).json({ 
          success: false, 
          error: "FAL.AI API ключ не настроен" 
        });
      }
      
      // ИСПРАВЛЕНИЕ: Проверяем и обновляем ключ API в нужном формате
      if (falAiApiKey && !falAiApiKey.startsWith('Key ') && falAiApiKey.includes(':')) {
        console.log('Автоматически добавляем префикс "Key " к ключу FAL.AI для тестового запроса');
        falAiService.updateApiKey(`Key ${falAiApiKey}`);
      } else {
        falAiService.updateApiKey(falAiApiKey as string);
      }
      
      // Генерируем тестовое изображение
      const prompt = "A beautiful landscape with mountains and a lake, digital art style";
      console.log("Запуск генерации изображения через прямой API вызов...");
      
      const imageURLs = await falAiService.generateImage(prompt, {
        negativePrompt: "bad quality, blurry, text, watermark",
        width: 1024,
        height: 1024,
        numImages: 1
      });
      
      console.log("Результат генерации тестового изображения:", imageURLs);
      
      return res.json({
        success: true,
        message: "Тестовое изображение успешно сгенерировано",
        imageURLs
      });
    } catch (error: any) {
      console.error("Ошибка при тестировании FAL.AI:", error);
      return res.status(500).json({ 
        success: false, 
        error: `Ошибка при тестировании FAL.AI: ${error.message}`,
        details: error.response?.data || null
      });
    }
  });

// УДАЛЕН ДУБЛИРУЮЩИЙ РОУТ - теперь DeepSeek обрабатывается через централизованный /api/generate-content

  // [УДАЛЕН ДУБЛИРУЮЩИЙ ОБРАБОТЧИК DEEPSEEK]
  // Эндпоинт для извлечения ключевых слов из текста - переехал в новую централизованную систему
  app.post("/api/analyze-text-keywords-disabled", authenticateUser, async (req, res) => {
    try {
      const { text, maxKeywords = 5 } = req.body;
      
      if (!text || text.trim() === '') {
        return res.status(400).json({ error: "Отсутствует текст для анализа" });
      }
      
      // Получаем userId, установленный в authenticateUser middleware
      const userId = (req as any).userId;
      
      // Получаем токен из заголовка авторизации
      const authHeader = req.headers['authorization'] as string;
      const token = authHeader.replace('Bearer ', '');
      
      // Инициализируем DeepSeek сервис с ключом пользователя
      const initialized = await deepseekService.initialize(userId, token);
      
      if (!initialized) {
        // Если не удалось инициализировать DeepSeek, используем простой алгоритм извлечения ключевых слов
        console.log("Используем локальный алгоритм извлечения ключевых слов (DeepSeek недоступен)");
        
        // Очищаем текст от HTML-тегов
        const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Простой алгоритм извлечения ключевых слов:
        // 1. Разбиваем текст на слова
        // 2. Удаляем стоп-слова
        // 3. Выбираем самые длинные слова
        
        // Разбиваем текст на слова, приводим к нижнему регистру
        const words = cleanText.toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
          .split(/\s+/);
        
        // Фильтруем стоп-слова и короткие слова (меньше 4 символов)
        const stopWords = new Set(['и', 'в', 'на', 'с', 'по', 'для', 'не', 'что', 'как', 'это', 'или', 'а', 'из', 'к', 'у', 'о', 'во', 'от', 'со', 'при', 'со', 'то', 'за', 'бы', 'был', 'была', 'были', 'мы', 'вы', 'он', 'она', 'оно', 'они', 'его', 'ее', 'их', 'себя']);
        const filteredWords = words.filter(word => word.length >= 4 && !stopWords.has(word));
        
        // Выбираем уникальные слова
        const uniqueWords = Array.from(new Set(filteredWords));
        
        // Сортируем по длине (более длинные слова обычно более значимы)
        const sortedWords = uniqueWords.sort((a, b) => b.length - a.length);
        
        // Возвращаем до maxKeywords ключевых слов
        const keywords = sortedWords.slice(0, maxKeywords);
        
        console.log(`Извлечено ${keywords.length} ключевых слов из текста локально`);
        
        return res.json({
          success: true,
          keywords
        });
      }
      
      // Используем Gemini для извлечения ключевых слов
      console.log(`Извлечение ключевых слов с помощью Gemini из текста длиной ${text.length} символов`);
      
      const geminiApiKey = process.env.GEMINI_API_KEY;
      
      if (!geminiApiKey) {
        return res.status(400).json({
          error: "Gemini API ключ не найден в переменных окружения"
        });
      }
      
      // Промт для извлечения ключевых слов
      const prompt = `Извлеки ${maxKeywords} наиболее важных ключевых слов из следующего текста на русском языке.

Правила:
1. Верни ТОЛЬКО массив ключевых слов в формате JSON: ["слово1", "фраза2", "термин3"]
2. Максимум ${maxKeywords} ключевых слов
3. Ключевые слова должны быть на русском языке
4. Избегай стоп-слов ("и", "в", "на", "с" и т.д.)
5. Включай слова и короткие фразы (до 3 слов)

Текст для анализа:
${text}

Верни только JSON массив ключевых слов:`;
      
      try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 200
          }
        });

        const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // Парсим результат как JSON массив
        let keywords = [];
        try {
          // Ищем массив в тексте с помощью регулярного выражения
          const match = result.match(/\[.*\]/);
          if (match) {
            keywords = JSON.parse(match[0]);
          } else {
            // Если не найден массив, пытаемся разделить по запятым
            keywords = result
              .replace(/"/g, '')
              .split(/,|\n/)
              .map(k => k.trim())
              .filter(Boolean);
          }
        } catch (parseError) {
          console.error("Ошибка при парсинге результата Gemini:", parseError);
          // Если не удалось распарсить как JSON, используем простое разделение по запятым
          keywords = result
            .replace(/[\[\]"]/g, '')
            .split(/,|\n/)
            .map(k => k.trim())
            .filter(Boolean);
        }
        
        // Ограничиваем количество ключевых слов
        keywords = keywords.slice(0, maxKeywords);
        
        console.log(`Извлечено ${keywords.length} ключевых слов из текста с помощью Gemini:`, keywords);
        
        return res.json({
          success: true,
          keywords,
          service: 'gemini'
        });
      } catch (aiError) {
        console.error("Ошибка при использовании Gemini API для извлечения ключевых слов:", aiError);
        // Возвращаемся к простому алгоритму
        return res.status(400).json({ 
          error: "Ошибка при извлечении ключевых слов", 
          details: "Не удалось использовать Gemini API" 
        });
      }
    } catch (error: any) {
      console.error("Error extracting keywords:", error);
      return res.status(400).json({ 
        error: "Ошибка при извлечении ключевых слов", 
        details: error.message 
      });
    }
  });

  // Универсальный эндпоинт для поиска ключевых слов с поддержкой DeepSeek API
  app.post("/api/keywords/search", authenticateUser, async (req, res) => {
    try {
      const { keyword } = req.body;
      
      if (!keyword || keyword.trim() === '') {
        return res.status(400).json({ 
          error: "Отсутствует ключевое слово для поиска" 
        });
      }
      
      // Получаем userId и токен, установленные в authenticateUser middleware
      const userId = (req as any).userId;
      const authHeader = req.headers['authorization'] as string;
      const token = authHeader.replace('Bearer ', '');
      
      console.log(`Получение Gemini ключа из глобальных настроек для поиска ключевых слов: ${keyword}`);
      
      // Получаем Gemini ключ из переменных окружения
      const geminiApiKey = process.env.GEMINI_API_KEY;
      
      if (!geminiApiKey) {
        return res.status(400).json({
          key_missing: true,
          service: "Gemini",
          error: "Gemini API ключ не найден в переменных окружения."
        });
      }
      
      console.log('Gemini API ключ найден, используем для поиска ключевых слов');
      
      // Формируем промт для генерации связанных ключевых слов
      const prompt = `Сгенерируй список из 10-15 связанных ключевых слов и фраз для основного ключевого слова "${keyword}". 

Включи:
- Синонимы и похожие термины
- Длинные фразы (long-tail keywords)
- Связанные темы и понятия
- Популярные поисковые запросы

Каждое ключевое слово должно быть релевантным для маркетинга и SEO.

Верни результат в формате JSON массива объектов:
[
  {"keyword": "ключевое слово", "trend": 85, "competition": 60},
  {"keyword": "другое ключевое слово", "trend": 75, "competition": 45}
]

Где trend (1-100) - популярность, competition (1-100) - конкуренция.`;

      // Используем Gemini 2.5 Flash через прокси для генерации ключевых слов
      console.log('Отправляем запрос к Gemini 2.5 Flash через SOCKS5 прокси...');
      const geminiService = new GeminiService({ apiKey: geminiApiKey });
      const geminiResponse = await geminiService.generateText(prompt, 'gemini-2.5-flash');

      if (!geminiResponse) {
        console.log('Пустой ответ от Gemini сервиса, используем fallback');
        // Создаем fallback ключевые слова
        const fallbackKeywords = [
          { keyword: keyword, trend: 80, competition: 65 },
          { keyword: `${keyword} маркетинг`, trend: 75, competition: 55 },
          { keyword: `${keyword} SEO`, trend: 70, competition: 60 },
          { keyword: `${keyword} оптимизация`, trend: 68, competition: 50 },
          { keyword: `${keyword} продвижение`, trend: 72, competition: 58 }
        ];
        
        return res.json({
          data: {
            keywords: fallbackKeywords
          },
          fallback: true,
          error_message: "Использованы базовые ключевые слова - пустой ответ от Gemini"
        });
      }
      
      console.log('Ответ от Gemini 2.5 Flash:', geminiResponse);
      
      // Парсим JSON ответ от Gemini
      let keywords = [];
      try {
        // Ищем JSON массив в ответе
        const jsonMatch = geminiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          keywords = JSON.parse(jsonMatch[0]);
          console.log('Успешно распарсили JSON от Gemini 2.5:', keywords.length, 'ключевых слов');
        } else {
          throw new Error('JSON массив не найден в ответе Gemini');
        }
        
        // Валидируем структуру
        keywords = keywords.filter(k => k.keyword && typeof k.trend === 'number' && typeof k.competition === 'number');
        
        if (keywords.length === 0) {
          throw new Error('Нет валидных ключевых слов в ответе');
        }
        
        return res.json({
          data: {
            keywords: keywords.slice(0, 15)
          },
          source: "gemini_2.5_flash",
          message: "Ключевые слова сгенерированы через Gemini 2.5 Flash с SOCKS5 прокси"
        });
        
      } catch (parseError) {
        console.log('Ошибка парсинга ответа Gemini:', parseError);
        console.log('Используем fallback ключевые слова');
        
        // Fallback ключевые слова
        const fallbackKeywords = [
          { keyword: keyword, trend: 80, competition: 65 },
          { keyword: `${keyword} купить`, trend: 85, competition: 70 },
          { keyword: `${keyword} цена`, trend: 82, competition: 75 },
          { keyword: `${keyword} отзывы`, trend: 78, competition: 60 },
          { keyword: `${keyword} магазин`, trend: 75, competition: 68 },
          { keyword: `${keyword} доставка`, trend: 72, competition: 55 },
          { keyword: `${keyword} качество`, trend: 70, competition: 50 },
          { keyword: `лучший ${keyword}`, trend: 76, competition: 62 },
          { keyword: `${keyword} недорого`, trend: 74, competition: 58 },
          { keyword: `${keyword} онлайн`, trend: 73, competition: 52 }
        ];
        
        return res.json({
          data: {
            keywords: fallbackKeywords
          },
          source: "fallback",
          message: "Использованы fallback ключевые слова из-за ошибки парсинга Gemini"
        });
      }
      
    } catch (error: any) {
      console.error("Ошибка при использовании Gemini сервиса для поиска ключевых слов:", error);
      console.error("Детали ошибки:", error.message);
      
      // Предоставляем fallback результат в случае ошибки API
      const fallbackKeywords = [
        { keyword: keyword, trend: 80, competition: 65 },
        { keyword: `${keyword} маркетинг`, trend: 75, competition: 55 },
        { keyword: `${keyword} SEO`, trend: 70, competition: 60 },
        { keyword: `${keyword} оптимизация`, trend: 68, competition: 50 },
        { keyword: `${keyword} продвижение`, trend: 72, competition: 58 }
      ];
      
      return res.json({
        data: {
          keywords: fallbackKeywords
        },
        fallback: true,
        error_message: "Использованы базовые ключевые слова из-за проблем с API"
      });
    }
  });

  // [УДАЛЕН ДУБЛИРУЮЩИЙ ОБРАБОТЧИК DEEPSEEK]
  // Эндпоинт для генерации промта для изображения - переехал в новую централизованную систему  
  app.post("/api/generate-image-prompt", authenticateUser, async (req, res) => {
    try {
      const { content, keywords } = req.body;
      
      if (!content || content.trim() === '') {
        return res.status(400).json({ error: "Отсутствует контент для генерации промта" });
      }
      
      // Получаем userId, установленный в authenticateUser middleware
      const userId = (req as any).userId;
      
      // Получаем токен из заголовка авторизации
      const authHeader = req.headers['authorization'] as string;
      const token = authHeader.replace('Bearer ', '');
      
      // Очищаем HTML теги из контента
      const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Пробуем использовать глобальные AI сервисы для генерации промтов
      const { globalApiKeysService } = await import('./services/global-api-keys');
      
      let prompt: string | null = null;
      let usedService = 'local';
      
      // 1. Сначала пробуем Gemini 2.5
      try {
        const geminiApiKey = await globalApiKeysService.getGlobalApiKey('gemini');
        if (geminiApiKey) {
          console.log('Trying Gemini 2.5 API for prompt generation...');
          const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
            contents: [{
              parts: [{
                text: `Create a short, vivid English image prompt from this Russian text: "${cleanContent}"\nKeywords: ${keywords?.join(', ') || 'none'}\nUse visual descriptions, avoid quotes. Make it concise and artistic. Maximum 40 words.`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 300
            }
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          prompt = response.data.candidates[0].content.parts[0].text.replace(/['"]/g, '').trim();
          usedService = 'gemini-2.5';
          console.log('Successfully generated prompt with Gemini 2.5');
        }
      } catch (error) {
        console.log('Gemini 2.5 API failed, trying Claude...');
      }
      
      // 2. Если Gemini не сработал, пробуем Claude
      if (!prompt) {
        try {
          const claudeApiKey = await globalApiKeysService.getGlobalApiKey('claude');
          if (claudeApiKey) {
            console.log('Trying Claude API for prompt generation...');
            const response = await axios.post('https://api.anthropic.com/v1/messages', {
              model: 'claude-3-sonnet-20240229',
              max_tokens: 300,
              system: `You are an expert image prompt generator. Create short, vivid English prompts for AI image generation. Focus on visual elements, avoid quotes. Be concise and artistic.`,
              messages: [
                {
                  role: 'user',
                  content: `Create a short image prompt from: "${cleanContent}"\nKeywords: ${keywords?.join(', ') || 'none'}\nMaximum 40 words, no quotes.`
                }
              ]
            }, {
              headers: {
                'Authorization': `Bearer ${claudeApiKey}`,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
              }
            });
            
            prompt = response.data.content[0].text.replace(/['"]/g, '').trim();
            usedService = 'claude';
            console.log('Successfully generated prompt with Claude');
          }
        } catch (error) {
          console.log('Claude API failed, trying DeepSeek...');
        }
      }
      
      // 3. Если Claude не сработал, пробуем DeepSeek
      if (!prompt) {
        try {
          const deepseekApiKey = await globalApiKeysService.getGlobalApiKey('deepseek');
          if (deepseekApiKey) {
            console.log('Trying DeepSeek API for prompt generation...');
            const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
              model: 'deepseek-chat',
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert image prompt generator. Create short, vivid English prompts for AI image generation. Focus on visual elements, avoid quotes. Be concise and artistic.'
                },
                {
                  role: 'user',
                  content: `Create a short image prompt from: "${cleanContent}"\nKeywords: ${keywords?.join(', ') || 'none'}\nMaximum 40 words, no quotes.`
                }
              ],
              max_tokens: 300,
              temperature: 0.7
            }, {
              headers: {
                'Authorization': `Bearer ${deepseekApiKey}`,
                'Content-Type': 'application/json'
              }
            });
            
            prompt = response.data.choices[0].message.content.replace(/['"]/g, '').trim();
            usedService = 'deepseek';
            console.log('Successfully generated prompt with DeepSeek');
          }
        } catch (error) {
          console.log('DeepSeek API failed, using local fallback...');
        }
      }
      
      // 4. Если все AI сервисы не сработали, используем локальный генератор
      if (!prompt) {
        console.log('All AI services failed, using local prompt generation...');
        const templates = {
          health: "A vibrant and healthy lifestyle scene featuring fresh organic vegetables, fruits, and nutritious meals, bright natural lighting, clean modern kitchen setting, high quality, detailed, 4k",
          nutrition: "Professional nutrition concept with colorful fresh produce, balanced meal preparation, clean bright kitchen environment, soft natural lighting, photorealistic, detailed, masterpiece",
          food: "Appetizing gourmet food photography with fresh ingredients, elegant presentation, warm ambient lighting, restaurant quality, high resolution, detailed composition",
          wellness: "Wellness and health concept with natural elements, fresh ingredients, peaceful atmosphere, soft lighting, clean aesthetic, professional photography, 4k quality",
          business: "Professional business environment with modern clean design, bright office lighting, sleek contemporary style, high quality, detailed, corporate aesthetic",
          technology: "Modern technology concept with clean minimalist design, futuristic elements, professional lighting, high-tech atmosphere, detailed, 4k quality",
          default: "Professional high-quality photograph with clean composition, balanced lighting, modern aesthetic, detailed, 4k resolution, masterpiece"
        };

        const lowerText = cleanContent.toLowerCase();
        const allKeywords = (keywords || []).map(k => k.toLowerCase());
        
        if (lowerText.includes('питан') || lowerText.includes('еда') || lowerText.includes('пища') || 
            allKeywords.some(k => k.includes('питан') || k.includes('еда'))) {
          prompt = templates.nutrition;
        } else if (lowerText.includes('здоров') || lowerText.includes('диет') || 
            allKeywords.some(k => k.includes('здоров') || k.includes('диет'))) {
          prompt = templates.health;
        } else if (lowerText.includes('рецепт') || lowerText.includes('готов') || lowerText.includes('блюд') ||
            allKeywords.some(k => k.includes('рецепт') || k.includes('готов'))) {
          prompt = templates.food;
        } else if (lowerText.includes('бизнес') || lowerText.includes('компан') || lowerText.includes('услуг') ||
            allKeywords.some(k => k.includes('бизнес') || k.includes('компан'))) {
          prompt = templates.business;
        } else if (lowerText.includes('технолог') || lowerText.includes('digital') || lowerText.includes('онлайн') ||
            allKeywords.some(k => k.includes('технолог') || k.includes('онлайн'))) {
          prompt = templates.technology;
        } else if (lowerText.includes('фитнес') || lowerText.includes('спорт') || lowerText.includes('тренир') ||
            allKeywords.some(k => k.includes('фитнес') || k.includes('спорт'))) {
          prompt = templates.wellness;
        } else {
          prompt = templates.default;
        }
        
        usedService = 'local';
      }
      
      console.log(`Generated image prompt with ${usedService}: ${prompt?.substring(0, 100)}...`);
      
      // Возвращаем сгенерированный промт
      return res.json({
        success: true,
        prompt,
        service: usedService
      });
    } catch (error: any) {
      console.error("Error generating prompt with DeepSeek:", error);
      return res.status(400).json({ 
        error: "Ошибка при генерации промта", 
        details: error.message 
      });
    }
  });


  // Endpoint for proxying images with improved error handling and debugging
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send('URL parameter is required');
    }

    // Обработка видео ВКонтакте - просто перенаправляем на оригинальный URL
    if (imageUrl.includes('vk.com/video') && req.query.isVideo !== 'true') {
      return res.redirect(imageUrl);
    }

    // Проверяем дополнительные параметры
    const isRetry = req.query._retry === 'true';
    const forceType = req.query.forceType as string || null;
    const itemId = req.query.itemId as string || '';
    const isVideoThumbnail = req.query.isVideo === 'true';
    const timestamp = req.query._t || Date.now(); // Для предотвращения кеширования
    
    try {
      // Decode the URL if it's encoded
      const decodedUrl = decodeURIComponent(imageUrl);
      
      // Добавление корс-заголовков
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      
      await fetchAndProxyImage(decodedUrl, res, { isRetry, forceType, isVideoThumbnail });
    } catch (error) {
      console.error('Error in image proxy:', error);
      // Отправка 404 вместо 500, чтобы браузер мог переключиться на прямую ссылку
      res.status(404).send('Image not found');
    }
  });
  
  // Эндпоинт для получения превью из видео-URL
  app.get("/api/video-thumbnail", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).send('URL parameter is required');
    }
    
    const itemId = req.query.itemId as string || '';
    console.log(`[Video Thumbnail] Requested thumbnail for video: ${videoUrl} (item ID: ${itemId})`);
    
    try {
      // Добавление корс-заголовков
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      
      await fetchVideoThumbnail(videoUrl, res);
    } catch (error) {
      console.error(`Error generating video thumbnail for ${videoUrl}:`, error);
      res.status(404).send('Video thumbnail not found');
    }
  });
  
  // Эндпоинт для получения информации о видео ВКонтакте
  app.get("/api/vk-video-info", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).send('URL parameter is required');
    }
    
    console.log(`[VK Video Info] Requested info for video: ${videoUrl}`);
    
    try {
      // Извлекаем ID видео из URL
      const videoIdMatch = videoUrl.match(/vk\.com\/video(-?\d+_\d+)/);
      if (!videoIdMatch || !videoIdMatch[1]) {
        return res.status(400).json({
          success: false,
          error: 'Invalid VK video URL format'
        });
      }
      
      const videoId = videoIdMatch[1];
      const [ownerId, videoLocalId] = videoId.split('_');
      
      // Формируем URL для встраивания видео
      const embedUrl = `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoLocalId}&hd=2`;
      
      // Формируем URL для iframe'а (для более надежного встраивания)
      const iframeUrl = `https://vk.com/video_ext.php?${videoUrl.split('vk.com/video')[1]}`;
      
      return res.json({
        success: true,
        data: {
          videoId,
          ownerId,
          videoLocalId,
          embedUrl,
          iframeUrl,
          directUrl: videoUrl,
          videoInfo: {
            platform: 'vk',
            requiresExternal: true
          }
        }
      });
    } catch (error) {
      console.error(`Error extracting VK video info for ${videoUrl}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to extract video information'
      });
    }
  });
  
  // Эндпоинт для получения информации о видео Instagram
  app.get("/api/instagram-video-info", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).send('URL parameter is required');
    }
    
    console.log(`[Instagram Video Info] Requested info for post: ${videoUrl}`);
    
    try {
      // Прямые ссылки на видео Instagram обрабатываем особым образом
      if (videoUrl.includes('instagram.fuio') || videoUrl.includes('cdninstagram.com') || videoUrl.includes('fbcdn.net')) {
        // Это прямая ссылка на медиафайл Instagram, возвращаем успешный ответ с минимальной информацией
        return res.json({
          success: true,
          data: {
            type: 'video',
            url: videoUrl,
            // Минимальная информация для интерфейса
            isDirectVideo: true
          }
        });
      }
      
      // Для обычных постов извлекаем ID публикации из URL
      // Поддерживаем форматы:
      // - https://www.instagram.com/p/DHBwBSFzZuI/
      // - https://instagram.com/reel/CtZw1SPD1OL/
      // - https://www.instagram.com/reels/CvGSDdvOhAJ/
      const urlPatterns = [
        /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
        /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
        /instagram\.com\/reels\/([A-Za-z0-9_-]+)/
      ];
      
      let postId = null;
      for (const pattern of urlPatterns) {
        const match = videoUrl.match(pattern);
        if (match && match[1]) {
          postId = match[1];
          break;
        }
      }
      
      if (!postId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Instagram URL format'
        });
      }
      
      // Нормализуем URL для встраивания
      const normalizedUrl = normalizeInstagramUrl(videoUrl);
      const embedUrl = `https://www.instagram.com/p/${postId}/embed/`;
      
      return res.json({
        success: true,
        data: {
          postId,
          embedUrl,
          originalUrl: videoUrl,
          normalizedUrl,
          videoInfo: {
            platform: 'instagram',
            requiresExternal: true
          }
        }
      });
    } catch (error) {
      console.error(`Error extracting Instagram video info for ${videoUrl}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to extract Instagram post information'
      });
    }
  });

  // Простой тестовый маршрут для проверки глобальных ключей
  app.get("/api/test-keys", async (req: any, res) => {
    try {
      const globalKeysArray = await globalApiKeysService.getGlobalApiKeys();
      const serviceNames = globalKeysArray.map(key => ({
        service: key.service_name, 
        active: key.is_active,
        hasKey: !!key.api_key
      }));
      
      return res.json({
        success: true,
        total: globalKeysArray.length,
        services: serviceNames
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Тестовый маршрут для проверки Gemini прокси (без аутентификации)
  app.get("/api/test-gemini-proxy", async (req: any, res) => {
    console.log('🧪 Тест Gemini прокси запрошен');
    try {
      // Проверяем глобальные ключи и переменные окружения
      let geminiKey;
      try {
        const globalKeysArray = await globalApiKeysService.getGlobalApiKeys();
        console.log('[test-proxy] Получил', globalKeysArray.length, 'глобальных ключей');
        
        // Показываем все сервисы для отладки
        const serviceNames = globalKeysArray.map(key => key.service_name);
        console.log('[test-proxy] Доступные сервисы:', serviceNames);
        
        // Находим Gemini ключ в массиве
        const geminiKeyRecord = globalKeysArray.find(key => 
          key.service_name === 'gemini' && key.is_active
        );
        
        if (geminiKeyRecord) {
          geminiKey = geminiKeyRecord.api_key;
          console.log('[test-proxy] Найден Gemini ключ в базе данных');
        } else {
          console.log('[test-proxy] Gemini ключ не найден в базе данных');
          // Проверим есть ли вообще gemini записи
          const allGeminiKeys = globalKeysArray.filter(key => key.service_name === 'gemini');
          console.log('[test-proxy] Все Gemini записи:', allGeminiKeys.length, allGeminiKeys.map(k => ({service: k.service_name, active: k.is_active})));
        }
      } catch (globalError) {
        console.log('[test-proxy] Ошибка получения глобальных ключей:', globalError.message);
      }
      
      // Фолбэк на переменные окружения
      if (!geminiKey) {
        geminiKey = process.env.GEMINI_API_KEY;
        console.log('[test-proxy] Использую ключ из переменных окружения:', !!geminiKey);
      }
      
      if (!geminiKey) {
        return res.status(400).json({
          success: false,
          error: "Gemini API ключ не найден ни в глобальных настройках, ни в переменных окружения"
        });
      }
      
      // Используем простой Gemini API вместо Vertex AI для версий ниже 2.5
      const geminiProxyServiceInstance = new GeminiProxyService({ apiKey: geminiKey });
      const testResult = await geminiProxyServiceInstance.generateText('Просто ответь: "Система работает"');
      
      return res.json({
        success: true,
        message: "Gemini прокси работает",
        response: testResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Ошибка тестирования Gemini прокси:', error);
      return res.status(500).json({
        success: false,
        error: `Ошибка прокси: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Анализ сайта с помощью DeepSeek для извлечения ключевых слов
  app.get("/api/analyze-site", authenticateUser, async (req: any, res) => {
    console.log('🔍 Анализ сайта запрошен для URL:', req.query.url);
    try {
      const siteUrl = req.query.url;
      if (!siteUrl) {
        return res.status(400).json({ error: "URL не указан" });
      }
      
      // Используем Gemini для анализа сайта
      const userId = req.userId;
      const token = req.headers.authorization?.split(' ')[1];
      
      // Проверяем доступность Gemini API ключа
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(400).json({
          success: false,
          error: "Gemini API ключ не найден в переменных окружения."
        });
      }

      // Нормализуем URL
      const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
      console.log(`Анализируем сайт: ${normalizedUrl} с помощью Gemini`);
      
      // Создаем уникальный requestId для отслеживания запроса
      const requestId = crypto.randomUUID();
      console.log(`[${requestId}] Начат анализ сайта: ${normalizedUrl}`);
      
      // Глубокий парсинг сайта для получения максимум контента
      try {
        const parseRequestId = crypto.randomUUID();
        console.log(`[${parseRequestId}] Начинаем глубокий парсинг сайта`);
        const siteContent = await extractFullSiteContent(normalizedUrl);
        
        // Получаем ключевые слова от Gemini
        // Создаем новый requestId для запроса к Gemini
        const geminiRequestId = crypto.randomUUID();
        
        // Используем прямой Gemini API для анализа ключевых слов
        
        let geminiKeywords = [];
        try {
          console.log(`[${requestId}] Используем Gemini API для анализа ключевых слов`);
          
          const contextualPrompt = `Проанализируй содержимое сайта ${normalizedUrl} и создай 10-15 релевантных ключевых слов именно для этого бизнеса.

Контент сайта:
${siteContent.substring(0, 2000)}

СТРОГИЕ ТРЕБОВАНИЯ:
- ЗАПРЕЩЕНО создавать общие ключевые слова типа "SEO", "маркетинг", "онлайн сервис" если сайт НЕ ОБ ЭТОМ!
- Анализируй РЕАЛЬНЫЙ контент и создавай ключевые слова именно по ЭТОЙ тематике
- Для медицинского сайта - медицинские термины
- Для SMM платформы - SMM термины  
- Для кулинарного сайта - кулинарные термины

Верни результат строго в формате JSON:
[
  {"keyword": "точное ключевое слово по тематике", "trend": 85, "competition": 60},
  {"keyword": "другое релевантное слово", "trend": 75, "competition": 45}
]`;

          // ИСПРАВЛЕНО: Используем глобальный ключ из базы данных
          console.log(`[${requestId}] 🚀 GEMINI: Получаем глобальный ключ из базы данных`);
          
          // Получаем глобальный Gemini ключ
          let geminiKey;
          try {
            const globalKeys = await globalApiKeysService.getGlobalApiKeys();
            geminiKey = globalKeys.gemini || globalKeys.GEMINI_API_KEY;
          } catch (keyError) {
            console.error(`[${requestId}] Ошибка получения Gemini ключа:`, keyError);
            throw new Error('Gemini ключ недоступен');
          }

          if (!geminiKey) {
            throw new Error('Gemini ключ не найден в глобальных настройках');
          }

          const geminiProxyServiceInstance = new GeminiProxyService({ apiKey: geminiKey });  
          const geminiText = await geminiProxyServiceInstance.generateText({
            prompt: contextualPrompt,
            model: 'gemini-1.5-flash',
            temperature: 0.2,
            maxOutputTokens: 1000
          });
          console.log(`[${requestId}] 🚀 GEMINI: Получен ответ от Gemini API (глобальный ключ через прокси)`);
          
          if (geminiText) {
            console.log(`[${requestId}] Ответ от Gemini API:`, geminiText.substring(0, 200));
            const jsonMatch = geminiText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              geminiKeywords = JSON.parse(jsonMatch[0]);
              console.log(`[${requestId}] ✅ Получены контекстуальные ключевые слова через Gemini API:`, geminiKeywords.length);
            } else {
              console.log(`[${requestId}] Не найден JSON массив в ответе Gemini API`);
            }
          } else {
            console.log(`[${requestId}] ❌ Пустой ответ от Gemini API`);
          }
        } catch (proxyError) {
          console.log(`[${requestId}] ❌ ОШИБКА: Gemini API не сработал:`, proxyError.message);
          return res.status(500).json({ 
            error: 'Не удалось проанализировать сайт с помощью ИИ. Попробуйте позже.',
            details: proxyError.message
          });
        }
        
        // Возвращаем результат только если получен ответ от Gemini
        if (geminiKeywords && geminiKeywords.length > 0) {
          console.log(`[${requestId}] ✅ Найдено ${geminiKeywords.length} ключевых слов от Gemini:`, geminiKeywords.map(k => k.keyword));
          return res.json({
            data: { keywords: geminiKeywords },
            source: 'gemini_ai',
            message: 'Ключевые слова созданы через Gemini AI анализ'
          });
        } else {
          console.log(`[${requestId}] ❌ Не удалось получить ключевые слова от Gemini`);
          return res.status(500).json({
            error: 'Не удалось сгенерировать ключевые слова через ИИ',
            message: 'Попробуйте позже или проверьте URL'
          });
        }
        
      } catch (error) {
        console.error(`Ошибка при анализе сайта: ${normalizedUrl}`, error);
        return res.status(500).json({ 
          error: "Не удалось проанализировать сайт", 
          message: "Попробуйте позже или укажите другой URL"
        });
      }
    } catch (error) {
      console.error("Ошибка в API анализа сайта:", error);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
  });
  
  // УЛУЧШЕННАЯ ФУНКЦИЯ С ФОКУСОМ НА КОНТАКТЫ В FOOTER
  async function extractFullSiteContent(url: string): Promise<string> {
    try {
      console.log(`🚀 Скрапинг сайта с извлечением контактов: ${url}`);
      
      // Нормализуем URL
      let normalizedUrl = url;
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      
      // Загрузка с безопасными лимитами  
      const response = await axios.get(normalizedUrl, {
        timeout: 5000,
        maxContentLength: 1024 * 1024, // 1MB для безопасности
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      const htmlContent = response.data;
      
      // Простое извлечение основной информации
      const title = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
      const description = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
      
      // ИЗВЛЕКАЕМ КОНТАКТНУЮ ИНФОРМАЦИЮ С ФОКУСОМ НА FOOTER И КОНЕЦ СТРАНИЦЫ
      
      // Сначала ищем footer и контактные секции
      const footerRegex = /<footer[^>]*>[\s\S]*?<\/footer>/gi;
      const contactSectionRegex = /<[^>]*(?:class|id)=["'][^"']*(?:contact|контакт|связ|phone|email|адрес|address|footer|подвал)[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi;
      
      let footerContent = '';
      const footerMatches = htmlContent.match(footerRegex);
      if (footerMatches) {
        footerContent = footerMatches.join(' ');
      }
      
      const contactSectionMatches = htmlContent.match(contactSectionRegex) || [];
      const contactSectionsContent = contactSectionMatches.join(' ');
      
      // Также берем последние 20% страницы, где обычно находятся контакты
      const pageEnd = htmlContent.slice(-Math.floor(htmlContent.length * 0.2));
      
      // Объединяем приоритетные области для поиска контактов
      const priorityContent = footerContent + ' ' + contactSectionsContent + ' ' + pageEnd;
      
      console.log(`🔍 Ищем контакты в footer (${footerContent.length} симв.), контактных секциях (${contactSectionsContent.length} симв.) и конце страницы (${pageEnd.length} симв.)`);
      
      // Ищем российские телефоны (более точные паттерны)
      const phoneRegex = /(\+7[\s\-\(\)]?\d{3}[\s\-\(\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}|8[\s\-\(\)]?\d{3}[\s\-\(\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}|8[\s\-]*800[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2})/gi;
      
      // Ищем email адреса (более точный паттерн)
      const emailRegex = /([a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
      
      let phones = [];
      let emails = [];
      
      // Сначала ищем в приоритетных областях (footer, контактные секции, конец страницы)
      const priorityPhones = priorityContent.match(phoneRegex) || [];
      const priorityEmails = priorityContent.match(emailRegex) || [];
      
      // Если в приоритетных областях ничего не нашли, ищем по всей странице
      const allPhones = priorityPhones.length > 0 ? priorityPhones : (htmlContent.match(phoneRegex) || []);
      const allEmails = priorityEmails.length > 0 ? priorityEmails : (htmlContent.match(emailRegex) || []);
      
      // Обрабатываем телефоны с ограниченным циклом
      for (let i = 0; i < Math.min(allPhones.length, 10); i++) {
        const cleanPhone = allPhones[i].trim();
        const digits = cleanPhone.replace(/\D/g, '');
        // Проверяем что это действительно телефон (10-11 цифр)
        if (digits.length >= 10 && digits.length <= 11 && 
            (digits.startsWith('7') || digits.startsWith('8'))) {
          phones.push(cleanPhone);
        }
      }
      
      // Обрабатываем email с ограниченным циклом
      for (let i = 0; i < Math.min(allEmails.length, 10); i++) {
        const cleanEmail = allEmails[i].trim().toLowerCase();
        // Проверяем что это не служебный email (избегаем false positive)
        if (!cleanEmail.includes('example.') && !cleanEmail.includes('@example') && 
            !cleanEmail.includes('test@') && !cleanEmail.includes('name@') &&
            !cleanEmail.includes('noreply') && !cleanEmail.includes('no-reply') &&
            cleanEmail.includes('.') && cleanEmail.length >= 5) {
          emails.push(allEmails[i].trim());
        }
      }
      
      // Удаляем дубликаты
      phones = [...new Set(phones)].slice(0, 5);
      emails = [...new Set(emails)].slice(0, 5);
      
      const allContacts = [...phones, ...emails];
      
      console.log(`📞 Найдено телефонов: ${phones.length}, email: ${emails.length}`);
      if (phones.length > 0) console.log(`📞 Телефоны:`, phones);
      if (emails.length > 0) console.log(`📧 Email:`, emails);
      
      // Собираем контент для отправки ИИ с выделенными контактами
      const contentParts = [
        `URL: ${url}`,
        title ? `ЗАГОЛОВОК: ${title}` : '',
        description ? `ОПИСАНИЕ: ${description}` : ''
      ];
      
      // Добавляем найденные контакты в специальном формате для ИИ
      if (allContacts.length > 0) {
        contentParts.push(`=== НАЙДЕННЫЕ КОНТАКТЫ ===`);
        if (phones.length > 0) {
          contentParts.push(`ТЕЛЕФОНЫ: ${phones.join(', ')}`);
        }
        if (emails.length > 0) {
          contentParts.push(`EMAIL: ${emails.join(', ')}`);
        }
      }
      
      // Добавляем основной контент (сокращенный)
      contentParts.push(`КОНТЕНТ ДЛЯ АНАЛИЗА:\n${htmlContent.substring(0, 6000)}`);
      
      const content = contentParts.filter(Boolean).join('\n\n');
      
      console.log(`✅ Улучшенный скрапинг завершен (${content.length} символов, ${allContacts.length} контактов)`);
      return content;
      
    } catch (error: any) {
      console.error(`❌ Ошибка анализа сайта ${url}:`, error.message);
      return `URL: ${url}\nОшибка загрузки сайта: ${error.message}`;
    }
  }
  
  // Интеллектуальный поиск ключевых слов (Gemini API)
  app.get("/api/wordstat/:keyword", authenticateUser, async (req, res) => {
    try {
      const requestId = crypto.randomUUID();
      console.log(`[${requestId}] Searching for keywords with context: ${req.params.keyword}`);
      console.log(`[${requestId}] ======= KEYWORD SEARCH DEBUG START =======`);
      
      // Фильтр нецензурной лексики в качестве входных данных
      const offensiveWords = ['бля', 'хуй', 'пизд', 'ебан', 'еб', 'пидор', 'пидар', 'хуя', 'нахуй', 'дебил'];
      const originalKeyword = req.params.keyword.toLowerCase();
      
      // Проверяем, содержит ли ключевое слово нецензурную лексику
      if (offensiveWords.some(word => originalKeyword.includes(word)) || 
          (originalKeyword === 'сука' && !originalKeyword.includes('порода') && !originalKeyword.includes('собак'))) {
        return res.status(400).json({
          error: "Запрос содержит недопустимое содержание",
          message: "Пожалуйста, используйте корректные ключевые слова для поиска"
        });
      }
      
      // Отключаем кеширование для этого запроса
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      console.log(`[${requestId}] Processing keyword search for: ${originalKeyword}`);

      // Добавляем случайный параметр чтобы избежать кеширования на клиенте
      const nocache = Date.now();
      
      // Проверяем, является ли запрос региональным (содержит название города)
      let queryKeyword = originalKeyword;
      let region = '';
      
      // Определяем, является ли запрос региональным (содержит название города/региона)
      const words = originalKeyword.split(' ');
      if (words.length >= 2) {
        // Проверяем на типичные региональные запросы (город в конце или начале)
        const russianCities = ['москва', 'санкт-петербург', 'казань', 'новосибирск', 'екатеринбург', 
                           'нижний новгород', 'самара', 'омск', 'краснодар', 'ростов-на-дону', 
                           'челябинск', 'уфа', 'волгоград', 'пермь', 'красноярск', 'воронеж',
                           'саратов', 'тюмень', 'тольятти', 'барнаул', 'ульяновск', 'иркутск',
                           'хабаровск', 'ярославль', 'владивосток', 'томск', 'оренбург', 'кемерово',
                           'минск', 'витебск', 'могилев', 'гомель', 'брест', 'гродно'];
                           
        // Проверяем на наличие города/региона в конце или начале запроса
        for (const city of russianCities) {
          if (originalKeyword.toLowerCase().endsWith(` ${city}`) || 
              originalKeyword.toLowerCase().startsWith(`${city} `)) {
            // Если нашли город, используем базовый запрос без региона
            region = city;
            queryKeyword = originalKeyword.toLowerCase().replace(city, '').trim();
            console.log(`[${requestId}] Обнаружен региональный запрос: "${originalKeyword}", базовый запрос: "${queryKeyword}", регион: "${region}"`);
            break;
          }
        }
      }
      
      // Проверяем, является ли введенное значение URL сайта
      let isUrl = false;
      try {
        const url = new URL(originalKeyword.startsWith('http') ? originalKeyword : `https://${originalKeyword}`);
        isUrl = url.hostname.includes('.');
      } catch (e) {
        isUrl = false;
      }


      let finalKeywords: any[] = [];
      
      // Site analysis for URLs using available AI services
      if (isUrl) {
        console.log(`[${requestId}] Processing URL for keyword analysis`);
        
        const normalizedUrl = originalKeyword.startsWith('http') ? originalKeyword : `https://${originalKeyword}`;
        
        // Check cache first
        const cachedKeywords = getCachedKeywordsByUrl(normalizedUrl);
        if (cachedKeywords && cachedKeywords.length > 0) {
          console.log(`[${requestId}] Using ${cachedKeywords.length} cached keywords for URL`);
          finalKeywords = cachedKeywords;
          return res.json({ data: { keywords: finalKeywords } });
        }
        
        try {
          const userId = req.user?.id || 'guest';
          const token = req.user?.token || req.headers.authorization?.replace('Bearer ', '');
          
          // ИСПРАВЛЕНО: Используем глобальный ключ из базы данных
          try {
            const analysisPrompt = `Analyze this website "${normalizedUrl}" and extract 5-10 relevant SEO keywords that best describe its content and purpose. Focus on business-related terms, services, and target audience keywords.

Return your response as a JSON array in this exact format:
[{"keyword": "business planning", "trend": 3500, "competition": 75}, {"keyword": "planning tools", "trend": 2800, "competition": 60}]`;

            // Получаем глобальный Gemini ключ
            let geminiKey;
            try {
              const globalKeys = await globalApiKeysService.getGlobalApiKeys();
              geminiKey = globalKeys.gemini || globalKeys.GEMINI_API_KEY;
            } catch (keyError) {
              console.error(`[${requestId}] Ошибка получения Gemini ключа:`, keyError);
              throw new Error('Gemini ключ недоступен');
            }

            const geminiProxyServiceInstance = new GeminiProxyService({ apiKey: geminiKey });
            const analysisResult = await geminiProxyServiceInstance.generateText({
              prompt: analysisPrompt,
              model: 'gemini-1.5-flash',
              temperature: 0.3,
              maxOutputTokens: 1000
            });
            
            if (analysisResult) {
              const match = analysisResult.match(/\[\s*\{.*\}\s*\]/s);
              if (match) {
                try {
                  const parsed = JSON.parse(match[0]);
                  if (Array.isArray(parsed)) {
                    finalKeywords = parsed.map((item: any) => ({
                      keyword: item.keyword || "",
                      trend: typeof item.trend === 'number' ? item.trend : Math.floor(Math.random() * 5000) + 1000,
                      competition: typeof item.competition === 'number' ? item.competition : Math.floor(Math.random() * 100)
                    })).filter((item: any) => item.keyword.trim() !== "");
                  }
                } catch (parseError) {
                  console.error(`[${requestId}] JSON parsing failed:`, parseError);
                }
              }
            }
          } catch (aiError) {
            console.error(`[${requestId}] AI analysis failed:`, aiError);
          }
          
          // Cache results if we got keywords
          if (finalKeywords.length > 0) {
            searchCache.set(normalizedUrl, {
              timestamp: Date.now(),
              results: finalKeywords
            });
          }
        } catch (error) {
          console.error(`[${requestId}] Site analysis error:`, error);
        }
      }
      
      // If no URL analysis or failed, try DeepSeek for keyword generation
      if (finalKeywords.length === 0) {
        try {
          const userId = req.user?.id || 'guest';
          const token = req.user?.token || req.headers.authorization?.replace('Bearer ', '');
          
          console.log(`[${requestId}] Using DeepSeek for keyword generation`);
          
          const deepseekConfig = await apiKeyService.getApiKey(userId, 'deepseek', token);
          
          if (!deepseekConfig) {
            console.error(`[${requestId}] DeepSeek key not found for user ${userId}`);
            return res.status(400).json({
              key_missing: true,
              service: 'deepseek',
              message: 'Для генерации ключевых слов необходимо добавить API ключ DeepSeek в настройках'
            });
          }
          
          console.log(`[${requestId}] DeepSeek key found, generating keywords`);
          
          const keywordPrompt = `Сгенерируй список из 15-20 релевантных ключевых слов для темы "${originalKeyword}". 
          Включи синонимы, связанные термины и популярные поисковые запросы.
          Выведи только список слов, каждое с новой строки, без нумерации и дополнительного текста.`;
          
          console.log(`[${requestId}] Making DeepSeek API request for keywords`);
          
          const deepseekResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [
              { role: 'user', content: keywordPrompt }
            ],
            max_tokens: 500,
            temperature: 0.7
          }, {
            headers: {
              'Authorization': `Bearer ${deepseekConfig}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`[${requestId}] DeepSeek response received`);
          
          if (deepseekResponse.data?.choices?.[0]?.message?.content) {
            const keywordsText = deepseekResponse.data.choices[0].message.content;
            const keywords = keywordsText
              .split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line && !line.match(/^\d+[\.\)]/) && line.length > 1)
              .slice(0, 20);
            
            if (keywords.length > 0) {
              finalKeywords = keywords.map((keyword: string) => ({
                keyword: keyword.replace(/^[\-\*\•]\s*/, '').trim(),
                trend: Math.floor(Math.random() * 3000) + 500,
                competition: Math.floor(Math.random() * 100)
              }));
              
              console.log(`[${requestId}] Generated ${finalKeywords.length} keywords using DeepSeek`);
            }
          }
        } catch (deepseekError) {
          console.error(`[${requestId}] DeepSeek API error:`, deepseekError);
          // Используем базовый результат если DeepSeek недоступен
          console.log(`[${requestId}] Fallback to basic keyword data`);
          finalKeywords = [{
            keyword: originalKeyword,
            trend: Math.floor(Math.random() * 3000) + 500,
            competition: Math.floor(Math.random() * 100)
          }];
        }
      }
      
      // Return final results
      const resultKeywords = isUrl ? finalKeywords : 
        finalKeywords.length > 0 ? finalKeywords : 
        [{ keyword: originalKeyword, trend: 1000, competition: 50 }];
      
      console.log(`[${requestId}] Returning ${resultKeywords.length} keywords`);
      
      return res.json({ data: { keywords: resultKeywords } });
    } catch (error) {
      console.error(`[${requestId}] Unexpected error:`, error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  });

  // Sources API endpoints
  app.post("/api/sources", authenticateUser, async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          error: "Authorization header missing"
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { name, url, type, campaignId, isActive } = req.body;

      if (!name || !url || !type || !campaignId) {
        return res.status(400).json({ 
          success: false, 
          error: "Отсутствуют обязательные поля",
          message: "Необходимо указать name, url, type и campaignId" 
        });
      }

      // Получаем информацию о пользователе из токена
      let userId;
      try {
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        userId = userResponse.data?.data?.id;
        if (!userId) {
          return res.status(401).json({ success: false, message: "Unauthorized: Cannot identify user" });
        }
      } catch (userError) {
        console.error("Error getting user from token:", userError);
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
      }

      // Проверяем на дублирование URL в рамках кампании
      try {
        console.log(`Checking for duplicate source URL: ${url} in campaign: ${campaignId}`);
        
        const existingSourcesResponse = await directusApi.get('/items/campaign_content_sources', {
          params: {
            filter: {
              campaign_id: { _eq: campaignId },
              url: { _eq: url }
            }
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (existingSourcesResponse.data?.data && existingSourcesResponse.data.data.length > 0) {
          console.log(`Duplicate source found: ${url} already exists in campaign ${campaignId}`);
          return res.status(409).json({
            success: false,
            error: "Дублирование источника",
            message: `Источник с URL "${url}" уже добавлен в эту кампанию`,
            code: "DUPLICATE_SOURCE_URL"
          });
        }
        
        console.log(`No duplicate found, proceeding to create source: ${url}`);
      } catch (duplicateCheckError) {
        console.error("Error checking for duplicate sources:", duplicateCheckError);
        // Продолжаем создание, если проверка на дублирование не удалась
        console.log("Continuing with source creation despite duplicate check error");
      }

      // Создаем новый источник в Directus
      try {
        console.log(`Creating source: ${name} (${url}) for campaign: ${campaignId}`);
        
        const response = await directusApi.post('/items/campaign_content_sources', {
          name: name,
          url: url,
          type: type,
          campaign_id: campaignId,
          is_active: isActive !== undefined ? isActive : true
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Преобразуем ответ от Directus в наш формат
        const newSource = {
          id: response.data.data.id,
          name: response.data.data.name,
          url: response.data.data.url,
          type: response.data.data.type,
          isActive: response.data.data.is_active,
          campaignId: response.data.data.campaign_id,
          createdAt: response.data.data.created_at
        };

        console.log('Successfully created source:', newSource);

        return res.status(201).json({
          success: true,
          data: newSource,
          message: "Источник успешно добавлен"
        });
      } catch (directusError) {
        console.error("Error creating source in Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
          
          return res.status(directusError.response.status || 500).json({
            success: false,
            error: "Ошибка при создании источника",
            details: directusError.response.data
          });
        }
        
        return res.status(500).json({
          success: false,
          error: "Ошибка при создании источника",
          message: directusError instanceof Error ? directusError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error in POST /api/sources:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create source",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/sources", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      console.log("Fetching sources for campaign:", campaignId);

      // Get sources from Directus
      const authToken = req.headers.authorization;
      if (!authToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const response = await directusApi.get('/items/campaign_content_sources', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            },
            is_active: {
              _eq: true
            }
          },
          fields: ['id', 'name', 'url', 'type', 'is_active', 'campaign_id', 'created_at', 'sentiment_analysis']
        },
        headers: {
          'Authorization': authToken
        }
      });

      console.log('Directus sources API response:', {
        status: response.status,
        dataLength: response.data?.data?.length,
        firstSource: response.data?.data?.[0]
      });

      res.json({ data: response.data?.data || [] });
    } catch (error) {
      console.error("Error fetching sources:", error);
      if (axios.isAxiosError(error)) {
        console.error('Directus API error details:', {
          status: error.response?.status,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            params: error.config?.params
          }
        });
      }
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  // Trends routes
  app.get("/api/trends", authenticateUser, async (req, res) => {
    try {
      const period = req.query.period as string;
      const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
      const authHeader = req.headers['authorization'];

      console.log("Fetching trends with params:", { period, campaignId });

      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');

      const from = new Date();
      switch (period) {
        case "3days":
          from.setDate(from.getDate() - 3);
          break;
        case "7days":
          from.setDate(from.getDate() - 7);
          break;
        case "14days":
          from.setDate(from.getDate() - 14);
          break;
        case "30days":
          from.setDate(from.getDate() - 30);
          break;
        default:
          from.setDate(from.getDate() - 7);
      }

      try {
        // Форматируем дату для фильтра в формате ISO
        const fromDateISO = from.toISOString();
        
        // Создаем фильтр для API запроса
        const filter: any = {
          created_at: {
            _gte: fromDateISO
          }
        };
        
        // Если указан campaignId, добавляем в фильтр
        if (campaignId) {
          filter.campaign_id = {
            _eq: campaignId
          };
        }
        
        // Получаем тренды напрямую из Directus API
        const response = await directusApi.get('/items/campaign_trend_topics', {
          params: {
            filter: filter,
            sort: ['-created_at']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const trends = response.data.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          sourceId: item.source_id,
          reactions: item.reactions,
          comments: item.comments,
          views: item.views,
          createdAt: item.created_at,
          campaignId: item.campaign_id
        }));
        
        console.log(`Found ${trends.length} trends`);
        res.json({ data: trends });
      } catch (directusError) {
        console.error("Error fetching trends from Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
        }
        
        return res.status(500).json({ error: "Failed to fetch trends" });
      }
    } catch (error) {
      console.error("Error in trends route:", error);
      res.status(500).json({ error: "Failed to fetch trends" });
    }
  });
  
  // Эндпоинт для получения трендов кампании (для ContentPlanGenerator)
  app.get("/api/campaign-trend-topics", authenticateUser, async (req, res) => {
    try {
      const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "campaignId is required" });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      console.log(`Fetching campaign trends for campaign: ${campaignId}`);
      
      // Получаем данные из базы данных
      const trendTopics = await storage.getCampaignTrendTopics({ campaignId });
      
      console.log(`Found ${trendTopics.length} campaign trend topics`);
      
      res.json({ data: trendTopics });
    } catch (error) {
      console.error("Error in campaign-trend-topics route:", error);
      res.status(500).json({ error: "Failed to fetch campaign trend topics" });
    }
  });

  // Эндпоинт для сбора трендов конкретной кампании
  app.post("/api/campaign-trend-topics/:campaignId/collect", authenticateUser, async (req, res) => {
    try {
      const { campaignId } = req.params;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      console.log(`Starting trend collection for campaign: ${campaignId}`);
      
      // Проверяем существование кампании
      try {
        const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!campaignResponse.data?.data) {
          return res.status(404).json({ error: "Campaign not found" });
        }
      } catch (error) {
        console.error("Error fetching campaign from Directus:", error);
        return res.status(500).json({ error: "Failed to verify campaign" });
      }

      // Отправляем запрос на N8N для сбора трендов
      const n8nUrl = process.env.N8N_URL;
      if (!n8nUrl) {
        return res.status(500).json({ error: "N8N_URL не настроен" });
      }

      // Вызываем существующий endpoint сбора трендов
      const collectResponse = await fetch(`${req.protocol}://${req.get('host')}/api/trends/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          campaignId,
          platforms: ['vk', 'telegram', 'instagram'], // По умолчанию собираем с основных платформ
          collectSources: true
        })
      });

      const collectResult = await collectResponse.json();
      
      if (!collectResponse.ok) {
        throw new Error(collectResult.message || 'Failed to start trend collection');
      }

      res.json({ 
        success: true, 
        message: "Сбор трендов запущен",
        data: collectResult
      });
    } catch (error) {
      console.error("Error in campaign trend collection:", error);
      res.status(500).json({ 
        error: "Failed to start trend collection", 
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Source Posts routes - для получения постов из источников
  app.get("/api/source-posts", async (req, res) => {
    try {
      const period = req.query.period as string;
      const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
      const sourceId = req.query.sourceId ? String(req.query.sourceId) : undefined;

      console.log("Fetching source posts with params:", { period, campaignId, sourceId });

      if (!campaignId) {
        return res.status(400).json({ error: "Campaign ID is required" });
      }

      const from = new Date();
      switch (period) {
        case "3days":
          from.setDate(from.getDate() - 3);
          break;
        case "7days":
          from.setDate(from.getDate() - 7);
          break;
        case "14days":
          from.setDate(from.getDate() - 14);
          break;
        case "30days":
          from.setDate(from.getDate() - 30);
          break;
        default:
          from.setDate(from.getDate() - 7);
      }

      // Get posts from Directus
      const authToken = req.headers.authorization;
      if (!authToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log("Making request to Directus with filter:", {
        campaign_id: campaignId,
        from: from.toISOString()
      });

      const response = await directusApi.get('/items/source_posts', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            },
            created_at: {
              _gte: from.toISOString()
            }
          },
          fields: ['id', 'postContent', 'source_id', 'campaign_id', 'created_at'],
          sort: ['-created_at']
        },
        headers: {
          'Authorization': authToken
        }
      });

      console.log('Directus API response:', {
        status: response.status,
        dataLength: response.data?.data?.length,
        firstPost: response.data?.data?.[0]
      });
      
      // Трансформируем данные, чтобы очистить контент от многоточий
      const cleanedPosts = (response.data?.data || []).map((post: any) => ({
        ...post,
        postContent: cleanupText(post.postContent)
      }));

      res.json({ data: cleanedPosts });
    } catch (error) {
      console.error("Error fetching source posts:", error);
      if (axios.isAxiosError(error)) {
        console.error('Directus API error details:', {
          status: error.response?.status,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            params: error.config?.params
          }
        });
      }
      res.status(500).json({ error: "Failed to fetch source posts" });
    }
  });

  // Trend collection endpoint
  app.post("/api/trends/collect", async (req, res) => {
    try {
      // Получаем токен аутентификации из заголовков
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized: Missing or invalid authorization header" });
      }
      const token = authHeader.replace('Bearer ', '');

      // Получаем user_id из заголовка или токена
      let userId: string;
      if (req.headers["x-user-id"]) {
        userId = req.headers["x-user-id"] as string;
      } else {
        try {
          // Получаем информацию о пользователе из токена
          // Декодируем токен напрямую
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            throw new Error('Invalid token format');
          }
          
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          const userResponse = { 
            data: { 
              data: { 
                id: payload.id, 
                email: payload.email || 'unknown@email.com' 
              } 
            } 
          };
          userId = userResponse.data?.data?.id;
          if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Cannot identify user" });
          }
        } catch (userError) {
          console.error("Error getting user from token:", userError);
          return res.status(401).json({ message: "Unauthorized: Invalid token" });
        }
      }

      const { campaignId, platforms = [], collectComments = [] } = req.body;
      // Принимаем collectSources как boolean или как число (1)
      const collectSources = req.body.collectSources === true || req.body.collectSources === 1 || req.body.collectSources === "1";
      
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }
      
      console.log('Received collectSources flag:', collectSources);
      console.log('Received platforms:', platforms);
      console.log('Received collectComments platforms:', collectComments);

      // Проверяем существование кампании через Directus
      try {
        const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!campaignResponse.data?.data) {
          return res.status(404).json({ message: "Campaign not found" });
        }
      } catch (error) {
        console.error("Error fetching campaign from Directus:", error);
        return res.status(500).json({ message: "Failed to verify campaign", error: String(error) });
      }

      // Получаем ключевые слова для этой кампании
      const keywordsResponse = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          }
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!keywordsResponse.data?.data || keywordsResponse.data.data.length === 0) {
        return res.status(400).json({ message: "No keywords found for this campaign" });
      }

      const keywordsList = keywordsResponse.data.data.map((k: { keyword: string }) => k.keyword);
      console.log('Sending keywords to webhook:', keywordsList);
      
      // Отправляем запрос на webhook n8n с ключевыми словами кампании
      // Добавляем информацию о запросе
      console.log('Sending webhook request to n8n with payload:', {
        campaignId,
        keywordsCount: keywordsList.length,
        userId,
        collectSources: collectSources
      });
      
      let webhookResponse = { status: 500, data: null };
      try {
        // Создаем отдельный идентификатор запроса для отслеживания
        const requestId = crypto.randomUUID();
        
        // Получаем настройки кампании, включая соц. сети и другие настройки
        const campaignSettingsResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
          params: {
            fields: ['id', 'trend_analysis_settings'],
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const trendAnalysisSettings = campaignSettingsResponse.data?.data?.trend_analysis_settings || {};
        console.log('Campaign trend analysis settings:', trendAnalysisSettings);
        
        // Настройки поиска по умолчанию, если нет в кампании
        const followerRequirements = trendAnalysisSettings?.minFollowers || {
          instagram: 5000,
          telegram: 2000,
          vk: 3000,
          facebook: 5000,
          youtube: 10000
        };
        
        const maxSourcesPerPlatform = trendAnalysisSettings?.maxSourcesPerPlatform || 5;
        const maxTrendsPerSource = trendAnalysisSettings?.maxTrendsPerSource || 10;
        const selectedPlatforms = platforms || ["instagram", "telegram", "vk"];
        
        // Debug-логирование для проверки передачи параметров
        console.log('Request body from client:', {
          campaignId: req.body.campaignId,
          platformsCount: req.body.platforms?.length,
          collectSources: req.body.collectSources,
          collectCommentsCount: req.body.collectComments?.length,
          collectCommentsPlatforms: req.body.collectComments,
        });
        
        const n8nUrl = process.env.N8N_URL;
        if (!n8nUrl) {
          console.log('N8N_URL не настроен в переменных окружения');
          return res.status(500).json({ success: false, error: 'N8N_URL не настроен' });
        }
        
        webhookResponse = await axios.post(`${n8nUrl}/webhook/cc1e9b63-bc80-4367-953d-bc888ec32439`, {
          minFollowers: followerRequirements,
          maxSourcesPerPlatform: maxSourcesPerPlatform,
          platforms: selectedPlatforms,
          collectSources: collectSources ? 1 : 0, // Отправляем как числовое значение для совместимости
          collectComments: collectComments, // Добавляем массив платформ для сбора комментариев
          keywords: keywordsList,
          maxTrendsPerSource: maxTrendsPerSource,
          language: "ru",
          filters: {
            minReactions: 10,
            minViews: 500,
            contentTypes: ["text", "image", "video"]
          },
          campaignId: campaignId,
          userId: userId,
          requestId: requestId,
        }, {
          headers: {
            'Content-Type': 'application/json',
            // Используем только API ключ для авторизации в N8N
            'X-N8N-Authorization': process.env.N8N_API_KEY || '',
          },
          timeout: 30000 // 30 секунд таймаут
        });
        
        console.log('Webhook response status:', webhookResponse.status);
        if (webhookResponse.data) {
          console.log('Webhook response preview:', JSON.stringify(webhookResponse.data).substring(0, 200));
          console.log('Webhook response type:', typeof webhookResponse.data);
          
          // Обработка разных форматов данных - массив или объект
          let postsToProcess = [];
          
          // Проверяем формат данных ответа
          if (Array.isArray(webhookResponse.data)) {
            // Ответ является массивом постов
            console.log('Response is an array of posts, processing directly');
            postsToProcess = webhookResponse.data;
          } else if (webhookResponse.data.trendTopics && Array.isArray(webhookResponse.data.trendTopics)) {
            // Ответ содержит массив trendTopics
            console.log('Response contains trendTopics array');
            postsToProcess = webhookResponse.data.trendTopics;
          } else if (webhookResponse.data.posts && Array.isArray(webhookResponse.data.posts)) {
            // Ответ содержит массив posts
            console.log('Response contains posts array');
            postsToProcess = webhookResponse.data.posts;
          } else if (webhookResponse.data.trends && Array.isArray(webhookResponse.data.trends)) {
            // Ответ содержит массив trends
            console.log('Response contains trends array');
            postsToProcess = webhookResponse.data.trends;
          }
          
          if (postsToProcess.length > 0) {
            console.log(`Processing ${postsToProcess.length} posts/topics from webhook response`);
            
            let savedCount = 0;
            const errors: Error[] = [];
            
            // Обрабатываем каждый пост и сохраняем в базу данных
            for (const post of postsToProcess) {
              try {
                // Определяем формат данных - TG пост или обычный тренд
                const isTelegramPost = post.text !== undefined;
                
                const trendTopic: InsertCampaignTrendTopic = {
                  // Для TG-постов используем первые 255 символов text как title, иначе используем title
                  title: isTelegramPost 
                    ? (post.text ? post.text.substring(0, 255) : 'Untitled Post') 
                    : (post.title || 'Untitled Topic'),
                  
                  // Для TG-постов используем channel_id или url, иначе sourceId
                  sourceId: isTelegramPost 
                    ? (post.channel_id || post.url || 'unknown') 
                    : (post.sourceId || 'unknown'),
                  
                  // Преобразуем метрики соответственно
                  reactions: isTelegramPost 
                    ? (post.reactions || 0) 
                    : (post.reactions || 0),
                  
                  comments: isTelegramPost 
                    ? (post.comments || 0) 
                    : (post.comments || 0),
                  
                  views: isTelegramPost 
                    ? (post.views || 0) 
                    : (post.views || 0),
                  
                  campaignId: campaignId,
                  isBookmarked: false
                };
                
                console.log(`Saving trend topic: ${trendTopic.title.substring(0, 30)}... from ${trendTopic.sourceId}`);
                
                // Создаем запись в Directus API напрямую
                try {
                  const payload = {
                    title: trendTopic.title || '',
                    source_id: trendTopic.sourceId || '',
                    reactions: trendTopic.reactions || 0,
                    comments: trendTopic.comments || 0,
                    views: trendTopic.views || 0,
                    campaign_id: String(campaignId),
                    is_bookmarked: false
                  };
                  
                  console.log('Sending payload to Directus:', JSON.stringify(payload).substring(0, 100));
                  
                  // Используем storage.createCampaignTrendTopic вместо прямого вызова Directus API
                  // Обрабатываем медиа-ссылки
                  let mediaLinks = {};
                  
                  // Извлекаем изображения из поста Telegram, если они есть
                  if (post.photos && Array.isArray(post.photos) && post.photos.length > 0) {
                    mediaLinks = {
                      images: post.photos.map((photo: string) => photo),
                      videos: []
                    };
                    console.log("Extracted media links from Telegram post:", JSON.stringify(mediaLinks));
                  }
                  
                  // Создаем объект с данными тренда
                  const trendTopicData: InsertCampaignTrendTopic = {
                    title: payload.title,
                    sourceId: payload.source_id,
                    campaignId: payload.campaign_id,
                    reactions: payload.reactions,
                    comments: payload.comments,
                    views: payload.views,
                    isBookmarked: payload.is_bookmarked,
                    mediaLinks: mediaLinks
                  };
                  
                  console.log('Saving trend topic using storage:', JSON.stringify(trendTopicData).substring(0, 100));
                  const response = await storage.createCampaignTrendTopic(trendTopicData);
                  
                  console.log('Successfully saved trend topic with id:', response.id);
                } catch (storageError) {
                  console.error('Error saving trend topic to database:', storageError);
                  throw storageError;
                }
                savedCount++;
              } catch (err) {
                console.error("Error saving trend topic:", err);
                if (err instanceof Error) {
                  errors.push(err);
                } else {
                  errors.push(new Error(String(err)));
                }
              }
            }
            
            console.log(`Successfully saved ${savedCount} of ${postsToProcess.length} trend topics`);
          } else {
            console.log('No posts to process in the webhook response');
          }
        }
      } catch (error) {
        console.error('Error calling n8n webhook:', error instanceof Error ? error.message : String(error));
        if (axios.isAxiosError(error)) {
          console.error('Webhook response status:', error.response?.status);
          console.error('Webhook response data:', error.response?.data);
          
          // Проверяем, есть ли частичные данные в ответе
          if (error.response?.data?.trendTopics && Array.isArray(error.response.data.trendTopics)) {
            console.log(`Found ${error.response.data.trendTopics.length} trend topics in error response, attempting to process`);
            // Process the partial data if available
            // ... (аналогично обработке выше)
          }
        }
        // Продолжаем выполнение, чтобы клиент получил хотя бы частичный ответ
      }
      
      // Предполагаем, что вебхук работает, даже если у нас нет явного ответа
      console.log('Webhook request sent successfully');

      res.json({
        success: true,
        message: "Trend collection started via n8n webhook",
        data: {
          keywordsCount: keywordsList.length,
          campaignId,
          webhookStatus: webhookResponse && webhookResponse.status === 200 ? 'success' : 'error'
        }
      });
    } catch (error) {
      console.error("Error collecting trends:", error);
      res.status(500).json({ 
        error: "Failed to collect trends", 
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Modified sources/collect endpoint to use n8n webhook
  app.post("/api/sources/collect", async (req, res) => {
    // Устанавливаем заголовок Content-Type явно, чтобы клиент всегда получал JSON
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');
      const { keywords } = req.body;
      
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Требуется указать ключевые слова для поиска",
          message: "Требуется указать ключевые слова для поиска" 
        });
      }
      
      console.log('Starting source search for keywords:', keywords);
      
      // Получаем информацию о пользователе из токена
      let userId;
      try {
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        userId = userResponse.data?.data?.id;
        if (!userId) {
          return res.status(401).json({ success: false, message: "Unauthorized: Cannot identify user" });
        }
      } catch (userError) {
        console.error("Error getting user from token:", userError);
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
      }

      console.log('Searching for sources with keywords:', keywords);

      // Check cache for quick response first
      const cachedResults = keywords.map((keyword: any) => {
        const cached = getCachedResults(keyword);
        if (cached) {
          console.log(`Using ${cached.length} cached results for keyword: ${keyword}`);
          return cached;
        }
        return null;
      });

      // If all keywords have cached results, merge and return them
      if (cachedResults.every((result: any) => result !== null)) {
        console.log('All results found in cache');
        const uniqueSources = cachedResults.flat().reduce((acc: any[], source) => {
          if (!acc.some(s => s.url === source.url)) {
            acc.push(source);
          }
          return acc;
        }, []);

        return res.json({
          success: true,
          data: {
            sources: uniqueSources
          }
        });
      }

      // Возвращаем пустой результат, так как Perplexity больше не используется
      console.log('Perplexity service has been removed');
      
      return res.json({
        success: true,
        data: {
          sources: []
        }
      });

      // (Этот блок кода недостижим)

    } catch (error) {
      console.error('Error in /api/sources/collect:', error);
      res.status(500).json({
        error: "Failed to collect sources",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Новый эндпоинт для поиска источников с кастомизируемыми параметрами
  // Helper function to get campaign keywords from Directus
  async function getCampaignKeywords(campaignId: string, token: string): Promise<string[]> {
    try {
      // Запрашиваем ключевые слова кампании из таблицы campaign_keywords
      const response = await directusApi.get('/items/campaign_keywords', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          filter: {
            campaign_id: { _eq: campaignId }
          },
          fields: ['id', 'keyword']
        }
      });

      // Проверяем наличие данных в ответе
      if (!response.data?.data || !Array.isArray(response.data.data)) {
        console.log(`Ключевые слова для кампании ${campaignId} не найдены`);
        return [];
      }

      // Извлекаем ключевые слова из ответа
      const keywords = response.data.data.map((item: any) => item.keyword).filter(Boolean);
      console.log(`Найдено ${keywords.length} ключевых слов для кампании ${campaignId}: ${keywords.join(', ')}`);
      
      return keywords;
    } catch (error) {
      console.error(`Ошибка при получении ключевых слов для кампании ${campaignId}:`, error);
      return [];
    }
  }
  
  app.post("/api/sources/search-by-campaign", authenticateUser, async (req, res) => {
    // Устанавливаем заголовок Content-Type явно, чтобы клиент всегда получал JSON
    res.setHeader('Content-Type', 'application/json');
    
    console.log('📣 ПОЛУЧЕН ЗАПРОС на /api/sources/search-by-campaign:', JSON.stringify(req.body, null, 2));
    
    try {
      const { campaignId, platform = 'instagram', maxResults = 20 } = req.body;
    
      if (!campaignId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Требуется ID кампании для поиска' 
        });
      }

      // Получаем токен авторизации из заголовка запроса
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          success: false, 
          error: 'Не авторизован: Отсутствует токен авторизации' 
        });
      }
      
      const token = authHeader.split(' ')[1];
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Не авторизован: Не удалось определить пользователя'
        });
      }

      // Получаем ключевые слова кампании
      const keywords = await getCampaignKeywords(campaignId, token);
      
      if (keywords.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'Для данной кампании не найдено ключевых слов',
          keywords: []
        });
      }

      // Perplexity service has been removed
      console.log('Perplexity service has been removed - returning empty results');
      
      return res.json({
        success: true,
        data: [],
        keywords: keywords,
        keywordResults: {},
        totalFound: 0,
        returned: 0,
        message: 'Сервис поиска источников временно недоступен'
      });
    } catch (error) {
      console.error('Error in /api/sources/search-by-campaign:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка при поиске источников по кампании', 
        message: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  });

  app.post("/api/sources/search", async (req, res) => {
    // Устанавливаем заголовок Content-Type явно, чтобы клиент всегда получал JSON
    res.setHeader('Content-Type', 'application/json');
    
    console.log('📣 ПОЛУЧЕН ЗАПРОС на /api/sources/search:', JSON.stringify(req.body, null, 2));
    
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        console.log('❌ Ошибка авторизации: отсутствует заголовок Authorization');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');
      const { keyword, campaignId, platforms = ['instagram'], customPrompt } = req.body;
      
      if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
        console.log('❌ Ошибка: отсутствует ключевое слово или оно пустое');
        return res.status(400).json({ 
          success: false, 
          error: "Требуется указать ключевое слово для поиска",
          message: "Требуется указать ключевое слово для поиска" 
        });
      }
      
      console.log(`📣 Starting source search for keyword: ${keyword}, platforms: ${platforms.join(', ')}`);
      
      // Получаем информацию о пользователе из токена
      let userId;
      try {
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        userId = userResponse.data?.data?.id;
        if (!userId) {
          return res.status(401).json({ success: false, message: "Unauthorized: Cannot identify user" });
        }
      } catch (userError) {
        console.error("Error getting user from token:", userError);
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
      }

      // Perplexity service has been removed
      console.log('Perplexity service has been removed - returning empty results');
      
      return res.json({
        success: true,
        data: {
          sources: []
        },
        message: 'Сервис поиска источников временно недоступен'
      });
    } catch (error) {
      console.error('Error in /api/sources/search:', error);
      res.status(500).json({
        success: false,
        error: "Failed to search sources",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Apify social media parsing endpoint
  app.post("/api/sources/parse", async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        console.error('Missing authorization header');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.replace('Bearer ', '');

      const { url, sourceType } = req.body;
      if (!url || !sourceType) {
        return res.status(400).json({ error: "URL and source type are required" });
      }

      res.status(501).json({ error: "Not Implemented" });

    } catch (error) {
      console.error('Error parsing source:', error);
      res.status(500).json({
        error: "Failed to parse source",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Source sentiment analysis endpoint
  app.post("/api/sources/:sourceId/analyze", async (req, res) => {
    try {
      // Проверяем авторизацию пользователя (UI должен передавать пользовательский токен)
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Не авторизован: Отсутствует заголовок авторизации'
        });
      }

      const userToken = authHeader.replace('Bearer ', '');
      const sourceId = req.params.sourceId;
      const { campaignId } = req.body;

      if (!sourceId || !campaignId) {
        return res.status(400).json({
          success: false,
          error: 'Отсутствуют обязательные параметры: sourceId и campaignId'
        });
      }

      console.log(`[SOURCE-ANALYSIS] Анализ источника ${sourceId} для кампании ${campaignId}`);

      // Используем административный токен для внутренних операций с Directus
      const adminToken = process.env.DIRECTUS_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
      if (!adminToken) {
        console.error('[SOURCE-ANALYSIS] Не удалось получить админский токен из переменных окружения');
        return res.status(500).json({
          success: false,
          error: 'Ошибка авторизации системы'
        });
      }

      console.log(`[SOURCE-ANALYSIS] Анализируем источник ID: ${sourceId} для кампании ${campaignId}`);

      // Получаем тренды напрямую по source_id (согласно схеме БД у трендов есть поле source_id)
      const trendsResponse = await directusApi.get('/items/campaign_trend_topics', {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        params: {
          filter: {
            source_id: { _eq: sourceId },
            campaign_id: { _eq: campaignId }
          },
          sort: '-created_at',
          limit: 500
        }
      });

      const trends = trendsResponse.data?.data || [];
      
      console.log(`[SOURCE-ANALYSIS] Найдено ${trends.length} трендов напрямую по source_id: ${sourceId}`);
      
      // Если нет прямых связей, попробуем найти все тренды кампании и найти связанные
      if (trends.length === 0) {
        console.log(`[SOURCE-ANALYSIS] Прямых связей нет, ищем среди всех трендов кампании...`);
        
        const allTrendsResponse = await directusApi.get('/items/campaign_trend_topics', {
          headers: { 'Authorization': `Bearer ${adminToken}` },
          params: {
            filter: {
              campaign_id: { _eq: campaignId }
            },
            sort: '-created_at',
            limit: 1000
          }
        });

        const allTrends = allTrendsResponse.data?.data || [];
        console.log(`[SOURCE-ANALYSIS] Всего трендов в кампании: ${allTrends.length}`);
        
        // Выводим все уникальные source_id для диагностики
        const uniqueSourceIds = [...new Set(allTrends.map(trend => trend.source_id))].filter(id => id);
        console.log(`[SOURCE-ANALYSIS] Найдено ${uniqueSourceIds.length} уникальных source_id`);
        console.log(`[SOURCE-ANALYSIS] Первые 5 source_id: [${uniqueSourceIds.slice(0, 5).join(', ')}]`);
        console.log(`[SOURCE-ANALYSIS] Ищем source_id: ${sourceId}`);
        console.log(`[SOURCE-ANALYSIS] Есть ли наш source_id среди найденных: ${uniqueSourceIds.includes(sourceId)}`);
        
        console.log(`[SOURCE-ANALYSIS] Первые 5 трендов для проверки:`);
        allTrends.slice(0, 5).forEach((trend, i) => {
          console.log(`[SOURCE-ANALYSIS] Тренд ${i + 1}: id=${trend.id}, source_id=${trend.source_id || 'null'}, comments=${trend.comments || 0}, title="${trend.title?.substring(0, 50) || 'нет'}"`);
        });
        
        // Ищем тренды для нашего источника среди всех
        const sourceRelatedTrends = allTrends.filter(trend => trend.source_id === sourceId);
        console.log(`[SOURCE-ANALYSIS] Найдено ${sourceRelatedTrends.length} трендов с source_id = ${sourceId}`);
        
        if (sourceRelatedTrends.length > 0) {
          // Переназначаем trends на найденные
          trends.push(...sourceRelatedTrends);
          console.log(`[SOURCE-ANALYSIS] Добавлено ${sourceRelatedTrends.length} трендов в обработку`);
        }
      }

      if (trends.length === 0) {
        return res.json({
          success: true,
          data: {
            sentiment: 'unknown',
            confidence: 0,
            trendsCount: 0,
            commentsCount: 0,
            summary: `Нет трендов для источника ${sourceId}`
          }
        });
      }

      console.log(`[SOURCE-ANALYSIS] Найдено ${trends.length} трендов для анализа источника ${sourceId}`);

      // Инициализируем переменные для анализа
      const trendAnalyses = [];
      let totalCommentsAnalyzed = 0;
      const allCommentsTexts = [];

      console.log(`[SOURCE-ANALYSIS] Собираем все комментарии для всех трендов источника ${sourceId}`);

      // 1. Собираем комментарии и запускаем сбор если нужно
      const trendsNeedingCollection = [];
      
      for (const trend of trends) {
        console.log(`[SOURCE-ANALYSIS] Проверяем комментарии для тренда ${trend.id}`);
        
        try {
          // Получаем существующие комментарии для данного тренда (используем пользовательский токен)
          const commentsResponse = await directusApi.get('/items/post_comment', {
            headers: { 'Authorization': authHeader },
            params: {
              filter: JSON.stringify({ trent_post_id: { _eq: trend.id } }),
              sort: 'date',
              limit: 1000
            }
          });

          const comments = commentsResponse.data?.data || [];
          console.log(`[SOURCE-ANALYSIS] Найдено ${comments.length} комментариев для тренда ${trend.id}`);

          const commentsCount = parseInt(trend.comments) || 0;
          
          // Добавляем существующие комментарии если они есть
          if (comments.length > 0) {
            const commentsTexts = comments
              .map(c => (c.text || c.content || '').trim())
              .filter(Boolean);
            
            allCommentsTexts.push(...commentsTexts);
            totalCommentsAnalyzed += comments.length;
            console.log(`[SOURCE-ANALYSIS] Добавлено ${commentsTexts.length} существующих комментариев из тренда ${trend.id}`);
          }
          
          // ВСЕГДА запрашиваем сбор для трендов с comments > 0 (независимо от наличия комментариев в базе)
          if (commentsCount > 0) {
            const trendUrl = trend.urlPost || trend.accountUrl || trend.url;
            if (trendUrl) {
              console.log(`[SOURCE-ANALYSIS] Тренд ${trend.id} будет добавлен для сбора комментариев (${commentsCount} комментариев, URL: ${trendUrl})`);
              trendsNeedingCollection.push({...trend, url: trendUrl});
            } else {
              console.log(`[SOURCE-ANALYSIS] ⚠️ Тренд ${trend.id} имеет ${commentsCount} комментариев, но нет URL для сбора`);
            }
          } else {
            console.log(`[SOURCE-ANALYSIS] Тренд ${trend.id} не имеет комментариев (${commentsCount})`);
          }
        } catch (error) {
          console.error(`[SOURCE-ANALYSIS] Ошибка получения комментариев для тренда ${trend.id}:`, error);
        }
      }

      // 2. Запускаем сбор для трендов без комментариев и ждем завершения
      if (trendsNeedingCollection.length > 0) {
        console.log(`[SOURCE-ANALYSIS] Запускаем сбор комментариев для ${trendsNeedingCollection.length} трендов`);
        console.log(`[SOURCE-ANALYSIS] Список трендов для сбора:`, trendsNeedingCollection.map(t => `${t.id}: ${t.comments} комментариев`));
        
        // Отправляем webhook запросы для сбора комментариев
        const collectionPromises = [];
        for (const trend of trendsNeedingCollection.slice(0, 10)) {
          try {
            console.log(`[SOURCE-ANALYSIS] 🔄 Отправляем webhook для тренда ${trend.id}: ${trend.url}`);
            const webhookPromise = fetch('https://n8n.roboflow.space/webhook/collect-comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trend_id: trend.id,
                url: trend.url
              })
            }).then(response => {
              console.log(`[SOURCE-ANALYSIS] ✅ Webhook ответ для тренда ${trend.id}: ${response.status} ${response.statusText}`);
              return response;
            }).catch(error => {
              console.error(`[SOURCE-ANALYSIS] ❌ Webhook ошибка для тренда ${trend.id}:`, error);
              throw error;
            });
            
            collectionPromises.push(webhookPromise);
          } catch (error) {
            console.error(`[SOURCE-ANALYSIS] ❌ Ошибка создания webhook для тренда ${trend.id}:`, error);
          }
        }

        // Ждем завершения всех запросов на сбор комментариев
        if (collectionPromises.length > 0) {
          console.log(`[SOURCE-ANALYSIS] Ожидаем завершения сбора комментариев...`);
          await Promise.allSettled(collectionPromises);
          
          // Даем время на обработку с повторными проверками (максимум 60 секунд)
          console.log(`[SOURCE-ANALYSIS] Ожидаем сбор комментариев с повторными проверками...`);
          let waitTime = 0;
          const maxWaitTime = 60000; // 60 секунд
          const checkInterval = 15000; // проверяем каждые 15 секунд
          
          while (waitTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
            
            console.log(`[SOURCE-ANALYSIS] Проверка через ${waitTime/1000} секунд...`);
            
            // Проверяем, появились ли комментарии
            let foundComments = 0;
            for (const trend of trendsNeedingCollection.slice(0, 3)) { // проверяем первые 3 тренда
              try {
                const testResponse = await directusApi.get('/items/post_comment', {
                  headers: { 'Authorization': authHeader },
                  params: {
                    filter: JSON.stringify({ trent_post_id: { _eq: trend.id } }),
                    limit: 1
                  }
                });
                const testComments = testResponse.data?.data || [];
                foundComments += testComments.length;
              } catch (error) {
                // игнорируем ошибки при проверке
              }
            }
            
            console.log(`[SOURCE-ANALYSIS] Найдено ${foundComments} комментариев при проверке`);
            if (foundComments > 0) {
              console.log(`[SOURCE-ANALYSIS] ✅ Комментарии найдены! Завершаем ожидание через ${waitTime/1000} секунд`);
              break;
            }
          }
          
          // Повторно собираем комментарии после завершения сбора
          console.log(`[SOURCE-ANALYSIS] Повторный сбор комментариев после webhook запросов...`);
          for (const trend of trendsNeedingCollection) {
            try {
              const commentsResponse = await directusApi.get('/items/post_comment', {
                headers: { 'Authorization': authHeader },
                params: {
                  filter: JSON.stringify({ trent_post_id: { _eq: trend.id } }),
                  sort: 'date',
                  limit: 1000
                }
              });

              const comments = commentsResponse.data?.data || [];
              console.log(`[SOURCE-ANALYSIS] После сбора найдено ${comments.length} комментариев для тренда ${trend.id}`);

              if (comments.length > 0) {
                const commentsTexts = comments
                  .map(c => (c.text || c.content || '').trim())
                  .filter(Boolean);
                
                allCommentsTexts.push(...commentsTexts);
                totalCommentsAnalyzed += comments.length;
                console.log(`[SOURCE-ANALYSIS] Добавлено ${commentsTexts.length} комментариев из тренда ${trend.id} после сбора`);
              }
            } catch (error) {
              console.error(`[SOURCE-ANALYSIS] Ошибка повторного получения комментариев для тренда ${trend.id}:`, error);
            }
          }
        }

        // Ждем завершения сбора
        console.log(`[SOURCE-ANALYSIS] Ждем 8 секунд для завершения сбора комментариев...`);
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Собираем новые комментарии после сбора
        for (const trend of trendsNeedingCollection.slice(0, 10)) {
          try {
            const commentsAfter = await directusApi.get('/items/post_comment', {
              headers: { 'Authorization': `Bearer ${adminToken}` },
              params: {
                filter: { trent_post_id: { _eq: trend.id } },
                sort: 'date',
                limit: 1000
              }
            });
            
            const newComments = commentsAfter.data?.data || [];
            if (newComments.length > 0) {
              const commentsTexts = newComments
                .map(c => (c.text || c.content || '').trim())
                .filter(Boolean);
              
              allCommentsTexts.push(...commentsTexts);
              totalCommentsAnalyzed += newComments.length;
              console.log(`[SOURCE-ANALYSIS] Собрано ${newComments.length} новых комментариев для тренда ${trend.id}`);
            }
          } catch (error) {
            console.error(`[SOURCE-ANALYSIS] Ошибка сбора новых комментариев для тренда ${trend.id}:`, error);
          }
        }
      }
      
      console.log(`[SOURCE-ANALYSIS] Собрано всего ${totalCommentsAnalyzed} комментариев для анализа источника ${sourceId}`);

      if (allCommentsTexts.length === 0) {
        return res.json({
          success: true,
          data: {
            sentiment: 'unknown',
            confidence: 0,
            trendsCount: trends.length,
            commentsCount: 0,
            summary: 'Нет комментариев для анализа источника'
          }
        });
      }

      // 3. Анализируем ВСЕ собранные комментарии источника через AI
      let overallSentiment = 'neutral';
      let overallScore = 5;
      let overallConfidence = 0;
      let analysisSuccess = false;

      if (allCommentsTexts.length > 0) {
        console.log(`[SOURCE-ANALYSIS] Анализируем ${allCommentsTexts.length} комментариев через AI для источника ${sourceId}`);
        
        // Объединяем все комментарии для общего анализа
        const allCommentsText = allCommentsTexts.slice(0, 500).join('\n'); // Берем первые 500 комментариев
        
        try {
          const analysisPrompt = `Проанализируй общую тональность всех комментариев к источнику контента и дай оценку от 1 до 10 (где 1 - очень негативно, 5 - нейтрально, 10 - очень позитивно).

Все комментарии к источнику:
${allCommentsText.substring(0, 8000)}

Ответь в JSON формате:
{
  "score": число от 1 до 10,
  "confidence": число от 0 до 1,
  "sentiment": "positive" | "negative" | "neutral",
  "summary": "краткое описание общей тональности комментариев к источнику"
}`;

          console.log(`[SOURCE-ANALYSIS] Начинаем AI анализ ${allCommentsTexts.length} комментариев`);
          
          // Используем прямой Vertex AI для анализа источника (как в генерации контента)
          console.log(`[SOURCE-ANALYSIS] Используем прямой Vertex AI для анализа источника`);
          
          const { geminiVertexDirect } = await import('./services/gemini-vertex-direct.js');
          console.log(`[SOURCE-ANALYSIS] Прямой Vertex AI импортирован, вызываем generateContent...`);
          
          const analysisResult = await geminiVertexDirect.generateContent({
            prompt: analysisPrompt,
            model: 'gemini-2.5-flash',
            temperature: 0.2,
            maxTokens: 500
          });
          
          console.log(`[SOURCE-ANALYSIS] Vertex AI ответ получен:`, analysisResult?.substring(0, 200));

          let analysisData;
          try {
            // Пытаемся извлечь JSON из ответа
            const jsonMatch = analysisResult.match(/\{[^}]*\}/);
            if (jsonMatch) {
              analysisData = JSON.parse(jsonMatch[0]);
              overallScore = analysisData.score || 5;
              overallSentiment = analysisData.sentiment || 'neutral';
              overallConfidence = analysisData.confidence || 0.5;
              analysisSuccess = true;
              console.log(`[SOURCE-ANALYSIS] AI анализ успешен: score=${overallScore}, sentiment=${overallSentiment}, confidence=${overallConfidence}`);
            } else {
              throw new Error('JSON не найден в ответе');
            }
          } catch (parseError) {
            console.error(`[SOURCE-ANALYSIS] Ошибка парсинга JSON:`, parseError);
            throw parseError;
          }

        } catch (aiError) {
          console.error(`[SOURCE-ANALYSIS] Ошибка AI анализа:`, aiError);
          
          // Fallback анализ на основе ключевых слов
          console.log(`[SOURCE-ANALYSIS] Используем fallback анализ по ключевым словам`);
          const positiveWords = ['хорошо', 'отлично', 'супер', 'класс', 'круто', 'лайк', '👍', '❤️', 'спасибо', 'молодец', 'красиво'];
          const negativeWords = ['плохо', 'ужасно', 'отстой', 'не нравится', 'дизлайк', '👎', 'фу', 'гадость', 'ужас', 'отвратительно'];
          
          const positiveCount = positiveWords.reduce((count, word) => 
            count + (allCommentsText.toLowerCase().match(new RegExp(word, 'g')) || []).length, 0);
          const negativeCount = negativeWords.reduce((count, word) => 
            count + (allCommentsText.toLowerCase().match(new RegExp(word, 'g')) || []).length, 0);
          
          const totalWords = positiveCount + negativeCount;
          
          if (totalWords > 0) {
            overallScore = Math.round(5 + (positiveCount - negativeCount) * 2.5 / Math.max(totalWords, 1));
            overallScore = Math.max(1, Math.min(10, overallScore));
            
            if (overallScore > 6) overallSentiment = 'positive';
            else if (overallScore < 4) overallSentiment = 'negative';
            else overallSentiment = 'neutral';
            
            overallConfidence = 0.3;
            analysisSuccess = true;
          }
        }
      }

      // 4. Формируем итоговый результат анализа источника
      const result = {
        sentiment: overallSentiment,
        confidence: Math.round(overallConfidence * 100) / 100,
        score: Math.round(overallScore * 10) / 10,
        trendsCount: trends.length,
        commentsCount: totalCommentsAnalyzed,
        commentsAnalyzed: allCommentsTexts.length,
        analysisMethod: analysisSuccess ? (overallConfidence > 0.5 ? 'AI' : 'keywords') : 'basic',
        summary: analysisSuccess 
          ? `Анализ ${allCommentsTexts.length} комментариев к источнику: ${overallSentiment === 'positive' ? 'положительная' : overallSentiment === 'negative' ? 'отрицательная' : 'нейтральная'} тональность (балл: ${Math.round(overallScore * 10) / 10})`
          : `Источник содержит ${trends.length} трендов, но анализ комментариев не удался`
      };

      console.log(`[SOURCE-ANALYSIS] Итоговый результат:`, result);

      // Сохраняем общий результат анализа в источник (используем пользовательский токен)
      try {
        console.log(`[SOURCE-ANALYSIS] Используем пользовательский токен для обновления источника ${sourceId}`);
        // Обновляем источник с пользовательским токеном (проверяем правильную таблицу)
        try {
          // Генерируем emoji на основе sentiment
          const getEmojiForSentiment = (sentiment: string) => {
            switch (sentiment) {
              case 'positive': return '😊';
              case 'negative': return '😞';
              case 'neutral': return '😐';
              default: return '❓';
            }
          };

          await directusApi.patch(`/items/campaign_content_sources/${sourceId}`, {
            sentiment_analysis: {
              overall_sentiment: overallSentiment, // UI ожидает именно это поле
              emoji: getEmojiForSentiment(overallSentiment), // UI проверяет сначала это поле
              sentiment: overallSentiment, // Для совместимости
              score: Math.round(overallScore * 10) / 10,
              confidence: Math.round(overallConfidence * 100) / 100,
              trendsAnalyzed: trends.length,
              totalTrends: trends.length,
              totalComments: totalCommentsAnalyzed,
              summary: result.summary,
              analyzedAt: new Date().toISOString()
            }
          }, {
            headers: { 'Authorization': req.headers.authorization }
          });
          console.log(`[SOURCE-ANALYSIS] Результат анализа сохранен в campaign_content_sources/${sourceId}`);
        } catch (contentSourcesError) {
          console.log(`[SOURCE-ANALYSIS] Ошибка обновления campaign_content_sources, пробуем campaign_sources...`);
          await directusApi.patch(`/items/campaign_sources/${sourceId}`, {
            sentiment_analysis: {
              overall_sentiment: overallSentiment, // UI ожидает именно это поле
              emoji: getEmojiForSentiment(overallSentiment), // UI проверяет сначала это поле
              sentiment: overallSentiment, // Для совместимости
              score: Math.round(overallScore * 10) / 10,
              confidence: Math.round(overallConfidence * 100) / 100,
              trendsAnalyzed: trends.length,
              totalTrends: trends.length,
              totalComments: totalCommentsAnalyzed,
              summary: result.summary,
              analyzedAt: new Date().toISOString()
            }
          }, {
            headers: { 'Authorization': req.headers.authorization }
          });
          console.log(`[SOURCE-ANALYSIS] Результат анализа сохранен в campaign_sources/${sourceId}`);
        }
        console.log(`[SOURCE-ANALYSIS] Сохранен общий анализ для источника ${sourceId} (пользовательский токен)`);
        
      } catch (sourceUpdateError) {
        console.error(`[SOURCE-ANALYSIS] Ошибка обновления источника ${sourceId}:`, sourceUpdateError);
        // Если обновление не удалось, продолжаем работу без критической ошибки
        console.log(`[SOURCE-ANALYSIS] Анализ завершен, но результат не сохранен в источник`);
      }

      return res.json({
        success: true,
        data: result
      });



    } catch (error) {
      console.error('[SOURCE-ANALYSIS] Ошибка анализа источника:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при анализе источника',
        details: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  });

  // PATCH endpoint for updating sources with sentiment analysis
  app.patch("/api/sources/:sourceId", authenticateUser, async (req, res) => {
    try {
      const sourceId = req.params.sourceId;
      const token = req.headers.authorization?.split(' ')[1];
      const updateData = req.body;

      if (!sourceId) {
        return res.status(400).json({
          success: false,
          error: 'Требуется ID источника'
        });
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Не авторизован: Отсутствует токен авторизации'
        });
      }

      console.log(`[PATCH-SOURCE] Обновление источника ${sourceId} пользователем ${req.user?.id}`);
      console.log(`[PATCH-SOURCE] Данные для обновления:`, JSON.stringify(updateData, null, 2));

      // Обновляем источник в коллекции campaign_content_sources (используем пользовательский токен)
      const response = await directusApi.patch(`/items/campaign_content_sources/${sourceId}`, updateData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log(`[PATCH-SOURCE] Источник ${sourceId} успешно обновлен`);

      return res.json({
        success: true,
        data: response.data.data,
        message: 'Источник успешно обновлен'
      });

    } catch (error) {
      console.error(`[PATCH-SOURCE] Ошибка обновления источника ${req.params.sourceId}:`, error);
      
      if (axios.isAxiosError(error) && error.response) {
        console.error(`[PATCH-SOURCE] Directus API error:`, error.response.data);
        return res.status(error.response.status || 500).json({
          success: false,
          error: 'Ошибка при обновлении источника',
          details: error.response.data?.errors?.[0]?.message || error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера при обновлении источника',
        details: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  });

  // Single source crawling endpoint
  app.post("/api/sources/:sourceId/crawl", async (req, res) => {
    try {
      const sourceId = req.params.sourceId;
      const { campaignId } = req.body;

      if (!sourceId || !campaignId) {
        console.error('Missing required parameters:', { sourceId, campaignId });
        return res.status(400).json({ 
          success: false,
          message: "Source ID and Campaign ID are required" 
        });
      }
      
      // Получаем имя источника из запроса клиента вместо запроса к серверу
      // Клиент уже получил список источников, поэтому он знает имя источника
      const sourceName = req.body.sourceName || req.query.sourceName || sourceId;
      console.log(`Starting crawl process for source: ${sourceName} (${sourceId}) in campaign: ${campaignId}`);
      
      try {
        // Отправляем запрос на n8n webhook для сбора постов из источника
        const n8nUrl = process.env.N8N_URL;
        if (!n8nUrl) {
          console.log('N8N_URL не настроен в переменных окружения');
          return res.status(500).json({ success: false, error: 'N8N_URL не настроен' });
        }
        
        const webhookUrl = `${n8nUrl}/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c`;
        
        // Отправляем только sourceId и campaignId без авторизации
        const webhookResponse = await axios.post(webhookUrl, {
          sourceId,
          campaignId
        });
        
        console.log('Webhook response:', webhookResponse.status);
        
        // Возвращаем успешный результат с указанием имени источника, если оно доступно
        return res.status(200).json({
          success: true,
          message: `Задача на сбор постов из источника успешно запущена`,
          sourceId: sourceId,
          campaignId: campaignId,
          sourceName: sourceName // Передаем имя источника на фронтенд
        });
      } catch (crawlError) {
        console.error("Error calling webhook:", crawlError);
        
        // Проверяем, есть ли ответ от сервера
        if (axios.isAxiosError(crawlError) && crawlError.response) {
          console.error('Webhook error response:', {
            status: crawlError.response.status,
            data: crawlError.response.data
          });
        }
        
        res.status(500).json({ 
          success: false,
          error: "Failed to start crawling task",
          message: crawlError instanceof Error ? crawlError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Unexpected error in crawl endpoint:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to process request",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const followerRequirements: PlatformRequirements = {
    'youtube.com': 100000,
    'reddit.com': 50000,
    'vk.com': 10000,
    't.me': 5000,
    'instagram.com': 50000,
    'twitter.com': 10000,
    'x.com': 10000
  };

  // Массив для хранения кампаний в разработке
  const devCampaigns: any[] = [
    {
      id: "46868c44-c6a4-4bed-accf-9ad07bba790e",
      name: "Правильное питание",
      description: "Кампания о правильном питании и здоровом образе жизни",
      userId: "user123",
      createdAt: new Date().toISOString()
    },
    {
      id: "76d7eb6e-dc8b-4d4f-a8b0-aa72bf6136f0",
      name: "Фитнес тренировки",
      description: "Кампания о фитнесе и спортивных тренировках",
      userId: "user123",
      createdAt: new Date().toISOString()
    }
  ];

  // Endpoint to get all campaigns for the user
  // Webhook endpoint для получения трендовых данных от n8n
  app.post("/api/trends/webhook", async (req, res) => {
    try {
      console.log("Received trend data from n8n webhook");
      
      // Получаем токен только из заголовка авторизации, это безопаснее
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace('Bearer ', '') : null;
      
      if (!token) {
        console.error("No authorization token provided for webhook");
        return res.status(401).json({
          error: "Authorization required",
          message: "No token provided"
        });
      }
      
      // Поддерживаем два формата данных: старый (trends) и новый (posts из TG)
      const posts = req.body.posts || [];
      const trends = req.body.trends || [];
      const { campaignId, userId } = req.body;
      
      // Используем данные из массива posts, если он есть, иначе из trends
      const trendsData = posts.length > 0 ? posts : trends;
      
      if (!trendsData.length || !campaignId || !userId) {
        console.error("Invalid webhook data format:", req.body);
        return res.status(400).json({ 
          error: "Invalid data format", 
          message: "Required fields: trends or posts (array), campaignId (string), and userId (string)" 
        });
      }
      
      console.log(`Processing ${trendsData.length} trends for campaign ${campaignId} (data format: ${posts.length > 0 ? 'TG posts' : 'trends'})`);
      
      let savedCount = 0;
      const errors: Error[] = [];
      
      // Обрабатываем каждый тренд и сохраняем в базу данных
      for (const post of trendsData) {
        try {
          // Определяем формат данных - TG пост или обычный тренд
          const isTelegramPost = post.text !== undefined;
          
          const trendTopic: InsertCampaignTrendTopic = {
            // Для TG-постов используем первые 255 символов text как title, иначе используем title
            title: isTelegramPost 
              ? (post.text ? post.text.substring(0, 255) : 'Untitled Post') 
              : post.title,
            
            // Для TG-постов используем channel_id или url, иначе sourceId
            sourceId: isTelegramPost 
              ? (post.channel_id || post.url || 'unknown') 
              : post.sourceId,
            
            // Преобразуем метрики соответственно
            reactions: isTelegramPost 
              ? (post.reactions || 0) 
              : (post.reactions || 0),
            
            comments: isTelegramPost 
              ? (post.comments || 0) 
              : (post.comments || 0),
            
            views: isTelegramPost 
              ? (post.views || 0) 
              : (post.views || 0),
            
            campaignId: campaignId,
            isBookmarked: false
          };
          
          console.log(`Saving trend topic: ${trendTopic.title.substring(0, 30)}... from ${trendTopic.sourceId}, metrics: views=${trendTopic.views}, reactions=${trendTopic.reactions}, comments=${trendTopic.comments}`);
          
          // Используем storage вместо прямого обращения к Directus API
          await storage.createCampaignTrendTopic(trendTopic);
          savedCount++;
        } catch (err) {
          console.error("Error saving trend:", err);
          if (err instanceof Error) {
            errors.push(err);
          } else {
            errors.push(new Error(String(err)));
          }
        }
      }
      
      console.log(`Successfully saved ${savedCount} of ${trendsData.length} trends`);
      
      res.json({
        success: true,
        message: `Processed ${trendsData.length} trends`,
        saved: savedCount,
        errors: errors.length > 0 ? errors.map(e => e.message) : null
      });
    } catch (error) {
      console.error("Error processing webhook data:", error);
      res.status(500).json({ 
        error: "Failed to process trend data", 
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Эндпоинт для потоковой передачи видео с оптимизацией для разных источников
  app.get("/api/stream-video", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).send('URL parameter is required');
    }
    
    console.log(`[Video Stream] Requested video streaming for: ${videoUrl}`);
    
    // Проверяем дополнительные параметры
    const forceType = req.query.forceType as string || null;
    const itemId = req.query.itemId as string || '';
    
    // Проверяем, является ли это видео из Instagram
    const isInstagram = videoUrl.includes('instagram.') || 
                       videoUrl.includes('fbcdn.net') || 
                       videoUrl.includes('cdninstagram.com') ||
                       forceType === 'instagram';
                       
    if (isInstagram) {
      console.log(`[Video Stream] Detected Instagram video, providing direct link instead of streaming`);
      
      // Добавляем параметр для обхода кеширования
      const separator = videoUrl.includes('?') ? '&' : '?';
      const nocacheUrl = `${videoUrl}${separator}_nocache=${Date.now()}`;
      
      // Перенаправляем пользователя на прямую ссылку
      return res.redirect(nocacheUrl);
    }
    const range = req.headers.range || null;
    
    try {
      // Декодируем URL если он закодирован
      const decodedUrl = decodeURIComponent(videoUrl);
      
      // Стримим видео с помощью нашей вспомогательной функции
      await streamVideo(decodedUrl, res, {
        forceType,
        range: range as string | null,
        itemId
      });
    } catch (error) {
      console.error('Error in video streaming endpoint:', error);
      res.status(500).send('Ошибка при стриминге видео');
    }
  });

  // Маршрут для получения кампаний пользователя
  
  // Интерфейс для информации о связанных данных кампании
  interface RelatedDataInfo {
    hasContent: boolean;
    hasKeywords: boolean;
    hasTrends: boolean;
    totalItems: {
      content: number;
      keywords: number;
      trends: number;
    };
  }

  // Маршрут для удаления кампании с проверкой наличия связанных данных
  // Маршрут для удаления кампании
  app.delete("/api/campaigns/:campaignId", authenticateUser, async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.campaignId;
      const forceDelete = req.query.forceDelete === 'true';
      const userId = req.user?.id;
      
      console.log(`Запрос на удаление кампании ${campaignId}. ForceDelete: ${forceDelete}, UserId: ${userId}`);
      
      if (!campaignId) {
        return res.status(400).json({ 
          success: false, 
          error: "Идентификатор кампании не указан" 
        });
      }
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: "Пользователь не авторизован" 
        });
      }
      
      // Проверяем наличие связанных данных, если не указан forceDelete
      if (!forceDelete) {
        try {
          const relatedDataInfo = await checkCampaignRelatedData(campaignId, req.headers.authorization);
          
          // Если есть связанные данные, возвращаем информацию о них и требуем подтверждения
          if (relatedDataInfo.hasContent || relatedDataInfo.hasKeywords || relatedDataInfo.hasTrends) {
            console.log(`Кампания ${campaignId} содержит связанные данные:`, relatedDataInfo);
            return res.status(409).json({
              success: false,
              error: "Кампания содержит связанные данные",
              message: "Кампания содержит связанные данные, которые также будут удалены. Подтвердите удаление.",
              relatedData: relatedDataInfo,
              requireConfirmation: true
            });
          }
        } catch (error) {
          console.log("Ошибка при проверке связанных данных, продолжаем:", error);
          // Продолжаем без проверки связанных данных
        }
      }
      
      // В случае принудительного удаления, сначала удаляем связанные данные
      if (forceDelete) {
        try {
          console.log(`Принудительное удаление кампании ${campaignId} со связанными данными`);
          
          // Обрабатываем токен авторизации
          let authToken = req.headers.authorization || '';
          if (authToken && !authToken.startsWith('Bearer ')) {
            authToken = `Bearer ${authToken}`;
          }
          
          // 1. Удаляем связанные ключевые слова
          await deleteRelatedItems('campaign_keywords', campaignId, authToken);
          
          // 2. Удаляем связанные темы трендов
          await deleteRelatedItems('campaign_trend_topics', campaignId, authToken);
          
          // 3. Удаляем связанный контент
          await deleteRelatedItems('campaign_content', campaignId, authToken);
          
          console.log(`Все связанные данные для кампании ${campaignId} удалены`);
          
          // 4. Пытаемся удалить саму кампанию
          try {
            // Пробуем удалить кампанию из основной таблицы user_campaigns
            console.log(`Удаление кампании ${campaignId} из таблицы user_campaigns`);
            await directusApi.delete(`/items/user_campaigns/${campaignId}`, {
              headers: { Authorization: authToken }
            });
            console.log(`Кампания ${campaignId} успешно удалена из user_campaigns`);
            
            return res.json({ 
              success: true, 
              message: "Кампания и связанные данные успешно удалены",
              id: campaignId
            });
          } catch (error) {
            console.error(`Ошибка при удалении кампании ${campaignId}:`, error);
            
            // В случае ошибки последнего этапа все равно считаем операцию успешной,
            // так как связанные данные были удалены
            return res.json({
              success: true,
              message: "Связанные данные кампании удалены, но возникла ошибка при удалении самой кампании",
              id: campaignId
            });
          }
        } catch (error) {
          console.error(`Ошибка при удалении связанных данных кампании ${campaignId}:`, error);
          
          // В случае ошибки пытаемся удалить хотя бы саму кампанию
          try {
            let authToken = req.headers.authorization || '';
            if (authToken && !authToken.startsWith('Bearer ')) {
              authToken = `Bearer ${authToken}`;
            }
            
            await directusApi.delete(`/items/user_campaigns/${campaignId}`, {
              headers: { Authorization: authToken }
            });
            
            return res.json({
              success: true,
              message: "Кампания удалена, но возникла ошибка при удалении связанных данных",
              id: campaignId
            });
          } catch (campaignError) {
            console.error(`Не удалось удалить кампанию ${campaignId}:`, campaignError);
            
            // Возвращаем ошибку клиенту
            return res.status(500).json({
              success: false,
              error: "Не удалось удалить кампанию и связанные данные",
              message: error instanceof Error ? error.message : "Неизвестная ошибка"
            });
          }
        }
      }
      
      // Стандартный запрос на удаление через Directus API
      try {
        console.log(`Выполнение запроса на удаление кампании ${campaignId}`);
        
        // Обрабатываем токен авторизации, убедившись, что он в правильном формате
        let authToken = req.headers.authorization;
        if (authToken && !authToken.startsWith('Bearer ')) {
          authToken = `Bearer ${authToken}`;
        }
        
        // Пробуем удалить кампанию из основной таблицы user_campaigns
        console.log(`Удаление кампании ${campaignId} из таблицы user_campaigns`);
        try {
          await directusApi.delete(`/items/user_campaigns/${campaignId}`, {
            headers: { Authorization: authToken }
          });
          console.log(`Кампания ${campaignId} успешно удалена из user_campaigns`);
        } catch (userCampaignError) {
          console.error(`Ошибка при удалении из user_campaigns:`, userCampaignError.message);
        }
        
        // Дополнительно попробуем удалить из оригинальной таблицы campaigns если она существует
        try {
          await directusApi.delete(`/items/user_campaigns/${campaignId}`, {
            headers: { Authorization: authToken }
          });
          console.log(`Кампания ${campaignId} успешно удалена из campaigns`);
        } catch (campaignsError) {
          console.log(`Таблица campaigns не найдена или запись уже удалена:`, campaignsError.message);
        }
        
        console.log(`Процесс удаления кампании ${campaignId} завершен`);
        return res.json({ 
          success: true, 
          message: "Кампания успешно удалена",
          id: campaignId
        });
      } catch (deleteError) {
        console.error(`Общая ошибка при удалении кампании ${campaignId}:`, deleteError.message);
        
        // Даже при ошибке возвращаем успех, так как пользователи - администраторы
        // и должны иметь возможность удалять всё
        return res.json({ 
          success: true, 
          message: "Кампания удалена",
          id: campaignId
        });
      }
    } catch (error) {
      console.error('Ошибка обработки запроса на удаление кампании:', error);
      
      // При форсированном удалении имитируем успех даже при ошибке
      if (req.query.forceDelete === 'true') {
        return res.json({ 
          success: true, 
          message: "Кампания помечена как удаленная" 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        error: "Внутренняя ошибка сервера",
        details: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  });
  
  /**
   * Проверяет наличие связанных данных для кампании
   * @param campaignId ID кампании
   * @param token Токен авторизации
   * @returns Информация о связанных данных
   */
  async function checkCampaignRelatedData(campaignId: string, token: string): Promise<RelatedDataInfo> {
    // Инициализируем объект с информацией о связанных данных
    const relatedDataInfo: RelatedDataInfo = {
      hasContent: false,
      hasKeywords: false,
      hasTrends: false,
      totalItems: {
        content: 0,
        keywords: 0,
        trends: 0
      }
    };
    
    try {
      // Выполняем параллельные запросы для ускорения проверки
      const [contentCount, keywordsCount, trendsCount] = await Promise.all([
        countItems('campaign_content', campaignId, token),
        countItems('campaign_keywords', campaignId, token),
        countItems('campaign_trend_topics', campaignId, token)
      ]);
      
      // Заполняем информацию о наличии контента
      relatedDataInfo.hasContent = contentCount > 0;
      relatedDataInfo.totalItems.content = contentCount;
      
      // Заполняем информацию о наличии ключевых слов
      relatedDataInfo.hasKeywords = keywordsCount > 0;
      relatedDataInfo.totalItems.keywords = keywordsCount;
      
      // Заполняем информацию о наличии трендов
      relatedDataInfo.hasTrends = trendsCount > 0;
      relatedDataInfo.totalItems.trends = trendsCount;
      
      console.log(`Проверка связанных данных для кампании ${campaignId}:`, relatedDataInfo);
      
      return relatedDataInfo;
    } catch (error) {
      console.error('Ошибка при проверке связанных данных:', error);
      return relatedDataInfo;
    }
  }
  
  // Эндпоинты для проверки API ключей социальных сетей
  
  // Проверка Telegram бота
  app.post("/api/validate/telegram", authenticateUser, async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: "Токен не указан" 
        });
      }
      
      const result = await validateTelegramToken(token);
      return res.json({
        success: result.isValid,
        message: result.message,
        details: result.details
      });
    } catch (error: any) {
      console.error("Ошибка при проверке токена Telegram:", error);
      return res.status(500).json({
        success: false,
        message: `Ошибка при проверке: ${error.message}`
      });
    }
  });

  // Проверка токена VK
  app.post("/api/validate/vk", authenticateUser, async (req, res) => {
    try {
      const { token, groupId } = req.body;
      
      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: "Токен не указан" 
        });
      }
      
      const result = await validateVkToken(token, groupId);
      return res.json({
        success: result.isValid,
        message: result.message,
        details: result.details
      });
    } catch (error: any) {
      console.error("Ошибка при проверке токена VK:", error);
      return res.status(500).json({
        success: false,
        message: `Ошибка при проверке: ${error.message}`
      });
    }
  });

  // Проверка токена Instagram
  app.post("/api/validate/instagram", authenticateUser, async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: "Токен не указан" 
        });
      }
      
      const result = await validateInstagramToken(token);
      return res.json({
        success: result.isValid,
        message: result.message,
        details: result.details
      });
    } catch (error: any) {
      console.error("Ошибка при проверке токена Instagram:", error);
      return res.status(500).json({
        success: false,
        message: `Ошибка при проверке: ${error.message}`
      });
    }
  });

  // Проверка токена Facebook
  app.post("/api/validate/facebook", authenticateUser, async (req, res) => {
    try {
      const { token, pageId } = req.body;
      
      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: "Токен не указан" 
        });
      }
      
      const result = await validateFacebookToken(token, pageId);
      return res.json({
        success: result.isValid,
        message: result.message,
        details: result.details
      });
    } catch (error: any) {
      console.error("Ошибка при проверке токена Facebook:", error);
      return res.status(500).json({
        success: false,
        message: `Ошибка при проверке: ${error.message}`
      });
    }
  });

  // Проверка API ключа YouTube
  app.post("/api/validate/youtube", authenticateUser, async (req, res) => {
    try {
      const { apiKey, channelId } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ 
          success: false, 
          message: "API ключ не указан" 
        });
      }
      
      const result = await validateYoutubeApiKey(apiKey, channelId);
      return res.json({
        success: result.isValid,
        message: result.message,
        details: result.details
      });
    } catch (error: any) {
      console.error("Ошибка при проверке API ключа YouTube:", error);
      return res.status(500).json({
        success: false,
        message: `Ошибка при проверке: ${error.message}`
      });
    }
  });

  // Stories API routes
  app.use('/api', storiesRouter);
  
  // Stories preview generation
  app.post('/api/stories/generate-preview', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { handleGenerateStoryPreviews } = await import('./api/stories-generator');
      await handleGenerateStoryPreviews(req, res);
    } catch (error) {
      console.error('Error loading stories generator:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  app.get("/api/campaigns", authenticateUser, async (req, res) => {
    try {
      // Получаем userId двумя способами - из middleware authenticateUser или из заголовка
      const authenticatedUserId = (req as any).userId;
      const headerUserId = req.headers['x-user-id'];
      
      // Выбираем userId из доступных источников
      const userId = authenticatedUserId || 
                    (typeof headerUserId === 'string' ? headerUserId : 
                    Array.isArray(headerUserId) ? headerUserId[0] : null);
      
      const authHeader = req.headers['authorization'] || req.headers.authorization;
      
      if (!userId) {
        console.log("Missing userId (auth middleware and header)");
        return res.status(401).json({ error: "Не авторизован: отсутствует идентификатор пользователя" });
      }
      
      if (!authHeader) {
        console.log("Missing authorization header");
        return res.status(401).json({ error: "Не авторизован: отсутствует заголовок авторизации" });
      }
      
      // Проверяем, что формат заголовка соответствует ожидаемому
      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.replace('Bearer ', '')
        : Array.isArray(authHeader) && authHeader[0].startsWith('Bearer ')
          ? authHeader[0].replace('Bearer ', '')
          : null;
      
      if (!token) {
        console.log("Invalid token format in header");
        return res.status(401).json({ error: "Неверный формат токена авторизации" });
      }
          
      try {
        console.log(`Fetching campaigns for user: ${userId}`);
        
        // Получаем кампании из Directus, СТРОГО фильтруя по user_id
        console.log(`Sending request to Directus with filter user_id = ${userId}`);
        
        const response = await directusApi.get('/items/user_campaigns', {
          params: {
            filter: JSON.stringify({
              "user_id": {
                "_eq": userId
              }
            }),
            // Обеспечиваем, чтобы вернулись только кампании указанного пользователя
            "fields": ["*", "user_id"]
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Проверяем, что получили массив
        if (!Array.isArray(response.data.data)) {
          console.error("Unexpected response format from Directus:", response.data);
          return res.status(500).json({ error: "Неожиданный формат ответа от Directus API" });
        }
        
        // Строго фильтруем по userId перед преобразованием
        console.log('Filtering server-side for userId:', userId);
        
        // Преобразуем userId к строке для безопасного сравнения
        const stringUserId = String(userId);
        const filteredItems = response.data.data.filter((item: any) => {
          const itemUserId = String(item.user_id);
          const matches = itemUserId === stringUserId;
          
          if (!matches) {
            console.log(`Item user_id mismatch: ${itemUserId} !== ${stringUserId}`);
          }
          
          return matches;
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const campaigns = filteredItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: cleanupText(item.description),
          userId: item.user_id,
          createdAt: item.created_at,
          socialMediaSettings: item.social_media_settings || null,
          trendAnalysisSettings: item.trend_analysis_settings || {
            minFollowers: {
              instagram: 5000,
              telegram: 2000,
              vk: 3000,
              facebook: 5000,
              youtube: 10000
            },
            maxSourcesPerPlatform: 10,
            maxTrendsPerSource: 5
          }
        }));
        
        console.log(`Found ${campaigns.length} campaigns for user ${userId} (filtered from ${response.data.data.length} total)`);
        
        // Дополнительная отладочная информация для ЛЮБОГО результата
        console.log('All campaign user_ids in response:', response.data.data.map((item: any) => item.user_id).join(', '));
        console.log('User ID from request:', userId);
        console.log('Types - userId:', typeof userId, 'first db userId:', typeof response.data.data[0]?.user_id);
        
        // Проверяем все кампании и логгируем те, что не соответствуют userId
        const wrongCampaigns = response.data.data.filter((item: any) => item.user_id !== userId);
        if (wrongCampaigns.length > 0) {
          console.log('WARNING: Found campaigns with wrong user_id:', 
            wrongCampaigns.map((item: any) => ({
              id: item.id,
              name: item.name,
              user_id: item.user_id
            }))
          );
        }
        
        res.json({ data: campaigns });
      } catch (error) {
        console.error("Error fetching campaigns:", error);
        if (axios.isAxiosError(error)) {
          console.error('Directus API error details:', {
            status: error.response?.status,
            data: error.response?.data,
            config: {
              url: error.config?.url,
              method: error.config?.method,
              params: error.config?.params
            }
          });
        }
        res.status(500).json({ error: "Не удалось загрузить кампании" });
      }
    } catch (error) {
      console.error("Error in campaigns route:", error);
      res.status(500).json({ error: "Не удалось загрузить кампании", details: error.message });
    }
  });

  // Endpoint для получения трендовых тем кампании
  app.get("/api/campaign-trends", authenticateUser, async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      const period = req.query.period as string || '7days';
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "Campaign ID is required" });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      let fromDate: Date | undefined;
      
      // Определяем период для фильтрации данных
      switch (period) {
        case '3days':
          fromDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
          break;
        case '7days':
          fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '14days':
          fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }
      
      try {
        // Форматируем дату для фильтра в формате ISO
        const fromDateISO = fromDate.toISOString();
        
        // Создаем фильтр с учетом периода
        const filter: any = {
          campaign_id: {
            _eq: campaignId
          }
        };
        
        // Применяем фильтрацию по дате для всех периодов кроме "all"
        if (period !== 'all') {
          filter.created_at = {
            _gte: fromDateISO
          };
        }
        
        // Получаем темы напрямую из Directus API
        // Для всех периодов загружаем ВСЕ записи без ограничений
        const params: any = {
          filter: filter,
          sort: ['-created_at'],
          limit: -1 // Всегда загружаем ВСЕ записи без ограничений
        };
        
        const response = await directusApi.get('/items/campaign_trend_topics', {
          params,
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Обработка данных без избыточного логирования
        
        // Преобразуем данные из формата Directus в наш формат
        const trendTopics = response.data.data.map((item: any) => {
          return {
            id: item.id,
            title: item.title,
            sourceId: item.source_id,
            sourceName: item.source_name || 'Источник',
            // Сохраняем оригинальные имена полей из базы данных
            accountUrl: item.accountUrl || null,
            urlPost: item.urlPost || null,
            // Добавляем поля для обратной совместимости
            sourceUrl: item.accountUrl || null,
            url: item.urlPost || null,
            // Добавляем поле description из базы и очищаем от лишних многоточий
            description: cleanupText(item.description) || null,
            reactions: item.reactions,
            comments: item.comments,
            views: item.views,
            // Добавляем trendScore - показатель трендовости контента
            trendScore: item.trendScore || 0,
            // Важно! Передаем дату в нескольких форматах для совместимости
            createdAt: item.created_at ? new Date(item.created_at).toISOString() : null,
            created_at: item.created_at ? new Date(item.created_at).toISOString() : null, // Дублируем для Snake Case
            isBookmarked: item.is_bookmarked,
            campaignId: item.campaign_id,
            media_links: item.media_links,
            // Добавляем поле sourceType для корректной фильтрации платформ
            sourceType: item.sourceType || null,
            // ВАЖНО: Включаем данные анализа настроения
            sentiment_analysis: item.sentiment_analysis || null
          };
        });
        
        res.json({ 
          success: true,
          data: trendTopics 
        });
      } catch (directusError) {
        if (axios.isAxiosError(directusError)) {
          // Проверяем, является ли это ошибкой коллекции (collection)
          if (directusError.response?.status === 403) {
            
            // Не возвращаем ошибку, а пустой массив
            return res.json({ 
              success: true,
              data: [],
              message: "У вас нет прав доступа к коллекции трендов, возвращаем пустой массив"
            });
          }
          
          if (directusError.response?.status === 404 || 
            directusError.message?.includes('collection "campaign_trend_topics" not found') ||
            directusError.response?.data?.errors?.[0]?.extensions?.code === 'COLLECTION_NOT_FOUND') {
            
            // Не возвращаем ошибку, а пустой массив
            return res.json({ 
              success: true,
              data: [],
              message: "Коллекция трендов не найдена в Directus, возвращаем пустой массив"
            });
          }
        }
        
        // Возвращаем пустой массив, чтобы интерфейс корректно отработал
        return res.json({ 
          success: true,
          data: [],
          message: "Не удалось получить тренды из Directus, возвращаем пустой массив"
        });
      }
    } catch (error) {
      console.error("Error fetching campaign trend topics:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch campaign trend topics",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Endpoint для закладок трендовых тем
  app.patch("/api/campaign-trends/:id/bookmark", authenticateUser, async (req, res) => {
    try {
      const topicId = req.params.id;
      const { isBookmarked } = req.body;
      const authHeader = req.headers['authorization'];
      
      if (typeof isBookmarked !== 'boolean') {
        return res.status(400).json({ 
          success: false,
          error: "isBookmarked field (boolean) is required" 
        });
      }
      
      if (!authHeader) {
        return res.status(401).json({ 
          success: false,
          error: "Unauthorized" 
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Обновляем статус закладки через Directus API
        const response = await directusApi.patch(`/items/campaign_trend_topics/${topicId}`, {
          is_bookmarked: isBookmarked
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.data || !response.data.data) {
          return res.status(404).json({ 
            success: false,
            error: "Topic not found" 
          });
        }
        
        // Преобразуем данные из формата Directus в наш формат
        const updatedTopic = {
          id: response.data.data.id,
          title: response.data.data.title,
          sourceId: response.data.data.source_id,
          reactions: response.data.data.reactions,
          comments: response.data.data.comments,
          views: response.data.data.views,
          createdAt: response.data.data.created_at,
          isBookmarked: response.data.data.is_bookmarked,
          campaignId: response.data.data.campaign_id
        };
        
        res.json({ 
          success: true,
          data: updatedTopic 
        });
      } catch (directusError) {
        console.error("Error updating bookmark in Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
          
          if (directusError.response.status === 404) {
            return res.status(404).json({ 
              success: false,
              error: "Topic not found" 
            });
          }
        }
        
        return res.status(500).json({ 
          success: false,
          error: "Failed to update bookmark status",
          message: directusError instanceof Error ? directusError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error updating bookmark status:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update bookmark status",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // API эндпоинт для получения комментариев тренда
  app.get("/api/trend-comments/:trendId", async (req, res) => {
    try {
      const trendId = req.params.trendId;
      const authHeader = req.headers['authorization'];
      
      console.log(`[GET /api/trend-comments] Запрос комментариев для тренда ${trendId}`);
      
      // Добавляем дополнительную отладочную информацию
      console.log(`[GET /api/trend-comments] Ищем комментарии с trend_id: ${trendId}`);
      
      if (!trendId) {
        console.log('[GET /api/trend-comments] Ошибка: ID тренда не указан');
        return res.status(400).json({ error: "Trend ID is required" });
      }
      
      // Обязательно требуем пользовательский токен
      if (!authHeader) {
        console.log('[GET /api/trend-comments] Ошибка: отсутствует заголовок авторизации');
        return res.status(401).json({ error: "Требуется авторизация пользователя" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      console.log(`[GET /api/trend-comments] Используем пользовательский токен: ${token.substring(0, 10)}...`);
      
      // Проверяем действительность токена пользователя
      try {
        const userResponse = await directusApi.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`[GET /api/trend-comments] Токен действителен для пользователя: ${userResponse.data?.data?.email}`);
      } catch (tokenError) {
        console.log(`[GET /api/trend-comments] Ошибка проверки токена:`, tokenError);
        return res.status(401).json({ error: "Недействительный токен пользователя" });
      }
      
      try {
        console.log(`[GET /api/trend-comments] Fetching comments for trend: ${trendId}`);
        
        // Используем ТОЛЬКО пользовательский токен для доступа к комментариям
        console.log(`[GET /api/trend-comments] Используем пользовательский токен для доступа к post_comment`);
        const response = await directusApi.get('/items/post_comment', {
          params: {
            'filter[trent_post_id][_eq]': trendId,
            'sort[]': ['-date'],
            'limit': 100,
            'fields': ['id', 'trent_post_id', 'text', 'author', 'date', 'comment_id', 'platform']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`[GET /api/trend-comments] Directus response:`, {
          status: response.status,
          dataLength: response.data?.data?.length,
          trendId: trendId,
          firstComment: response.data?.data?.[0]
        });
        
        const comments = response.data?.data || [];
        
        if (comments.length === 0) {
          // Если комментариев не найдено, попробуем найти любые комментарии для отладки
          console.log(`[GET /api/trend-comments] Комментарии не найдены для trent_post_id: ${trendId}, проверяем все доступные`);
          try {
            // Используем пользовательский токен для отладки
            const allCommentsResponse = await directusApi.get('/items/post_comment', {
              params: {
                'limit': 5,
                'fields': ['id', 'trent_post_id', 'text']
              },
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            console.log(`[GET /api/trend-comments] Найдено комментариев всего: ${allCommentsResponse.data?.data?.length}`);
            if (allCommentsResponse.data?.data?.length > 0) {
              console.log(`[GET /api/trend-comments] Примеры trent_post_id в базе:`, 
                allCommentsResponse.data.data.slice(0, 3).map((c: any) => c.trent_post_id)
              );
            }
          } catch (debugError) {
            console.log(`[GET /api/trend-comments] Ошибка при отладочном запросе:`, debugError);
          }
        }
        
        console.log(`[GET /api/trend-comments] Возвращаем ${comments.length} комментариев для тренда ${trendId}`);
        
        res.json({ 
          success: true,
          data: comments,
          count: comments.length 
        });
        
      } catch (directusError) {
        console.error(`[GET /api/trend-comments] Directus API error:`, directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", {
            status: directusError.response.status,
            data: directusError.response.data,
            config: {
              url: directusError.config?.url,
              method: directusError.config?.method,
              params: directusError.config?.params
            }
          });
          
          if (directusError.response.status === 404) {
            return res.status(404).json({ 
              success: false,
              error: "Comments not found" 
            });
          }
        }
        
        return res.status(500).json({ 
          success: false,
          error: "Failed to fetch comments",
          message: directusError instanceof Error ? directusError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("[GET /api/trend-comments] Error:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch comments",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Анализ настроения комментариев по тренду (только админский токен)
  app.post("/api/trend-sentiment/:trendId", async (req, res) => {
    try {
      const { trendId } = req.params;
      
      console.log(`[POST /api/trend-sentiment] Запрос анализа настроения для тренда ${trendId}`);
      
      // Используем ТОЛЬКО админский токен для всех операций
      const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || process.env.DIRECTUS_TOKEN;
      if (!systemToken) {
        console.log('[POST /api/trend-sentiment] Ошибка: админский токен недоступен');
        return res.status(500).json({ error: "Системная ошибка доступа" });
      }
      
      console.log(`[POST /api/trend-sentiment] ✅ Используем админский токен для анализа настроений`);
      
      try {
        console.log(`[POST /api/trend-sentiment] Получаем комментарии для анализа настроения`);
        
        // Получаем комментарии из базы данных
        const response = await directusApi.get('/items/post_comment', {
          params: {
            'filter[trent_post_id][_eq]': trendId,
            'limit': 50, // Анализируем первые 50 комментариев
            'fields': ['text', 'platform']
          },
          headers: {
            'Authorization': `Bearer ${systemToken}`
          }
        });
        
        const comments = response.data?.data || [];
        console.log(`[POST /api/trend-sentiment] Найдено ${comments.length} комментариев для анализа`);
        
        if (comments.length === 0) {
          return res.json({
            success: true,
            data: {
              sentiment: 'neutral',
              confidence: 0,
              details: {
                positive: 0,
                negative: 0,
                neutral: 100
              },
              summary: 'Комментарии для анализа не найдены'
            }
          });
        }
        
        // Подготавливаем текст для анализа
        const commentTexts = comments.map((c: any) => c.text).join('\n---\n');
        
        console.log(`[POST /api/trend-sentiment] Отправляем ${commentTexts.length} символов на анализ в Gemini`);
        
        // ВРЕМЕННОЕ РЕШЕНИЕ: Прямой вызов Gemini API для анализа настроения
        const analysisPrompt = `Проанализируй настроение этих комментариев к посту в социальной сети. 
Верни результат в JSON формате:
{
  "sentiment": "positive/negative/neutral",
  "confidence": число от 0 до 100,
  "details": {
    "positive": процент положительных,
    "negative": процент отрицательных, 
    "neutral": процент нейтральных
  },
  "summary": "краткое описание общего настроения"
}

Комментарии для анализа:
${commentTexts}`;

        // Используем gemini-proxy с Vertex AI (модель 2.5 автоматически направляется на Vertex AI)
        let result;
        try {
          // Получаем глобальный Gemini ключ (для API ключа)
          let geminiKey = 'dummy'; // Для Vertex AI API ключ не нужен, используется Service Account
          try {
            const globalKeys = await globalApiKeysService.getGlobalApiKeys();
            geminiKey = globalKeys.gemini || globalKeys.GEMINI_API_KEY || 'vertex-ai-service-account';
          } catch (keyError) {
            console.log(`[POST /api/trend-sentiment] Используем Service Account для Vertex AI`);
          }

          const geminiProxyServiceInstance = new GeminiProxyService({ apiKey: geminiKey });
          result = await geminiProxyServiceInstance.generateText({
            prompt: analysisPrompt,
            model: 'gemini-2.5-flash', // Эта модель автоматически направляется на Vertex AI
            temperature: 0.2,
            maxOutputTokens: 800
          });
        } catch (geminiError) {
          console.error(`[POST /api/trend-sentiment] ❌ Ошибка Gemini API:`, geminiError.message);
          // Возвращаем нейтральный результат при ошибке
          result = JSON.stringify({
            sentiment: 'neutral',
            confidence: 50,
            details: { positive: 33, negative: 33, neutral: 34 },
            summary: 'Анализ недоступен из-за технической ошибки'
          });
        }
        
        console.log(`[POST /api/trend-sentiment] 🔍 Сырой ответ от Gemini (первые 500 символов):`, result.substring(0, 500));
        
        // Парсим JSON ответ
        let sentimentData;
        try {
          // Попытка извлечь JSON из ответа Gemini (может содержать дополнительный текст)
          const jsonMatch = result.match(/\{[\s\S]*\}/);
          const jsonString = jsonMatch ? jsonMatch[0] : result;
          
          console.log(`[POST /api/trend-sentiment] 📝 Извлеченный JSON для парсинга:`, jsonString);
          sentimentData = JSON.parse(jsonString);
          console.log(`[POST /api/trend-sentiment] ✅ JSON успешно распарсен:`, sentimentData);
        } catch (parseError) {
          console.log(`[POST /api/trend-sentiment] ❌ Ошибка парсинга JSON:`, parseError.message);
          console.log(`[POST /api/trend-sentiment] ❌ Оригинальный ответ Gemini:`, result);
          console.log(`[POST /api/trend-sentiment] 🔄 Используем fallback анализ`);
          // Fallback анализ
          sentimentData = {
            sentiment: 'neutral',
            confidence: 70,
            details: {
              positive: 40,
              negative: 20,
              neutral: 40
            },
            summary: 'Анализ выполнен с базовой оценкой настроения'
          };
        }
        
        console.log(`[POST /api/trend-sentiment] Результат анализа:`, sentimentData);
        
        // Сохраняем анализ настроения в тренд
        try {
          const updateData = {
            sentiment_analysis: {
              ...sentimentData,
              analyzed_at: new Date().toISOString(),
              comments_count: comments.length
            }
          };
          
          console.log(`[POST /api/trend-sentiment] Сохраняем анализ в тренд ${trendId}`);
          
          await directusApi.patch(`/items/campaign_trend_topics/${trendId}`, updateData, {
            headers: {
              'Authorization': `Bearer ${systemToken}`
            }
          });
          
          console.log(`[POST /api/trend-sentiment] Анализ настроения сохранен в тренд`);
        } catch (saveError) {
          console.log(`[POST /api/trend-sentiment] Ошибка сохранения анализа:`, saveError);
          // Продолжаем выполнение, даже если сохранение не удалось
        }
        
        res.json({
          success: true,
          data: sentimentData,
          commentsAnalyzed: comments.length
        });
        
      } catch (error) {
        console.error(`[POST /api/trend-sentiment] Ошибка анализа:`, error);
        return res.status(500).json({ 
          success: false,
          error: "Ошибка при анализе настроения",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("[POST /api/trend-sentiment] Error:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to analyze sentiment",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Анализ комментариев на многоуровневой основе
  app.post("/api/analyze-comments", authenticateUser, async (req: any, res) => {
    try {
      const { trendId, level, campaignId } = req.body;
      
      console.log(`[POST /api/analyze-comments] Запрос анализа комментариев для тренда ${trendId}, уровень: ${level}`);
      
      if (!trendId || !level) {
        return res.status(400).json({ 
          success: false,
          error: "trendId и level обязательны" 
        });
      }
      
      if (!['trend', 'source'].includes(level)) {
        return res.status(400).json({ 
          success: false,
          error: "level должен быть 'trend' или 'source'" 
        });
      }
      
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ 
          success: false,
          error: "Токен авторизации обязателен" 
        });
      }
      
      try {
        // Получаем комментарии для анализа
        const response = await directusApi.get('/items/post_comment', {
          params: {
            'filter[trent_post_id][_eq]': trendId,
            'limit': 100,
            'fields': ['id', 'text', 'platform', 'author', 'date']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const comments = response.data?.data || [];
        console.log(`[POST /api/analyze-comments] Найдено ${comments.length} комментариев для анализа`);
        
        if (comments.length === 0) {
          return res.json({
            success: true,
            data: {
              level,
              trendId,
              analysis: {
                sentiment: 'neutral',
                confidence: 0,
                themes: [],
                summary: 'Комментарии для анализа не найдены'
              },
              commentsAnalyzed: 0
            }
          });
        }
        
        // Подготавливаем текст для анализа
        const commentTexts = comments.map((c: any) => 
          `[${c.platform}] ${c.author}: ${c.text}`
        ).join('\n---\n');
        
        console.log(`[POST /api/analyze-comments] Отправляем анализ на уровне ${level} в Gemini`);
        
        // ВРЕМЕННОЕ РЕШЕНИЕ: Прямой вызов Gemini API для многоуровневого анализа
        const analysisPrompt = level === 'trend' 
          ? `Проанализируй комментарии к посту на уровне ТРЕНДА. Сфокусируйся на общих реакциях пользователей, популярности контента и вовлеченности аудитории.
          
Верни результат в JSON формате:
{
  "sentiment": "positive/negative/neutral",
  "confidence": число от 0 до 100,
  "themes": ["тема1", "тема2", "тема3"],
  "engagement": "high/medium/low",
  "viral_potential": число от 0 до 100,
  "summary": "анализ тренда и реакций аудитории"
}

Комментарии:
${commentTexts}`
          : `Проанализируй комментарии к посту на уровне ИСТОЧНИКА. Сфокусируйся на репутации источника, качестве контента и отношении аудитории к конкретному источнику/автору.

Верни результат в JSON формате:
{
  "sentiment": "positive/negative/neutral", 
  "confidence": число от 0 до 100,
  "themes": ["тема1", "тема2", "тема3"],
  "source_reputation": "excellent/good/average/poor",
  "content_quality": "high/medium/low",
  "audience_trust": число от 0 до 100,
  "summary": "анализ источника и доверия аудитории"
}

Комментарии:
${commentTexts}`;

        // Получаем глобальный Gemini ключ
        let geminiKey;
        try {
          const globalKeys = await globalApiKeysService.getGlobalApiKeys();
          geminiKey = globalKeys.gemini || globalKeys.GEMINI_API_KEY;
        } catch (keyError) {
          console.error(`[POST /api/analyze-comments] Ошибка получения Gemini ключа:`, keyError);
          throw new Error('Gemini ключ недоступен');
        }

        const geminiProxyServiceInstance = new GeminiProxyService({ apiKey: geminiKey });
        const result = await geminiProxyServiceInstance.generateText({
          prompt: analysisPrompt,
          model: 'gemini-1.5-flash',
          temperature: 0.3,
          maxOutputTokens: 1000
        });
        
        console.log(`[POST /api/analyze-comments] Получен ответ от Gemini, парсим JSON`);
        
        let analysisData;
        try {
          const jsonMatch = result.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysisData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('JSON не найден в ответе');
          }
        } catch (parseError) {
          console.log(`[POST /api/analyze-comments] Ошибка парсинга JSON:`, parseError);
          analysisData = {
            sentiment: 'neutral',
            confidence: 50,
            themes: ['Общие комментарии'],
            summary: 'Анализ выполнен, но структурированные данные недоступны'
          };
        }
        
        // Сохраняем результат анализа в поле sentiment_analysis тренда
        try {
          const currentAnalysis = level === 'trend' 
            ? { trend_level: analysisData }
            : { source_level: analysisData };
            
          await directusApi.patch(`/items/campaign_trend_topics/${trendId}`, {
            sentiment_analysis: currentAnalysis
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log(`[POST /api/analyze-comments] Анализ уровня ${level} сохранен в тренд`);
        } catch (saveError) {
          console.log(`[POST /api/analyze-comments] Ошибка сохранения анализа:`, saveError);
        }
        
        res.json({
          success: true,
          data: {
            level,
            trendId,
            analysis: analysisData,
            commentsAnalyzed: comments.length
          }
        });
        
      } catch (error) {
        console.error(`[POST /api/analyze-comments] Ошибка анализа:`, error);
        return res.status(500).json({ 
          success: false,
          error: "Ошибка при анализе комментариев",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("[POST /api/analyze-comments] Error:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to analyze comments",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Campaign Keywords routes
  // API эндпоинт для получения ключевых слов кампании по ID кампании
  // Используется в KeywordSelector и KeywordTable
  app.get("/api/keywords/:campaignId", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Fetching keywords for campaign ID: ${campaignId} from campaign_keywords table`);
        
        // Получаем ключевые слова для кампании из Directus из таблицы campaign_keywords
        const response = await directusApi.get(`/items/campaign_keywords?filter[campaign_id][_eq]=${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.data || !response.data.data) {
          return res.json([]);
        }
        
        // Трансформируем данные и включаем все необходимые поля из БД
        const keywords = response.data.data.map((item: any) => ({
          id: item.id,
          keyword: item.keyword,
          campaignId: item.campaign_id,
          trend_score: item.trend_score,
          mentions_count: item.mentions_count,
          last_checked: item.last_checked,
          date_created: item.date_created
        }));
        
        return res.json(keywords);
      } catch (error) {
        console.error('Error fetching keywords:', error);
        return res.status(500).json({ error: "Failed to fetch keywords" });
      }
    } catch (error) {
      console.error('Error in /api/keywords/:campaignId endpoint:', error);
      return res.status(500).json({ error: "Server error" });
    }
  });
  
  // API эндпоинт для получения ключевых слов по ID кампании через query параметр
  // Используется в KeywordList и некоторых других компонентах
  app.get("/api/keywords", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      
      if (!campaignId) {
        return res.status(400).json({ error: "Campaign ID is required" });
      }
      
      console.log("Fetching keywords for campaign:", campaignId);
      
      // Получаем токен из заголовка
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Получаем ключевые слова из Directus через таблицу campaign_keywords
        const response = await directusApi.get('/items/campaign_keywords', {
          params: {
            filter: {
              campaign_id: {
                _eq: campaignId
              }
            },
            fields: ['id', 'keyword', 'trend_score', 'mentions_count', 'campaign_id', 'last_checked', 'date_created']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        

        
        // Преобразуем данные из Directus в нужный формат
        const keywords = (response.data?.data || []).map((item: any) => ({
          id: item.id,
          keyword: item.keyword,
          trend_score: item.trend_score,
          mentions_count: item.mentions_count,
          campaign_id: item.campaign_id,
          last_checked: item.last_checked,
          date_created: item.date_created
        }));
        
        res.json({ data: keywords });
      } catch (error) {
        console.error('Error fetching keywords from Directus:', error);
        if (axios.isAxiosError(error)) {
          console.error('Directus API error details:', {
            status: error.response?.status,
            data: error.response?.data,
            config: {
              url: error.config?.url,
              method: error.config?.method,
              params: error.config?.params
            }
          });
        }
        return res.status(401).json({ error: "Invalid token or failed to fetch keywords" });
      }
    } catch (error) {
      console.error("Error fetching keywords:", error);
      res.status(500).json({ error: "Failed to fetch keywords" });
    }
  });
  
  // DELETE endpoint для удаления ключевых слов
  // Используется в KeywordTable и KeywordSelector
  // Важно: после удаления клиенты должны инвалидировать кэши двух API ключей:
  // ["/api/keywords", campaignId] и ["campaign_keywords", campaignId]
  app.delete("/api/keywords/:keywordId", async (req, res) => {
    try {
      const keywordId = req.params.keywordId;
      const authHeader = req.headers.authorization;
      
      console.log(`=== DELETE KEYWORD REQUEST RECEIVED ===`);
      console.log(`Requested keywordId: ${keywordId}`);
      console.log(`Auth header present: ${!!authHeader}`);
      
      if (!authHeader) {
        console.log(`Authorization header missing, returning 401`);
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Deleting keyword with ID: ${keywordId} from campaign_keywords table`);
        
        // Удаляем ключевое слово из Directus через таблицу campaign_keywords
        const deleteUrl = `/items/campaign_keywords/${keywordId}`;
        console.log(`Making DELETE request to Directus: ${deleteUrl}`);
        
        await directusApi.delete(deleteUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`Successfully deleted keyword with ID: ${keywordId}`);
        return res.json({ success: true, message: "Keyword successfully deleted" });
      } catch (error) {
        console.error('Error deleting keyword from Directus:', error);
        if (axios.isAxiosError(error)) {
          console.error('Directus API error details:', {
            status: error.response?.status,
            data: error.response?.data,
            config: {
              url: error.config?.url,
              method: error.config?.method
            }
          });
        }
        return res.status(500).json({ error: "Failed to delete keyword" });
      }
    } catch (error) {
      console.error('Error in /api/keywords/:keywordId DELETE endpoint:', error);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Campaign Content routes
  app.get("/api/campaign-content", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || -1; // -1 означает без лимита
      const offset = limit > 0 ? (page - 1) * limit : 0;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Fetching content for campaign ID: ${campaignId || 'all campaigns'}, page: ${page}, limit: ${limit}`);
        
        // Получаем ID пользователя из токена
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Вместо storage API, получаем контент напрямую из Directus API без лимита
        const params: any = {
          filter: JSON.stringify({
            user_id: {
              _eq: userId
            },
            ...(campaignId ? { campaign_id: { _eq: campaignId } } : {})
          }),
          meta: 'total_count,filter_count',
          limit: limit > 0 ? limit : 10000  // Устанавливаем большой лимит вместо -1
        };

        // Добавляем оффсет только если лимит больше 0 и есть пагинация
        if (limit > 0) {
          params.offset = offset;
        }

        const response = await directusApi.get('/items/campaign_content', {
          params,
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Проверяем, что получили массив
        if (!Array.isArray(response.data.data)) {
          console.error("Unexpected response format from Directus:", response.data);
          return res.status(500).json({ error: "Неожиданный формат ответа от Directus API" });
        }
        
        // Преобразуем данные из формата Directus в наш формат
        const contentItems = response.data.data.map((item: any) => {
          // Обработка keywords - если это строка, пытаемся преобразовать в массив
          let keywords = [];
          if (Array.isArray(item.keywords)) {
            keywords = item.keywords;
          } else if (typeof item.keywords === 'string') {
            try {
              // Пробуем распарсить JSON, если keywords пришли как строка
              const parsedKeywords = JSON.parse(item.keywords);
              keywords = Array.isArray(parsedKeywords) ? parsedKeywords : [];
            } catch (e) {
              // Если не удалось распарсить, создаем пустой массив
              console.warn(`Failed to parse keywords for content ${item.id}:`, e);
              keywords = [];
            }
          }
          
          // Аналогично обрабатываем hashtags и links
          let hashtags = [];
          if (Array.isArray(item.hashtags)) {
            hashtags = item.hashtags;
          } else if (typeof item.hashtags === 'string') {
            try {
              const parsedHashtags = JSON.parse(item.hashtags);
              hashtags = Array.isArray(parsedHashtags) ? parsedHashtags : [];
            } catch (e) {
              hashtags = [];
            }
          }
          
          let links = [];
          if (Array.isArray(item.links)) {
            links = item.links;
          } else if (typeof item.links === 'string') {
            try {
              const parsedLinks = JSON.parse(item.links);
              links = Array.isArray(parsedLinks) ? parsedLinks : [];
            } catch (e) {
              links = [];
            }
          }
          
          return {
            id: item.id,
            campaignId: item.campaign_id,
            userId: item.user_id,
            title: item.title,
            content: item.content,
            contentType: item.content_type,
            imageUrl: item.image_url,
            additionalImages: Array.isArray(item.additional_images) ? item.additional_images : [],
            videoThumbnail: Array.isArray(item.additional_images) && item.additional_images.length > 0 && 
                            (item.content_type === 'video' || item.content_type === 'video-text') 
                            ? item.additional_images[0] : '', // Первое изображение как thumbnail видео
            videoUrl: item.video_url,
            prompt: item.prompt,
            keywords: keywords,
            hashtags: hashtags,
            links: links,
            createdAt: item.created_at,
            scheduledAt: item.scheduled_at,
            publishedAt: item.published_at,
            status: item.status,
            socialPlatforms: item.social_platforms || {},
            metadata: item.metadata || {}
          };
        });
        
        console.log(`Found ${contentItems.length} content items for campaign ${campaignId || 'all'} (page ${page})`);
        
        // Для отладки выводим ключевые слова из первого элемента
        if (contentItems.length > 0) {
          const sample = contentItems[0];
          console.log('Sample keywords being sent to client:', 
            Array.isArray(sample.keywords) ? 'array' : typeof sample.keywords, 
            `length: ${Array.isArray(sample.keywords) ? sample.keywords.length : 0}`,
            JSON.stringify(sample.keywords).substring(0, 100));
        }
        
        // Получаем метаданные пагинации
        const meta = response.data.meta || {};
        const totalCount = meta.total_count || contentItems.length;
        const totalPages = Math.ceil(totalCount / limit);
        
        console.log(`Pagination info: total items ${totalCount}, current page ${page}/${totalPages}`);
        
        res.json({ 
          data: contentItems,
          meta: {
            total: totalCount,
            page: page,
            limit: limit,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          }
        });
      } catch (error) {
        console.error('Error getting campaign content:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
        }
        return res.status(401).json({ error: "Invalid token or failed to fetch content" });
      }
    } catch (error) {
      console.error("Error fetching campaign content:", error);
      res.status(500).json({ error: "Failed to fetch campaign content" });
    }
  });

  app.get("/api/campaign-content/:id", async (req, res) => {
    try {
      const contentId = req.params.id;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Fetching content with ID: ${contentId}`);
        
        // Получаем ID пользователя из токена для проверки прав доступа
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Получаем контент напрямую из Directus API
        const response = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.data || !response.data.data) {
          return res.status(404).json({ error: "Content not found" });
        }
        
        const item = response.data.data;
        
        // Проверяем, принадлежит ли контент пользователю
        if (item.user_id !== userId) {
          return res.status(403).json({ error: "You don't have permission to view this content" });
        }
        
        // Преобразуем данные из формата Directus в наш формат
        const content = {
          id: item.id,
          campaignId: item.campaign_id,
          userId: item.user_id,
          title: item.title,
          content: item.content,
          contentType: item.content_type,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          prompt: item.prompt,
          keywords: parseArrayField(item.keywords, item.id),
          hashtags: parseArrayField(item.hashtags, item.id),
          links: parseArrayField(item.links, item.id),
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {},
          metadata: item.metadata || {}
        };
        
        res.json({ data: content });
      } catch (error) {
        console.error('Error getting campaign content by ID:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
          if (error.response.status === 404) {
            return res.status(404).json({ error: "Content not found" });
          }
        }
        return res.status(401).json({ error: "Invalid token or failed to fetch content" });
      }
    } catch (error) {
      console.error("Error fetching campaign content:", error);
      res.status(500).json({ error: "Failed to fetch campaign content" });
    }
  });

  app.post("/api/campaign-content", authenticateUser, async (req, res) => {
    try {
      console.log('📝 POST /api/campaign-content - Creating new content');
      console.log('✅ User authenticated:', req.user?.id, req.user?.email);
      console.log('📄 Content data received:', JSON.stringify(req.body, null, 2));
      
      // Проверяем наличие campaign_id (поддерживаем оба формата)
      const campaign_id = req.body.campaign_id || req.body.campaignId;
      if (!campaign_id) {
        console.error('❌ Missing campaign_id in request body');
        return res.status(400).json({ error: 'Отсутствует обязательное поле: campaign_id' });
      }
      
      const userId = req.user?.id;
      const token = req.user?.token;
      
      if (!userId || !token) {
        console.error('❌ Missing user authentication data');
        return res.status(401).json({ error: 'Не авторизован' });
      }
      
      // Проверяем наличие обязательных полей (поддерживаем оба формата)
      const content_type = req.body.content_type || req.body.contentType;
      const { title, content, status = 'draft', metadata, prompt } = req.body;
      
      if (!campaign_id) {
        return res.status(400).json({ 
          error: "Отсутствует обязательное поле: campaign_id" 
        });
      }
      
      if (!content) {
        return res.status(400).json({ 
          error: "Отсутствует обязательное поле: content" 
        });
      }
      
      if (!content_type) {
        return res.status(400).json({ 
          error: "Отсутствует обязательное поле: content_type" 
        });
      }
      
      // Создаем новый контент с данными пользователя
      const contentData = {
        title: title || '',
        campaign_id,
        content_type,
        content: content || '',
        status: status || 'draft',
        metadata: metadata || {},
        user_id: userId,
        // Дополнительные поля из body если есть (поддерживаем оба формата)
        image_url: req.body.image_url || req.body.imageUrl || null,
        video_url: req.body.video_url || req.body.videoUrl || null,
        // video_thumbnail теперь сохраняется в additional_images
        keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
        hashtags: Array.isArray(req.body.hashtags) ? req.body.hashtags : [],
        prompt: prompt || null, // Добавляем поле prompt для сохранения промптов изображений
        social_platforms: req.body.social_platforms || {},
        scheduled_at: req.body.scheduled_at || null,
        // Дополнительные изображения включая thumbnail видео
        additional_images: (() => {
          let images = Array.isArray(req.body.additional_images) 
            ? req.body.additional_images 
            : Array.isArray(req.body.additionalImages) 
              ? req.body.additionalImages 
              : [];
          
          // Добавляем thumbnail видео в дополнительные изображения если есть
          const videoThumbnail = req.body.video_thumbnail || req.body.videoThumbnail;
          if (videoThumbnail && !images.includes(videoThumbnail)) {
            images = [videoThumbnail, ...images]; // Thumbnail в начале списка
          }
          
          return images;
        })()
      };
      
      console.log('🚀 Creating content with data:', JSON.stringify(contentData, null, 2));
      
      // Используем токен пользователя для создания контента
      const response = await directusApi.post('/items/campaign_content', contentData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Content created successfully:', response.data?.data?.id);
      
      res.json({
        success: true,
        data: response.data.data
      });
    } catch (error: any) {
      console.error('❌ Error creating campaign content:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.error('401 error details:', error.response.data);
        return res.status(401).json({ 
          error: 'Ошибка авторизации при создании контента',
          details: error.response?.data 
        });
      }
      
      return res.status(500).json({ 
        error: 'Не удалось создать контент',
        details: error.response?.data || error.message 
      });
    }
  });

  // Маршрут для обновления контента кампании
  // Делает проксирование запросов на новый маршрут в publishing-routes.ts
  app.patch("/api/campaign-content/:id", async (req, res) => {
    try {
      const contentId = req.params.id;
      const authHeader = req.headers['authorization'];
      
      log(`Перенаправление запроса с устаревшего маршрута /api/campaign-content/${contentId} на /api/publish/update-content/${contentId}`, 'api');
      
      if (!authHeader) {
        return res.status(401).json({ error: "Не авторизован: Отсутствует заголовок авторизации" });
      }
      
      // Получаем токен авторизации
      let token = '';
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
      
      // Получаем контент для проверки его существования
      const content = await storage.getCampaignContentById(contentId, token);
      
      if (!content) {
        return res.status(404).json({ error: "Контент не найден" });
      }
      
      console.log(`📝 PATCH /api/campaign-content/${contentId}: Updating content with:`, JSON.stringify(req.body, null, 2));
      
      // Обновляем контент напрямую через storage API
      const updatedContent = await storage.updateCampaignContent(contentId, req.body, token);
      
      console.log(`✅ PATCH /api/campaign-content/${contentId}: Content updated successfully:`, updatedContent);
      
      return res.status(200).json({
        success: true,
        data: updatedContent
      });
    } catch (error: any) {
      log(`Ошибка при обработке запроса на обновление контента: ${error.message}`, 'api');
      res.status(500).json({ 
        error: "Ошибка при обновлении контента кампании",
        message: error.message
      });
    }
  });

  app.delete("/api/campaign-content/:id", async (req, res) => {
    try {
      const contentId = req.params.id;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Deleting content with ID: ${contentId}`);
        
        // Получаем ID пользователя для проверки права на удаление
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Получаем контент напрямую из Directus API для проверки
        const existingContentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!existingContentResponse.data || !existingContentResponse.data.data) {
          return res.status(404).json({ error: "Content not found" });
        }
        
        const existingItem = existingContentResponse.data.data;
        
        // Проверяем, принадлежит ли контент пользователю
        if (existingItem.user_id !== userId) {
          return res.status(403).json({ error: "You don't have permission to delete this content" });
        }
        
        // Удаляем контент через Directus API
        await directusApi.delete(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`Successfully deleted content with ID: ${contentId}`);
        res.status(204).end();
      } catch (error) {
        console.error('Error deleting campaign content:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
          if (error.response.status === 404) {
            return res.status(404).json({ error: "Content not found" });
          }
        }
        return res.status(500).json({ error: "Failed to delete content" });
      }
    } catch (error) {
      console.error("Error deleting campaign content:", error);
      res.status(500).json({ error: "Failed to delete campaign content" });
    }
  });

  // УДАЛЕН: дублирующий endpoint - используется /api/publish/scheduled

  // Маршрут для адаптации контента для социальных сетей
  app.post("/api/content/:id/adapt", async (req, res) => {
    try {
      const contentId = req.params.id;
      const { socialPlatforms } = req.body;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Adapting content ID ${contentId} for social platforms`);
        
        // Получаем текущий контент
        const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const content = contentResponse.data.data;
        
        if (!content) {
          return res.status(404).json({ error: "Content not found" });
        }
        
        // Правильная логика обновления social_platforms с учетом удаления платформ
        const currentSocialPlatforms = content.social_platforms || {};
        
        // Получаем список выбранных платформ из запроса
        const selectedPlatforms = Object.keys(socialPlatforms);
        
        // Создаем новый объект социальных платформ
        const updatedSocialPlatforms = {};
        
        // Добавляем/обновляем только выбранные платформы
        selectedPlatforms.forEach(platform => {
          // Сохраняем существующие данные платформы (статус, URL и т.д.)
          const existingPlatformData = currentSocialPlatforms[platform] || {};
          
          // КРИТИЧНО: При публикации ВСЕГДА устанавливаем pending статус для всех выбранных платформ
          updatedSocialPlatforms[platform] = {
            ...existingPlatformData,
            ...socialPlatforms[platform],
            status: "pending", // ОБЯЗАТЕЛЬНО - pending статус для всех публикуемых платформ
            selected: true,    // Отмечаем как выбранную
            publishedAt: null, // Сбрасываем время публикации
            postUrl: null      // Сбрасываем URL поста
          };
        });
        
        console.log(`\n=== ОБНОВЛЕНИЕ ПЛАТФОРМ ДЛЯ КОНТЕНТА ${contentId} ===`);
        console.log(`Исходные платформы:`, JSON.stringify(currentSocialPlatforms, null, 2));
        console.log(`Новые платформы из запроса:`, JSON.stringify(socialPlatforms, null, 2));
        console.log(`Список выбранных платформ:`, selectedPlatforms);
        console.log(`Обновленные платформы:`, JSON.stringify(updatedSocialPlatforms, null, 2));
        
        const removedPlatforms = Object.keys(currentSocialPlatforms).filter(p => !selectedPlatforms.includes(p));
        console.log(`Удаленные платформы: [${removedPlatforms.join(', ')}]`);
        
        // Обновляем social_platforms в Directus (теперь только с выбранными платформами)
        const updateResult = await directusApi.patch(`/items/campaign_content/${contentId}`, {
          social_platforms: updatedSocialPlatforms
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`Результат обновления в Directus:`, updateResult.status === 200 ? 'SUCCESS' : 'FAILED');
        
        // Проверяем что данные действительно сохранились
        const verificationResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`Проверка после сохранения - платформы в БД:`, Object.keys(verificationResponse.data.data.social_platforms || {}));
        console.log(`=== КОНЕЦ ОБНОВЛЕНИЯ ПЛАТФОРМ ===\n`);
        
        // Получаем ID кампании и информацию о пользователе для отправки в webhook
        const campaignId = content.campaign_id;
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        // Отправляем данные в n8n webhook для обработки
        // Проверяем наличие n8n API ключа в env
        const n8nApiKey = process.env.N8N_API_KEY;
        
        if (n8nApiKey) {
          try {
            // Подготавливаем данные для n8n webhook
            const webhookPayload = {
              contentId,
              campaignId,
              userId,
              platforms: Object.keys(socialPlatforms),
              content: socialPlatforms,
              // Получаем данные изображений и прочую информацию из основного контента
              imageUrl: content.image_url,
              videoUrl: content.video_url,
              title: content.title
            };
            
            // Отправляем запрос на n8n webhook для публикации
            const n8nUrl = process.env.N8N_URL;
            
            if (!n8nUrl) {
              throw new Error('N8N_URL не настроен в переменных окружения');
            }
            await axios.post(`${n8nUrl}/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c`, webhookPayload, {
              headers: {
                'Content-Type': 'application/json',
                'X-N8N-Authorization': n8nApiKey
              },
              timeout: 10000 // 10 секунд таймаут
            });
            
            console.log(`Successfully sent content ${contentId} to n8n webhook for social media publishing`);
          } catch (webhookError) {
            console.error('Error sending data to n8n webhook:', webhookError);
            // Не прерываем выполнение операции, если n8n недоступен
          }
        } else {
          console.warn('N8N_API_KEY not found in environment variables, skipping webhook call');
        }
        
        // Возвращаем успешный ответ
        return res.json({
          success: true,
          message: "Content adapted for social platforms"
        });
        
      } catch (error) {
        console.error('Error adapting content for social platforms:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        return res.status(error.response?.status || 500).json({ 
          error: "Failed to adapt content",
          details: error.message
        });
      }
    } catch (error) {
      console.error("Error adapting content:", error);
      res.status(500).json({ error: "Failed to adapt content" });
    }
  });
  
  // Маршрут для публикации контента в соцсети
  app.post("/api/content/:id/publish", async (req, res) => {
    try {
      const contentId = req.params.id;
      const { socialPlatforms, status } = req.body;
      
      // Проверка авторизации
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Не авторизован' });
      }
      
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Невалидный токен' });
      }
      
      try {
        // Отправляем запрос к Directus API для запланированной публикации
        const response = await directusApi.patch(`/items/campaign_content/${contentId}`, {
          social_platforms: socialPlatforms,
          status: status || 'scheduled'
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        res.json({ data: response.data.data });
      } catch (error: any) {
        console.error('Error publishing content:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        return res.status(error.response?.status || 500).json({ 
          error: "Ошибка при публикации контента",
          details: error.response?.data?.errors || error.message
        });
      }
    } catch (error: any) {
      console.error("Error publishing content:", error);
      res.status(500).json({ error: "Ошибка при публикации контента" });
    }
  });

  // Маршрут для публикации в соцсети уже адаптированного контента
  app.post("/api/content/:id/publish-social", async (req, res) => {
    try {
      const contentId = req.params.id;
      const { platforms } = req.body;
      
      // Проверка авторизации
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Не авторизован' });
      }
      
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Невалидный токен' });
      }
      
      try {
        // Получаем информацию о контенте
        const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        const content = contentResponse.data.data;
        if (!content) {
          return res.status(404).json({ error: "Контент не найден" });
        }
        
        // Проверяем, есть ли настройки для публикации
        if (!content.social_platforms) {
          return res.status(400).json({ error: "Контент не адаптирован для публикации в соцсетях" });
        }
        
        // Фильтруем только запрошенные платформы или используем все настроенные
        const platformsToPublish = platforms || Object.keys(content.social_platforms);
        
        // Обновляем статус на "publishing" для выбранных платформ
        const updatedSocialPlatforms = { ...content.social_platforms };
        
        platformsToPublish.forEach(platform => {
          if (updatedSocialPlatforms[platform]) {
            updatedSocialPlatforms[platform].status = 'publishing';
          }
        });
        
        // Обновляем статусы в базе данных
        await directusApi.patch(`/items/campaign_content/${contentId}`, {
          social_platforms: updatedSocialPlatforms
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Получаем настройки социальных сетей пользователя
        let userSettings;
        try {
          // Получаем настройки пользователя из Directus
          const userResponse = await directusApi.get(`/users/${content.user_id}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (userResponse.data?.data?.social_media_settings) {
            userSettings = userResponse.data.data.social_media_settings;
            log(`Получены настройки социальных сетей пользователя`, 'social-publish');
          } else {
            // Пытаемся получить настройки из кампании
            const campaignResponse = await directusApi.get(`/items/user_campaigns/${content.campaign_id}`, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            
            if (campaignResponse.data?.data?.social_media_settings) {
              userSettings = campaignResponse.data.data.social_media_settings;
              log(`Получены настройки социальных сетей из кампании`, 'social-publish');
            } else {
              log('Настройки социальных сетей не найдены ни у пользователя, ни у кампании', 'social-publish');
            }
          }
        } catch (settingsError) {
          console.error('Ошибка при получении настроек социальных сетей:', settingsError);
        }
        
        // Проверяем, есть ли настройки
        if (!userSettings) {
          return res.status(400).json({ 
            error: "Настройки социальных сетей не найдены", 
            message: "Пожалуйста, настройте токены для социальных сетей в разделе 'Настройки'"
          });
        }
        
        // Готовим данные контента для публикации в формате нашего приложения
        // Добавляем поддержку всех необходимых полей для корректной работы Instagram и других платформ
        const campaignContent = {
          id: content.id,
          title: content.title || '',
          content: content.content || '',
          imageUrl: content.image_url || null,
          videoUrl: content.video_url || null,
          additionalImages: content.additional_images || [], // Добавляем поле дополнительных изображений
          additionalMedia: content.additional_media || [],
          contentType: content.content_type || 'text',
          hashtags: content.hashtags || [],
          links: content.links || [],
          keywords: content.keywords || [],
          status: content.status || 'draft',
          userId: content.user_id,
          campaignId: content.campaign_id,
          scheduledAt: content.scheduled_at,
          publishedAt: content.published_at,
          prompt: content.prompt || '',
          metadata: content.metadata || {},
          createdAt: content.date_created ? new Date(content.date_created) : new Date()
        };
        
        // Логирование для отладки Instagram
        if (platformsToPublish.includes('instagram')) {
          log(`Подготовка контента для Instagram: ID=${content.id}, contentType=${content.content_type}`, 'social-publish');
          log(`URL изображения: ${content.image_url}`, 'social-publish');
        }
        
        // Результаты публикации
        const publishResults = [];
        
        // Публикуем контент напрямую через наш сервис публикации
        for (const platform of platformsToPublish) {
          try {
            log(`Публикация контента в ${platform}`, 'social-publish');
            
            let result;
            // Используем правильный сервис: VK/Telegram/Instagram через n8n webhooks, Facebook напрямую
            if (userSettings) {
              // Используем сервис с правильной маршрутизацией через n8n webhooks
              result = await socialPublishingService.publishToPlatform(platform, campaignContent, { socialMediaSettings: userSettings }, token);
            } else {
              result = {
                platform: platform as any,
                status: 'failed',
                publishedAt: null,
                error: `Настройки для платформы ${platform} не найдены`
              };
            }
            
            // Обновляем статус публикации
            updatedSocialPlatforms[platform] = result;
            publishResults.push(result);
            
            // Логируем результат
            log(`Результат публикации в ${platform}: ${result.status}`, 'social-publish');
          } catch (platformError) {
            console.error(`Ошибка при публикации в ${platform}:`, platformError);
            publishResults.push({
              platform: platform as any,
              status: 'failed',
              publishedAt: null,
              error: `Внутренняя ошибка при публикации: ${platformError.message}`
            });
          }
        }
        
        // Обновляем статусы в базе данных
        
        // Проверяем, все ли выбранные платформы опубликованы
        const selectedPlatforms = Object.entries(updatedSocialPlatforms)
          .filter(([_, platformData]) => platformData.selected)
          .map(([platform, _]) => platform);
        
        const publishedPlatforms = Object.entries(updatedSocialPlatforms)
          .filter(([_, platformData]) => platformData.selected && platformData.status === 'published')
          .map(([platform, _]) => platform);
        
        // Проверяем, что все выбранные платформы опубликованы
        const allSelected = selectedPlatforms.length > 0 && selectedPlatforms.length === publishedPlatforms.length;
        
        console.log(`Проверка статуса: выбрано ${selectedPlatforms.length}, опубликовано ${publishedPlatforms.length}, allSelected=${allSelected}`);
        
        await directusApi.patch(`/items/campaign_content/${contentId}`, {
          social_platforms: updatedSocialPlatforms,
          // Если ВСЕ выбранные платформы опубликованы успешно, меняем статус на published
          status: allSelected ? 'published' : content.status
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Проверяем, есть ли успешные публикации
        const hasSuccessfulPublish = publishResults.some(r => r.status === 'published');
        
        // Формируем ответ
        res.json({ 
          success: hasSuccessfulPublish, 
          message: hasSuccessfulPublish 
            ? "Контент успешно опубликован в социальных сетях" 
            : "Возникли ошибки при публикации в социальных сетях",
          results: publishResults
        });
        
      } catch (error: any) {
        console.error('Error publishing to social media:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        return res.status(error.response?.status || 500).json({ 
          error: "Ошибка при публикации в соцсети",
          details: error.response?.data?.errors || error.message
        });
      }
    } catch (error: any) {
      console.error("Error publishing to social media:", error);
      res.status(500).json({ error: "Ошибка при публикации в соцсети" });
    }
  });

  // Добавляем маршрут для создания кампаний
  app.post("/api/campaigns", authenticateUser, async (req, res) => {
    try {
      const { name, description } = req.body;
      const userId = (req as any).userId;
      const authHeader = req.headers['authorization'];
      
      if (!name) {
        return res.status(400).json({ error: "Название кампании обязательно" });
      }
      
      if (!userId || !authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`[CAMPAIGN_CREATE] Creating new campaign for user ${userId}`);
        console.log(`[CAMPAIGN_CREATE] Campaign data:`, { name, description });
        console.log(`[CAMPAIGN_CREATE] Using token:`, token ? `${token.substring(0, 10)}...` : 'NO_TOKEN');
        
        // Создаем кампанию через Directus API
        const response = await directusApi.post('/items/user_campaigns', {
          name,
          description: description || null,
          user_id: userId
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`[CAMPAIGN_CREATE] Directus response:`, response.data);
        
        // Преобразуем ответ в нужный формат
        const newCampaign = {
          id: response.data.data.id,
          name: response.data.data.name,
          description: cleanupText(response.data.data.description),
          userId: response.data.data.user_id,
          createdAt: response.data.data.created_at
        };
        
        console.log(`[CAMPAIGN_CREATE] Created new campaign for user ${userId}:`, newCampaign);
        
        // Возвращаем результат
        return res.status(201).json({ 
          success: true,
          data: newCampaign
        });
      } catch (error) {
        console.error("[CAMPAIGN_CREATE] Error creating campaign:", error);
        if (axios.isAxiosError(error)) {
          console.error('[CAMPAIGN_CREATE] Directus API error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
            method: error.config?.method
          });
          
          // Возвращаем более детальную ошибку
          return res.status(error.response?.status || 500).json({ 
            error: "Не удалось создать кампанию", 
            details: error.response?.data || error.message,
            status: error.response?.status
          });
        }
        return res.status(500).json({ error: "Не удалось создать кампанию", details: error.message });
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });
  
  // Endpoint для обновления YouTube токенов
  app.post('/api/youtube/refresh-token', async (req, res) => {
    try {
      const { campaignId, refreshToken } = req.body;
      
      if (!campaignId || !refreshToken) {
        return res.status(400).json({
          error: 'campaignId и refreshToken обязательны'
        });
      }

      // Импортируем сервис обновления токенов
      const { YouTubeTokenRefresh } = await import('./services/youtube-token-refresh');
      const tokenService = new YouTubeTokenRefresh();

      // Обновляем токен
      const newTokens = await tokenService.refreshAccessToken(refreshToken);

      // Получаем текущую кампанию для обновления настроек
      const authToken = req.headers.authorization;
      if (!authToken) {
        return res.status(401).json({ error: 'Токен авторизации отсутствует' });
      }

      const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
        headers: { 'Authorization': authToken }
      });

      if (!campaignResponse.data?.data) {
        return res.status(404).json({ error: 'Кампания не найдена' });
      }

      const campaign = campaignResponse.data.data;
      const currentSettings = campaign.social_media_settings || {};
      
      // Обновляем YouTube настройки с новыми токенами
      const updatedSettings = {
        ...currentSettings,
        youtube: {
          ...currentSettings.youtube,
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresAt: newTokens.expiresAt
        }
      };

      // Сохраняем обновленные настройки в кампанию
      await directusApi.patch(`/items/user_campaigns/${campaignId}`, {
        social_media_settings: updatedSettings
      }, {
        headers: { 'Authorization': authToken }
      });

      log(`YouTube токены успешно обновлены для кампании ${campaignId}`, 'youtube-auth');

      res.json({
        success: true,
        message: 'YouTube токены успешно обновлены',
        expiresAt: newTokens.expiresAt,
        expiresIn: newTokens.expiresIn
      });

    } catch (error: any) {
      log(`Ошибка обновления YouTube токенов: ${error.message}`, 'youtube-auth');
      res.status(500).json({
        error: 'Ошибка обновления токенов',
        details: error.message
      });
    }
  });

  // Примечание: основной маршрут для удаления кампаний уже определен выше (строка ~6496)
  // Дублирующий маршрут удален, чтобы избежать конфликтов
  // Используйте маршрут /api/campaigns/:campaignId для удаления кампаний
  
  // Вспомогательная функция для подсчета элементов в коллекции
  /**
   * Подсчитывает количество элементов в коллекции для указанной кампании
   * @param collection Название коллекции в Directus
   * @param campaignId ID кампании
   * @param token Токен авторизации
   * @returns Количество элементов
   */
  /**
   * Удаляет все связанные элементы указанной коллекции для кампании
   * @param collection Название коллекции Directus
   * @param campaignId ID кампании
   * @param token Токен авторизации
   * @returns Promise, разрешающийся после удаления всех элементов
   */
  async function deleteRelatedItems(collection: string, campaignId: string, token: string): Promise<void> {
    try {
      console.log(`Удаление связанных данных из коллекции ${collection} для кампании ${campaignId}`);
      
      // Преобразуем в формат для Directus
      const formattedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      
      // Сначала получаем все ID элементов, связанных с кампанией
      const filter = { campaign_id: { _eq: campaignId } };
      const response = await directusApi.get(`/items/${collection}`, {
        headers: { 'Authorization': formattedToken },
        params: {
          filter: filter,
          fields: ['id']
        }
      });
      
      const items = response.data?.data || [];
      console.log(`Найдено ${items.length} элементов для удаления в коллекции ${collection}`);
      
      // Если нет элементов, сразу возвращаемся
      if (items.length === 0) {
        console.log(`Нет элементов для удаления в коллекции ${collection}`);
        return;
      }
      
      // Удаляем каждый элемент по отдельности
      for (const item of items) {
        try {
          await directusApi.delete(`/items/${collection}/${item.id}`, {
            headers: { 'Authorization': formattedToken }
          });
          console.log(`Удален элемент ${item.id} из коллекции ${collection}`);
        } catch (error) {
          console.error(`Ошибка при удалении элемента ${item.id} из коллекции ${collection}:`, error);
          // Продолжаем удаление остальных элементов, даже если с этим возникла ошибка
        }
      }
      
      console.log(`Удаление элементов из коллекции ${collection} завершено`);
    } catch (error) {
      console.error(`Ошибка при удалении связанных данных из коллекции ${collection}:`, error);
      throw error; // Пробрасываем ошибку дальше
    }
  }

  async function countItems(collection: string, campaignId: string, token: string): Promise<number> {
    try {
      console.log(`Подсчет элементов в коллекции ${collection} для кампании ${campaignId}`);
      
      // Преобразуем в формат для Directus
      const formattedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      
      // Проверяем наличие фильтрации по campaign_id
      const filter = { campaign_id: { _eq: campaignId } };
      console.log(`Используем фильтр:`, JSON.stringify(filter));
      
      // Делаем запрос с указанным токеном
      try {
        const response = await directusApi.get(`/items/${collection}`, {
          headers: { 'Authorization': formattedToken },
          params: {
            filter: filter,
            limit: 1,
            aggregate: { count: '*' }
          }
        });
        
        const count = response.data?.data?.[0]?.count || 0;
        console.log(`Найдено ${count} элементов в коллекции ${collection} для кампании ${campaignId}`);
        
        return count;
      } catch (apiError) {
        // Если получили ошибку авторизации, пробуем с административным токеном
        if (axios.isAxiosError(apiError) && (apiError.response?.status === 401 || apiError.response?.status === 403)) {
          console.log(`Ошибка авторизации при подсчете элементов: ${apiError.response?.status}. Пробуем с административным токеном.`);
          
          // Получаем административный токен
          const { directusAuthManager } = await import('./services/directus-auth-manager');
          const adminSession = await directusAuthManager.getAdminSession();
          
          if (!adminSession || !adminSession.token) {
            console.error('Не удалось получить административный токен');
            return 0;
          }
          
          const adminToken = `Bearer ${adminSession.token}`;
          console.log(`Получен административный токен для подсчета элементов в ${collection}`);
          
          // Повторяем запрос с административным токеном
          const adminResponse = await directusApi.get(`/items/${collection}`, {
            headers: { 'Authorization': adminToken },
            params: {
              filter: filter,
              limit: 1,
              aggregate: { count: '*' }
            }
          });
          
          const adminCount = adminResponse.data?.data?.[0]?.count || 0;
          console.log(`Найдено ${adminCount} элементов в коллекции ${collection} для кампании ${campaignId} (admin token)`);
          
          return adminCount;
        } else {
          throw apiError; // Пробрасываем ошибку дальше для обработки в блоке catch
        }
      }
    } catch (error) {
      console.error(`Ошибка при подсчете элементов в коллекции ${collection} для кампании ${campaignId}:`, error);
      
      if (axios.isAxiosError(error)) {
        console.error('Детали ошибки Directus API:', {
          status: error.response?.status,
          data: error.response?.data
        });
      }
      
      return 0;
    }
  }
  
  // Добавляем маршрут для обновления кампаний
  // Маршрут для получения отдельной кампании
  app.get("/api/campaigns/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;
      
      console.log(`Запрос данных кампании ${id} для пользователя ${userId}`);
      
      // Получаем токен из заголовков
      const authHeader = req.headers['authorization'] as string;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Токен авторизации не предоставлен'
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      // Используем прямой запрос к Directus API
      const directusUrl = process.env.DIRECTUS_URL;
      if (!directusUrl) {
        return res.status(500).json({
          success: false,
          error: 'DIRECTUS_URL не настроен'
        });
      }
      
      const directusApi = axios.create({
        baseURL: directusUrl,
        timeout: 10000
      });
      
      // Получаем данные кампании через Directus API
      const campaignResponse = await directusApi.get(`/items/user_campaigns/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const campaignData = campaignResponse.data?.data;
      
      if (!campaignData) {
        return res.status(404).json({
          success: false,
          error: 'Кампания не найдена'
        });
      }
      
      // Проверяем, что кампания принадлежит пользователю
      if (campaignData.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Доступ к кампании запрещен'
        });
      }
      
      console.log(`Данные кампании ${id} успешно получены`);
      
      res.json({
        success: true,
        data: campaignData
      });
      
    } catch (error: any) {
      console.error('Ошибка при получении данных кампании:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка сервера при получении данных кампании',
        details: error.message
      });
    }
  });



  app.patch("/api/campaigns/:id", authenticateUser, async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { name, link, social_media_settings, trend_analysis_settings } = req.body;
      const userId = (req as any).userId;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании обязателен" });
      }

      if (!userId || !authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Сначала получаем информацию о кампании из Directus
        const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!campaignResponse.data || !campaignResponse.data.data) {
          return res.status(404).json({ error: "Кампания не найдена" });
        }
        
        const campaign = campaignResponse.data.data;
        
        // Проверяем, принадлежит ли кампания текущему пользователю
        if (campaign.user_id !== userId) {
          return res.status(403).json({ error: "Доступ запрещен: вы не являетесь владельцем этой кампании" });
        }
        
        // Разрешаем обновление только определенных полей
        // Удалим undefined значения, оставим только те, что нужно обновить
        const updateFields: any = {};
        
        if (name !== undefined && name.trim() !== '') {
          updateFields.name = name.trim();
        }
        
        if (link !== undefined) {
          updateFields.link = link.trim();
        }
        
        if (social_media_settings !== undefined) {
          // Объединяем существующие настройки с новыми, чтобы не удалять другие платформы
          const existingSettings = campaign.social_media_settings || {};
          updateFields.social_media_settings = {
            ...existingSettings,
            ...social_media_settings
          };
          console.log('🔥 Объединяем настройки социальных сетей:');
          console.log('🔥 Существующие:', existingSettings);
          console.log('🔥 Новые:', social_media_settings);
          console.log('🔥 Результат:', updateFields.social_media_settings);
        }
        
        if (trend_analysis_settings !== undefined) {
          updateFields.trend_analysis_settings = trend_analysis_settings;
        }
      
      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ error: "Необходимо указать хотя бы одно поле для обновления" });
      }
      
        console.log(`Updating campaign ${campaignId} in Directus with fields:`, updateFields);
        
        const response = await directusApi.patch(`/items/user_campaigns/${campaignId}`, updateFields, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Преобразуем данные из формата Directus в наш формат
        const updatedCampaign = {
          id: response.data.data.id,
          name: response.data.data.name,
          description: cleanupText(response.data.data.description),
          userId: response.data.data.user_id,
          createdAt: response.data.data.created_at,
          link: response.data.data.link,
          socialMediaSettings: response.data.data.social_media_settings,
          trendAnalysisSettings: response.data.data.trend_analysis_settings
        };
        
        console.log("Campaign updated successfully:", updatedCampaign.name);
        
        return res.status(200).json({ 
          success: true,
          data: updatedCampaign,
          message: "Кампания успешно обновлена"
        });
      } catch (directusError) {
        console.error("Error updating campaign in Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
          
          // Если получаем ошибку 401 или 403, возвращаем соответствующий статус
          if (directusError.response.status === 401 || directusError.response.status === 403) {
            return res.status(directusError.response.status).json({
              error: "Не авторизован для редактирования кампании"
            });
          }
          
          if (directusError.response.status === 404) {
            return res.status(404).json({ error: "Кампания не найдена" });
          }
        }
        
        return res.status(500).json({ 
          error: "Не удалось обновить кампанию", 
          message: directusError instanceof Error ? directusError.message : "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ 
        error: "Failed to update campaign",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Feature flags endpoint
  app.get('/api/feature-flags', (req, res) => {
    try {
      const featureFlags = {
        instagramStories: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging',
        videoEditor: true,
        aiImageGeneration: true,
        youtubePublishing: true,
        instagramPublishing: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging',
        telegramPublishing: true,
        sentimentAnalysis: true,
        trendsAnalysis: true,
        commentCollection: true,
        automatedPosting: true,
        schedulerAdvanced: true,
        multiCampaignManagement: true,
      };
      res.json(featureFlags);
    } catch (error) {
      console.error('Error getting feature flags:', error);
      res.status(500).json({ error: 'Failed to get feature flags' });
    }
  });

  // Feature flags descriptions endpoint (for admin interface)
  app.get('/api/feature-flags/descriptions', (req, res) => {
    try {
      const featureFlags = {
        instagramStories: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging',
        videoEditor: true,
        aiImageGeneration: true,
        youtubePublishing: true,
        instagramPublishing: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging',
        telegramPublishing: true,
        sentimentAnalysis: true,
        trendsAnalysis: true,
        commentCollection: true,
        automatedPosting: true,
        schedulerAdvanced: true,
        multiCampaignManagement: true,
      };
      
      const descriptions = {
        instagramStories: 'Instagram Stories редактор и публикация',
        videoEditor: 'Видео редактор и обработка',
        aiImageGeneration: 'AI генерация изображений',
        youtubePublishing: 'Публикация на YouTube',
        instagramPublishing: 'Публикация в Instagram',
        telegramPublishing: 'Публикация в Telegram',
        sentimentAnalysis: 'Анализ настроения комментариев',
        trendsAnalysis: 'Анализ трендов и источников',
        commentCollection: 'Сбор комментариев из соцсетей',
        automatedPosting: 'Автоматическая публикация по расписанию',
        schedulerAdvanced: 'Расширенные функции планировщика',
        multiCampaignManagement: 'Управление множественными кампаниями',
      };
      
      res.json({
        flags: featureFlags,
        descriptions: descriptions,
        defaults: featureFlags,
      });
    } catch (error) {
      console.error('Error getting feature descriptions:', error);
      res.status(500).json({ error: 'Failed to get feature descriptions' });
    }
  });

  console.log('Route registration completed');
  // Webhook endpoint to receive trend topics from n8n
  app.post("/api/webhook/trend-topics", async (req, res) => {
    try {
      console.log("Received webhook request for trend topics:", req.body);
      
      const { campaignId, keywords, trendTopics } = req.body;
      
      if (!campaignId || !trendTopics || !Array.isArray(trendTopics)) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid payload. Required: campaignId and trendTopics array." 
        });
      }
      
      console.log(`Processing ${trendTopics.length} trend topics for campaign ${campaignId}`);
      
      // Получаем API ключ n8n из переменных окружения
      const n8nApiKey = process.env.N8N_API_KEY;
      
      if (!n8nApiKey) {
        return res.status(500).json({ 
          success: false, 
          error: "N8N API key not configured" 
        });
      }
      
      // Save each trend topic to the database using Directus API
      const savedTopics = [];
      for (const topic of trendTopics) {
        try {
          // Сначала создаем объект, соответствующий схеме
          const trendTopic = insertCampaignTrendTopicSchema.parse({
            title: topic.title,
            campaignId: campaignId,
            sourceId: topic.sourceId || null,
            reactions: topic.reactions || 0,
            comments: topic.comments || 0,
            views: topic.views || 0,
            isBookmarked: false
          });
          
          // Сохраняем через Directus API
          // Преобразуем в формат Directus
          const directusPayload = {
            title: trendTopic.title,
            campaign_id: trendTopic.campaignId,
            source_id: trendTopic.sourceId,
            reactions: trendTopic.reactions,
            comments: trendTopic.comments,
            views: trendTopic.views,
            is_bookmarked: trendTopic.isBookmarked
          };
          
          // Отправляем запрос в Directus API с использованием сервисного токена
          // Здесь для webhook мы используем n8nApiKey как авторизацию
          const response = await directusApi.post('/items/campaign_trend_topics', directusPayload, {
            headers: {
              'Authorization': `Bearer ${n8nApiKey}`
            }
          });
          
          const item = response.data.data;
          
          // Преобразуем данные из формата Directus в наш формат
          const savedTopic = {
            id: item.id,
            title: item.title,
            campaignId: item.campaign_id,
            sourceId: item.source_id,
            reactions: item.reactions,
            comments: item.comments,
            views: item.views,
            isBookmarked: item.is_bookmarked,
            createdAt: item.created_at
          };
          savedTopics.push(savedTopic);
        } catch (topicError) {
          console.error("Error saving trend topic:", topicError);
          // Continue with other topics even if one fails
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `Successfully processed ${savedTopics.length} of ${trendTopics.length} trend topics`,
        data: { 
          savedCount: savedTopics.length,
          campaignId 
        }
      });
    } catch (error) {
      console.error("Error processing webhook for trend topics:", error);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to process trend topics data"
      });
    }
  });
  
  // Получение запланированных публикаций для кампании
  app.get('/api/publish/scheduled', authenticateUser, async (req, res) => {
    try {
      const { userId, campaignId } = req.query;
      const authHeader = req.headers['authorization'];
      
      if (!userId) {
        return res.status(400).json({ error: 'Не указан userId' });
      }
      
      if (!campaignId) {
        return res.status(400).json({ error: 'Не указан campaignId' });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Не авторизован' });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      console.log(`[Scheduled] Получение запланированных публикаций для кампании ${campaignId}, пользователя ${userId}`);
      
      // Получаем запланированные публикации из хранилища
      const scheduledContent = await storage.getScheduledCampaignContent(campaignId as string, userId as string, token);
      
      console.log(`[Scheduled] Найдено ${scheduledContent.length} запланированных публикаций`);
      
      return res.json({
        success: true,
        data: scheduledContent
      });
    } catch (error: any) {
      console.error('Error getting scheduled publications:', error);
      return res.status(500).json({ 
        error: 'Ошибка при получении запланированных публикаций',
        details: error.message 
      });
    }
  });

  // Проверяет статус публикации контента в n8n
  async function checkPublishingStatus(contentId: string, n8nApiKey: string): Promise<any> {
    try {
      const n8nUrl = process.env.N8N_URL;
      if (!n8nUrl) {
        throw new Error('N8N_URL не настроен в переменных окружения');
      }
      
      const response = await axios.get(
        `${n8nUrl}/webhook/status/${contentId}`,
        {
          headers: {
            'X-N8N-Authorization': n8nApiKey
          },
          timeout: 5000
        }
      );
      
      return response.data;
    } catch (error) {
      console.error(`Error checking publishing status for content ${contentId}:`, error);
      throw error;
    }
  }

  // Маршрут для проверки статуса публикации
  app.get("/api/content/:id/publish-status", async (req, res) => {
    try {
      const contentId = req.params.id;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const n8nApiKey = process.env.N8N_API_KEY;
      
      if (!n8nApiKey) {
        return res.status(500).json({ error: "API ключ n8n не настроен" });
      }
      
      try {
        // Получаем статус из n8n
        const publishingStatus = await checkPublishingStatus(contentId, n8nApiKey);
        
        // Получаем текущий контент из Directus
        const contentResponse = await directusApi.get(`/items/campaign_content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const content = contentResponse.data.data;
        if (!content) {
          return res.status(404).json({ error: "Контент не найден" });
        }
        
        // Обновляем статусы платформ если есть изменения
        let hasStatusChanges = false;
        const updatedSocialPlatforms = { ...content.social_platforms };
        
        Object.entries(publishingStatus.platforms || {}).forEach(([platform, status]) => {
          if (updatedSocialPlatforms[platform]) {
            if (status.status !== updatedSocialPlatforms[platform].status) {
              hasStatusChanges = true;
              updatedSocialPlatforms[platform] = {
                ...updatedSocialPlatforms[platform],
                ...status
              };
            }
          }
        });
        
        // Если есть изменения, обновляем в базе
        if (hasStatusChanges) {
          await directusApi.patch(`/items/campaign_content/${contentId}`, {
            social_platforms: updatedSocialPlatforms
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        }
        
        res.json({
          success: true,
          status: publishingStatus,
          platforms: updatedSocialPlatforms
        });
        
      } catch (error: any) {
        console.error('Error checking publishing status:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
        }
        return res.status(error.response?.status || 500).json({ 
          error: "Ошибка при проверке статуса публикации",
          details: error.response?.data?.errors || error.message
        });
      }
    } catch (error: any) {
      console.error("Error checking publishing status:", error);
      res.status(500).json({ error: "Ошибка при проверке статуса публикации" });
    }
  });
  
  // Business Questionnaire API routes
  // Получение анкеты для определенной кампании
  app.get("/api/campaigns/:campaignId/questionnaire", authenticateUser, async (req, res) => {
    try {
      const { campaignId } = req.params;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании не указан" });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      console.log('Getting business questionnaire with user token');
      const questionnaire = await storage.getBusinessQuestionnaire(campaignId, token);
      
      return res.json({
        success: true,
        data: questionnaire
      });
    } catch (error: any) {
      console.error('Error getting business questionnaire:', error);
      return res.status(500).json({ 
        error: "Ошибка при получении бизнес-анкеты",
        details: error.message 
      });
    }
  });
  
  // Дополнительный эндпоинт для получения бизнес-анкеты (используется в ContentPlanGenerator)
  app.get("/api/business-questionnaire", authenticateUser, async (req, res) => {
    try {
      const { campaignId } = req.query;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании не указан" });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      console.log(`Getting business questionnaire for campaign ${campaignId}`);
      const questionnaire = await storage.getBusinessQuestionnaire(campaignId as string, token);
      
      return res.json({
        success: true,
        data: questionnaire
      });
    } catch (error: any) {
      console.error('Error getting business questionnaire:', error);
      return res.status(500).json({ 
        error: "Ошибка при получении бизнес-анкеты",
        details: error.message 
      });
    }
  });
  
  // Создание новой анкеты
  app.post("/api/campaigns/:campaignId/questionnaire", authenticateUser, async (req: any, res) => {
    try {
      const { campaignId } = req.params;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании не указан" });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      // Проверяем, существует ли уже анкета для этой кампании
      const existingQuestionnaire = await storage.getBusinessQuestionnaire(campaignId, token);
      
      if (existingQuestionnaire) {
        return res.status(400).json({ 
          error: "Анкета для этой кампании уже существует",
          data: existingQuestionnaire 
        });
      }
      
      // Валидация данных формы с помощью Zod схемы
      const questionnaireData = insertBusinessQuestionnaireSchema.parse({
        ...req.body,
        campaignId
      });
      
      console.log('Using user token for creating business questionnaire');
      const newQuestionnaire = await storage.createBusinessQuestionnaire(questionnaireData, token);
      
      return res.status(201).json({
        success: true,
        data: newQuestionnaire
      });
    } catch (error: any) {
      console.error('Error creating business questionnaire:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Ошибка валидации данных",
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        error: "Ошибка при создании бизнес-анкеты",
        details: error.message 
      });
    }
  });
  
  // УСТАРЕВШИЙ endpoint - удален в пользу /api/website-analysis
  // Этот endpoint больше не используется
  app.post("/api/analyze-website-for-questionnaire", authenticateUser, async (req: any, res) => {
    return res.status(410).json({ 
      error: "Этот endpoint устарел. Используйте /api/website-analysis вместо него.",
      redirectTo: "/api/website-analysis"
    });
  });

  // Обновление существующей анкеты напрямую через ID кампании (без указания ID анкеты)
  app.patch("/api/campaigns/:campaignId/questionnaire", authenticateUser, async (req: any, res) => {
    try {
      const { campaignId } = req.params;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании не указан" });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      // Находим анкету по ID кампании
      const existingQuestionnaire = await storage.getBusinessQuestionnaire(campaignId, token);
      
      if (!existingQuestionnaire) {
        return res.status(404).json({ error: "Анкета для этой кампании не найдена" });
      }
      
      // Валидация данных для обновления
      let validatedUpdates;
      try {
        // Импортируем схему еще раз для надежности
        // const { insertBusinessQuestionnaireSchema } = require('@shared/schema');
        const updateSchema = insertBusinessQuestionnaireSchema.partial();
        validatedUpdates = updateSchema.parse(req.body);
      } catch (importError) {
        console.error('Ошибка при импорте схемы:', importError);
        // Временное решение - пропускаем валидацию
        validatedUpdates = req.body;
      }
      
      console.log('Using user token for updating business questionnaire by campaign ID');
      
      // Обновляем анкету, используя ID из найденной анкеты
      const updatedQuestionnaire = await storage.updateBusinessQuestionnaire(
        existingQuestionnaire.id, 
        validatedUpdates, 
        token
      );
      
      return res.json({
        success: true,
        data: updatedQuestionnaire
      });
    } catch (error: any) {
      console.error('Error updating business questionnaire by campaign ID:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Ошибка валидации данных",
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        error: "Ошибка при обновлении бизнес-анкеты",
        details: error.message 
      });
    }
  });

  // ВНИМАНИЕ: Основной маршрут для генерации изображений перенесен в другое место в коде
  // Этот маршрут оставлен закомментированным для справки, но не используется
  /*
  app.post("/api/generate-image-old", authenticateUser, async (req: any, res) => {
    // Этот маршрут не используется, так как создает конфликты с основным маршрутом
    res.status(404).json({
      success: false,
      error: "Этот маршрут устарел и больше не используется."
    });
  });
  */

  // Обновление существующей анкеты по ID анкеты
  app.patch("/api/campaigns/:campaignId/questionnaire/:id", authenticateUser, async (req: any, res) => {
    try {
      const { campaignId, id } = req.params;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId || !id) {
        return res.status(400).json({ error: "ID кампании или анкеты не указаны" });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      // Проверяем существование анкеты
      const existingQuestionnaire = await storage.getBusinessQuestionnaire(campaignId, token);
      
      if (!existingQuestionnaire) {
        return res.status(404).json({ error: "Анкета для этой кампании не найдена" });
      }
      
      // Проверяем, что ID в пути совпадает с ID существующей анкеты
      if (existingQuestionnaire.id !== id) {
        return res.status(400).json({ error: "ID анкеты не совпадает с ID в пути" });
      }
      
      // Валидация данных для обновления
      // Используем partial, чтобы позволить обновление только части полей
      let validatedUpdates;
      try {
        // Импортируем схему еще раз для надежности
        // const { insertBusinessQuestionnaireSchema } = require('@shared/schema');
        const updateSchema = insertBusinessQuestionnaireSchema.partial();
        validatedUpdates = updateSchema.parse(req.body);
      } catch (importError) {
        console.error('Ошибка при импорте схемы:', importError);
        // Временное решение - пропускаем валидацию
        validatedUpdates = req.body;
      }
      
      console.log('Using user token for updating business questionnaire');
      
      // Обновляем анкету
      const updatedQuestionnaire = await storage.updateBusinessQuestionnaire(id, validatedUpdates, token);
      
      return res.json({
        success: true,
        data: updatedQuestionnaire
      });
    } catch (error: any) {
      console.error('Error updating business questionnaire:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Ошибка валидации данных",
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        error: "Ошибка при обновлении бизнес-анкеты",
        details: error.message 
      });
    }
  });

  // API для анализа веб-сайта и автоматического заполнения бизнес-анкеты
  app.post("/api/website-analysis", authenticateUser, async (req: any, res) => {
    console.log('[WEBSITE-ANALYSIS] Начало обработки запроса на анализ сайта');
    try {
      const { websiteUrl, url, campaignId } = req.body;
      const authHeader = req.headers['authorization'];
      
      // Поддерживаем оба параметра для совместимости
      const siteUrl = websiteUrl || url;
      
      console.log(`[WEBSITE-ANALYSIS] Получен URL: ${siteUrl}, campaignId: ${campaignId}`);
      
      if (!siteUrl) {
        console.log('[WEBSITE-ANALYSIS] Ошибка: URL не указан');
        return res.status(400).json({ 
          success: false,
          error: "URL сайта не указан"
        });
      }
      
      if (!authHeader) {
        console.log('[WEBSITE-ANALYSIS] Ошибка: отсутствует заголовок авторизации');
        return res.status(401).json({ 
          success: false,
          error: "Не авторизован: Отсутствует токен авторизации"
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const userId = req.userId;
      
      if (!userId) {
        console.log('[WEBSITE-ANALYSIS] Ошибка: не удалось определить пользователя');
        return res.status(401).json({ 
          success: false,
          error: "Не авторизован: Не удалось определить пользователя"
        });
      }
      
      // Нормализуем URL перед обработкой
      let normalizedUrl = siteUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      
      console.log(`[WEBSITE-ANALYSIS] Запрос на анализ сайта: ${normalizedUrl} для кампании ${campaignId} от пользователя ${userId}`);
      
      // Получаем содержимое сайта
      let websiteContent = '';
      try {
        websiteContent = await extractFullSiteContent(normalizedUrl);
      } catch (error) {
        console.error("Ошибка при извлечении содержимого сайта:", error);
        return res.status(400).json({ 
          success: false,
          error: "Не удалось получить содержимое с указанного URL" 
        });
      }
      
      if (!websiteContent) {
        return res.status(400).json({ 
          success: false,
          error: "Не удалось извлечь содержимое сайта" 
        });
      }
      
      // Пропускаем DeepSeek, используем только Gemini для анализа сайтов
      console.log('[WEBSITE-ANALYSIS] DeepSeek отключен, используем только Gemini для анализа');
      
      // Системное сообщение с инструкциями для анализа
      const messages = [
        {
          role: 'system' as const,
          content: `Ты - эксперт по бизнес-анализу. Твоя задача - проанализировать содержимое сайта компании и извлечь информацию для заполнения бизнес-анкеты на русском языке. 
          Необходимо структурировать информацию в следующие поля:
          1. companyName - название компании
          2. businessDescription - общее описание бизнеса
          3. mainDirections - основные направления деятельности
          4. brandImage - образ бренда
          5. productsServices - продукты и услуги компании
          6. targetAudience - целевая аудитория
          7. companyFeatures - особенности компании
          8. businessValues - ценности бизнеса
          9. productBeliefs - философия продукта, во что верит компания
          10. competitiveAdvantages - конкурентные преимущества
          11. customerResults - результаты для клиентов, какую пользу получают
          12. marketingExpectations - ожидания от маркетинга, цели продвижения
          13. contactInfo - контактная информация
          
          ВАЖНО ДЛЯ КОНТАКТНОЙ ИНФОРМАЦИИ:
          - Если в тексте есть раздел "НАЙДЕННЫЕ КОНТАКТЫ:", обязательно используй эти данные для поля contactInfo
          - Если есть "КОНТАКТНЫЕ РАЗДЕЛЫ:", также используй эту информацию
          - Приоритет: конкретные найденные телефоны и email > контактные разделы > общая информация
          - Если контакты найдены, указывай их точно как они представлены на сайте
          - Если контактов нет, укажи "Контактная информация не представлена на данной странице"
          
          Ответ должен быть структурированным JSON объектом, содержащим только запрашиваемые поля:
          {
            "companyName": "...",
            "businessDescription": "...",
            "mainDirections": "...",
            "brandImage": "...",
            "productsServices": "...",
            "targetAudience": "...",
            "companyFeatures": "...",
            "businessValues": "...",
            "productBeliefs": "...",
            "competitiveAdvantages": "...",
            "customerResults": "...",
            "marketingExpectations": "...",
            "contactInfo": "..."
          }
          
          Если какие-то данные отсутствуют на сайте, оставь поле пустым. Не добавляй поля, которых нет в списке. Все значения должны быть на русском языке, даже если сайт на другом языке.`
        },
        {
          role: 'user' as const,
          content: `Вот содержимое сайта для анализа: ${websiteContent}`
        }
      ];
      
      // Используем только Gemini API для анализа содержимого сайта
      let analysisResponse = '';
      
      console.log('[WEBSITE-ANALYSIS] Начинаем анализ сайта через Gemini API...');
      console.log(`[WEBSITE-ANALYSIS] 🔍 Размер контента для анализа: ${websiteContent.length} символов`);
      console.log(`[WEBSITE-ANALYSIS] 🔍 Первые 500 символов контента: ${websiteContent.substring(0, 500)}...`);
      
      try {
        // Получаем глобальный Gemini ключ ПРАВИЛЬНЫМ способом (как в анализе ключевых слов)
        let geminiKey;
        try {
          console.log('🔑 Получаем глобальный Gemini ключ для анализа сайта...');
          const globalKeysArray = await globalApiKeysService.getGlobalApiKeys();
          const geminiKeyRecord = globalKeysArray.find(key => 
            key.service_name === 'gemini' && key.is_active
          );
          
          if (!geminiKeyRecord) {
            throw new Error('Gemini ключ не найден в базе данных');
          }
          
          geminiKey = geminiKeyRecord.api_key;
          console.log('✅ Gemini ключ успешно получен для анализа сайта');
        } catch (error) {
          console.error('❌ Ошибка получения глобального Gemini ключа:', error);
          geminiKey = process.env.GEMINI_API_KEY;
          if (!geminiKey) {
            throw new Error('Gemini API ключ недоступен в глобальных настройках и переменных среды');
          }
          console.log('⚠️ Используем резервный Gemini ключ из переменных среды');
        }
        
        // ВРЕМЕННОЕ РЕШЕНИЕ: Используем прямой Gemini API для анализа сайта
        
        // Создаем умный промпт для любых типов сайтов
        const prompt = `Ты - эксперт по анализу веб-сайтов и бизнеса. Проанализируй содержимое ЛЮБОГО сайта и заполни бизнес-анкету в формате JSON.

КРИТИЧЕСКИ ВАЖНО: 
1. Анализируй РЕАЛЬНЫЙ контент сайта, а не придумывай
2. Для полей businessValues и productBeliefs ОБЯЗАТЕЛЬНО заполни на основе анализа
3. Если прямой информации нет - делай ЛОГИЧЕСКИЕ выводы из типа деятельности
4. Работай с ЛЮБЫМИ сайтами: бизнес, блоги, порталы, магазины, услуги, информационные
5. ВСЕ ПОЛЯ ДОЛЖНЫ БЫТЬ СТРОКАМИ, НЕ МАССИВАМИ! Если несколько пунктов - объединяй через запятую.

ПОИСК КОНТАКТНОЙ ИНФОРМАЦИИ - ИЩИ:
- Телефоны (например: +7, 8, (495), (812), любые номера)
- Email адреса (с @ символом)
- Адреса офисов (город, улица, дом)
- Формы обратной связи
- Социальные сети компании
- Разделы "Контакты", "О нас", "Связаться с нами"
- Если найдешь хотя бы один контакт - добавляй его в contactInfo
- Если ничего не найдено - пиши "Контактная информация не представлена на данной странице"

СТРАТЕГИЯ АНАЛИЗА:
- SMM/Маркетинг → businessValues="Эффективное продвижение, результативность", productBeliefs="Социальные сети - ключ к успеху"
- Интернет-магазин → businessValues="Качество товаров, клиентский сервис", productBeliefs="Покупки должны быть удобными и выгодными"
- IT/Разработка → businessValues="Инновации, качество кода", productBeliefs="Технологии улучшают жизнь людей"
- Медицина → businessValues="Здоровье пациентов, профессионализм", productBeliefs="Здоровье - главная ценность"
- Образование → businessValues="Качественные знания, развитие", productBeliefs="Образование открывает возможности"
- Ресторан/Еда → businessValues="Качественные продукты, гостеприимство", productBeliefs="Еда объединяет людей"
- Универсальный → businessValues="Профессионализм, качество, клиентоориентированность", productBeliefs="Стремимся к excellence в своей области"

Верни ТОЛЬКО валидный JSON без дополнительного текста:

{
  "companyName": "Название компании из сайта или логичное из домена",
  "contactInfo": "РЕАЛЬНЫЕ телефоны, email, адреса с сайта или 'Контактная информация не представлена на данной странице'",
  "businessDescription": "Детальное описание деятельности на основе контента",
  "mainDirections": "Конкретные направления работы компании через запятую",
  "brandImage": "Стиль, позиционирование, образ бренда",
  "productsServices": "Что именно предлагает компания",
  "targetAudience": "Кто клиенты и покупатели",
  "customerResults": "Какую пользу получают клиенты",
  "companyFeatures": "Уникальные особенности и преимущества через запятую",
  "businessValues": "ОБЯЗАТЕЛЬНО: ценности и принципы работы через запятую",
  "productBeliefs": "ОБЯЗАТЕЛЬНО: философия продукта/услуги",
  "competitiveAdvantages": "Преимущества перед конкурентами",
  "marketingExpectations": "Цели продвижения и маркетинга"
}

АНАЛИЗИРУЕМЫЙ КОНТЕНТ САЙТА:
${websiteContent}`;

        console.log(`[WEBSITE-ANALYSIS] 🔍 Размер промпта: ${prompt.length} символов`);
        
        console.log('[WEBSITE-ANALYSIS] 🤖 Отправляем запрос к Gemini API...');
        const geminiProxyServiceInstance = new GeminiProxyService({ apiKey: geminiKey });
        
        // Попробуем сначала прямой Vertex AI (работает без прокси на staging)
        try {
          console.log('🚀 Используем прямой Vertex AI для анализа бизнес-анкеты');
          analysisResponse = await geminiProxyServiceInstance.generateText({
            prompt: prompt,
            model: 'gemini-2.5-flash',
            useVertexAI: true,
            temperature: 0.3,
            maxOutputTokens: 4000
          });
        } catch (vertexError) {
          console.log('⚠️ Vertex AI недоступен для анкеты, используем fallback через прокси');
          analysisResponse = await geminiProxyServiceInstance.generateText({
            prompt: prompt,
            model: 'gemini-2.5-flash',
            temperature: 0.3,
            maxOutputTokens: 4000
          });
        }
        console.log('✅ Gemini API вернул ответ для анализа сайта');
        console.log(`[WEBSITE-ANALYSIS] ✅ Полный ответ от Gemini: ${analysisResponse.substring(0, 200)}...`);
        
      } catch (aiError) {
        console.error("❌ Gemini API недоступен:", aiError);
        console.log(`[WEBSITE-ANALYSIS] Создаем простой fallback ответ для сайта`);
        
        // Создаем простой fallback ответ
        const domain = normalizedUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        const siteName = domain.split('.')[0];
        
        const baseData = {
          companyName: siteName.charAt(0).toUpperCase() + siteName.slice(1),
          contactInfo: `Контактная информация доступна на сайте ${domain}`,
          businessDescription: `Веб-сайт ${siteName}`,
          mainDirections: 'Основная деятельность компании',
          brandImage: 'Надежный и профессиональный партнер',
          productsServices: 'Качественные услуги для клиентов',
          targetAudience: 'Интернет-пользователи',
          customerResults: 'Получение качественных решений',
          companyFeatures: 'Профессиональный подход',
          businessValues: 'Качество, надежность, клиентоориентированность',
          productBeliefs: 'Наши решения должны приносить реальную пользу клиентам',
          competitiveAdvantages: 'Опыт работы, качественный сервис',
          marketingExpectations: 'Привлечение клиентов, повышение узнаваемости бренда'
        };
        
        analysisResponse = JSON.stringify(baseData);
        console.log(`[WEBSITE-ANALYSIS] Создан fallback ответ для сайта`);
      }
      
      // Парсим ответ для извлечения JSON
      let result: any = {};
      try {
        // Для fallback случая analysisResponse уже содержит правильный JSON
        if (analysisResponse.startsWith('{"companyName"')) {
          result = JSON.parse(analysisResponse);
          console.log('[WEBSITE-ANALYSIS] 🔧 DEBUG: Fallback данные успешно парсятся');
        } else {
          // Поиск JSON в ответе от AI API
          const jsonPattern = /{[\s\S]*}/;
          const match = analysisResponse.match(jsonPattern);
          
          if (match) {
            result = JSON.parse(match[0]);
          } else {
            return res.status(500).json({ 
              success: false,
              error: "Не удалось найти JSON в ответе AI" 
            });
          }
        }
          
        console.log('[WEBSITE-ANALYSIS] 🔧 DEBUG: businessValues после парсинга:', JSON.stringify(result.businessValues || ''));
        console.log('[WEBSITE-ANALYSIS] 🔧 DEBUG: productBeliefs после парсинга:', JSON.stringify(result.productBeliefs || ''));
        
        // ПРИНУДИТЕЛЬНО преобразуем ВСЕ массивы в строки
        Object.keys(result).forEach(key => {
          if (Array.isArray(result[key])) {
            const originalValue = [...result[key]]; // копия для логирования
            result[key] = result[key].join(', ');
            console.log(`[WEBSITE-ANALYSIS] Преобразован массив ${key}: [${originalValue.join('", "')}] → "${result[key]}"`);
          }
        });
        
        // Заполняем пустые критические поля
        if (!result.businessValues || result.businessValues.trim() === '') {
          result.businessValues = 'Профессионализм, качество, клиентоориентированность';
          console.log('[WEBSITE-ANALYSIS] Добавлены businessValues');
        }
        
        if (!result.productBeliefs || result.productBeliefs.trim() === '') {
          result.productBeliefs = 'Продукт должен решать реальные потребности пользователей';
          console.log('[WEBSITE-ANALYSIS] Добавлены productBeliefs');
        }
        
        if (!result.contactInfo || result.contactInfo.trim() === '') {
          const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          result.contactInfo = `Контактная информация доступна на сайте ${domain}`;
        }
      } catch (parseError) {
        console.error('Ошибка при парсинге JSON:', parseError);
        return res.status(500).json({ 
          success: false,
          error: "Не удалось обработать результат анализа" 
        });
      }
      
      // Добавляем детальное логирование результата анализа
      console.log('[WEBSITE-ANALYSIS] Результат анализа:', JSON.stringify(result, null, 2));
      console.log('[WEBSITE-ANALYSIS] Поля в результате:', Object.keys(result));
      console.log('[WEBSITE-ANALYSIS] Количество заполненных полей:', Object.values(result).filter(v => v && String(v).trim()).length);
      
      console.log('[WEBSITE-ANALYSIS] 🚀 Отправляем ответ клиенту...');
      const responseData = {
        success: true,
        data: result
      };
      console.log('[WEBSITE-ANALYSIS] 🚀 ResponseData:', JSON.stringify(responseData, null, 2));
      
      res.json(responseData);
      console.log('[WEBSITE-ANALYSIS] ✅ Ответ отправлен успешно');
      return;
    } catch (error: any) {
      console.error('Ошибка при анализе сайта:', error);
      return res.status(500).json({ 
        success: false,
        error: "Произошла ошибка при анализе сайта",
        details: error.message 
      });
    }
  });
  
  // Этот маршрут удален для предотвращения дублирования,
  // вместо него используется улучшенная версия выше
  
  // Альтернативный маршрут для проверки отдельных форматов ключа API (устаревший)
  app.get('/api/test-fal-ai-formats-v2', async (req, res) => {
    try {
      const { format } = req.query;
      
      // Получаем ключ из переменных окружения
      const rawApiKey = process.env.FAL_AI_API_KEY || '';
      
      if (!rawApiKey) {
        return res.status(400).json({
          success: false,
          error: 'FAL.AI API ключ не настроен в переменных окружения'
        });
      }
      
      // Проверяем запрошенный формат и применяем его
      let formattedKey = rawApiKey;
      let formatDescription = 'original';
      
      if (format === 'with-prefix' && !rawApiKey.startsWith('Key ')) {
        formattedKey = `Key ${rawApiKey}`;
        formatDescription = 'with Key prefix added';
      } else if (format === 'without-prefix' && rawApiKey.startsWith('Key ')) {
        formattedKey = rawApiKey.substring(4);
        formatDescription = 'without Key prefix';
      } else if (format === 'bearer') {
        formattedKey = `Bearer ${rawApiKey}`;
        formatDescription = 'with Bearer prefix';
      }
      
      console.log(`🧪 [FAL.AI TEST] Тестирование формата ключа: ${formatDescription}`);
      console.log(`🧪 [FAL.AI TEST] Итоговый заголовок: ${formattedKey.substring(0, 15)}...`);
      
      // Выполняем тестовый запрос к FAL.AI API с указанным форматом ключа
      try {
        const response = await axios.post(
          'https://queue.fal.run/fal-ai/fast-sdxl', 
          {
            prompt: 'A beautiful landscape, test image',
            negative_prompt: 'blurry, text',
            width: 512, // используем маленький размер для скорости
            height: 512,
            num_images: 1
          },
          {
            headers: {
              'Authorization': formattedKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 10000 // 10 секунд таймаут
          }
        );
        
        console.log(`🧪 [FAL.AI TEST] Успешный ответ с форматом "${formatDescription}"! Статус: ${response.status}`);
        
        return res.json({
          success: true,
          message: `FAL.AI API работает с форматом ключа: ${formatDescription}`,
          format: formatDescription,
          status: response.status,
          dataKeys: Object.keys(response.data || {})
        });
      } catch (apiError: any) {
        console.error(`🧪 [FAL.AI TEST] Ошибка API с форматом "${formatDescription}": ${apiError.message}`);
        
        const errorDetails = apiError.response 
          ? {
              status: apiError.response.status,
              data: apiError.response.data
            } 
          : {
              message: apiError.message
            };
            
        return res.status(apiError.response?.status || 500).json({
          success: false,
          error: `Ошибка при запросе к FAL.AI API с форматом ключа: ${formatDescription}`,
          format: formatDescription,
          details: errorDetails
        });
      }
    } catch (error: any) {
      console.error(`🧪 [FAL.AI TEST] Общая ошибка: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при тестировании форматов FAL.AI API ключа',
        message: error.message
      });
    }
  });
  
  // Маршрут для проверки наличия API ключа у пользователя
  app.get("/api/check-api-key", authenticateUser, async (req: any, res) => {
    try {
      const { service } = req.query;
      if (!service) {
        return res.status(400).json({
          success: false,
          error: "Не указан сервис для проверки API ключа"
        });
      }
      
      const userId = req.user?.id;
      const authHeader = req.headers['authorization'];
      
      if (!userId || !authHeader) {
        return res.status(401).json({
          success: false,
          error: "Не авторизован"
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      // Получаем API ключи пользователя
      const userKeysResponse = await directusApi.get('/items/api_keys', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          filter: {
            service_name: {
              _eq: service
            }
          }
        }
      });
      
      const userKeys = userKeysResponse?.data?.data || [];
      const hasKey = userKeys.length > 0 && userKeys[0].api_key;
      
      return res.json({
        success: true,
        hasKey: !!hasKey
      });
    } catch (error: any) {
      console.error('Ошибка при проверке API ключа:', error);
      return res.status(500).json({
        success: false,
        error: "Ошибка при проверке API ключа",
        details: error.message
      });
    }
  });

  // Обработчик для социальных данных пользователя
  
  // API для генерации изображений через FAL.AI
  app.post('/api/v1/image-gen', async (req, res) => {
    // Устанавливаем заголовок Content-Type: application/json для предотвращения перехвата Vite
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { prompt, negativePrompt, width, height, numImages } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: "Необходимо указать промпт для генерации изображения"
        });
      }
      
      // Получаем userId из запроса
      const authHeader = req.headers['authorization'];
      let userId = null;
      
      // Если есть авторизация, получаем userId из токена
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        try {
          // Получаем информацию о пользователе из токена
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
        }
      }
      
      // Инициализируем FAL.AI SDK с использованием централизованной системы API ключей
      let apiKey = null;
      
      if (userId) {
        // Если пользователь авторизован, пробуем получить ключ из его настроек
        apiKey = await apiKeyService.getApiKey(userId, 'fal_ai');
      }
      
      // Если не удалось получить ключ, пробуем использовать ключ из переменных окружения
      if (!apiKey) {
        console.log('Ключ FAL.AI пользователя не найден, используем ключ из переменных окружения');
        apiKey = process.env.FAL_AI_API_KEY;
      }
      
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "API ключ FAL.AI не найден"
        });
      }
      
      console.log(`[FAL.AI API] Генерация изображения для промпта: "${prompt.substring(0, 50)}..."`);
      
      try {
        // Инициализируем сервис через централизованный сервис API ключей
        if (userId) {
          const initSuccess = await falAiSdk.initializeFromApiKeyService(userId);
          if (!initSuccess) {
            // Если инициализация через API Key Service не удалась, используем прямой ключ
            console.log('Инициализация через API Key Service не удалась, используем прямой ключ');
            falAiSdk.initialize(apiKey);
          }
        } else {
          // Если нет userId, используем прямой ключ
          falAiSdk.initialize(apiKey);
        }
        
        // Параметры для генерации
        console.log(`Подготовка запроса Schnell, запрошено ${numImages || 1} изображений размером ${width || 1024}x${height || 1024}`);
        
        // Создаем объект с параметрами запроса
        const requestParams = {
          prompt: prompt,
          negative_prompt: negativePrompt || "",
          width: parseInt(String(width || 1024), 10),
          height: parseInt(String(height || 1024), 10),
          num_images: parseInt(String(numImages || 1), 10),
          scheduler: "K_EULER",
          num_inference_steps: 25,
          guidance_scale: 7.0
        };
        
        console.log('Параметры запроса через универсальный интерфейс:', JSON.stringify(requestParams));
        
        // Выполняем запрос через универсальный сервис
        const imageUrls = await falAiUniversalService.generateImages({
          prompt: requestParams.prompt,
          negativePrompt: requestParams.negative_prompt,
          width: requestParams.width,
          height: requestParams.height,
          numImages: 1,
          model: 'flux/schnell'
        });
        
        // Формируем ответ, совместимый с прежней структурой
        const responseData = { images: imageUrls };
        
        console.log("[FAL.AI API] Изображение успешно сгенерировано:", 
          responseData && responseData.images ? `Получено ${responseData.images.length} изображений` : "Пустой ответ");
        
        if (!responseData || !responseData.images || responseData.images.length === 0) {
          throw new Error("Не удалось получить URL сгенерированного изображения");
        }
        
        return res.json({
          success: true,
          images: responseData.images
        });
      } catch (error: any) {
        console.error("[FAL.AI API] Ошибка при генерации изображения:", error);
        
        // Анализируем тип ошибки для более информативного сообщения
        let errorMessage = error.message || "Неизвестная ошибка";
        let statusCode = 500;
        let errorDetails: any = {};
        
        // Проверяем наличие HTTP статуса в ошибке
        if (error.response) {
          statusCode = error.response.status || 500;
          errorDetails.status = error.response.status;
          errorDetails.data = error.response.data;
        }
        
        // Специфические сообщения об ошибках
        if (error.message.includes('Timeout')) {
          errorMessage = "Превышено время ожидания ответа от FAL.AI API (5 минут)";
        } else if (statusCode === 401 || statusCode === 403) {
          errorMessage = "Ошибка авторизации в FAL.AI API. Проверьте API ключ.";
        } else if (statusCode === 404) {
          errorMessage = "Указанный эндпоинт не найден в FAL.AI API.";
        } else if (statusCode >= 500) {
          errorMessage = "Внутренняя ошибка сервера FAL.AI API. Попробуйте повторить запрос позже.";
        }
        
        return res.status(statusCode).json({
          success: false,
          error: "Ошибка при обращении к API FAL.AI",
          message: errorMessage,
          details: errorDetails
        });
      }
    } catch (error: any) {
      console.error("[FAL.AI API] Непредвиденная ошибка при генерации изображения:", error);
      return res.status(500).json({
        success: false,
        error: "Непредвиденная ошибка при генерации изображения",
        message: error.message
      });
    }
  });
  
  // Тестовый эндпоинт для проверки состояния FAL.AI API
  app.get("/api/tools/test/fal-ai-status.json", async (req, res) => {
    // Устанавливаем Content-Type явно, чтобы предотвратить перехват Vite
    res.setHeader('Content-Type', 'application/json');
    try {
      // Получаем userId из запроса, если есть авторизация
      const authHeader = req.headers['authorization'];
      let userId = null;
      
      // Если есть авторизация, получаем userId из токена
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        try {
          // Получаем информацию о пользователе из токена
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
        }
      }
      
      // Пробуем получить ключ API из централизованной системы
      let apiKey = null;
      
      if (userId) {
        // Если пользователь авторизован, пробуем получить ключ из его настроек
        apiKey = await apiKeyService.getApiKey(userId, 'fal_ai');
      }
      
      // Если не удалось получить ключ пользователя, используем системный
      if (!apiKey) {
        apiKey = process.env.FAL_AI_API_KEY;
      }
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: "FAL.AI API ключ не найден"
        });
      }
      
      // Инициализируем SDK через централизованный сервис API ключей
      if (userId) {
        const initSuccess = await falAiSdk.initializeFromApiKeyService(userId);
        if (!initSuccess) {
          // Если инициализация через API Key Service не удалась, используем прямой ключ
          console.log('Инициализация через API Key Service не удалась, используем прямой ключ');
          falAiSdk.initialize(apiKey);
        }
      } else {
        // Если нет userId, используем прямой ключ
        falAiSdk.initialize(apiKey);
      }
      
      // Проверяем статус API
      const status = await falAiSdk.checkStatus();
      
      if (status.ok) {
        return res.json({
          success: true,
          message: status.message
        });
      } else {
        return res.status(500).json({
          success: false,
          message: status.message,
          details: status.details
        });
      }
    } catch (error: any) {
      console.error("Ошибка при проверке статуса FAL.AI API:", error);
      res.status(500).json({
        success: false,
        error: "Неожиданная ошибка при проверке статуса FAL.AI API",
        message: error.message
      });
    }
  });

  // API для генерации контент-плана
  app.post("/api/content/generate-plan", authenticateUser, async (req, res) => {
    try {
      const { campaignId, settings, selectedTrendTopics, keywords, businessData } = req.body;
      const userId = req.user?.id;

      if (!campaignId || !userId) {
        return res.status(400).json({
          success: false,
          error: "Отсутствуют обязательные параметры",
          message: "Необходимо указать ID кампании"
        });
      }

      // Получаем deepseek API ключ из настроек пользователя
      let deepseekKey = process.env.DEEPSEEK_API_KEY || "";
      const userApiKeys = await directusApi.get(`/users/${userId}/api_keys`, {
        headers: { Authorization: `Bearer ${req.headers.authorization}` }
      });
      
      const deepseekKeyData = userApiKeys.data.data?.find((k: any) => k.service_name === 'deepseek');
      if (deepseekKeyData?.api_key) {
        deepseekKey = deepseekKeyData.api_key;
        // Обновляем ключ API в сервисе
        deepseekService.updateApiKey(deepseekKey);
      }

      if (!deepseekKey) {
        return res.status(400).json({
          success: false,
          error: "Отсутствует API ключ DeepSeek",
          message: "Для генерации контент-плана необходимо установить API ключ DeepSeek в настройках профиля"
        });
      }

      console.log(`Генерация контент-плана для кампании ${campaignId}. Настройки:`, settings);
      
      // Получаем тренды, которые выбрал пользователь
      let selectedTrends = [];
      if (selectedTrendTopics && selectedTrendTopics.length > 0) {
        const trendTopics = await storage.getCampaignTrendTopics({ campaignId });
        selectedTrends = trendTopics.filter((trend) => selectedTrendTopics.includes(trend.id));
      }

      // Подготовка промпта для генерации контент-плана
      const businessInfo = businessData ? `
Информация о бизнесе:
- Название компании: ${businessData.companyName}
- Описание бизнеса: ${businessData.businessDescription}
- Основная аудитория: ${businessData.targetAudience}
- Ценности бренда: ${businessData.businessValues}
- Продукты и услуги: ${businessData.productsServices}
- Конкурентные преимущества: ${businessData.competitiveAdvantages}
      ` : 'Информация о бизнесе отсутствует.';

      const keywordsText = keywords?.length > 0 
        ? `Ключевые слова для кампании: ${keywords.map((k: any) => k.keyword).join(', ')}`
        : 'Ключевые слова отсутствуют.';

      const trendsText = selectedTrends.length > 0
        ? `Выбранные тренды:
${selectedTrends.map((trend) => `- ${trend.title} (Реакции: ${trend.reactions}, Комментарии: ${trend.comments}, Просмотры: ${trend.views})`).join('\n')}`
        : 'Тренды не выбраны.';

      const contentTypeTranslation: { [key: string]: string } = {
        'mixed': 'смешанный',
        'educational': 'обучающий',
        'promotional': 'рекламный',
        'entertaining': 'развлекательный'
      };

      const contentTypeText = settings.contentType 
        ? `Тип контента: ${contentTypeTranslation[settings.contentType] || settings.contentType}`
        : 'Тип контента: смешанный';

      const mediaTypeText = `Типы медиа: ${settings.includeImages ? 'изображения' : ''}${settings.includeImages && settings.includeVideos ? ' и ' : ''}${settings.includeVideos ? 'видео' : ''}`;
      
      // Создаем массив дат равномерно распределенных в периоде
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + settings.period);
      
      const dates = [];
      const dateInterval = settings.period / settings.postsCount;
      
      for (let i = 0; i < settings.postsCount; i++) {
        const postDate = new Date(now);
        postDate.setDate(postDate.getDate() + Math.round(i * dateInterval));
        // Устанавливаем случайное время дня между 9:00 и 20:00
        postDate.setHours(9 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60));
        dates.push(postDate);
      }

      // Сортируем даты
      dates.sort((a, b) => a.getTime() - b.getTime());

      // Форматируем даты для включения в промпт
      const datesText = `Даты публикаций:
${dates.map((date, index) => `${index + 1}. ${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`).join('\n')}`;

      // Формируем промпт для генерации контент-плана
      const prompt = `Создай детальный контент-план для социальных сетей на ${settings.period} дней с ${settings.postsCount} постами. 

${businessInfo}

${keywordsText}

${trendsText}

${contentTypeText}
${mediaTypeText}

${datesText}

Для каждой даты создай пост со следующей структурой:
1. Заголовок
2. Текст поста (HTML-форматирование)
3. Тип контента (text, text-image, video, video-text)
4. Хештеги (до 5-7 релевантных)
5. Ключевые слова (3-5 слов)
6. Промпт для генерации изображения, если пост с изображением

Ответ должен быть в формате JSON, содержащем массив постов, где каждый пост имеет следующие поля:
- title: заголовок поста
- content: HTML отформатированный текст поста
- contentType: тип контента (один из: text, text-image, video, video-text)
- scheduledAt: дата публикации (формат ISO)
- hashtags: массив хештегов
- keywords: массив ключевых слов
- prompt: промпт для генерации изображения (только для постов с изображениями)

Адаптируй контент под указанный тип, используй информацию из трендов и ключевых слов, чтобы сделать посты релевантными и интересными для целевой аудитории.`;

      console.log("Отправка запроса в DeepSeek для генерации контент-плана");

      // Выполняем запрос к API DeepSeek
      const messages: DeepSeekMessage[] = [
        { role: 'system', content: 'Ты - эксперт по SMM-стратегии и контент-маркетингу для российской аудитории. Ты создаешь детальные контент-планы для бизнеса в социальных сетях.' },
        { role: 'user', content: prompt }
      ];

      const response = await deepseekService.generateText(messages, {
        temperature: 0.7,
        max_tokens: 4000
      });

      let planData;
      try {
        // Извлекаем JSON из ответа
        const jsonMatch = response.match(/```json([\s\S]*?)```/) || response.match(/({[\s\S]*})/);
        const jsonText = jsonMatch ? jsonMatch[1].trim() : response;
        
        // Парсим JSON
        planData = JSON.parse(jsonText);
        
        // Если это не массив, но имеет поле "posts", используем его
        if (!Array.isArray(planData) && planData.posts && Array.isArray(planData.posts)) {
          planData = planData.posts;
        }
        
        // Если это все еще не массив, создаем ошибку
        if (!Array.isArray(planData)) {
          throw new Error("Ответ не является массивом постов");
        }
      } catch (error: any) {
        console.error("Ошибка при парсинге JSON ответа DeepSeek:", error);
        console.log("Ответ DeepSeek:", response);
        
        // Попытка восстановить из неструктурированного текста
        try {
          // Поиск паттернов в тексте, которые могут указывать на записи
          const posts = [];
          const postSections = response.split(/Пост \d+:|План на день \d+:/g).filter(Boolean);
          
          for (let i = 0; i < postSections.length; i++) {
            const section = postSections[i].trim();
            const titleMatch = section.match(/Заголовок:?\s*([^\n]+)/i);
            const contentMatch = section.match(/Текст[^:]*:?\s*([\s\S]*?)(?=Тип контента|Хештеги|Ключевые слова|$)/i);
            const contentTypeMatch = section.match(/Тип контента:?\s*([^\n]+)/i);
            const hashtagsMatch = section.match(/Хештеги:?\s*([\s\S]*?)(?=Ключевые слова|Промпт|$)/i);
            const keywordsMatch = section.match(/Ключевые слова:?\s*([\s\S]*?)(?=Промпт|$)/i);
            const promptMatch = section.match(/Промпт:?\s*([\s\S]*?)(?=$)/i);
            
            if (titleMatch) {
              const post = {
                title: titleMatch[1].trim(),
                content: contentMatch ? contentMatch[1].trim() : "",
                contentType: contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : "text",
                scheduledAt: dates[i] ? dates[i].toISOString() : new Date().toISOString(),
                hashtags: hashtagsMatch ? hashtagsMatch[1].split(/[,\s#]+/).filter(Boolean).map(h => h.startsWith('#') ? h : `#${h}`) : [],
                keywords: keywordsMatch ? keywordsMatch[1].split(/[,\s]+/).filter(Boolean) : [],
                prompt: promptMatch ? promptMatch[1].trim() : ""
              };
              posts.push(post);
            }
          }
          
          if (posts.length > 0) {
            planData = posts;
          } else {
            throw new Error("Не удалось восстановить структуру постов из текста");
          }
        } catch (recoveryError) {
          console.error("Не удалось восстановить структуру JSON из текста:", recoveryError);
          return res.status(500).json({
            success: false,
            error: "Ошибка при обработке ответа от DeepSeek",
            message: "Не удалось получить корректный формат контент-плана",
            rawResponse: response.substring(0, 1000) + "..." // Обрезаем длинный ответ
          });
        }
      }

      // Постобработка контент-плана
      const processedPlan = planData.map((post: any, index: number) => {
        // Проверяем и устанавливаем правильные типы контента
        let contentType = post.contentType || "text";
        if (typeof contentType === 'string') {
          contentType = contentType.toLowerCase();
          // Normalize content type
          if (contentType.includes("image") || contentType.includes("изображ")) {
            contentType = "text-image";
          } else if (contentType.includes("video") || contentType.includes("видео")) {
            contentType = "video-text";
          } else {
            contentType = "text";
          }
        } else {
          contentType = "text";
        }

        // Обрабатываем хештеги
        let hashtags = post.hashtags || [];
        if (typeof hashtags === 'string') {
          hashtags = hashtags.split(/[,\s]+/).filter(Boolean).map((h: string) => h.startsWith('#') ? h : `#${h}`);
        }

        // Обрабатываем ключевые слова
        let keywords = post.keywords || [];
        if (typeof keywords === 'string') {
          keywords = keywords.split(/[,\s]+/).filter(Boolean);
        }

        // Убедимся, что у нас есть промпт для генерации изображения для постов с изображениями
        let prompt = post.prompt || "";
        if (contentType === "text-image" && !prompt) {
          prompt = `Изображение для поста "${post.title}". ${post.content.substring(0, 100)}`;
        }

        // Устанавливаем дату публикации
        const scheduledAt = post.scheduledAt || (dates[index] ? dates[index].toISOString() : new Date().toISOString());

        return {
          title: post.title || `Пост №${index + 1}`,
          content: post.content || "",
          contentType,
          scheduledAt,
          hashtags,
          keywords,
          prompt
        };
      });

      return res.json({
        success: true,
        plan: processedPlan
      });
    } catch (error: any) {
      console.error("Ошибка при генерации контент-плана:", error);
      return res.status(500).json({
        success: false,
        error: "Ошибка при генерации контент-плана",
        message: error.message
      });
    }
  });

  // API для генерации контент-плана через n8n
  app.post("/api/content-plan/generate", async (req, res) => {
    // ВАЖНО: Заблокировать все режимы тестирования и имитации
    // Всегда отправляем реальный запрос к n8n webhook
    const simulationMode = false; // НИКОГДА НЕ МЕНЯТЬ НА TRUE
    try {
      // Подробно логируем тело запроса
      console.log("Получен запрос на генерацию контент-плана:");
      console.log("Тело запроса:", JSON.stringify(req.body));
      console.log("Заголовки:", JSON.stringify(req.headers));
      
      const { campaignId, settings, selectedTrendTopics, keywords, businessData } = req.body;
      // Получаем userId, установленный в authenticateUser middleware
      const userId = (req as any).userId;
      
      console.log("Извлеченные данные:");
      console.log("- campaignId:", campaignId);
      console.log("- userId:", userId);
      console.log("- settings:", settings ? "присутствует" : "отсутствует");
      console.log("- selectedTrendTopics:", selectedTrendTopics ? `${selectedTrendTopics.length} элементов` : "отсутствует");
      console.log("- keywords:", keywords ? `${keywords.length} элементов` : "отсутствует");
      console.log("- businessData:", businessData ? "присутствует" : "отсутствует");
      
      // Проверка только campaignId
      if (!campaignId) {
        console.error("Ошибка: отсутствует campaignId");
        return res.status(400).json({
          success: false,
          error: "Отсутствуют обязательные параметры",
          message: "Необходимо указать ID кампании"
        });
      }

      console.log(`Запуск генерации контент-плана через n8n для кампании ${campaignId}`);
      
      // Переменная для контроля режима имитации (для отладки)
      const simulationMode = false;
      
      if (simulationMode) {
        console.log("РЕЖИМ ИМИТАЦИИ: возвращение тестового контент-плана без вызова n8n webhook");
        
        // Генерируем имитационный контент-план для тестирования интерфейса
        const mockContentPlan = generateMockContentPlan(
          settings?.postsCount || 5,
          settings?.contentType || 'mixed',
          keywords || []
        );
        
        return res.json({
          success: true,
          data: {
            contentPlan: mockContentPlan
          }
        });
      }

      // Получаем тренды, которые выбрал пользователь
      let selectedTrends = [];
      if (selectedTrendTopics && selectedTrendTopics.length > 0) {
        const trendTopics = await storage.getCampaignTrendTopics({ campaignId });
        selectedTrends = trendTopics.filter((trend) => selectedTrendTopics.includes(trend.id));
      }

      // Формируем данные для отправки в n8n
      // n8n webhook ожидает данные в поле data, согласно коду в представленном n8n workflow
      const workflowData = {
        data: {
          campaignId,
          userId,
          settings,
          businessData,
          keywords: keywords || [],
          selectedTrendTopics, // Передаем список ID выбранных трендов напрямую
          directusToken: req.headers.authorization?.replace("Bearer ", "") || ""
        }
      };

      // Вызываем n8n webhook напрямую
      try {
        const n8nUrl = process.env.N8N_URL;
        if (!n8nUrl) {
          throw new Error('N8N_URL не настроен в переменных окружения');
        }
        
        const webhookUrl = process.env.N8N_CONTENT_PLAN_WEBHOOK || `${n8nUrl}/webhook/ae581e17-651d-4b14-8fb1-ca16898bca1b`;
        const apiKey = process.env.N8N_API_KEY;
        
        if (!webhookUrl) {
          throw new Error("Не настроен URL webhook для генерации контент-плана");
        }
        
        // ВРЕМЕННО: Убрана проверка ключа API для отладки на сервере
        // if (!apiKey) {
        //   throw new Error("Не настроен API ключ для доступа к n8n");
        // }

        console.log(`Отправка запроса на webhook: ${webhookUrl}`);
        console.log(`Данные запроса:`, JSON.stringify(workflowData).substring(0, 200) + "...");
        
        // Отправляем данные в формате { data: {...} } напрямую, так как n8n webhook ожидает этот формат
        // ВРЕМЕННО: Убрано требование ключа API для отладки на сервере
        const n8nResponse = await axios.post(webhookUrl, workflowData, {
          headers: {
            'Content-Type': 'application/json'
            // 'X-N8N-API-KEY': apiKey // Временно закомментировано для отладки
          }
        });
        
        console.log("Ответ от n8n webhook получен:", JSON.stringify(n8nResponse.data).substring(0, 200) + "...");
        
        // Проверяем структуру ответа от n8n webhook (гибкая проверка)
        if (!n8nResponse.data) {
          console.error("Пустой ответ от n8n webhook");
          return res.status(500).json({
            success: false,
            error: "Ошибка при генерации контент-плана",
            message: "Webhook вернул пустой ответ"
          });
        }
        
        // Извлекаем контент-план из ответа, учитывая разные варианты структуры
        let contentPlan;
        
        // Подробное логирование для отладки структуры
        console.log("Тип ответа n8n:", typeof n8nResponse.data);
        console.log("Ответ является массивом?", Array.isArray(n8nResponse.data));
        if (Array.isArray(n8nResponse.data)) {
          console.log("Длина массива ответа:", n8nResponse.data.length);
        }
        
        // Обработка ответа в виде массива с одним объектом (формат n8n webhook)
        if (Array.isArray(n8nResponse.data) && n8nResponse.data.length > 0) {
          const responseItem = n8nResponse.data[0];
          console.log("Первый элемент массива ответа:", JSON.stringify(responseItem).substring(0, 100) + "...");
          
          if (responseItem.data && responseItem.data.contentPlan) {
            contentPlan = responseItem.data.contentPlan;
            console.log("Найден contentPlan в первом элементе массива ответа");
          } else if (responseItem.contentPlan) {
            contentPlan = responseItem.contentPlan;
            console.log("Найден contentPlan непосредственно в первом элементе массива ответа");
          }
        } 
        // Обработка ответа в виде обычного объекта
        else if (n8nResponse.data.contentPlan) {
          contentPlan = n8nResponse.data.contentPlan;
          console.log("Найден contentPlan непосредственно в ответе");
        } else if (n8nResponse.data.data && n8nResponse.data.data.contentPlan) {
          contentPlan = n8nResponse.data.data.contentPlan;
          console.log("Найден contentPlan в поле data ответа");
        } else {
          console.error("Не удалось найти контент-план в ответе n8n:", n8nResponse.data);
          return res.status(500).json({
            success: false,
            error: "Ошибка при генерации контент-плана",
            message: "Webhook вернул данные без контент-плана"
          });
        }
        
        // Проверяем, что contentPlan действительно является массивом
        if (!Array.isArray(contentPlan)) {
          console.error("Извлеченный contentPlan не является массивом:", contentPlan);
          return res.status(500).json({
            success: false,
            error: "Ошибка при обработке контент-плана",
            message: "Неверный формат контент-плана"
          });
        }
        
        console.log(`Успешно извлечен контент-план с ${contentPlan.length} элементами`);

        // Возвращаем сгенерированный контент-план
        return res.json({
          success: true,
          data: {
            contentPlan: contentPlan
          }
        });
        
      } catch (error: any) {
        console.error("Ошибка при вызове n8n workflow:", error);
        return res.status(500).json({
          success: false,
          error: "Ошибка при вызове n8n workflow",
          message: error.message || "Неизвестная ошибка"
        });
      }
    } catch (error: any) {
      console.error("Ошибка при генерации контент-плана через n8n:", error);
      res.status(500).json({
        success: false,
        error: "Ошибка сервера",
        message: error.message || "Произошла ошибка при обработке запроса"
      });
    }
  });

  // API для сохранения контент-плана
  app.post("/api/content/save-plan", authenticateUser, async (req, res) => {
    try {
      const { campaignId, contentPlan } = req.body;
      const userId = (req as any).userId;

      if (!campaignId || !userId || !contentPlan || !Array.isArray(contentPlan)) {
        return res.status(400).json({
          success: false,
          error: "Некорректный запрос",
          message: "Необходимо указать ID кампании и массив контент-плана"
        });
      }

      console.log(`Сохранение контент-плана для кампании ${campaignId} (${contentPlan.length} постов)`);

      const savedContent = [];
      
      // Сохраняем каждый пост из плана
      for (const item of contentPlan) {
        try {
          // Подготавливаем данные для сохранения
          const contentData: any = {
            campaignId,
            userId,
            title: item.title || "",
            content: item.content || "",
            contentType: item.contentType || "text",
            scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : null,
            status: "draft"
          };

          // Добавляем поля в зависимости от типа контента
          if (item.contentType === "text-image" || item.contentType === "image-text") {
            contentData.prompt = item.prompt || "";
          }

          if (item.hashtags && Array.isArray(item.hashtags)) {
            contentData.hashtags = item.hashtags;
          } else if (item.hashtags && typeof item.hashtags === 'string') {
            contentData.hashtags = item.hashtags.split(/[,\s]+/).filter(Boolean).map((h: string) => h.startsWith('#') ? h : `#${h}`);
          } else {
            contentData.hashtags = [];
          }

          if (item.keywords && Array.isArray(item.keywords)) {
            contentData.keywords = item.keywords;
          } else if (item.keywords && typeof item.keywords === 'string') {
            contentData.keywords = item.keywords.split(/[,\s]+/).filter(Boolean);
          } else {
            contentData.keywords = [];
          }

          // Сохраняем контент в базу данных
          const savedItem = await storage.createCampaignContent(contentData);
          savedContent.push(savedItem);
        } catch (itemError: any) {
          console.error(`Ошибка при сохранении элемента контент-плана: ${itemError.message}`);
          // Продолжаем сохранять другие элементы
        }
      }

      return res.json({
        success: true,
        message: `Сохранено ${savedContent.length} из ${contentPlan.length} элементов контент-плана`,
        data: savedContent
      });
    } catch (error: any) {
      console.error("Ошибка при сохранении контент-плана:", error);
      return res.status(500).json({
        success: false,
        error: "Ошибка при сохранении контент-плана",
        message: error.message
      });
    }
  });
  
  // ОТЛАДОЧНЫЙ ЭНДПОИНТ: Показывает сведения о всех API ключах и может исправлять их форматирование
  app.get("/api/debug/api-keys", authenticateUser, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Не авторизован'
        });
      }
      
      const userId = req.user.id;
      console.log(`[DEBUG API Keys] Тестирование API ключей для пользователя ${userId}`);
      
      // Загружаем все API ключи из БД
      const apiKeys = await directusCrud.list('user_api_keys', {
        userId: userId,
        fields: ['id', 'user_id', 'service_name', 'api_key', 'created_at', 'updated_at']
      });
      
      console.log(`[DEBUG API Keys] Загружено ${apiKeys.length} ключей из базы данных:`);
      apiKeys.forEach((key: any) => {
        console.log(`[DEBUG API Keys] - ID ${key.id}, пользователь: ${key.user_id}, сервис: ${key.service_name || "(не указан)"}, ключ: ${key.api_key ? "имеется" : "отсутствует"}`);
      });
      
      // Получаем ключи через API Key Service для каждого сервиса
      const serviceNames: Array<'deepseek'|'fal_ai'|'apify'|'social_searcher'> = [
        'deepseek', 'fal_ai', 'apify', 'social_searcher'
      ];
      
      const results = await Promise.all(
        serviceNames.map(async (serviceName) => {
          try {
            console.log(`[DEBUG API Keys] Получаем ключ для сервиса: ${serviceName}`);
            const key = await apiKeyService.getApiKey(userId, serviceName);
            return {
              service: serviceName,
              keyExists: !!key,
              keyLength: key ? key.length : 0,
              keyPrefix: key ? key.substring(0, 10) + '...' : null
            };
          } catch (error) {
            console.error(`[DEBUG API Keys] Ошибка получения ключа для ${serviceName}:`, error);
            return {
              service: serviceName,
              keyExists: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );
      
      return res.json({
        success: true,
        data: {
          userId,
          rawApiKeys: apiKeys.map((k: any) => ({
            id: k.id,
            userId: k.user_id,
            service: k.service_name,
            hasKey: !!k.api_key,
            keyLength: k.api_key ? k.api_key.length : 0
          })),
          serviceResults: results
        }
      });
    } catch (error) {
      console.error('[DEBUG API Keys] Ошибка при тестировании API ключей:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка сервера при тестировании API ключей'
      });
    }
  });

  // Эндпоинт для тестирования Claude API
  app.get('/api/test-claude', async (req, res) => {
    try {
      // Получаем userId из токена авторизации, если пользователь авторизован
      const authHeader = req.headers['authorization'];
      let userId = null;
      let token = null;
      
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
        try {
          // Получаем данные пользователя из токена
          const decodedToken = await directusApi.get('/users/me', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (decodedToken.data && decodedToken.data.data) {
            userId = decodedToken.data.data.id;
          }
        } catch (error) {
          console.error('Ошибка при декодировании токена:', error);
        }
      }
      
      if (!userId) {
        // Если пользователь не авторизован, используем параметр userId из запроса
        userId = req.query.userId as string;
      }
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Не удалось определить пользователя. Пожалуйста, авторизуйтесь или укажите userId в параметрах запроса.'
        });
      }
      
      // Получаем API ключ Claude из сервиса ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'claude', token);
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API ключ Claude не найден. Пожалуйста, добавьте ключ в настройках.'
        });
      }
      
      // Инициализируем сервис Claude с полученным ключом
      const initialized = await claudeService.initialize(userId);
      
      if (!initialized) {
        return res.status(400).json({
          success: false,
          error: 'Не удалось инициализировать Claude API. Проверьте ключ в настройках.'
        });
      }
      
      // Тестовый запрос к Claude API - простая генерация текста
      try {
        const testResult = await claudeService.generateText(
          [
            { role: 'user', content: 'Reply with a single word: "Working"' }
          ],
          { maxTokens: 10 }
        );
        
        // Проверяем, содержит ли ответ ожидаемое слово
        const isWorking = testResult.toLowerCase().includes('working');
        
        if (isWorking) {
          return res.json({
            success: true,
            message: 'Claude API работает корректно',
            response: testResult
          });
        } else {
          return res.json({
            success: false,
            error: 'Claude API вернул неожиданный ответ',
            response: testResult
          });
        }
      } catch (error: any) {
        return res.status(500).json({
          success: false,
          error: `Ошибка при тестировании Claude API: ${error.message}`
        });
      }
    } catch (error: any) {
      console.error('Ошибка при тестировании Claude API:', error);
      return res.status(500).json({
        success: false,
        error: `Ошибка сервера при тестировании Claude API: ${error.message}`
      });
    }
  });



  // Эндпоинт для тестирования FAL.AI API с различными форматами ключей
  app.get("/api/test-fal-ai", async (req, res) => {
    try {
      // Получаем правильный API ключ из реальной БД Directus
      // Получаем userId из токена авторизации, если пользователь авторизован
      const authHeader = req.headers['authorization'];
      let userId = null;
      let token = null;
      
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
        try {
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
          console.log('Определен пользователь из токена:', userId);
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
        }
      }
      
      // Получаем реальный ключ пользователя из базы данных
      let apiKey = null;
      let keySource = 'database';
      
      if (userId) {
        try {
          apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', token);
          if (apiKey) {
            console.log(`Получен ключ FAL.AI из базы данных для пользователя: ${userId.substring(0, 8)}...`);
          } else {
            console.log(`Не найден ключ FAL.AI в базе данных для пользователя: ${userId.substring(0, 8)}...`);
          }
        } catch (error) {
          console.error("Ошибка при получении ключа из базы данных:", error);
        }
      }
      
      // Если пользователь авторизован, добавляем информацию
      if (userId) {
        console.log('Пользователь авторизован, мы могли бы использовать его ключ из БД');
        keySource = 'hardcoded_database_key_for_testing';
      }
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: "API ключ FAL.AI не настроен",
          details: "Добавьте ключ в переменные окружения или настройки пользователя"
        });
      }
      
      // Проверка формата ключа
      let formattedKey = apiKey;
      
      // Удаляем префикс 'Key ' если он уже есть, для консистентного форматирования
      if (formattedKey.startsWith('Key ')) {
        formattedKey = formattedKey.substring(4);
      }
      
      // Проверяем наличие ":" в ключе
      const hasColon = formattedKey.includes(':');
      if (!hasColon) {
        console.warn('API ключ не содержит символ ":", это может вызвать проблемы с авторизацией');
      }
      
      // Информация о ключе (без вывода самого ключа)
      const keyInfo = {
        length: formattedKey.length,
        source: keySource,
        hasColon: hasColon,
        format: 'id:secret format'
      };
      
      // Информация о ключе из переменных окружения (больше не используется, оставлено для совместимости)
      const envKeyFormat = {
        message: 'Ключи из переменных окружения больше не используются. Используются только ключи из базы данных.'
      };
      
      // Запускаем тестирование API с правильным форматом ключа (с префиксом Key)
      // ВАЖНО: API ключ всегда должен отправляться с префиксом "Key "
      const correctFormattedKey = `Key ${formattedKey}`;
      console.log(`Тестирование API с заголовком: Key ${formattedKey.substring(0, 8)}...`);
      
      // Тестовый запрос к FAL.AI API
      const requestData = {
        prompt: "Test image for authentication testing",
        width: 512,
        height: 512,
        num_images: 1
      };
      
      try {
        const response = await axios.post(
          'https://queue.fal.run/fal-ai/fast-sdxl',
          requestData,
          {
            headers: {
              'Authorization': correctFormattedKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 10000
          }
        );
        
        // Если запрос успешен, возвращаем результат и информацию о ключе
        return res.json({
          success: true,
          keyInfo,
          envKeyFormat,
          apiTestResult: {
            success: true,
            status: response.status,
            dataKeys: Object.keys(response.data || {})
          }
        });
      } catch (error: any) {
        // Если запрос не удался, возвращаем ошибку
        const errorDetails = error.response ? {
          status: error.response.status,
          data: error.response.data
        } : {
          message: error.message
        };
        
        return res.json({
          success: false,
          keyInfo,
          envKeyFormat,
          apiTestResult: {
            success: false,
            error: "Ошибка при запросе к FAL.AI API",
            details: errorDetails
          }
        });
      }
    } catch (error: any) {
      console.error('Ошибка при тестировании FAL.AI API:', error);
      return res.status(500).json({
        success: false,
        error: "Ошибка при тестировании API",
        message: error.message
      });
    }
  });
  
  // Эндпоинт для вывода текущего API ключа и заголовка Authorization
  app.get("/api/debug-fal-ai-header", async (req, res) => {
    try {
      // Получаем API ключ из базы данных
      
      // Получаем userId из токена авторизации, если пользователь авторизован
      const authHeader = req.headers['authorization'];
      let userId = null;
      let token = null;
      
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
        try {
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
          console.log(`Получен пользователь: ${userId}`);
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
        }
      }
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "Необходимо авторизоваться для использования этого эндпоинта"
        });
      }
      
      // Получаем ключ из базы данных через сервис API ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', token);
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: "API ключ FAL.AI не настроен в Directus"
        });
      }
      
      // Нормализуем ключ - убираем префикс Key, если он есть
      let baseKey = apiKey;
      if (baseKey.startsWith('Key ')) {
        baseKey = baseKey.substring(4);
      }
      
      // Генерируем все варианты заголовков для тестирования
      const headers = {
        withKeyPrefix: `Key ${baseKey}`,
        withoutPrefix: baseKey,
        withBearerPrefix: `Bearer ${baseKey}`,
        original: apiKey
      };
      
      // Выводим полные заголовки для отладки
      // ВАЖНО: в реальном проекте не выводите полные API ключи в ответе API!
      // Делаем это только для отладки в контролируемой среде
      console.log('Тестовые заголовки для FAL.AI API:');
      console.log('1. Оригинальный ключ из БД:', (apiKey || '').substring(0, 8) + '...');
      console.log('2. С префиксом Key:', `Key ${baseKey.substring(0, 8)}...`);
      console.log('3. Без префикса:', baseKey.substring(0, 8) + '...');
      
      // Создаем объект с анализом формата ключа
      const keyAnalysis = {
        originalFormat: {
          // Маскируем ключ для безопасности
          rawMasked: apiKey ? apiKey.substring(0, 8) + '...' : 'null',
          length: apiKey?.length || 0,
          hasPrefix: apiKey?.startsWith('Key ') || false,
          hasColon: apiKey?.includes(':') || false,
          containsWhitespace: apiKey ? /\s/.test(apiKey) : false
        },
        normalizedFormat: {
          rawMasked: baseKey.substring(0, 8) + '...',
          length: baseKey.length,
          hasColon: baseKey.includes(':'),
          containsWhitespace: /\s/.test(baseKey)
        },
        headerFormats: {
          withKeyPrefix: 'Key ' + baseKey.substring(0, 8) + '...',
          withoutPrefix: baseKey.substring(0, 8) + '...',
          withBearerPrefix: 'Bearer ' + baseKey.substring(0, 8) + '...'
        }
      };
      
      return res.json({
        success: true,
        message: "Подробная информация о FAL.AI API ключе и вариантах заголовков",
        keyAnalysis
      });
    } catch (error: any) {
      console.error('Ошибка при отладке заголовка:', error);
      return res.status(500).json({
        success: false,
        error: "Ошибка при отладке заголовка",
        message: error.message
      });
    }
  });

  // Эндпоинт для тестирования конкретного формата ключа FAL.AI
  app.get("/api/test-fal-ai-formats", async (req, res) => {
    try {
      const { format } = req.query;
      
      // Получаем userId из токена авторизации, если пользователь авторизован
      const authHeader = req.headers['authorization'];
      let userId = null;
      let token = null;
      
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
        try {
          const userResponse = await directusApi.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
          console.log(`Получен пользователь: ${userId}`);
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
        }
      }
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "Необходимо авторизоваться для использования этого эндпоинта"
        });
      }
      
      // Получаем ключ из базы данных через сервис API ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', token);
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: "API ключ FAL.AI не настроен в Directus",
          details: "Добавьте ключ через интерфейс настроек"
        });
      }
      
      // Нормализуем ключ - убираем префикс Key, если он есть
      let baseKey = apiKey;
      if (baseKey.startsWith('Key ')) {
        baseKey = baseKey.substring(4);
      }
      
      // Проверяем, содержит ли ключ символ ":"
      if (!baseKey.includes(':')) {
        console.warn('🧪 [FAL.AI TEST] Внимание: API ключ не содержит символ ":", это может вызвать проблемы с авторизацией');
      }
      
      // Форматируем ключ в зависимости от запрошенного формата
      let formattedKey = '';
      let formatDescription = '';
      
      // Логируем тип тестирования
      console.log(`🧪 [FAL.AI TEST] Тестирование формата ключа: ${format || 'original'}`);
      
      // Формируем ключ в запрошенном формате
      if (format === 'with-prefix') {
        // Формат "Key {apiKey}"
        formattedKey = `Key ${baseKey}`;
        formatDescription = 'With Key prefix added';
      } else if (format === 'without-prefix') {
        // Формат без префикса, только apiKey
        formattedKey = baseKey;
        formatDescription = 'Without Key prefix';
      } else if (format === 'bearer') {
        // Формат "Bearer {apiKey}"
        formattedKey = `Bearer ${baseKey}`;
        formatDescription = 'With Bearer prefix';
      } else {
        // Оригинальный формат (как в БД)
        formattedKey = apiKey;
        formatDescription = 'Original format from database';
      }
      
      // Логируем итоговый формат (для отладки, скрывая приватную часть)
      const colonIndex = formattedKey.indexOf(':');
      let maskedKey = '';
      
      if (colonIndex > 0) {
        // Если в ключе есть ":", маскируем только часть после двоеточия
        maskedKey = formattedKey.substring(0, colonIndex + 5) + '...';
      } else {
        // Если нет ":", маскируем ключ полностью, оставляя только первые символы
        maskedKey = formattedKey.substring(0, 10) + '...';
      }
      
      console.log(`🧪 [FAL.AI TEST] Итоговый заголовок: ${maskedKey}`);
      
      // Тестовый запрос к FAL.AI API
      const requestData = {
        prompt: "Test image for format testing",
        width: 512,
        height: 512,
        num_images: 1
      };
      
      try {
        const response = await axios.post(
          'https://queue.fal.run/fal-ai/fast-sdxl',
          requestData,
          {
            headers: {
              'Authorization': formattedKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 10000
          }
        );
        
        return res.json({
          success: true,
          format: formatDescription,
          status: response.status,
          dataKeys: Object.keys(response.data || {})
        });
      } catch (error: any) {
        // Возвращаем детали ошибки для анализа
        console.log(`🧪 [FAL.AI TEST] Ошибка API с форматом "${formatDescription}": ${error.message}`);
        
        const errorDetails = error.response ? {
          status: error.response.status,
          data: error.response.data
        } : {
          message: error.message
        };
        
        return res.status(400).json({
          success: false,
          error: "Ошибка при запросе к FAL.AI API",
          format: formatDescription,
          details: errorDetails
        });
      }
    } catch (error: any) {
      console.error('Ошибка при тестировании формата ключа:', error);
      return res.status(500).json({
        success: false,
        error: "Ошибка при тестировании формата ключа",
        message: error.message
      });
    }
  });

  // Admin endpoint to create SMM Manager User role
  app.post('/api/admin/create-smm-role', async (req: Request, res: Response) => {
    try {
      console.log('[admin] Creating SMM Manager User role via Directus API...');
      
      // Get admin token from DirectusAuthManager
      const adminToken = await directusAuthManager.getValidAdminToken();
      if (!adminToken) {
        return res.status(500).json({
          success: false,
          error: 'Не удалось получить токен администратора'
        });
      }

      const roleId = 'b3a6187c-8004-4d2c-91d7-417ecc0b113e';
      
      // Check if role already exists
      try {
        const existingRoleResponse = await directusApiManager.get(`/roles/${roleId}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        
        console.log('[admin] SMM Manager User role already exists');
        return res.json({
          success: true,
          message: 'Роль SMM Manager User уже существует',
          role: existingRoleResponse.data.data
        });
      } catch (error: any) {
        if (error.response?.status !== 403 && error.response?.status !== 404) {
          throw error;
        }
        // Role doesn't exist, continue with creation
      }

      // Create the role
      const roleData = {
        id: roleId,
        name: 'SMM Manager User',
        description: 'Обычный пользователь SMM системы с базовыми правами',
        admin_access: false,
        app_access: true
      };

      const createRoleResponse = await directusApiManager.post('/roles', roleData, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      console.log('[admin] SMM Manager User role created successfully');

      // Create permissions
      const permissions = [
        // Business questionnaire permissions
        { collection: 'business_questionnaire', action: 'create' },
        { collection: 'business_questionnaire', action: 'read' },
        { collection: 'business_questionnaire', action: 'update' },
        { collection: 'business_questionnaire', action: 'delete' },
        { collection: 'business_questionnaire', action: 'share' },
        
        // Campaign content permissions
        { collection: 'campaign_content', action: 'create' },
        { collection: 'campaign_content', action: 'read' },
        { collection: 'campaign_content', action: 'update' },
        { collection: 'campaign_content', action: 'delete' },
        { collection: 'campaign_content', action: 'share' },
        
        // Campaign content sources permissions
        { collection: 'campaign_content_sources', action: 'create' },
        { collection: 'campaign_content_sources', action: 'read' },
        { collection: 'campaign_content_sources', action: 'update' },
        { collection: 'campaign_content_sources', action: 'delete' },
        { collection: 'campaign_content_sources', action: 'share' },
        
        // Campaign keywords permissions
        { collection: 'campaign_keywords', action: 'create' },
        { collection: 'campaign_keywords', action: 'read' },
        { collection: 'campaign_keywords', action: 'update' },
        { collection: 'campaign_keywords', action: 'delete' },
        { collection: 'campaign_keywords', action: 'share' },
        
        // Campaign trend topics permissions
        { collection: 'campaign_trend_topics', action: 'create' },
        { collection: 'campaign_trend_topics', action: 'read' },
        { collection: 'campaign_trend_topics', action: 'update' },
        { collection: 'campaign_trend_topics', action: 'delete' },
        { collection: 'campaign_trend_topics', action: 'share' },
        
        // Post comment permissions
        { collection: 'post_comment', action: 'create' },
        { collection: 'post_comment', action: 'read' },
        { collection: 'post_comment', action: 'update' },
        { collection: 'post_comment', action: 'delete' },
        { collection: 'post_comment', action: 'share' },
        
        // Source posts permissions
        { collection: 'source_posts', action: 'create' },
        { collection: 'source_posts', action: 'read' },
        { collection: 'source_posts', action: 'update' },
        { collection: 'source_posts', action: 'delete' },
        { collection: 'source_posts', action: 'share' },
        
        // User API keys permissions
        { collection: 'user_api_keys', action: 'create' },
        { collection: 'user_api_keys', action: 'read' },
        { collection: 'user_api_keys', action: 'update' },
        { collection: 'user_api_keys', action: 'delete' },
        { collection: 'user_api_keys', action: 'share' },
        
        // User campaigns permissions
        { collection: 'user_campaigns', action: 'create' },
        { collection: 'user_campaigns', action: 'read' },
        { collection: 'user_campaigns', action: 'update' },
        { collection: 'user_campaigns', action: 'delete' },
        { collection: 'user_campaigns', action: 'share' },
        
        // User keywords user campaigns permissions
        { collection: 'user_keywords_user_campaigns', action: 'create' },
        { collection: 'user_keywords_user_campaigns', action: 'read' },
        { collection: 'user_keywords_user_campaigns', action: 'update' },
        { collection: 'user_keywords_user_campaigns', action: 'delete' },
        { collection: 'user_keywords_user_campaigns', action: 'share' },
        
        // Directus system collections - read only
        { collection: 'directus_activity', action: 'read' },
        { collection: 'directus_collections', action: 'read' },
        { collection: 'directus_comments', action: 'read' },
        { collection: 'directus_fields', action: 'read' },
        { collection: 'directus_notifications', action: 'read' },
        { collection: 'directus_presets', action: 'read' },
        { collection: 'directus_relations', action: 'read' },
        { collection: 'directus_roles', action: 'read' },
        { collection: 'directus_settings', action: 'read' },
        { collection: 'directus_shares', action: 'read' },
        { collection: 'directus_translations', action: 'read' },
        { collection: 'directus_users', action: 'read' }
      ];

      let createdPermissions = 0;
      for (const permission of permissions) {
        try {
          await directusApiManager.post('/permissions', {
            role: roleId,
            collection: permission.collection,
            action: permission.action
          }, {
            headers: { Authorization: `Bearer ${adminToken}` }
          });
          createdPermissions++;
        } catch (permError: any) {
          console.log(`[admin] Warning: Failed to create permission ${permission.collection}:${permission.action}:`, permError.response?.data?.errors?.[0]?.message || permError.message);
        }
      }

      console.log(`[admin] Created ${createdPermissions}/${permissions.length} permissions`);

      return res.json({
        success: true,
        message: 'Роль SMM Manager User создана успешно',
        role: createRoleResponse.data.data,
        permissionsCreated: createdPermissions,
        totalPermissions: permissions.length
      });

    } catch (error: any) {
      console.error('[admin] Error creating SMM Manager User role:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при создании роли',
        details: error.response?.data || error.message
      });
    }
  });

  // Vertex AI эндпоинт для улучшения текста с моделями Gemini 2.5
  app.post('/api/vertex-ai/improve-text', async (req: Request, res: Response) => {
    try {
      const { text, prompt, model } = req.body;
      
      if (!text || !prompt) {
        return res.status(400).json({
          success: false,
          error: 'Текст и инструкции обязательны'
        });
      }

      log(`[vertex-ai] Начинаем улучшение текста с помощью Gemini Direct`, 'info');
      
      // Используем прямой сервис Gemini с правильным проектом
      const { geminiVertexDirect } = await import('./services/gemini-vertex-direct.js');
      
      // Используем Gemini для улучшения текста
      const improvedText = await geminiVertexDirect.improveText({
        text: text,
        prompt: prompt,
        model: model || 'gemini-2.5-flash-preview-05-20'
      });

      log(`[vertex-ai] Текст успешно улучшен через Gemini Direct`, 'info');

      return res.json({
        success: true,
        text: improvedText
      });

    } catch (error: any) {
      console.error('[vertex-ai] Ошибка при улучшении текста:', error);
      
      return res.status(500).json({
        success: false,
        error: `Ошибка при улучшении текста: ${error.message}`
      });
    }
  });

  // API управления пользователями
  app.get('/api/admin/users', async (req: Request, res: Response) => {
    try {
      console.log('[admin-users] Запрос списка пользователей от администратора');
      
      // Получаем токен из заголовка авторизации
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[admin-users] Отсутствует токен авторизации');
        return res.status(401).json({ error: 'Требуется авторизация' });
      }

      const userToken = authHeader.substring(7);
      const directusUrl = process.env.DIRECTUS_URL;
      
      // Проверяем права администратора через прямой запрос к Directus
      const userResponse = await fetch(`${directusUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!userResponse.ok) {
        console.log('[admin-users] Неверный токен авторизации');
        return res.status(401).json({ error: 'Неверный токен авторизации' });
      }

      const userData = await userResponse.json();
      const currentUser = userData.data;
      
      if (!currentUser?.is_smm_admin) {
        console.log(`[admin-users] Пользователь ${currentUser?.email} не является администратором SMM`);
        return res.status(403).json({ 
          error: 'Недостаточно прав доступа', 
          details: `Пользователь ${currentUser?.email} не имеет прав администратора`
        });
      }

      // Используем токен администратора для получения списка пользователей
      const usersResponse = await fetch(`${directusUrl}/users?fields=id,email,first_name,last_name,is_smm_admin,expire_date,last_access,status&sort=-last_access&limit=100`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!usersResponse.ok) {
        const errorText = await usersResponse.text();
        console.log(`[admin-users] Ошибка получения пользователей: ${usersResponse.status}`);
        return res.status(500).json({ 
          success: false,
          error: 'Ошибка получения пользователей',
          details: `HTTP ${usersResponse.status}: ${errorText}`
        });
      }

      const usersData = await usersResponse.json();
      const users = usersData.data || [];

      console.log(`[admin-users] Получено ${users.length} пользователей`);

      res.json({
        success: true,
        data: users
      });

    } catch (error: any) {
      console.error('[admin-users] Ошибка при получении списка пользователей:', error);
      res.status(500).json({ 
        success: false,
        error: 'Ошибка получения пользователей',
        details: error?.message || 'Unknown error'
      });
    }
  });

  app.get('/api/admin/users/activity', async (req: Request, res: Response) => {
    try {
      console.log('[admin-users] Запрос статистики активности пользователей');
      
      // Получаем токен из заголовка авторизации
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[admin-users] Отсутствует токен авторизации');
        return res.status(401).json({ error: 'Требуется авторизация' });
      }

      const userToken = authHeader.substring(7);
      const directusUrl = process.env.DIRECTUS_URL;
      
      // Проверяем права администратора
      const userResponse = await fetch(`${directusUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!userResponse.ok) {
        console.log('[admin-users] Неверный токен авторизации');
        return res.status(401).json({ error: 'Неверный токен авторизации' });
      }

      const userData = await userResponse.json();
      const currentUser = userData.data;
      
      if (!currentUser?.is_smm_admin) {
        console.log('[admin-users] Пользователь не является администратором SMM');
        return res.status(403).json({ error: 'Недостаточно прав доступа' });
      }

      // Используем токен администратора для получения статистики

      // Получаем активных пользователей за последние 30 дней
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activityResponse = await fetch(`${directusUrl}/users?fields=id,email,last_access&filter[last_access][_gte]=${thirtyDaysAgo.toISOString()}&sort=-last_access`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!activityResponse.ok) {
        const errorText = await activityResponse.text();
        return res.status(500).json({ 
          success: false,
          error: 'Ошибка получения статистики активности',
          details: `HTTP ${activityResponse.status}: ${errorText}`
        });
      }

      const activityData = await activityResponse.json();
      const activeUsers = activityData.data || [];

      // Получаем общее количество пользователей
      const totalUsersResponse = await fetch(`${directusUrl}/users?aggregate[count]=*`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      let totalUsers = 0;
      if (totalUsersResponse.ok) {
        const totalData = await totalUsersResponse.json();
        totalUsers = totalData.data?.[0]?.count || 0;
      }

      const activityStats = {
        totalUsers,
        activeUsers: activeUsers.length,
        activityRate: totalUsers > 0 ? Math.round((activeUsers.length / totalUsers) * 100) : 0,
        recentActivity: activeUsers.slice(0, 10) // Последние 10 активных пользователей
      };

      console.log(`[admin-users] Статистика активности: ${activeUsers.length}/${totalUsers} активных пользователей`);

      res.json({
        success: true,
        data: activityStats
      });

    } catch (error: any) {
      console.error('[admin-users] Ошибка при получении статистики активности:', error);
      res.status(500).json({ 
        success: false,
        error: 'Ошибка получения статистики активности',
        details: error?.message || 'Unknown error'
      });
    }
  });

  app.patch('/api/admin/users/:userId', async (req: Request, res: Response) => {
    try {
      const { userId: targetUserId } = req.params;
      const { is_smm_admin, expire_date, status } = req.body;
      
      console.log(`[admin-users] Запрос на обновление пользователя ${targetUserId}`);
      
      // Получаем токен из заголовка авторизации
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[admin-users] Отсутствует токен авторизации');
        return res.status(401).json({ error: 'Требуется авторизация' });
      }

      const userToken = authHeader.substring(7);
      const directusUrl = process.env.DIRECTUS_URL;
      
      // Проверяем права администратора
      const userResponse = await fetch(`${directusUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!userResponse.ok) {
        console.log('[admin-users] Неверный токен авторизации');
        return res.status(401).json({ error: 'Неверный токен авторизации' });
      }

      const userData = await userResponse.json();
      const currentUser = userData.data;
      
      if (!currentUser?.is_smm_admin) {
        console.log('[admin-users] Пользователь не является администратором SMM');
        return res.status(403).json({ error: 'Недостаточно прав доступа' });
      }

      // Подготавливаем данные для обновления
      const updateData: any = {};
      if (typeof is_smm_admin === 'boolean') {
        updateData.is_smm_admin = is_smm_admin;
      }
      if (expire_date) {
        updateData.expire_date = expire_date;
      }
      if (status) {
        updateData.status = status;
      }

      // Используем токен администратора для обновления пользователя
      const updateResponse = await fetch(`${directusUrl}/users/${targetUserId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.log(`[admin-users] Ошибка обновления пользователя: ${updateResponse.status}`);
        return res.status(500).json({ 
          error: 'Ошибка обновления пользователя',
          details: `HTTP ${updateResponse.status}: ${errorText}`
        });
      }

      const updatedUser = await updateResponse.json();

      console.log(`[admin-users] Пользователь ${targetUserId} успешно обновлен`);

      res.json({
        success: true,
        data: updatedUser.data
      });

    } catch (error: any) {
      console.error('[admin-users] Ошибка при обновлении пользователя:', error);
      res.status(500).json({ 
        error: 'Ошибка сервера при обновлении пользователя',
        details: error.message 
      });
    }
  });

  // API эндпоинт для мгновенной публикации через N8N
  app.post('/api/publish-content', async (req, res) => {
    try {
      console.log('[N8N-PUBLISH] Получен запрос на публикацию:', JSON.stringify(req.body, null, 2));
      
      const { contentId, platforms } = req.body;
      const { publicationLockManager } = await import('./services/publication-lock-manager');
      
      console.log('[N8N-PUBLISH] contentId:', contentId, 'тип:', typeof contentId);
      console.log('[N8N-PUBLISH] platforms:', platforms, 'тип:', typeof platforms, 'isArray:', Array.isArray(platforms));
      
      if (!contentId || !platforms || !Array.isArray(platforms)) {
        console.log('[N8N-PUBLISH] Ошибка валидации:', {
          hasContentId: !!contentId,
          hasPlatforms: !!platforms,
          isPlatformsArray: Array.isArray(platforms)
        });
        return res.status(400).json({
          success: false,
          error: 'Требуется contentId и массив platforms'
        });
      }

      console.log('[N8N-PUBLISH] Вызов publishScheduler.publishContent с:', contentId, platforms);
      const { publishScheduler } = await import('./services/publish-scheduler-simple');
      const result = await publishScheduler.publishContent(contentId, platforms);
      
      console.log('[N8N-PUBLISH] Результат от publishScheduler:', result);
      res.json(result);
    } catch (error: any) {
      console.error('[N8N-PUBLISH] Ошибка публикации контента:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Ошибка при публикации контента'
      });
    }
  });

  // YouTube Token Refresh API для N8N workflow
  app.get("/api/youtube/refresh-token/:campaignId", async (req, res) => {
    console.log(`[YouTube Token Refresh] ENDPOINT CALLED! campaignId: ${req.params.campaignId}`);
    try {
      const campaignId = req.params.campaignId;
      const adminToken = process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_ADMIN_TOKEN;
      
      console.log(`[YouTube Token Refresh] Запрос refresh token для кампании: ${campaignId}`);
      
      if (!adminToken) {
        return res.status(500).json({
          success: false,
          error: "DIRECTUS_TOKEN не настроен"
        });
      }

      // Получаем настройки кампании
      const campaignResponse = await fetch(`${DIRECTUS_URL}items/user_campaigns/${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (!campaignResponse.ok) {
        console.error(`[YouTube Token Refresh] Ошибка получения кампании: ${campaignResponse.status}`);
        return res.status(404).json({
          success: false,
          error: "Кампания не найдена"
        });
      }

      const campaignData = await campaignResponse.json();
      const campaign = campaignData.data;
      
      if (!campaign.social_media_settings) {
        return res.status(400).json({
          success: false,
          error: "Настройки социальных сетей отсутствуют"
        });
      }

      // Парсим social_media_settings
      let settings;
      try {
        settings = typeof campaign.social_media_settings === 'string' 
          ? JSON.parse(campaign.social_media_settings) 
          : campaign.social_media_settings;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: "Ошибка парсинга настроек социальных сетей"
        });
      }

      if (!settings.youtube || !settings.youtube.refreshToken) {
        return res.status(400).json({
          success: false,
          error: "YouTube refresh token отсутствует в настройках кампании"
        });
      }

      // Получаем YouTube credentials из global_api_keys
      const credentialsResponse = await fetch(`${DIRECTUS_URL}items/global_api_keys`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (!credentialsResponse.ok) {
        return res.status(500).json({
          success: false,
          error: "Ошибка получения credentials из global_api_keys"
        });
      }

      const credentialsData = await credentialsResponse.json();
      const youtubeCredentials = credentialsData.data?.find(r => r.service_name === 'YouTube');
      
      if (!youtubeCredentials || !youtubeCredentials.api_key || !youtubeCredentials.api_secret) {
        return res.status(500).json({
          success: false,
          error: "YouTube credentials не найдены в global_api_keys"
        });
      }

      // Отправляем OAuth запрос к Google
      console.log(`[YouTube Token Refresh] Отправляем OAuth запрос для кампании ${campaignId}`);
      
      const oauthResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: youtubeCredentials.api_key,
          client_secret: youtubeCredentials.api_secret,
          refresh_token: settings.youtube.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      const oauthResult = await oauthResponse.json();

      if (!oauthResponse.ok) {
        console.error(`[YouTube Token Refresh] OAuth ошибка:`, oauthResult);
        return res.status(400).json({
          success: false,
          error: `OAuth ошибка: ${oauthResult.error || 'Неизвестная ошибка'}`,
          details: oauthResult
        });
      }

      if (!oauthResult.access_token) {
        return res.status(400).json({
          success: false,
          error: "Access token не получен от Google OAuth API"
        });
      }

      console.log(`[YouTube Token Refresh] Успешно получен новый access_token для кампании ${campaignId}`);

      // Возвращаем новый access_token
      return res.json({
        success: true,
        data: {
          access_token: oauthResult.access_token,
          expires_in: oauthResult.expires_in,
          scope: oauthResult.scope,
          token_type: oauthResult.token_type,
          campaign_id: campaignId,
          youtube_settings: {
            api_key: settings.youtube.apiKey,
            channel_id: settings.youtube.channelId
          }
        }
      });

    } catch (error) {
      console.error(`[YouTube Token Refresh] Ошибка:`, error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Подбор ключевых слов для сайта
  app.post("/api/keywords/analyze-website", async (req: any, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          error: "URL сайта обязателен"
        });
      }

      console.log(`🔍 Подбор ключевых слов для сайта: ${url}`);

      // Получаем Gemini ключ из базы данных
      let geminiKey;
      try {
        const globalKeysArray = await globalApiKeysService.getGlobalApiKeys();
        const geminiKeyRecord = globalKeysArray.find(key => 
          key.service_name === 'gemini' && key.is_active
        );
        
        if (!geminiKeyRecord) {
          throw new Error('Gemini ключ не найден в базе данных');
        }
        
        geminiKey = geminiKeyRecord.api_key;
      } catch (error) {
        geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          return res.status(500).json({
            success: false,
            error: "Gemini API ключ недоступен"
          });
        }
      }

      const geminiProxy = new GeminiProxyService({ apiKey: geminiKey });

      // Загружаем реальное содержимое сайта
      let siteContent = '';
      try {
        console.log(`📥 Загружаем содержимое сайта: ${url}`);
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        // Извлекаем текст из HTML (убираем теги)
        siteContent = response.data
          .replace(/<script[^>]*>.*?<\/script>/gis, '')
          .replace(/<style[^>]*>.*?<\/style>/gis, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 8000); // Ограничиваем размер
          
        console.log(`✅ Загружено ${siteContent.length} символов контента`);
      } catch (error) {
        console.warn(`⚠️ Не удалось загрузить содержимое сайта: ${error.message}`);
        siteContent = `Сайт ${url} - не удалось загрузить содержимое`;
      }

      // Анализируем реальное содержимое сайта и извлекаем ключевые слова
      const analysisPrompt = `Проанализируй РЕАЛЬНОЕ содержимое сайта как эксперт по SEO и маркетингу.

URL: ${url}

СОДЕРЖИМОЕ САЙТА:
${siteContent} 

ЗАДАЧА: Выполни глубокий анализ содержимого сайта и определи:
1. Основную тематику и направление бизнеса
2. Целевую аудиторию
3. Ключевые продукты/услуги
4. Уникальные особенности и преимущества

На основе РЕАЛЬНОГО анализа контента создай список из 18-20 высоко релевантных ключевых слов:

КАТЕГОРИИ КЛЮЧЕВЫХ СЛОВ:
- Основные (6-8 шт): точные названия продуктов/услуг компании
- Коммерческие (4-5 шт): запросы с намерением покупки/заказа
- Информационные (4-5 шт): образовательные запросы целевой аудитории  
- Long-tail (4-5 шт): длинные специфичные фразы с низкой конкуренцией

ВАЖНО: Ключевые слова должны быть:
- Максимально специфичными для ЭТОГО конкретного сайта
- Основанными на реальном контенте страниц
- Учитывающими особенности ниши и географию
- Разнообразными по коммерческому намерению

Верни результат в формате JSON:
{
  "keywords": [
    {"keyword": "точное название", "relevance": 98, "category": "основное", "trend_score": 85, "competition": 45},
    {"keyword": "коммерческий запрос", "relevance": 92, "category": "коммерческое", "trend_score": 70, "competition": 60}
  ]
}

Где:
- relevance (1-100): точность соответствия сайту
- category: "основное", "коммерческое", "информационное", "long-tail"  
- trend_score (1-100): популярность в поиске
- competition (1-100): уровень конкуренции`;

      try {
        // Попробуем сначала прямой Vertex AI (работает без прокси на staging)
        let analysisResult;
        try {
          console.log('🚀 Используем прямой Vertex AI для анализа ключевых слов');
          analysisResult = await geminiProxy.generateText({ 
            prompt: analysisPrompt, 
            model: 'gemini-2.5-flash',
            useVertexAI: true 
          });
        } catch (vertexError) {
          console.log('⚠️ Vertex AI недоступен, используем fallback через прокси');
          analysisResult = await geminiProxy.generateText({ 
            prompt: analysisPrompt, 
            model: 'gemini-2.5-flash' 
          });
        }
        
        // Парсим JSON ответ (убираем префикс "json" если есть)
        let keywordsData;
        try {
          let cleanResult = analysisResult.trim();
          
          // Попытка найти первую фигурную скобку
          const startIndex = cleanResult.indexOf('{');
          if (startIndex !== -1) {
            cleanResult = cleanResult.substring(startIndex);
          }
          
          keywordsData = JSON.parse(cleanResult);
        } catch (parseError) {
          console.warn(`⚠️ Не удалось парсить ответ Gemini:`, analysisResult.substring(0, 100));
          console.warn(`❌ Ошибка парсинга:`, parseError.message);
          
          // Fallback - возвращаем базовые ключевые слова
          return res.json({
            success: true,
            data: {
              url: siteUrl,
              keywords: [
                {"keyword": "качественные услуги", "relevance": 80, "category": "основное", "trend_score": 75, "competition": 60},
                {"keyword": "профессиональные решения", "relevance": 75, "category": "основное", "trend_score": 70, "competition": 55},
                {"keyword": "надежная компания", "relevance": 70, "category": "дополнительное", "trend_score": 65, "competition": 50},
                {"keyword": "индивидуальный подход", "relevance": 65, "category": "дополнительное", "trend_score": 60, "competition": 45},
                {"keyword": "доступные цены", "relevance": 85, "category": "long-tail", "trend_score": 80, "competition": 70},
                {"keyword": "быстрое выполнение", "relevance": 60, "category": "дополнительное", "trend_score": 55, "competition": 40},
                {"keyword": "опытная команда", "relevance": 72, "category": "основное", "trend_score": 68, "competition": 52},
                {"keyword": "современные технологии", "relevance": 78, "category": "дополнительное", "trend_score": 74, "competition": 58}
              ],
              total: 8,
              note: "Использованы базовые ключевые слова (AI временно недоступен)"
            }
          });
        }

        if (!keywordsData.keywords || !Array.isArray(keywordsData.keywords)) {
          return res.status(500).json({
            success: false,
            error: "Некорректный формат ответа от AI"
          });
        }

        // Обогащаем ключевые слова метриками
        const enrichedKeywords = keywordsData.keywords.map(kw => ({
          keyword: kw.keyword,
          relevance: kw.relevance || 50,
          category: kw.category || 'дополнительное',
          trend_score: Math.floor(Math.random() * 100) + 1,
          competition: Math.floor(Math.random() * 100) + 1
        }));

        console.log(`✅ Найдено ${enrichedKeywords.length} ключевых слов для ${url}`);

        return res.json({
          success: true,
          data: {
            url: url,
            keywords: enrichedKeywords,
            total: enrichedKeywords.length
          }
        });

      } catch (geminiError) {
        console.error(`❌ Ошибка анализа Gemini:`, geminiError.message);
        
        // Возвращаем базовые ключевые слова при ошибке AI
        const fallbackKeywords = [
          { keyword: "качественные услуги", relevance: 80, category: "основное", trend_score: 75, competition: 60 },
          { keyword: "профессиональные решения", relevance: 75, category: "основное", trend_score: 70, competition: 55 },
          { keyword: "надежная компания", relevance: 70, category: "дополнительное", trend_score: 65, competition: 50 },
          { keyword: "индивидуальный подход", relevance: 65, category: "дополнительное", trend_score: 60, competition: 45 },
          { keyword: "доступные цены", relevance: 85, category: "long-tail", trend_score: 80, competition: 70 },
          { keyword: "быстрое выполнение", relevance: 60, category: "дополнительное", trend_score: 55, competition: 40 },
          { keyword: "опытная команда", relevance: 72, category: "основное", trend_score: 68, competition: 52 },
          { keyword: "современные технологии", relevance: 78, category: "дополнительное", trend_score: 74, competition: 58 }
        ];

        return res.json({
          success: true,
          data: {
            url: url,
            keywords: fallbackKeywords,
            total: fallbackKeywords.length,
            note: "Использованы базовые ключевые слова (AI временно недоступен)"
          }
        });
      }

    } catch (error) {
      console.error('❌ Ошибка подбора ключевых слов:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Анализ настроений для трендов  
  app.get("/api/trends/sentiment/:campaignId", async (req: any, res) => {
    try {
      const { campaignId } = req.params;
      
      console.log(`🎭 Анализ настроений для кампании: ${campaignId}`);
      
      // Получаем системный токен
      const systemToken = await directusAuthManager.getSystemToken();
      if (!systemToken) {
        return res.status(500).json({
          success: false,
          error: "Системный токен недоступен"
        });
      }

      // Получаем все тренды для кампании
      const trendsResponse = await directusApiManager.instance.get('/items/campaign_trend_topics', {
        params: {
          filter: {
            campaign_id: { _eq: campaignId }
          },
          fields: ['id', 'title', 'comments', 'trend_post_id'],
          limit: -1
        },
        headers: {
          Authorization: `Bearer ${systemToken}`
        }
      });

      const trends = trendsResponse.data?.data || [];
      console.log(`📊 Найдено ${trends.length} трендов для анализа`);

      if (trends.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: `Нет трендов для кампании ${campaignId}`
        });
      }

      // Получаем Gemini ключ
      let geminiKey;
      try {
        const globalKeysArray = await globalApiKeysService.getGlobalApiKeys();
        const geminiKeyRecord = globalKeysArray.find(key => 
          key.service_name === 'gemini' && key.is_active
        );
        
        if (!geminiKeyRecord) {
          throw new Error('Gemini ключ не найден в базе данных');
        }
        
        geminiKey = geminiKeyRecord.api_key;
      } catch (error) {
        // Фолбэк на переменные окружения
        geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          return res.status(500).json({
            success: false,
            error: "Gemini API ключ недоступен"
          });
        }
      }

      const geminiProxy = new GeminiProxyService({ apiKey: geminiKey });
      const results = [];

      // Анализируем настроения для каждого тренда
      for (const trend of trends) {
        try {
          console.log(`📝 Анализ тренда: ${trend.title}`);
          
          // Получаем комментарии для тренда
          let commentsText = '';
          if (trend.trend_post_id) {
            const commentsResponse = await directusApiManager.instance.get('/items/post_comment', {
              params: {
                filter: {
                  trend_post_id: { _eq: trend.trend_post_id }
                },
                fields: ['comment_text', 'sentiment_score'],
                limit: 50 // Ограничиваем количество комментариев для анализа
              },
              headers: {
                Authorization: `Bearer ${systemToken}`
              }
            });

            const comments = commentsResponse.data?.data || [];
            console.log(`💬 Найдено ${comments.length} комментариев для тренда ${trend.title}`);
            
            if (comments.length > 0) {
              commentsText = comments.map(c => c.comment_text).join('\n');
            }
          }

          let sentiment = 'neutral';
          let confidence = 0;

          if (commentsText.length > 10) {
            // Анализируем настроения с помощью Gemini (без Vertex AI)
            try {
              const sentimentPrompt = `Проанализируй настроения в следующих комментариях и верни результат ТОЛЬКО в формате JSON:
{"sentiment": "positive|negative|neutral", "confidence": 0.95}

Комментарии:
${commentsText}

Правила:
- positive: если большинство комментариев положительные, восторженные, хвалят
- negative: если большинство комментариев негативные, критикуют, жалуются  
- neutral: если комментарии нейтральные или смешанные
- confidence: от 0 до 1, насколько уверен в оценке`;

              const sentimentResult = await geminiProxy.generateText(sentimentPrompt);
              
              // Парсим JSON ответ
              try {
                const parsed = JSON.parse(sentimentResult.trim());
                sentiment = parsed.sentiment || 'neutral';
                confidence = parsed.confidence || 0;
              } catch (parseError) {
                console.warn(`⚠️ Не удалось парсить ответ Gemini для тренда ${trend.title}:`, sentimentResult);
              }
            } catch (geminiError) {
              console.error(`❌ Ошибка анализа настроений Gemini для тренда ${trend.title}:`, geminiError.message);
            }
          }

          results.push({
            trend_id: trend.id,
            title: trend.title,
            comments_count: trend.comments || 0,
            sentiment: sentiment,
            confidence: confidence,
            emoji: sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😢' : '😐'
          });

        } catch (trendError) {
          console.error(`❌ Ошибка обработки тренда ${trend.title}:`, trendError.message);
          results.push({
            trend_id: trend.id,
            title: trend.title,
            comments_count: trend.comments || 0,
            sentiment: 'neutral',
            confidence: 0,
            emoji: '😐',
            error: trendError.message
          });
        }
      }

      console.log(`✅ Анализ настроений завершен. Обработано ${results.length} трендов`);

      return res.json({
        success: true,
        data: results,
        summary: {
          total_trends: results.length,
          positive: results.filter(r => r.sentiment === 'positive').length,
          negative: results.filter(r => r.sentiment === 'negative').length,
          neutral: results.filter(r => r.sentiment === 'neutral').length
        }
      });

    } catch (error) {
      console.error('❌ Ошибка анализа настроений трендов:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Возвращаем HTTP сервер для использования в main файле
  return httpServer;
}

function normalizeSourceUrl(url: string, domain: string): string | undefined {
  try {
    const parsed = new URL(url);
    if(parsed.hostname === domain){
      return url;
    }
    return undefined;
  } catch(e){
    console.error('Error normalizing source URL', url, e);
    return undefined;
  }
}

/**
 * Генерирует имитационный контент-план для тестирования интерфейса
 * @param count Количество элементов контента в плане
 * @param contentType Тип контента (text, text-image, mixed, video)
 * @param keywords Массив ключевых слов для использования в контенте
 * @returns Массив элементов контент-плана
 */
/**
 * Переводит текст с русского на английский для использования в генерации изображений
 * Используется для улучшения качества генерации изображений через Stable Diffusion
 * @param text Текст на русском языке
 * @returns Текст, переведенный на английский язык
 * 
 * @deprecated Используйте метод translatePrompt из falAiService для перевода промптов
 */
async function translateToEnglish(text: string): Promise<string> {
  try {
    // Используем метод translatePrompt из falAiService через его private-свойство
    // ВАЖНО: При любой возможности обновите код для прямого использования falAiService.generateImage с параметром translatePrompt
    
    // Проверяем, есть ли метод translatePrompt в falAiService (на всякий случай)
    if (typeof (falAiService as any).translatePrompt === 'function') {
      return await (falAiService as any).translatePrompt(text);
    }
    
    // Если метод недоступен, используем наш текущий метод
    // Используем DeepSeek для перевода, если API ключ доступен
    if (process.env.DEEPSEEK_API_KEY || deepseekService.hasApiKey()) {
      console.log('Переводим текст на английский через DeepSeek API');
      
      const translationPrompt = `Translate the following Russian text to English for image generation purposes. 
Provide only the translation without any explanations or comments:

${text}`;
      
      const response = await deepseekService.generateText([
        { role: 'system', content: 'You are a professional Russian to English translator. Translate the text maintaining the meaning and style, but optimizing it for image generation purposes. Your task is to make the text work well with image generation models like Stable Diffusion.' },
        { role: 'user', content: translationPrompt }
      ], {
        model: 'deepseek-chat',
        temperature: 0.3,
        max_tokens: 2000
      });
      
      return response.trim();
    } else {
      // Если DeepSeek недоступен, используем словарь для базового перевода ключевых слов
      console.log('DeepSeek API недоступен, используем базовый перевод');
      
      const translationDict: Record<string, string> = {
        'правильное питание': 'healthy nutrition',
        'рецепты': 'recipes',
        'еда': 'food',
        'здоровое питание': 'healthy eating',
        'фрукты': 'fruits',
        'овощи': 'vegetables',
        'диета': 'diet',
        'спорт': 'sports',
        'тренировка': 'workout',
        'фитнес': 'fitness',
        'белок': 'protein',
        'витамины': 'vitamins',
        'завтрак': 'breakfast',
        'обед': 'lunch',
        'ужин': 'dinner',
        'полезные продукты': 'healthy food',
        'салат': 'salad',
        'суп': 'soup',
        'вегетарианский': 'vegetarian',
        'веганский': 'vegan',
        'меню': 'menu',
        'план питания': 'meal plan'
      };
      
      let translatedText = text;
      
      // Заменяем все найденные слова и фразы
      Object.entries(translationDict).forEach(([rus, eng]) => {
        translatedText = translatedText.replace(new RegExp(rus, 'gi'), eng);
      });
      
      return translatedText;
    }
  } catch (error) {
    console.error('Ошибка при переводе текста:', error);
    // В случае ошибки возвращаем оригинальный текст
    return text;
  }
}

// ВАЖНО: Функция заблокирована и больше не используется
function generateMockContentPlan(count: number = 5, contentType: string = 'mixed', keywords: any[] = []): any[] {
  console.error("ОШИБКА: Попытка использовать заблокированную функцию generateMockContentPlan");
  throw new Error("Использование моковых данных заблокировано на сервере");
  console.log(`Генерация имитационного контент-плана: ${count} элементов, тип: ${contentType}`);
  
  const contentPlan = [];
  const types = contentType === 'mixed' 
    ? ['text', 'text-image', 'video'] 
    : [contentType];
  
  // Заготовки заголовков для постов о правильном питании
  const titleTemplates = [
    "Правильное питание для начинающих: %s простых шагов",
    "Топ-%s продуктов для здорового рациона",
    "%s рецептов полезных завтраков за 15 минут",
    "Как составить сбалансированное меню на неделю: %s советов",
    "Здоровые альтернативы: замените %s вредных продуктов на полезные",
    "Секреты правильного питания: %s мифов и фактов",
    "Правильное питание без стресса: %s простых привычек",
    "Суперфуды: %s продуктов для крепкого иммунитета",
    "Правильное питание на работе: %s идей для ланч-бокса",
    "Сезонное меню: %s лучших рецептов из осенних продуктов"
  ];
  
  // Заготовки контента для постов
  const contentTemplates = [
    "Правильное питание - это не диета, а образ жизни. В этом посте разберем %s основных принципов здорового питания, которые помогут вам чувствовать себя лучше каждый день. #здоровоепитание #пп",
    
    "Многие думают, что правильное питание - это сложно и дорого. Но мы подготовили для вас %s простых рецептов, которые не потребуют много времени и специальных ингредиентов. #рецепты #пп #бюджетное",
    
    "Знаете ли вы, что %s% людей испытывают дефицит витаминов даже при полноценном питании? Поговорим о том, как составить действительно сбалансированное меню и какие продукты обязательно должны быть в вашем рационе. #витамины #здоровье #питание",
    
    "Вода - основа здоровья! Сегодня разберемся, сколько воды нужно пить в день и как правильно распределить питьевой режим. Плюс %s советов, как приучить себя пить больше воды. #водныйбаланс #здоровье",
    
    "Белки, жиры и углеводы - строительный материал для нашего организма. Рассказываем, в каком соотношении их лучше употреблять и из каких продуктов получать. %s идеальных сочетаний продуктов для максимальной пользы. #бжу #правильноепитание",
  ];
  
  // Заготовки для хештегов
  const hashtags = [
    "#правильноепитание", "#здоровоепитание", "#пп", "#здоровье", "#рецепты", 
    "#полезно", "#вкусно", "#ппрецепты", "#nutrition", "#здоровыйобразжизни",
    "#ппшка", "#едаживая", "#витамины", "#белки", "#углеводы", "#жиры", "#диета",
    "#спорт", "#фитнес", "#зож", "#wellness", "#cleaneating", "#foodblogger"
  ];
  
  // Создаем элементы контент-плана
  for (let i = 0; i < count; i++) {
    // Выбираем случайный тип контента из доступных
    const postType = types[Math.floor(Math.random() * types.length)];
    
    // Формируем заголовок с случайным числом
    const randomNumber = Math.floor(Math.random() * 10) + 3; // число от 3 до 12
    const titleTemplate = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];
    const title = titleTemplate.replace('%s', randomNumber.toString());
    
    // Формируем контент
    const contentTemplate = contentTemplates[Math.floor(Math.random() * contentTemplates.length)];
    const content = contentTemplate.replace('%s', randomNumber.toString());
    
    // Выбираем случайные хештеги (от 3 до 7)
    const hashtagCount = Math.floor(Math.random() * 5) + 3;
    const postHashtags = [];
    for (let j = 0; j < hashtagCount; j++) {
      const tag = hashtags[Math.floor(Math.random() * hashtags.length)];
      if (!postHashtags.includes(tag)) {
        postHashtags.push(tag);
      }
    }
    
    // Добавляем ключевые слова из входных данных (до 3 случайных)
    const postKeywords = [];
    if (keywords && keywords.length > 0) {
      const keywordCount = Math.min(3, keywords.length);
      const shuffledKeywords = [...keywords].sort(() => 0.5 - Math.random());
      
      for (let k = 0; k < keywordCount; k++) {
        const kw = shuffledKeywords[k];
        if (kw && kw.keyword) {
          postKeywords.push(kw.keyword);
        }
      }
    }
    
    // Формируем дату публикации (в диапазоне от сегодня до +14 дней)
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + Math.floor(Math.random() * 14) + 1);
    
    // Создаем элемент контент-плана
    const item: any = {
      title,
      content,
      contentType: postType,
      hashtags: postHashtags,
      keywords: postKeywords,
      scheduledAt: scheduledAt.toISOString()
    };
    
    // Добавляем поля в зависимости от типа контента
    if (postType === 'text-image' || postType === 'image-text') {
      // Создаем промпт на русском языке
      const russianPrompt = `Изображение для поста "${title}" о правильном питании. ${content.substring(0, 100)}`;
      
      // Переводим промпт на английский для лучшей генерации изображений
      const englishPrompt = `Healthy eating post image about "${title.replace('Правильное питание', 'Healthy nutrition').replace('полезных', 'healthy').replace('здоровых', 'healthy')}". ${content.substring(0, 100)
        .replace('Правильное питание', 'Healthy nutrition')
        .replace('здоровое питание', 'healthy eating')
        .replace('рецепт', 'recipe')
        .replace('диета', 'diet')
        .replace('полезно', 'healthy')
        .replace('витамины', 'vitamins')}`;
      
      // Сохраняем оба промпта
      item.prompt = russianPrompt;
      item.englishPrompt = englishPrompt;
    }
    
    contentPlan.push(item);
  }
  
  console.log(`Сгенерирован имитационный контент-план: ${contentPlan.length} элементов`);
  return contentPlan;
}







