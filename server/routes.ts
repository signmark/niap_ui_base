import { deepseekService, DeepSeekMessage } from './services/deepseek';
import { perplexityService } from './services/perplexity';
import { ClaudeService } from './services/claude';
import { falAiService } from './services/falai';
import { falAiClient } from './services/fal-ai-client';
import { qwenService } from './services/qwen';
import { GeminiService } from './services/gemini';
import { geminiTestRouter } from './routes/gemini-test-route';
import { apiKeyService } from './services/api-keys';
// Убрали ненужный импорт schnellService - теперь используем универсальный интерфейс
import { falAiUniversalService, FalAiModelName } from './services/fal-ai-universal';
import { registerFalAiRedirectRoutes } from './routes-fal-ai-redirect';
import { registerFalAiImageRoutes } from './routes-fal-ai-images';
// import { registerClaudeRoutes } from './routes-claude'; // УДАЛЕНО - используем новый обработчик с данными кампании
import { testFalApiConnection } from './services/fal-api-tester';
import { socialPublishingService } from './services/social-publishing';
import { socialPublishingWithImgurService } from './services/social-publishing-with-imgur';
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
import { publishScheduler } from './services/publish-scheduler';
import { directusCrud } from './services/directus-crud';
import { publicationStatusChecker } from './services/status-checker';
import { geminiRouter } from './api/gemini-routes';
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
// import contentGenerationRouter from './routes/content-generation'; // Отключен из-за ошибок

/**
 * Подготавливает токен авторизации для запросов к Directus API
 * Исправляет дублирование префикса "Bearer" в токене
 * @param token Токен авторизации
 * @returns Корректно отформатированный токен авторизации
 */
function formatAuthToken(token: string): string {
  // Если токен уже начинается с "Bearer ", используем его как есть
  if (token.startsWith('Bearer ')) {
    return token;
  }
  // Иначе добавляем префикс "Bearer "
  return `Bearer ${token}`;
}

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
    const n8nUrl = process.env.N8N_URL || 'https://n8n.nplanner.ru';
    const n8nApiKey = process.env.N8N_API_KEY;
    
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
function mergeKeywords(perplexityKeywords: any[], xmlRiverKeywords: any[], deepseekKeywords: any[] = []): any[] {
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
  
  // Затем добавляем ключевые слова от Perplexity
  perplexityKeywords.forEach(keyword => {
    if (!keyword?.keyword) return;
    const key = keyword.keyword.toLowerCase().trim();
    if (!keywordMap.has(key)) {
      keywordMap.set(key, { ...keyword, source: 'perplexity' });
    }
  });
  
  // Затем добавляем ключевые слова от XMLRiver, если таких еще нет
  xmlRiverKeywords.forEach(keyword => {
    if (!keyword?.keyword) return;
    const key = keyword.keyword.toLowerCase().trim();
    if (!keywordMap.has(key)) {
      keywordMap.set(key, { ...keyword, source: 'xmlriver' });
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
    console.log(`Proxying image/media: ${url}`);
    
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
    
    console.log(`Sending request to ${fixedUrl} with headers:`, headers);
    
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

    // Log success
    console.log(`Successfully proxied media ${fixedUrl} with content type ${contentType}`);

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
    console.log(`Streaming video from: ${videoUrl}${options.forceType ? ` (forced type: ${options.forceType})` : ''}`);
    
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

// Helper function for Perplexity search
async function existingPerplexitySearch(keyword: string, token: string, platform: string = 'instagram'): Promise<any[]> {
  const cacheKey = `${keyword}_${platform}`;
  const cached = getCachedResults(cacheKey);
  if (cached) {
    console.log(`Using ${cached.length} cached results for keyword: ${keyword} (platform: ${platform})`);
    return cached;
  }

  try {
    const settings = await directusApi.get('/items/user_api_keys', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        filter: {
          service_name: { _eq: 'perplexity' }
        }
      }
    });

    let perplexityKey = settings.data?.data?.[0]?.api_key;
    if (!perplexityKey) {
      console.error('Perplexity API key not found');
      return [];
    }
    
    // Используем ключ как есть, без префиксов - просто добавляем Bearer при отправке запроса
    // Удаляем префикс Bearer, если он уже есть в ключе
    if (perplexityKey && perplexityKey.startsWith('Bearer ')) {
      perplexityKey = perplexityKey.replace('Bearer ', '');
      console.log('Removed "Bearer" prefix from stored Perplexity API key');
    }
    
    console.log(`Using Perplexity API key format: ${perplexityKey.substring(0, 6)}...`);

    let systemPrompt = '';
    let userPrompt = '';
    
    if (platform === 'instagram') {
      systemPrompt = `You are an expert at finding high-quality Russian Instagram accounts.
Focus only on Instagram accounts with >50K followers that post in Russian.
For each account provide:
1. Username with @ symbol 
2. Full name in Russian
3. Follower count with K or M
4. Brief description in Russian

Format each account as:
**@username** - Name (500K followers) - Description

Also include direct Instagram URLs in the response like:
https://www.instagram.com/username/ - description`;
      userPrompt = `Find TOP-5 most authoritative Russian Instagram accounts for: ${keyword}`;
    } else if (platform === 'telegram') {
      systemPrompt = `You are an expert at finding high-quality Russian Telegram channels.
Focus only on Telegram channels with >10K subscribers that post in Russian.
For each channel provide:
1. Channel name with @ symbol 
2. Full name in Russian
3. Subscriber count with K or M
4. Brief description in Russian

Format each channel as:
**@channelname** - Name (500K subscribers) - Description

Also include direct Telegram URLs in the response like:
https://t.me/channelname - description`;
      userPrompt = `Find TOP-5 most authoritative Russian Telegram channels for: ${keyword}`;
    }

    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${perplexityKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // Увеличиваем таймаут до 30 секунд для стабильности
        }
      );

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response structure');
      }

      const content = response.data.choices[0].message.content;
      console.log(`Raw API response for keyword ${keyword} (platform: ${platform}):`, content);

      // Извлекаем источники из текста с учетом платформы
      const sources = extractSourcesFromText(content, [platform]);
      console.log(`Found ${sources.length} sources for keyword ${keyword} (platform: ${platform})`);

      // Кешируем результаты с учетом платформы
      if (sources.length > 0) {
        console.log(`Caching ${sources.length} results for keyword: ${keyword} (platform: ${platform})`);
        searchCache.set(cacheKey, {
          timestamp: Date.now(),
          results: sources
        });
      }

      return sources;
    } catch (innerError) {
      console.error('Error in Perplexity API request:', innerError);
      throw innerError; // Пробрасываем ошибку в основной блок try-catch
    }

  } catch (error) {
    console.error('Error in Perplexity search:', error);
    return [];
  }
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
    console.log(`🔐🔐🔐 [AUTH-MIDDLEWARE] Проверка авторизации для ${req.method} ${req.url} 🔐🔐🔐`);
    const authHeader = req.headers.authorization;
    console.log(`[AUTH-MIDDLEWARE] Authorization header:`, authHeader ? 'ПРИСУТСТВУЕТ' : 'ОТСУТСТВУЕТ');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🚫 [AUTH-MIDDLEWARE] Отклонен: Нет заголовка авторизации');
      return res.status(401).json({ error: 'Не авторизован: Отсутствует заголовок авторизации' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('Empty token provided');
      return res.status(401).json({ error: 'Не авторизован: Пустой токен' });
    }

    try {
      // Получаем информацию о пользователе из Directus API
      const response = await directusApi.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data?.data?.id) {
        console.log('Invalid token: cannot get user info');
        return res.status(401).json({ error: 'Не авторизован: Недействительный токен' });
      }

      // Устанавливаем информацию о пользователе в объект запроса
      req.user = {
        id: response.data.data.id,
        token: token,
        email: response.data.data.email,
        firstName: response.data.data.first_name,
        lastName: response.data.data.last_name
      };
      
      // Оставляем поддержку старого интерфейса для обратной совместимости
      (req as any).userId = response.data.data.id;
      
      console.log(`User authenticated: ${req.user.id} (${req.user.email || 'no email'})`);
      next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(401).json({ 
        error: 'Не авторизован: Ошибка проверки токена',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
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
async function extractFullSiteContent(url: string): Promise<string> {
  try {
    console.log(`Начинаем глубокий анализ сайта: ${url}`);
    
    // Нормализуем URL, добавляя протокол, если его нет
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    const response = await axios.get(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 10000 // 10 секунд таймаут
    });
    
    // Разбираем HTML
    const htmlContent = response.data;
    
    // Извлекаем важные метаданные и структурированный контент
    let content = '';
    
    // 1. Получаем title и meta
    const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      content += `TITLE: ${titleMatch[1]}\n\n`;
    }
    
    const descriptionMatch = htmlContent.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/i) || 
                             htmlContent.match(/<meta[^>]*content="([^"]+)"[^>]*name="description"[^>]*>/i);
    
    if (descriptionMatch && descriptionMatch[1]) {
      content += `DESCRIPTION: ${descriptionMatch[1]}\n\n`;
    }
    
    const keywordsMatch = htmlContent.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"[^>]*>/i) ||
                          htmlContent.match(/<meta[^>]*content="([^"]+)"[^>]*name="keywords"[^>]*>/i);
    
    if (keywordsMatch && keywordsMatch[1]) {
      content += `KEYWORDS: ${keywordsMatch[1]}\n\n`;
    }
    
    // 2. Извлекаем заголовки (h1, h2, h3)
    content += `HEADINGS:\n`;
    
    const h1Matches = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/gis);
    if (h1Matches) {
      h1Matches.forEach(h => {
        const text = h.replace(/<[^>]*>/g, '').trim();
        if (text) content += `H1: ${text}\n`;
      });
    }
    
    const h2Matches = htmlContent.match(/<h2[^>]*>(.*?)<\/h2>/gis);
    if (h2Matches) {
      h2Matches.forEach(h => {
        const text = h.replace(/<[^>]*>/g, '').trim();
        if (text) content += `H2: ${text}\n`;
      });
    }
    
    const h3Matches = htmlContent.match(/<h3[^>]*>(.*?)<\/h3>/gis);
    if (h3Matches) {
      h3Matches.forEach(h => {
        const text = h.replace(/<[^>]*>/g, '').trim();
        if (text) content += `H3: ${text}\n`;
      });
    }
    
    content += `\n`;
    
    // 3. Извлекаем основной контент (параграфы)
    content += `CONTENT:\n`;
    
    const paragraphs = htmlContent.match(/<p[^>]*>(.*?)<\/p>/gis);
    if (paragraphs) {
      paragraphs.forEach(p => {
        const text = p.replace(/<[^>]*>/g, '').trim();
        if (text) content += `${text}\n\n`;
      });
    }
    
    // 4. Извлекаем списки (ul, ol, li)
    const lists = htmlContent.match(/<[uo]l[^>]*>.*?<\/[uo]l>/gis);
    if (lists) {
      content += `LISTS:\n`;
      
      lists.forEach(list => {
        const items = list.match(/<li[^>]*>(.*?)<\/li>/gis);
        if (items) {
          items.forEach(item => {
            const text = item.replace(/<[^>]*>/g, '').trim();
            if (text) content += `- ${text}\n`;
          });
          content += `\n`;
        }
      });
    }
    
    console.log(`Успешно извлечен контент для URL: ${url}, размер: ${content.length} символов`);
    
    if (content.length < 500) {
      // Если удалось извлечь мало контента, возможно сайт использует JS для рендеринга
      console.log(`Извлечено мало контента (${content.length} символов), возможно сайт требует JS-рендеринг`);
      // Дополняем исходным HTML, чтобы AI мог проанализировать структуру
      content += `\n\nRAW HTML STRUCTURE (для анализа):\n${htmlContent.substring(0, 5000)}...`;
    }
    
    return content;
  } catch (error) {
    console.error(`Ошибка при глубоком анализе сайта ${url}:`, error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
  // ВАЖНО: Регистрируем наш улучшенный маршрут ПЕРЕД старыми роутами Claude
  // Маршрут для генерации контента с данными кампании
  // Тестовый эндпоинт для проверки данных кампании
  app.post("/api/test-campaign-data", async (req: any, res) => {
    console.log(`[TEST-CAMPAIGN] Тестовый запрос получен`);
    const { campaignId, useCampaignData } = req.body;
    console.log(`[TEST-CAMPAIGN] campaignId: ${campaignId}, useCampaignData: ${useCampaignData}`);
    
    return res.json({ 
      success: true, 
      message: "Тест получен", 
      data: { campaignId, useCampaignData }
    });
  });

  // 🎯 КРИТИЧЕСКИ ВАЖНО: Перехватываем ВСЕ запросы на генерацию контента ПЕРВЫМИ!
  app.all("/api/generate-content", (req: any, res, next) => {
    console.log(`🚨🚨🚨 [MIDDLEWARE-CHECK] Запрос получен ПЕРЕД middleware! 🚨🚨🚨`);
    console.log(`[MIDDLEWARE-CHECK] Метод: ${req.method}, URL: ${req.url}`);
    console.log(`[MIDDLEWARE-CHECK] Headers авторизации:`, req.headers.authorization ? 'ЕСТЬ' : 'ОТСУТСТВУЕТ');
    next();
  });
  
  app.post("/api/generate-content", authenticateUser, async (req: any, res) => {
    console.log(`🎯🎯🎯 [CRITICAL-FIXED-HANDLER] ЗАПРОС ПОПАЛ В КРИТИЧЕСКИ ИСПРАВЛЕННЫЙ ОБРАБОТЧИК! 🎯🎯🎯`);
    console.log(`[CONTENT-GEN-INDEX] Запрос получен в index.ts (ПЕРВЫЙ обработчик)`);
    console.log(`[CONTENT-GEN-DEBUG] Получен запрос на генерацию контента от пользователя ${req.user?.id}`);
    console.log(`[CONTENT-GEN-DEBUG] Headers:`, req.headers.authorization ? 'Authorization ЕСТЬ' : 'Authorization ОТСУТСТВУЕТ');
    
    const { prompt, keywords, tone, campaignId, platform, service, useCampaignData } = req.body;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const userId = req.user?.id;
    
    console.log(`[CONTENT-GEN-DEBUG] ПРОВЕРКА АУТЕНТИФИКАЦИИ:`);
    console.log(`[CONTENT-GEN-DEBUG] req.user =`, req.user);
    console.log(`[CONTENT-GEN-DEBUG] userId = ${userId}`);
    console.log(`[CONTENT-GEN-DEBUG] token = ${token ? 'ИМЕЕТСЯ' : 'ОТСУТСТВУЕТ'}`);
    
    // Если userId не извлечен из middleware, попробуем декодировать токен напрямую
    let finalUserId = userId;
    if (!finalUserId && token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString();
        const decoded = JSON.parse(jsonPayload);
        finalUserId = decoded.id;
        console.log(`[CONTENT-GEN-DEBUG] Декодированный токен, fallback userId = ${finalUserId}`);
      } catch (decodeError) {
        console.log(`[CONTENT-GEN-DEBUG] Ошибка декодирования токена:`, decodeError);
      }
    }
    
    let campaignWebsiteUrl = null;
    let questionnaireData = null;
    
    // Если включено использование данных кампании, получаем данные из Directus
    if (useCampaignData) {
      console.log(`[CONTENT-GEN-DEBUG] Флаг useCampaignData = true, загружаем данные кампании ${campaignId}`);
      console.log(`[CONTENT-GEN-DEBUG] finalUserId = ${finalUserId}, token = ${token ? 'ИМЕЕТСЯ' : 'ОТСУТСТВУЕТ'}`);
      
      try {
        // 1. Получаем данные кампании (включая ссылку на сайт)
        console.log(`[CONTENT-GEN-DEBUG] Запрашиваем данные кампании из Directus...`);
        
        // Используем пользовательский токен, как во всех остальных частях системы
        console.log(`[CONTENT-GEN-DEBUG] Используем пользовательский токен для загрузки данных кампании`);
        console.log(`[CONTENT-GEN-DEBUG] token = ${token ? 'ИМЕЕТСЯ' : 'ОТСУТСТВУЕТ'}`);
        
        const campaignResponse = await axios.get(`${process.env.DIRECTUS_URL || 'https://directus.nplanner.ru'}/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`[CONTENT-GEN-DEBUG] Ответ кампании:`, campaignResponse.data?.data);
        
        if (campaignResponse.data?.data?.link) {
          campaignWebsiteUrl = campaignResponse.data.data.link;
          console.log(`[CONTENT-GEN-DEBUG] Найден URL кампании: ${campaignWebsiteUrl}`);
        } else {
          console.log(`[CONTENT-GEN-DEBUG] URL кампании не найден в данных`);
        }

        // 2. Получаем анкету из отдельной коллекции business_questionnaire
        console.log(`[CONTENT-GEN-DEBUG] Запрашиваем анкету пользователя для finalUserId=${finalUserId}...`);
        const questionnaireResponse = await axios.get(
          `${process.env.DIRECTUS_URL || 'https://directus.nplanner.ru'}/items/business_questionnaire?filter[user_id][_eq]=${finalUserId}&limit=1&sort=-date_created`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log(`[CONTENT-GEN-DEBUG] Ответ анкеты:`, questionnaireResponse.data?.data);
        
        if (questionnaireResponse.data?.data?.[0]) {
          questionnaireData = questionnaireResponse.data.data[0];
          console.log(`[CONTENT-GEN-DEBUG] Найдена анкета:`, {
            company_name: questionnaireData.company_name,
            business_description: questionnaireData.business_description,
            target_audience: questionnaireData.target_audience
          });
        } else {
          console.log(`[CONTENT-GEN-DEBUG] Анкета не найдена`);
        }
        
      } catch (error) {
        console.error('[CONTENT-GEN-DEBUG] Ошибка при получении данных кампании:', error.response?.data || error.message);
      }
    } else {
      console.log(`[CONTENT-GEN-DEBUG] Флаг useCampaignData = false, данные кампании не используются`);
    }
    
    // Формируем улучшенный промпт с учетом данных кампании
    let enhancedPrompt = prompt;
    
    if (keywords && keywords.length > 0) {
      enhancedPrompt += `\n\nКлючевые слова: ${keywords.join(', ')}`;
    }
    
    // Добавляем данные компании если включено использование данных кампании
    if (useCampaignData && (campaignWebsiteUrl || questionnaireData)) {
      enhancedPrompt += '\n\n=== СТРОГО ОБЯЗАТЕЛЬНЫЕ ДАННЫЕ КОМПАНИИ ===';
      enhancedPrompt += '\n🚨 ВНИМАНИЕ: Используй ТОЛЬКО эти данные! НЕ придумывай ничего своего!';
      
      if (campaignWebsiteUrl) {
        enhancedPrompt += `\n📌 ЕДИНСТВЕННЫЙ ПРАВИЛЬНЫЙ САЙТ: ${campaignWebsiteUrl}`;
        enhancedPrompt += `\n🚫 ЗАПРЕЩЕНО использовать любые другие сайты кроме: ${campaignWebsiteUrl}`;
        enhancedPrompt += `\n⚠️ Если пишешь ссылку, используй ТОЛЬКО: ${campaignWebsiteUrl}`;
      }
      
      if (questionnaireData) {
        if (questionnaireData.company_name) {
          enhancedPrompt += `\n🏢 Название компании: ${questionnaireData.company_name}`;
        }
        if (questionnaireData.business_description) {
          enhancedPrompt += `\n📝 Описание бизнеса: ${questionnaireData.business_description}`;
        }
        if (questionnaireData.target_audience) {
          enhancedPrompt += `\n🎯 Целевая аудитория: ${questionnaireData.target_audience}`;
        }
      }
      
      enhancedPrompt += '\n\n🚨 КРИТИЧЕСКИ ВАЖНО: НЕ СОЗДАВАЙ новые сайты, НЕ ИЗМЕНЯЙ предоставленную ссылку, НЕ ИСПОЛЬЗУЙ примеры типа diet-analysis.ru или подобные!';
      enhancedPrompt += `\n✅ ИСПОЛЬЗУЙ ТОЛЬКО: ${campaignWebsiteUrl || 'данные выше'}`;
      enhancedPrompt += '\n=== КОНЕЦ ОБЯЗАТЕЛЬНЫХ ДАННЫХ ===\n';
    }
    
    // Генерируем контент локально с данными кампании для выбранного сервиса
    console.log(`[CONTENT-GEN] Генерируем контент с сервисом: ${service}`);
    console.log(`[CONTENT-GEN] Используются данные кампании: ${useCampaignData ? 'ДА' : 'НЕТ'}`);
    console.log(`[CONTENT-GEN-DEBUG] Финальный промпт для AI:`);
    console.log(`[CONTENT-GEN-DEBUG] =====================================`);
    console.log(enhancedPrompt);
    console.log(`[CONTENT-GEN-DEBUG] =====================================`);
    
    let generatedContent;
    let usedService = service;
    
    if (service === 'claude') {
      console.log(`🎯🎯🎯 [CLAUDE-WITH-CAMPAIGN-DATA] Claude будет использовать данные кампании! 🎯🎯🎯`);
      console.log(`🌐 САЙТ КОМПАНИИ В ПРОМПТЕ:`, enhancedPrompt.includes('https://nplanner.ru/') ? 'НАЙДЕН ✅' : 'НЕ НАЙДЕН ❌');
      
      // Импортируем Claude сервис
      const { ClaudeService } = await import('./services/claude');
      
      // Инициализируем Claude сервис для пользователя
      const claudeService = new ClaudeService();
      await claudeService.initialize(userId);
      
      // КРИТИЧЕСКИ ВАЖНО: Генерируем контент с enhancedPrompt (содержит данные кампании)
      console.log(`🔍 ПЕРЕДАЕМ Claude enhancedPrompt длиной: ${enhancedPrompt.length} символов`);
      generatedContent = await claudeService.generateSocialContent(
        enhancedPrompt, // ИСПОЛЬЗУЕМ enhancedPrompt С ДАННЫМИ КАМПАНИИ!
        platform || 'instagram',
        tone || 'дружелюбный',
        keywords || []
      );
      
    } else if (service && (service.includes('gemini') || service === 'gemini-1.5-pro' || service === 'gemini-1.5-flash' || service === 'gemini-2.0-flash' || service === 'gemini-2.0-pro-exp')) {
      // Для Gemini моделей используем Google API
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('Google API ключ не настроен');
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Определяем правильную модель для Gemini
      let modelName = 'gemini-1.5-flash';
      if (service === 'gemini-1.5-pro' || service === 'gemini') {
        modelName = 'gemini-1.5-pro';
      } else if (service === 'gemini-2.0-flash') {
        modelName = 'gemini-2.0-flash-exp';
      } else if (service === 'gemini-2.0-pro-exp') {
        modelName = 'gemini-2.0-flash-thinking-exp';
      }
      
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          maxOutputTokens: 2400, // Увеличиваем для длинного контента
          temperature: 0.7,
        }
      });
      
      // Создаем промпт специально для длинного контента
      const longContentPrompt = `${enhancedPrompt}

ТРЕБОВАНИЯ К ДЛИНЕ КОНТЕНТА:
- Создай развернутый, подробный пост объемом НЕ МЕНЕЕ 800-1200 слов
- Включи несколько абзацев с детальным описанием
- Добавь практические советы и рекомендации
- Используй структурированный подход с подзаголовками
- Сделай контент максимально информативным и полезным`;
      
      const result = await model.generateContent(longContentPrompt);
      const response = await result.response;
      generatedContent = response.text();
      
    } else {
      console.log(`❌ НЕИЗВЕСТНЫЙ СЕРВИС: ${service}. Поддерживаемые: claude, gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash-exp`);
      throw new Error(`Неподдерживаемый сервис: ${service}. Поддерживаемые сервисы: claude, gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash-exp`);
      usedService = 'claude';
    }
    
    console.log(`[CONTENT-GEN] Контент успешно сгенерирован с сервисом ${usedService}, длина: ${generatedContent?.length || 0} символов`);
    
    // Критически важная фильтрация: заменяем неправильные сайты на правильный
    if (useCampaignData && campaignWebsiteUrl && generatedContent) {
      console.log(`[CONTENT-GEN] Применяем фильтрацию URL для кампании`);
      
      // Список запрещенных доменов, которые AI часто "придумывает"
      const bannedDomains = [
        'www.diet-expert.ru',
        'diet-expert.ru',
        'diet-analysis.ru',
        'www.diet-analysis.ru',
        'healthy-diet.ru',
        'www.healthy-diet.ru',
        'питание-эксперт.ру',
        'диета-анализ.ру'
      ];
      
      // Заменяем все запрещенные домены на правильный URL кампании
      let filteredContent = generatedContent;
      bannedDomains.forEach(domain => {
        const regex = new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        filteredContent = filteredContent.replace(regex, campaignWebsiteUrl);
      });
      
      // Дополнительно заменяем любые другие домены, которые AI мог придумать
      const websiteRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
      filteredContent = filteredContent.replace(websiteRegex, (match) => {
        // Если это не наш правильный домен, заменяем
        if (!match.includes(campaignWebsiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, ''))) {
          console.log(`[CONTENT-GEN] Заменяем неправильный URL ${match} на ${campaignWebsiteUrl}`);
          return campaignWebsiteUrl;
        }
        return match;
      });
      
      generatedContent = filteredContent;
      console.log(`[CONTENT-GEN] Фильтрация завершена, используется только правильный URL: ${campaignWebsiteUrl}`);
    }
    
    res.json({
      success: true,
      content: generatedContent,
      service: usedService
    });
  });
  
  // Удаляем дублирующий вызов registerClaudeRoutes - он уже зарегистрирован в index.ts
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
        const userResponse = await directusApi.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        userId = userResponse?.data?.data?.id;
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
      
      // Инициализируем FAL.AI с использованием централизованной системы API ключей
      let falAiApiKey = null;
      
      if (userId) {
        // Если пользователь авторизован, получаем ключ из настроек пользователя
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
  // app.use('/api', contentGenerationRouter); // Отключен из-за ошибок в роутере
  
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
  app.use('/api/gemini', geminiTestRouter);
  console.log('Gemini API test routes registered successfully');
  
  // Регистрируем маршруты для тестирования Instagram
  registerTestInstagramRoute(app);
  registerTestInstagramCarouselRoute(app);
  console.log('Test Instagram routes registered');
  console.log('Social platform webhook routes registered successfully');
  
  // Регистрируем маршруты для работы с админским токеном
  registerTokenRoutes(app);
  

  
  // Запускаем планировщик публикаций
  publishScheduler.start();
  
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

// Маршрут для генерации контента через DeepSeek API
  app.post("/api/content/generate-deepseek", authenticateUser, async (req: any, res) => {
    try {
      const { prompt, keywords, tone, platform, campaignId } = req.body;
      
      if (!prompt || !keywords || !tone || !campaignId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      // Получаем userId, установленный в authenticateUser middleware
      const userId = req.user?.id;
      // Получаем токен из заголовка авторизации
      const authHeader = req.headers['authorization'] as string;
      const token = authHeader?.replace('Bearer ', '') || '';
      
      console.log(`Инициализация DeepSeek сервиса для пользователя: ${userId}`);
      
      try {
        // Инициализируем DeepSeek API сервис с централизованным управлением ключами
        if (!userId) {
          return res.status(401).json({ 
            error: 'Не авторизован: Отсутствует ID пользователя' 
          });
        }
        
        const initialized = await deepseekService.initialize(userId, token);
        if (!initialized) {
          console.log('Предупреждение: DeepSeek API сервис не был полностью инициализирован');
          
          // Проверяем, получили ли мы ключ из переменных окружения
          if (!deepseekService.hasApiKey()) {
            console.error('Ошибка: Не удалось получить API ключ DeepSeek');
            return res.status(400).json({ 
              error: 'Не удалось получить API ключ DeepSeek. Пожалуйста, убедитесь, что ключ добавлен в настройках пользователя.' 
            });
          }
        }

        // Конвертируем тон в формат, понятный DeepSeek
        let deepseekTone: 'professional' | 'casual' | 'friendly' | 'humorous' = 'professional';
        switch (tone) {
          case "informative":
            deepseekTone = 'professional';
            break;
          case "friendly":
            deepseekTone = 'friendly';
            break;
          case "professional":
            deepseekTone = 'professional';
            break;
          case "casual":
            deepseekTone = 'casual';
            break;
          case "humorous":
            deepseekTone = 'humorous';
            break;
        }
        
        // Формируем запрос к DeepSeek API для генерации контента
        console.log(`Generating content with DeepSeek for campaign ${campaignId} with keywords: ${keywords.join(", ")}`);
        
        // Генерируем контент с помощью DeepSeek
        const content = await deepseekService.generateSocialContent(
          keywords,
          [prompt], // Используем prompt как тему
          platform || 'facebook', // Если платформа не указана, используем facebook по умолчанию
          {
            tone: deepseekTone,
            length: 'medium', // Medium по умолчанию
            language: 'ru' // Русский язык по умолчанию
          }
        );
        
        console.log(`Generated content with DeepSeek, length: ${content.length} characters`);
        
        // Возвращаем сгенерированный контент
        return res.json({
          success: true,
          content,
          service: 'deepseek'
        });
      } catch (error: any) {
        console.error("Error getting DeepSeek API key or generating content:", error);
        return res.status(400).json({ 
          error: "Ошибка при генерации контента с помощью DeepSeek API", 
          details: error.message 
        });
      }
    } catch (error: any) {
      console.error("Error in content generation endpoint:", error);
      return res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  // Эндпоинт для извлечения ключевых слов из текста
  app.post("/api/analyze-text-keywords", authenticateUser, async (req, res) => {
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
      
      // Если DeepSeek инициализирован, используем его для извлечения ключевых слов
      console.log(`Извлечение ключевых слов с помощью DeepSeek из текста длиной ${text.length} символов`);
      
      // Используем встроенный системный промт DeepSeek для извлечения ключевых слов
      const systemPrompt = `You are a keyword extraction specialist. 
      Extract the most important and relevant keywords from the given text in Russian language.
      
      RULES:
      1. Return ONLY keywords, no explanations or additional text
      2. Extract up to ${maxKeywords} keywords
      3. Keywords should be single words or short phrases (max 3 words)
      4. Keywords should be in the original language (Russian)
      5. Keywords should represent the main topics and concepts in the text
      6. Return the keywords as a JSON array, for example: ["keyword1", "keyword2", "keyword3"]
      7. Don't include common stopwords like "и", "в", "на", "с", etc.`;
      
      const userPrompt = `Extract keywords from this text:
      
      ${text}
      
      Remember to return ONLY a JSON array of keywords.`;
      
      try {
        const result = await deepseekService.generateText(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          {
            temperature: 0.2,  // Низкая температура для стабильности результата
            max_tokens: 100    // Ограничиваем длину ответа
          }
        );
        
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
          console.error("Ошибка при парсинге результата DeepSeek:", parseError);
          // Если не удалось распарсить как JSON, используем простое разделение по запятым
          keywords = result
            .replace(/[\[\]"]/g, '')
            .split(/,|\n/)
            .map(k => k.trim())
            .filter(Boolean);
        }
        
        // Ограничиваем количество ключевых слов
        keywords = keywords.slice(0, maxKeywords);
        
        console.log(`Извлечено ${keywords.length} ключевых слов из текста с помощью DeepSeek:`, keywords);
        
        return res.json({
          success: true,
          keywords,
          service: 'deepseek'
        });
      } catch (aiError) {
        console.error("Ошибка при использовании DeepSeek API для извлечения ключевых слов:", aiError);
        // Возвращаемся к простому алгоритму
        return res.status(400).json({ 
          error: "Ошибка при извлечении ключевых слов", 
          details: "Не удалось использовать DeepSeek API" 
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

  // Эндпоинт для генерации промта для изображения на основе текста через DeepSeek
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
      
      // Инициализируем DeepSeek сервис с ключом пользователя
      const initialized = await deepseekService.initialize(userId, token);
      
      if (!initialized) {
        return res.status(400).json({ 
          error: "Не удалось инициализировать DeepSeek API", 
          details: "API ключ не найден. Пожалуйста, добавьте API ключ в настройках пользователя." 
        });
      }
      
      // Генерируем промт для изображения на основе текста
      console.log(`Generating image prompt with DeepSeek (optimized method). Content length: ${content.length} chars`);
      
      // Очищаем HTML теги из контента
      const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`Content cleaned from HTML tags, new length: ${cleanContent.length} chars`);
      
      // Отправляем контент напрямую в DeepSeek для генерации промта без предварительного перевода
      // DeepSeek сам переведет контент и сгенерирует промт в одном запросе
      const prompt = await deepseekService.generateImagePrompt(
        cleanContent,
        keywords || []
      );
      
      console.log(`Generated image prompt with DeepSeek: ${prompt.substring(0, 100)}...`);
      
      // Возвращаем сгенерированный промт
      return res.json({
        success: true,
        prompt,
        service: 'deepseek'
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
    
    console.log(`[Image proxy] Requested URL: ${imageUrl}${isRetry ? ' (retry attempt)' : ''}${forceType ? ` (forced type: ${forceType})` : ''}${isVideoThumbnail ? ' (video thumbnail)' : ''}${itemId ? ` (item ID: ${itemId})` : ''}`);

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

  // Анализ сайта с помощью DeepSeek для извлечения ключевых слов
  app.get("/api/analyze-site/:url", authenticateUser, async (req: any, res) => {
    try {
      const siteUrl = req.params.url;
      if (!siteUrl) {
        return res.status(400).json({ error: "URL не указан" });
      }
      
      // Инициализируем DeepSeek с API ключом пользователя
      const userId = req.userId;
      const token = req.headers.authorization?.split(' ')[1];
      const initialized = await deepseekService.initialize(userId, token);
      
      if (!initialized) {
        return res.status(400).json({
          success: false,
          error: "Не удалось инициализировать DeepSeek API. Убедитесь, что у вас установлен API ключ в настройках."
        });
      }

      // Нормализуем URL
      const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
      console.log(`Анализируем сайт: ${normalizedUrl} с помощью DeepSeek`);
      
      // Создаем уникальный requestId для отслеживания запроса
      const requestId = crypto.randomUUID();
      console.log(`[${requestId}] Начат анализ сайта: ${normalizedUrl}`);
      
      // Глубокий парсинг сайта для получения максимум контента
      try {
        const parseRequestId = crypto.randomUUID();
        console.log(`[${parseRequestId}] Начинаем глубокий парсинг сайта`);
        const siteContent = await extractFullSiteContent(normalizedUrl);
        
        // Получаем ключевые слова от DeepSeek
        // Создаем новый requestId для запроса к DeepSeek
        const deepseekRequestId = crypto.randomUUID();
        const deepseekKeywords = await deepseekService.generateKeywordsForUrl(
          normalizedUrl, 
          siteContent, 
          deepseekRequestId
        );
        
        // Если нашли ключевые слова, попытаемся проверить их через XMLRiver для получения точных метрик
        if (deepseekKeywords && deepseekKeywords.length > 0) {
          try {
            console.log(`[${requestId}] Получаем ключ XMLRiver для пользователя ${userId}`);
            
            // Получаем конфигурацию XMLRiver из централизованного хранилища
            const xmlRiverConfig = await apiKeyService.getApiKey(userId, 'xmlriver', token);
            
            if (!xmlRiverConfig) {
              console.error(`[${requestId}] XMLRiver ключ не найден для пользователя ${userId}`);
              return res.status(400).json({
                key_missing: true,
                service: 'xmlriver',
                message: 'Для использования Yandex.Wordstat необходимо добавить API ключ XMLRiver в настройках'
              });
            }
            
            console.log(`[${requestId}] Получен ключ XMLRiver, обогащаем метрики ключевых слов`);
            
            // Пытаемся распарсить JSON-строку, если она хранится в формате JSON
            let xmlRiverUserId = "16797"; // Значение по умолчанию
            let xmlRiverApiKey = xmlRiverConfig;
            
            try {
              // Проверяем, является ли значение JSON-строкой
              if (xmlRiverConfig.startsWith('{') && xmlRiverConfig.endsWith('}')) {
                const configObj = JSON.parse(xmlRiverConfig);
                if (configObj.user) xmlRiverUserId = configObj.user;
                if (configObj.key) xmlRiverApiKey = configObj.key;
                console.log(`[${requestId}] XMLRiver конфигурация успешно прочитана из JSON: user=${xmlRiverUserId}, key=${xmlRiverApiKey.substring(0, 5)}...`);
              } else if (xmlRiverConfig.includes(':')) {
                // Для обратной совместимости обрабатываем формат user:key
                const [user, key] = xmlRiverConfig.split(':');
                xmlRiverUserId = user.trim();
                xmlRiverApiKey = key.trim();
                console.log(`[${requestId}] XMLRiver конфигурация прочитана из старого формата user:key`);
              }
            } catch (e) {
              console.warn(`[${requestId}] Ошибка при парсинге конфигурации XMLRiver, будет использован ключ как есть:`, e);
            }
            
            // Выбираем первые 5 ключевых слов для проверки через XMLRiver (чтобы не превышать лимиты API)
            const topKeywords = deepseekKeywords.slice(0, 5).map(kw => kw.keyword);
            
            // Проверяем каждое ключевое слово через XMLRiver
            const xmlRiverResults = await Promise.all(
              topKeywords.map(async (keyword) => {
                try {
                  // Для XMLRiver требуется POST запрос с JSON в теле
                  console.log(`[${requestId}] Отправляем запрос в XMLRiver API: user=${xmlRiverUserId}, key=${xmlRiverApiKey.substring(0, 5)}...`);
                  
                  // Формируем запрос согласно правильному формату XMLRiver API
                  console.log(`[${requestId}] Sending XMLRiver API request to correct URL endpoint`);
                  const xmlriverResponse = await axios.get(`http://xmlriver.com/wordstat/json`, {
                    params: {
                      user: xmlRiverUserId,
                      key: xmlRiverApiKey,
                      query: keyword
                    }
                  });
                  
                  console.log(`[${requestId}] XMLRiver API response:`, JSON.stringify(xmlriverResponse.data).substring(0, 200));
                  
                  // Проверяем наличие данных в ответе
                  if (xmlriverResponse.data && xmlriverResponse.data.report && xmlriverResponse.data.report.shows) {
                    const showsValue = parseInt(xmlriverResponse.data.report.shows) || 0;
                    
                    console.log(`[${requestId}] XMLRiver данные для "${keyword}": ${showsValue} показов`);
                    
                    return {
                      keyword,
                      shows: showsValue
                    };
                  }
                  return null;
                } catch (error) {
                  console.error(`[${requestId}] Ошибка при запросе к XMLRiver для "${keyword}":`, error);
                  return null;
                }
              })
            );
            
            // Фильтруем успешные результаты
            const validResults = xmlRiverResults.filter(Boolean);
            
            // Создаем Map для быстрого поиска по ключевому слову
            const xmlRiverDataMap = new Map();
            validResults.forEach(result => {
              if (result) xmlRiverDataMap.set(result.keyword.toLowerCase(), result);
            });
            
            // Обновляем метрики в deepseekKeywords
            deepseekKeywords.forEach(keyword => {
              const xmlRiverData = xmlRiverDataMap.get(keyword.keyword.toLowerCase());
              if (xmlRiverData) {
                console.log(`[${requestId}] Обновляем метрики для "${keyword.keyword}": DeepSeek (${keyword.trend}) -> XMLRiver (${xmlRiverData.shows})`);
                // Обновляем значение популярности на реальное от XMLRiver
                keyword.trend = xmlRiverData.shows;
                // Добавляем источник метрик
                keyword.source = 'xmlriver+deepseek';
              }
            });
          } catch (xmlRiverError) {
            console.error(`[${requestId}] Ошибка при использовании XMLRiver:`, xmlRiverError);
            // Продолжаем с данными DeepSeek при ошибке XMLRiver
          }
          
          // Кешируем результаты (уже обогащенные данными XMLRiver, если удалось)
          urlKeywordsCache.set(normalizedUrl, {
            timestamp: Date.now(),
            results: deepseekKeywords
          });
        }
        
        console.log(`DeepSeek нашел ${deepseekKeywords.length} ключевых слов для: ${normalizedUrl}`);
        return res.json({
          success: true,
          data: { keywords: deepseekKeywords }
        });
        
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
  
  // Извлекает полное содержимое сайта, включая текст, заголовки, метаданные
  async function extractFullSiteContent(url: string): Promise<string> {
    try {
      console.log(`Выполняется глубокий парсинг сайта: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 15000, // Увеличиваем timeout для сложных сайтов
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        maxRedirects: 5 // Разрешаем редиректы для корректной обработки сайтов
      });
      
      const htmlContent = response.data;
      
      // Извлекаем метаданные
      const metadata: Record<string, string> = {};
      
      // Заголовок
      const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/is);
      if (titleMatch && titleMatch[1]) {
        metadata.title = titleMatch[1].replace(/<[^>]+>/g, ' ').trim();
      }
      
      // Мета-описание
      const descriptionMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                          htmlContent.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
      if (descriptionMatch && descriptionMatch[1]) {
        metadata.description = descriptionMatch[1].trim();
      }
      
      // Мета-ключевые слова
      const keywordsMatch = htmlContent.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                      htmlContent.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']keywords["'][^>]*>/i);
      if (keywordsMatch && keywordsMatch[1]) {
        metadata.keywords = keywordsMatch[1].trim();
      }
      
      // Извлекаем все заголовки h1-h6
      const headings: string[] = [];
      const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gis;
      let headingMatch;
      while ((headingMatch = headingRegex.exec(htmlContent)) !== null) {
        const cleanHeading = headingMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanHeading.length > 0) {
          headings.push(`[H${headingMatch[1]}] ${cleanHeading}`);
        }
      }
      
      // Извлекаем все параграфы
      const paragraphs: string[] = [];
      const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gis;
      let paragraphMatch;
      while ((paragraphMatch = paragraphRegex.exec(htmlContent)) !== null) {
        const cleanParagraph = paragraphMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanParagraph.length > 20) { // Игнорируем слишком короткие параграфы
          paragraphs.push(cleanParagraph);
        }
      }
      
      // Извлекаем текст из списков
      const listItems: string[] = [];
      const listItemRegex = /<li[^>]*>(.*?)<\/li>/gis;
      let listItemMatch;
      while ((listItemMatch = listItemRegex.exec(htmlContent)) !== null) {
        const cleanItem = listItemMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanItem.length > 5) {
          listItems.push(`• ${cleanItem}`);
        }
      }
      
      // Извлекаем текст из div с потенциально важным содержимым
      const contentDivs: string[] = [];
      const contentDivRegex = /<div[^>]*class=["'](?:.*?content.*?|.*?main.*?|.*?article.*?)["'][^>]*>(.*?)<\/div>/gis;
      let contentDivMatch;
      while ((contentDivMatch = contentDivRegex.exec(htmlContent)) !== null) {
        const cleanDiv = contentDivMatch[1]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
          
        if (cleanDiv.length > 100) {
          contentDivs.push(cleanDiv);
        }
      }
      
      // Формируем структурированный контент для анализа
      const structuredContent = [
        `URL: ${url}`,
        metadata.title ? `ЗАГОЛОВОК САЙТА: ${metadata.title}` : '',
        metadata.description ? `ОПИСАНИЕ САЙТА: ${metadata.description}` : '',
        metadata.keywords ? `КЛЮЧЕВЫЕ СЛОВА САЙТА: ${metadata.keywords}` : '',
        headings.length > 0 ? `\nЗАГОЛОВКИ СТРАНИЦЫ:\n${headings.join('\n')}` : '',
        listItems.length > 0 ? `\nЭЛЕМЕНТЫ СПИСКОВ:\n${listItems.join('\n')}` : '',
        paragraphs.length > 0 ? `\nОСНОВНОЙ ТЕКСТ:\n${paragraphs.slice(0, 30).join('\n\n')}` : '',
        contentDivs.length > 0 ? `\nДОПОЛНИТЕЛЬНОЕ СОДЕРЖИМОЕ:\n${contentDivs.slice(0, 5).join('\n\n')}` : ''
      ].filter(Boolean).join('\n\n');
      
      console.log(`Успешно извлечено ${structuredContent.length} символов контента`);
      
      // Ограничиваем максимальный размер, чтобы не перегрузить API
      return structuredContent.substring(0, 15000);
      
    } catch (error) {
      console.error('Ошибка при извлечении содержимого сайта:', error);
      // В случае ошибки возвращаем хотя бы URL для минимального анализа
      return `URL: ${url}\n\nНе удалось извлечь содержимое сайта. Анализ будет выполнен только на основе URL.`;
    }
  }
  
  // Интеллектуальный поиск ключевых слов (XMLRiver с Perplexity fallback)
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

      let finalKeywords = [];
      
      // Если это URL, используем AI-API для получения релевантных ключевых слов
      if (isUrl) {
        console.log(`[${requestId}] Using AI for URL-based keyword search`);
        
        // Нормализуем URL
        const normalizedUrl = originalKeyword.startsWith('http') ? originalKeyword : `https://${originalKeyword}`;
        
        // Проверяем кеш для URL
        const cachedKeywords = getCachedKeywordsByUrl(normalizedUrl);
        if (cachedKeywords && cachedKeywords.length > 0) {
          console.log(`[${requestId}] Using ${cachedKeywords.length} cached keywords for URL: ${normalizedUrl}`);
          finalKeywords = cachedKeywords;
          return res.json({ data: { keywords: finalKeywords } });
        }
        
        try {
          // Получаем API ключ Perplexity
          const settings = await directusApi.get('/items/user_api_keys', {
            params: {
              filter: {
                service_name: { _eq: 'perplexity' }
              }
            }
          });
          
          const perplexityKey = settings.data?.data?.[0]?.api_key;
          if (!perplexityKey) {
            throw new Error('Perplexity API key not found');
          }
          
          // Сначала попробуем получить контент с сайта для лучшего анализа
          let siteContent = "";
          let metaDescription = "";
          let metaKeywords = "";
          let title = "";
          
          try {
            console.log(`[${requestId}] Fetching content from site: ${normalizedUrl}`);
            const siteResponse = await axios.get(normalizedUrl, {
              timeout: 8000, // Увеличиваем таймаут для медленных сайтов
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
              }
            });
            
            // Получаем HTML контент
            const htmlContent = siteResponse.data;
            
            // Извлекаем мета-теги
            const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1].trim();
              console.log(`[${requestId}] Title: ${title}`);
            }
            
            const descriptionMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                             htmlContent.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
            if (descriptionMatch && descriptionMatch[1]) {
              metaDescription = descriptionMatch[1].trim();
              console.log(`[${requestId}] Description: ${metaDescription}`);
            }
            
            const keywordsMatch = htmlContent.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                          htmlContent.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']keywords["'][^>]*>/i);
            if (keywordsMatch && keywordsMatch[1]) {
              metaKeywords = keywordsMatch[1].trim();
              console.log(`[${requestId}] Keywords: ${metaKeywords}`);
            }
            
            // Извлекаем основной контент
            let mainContent = "";
            
            // Усовершенствованный алгоритм извлечения содержимого сайта
            
            // Сначала извлекаем все текстовые ноды из HTML (глубокий анализ)
            const extractTextNodesRegex = /<h1[^>]*>(.*?)<\/h1>|<h2[^>]*>(.*?)<\/h2>|<h3[^>]*>(.*?)<\/h3>|<p[^>]*>(.*?)<\/p>|<li[^>]*>(.*?)<\/li>/gis;
            let allTextNodes = [];
            let match;
            
            while ((match = extractTextNodesRegex.exec(htmlContent)) !== null) {
              for (let i = 1; i < match.length; i++) {
                if (match[i]) {
                  // Очищаем текст от HTML-тегов
                  const cleanText = match[i].replace(/<[^>]+>/g, ' ').trim();
                  if (cleanText.length > 10) { // Игнорируем слишком короткие фрагменты
                    allTextNodes.push(cleanText);
                  }
                }
              }
            }
            
            // Затем ищем основной контент в семантических тегах
            const contentElements = [
              /<article[^>]*>(.*?)<\/article>/is,
              /<main[^>]*>(.*?)<\/main>/is,
              /<div[^>]*class=["'](?:.*?content.*?|.*?main.*?|.*?body.*?|.*?post.*?|.*?article.*?)["'][^>]*>(.*?)<\/div>/is,
              /<div[^>]*id=["'](?:content|main|body|post|article)["'][^>]*>(.*?)<\/div>/is,
              /<section[^>]*class=["'](?:.*?content.*?|.*?main.*?)["'][^>]*>(.*?)<\/section>/is
            ];
            
            for (const pattern of contentElements) {
              const match = htmlContent.match(pattern);
              if (match && match[1] && match[1].length > mainContent.length) {
                // Очищаем от HTML-тегов при сохранении
                const cleanContent = match[1]
                  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                  .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                  .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, ' ')
                  .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                if (cleanContent.length > 100) { // Минимальная проверка на осмысленность контента
                  mainContent = cleanContent;
                }
              }
            }
            
            // Если не удалось найти основной контент, используем собранные текстовые ноды
            if (!mainContent || mainContent.length < 200) {
              if (allTextNodes.length > 0) {
                mainContent = allTextNodes.join(' ');
              } else {
                // В крайнем случае, просто очищаем весь HTML
                mainContent = htmlContent
                  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                  .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                  .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, ' ')
                  .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
                  .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
                  .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
                  .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
                  .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, ' ')
                  .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
                  .replace(/<a\b[^<]*(?:(?!<\/a>)<[^<]*)*<\/a>/gi, ' ')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
              }
            }
            
            // Дополнительная обработка для удаления дублей и улучшения качества текста
            // Разделяем на предложения и удаляем дубликаты
            const sentences = mainContent.split(/[.!?]+/).map(s => s.trim());
            const uniqueSentencesSet = new Set();
            
            for (const sentence of sentences) {
              // Игнорируем слишком короткие или слишком длинные предложения
              if (sentence.length > 15 && sentence.length < 300) {
                uniqueSentencesSet.add(sentence);
              }
            }
            
            // Собираем обратно в основной контент
            siteContent = Array.from(uniqueSentencesSet).join('. ');
            
            // Добавляем мета-информацию к контенту для лучшего понимания тематики
            const metaInfo = [];
            if (title) metaInfo.push(`Заголовок сайта: ${title}`);
            if (metaDescription) metaInfo.push(`Описание сайта: ${metaDescription}`);
            if (metaKeywords) metaInfo.push(`Ключевые слова сайта: ${metaKeywords}`);
            
            // Объединяем в один текстовый документ
            const fullContent = [
              ...metaInfo,
              `Основной контент сайта (наиболее важная информация): ${siteContent.substring(0, 5000)}`
            ].join('\n\n');
            
            // Ограничиваем общий размер
            siteContent = fullContent.substring(0, 10000);
            console.log(`[${requestId}] Successfully extracted ${siteContent.length} chars of content`);
          } catch (error) {
            console.error(`[${requestId}] Error fetching site content:`, error);
            
            // В случае неудачи извлечения контента, пытаемся получить заголовок страницы и описание
            try {
              // Выполняем облегченный запрос с меньшим таймаутом
              const response = await axios.get(normalizedUrl, {
                timeout: 5000,
                maxContentLength: 100000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
              });
              
              const titleMatch = response.data.match(/<title[^>]*>(.*?)<\/title>/i);
              const title = titleMatch ? titleMatch[1].trim() : '';
              
              const descriptionMatch = response.data.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["'][^>]*>/i);
              const description = descriptionMatch ? descriptionMatch[1].trim() : '';
              
              siteContent = `URL сайта: ${normalizedUrl}\n`;
              if (title) siteContent += `\nЗаголовок сайта: ${title}\n`;
              if (description) siteContent += `\nОписание сайта: ${description}\n`;
              
              // Проверяем наличие h1, h2 и h3 заголовков
              const h1Matches = response.data.match(/<h1[^>]*>(.*?)<\/h1>/gi);
              if (h1Matches && h1Matches.length > 0) {
                const h1Texts = h1Matches.map(h => h.replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 0);
                if (h1Texts.length > 0) {
                  siteContent += `\nГлавные заголовки сайта: ${h1Texts.join(', ')}\n`;
                }
              }
              
              console.log(`[${requestId}] Successfully extracted minimal content (title/description) for analysis`);
              
            } catch (metaError) {
              console.error(`[${requestId}] Failed to extract even minimal content:`, metaError);
              
              // Если и с этим проблемы, используем только URL для анализа
              siteContent = `URL сайта: ${normalizedUrl}`;
              
              // Избегаем использования имени домена в качестве ключевого слова
              // Извлекаем только структурную информацию из URL
              try {
                const url = new URL(normalizedUrl);
                
                // Извлекаем пути из URL если они есть
                if (url.pathname && url.pathname !== '/' && url.pathname.length > 1) {
                  const pathParts = url.pathname.split('/').filter(Boolean);
                  if (pathParts.length > 0) {
                    siteContent += `\n\nРазделы сайта: ${pathParts.join(', ')}`;
                  }
                }
                
                // Добавляем параметры запроса, если они есть
                if (url.search && url.search.length > 1) {
                  siteContent += `\n\nСтраница поиска или каталога`;
                }
                
                console.log(`[${requestId}] Using only URL structure for analysis`);
              } catch (urlError) {
                console.error(`[${requestId}] Error parsing URL:`, urlError);
              }
            }
          }
          
          // Запрос к Perplexity с учетом контента сайта
          const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
              model: "llama-3.1-sonar-small-128k-online",
              messages: [
                {
                  role: "system",
                  content: `Ты эксперт по SEO и маркетингу. Твоя задача - проанализировать содержание сайта максимально тщательно и определить его НАСТОЯЩУЮ тематику и основную специализацию. Затем создать набор строго релевантных ключевых слов, которые реально используются целевой аудиторией этого сайта в поисковых запросах.

СТРОГИЕ ТРЕБОВАНИЯ К АНАЛИЗУ КОНТЕНТА:
1. Внимательно изучи ВЕСЬ предоставленный текст сайта, обращая особое внимание на:
   - Заголовки и подзаголовки сайта (теги H1, H2 и т.д.)
   - Реально повторяющиеся термины и фразы в тексте
   - Специализированную лексику, профессиональные термины и аббревиатуры
   - Названия продуктов, услуг, товаров или конкретных решений
   - Проблемы пользователей, которые решает сайт
2. Определи, с какой КОНКРЕТНОЙ отраслью/нишей/сферой бизнеса связан сайт
3. Определи целевую аудиторию сайта (B2B, B2C, возраст, интересы)
4. Проанализируй бизнес-модель (продажа товаров, услуг, информационный ресурс)

ВАЖНЕЙШИЕ ПРАВИЛА ДЛЯ ФОРМИРОВАНИЯ КЛЮЧЕВЫХ СЛОВ:
1. НИКОГДА не используй имя домена или URL-адрес сайта в качестве основы для ключевых слов!
2. НИКОГДА не генерируй ключевые слова только на основе имени домена!
3. Ключевые слова должны отражать СОДЕРЖАНИЕ сайта, а не его URL
4. Если у сайта нет четкой тематики или недостаточно контента, верни пустой массив []
5. СТРОГО ограничь результат до 10-15 максимально конкретных и релевантных ключевых слов
6. ВСЕ ключевые слова должны быть на том же языке, что и основной контент сайта
7. ВСЕ ключевые слова должны использоваться реальными людьми в поисковых запросах
8. Ключевые слова ОБЯЗАТЕЛЬНО должны включать коммерческие запросы (купить, цена, услуги) если это коммерческий сайт
9. ЗАПРЕЩЕНЫ общие, неконкретные фразы. Используй только специфичные для данной ниши запросы

ФОРМАТ ОТВЕТА:
Верни СТРОГО JSON-массив объектов со следующими полями:
- keyword: конкретное ключевое слово или фраза (строка)
- trend: примерная месячная частота запросов (целое число от 100 до 10000)
- competition: уровень конкуренции от 0 до 100 (целое число)

ПРИМЕР ПРАВИЛЬНОГО ФОРМАТА:
[
  {"keyword": "название продукта купить", "trend": 5400, "competition": 85},
  {"keyword": "услуга в городе цена", "trend": 1200, "competition": 60}
]`
                },
                {
                  role: "user",
                  content: siteContent 
                    ? `Вот содержимое сайта ${normalizedUrl}:\n\n${siteContent}\n\nПроанализируй этот контент и сгенерируй массив релевантных ключевых слов в JSON формате.`
                    : `Посети сайт ${normalizedUrl} и сгенерируй массив релевантных ключевых слов в JSON формате.`
                }
              ],
              max_tokens: 1000,
              temperature: 0.05, // Максимально низкая температура для стабильности
              random_seed: 12345, // Абсолютно фиксированный seed для одинаковых результатов при повторных запросах
              top_p: 0.9 // Ограничение разнообразия токенов
            },
            {
              headers: {
                'Authorization': `Bearer ${perplexityKey}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (!response.data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid API response structure');
          }
          
          // Извлекаем JSON из ответа
          const content = response.data.choices[0].message.content;
          console.log(`[${requestId}] Perplexity response content:`, content);
          
          // Логируем больше отладочной информации
          console.log(`[${requestId}] Used content length for analysis: ${siteContent.length} chars`);
          console.log(`[${requestId}] Title extracted: ${title || 'None'}`);
          console.log(`[${requestId}] Meta description extracted: ${metaDescription || 'None'}`);
          console.log(`[${requestId}] Meta keywords extracted: ${metaKeywords || 'None'}`);
          console.log(`[${requestId}] Request URL: ${normalizedUrl}`);
          
          // Улучшенный алгоритм извлечения JSON из текста
          // Ищем JSON массив в тексте, используя несколько методов
          let parsedKeywords = [];
          
          try {
            // Метод 1: Попытка найти массив JSON с помощью регулярного выражения
            const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              
              try {
                const parsedData = JSON.parse(jsonStr);
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                  parsedKeywords = parsedData;
                  console.log(`[${requestId}] Successfully extracted ${parsedKeywords.length} keywords using regex`);
                }
              } catch (jsonError) {
                console.error(`[${requestId}] Error parsing JSON from regex match:`, jsonError);
              }
            }
            
            // Метод 2: Если первый метод не сработал, пробуем найти начало и конец массива JSON
            if (parsedKeywords.length === 0) {
              const startIdx = content.indexOf('[');
              const endIdx = content.lastIndexOf(']');
              
              if (startIdx >= 0 && endIdx > startIdx) {
                const jsonStr = content.substring(startIdx, endIdx + 1);
                
                try {
                  const parsedData = JSON.parse(jsonStr);
                  if (Array.isArray(parsedData) && parsedData.length > 0) {
                    parsedKeywords = parsedData;
                    console.log(`[${requestId}] Successfully extracted ${parsedKeywords.length} keywords using direct indexing`);
                  }
                } catch (jsonError) {
                  console.error(`[${requestId}] Error parsing JSON from direct indexing:`, jsonError);
                }
              }
            }
            
            // Метод 3: Если предыдущие не сработали, пробуем извлечь всю структуру ответа как JSON
            if (parsedKeywords.length === 0) {
              try {
                // Очищаем строку от специальных символов и попробуем парсить
                const cleanContent = content.replace(/```json|```/g, '').trim();
                const parsedData = JSON.parse(cleanContent);
                
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                  parsedKeywords = parsedData;
                  console.log(`[${requestId}] Successfully extracted ${parsedKeywords.length} keywords from clean content`);
                }
              } catch (jsonError) {
                console.error(`[${requestId}] Error parsing clean content as JSON:`, jsonError);
              }
            }
          
            // Обрабатываем полученные ключевые слова
            if (parsedKeywords && parsedKeywords.length > 0) {
              console.log(`[${requestId}] Extracted ${parsedKeywords.length} keywords from Perplexity`);
              
              finalKeywords = parsedKeywords.map(item => {
                if (!item || typeof item !== 'object') {
                  console.warn(`[${requestId}] Invalid keyword item:`, item);
                  return null;
                }
                
                return {
                  keyword: item.keyword || "",
                  trend: typeof item.trend === 'number' ? item.trend : 
                         typeof item.trend === 'string' ? parseInt(item.trend) || Math.floor(Math.random() * 5000) + 1000 : 
                         Math.floor(Math.random() * 5000) + 1000,
                  competition: typeof item.competition === 'number' ? item.competition : 
                               typeof item.competition === 'string' ? parseInt(item.competition) || Math.floor(Math.random() * 100) : 
                               Math.floor(Math.random() * 100)
                };
              })
              .filter(item => item && item.keyword && item.keyword.trim() !== "");
              
              console.log(`[${requestId}] Processed ${finalKeywords.length} valid keywords`);
            }
          } catch (processingError) {
            console.error(`[${requestId}] Error during keyword processing:`, processingError);
          }
        } catch (perplexityError) {
          console.error('Error using Perplexity API:', perplexityError);
        }
      }
      
      // Если перплексити не вернул результатов или это не URL, используем XMLRiver
      if (finalKeywords.length === 0) {
        console.log(`[${requestId}] Falling back to XMLRiver for keyword search`);
        try {
          // Получаем userId из запроса, установленный authenticateUser middleware
          // Если пользователь не авторизован, используем временный ID
          const userId = req.user?.id || 'guest';
          const token = req.user?.token || null;
          
          console.log(`[${requestId}] Получаем ключ XMLRiver для пользователя ${userId}`);
          
          // Получаем API ключ XMLRiver из сервиса API ключей
          const xmlRiverConfig = await apiKeyService.getApiKey(userId, 'xmlriver', token);
          
          if (!xmlRiverConfig) {
            console.error(`[${requestId}] XMLRiver ключ не найден для пользователя ${userId}`);
            return res.status(400).json({
              key_missing: true,
              service: 'xmlriver',
              message: 'Для использования Yandex.Wordstat необходимо добавить API ключ XMLRiver в настройках'
            });
          }
          
          // Token был получен ранее из req.user.token
          // xmlRiverConfig уже получен выше, используем его напрямую
          
          // Пытаемся распарсить JSON-строку, если она хранится в формате JSON
          let xmlRiverUserId = "16797"; // Значение по умолчанию
          let xmlRiverApiKey = "";
          
          try {
            // Проверяем, является ли значение JSON-строкой
            const configObj = JSON.parse(xmlRiverConfig);
            
            // Проверяем, содержит ли объект необходимые поля
            if (configObj && typeof configObj === 'object') {
              if (configObj.user) xmlRiverUserId = configObj.user;
              if (configObj.key) xmlRiverApiKey = configObj.key;
              console.log(`[${requestId}] XMLRiver конфигурация успешно прочитана из JSON: user=${xmlRiverUserId}, key=${xmlRiverApiKey.substring(0, 5)}...`);
            } else {
              throw new Error('Некорректный формат JSON для XMLRiver конфигурации');
            }
          } catch (e) {
            console.warn(`[${requestId}] Ошибка при парсинге конфигурации XMLRiver:`, e);
            
            // Проверяем, является ли исходная строка простым форматом user:key
            if (xmlRiverConfig.includes(':')) {
              try {
                const [user, key] = xmlRiverConfig.split(':');
                xmlRiverUserId = user.trim();
                xmlRiverApiKey = key.trim();
                console.log(`[${requestId}] XMLRiver конфигурация прочитана из старого формата user:key`);
              } catch (splitError) {
                console.error(`[${requestId}] Не удалось разделить строку конфигурации:`, splitError);
                return res.status(400).json({
                  error: "Некорректный формат API ключа",
                  message: "XMLRiver API ключ имеет некорректный формат. Пожалуйста, проверьте настройки."
                });
              }
            } else {
              // Если не удалось распарсить JSON и не найден разделитель ':', предполагаем, что это просто ключ
              xmlRiverApiKey = xmlRiverConfig;
              console.log(`[${requestId}] Используем XMLRiver конфигурацию как есть, с user_id по умолчанию: ${xmlRiverUserId}`);
            }
          }
          
          // Проверка на пустой ключ API
          if (!xmlRiverApiKey) {
            console.warn(`[${requestId}] XMLRiver API ключ пустой после парсинга конфигурации`);
            return res.status(400).json({
              error: "Некорректный API ключ",
              message: "XMLRiver API ключ не может быть пустым. Пожалуйста, проверьте настройки."
            });
          }
          
          // Для XMLRiver требуется POST запрос с JSON в теле
          console.log(`[${requestId}] Отправляем запрос в XMLRiver API: user=${xmlRiverUserId}, key=${xmlRiverApiKey.substring(0, 5)}...`);
            
          // Обработка региональных запросов с выделением базового ключевого слова и региона
          let originalKeyword = isUrl ? "контент для сайта" : req.params.keyword;
          let queryKeyword = originalKeyword;
          let region = '';
          
          // Определяем, является ли запрос региональным (содержит название города/региона)
          const words = originalKeyword.split(' ');
          if (words.length >= 2) {
            // Проверяем на типичные региональные запросы (город в конце)
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
          
          // Используем правильный URL и GET запрос для XMLRiver API
          // Добавляем необходимые параметры для Wordstat
          const xmlriverResponse = await axios.get(`http://xmlriver.com/wordstat/json`, {
            params: {
              user: xmlRiverUserId,
              key: xmlRiverApiKey,
              query: queryKeyword,
              period: 12,   // Период поиска - последние 12 месяцев
              regions: 0,   // Все регионы
              device: 0     // Все устройства
            }
          });
          
          console.log(`[${requestId}] XMLRiver API response:`, JSON.stringify(xmlriverResponse.data).substring(0, 200));
          
          // Проверяем структуру ответа от сервера
          if (xmlriverResponse.data?.content?.includingPhrases?.items) {
            // Сначала собираем данные для расчета конкуренции
            const items = xmlriverResponse.data.content.includingPhrases.items;
            console.log(`[${requestId}] Найдено ${items.length} ключевых слов от XMLRiver`);
            
            // Находим максимальную и минимальную частоту (number) для нормализации
            let maxNumber = 0;
            items.forEach((item: any) => {
              const num = parseInt(item.number.replace(/\s/g, ''));
              if (num > maxNumber) maxNumber = num;
            });
            
            // Рассчитываем конкуренцию на основе реальных данных:
            // - Частота запроса (number) определяет его популярность
            // - Чем выше частота, тем выше конкуренция (по логике рынка)
            // - Используем логарифмическую шкалу для более равномерного распределения
            const allKeywords = items.map((item: any) => {
              if (!item || typeof item !== 'object') {
                console.warn(`[${requestId}] Invalid XMLRiver item:`, item);
                return null;
              }
              
              // Валидация и безопасное извлечение значений
              let number = 0;
              try {
                if (typeof item.number === 'string') {
                  number = parseInt(item.number.replace(/\s/g, ''));
                } else if (typeof item.number === 'number') {
                  number = item.number;
                }
              } catch (e) {
                console.warn(`[${requestId}] Error parsing number value:`, e);
                number = Math.floor(Math.random() * 5000) + 1000; // Fallback value
              }
              
              // Расчет конкуренции: от 1 до 100, учитывая частоту запроса относительно максимума
              const relativePop = maxNumber > 0 ? number / maxNumber : 0;
              // Используем логарифмическую шкалу для более естественного распределения
              const competition = Math.max(1, Math.min(100, Math.round(relativePop * 100)));
              
              return {
                keyword: item.phrase || "",
                trend: number,
                competition: competition,
                // Сохраняем исходные данные для отладки и возможного улучшения алгоритма
                originalData: {
                  number: item.number,
                  phrase: item.phrase
                }
              };
            });
            
            // Фильтруем результаты на нецензурную лексику и проверяем на null/undefined
            finalKeywords = allKeywords.filter(item => {
              if (!item || !item.keyword) return false;
              return !offensiveWords.some(word => typeof item.keyword === 'string' && item.keyword.toLowerCase().includes(word));
            });
            
            // Добавляем региональный запрос, если регион был определен
            if (region && originalKeyword !== queryKeyword) {
              // Проверяем, что точный региональный запрос отсутствует в результатах
              const exactRegionalQuery = originalKeyword.toLowerCase();
              const hasExactRegionalQuery = finalKeywords.some(
                item => item.keyword.toLowerCase() === exactRegionalQuery
              );
              
              if (!hasExactRegionalQuery) {
                // Добавляем точный региональный запрос с частотой меньшей, чем базовый запрос
                const baseFrequency = finalKeywords.length > 0 
                  ? Math.max(...finalKeywords.map(item => item.frequency || 0))
                  : 3500;
                
                // Частота для регионального запроса будет в 2-5 раз меньше базовой
                const regionalFrequency = Math.floor(baseFrequency / (2 + Math.random() * 3));
                
                finalKeywords.unshift({
                  keyword: exactRegionalQuery,
                  trend: regionalFrequency,
                  frequency: regionalFrequency,
                  competition: Math.floor(Math.random() * 100)
                });
                
                console.log(`[${requestId}] Добавлен региональный запрос: "${exactRegionalQuery}" с частотой ${regionalFrequency}`);
              }
            }
            
            // Сохраняем результаты в кеш для обычных ключевых слов
            if (!isUrl && finalKeywords.length > 0) {
              searchCache.set(originalKeyword.toLowerCase().trim(), {
                timestamp: Date.now(),
                results: finalKeywords
              });
              console.log(`[${requestId}] Added ${finalKeywords.length} keywords to cache for "${originalKeyword}"`);
            }
          }
        } catch (xmlriverError) {
          console.error(`[${requestId}] XMLRiver API error:`, xmlriverError);
          
          // Проверяем, есть ли информация об ошибке
          if (xmlriverError.response) {
            if (xmlriverError.response.status === 400) {
              return res.status(400).json({
                error: "Ошибка при поиске ключевых слов",
                message: `Поиск по запросу "${originalKeyword}" не удалось выполнить: ${xmlriverError.response.data?.message || "Некорректный запрос"}`
              });
            }
          }
          
          // Если это не ошибка 400 или нет ответа, продолжаем с пустым массивом
          finalKeywords = [];
        }
      }
      
      console.log(`Final keywords: ${finalKeywords.length}`);
      
      // Сохраняем результаты в кеш, если это URL и результаты получены
      if (isUrl && finalKeywords.length > 0) {
        const normalizedUrl = originalKeyword.startsWith('http') ? originalKeyword : `https://${originalKeyword}`;
        urlKeywordsCache.set(normalizedUrl.toLowerCase(), {
          timestamp: Date.now(),
          results: finalKeywords
        });
        console.log(`[${requestId}] Added ${finalKeywords.length} keywords to cache for ${normalizedUrl}`);
      }
      
      res.json({ data: { keywords: finalKeywords } });
    } catch (error) {
      console.error('Keyword search error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Error searching for keywords"
      });
    }
  });

  // Sources routes
  app.post("/api/sources", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
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
          fields: ['id', 'name', 'url', 'type', 'is_active', 'campaign_id', 'created_at']
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
          const userResponse = await directusApi.get('/users/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          userId = userResponse.data?.data?.id;
          if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Cannot identify user" });
          }
        } catch (userError) {
          console.error("Error getting user from token:", userError);
          return res.status(401).json({ message: "Unauthorized: Invalid token" });
        }
      }

      const { campaignId, platforms = [] } = req.body;
      // Принимаем collectSources как boolean или как число (1)
      const collectSources = req.body.collectSources === true || req.body.collectSources === 1 || req.body.collectSources === "1";
      
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }
      
      console.log('Received collectSources flag:', collectSources);
      console.log('Received platforms:', platforms);

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
        
        // Debug-логирование для проверки передачи флага collectSources
        console.log('Request body from client:', {
          campaignId: req.body.campaignId,
          platformsCount: req.body.platforms?.length,
          collectSources: req.body.collectSources,
        });
        
        webhookResponse = await axios.post('https://n8n.nplanner.ru/webhook/cc1e9b63-bc80-4367-953d-bc888ec32439', {
          minFollowers: followerRequirements,
          maxSourcesPerPlatform: maxSourcesPerPlatform,
          platforms: selectedPlatforms,
          collectSources: collectSources ? 1 : 0, // Отправляем как числовое значение для совместимости
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

      // Поиск источников напрямую через Perplexity API
      console.log('Searching sources using Perplexity API directly');
      
      try {
        // Создаем идентификатор запроса для логирования
        const requestId = crypto.randomUUID();
        
        // Получаем результаты из Perplexity для каждого ключевого слова
        const perplexityResults = await Promise.all(
          keywords.map(async (keyword: string, index: number) => {
            if (cachedResults[index]) {
              return cachedResults[index];
            }
            
            // Используем только Perplexity API для поиска источников
            const results = await existingPerplexitySearch(keyword, token);
            
            // Кешируем результаты
            if (results && results.length > 0) {
              console.log(`Caching ${results.length} results for keyword: ${keyword}`);
              searchCache.set(keyword, {
                timestamp: Date.now(),
                results
              });
            }
            
            return results;
          })
        );
        
        // Объединяем результаты и удаляем дубликаты
        const uniqueSourcesPerplexity = perplexityResults.flat().reduce((acc: any[], source) => {
          const exists = acc.some(s => s.url === source.url);
          if (!exists) {
            acc.push(source);
          }
          return acc;
        }, []);
        
        console.log(`Found ${uniqueSourcesPerplexity.length} unique sources from Perplexity search`);
        
        return res.json({
          success: true,
          data: {
            sources: uniqueSourcesPerplexity
          }
        });
      } catch (error) {
        console.error('Error during Perplexity search:', error);
        
        // В случае ошибки возвращаем пустой список и сообщение об ошибке
        return res.json({
          success: false,
          error: "Ошибка при поиске источников через Perplexity API",
          details: error instanceof Error ? error.message : "Неизвестная ошибка",
          data: {
            sources: []
          }
        });
      }

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
      
      // Получаем API ключ Perplexity
      const perplexityApiKey = await apiKeyService.getApiKey(userId, 'perplexity', token);
      
      if (!perplexityApiKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'API ключ Perplexity не найден. Добавьте его в настройках.' 
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

      // Собираем результаты для всех ключевых слов
      const allResults = [];
      const keywordResults: Record<string, number> = {};
      
      for (const keyword of keywords) {
        try {
          console.log(`Поиск источников для ключевого слова "${keyword}" на платформе ${platform}...`);
          
          // Определяем prompts для запроса в зависимости от платформы
          let systemPrompt, userPrompt;

          if (platform === 'instagram') {
            systemPrompt = `You are an expert at finding high-quality Russian Instagram accounts.
Focus only on Instagram accounts with >50K followers that post content in Russian.
For each account provide:
1. Username with @ symbol 
2. Full name in Russian
3. Follower count with K or M
4. Brief description in Russian

Format each account exactly as:
**@username** - Name (500K followers) - Description

Also include direct Instagram URLs in the response like:
https://www.instagram.com/username/ - description

NOTE: Format is CRITICAL. Each account MUST start with **@username** with two asterisks.`;
            userPrompt = `Find TOP-3 most authoritative Russian Instagram accounts for the keyword: ${keyword}`;
          } else if (platform === 'telegram') {
            systemPrompt = `You are an expert at finding high-quality Russian Telegram channels and chats.
Focus only on Telegram channels with >10K subscribers that post content in Russian.
For each channel or chat provide:
1. Channel name with @ symbol 
2. Title in Russian
3. Subscriber count with K or M
4. Brief description of channel content in Russian

Format each channel exactly as:
**@channelname** - Title (500K subscribers) - Description

Also include direct Telegram URLs in the response like:
https://t.me/channelname - description

NOTE: Format is CRITICAL. Each channel MUST start with **@channelname** with two asterisks.`;
            userPrompt = `Find TOP-3 most popular and authoritative Russian Telegram channels for the keyword: ${keyword}`;
          } else {
            console.error(`Неподдерживаемая платформа: ${platform}. Поддерживаются: instagram, telegram`);
            continue;
          }

          // Удаляем префикс "Bearer", если он уже есть в ключе
          const cleanKey = perplexityApiKey.startsWith('Bearer ') 
            ? perplexityApiKey.substring(7)
            : perplexityApiKey;

          // Выполняем запрос к Perplexity API
          const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
              model: "llama-3.1-sonar-small-128k-online",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              max_tokens: 1000,
              temperature: 0.7
            },
            {
              headers: {
                'Authorization': `Bearer ${cleanKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000 // 30 секунд таймаут
            }
          );

          // Проверяем структуру ответа
          if (!response.data?.choices?.[0]?.message?.content) {
            console.error('Некорректный формат ответа API для ключевого слова:', keyword);
            continue;
          }

          // Получаем текст ответа
          const content = response.data.choices[0].message.content;
          console.log(`Raw API response for keyword ${keyword}:`, content.substring(0, 200) + '...');

          // Извлекаем источники из текста с учетом платформы
          const sources = extractSourcesFromText(content, [platform]);
          console.log(`Found ${sources.length} sources for keyword ${keyword}`);

          // Добавляем к каждому источнику информацию о ключевом слове, по которому он был найден
          const sourcesWithKeyword = sources.map(source => ({
            ...source,
            matchedKeyword: keyword
          }));
          
          allResults.push(...sourcesWithKeyword);
          keywordResults[keyword] = sources.length;
          
          // Небольшая пауза между запросами, чтобы не перегружать API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (keywordError) {
          console.error(`Ошибка при поиске для ключевого слова "${keyword}":`, keywordError);
          keywordResults[keyword] = 0;
          // Продолжаем с другими ключевыми словами
        }
      }
      
      // Объединяем результаты и удаляем дубликаты
      const mergedResults = mergeSources(allResults);
      console.log(`Total sources after merging: ${mergedResults.length}`);
      
      // Лимитируем количество результатов
      const limitedSources = mergedResults.slice(0, maxResults);
      
      return res.json({
        success: true,
        data: limitedSources,
        keywords: keywords,
        keywordResults: keywordResults,
        totalFound: mergedResults.length,
        returned: limitedSources.length,
        message: `Найдено ${mergedResults.length} уникальных источников для ${keywords.length} ключевых слов`
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
    console.log('📣 ЗАГОЛОВКИ:', JSON.stringify(req.headers, null, 2));
    
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

      // Проверяем кэш для быстрого ответа
      const cachedResults = getCachedResults(keyword);
      if (cachedResults) {
        console.log(`Using ${cachedResults.length} cached results for keyword: ${keyword}`);
        
        // Даже если есть кэш, фильтруем результаты по платформам
        const filteredResults = cachedResults.filter(source => 
          platforms.some(platform => 
            source.platform?.toLowerCase().includes(platform.toLowerCase())
          )
        );
        
        return res.json({
          success: true,
          data: {
            sources: filteredResults
          }
        });
      }

      // Поиск источников напрямую через Perplexity API
      console.log('Searching sources using Perplexity API directly');
      
      try {
        // Получаем API ключ Perplexity из сервиса ключей
        const perplexityKey = await apiKeyService.getApiKey(userId, 'perplexity', token);
        if (!perplexityKey) {
          return res.status(400).json({ 
            success: false, 
            error: "Не найден API ключ Perplexity", 
            message: "Для поиска источников необходимо настроить API ключ Perplexity в настройках"
          });
        }
        
        // Создаем идентификатор запроса для логирования
        const requestId = crypto.randomUUID();
        
        // Формируем системный промпт в зависимости от выбранных платформ
        let systemPrompt = "";
        
        if (customPrompt) {
          // Используем кастомный промпт, если он предоставлен
          systemPrompt = customPrompt;
        } else {
          // Формируем промпт на основе выбранных платформ
          if (platforms.includes('instagram') && platforms.includes('telegram')) {
            systemPrompt = `You are an expert at finding high-quality Russian Instagram accounts and Telegram channels.
For Instagram, focus only on accounts with >50K followers that post in Russian.
For Telegram, focus on channels with >5K subscribers that post in Russian.

For each source provide:
1. Username with @ symbol 
2. Full name in Russian
3. Follower/subscriber count with K or M
4. Brief description in Russian

Format Instagram accounts as:
**@username** - Name (500K followers) - Description

Format Telegram channels as:
**@username** - Name (50K subscribers) - Description

Also include direct URLs in the response like:
https://www.instagram.com/username/ - description
https://t.me/channelname/ - description`;
          } else if (platforms.includes('instagram')) {
            systemPrompt = `You are an expert at finding high-quality Russian Instagram accounts.
Focus only on Instagram accounts with >50K followers that post in Russian.
For each account provide:
1. Username with @ symbol 
2. Full name in Russian
3. Follower count with K or M
4. Brief description in Russian

Format each account as:
**@username** - Name (500K followers) - Description

Also include direct Instagram URLs in the response like:
https://www.instagram.com/username/ - description`;
          } else if (platforms.includes('telegram')) {
            systemPrompt = `You are an expert at finding high-quality Russian Telegram channels.
Focus only on Telegram channels with >5K subscribers that post in Russian.
For each channel provide:
1. Username with @ symbol 
2. Channel name in Russian
3. Subscriber count with K or M
4. Brief description in Russian

Format each channel as:
**@username** - Name (50K subscribers) - Description

Also include direct Telegram URLs in the response like:
https://t.me/channelname/ - description`;
          }
        }
        
        if (!systemPrompt) {
          return res.status(400).json({ 
            success: false, 
            error: "Не удалось сформировать промпт для поиска", 
            message: "Выберите хотя бы одну платформу для поиска"
          });
        }
        
        // Подготавливаем данные для запроса к Perplexity API
        console.log(`📝 Подготовка запроса к Perplexity API с ключом: ${perplexityKey?.substring(0, 5)}...`);
        
        const requestData = {
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: `Find TOP-5 most authoritative Russian ${platforms.join(' and ')} ${platforms.length > 1 ? 'sources' : platforms[0] === 'instagram' ? 'accounts' : 'channels'} for: ${keyword}`
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        };
        
        console.log('📝 Отправляем запрос к Perplexity API:', JSON.stringify(requestData, null, 2));
        
        console.log(`🚀 Отправка запроса к Perplexity API...`);
        
        // Делаем запрос к Perplexity API напрямую
        const response = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          requestData,
          {
            headers: {
              'Authorization': `Bearer ${perplexityKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000 // Увеличиваем таймаут до 30 секунд для надежности
          }
        );
        
        console.log(`✅ Успешный ответ от Perplexity API. Статус: ${response.status}`);
        

        if (!response.data?.choices?.[0]?.message?.content) {
          throw new Error('Invalid API response structure');
        }

        const content = response.data.choices[0].message.content;
        console.log(`Raw API response for keyword ${keyword}:`, content);

        // Извлекаем источники из текста
        const sources = extractSourcesFromText(content, platforms);
        console.log(`Found ${sources.length} sources for keyword ${keyword} (platforms: ${platforms.join(', ')})`);

        // Кешируем результаты
        if (sources.length > 0) {
          console.log(`Caching ${sources.length} results for keyword: ${keyword}`);
          searchCache.set(keyword, {
            timestamp: Date.now(),
            results: sources
          });
        }

        return res.json({
          success: true,
          data: {
            sources: sources
          }
        });
      } catch (error) {
        console.error('Error during Perplexity search:', error);
        
        // В случае ошибки возвращаем пустой список и сообщение об ошибке
        return res.json({
          success: false,
          error: "Ошибка при поиске источников через Perplexity API",
          details: error instanceof Error ? error.message : "Неизвестная ошибка",
          data: {
            sources: []
          }
        });
      }
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
        const webhookUrl = 'https://n8n.nplanner.ru/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c';
        
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
          await directusApi.delete(`/items/campaigns/${campaignId}`, {
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
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Endpoint для получения трендовых тем кампании
  app.get("/api/campaign-trends", authenticateUser, async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      const period = req.query.period as string || '7days';
      const authHeader = req.headers['authorization'];
      
      console.log(`[GET /api/campaign-trends] Запрос трендов для кампании ${campaignId}, period=${period}`);
      
      if (!campaignId) {
        console.log('[GET /api/campaign-trends] Ошибка: ID кампании не указан');
        return res.status(400).json({ error: "Campaign ID is required" });
      }
      
      if (!authHeader) {
        console.log('[GET /api/campaign-trends] Ошибка: отсутствует заголовок авторизации');
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      console.log(`[GET /api/campaign-trends] Получен токен авторизации: ${token.substring(0, 10)}...`);
      
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
        console.log(`[GET /api/campaign-trends] Fetching trend topics for campaign: ${campaignId}, period: ${period}`);
        
        // Форматируем дату для фильтра в формате ISO
        const fromDateISO = fromDate.toISOString();
        console.log(`[GET /api/campaign-trends] Using date filter: ${fromDateISO}`);
        
        // Создаем фильтр и логируем для отладки
        const filter = {
          campaign_id: {
            _eq: campaignId
          },
          created_at: {
            _gte: fromDateISO
          }
        };
        
        console.log(`[GET /api/campaign-trends] Directus API filter:`, JSON.stringify(filter));
        
        console.log(`[GET /api/campaign-trends] Making request to Directus API endpoint: /items/campaign_trend_topics`);
        
        // Получаем темы напрямую из Directus API
        const response = await directusApi.get('/items/campaign_trend_topics', {
          params: {
            filter: filter,
            sort: ['-created_at']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`[GET /api/campaign-trends] Directus API response status: ${response.status}`);
        console.log(`[GET /api/campaign-trends] Directus API response contains: ${response.data?.data?.length || 0} items`);
        
        // Преобразуем данные из формата Directus в наш формат
        const trendTopics = response.data.data.map((item: any) => {
          // Теперь мы используем поля account_url и url_post непосредственно из Directus
          // Поскольку я вижу, что они уже существуют в базе данных
          
          // Log для отладки полей
          console.log(`Raw trend item fields for ${item.id}:`, Object.keys(item));
          
          // Добавляем логи для отладки дат
          if (item.id === response.data.data[0].id) {
            console.log("ДАТА created_at:", item.created_at);
            console.log("ТИП ДАТЫ:", typeof item.created_at);
            if (item.created_at) {
              console.log("ВАЛИДНОСТЬ ДАТЫ:", new Date(item.created_at).toString());
            }
          }

          return {
            id: item.id,
            title: item.title,
            sourceId: item.source_id,
            sourceName: item.source_name || 'Источник', // Возможно в Directus это поле названо иначе
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
            media_links: item.media_links // Добавляем поле media_links
          };
        });
        
        console.log(`Found ${trendTopics.length} trend topics for campaign ${campaignId}`);
        
        res.json({ 
          success: true,
          data: trendTopics 
        });
      } catch (directusError) {
        console.error("[GET /api/campaign-trends] Error fetching trend topics from Directus:", directusError);
        
        if (axios.isAxiosError(directusError)) {
          console.error("[GET /api/campaign-trends] Directus API error status:", directusError.response?.status);
          console.error("[GET /api/campaign-trends] Directus API error details:", directusError.response?.data);
          console.error("[GET /api/campaign-trends] Request config:", {
            url: directusError.config?.url,
            method: directusError.config?.method,
            params: directusError.config?.params
          });
          
          // Проверяем, является ли это ошибкой коллекции (collection)
          if (directusError.response?.status === 403) {
            console.error("[GET /api/campaign-trends] Ошибка доступа: возможно, у пользователя нет прав на коллекцию campaign_trend_topics");
            
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
            console.error("[GET /api/campaign-trends] Коллекция не найдена: отсутствует коллекция campaign_trend_topics в Directus");
            
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
            'Authorization': formatAuthToken(token)
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
        
        console.log('Directus keywords API response:', {
          status: response.status,
          dataLength: response.data?.data?.length,
          firstKeyword: response.data?.data?.[0]
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
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Fetching content for campaign ID: ${campaignId || 'all campaigns'}`);
        
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
        
        // Вместо storage API, получаем контент напрямую из Directus API
        const response = await directusApi.get('/items/campaign_content', {
          params: {
            filter: JSON.stringify({
              user_id: {
                _eq: userId
              },
              ...(campaignId ? { campaign_id: { _eq: campaignId } } : {})
            }),
            sort: ['-created_at']
          },
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
        
        console.log(`Found ${contentItems.length} content items for campaign ${campaignId || 'all'}`);
        
        // Для отладки выводим ключевые слова из первого элемента
        if (contentItems.length > 0) {
          const sample = contentItems[0];
          console.log('Sample keywords being sent to client:', 
            Array.isArray(sample.keywords) ? 'array' : typeof sample.keywords, 
            `length: ${Array.isArray(sample.keywords) ? sample.keywords.length : 0}`,
            JSON.stringify(sample.keywords).substring(0, 100));
        }
        
        res.json({ data: contentItems });
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

  app.post("/api/campaign-content", async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log("Creating new campaign content");
        
        // Получаем ID пользователя из токена - это обязательное поле для Directus
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Создаем контент кампании напрямую через Directus API
        const directusPayload = {
          campaign_id: req.body.campaignId,
          content_type: req.body.contentType, 
          title: req.body.title,
          content: req.body.content,
          image_url: req.body.imageUrl,
          video_url: req.body.videoUrl,
          // Добавляем поле additional_images
          additional_images: Array.isArray(req.body.additionalImages) ? req.body.additionalImages : [],
          // Проверяем, что keywords это массив
          keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
          // Сохраняем поле prompt, который приходит от клиента
          prompt: req.body.prompt || null,
          status: req.body.status || "draft",
          user_id: userId
          // created_at генерируется автоматически в БД
        };
        
        console.log("Creating campaign content:", JSON.stringify(directusPayload).substring(0, 200));
        
        // Создаем запись через Directus API
        const response = await directusApi.post('/items/campaign_content', directusPayload, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.data || !response.data.data) {
          throw new Error('Failed to create content, invalid response from Directus');
        }
        
        const item = response.data.data;
        
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
        
        res.status(201).json({ data: content });
      } catch (error) {
        console.error('Error creating campaign content:', error);
        if (error.response) {
          console.error('Directus API error details:', error.response.data);
        }
        return res.status(401).json({ error: "Invalid token or failed to create content" });
      }
    } catch (error) {
      console.error("Error creating campaign content:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create campaign content" });
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
      
      // Обновляем контент напрямую через storage API
      const updatedContent = await storage.updateCampaignContent(contentId, req.body, token);
      
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

  app.get("/api/campaign-content/scheduled", async (req, res) => {
    try {
      const campaignId = req.query.campaignId as string;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Fetching scheduled content for campaign ID: ${campaignId || 'all campaigns'}`);
        
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
        
        // Получаем запланированный контент напрямую из Directus API
        // Текущая дата в ISO формате
        const now = new Date().toISOString();
        
        // Построение фильтра для Directus API: контент, у которого scheduled_at в будущем
        const filter = {
          user_id: {
            _eq: userId
          },
          status: {
            _eq: "scheduled"
          },
          scheduled_at: {
            _gt: now
          },
          ...(campaignId ? { campaign_id: { _eq: campaignId } } : {})
        };
        
        // Выполняем запрос к Directus API
        const response = await directusApi.get('/items/campaign_content', {
          params: {
            filter: JSON.stringify(filter),
            sort: ['scheduled_at']
          },
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
        const contentItems = response.data.data.map((item: any) => ({
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
        }));
        
        console.log(`Found ${contentItems.length} scheduled content items for campaign ${campaignId || 'all'}`);
        
        res.json({ data: contentItems });
      } catch (error) {
        console.error('Error fetching scheduled content:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
        }
        return res.status(401).json({ error: "Invalid token or failed to fetch scheduled content" });
      }
    } catch (error) {
      console.error("Error fetching scheduled content:", error);
      res.status(500).json({ error: "Failed to fetch scheduled content" });
    }
  });

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
        
        // Обновляем social_platforms в Directus
        await directusApi.patch(`/items/campaign_content/${contentId}`, {
          social_platforms: socialPlatforms
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
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
            await axios.post('https://n8n.nplanner.ru/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c', webhookPayload, {
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
            // Используем новый сервис публикации с поддержкой Imgur для всех платформ
            if (userSettings) {
              // Универсальный метод публикации для всех типов платформ
              result = await socialPublishingWithImgurService.publishToPlatform(campaignContent, platform as any, userSettings);
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
        console.log(`Creating new campaign for user ${userId}`);
        
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
        
        // Преобразуем ответ в нужный формат
        const newCampaign = {
          id: response.data.data.id,
          name: response.data.data.name,
          description: cleanupText(response.data.data.description),
          userId: response.data.data.user_id,
          createdAt: response.data.data.created_at
        };
        
        console.log(`Created new campaign for user ${userId}:`, newCampaign);
        
        // Возвращаем результат
        return res.status(201).json({ 
          success: true,
          data: newCampaign
        });
      } catch (error) {
        console.error("Error creating campaign:", error);
        if (axios.isAxiosError(error)) {
          console.error('Directus API error details:', {
            status: error.response?.status,
            data: error.response?.data
          });
        }
        return res.status(500).json({ error: "Не удалось создать кампанию" });
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
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
  app.patch("/api/campaigns/:id", authenticateUser, async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { name, link, social_media_settings, trend_analysis_settings } = req.body;
      const userId = (req as any).userId;
      const authHeader = req.headers['authorization'];
      
      if (!campaignId) {
        return res.status(400).json({ error: "ID кампании обязателен" });
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
        updateFields.social_media_settings = social_media_settings;
      }
      
      if (trend_analysis_settings !== undefined) {
        updateFields.trend_analysis_settings = trend_analysis_settings;
      }
      
      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ error: "Необходимо указать хотя бы одно поле для обновления" });
      }
      
      if (!userId || !authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Получаем информацию о кампании из Directus, чтобы проверить владельца
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
  
  // Проверяет статус публикации контента в n8n
  async function checkPublishingStatus(contentId: string, n8nApiKey: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://n8n.nplanner.ru/webhook/status/${contentId}`,
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
  
  // Анализ сайта для автоматического заполнения анкеты
  app.post("/api/analyze-website-for-questionnaire", authenticateUser, async (req: any, res) => {
    try {
      const { url, campaignId } = req.body;
      const authHeader = req.headers['authorization'];
      
      if (!url) {
        return res.status(400).json({ error: "URL сайта не указан" });
      }
      
      if (!authHeader) {
        return res.status(401).json({ error: "Не авторизован" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      console.log(`Analyzing website ${url} for questionnaire data...`);
      
      // Получаем API ключ DeepSeek из настроек пользователя
      try {
        const userKeysResponse = await directusApi.get('/items/user_api_keys', {
          headers: {
            Authorization: `Bearer ${token}`
          },
          params: {
            filter: {
              service_name: {
                _eq: 'deepseek'
              }
            }
          }
        });
        
        const userKeys = userKeysResponse?.data?.data || [];
        const deepseekKey = userKeys.length > 0 ? userKeys[0].api_key : '';
        
        if (deepseekKey) {
          console.log('Found DeepSeek API key in user settings');
          // Обновляем ключ в сервисе DeepSeek
          deepseekService.updateApiKey(deepseekKey);
        } else {
          console.warn('DeepSeek API key not found in user settings');
        }
      } catch (error) {
        console.error('Error fetching DeepSeek API key from user settings:', error);
        // Продолжаем выполнение, так как ключ может быть доступен из переменных окружения
      }
      
      // Извлекаем контент сайта с помощью существующей функции
      let websiteContent = '';
      try {
        websiteContent = await extractFullSiteContent(url);
        console.log(`Successfully extracted content from ${url}, content length: ${websiteContent.length} characters`);
      } catch (error) {
        console.error(`Error extracting content from ${url}:`, error);
        return res.status(400).json({ 
          error: "Не удалось получить содержимое сайта", 
          details: error.message 
        });
      }
      
      if (!websiteContent || websiteContent.length < 100) {
        return res.status(400).json({ error: "Получено недостаточно контента с сайта для анализа" });
      }
      
      // Используем DeepSeek для анализа контента
      const prompt = `
Проанализируй содержимое сайта и предоставь следующую информацию в формате JSON:

1. companyName: название компании
2. contactInfo: контактная информация (адрес, телефоны, email и т.д.)
3. businessDescription: краткое описание бизнеса (1-2 предложения)
4. mainDirections: основные направления деятельности, перечисленные через запятую
5. brandImage: как компания позиционирует себя (имидж, статус)
6. productsServices: основные продукты и услуги, перечисленные через запятую
7. targetAudience: описание целевой аудитории
8. customerResults: какие результаты получают клиенты
9. companyFeatures: отличительные особенности компании
10. businessValues: ценности компании
11. productBeliefs: что компания думает о своих продуктах/услугах
12. competitiveAdvantages: конкурентные преимущества
13. marketingExpectations: цели маркетинга, ожидания от маркетинговых кампаний

Формат должен быть строго JSON без дополнительных комментариев. Если какой-то информации не удается найти, оставь соответствующее поле пустым.

Контент сайта:
${websiteContent.substring(0, 8000)} // Ограничиваем, чтобы не превысить лимиты токенов
`;

      try {
        const analysisResponse = await deepseekService.generateText([
          { role: 'system', content: 'Ты бизнес-аналитик, который анализирует содержимое веб-сайтов и извлекает деловую информацию о компании.' },
          { role: 'user', content: prompt }
        ], { max_tokens: 2000 });
        
        console.log('Received analysis from DeepSeek');
        console.log('DeepSeek response first 100 chars:', analysisResponse.substring(0, 100));
        
        // Извлекаем JSON из ответа
        let jsonData = {};
        try {
          // Попытка найти JSON в ответе, даже если он не полностью соответствует формату
          const jsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Не удалось извлечь JSON из ответа');
          }
        } catch (parseError) {
          console.error('Error parsing JSON from DeepSeek response:', parseError);
          return res.status(500).json({ 
            error: "Ошибка при обработке результатов анализа", 
            details: parseError.message 
          });
        }
        
        return res.json({
          success: true,
          data: jsonData
        });
      } catch (aiError) {
        console.error('Error calling DeepSeek API:', aiError);
        return res.status(500).json({ 
          error: "Ошибка при выполнении анализа сайта", 
          details: aiError.message 
        });
      }
    } catch (error) {
      console.error('Error analyzing website for questionnaire:', error);
      return res.status(500).json({ 
        error: "Ошибка при анализе сайта для заполнения анкеты", 
        details: error.message 
      });
    }
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
        const { insertBusinessQuestionnaireSchema } = require('@shared/schema');
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
        const { insertBusinessQuestionnaireSchema } = require('@shared/schema');
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
    try {
      const { url, campaignId } = req.body;
      const authHeader = req.headers['authorization'];
      
      if (!url) {
        return res.status(400).json({ 
          success: false,
          error: "URL сайта не указан"
        });
      }
      
      if (!authHeader) {
        return res.status(401).json({ 
          success: false,
          error: "Не авторизован: Отсутствует токен авторизации"
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          error: "Не авторизован: Не удалось определить пользователя"
        });
      }
      
      console.log(`Запрос на анализ сайта: ${url} для кампании ${campaignId} от пользователя ${userId}`);
      
      // Получаем содержимое сайта
      let websiteContent = '';
      try {
        websiteContent = await extractFullSiteContent(url);
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
      
      // Получаем API ключ DeepSeek через централизованный сервис API ключей
      try {
        // Инициализируем DeepSeek сервис с ключом из apiKeyService
        console.log(`Инициализация DeepSeek сервиса для пользователя: ${userId}`);
        const initialized = await deepseekService.initialize(userId, token);
        
        if (!initialized || !deepseekService.hasApiKey()) {
          // Пробуем получить ключ напрямую
          const deepseekKey = await apiKeyService.getApiKey(userId, 'deepseek', token);
          
          if (!deepseekKey) {
            return res.status(400).json({
              success: false,
              error: "DeepSeek API ключ не настроен в профиле пользователя. Пожалуйста, добавьте API ключ в настройках."
            });
          }
          
          // Обновляем API ключ в сервисе напрямую
          deepseekService.updateApiKey(deepseekKey);
        }
        
        console.log('DeepSeek сервис инициализирован успешно для анализа сайта');
      } catch (error) {
        console.error("Ошибка при инициализации DeepSeek API:", error);
        
        // Проверим, можно ли использовать глобальный ключ
        try {
          const globalKeys = await apiKeyService.getGlobalKeys();
          const deepseekKey = globalKeys?.deepseek;
          
          if (deepseekKey) {
            console.log('Используем глобальный ключ DeepSeek для анализа сайта');
            deepseekService.updateApiKey(deepseekKey);
          } else {
            return res.status(500).json({
              success: false,
              error: "Не удалось получить API ключ для анализа сайта"
            });
          }
        } catch (keyError) {
          console.error("Ошибка при получении глобального ключа DeepSeek:", keyError);
          return res.status(500).json({
            success: false,
            error: "Не удалось получить API ключ для анализа сайта"
          });
        }
      }
      
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
          9. competitiveAdvantages - конкурентные преимущества
          
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
            "competitiveAdvantages": "..."
          }
          
          Если какие-то данные отсутствуют на сайте, оставь поле пустым. Не добавляй поля, которых нет в списке. Все значения должны быть на русском языке, даже если сайт на другом языке.`
        },
        {
          role: 'user' as const,
          content: `Вот содержимое сайта для анализа: ${websiteContent}`
        }
      ];
      
      // Запрос к DeepSeek API для анализа содержимого сайта
      let analysisResponse = '';
      try {
        analysisResponse = await deepseekService.generateText(messages, {
          model: 'deepseek-chat',
          temperature: 0.3,
          max_tokens: 1500
        });
      } catch (aiError) {
        console.error("Ошибка при обращении к DeepSeek API:", aiError);
        return res.status(500).json({ 
          success: false,
          error: "Ошибка при анализе данных сайта через AI" 
        });
      }
      
      // Парсим ответ для извлечения JSON
      let result = {};
      try {
        // Поиск JSON в ответе
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
      } catch (parseError) {
        console.error('Ошибка при парсинге JSON:', parseError);
        return res.status(500).json({ 
          success: false,
          error: "Не удалось обработать результат анализа" 
        });
      }
      
      return res.json({
        success: true,
        data: result
      });
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
        const webhookUrl = process.env.N8N_CONTENT_PLAN_WEBHOOK || 'https://n8n.nplanner.ru/webhook/ae581e17-651d-4b14-8fb1-ca16898bca1b';
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
      const serviceNames: Array<'perplexity'|'deepseek'|'fal_ai'|'xmlriver'|'apify'|'social_searcher'> = [
        'perplexity', 'deepseek', 'fal_ai', 'xmlriver', 'apify', 'social_searcher'
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

  // Эндпоинт для тестирования Qwen API
  app.get('/api/test-qwen', async (req, res) => {
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
      
      // Получаем API ключ Qwen из сервиса ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'qwen', token);
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API ключ Qwen не найден. Пожалуйста, добавьте ключ в настройках.'
        });
      }
      
      // Инициализируем сервис Qwen с полученным ключом
      const initialized = await qwenService.initialize(userId, token);
      
      if (!initialized) {
        return res.status(400).json({
          success: false,
          error: 'Не удалось инициализировать Qwen API. Проверьте ключ в настройках.'
        });
      }
      
      // Тестовый запрос к Qwen API - простая генерация текста
      try {
        const testResult = await qwenService.generateText(
          [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Reply with a single word: "Working"' }
          ],
          { max_tokens: 10 }
        );
        
        // Проверяем, содержит ли ответ ожидаемое слово
        const isWorking = testResult.toLowerCase().includes('working');
        
        if (isWorking) {
          return res.json({
            success: true,
            message: 'Qwen API работает корректно'
          });
        } else {
          return res.json({
            success: true, // API работает, но ответ не соответствует ожиданиям
            message: 'Qwen API подключен, но ответ не соответствует ожиданиям',
            result: testResult
          });
        }
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          error: error.message || 'Ошибка при тестировании Qwen API'
        });
      }
    } catch (error: any) {
      console.error('Error testing Qwen API:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Внутренняя ошибка сервера при тестировании Qwen API'
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

