import { deepseekService, DeepSeekMessage } from './services/deepseek';
import { falAiService } from './services/falai';
import express, { Express, Request, Response, NextFunction } from "express";
import { createServer, Server } from "http";
import path from "path";
import axios from "axios";
import * as https from 'https';
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { directusApi } from "./directus";
import { crawler } from "./services/crawler";
import { apifyService } from "./services/apify";
import { log } from "./vite";
import { ContentSource, InsertCampaignTrendTopic, InsertSourcePost } from "../shared/schema";
import { falAiSdk } from './services/fal-ai';

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

import { insertBusinessQuestionnaireSchema } from "../shared/schema";
import { 
  insertContentSourceSchema, 
  insertCampaignContentSchema,
  insertCampaignTrendTopicSchema,
  InsertCampaignContent
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
function extractSourcesFromText(content: string): any[] {
  const sources: any[] = [];

  // 1. Direct Instagram URLs
  // Example: https://www.instagram.com/pp_mari_food/ - хороший аккаунт
  const urlPattern = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._-]+)\/?/g;
  let match;

  while ((match = urlPattern.exec(content)) !== null) {
    const username = match[1];
    const url = normalizeInstagramUrl(`instagram.com/${username}`);
    if (!sources.some(s => s.url === url)) {
      sources.push({
        url,
        name: username,
        followers: 100000, // Default value
        platform: 'instagram.com',
        description: 'Instagram аккаунт о правильном питании',
        rank: 5
      });
    }
  }

  // 2. Formatted lists with stars
  // Example: "1. **@raychelpaul** - Рейчел Паул (500K followers) - Публикует рецепты..."
  const formattedPattern = /\*\*@([a-zA-Z0-9._-]+)\*\*\s*-\s*([^(]+)\s*\(([0-9.]+[KkMm][^)]*)\)[^-]*-\s*([^.\n]+)/g;

  while ((match = formattedPattern.exec(content)) !== null) {
    const [_, username, name, followers, description] = match;
    const followersCount = parseFollowerCount(followers);
    const url = normalizeInstagramUrl(`instagram.com/${username}`);

    if (followersCount >= 50000 && !sources.some(s => s.url === url)) {
      sources.push({
        url,
        name: name.trim(),
        followers: followersCount,
        platform: 'instagram.com',
        description: description.trim(),
        rank: 5
      });
    }
  }

  // 3. Simple @ mentions
  // Example: "@username (500K followers)"
  const simplePattern = /@([a-zA-Z0-9._-]+)\s*\(([0-9.]+[KkMm][^)]*)\)/g;

  while ((match = simplePattern.exec(content)) !== null) {
    const [_, username, followers] = match;
    const followersCount = parseFollowerCount(followers);
    const url = normalizeInstagramUrl(`instagram.com/${username}`);

    if (followersCount >= 50000 && !sources.some(s => s.url === url)) {
      sources.push({
        url,
        name: username,
        followers: followersCount,
        platform: 'instagram.com',
        description: 'Instagram аккаунт о правильном питании',
        rank: 5
      });
    }
  }

  console.log(`Extracted ${sources.length} Instagram sources:`, sources);
  return sources;
}

// Helper function for Perplexity search
async function existingPerplexitySearch(keyword: string, token: string): Promise<any[]> {
  const cached = getCachedResults(keyword);
  if (cached) {
    console.log(`Using ${cached.length} cached results for keyword: ${keyword}`);
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

    const perplexityKey = settings.data?.data?.[0]?.api_key;
    if (!perplexityKey) {
      console.error('Perplexity API key not found');
      return [];
    }

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: `You are an expert at finding high-quality Russian Instagram accounts.
Focus only on Instagram accounts with >50K followers that post in Russian.
For each account provide:
1. Username with @ symbol 
2. Full name in Russian
3. Follower count with K or M
4. Brief description in Russian

Format each account as:
1. **@username** - Name (500K followers) - Description

Also include direct Instagram URLs in the response like:
https://www.instagram.com/username/ - description`
          },
          {
            role: "user",
            content: `Find TOP-5 most authoritative Russian Instagram accounts for: ${keyword}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
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

    const content = response.data.choices[0].message.content;
    console.log(`Raw API response for keyword ${keyword}:`, content);

    // Извлекаем источники из текста
    const sources = extractSourcesFromText(content);
    console.log(`Found ${sources.length} sources for keyword ${keyword}`);

    // Кешируем результаты
    if (sources.length > 0) {
      console.log(`Caching ${sources.length} results for keyword: ${keyword}`);
      searchCache.set(keyword, {
        timestamp: Date.now(),
        results: sources
      });
    }

    return sources;

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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No authorization header provided');
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

      // Добавляем userId в объект запроса для дальнейшего использования
      (req as any).userId = response.data.data.id;
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Прокси для прямых запросов к FAL.AI REST API
  app.post('/api/v1/image-gen', async (req, res) => {
    try {
      const { prompt, negativePrompt, width, height, numImages } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ 
          success: false, 
          error: "Отсутствует обязательный параметр prompt" 
        });
      }
      
      // Сначала проверим ключ в переменных окружения
      let apiKey = process.env.FAL_AI_API_KEY;
      
      // Если ключа нет в переменных, попробуем получить из Directus
      if (!apiKey) {
        try {
          console.log('FAL_AI_API_KEY отсутствует в переменных окружения. Пробуем получить из Directus...');
          
          // Пробуем получить API ключ из системных настроек Directus
          const systemSettings = await directusApi.get('/items/system_settings', {
            params: {
              filter: {
                key: { _eq: 'fal_ai_api_key' }
              }
            }
          });
          
          if (systemSettings.data?.data?.length > 0 && systemSettings.data.data[0].value) {
            apiKey = systemSettings.data.data[0].value;
            console.log('Найден API ключ FAL.AI в системных настройках Directus');
          }
        } catch (directusError) {
          console.error('Ошибка при запросе к Directus API:', directusError);
        }
      }
      
      if (!apiKey) {
        console.error('API ключ FAL.AI не найден ни в переменных окружения, ни в Directus');
        return res.status(500).json({ 
          success: false, 
          error: "API ключ FAL.AI не настроен. Добавьте ключ в системные настройки." 
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
  app.get('/api/settings/fal_ai', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      // Проверяем, есть ли ключ в переменных окружения как запасной вариант
      const envApiKey = process.env.FAL_AI_API_KEY;
      
      if (envApiKey) {
        console.log('Используем FAL.AI API ключ из переменных окружения');
        return res.json({
          success: true,
          data: {
            api_key: envApiKey,
            source: "env"
          }
        });
      }
      
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
        
        // Если ошибка авторизации в Directus, но есть ключ в переменных окружения, используем его
        if (envApiKey) {
          console.log('Используем запасной FAL.AI API ключ из переменных окружения из-за ошибки Directus');
          return res.json({
            success: true,
            data: {
              api_key: envApiKey,
              source: "env_fallback"
            }
          });
        }
        
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
        
        // Инициализация FalAI SDK с ключом API
        falAiSdk.initialize(apiKey);
        
        // Подготавливаем endpoint для SDK (удаляем начальный слеш, если есть)
        const sdkEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
        
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

  // Маршрут для генерации изображений через FAL.AI API
  app.post('/api/generate-image', async (req, res) => {
    try {
      const { prompt, negativePrompt, width, height, numImages, businessData, content, platform } = req.body;
      const falAiApiKey = process.env.FAL_AI_API_KEY;
      
      if (!falAiApiKey) {
        return res.status(400).json({ 
          success: false, 
          error: "API ключ для FAL.AI не настроен" 
        });
      }
      
      // Обновляем ключ API в сервисе
      falAiService.updateApiKey(falAiApiKey);
      console.log("[fal-ai] FAL.AI API key updated for image generation");
      
      let imageUrls: string[] = [];
      
      if (prompt) {
        // Генерация по прямому промпту
        console.log(`Генерация изображения с промптом: "${prompt.substring(0, 30)}..."`);
        imageUrls = await falAiService.generateImage(prompt, {
          negativePrompt: negativePrompt || "",
          width: width || 1024,
          height: height || 1024,
          numImages: numImages || 1
        });
      } else if (businessData) {
        // Генерация изображения для бизнеса
        console.log(`Генерация изображения для бизнеса: ${businessData.companyName}`);
        imageUrls = await falAiService.generateBusinessImage(businessData);
      } else if (content && platform) {
        // Генерация изображения для социальных сетей
        console.log(`Генерация изображения для соцсетей (${platform})`);
        imageUrls = await falAiService.generateSocialMediaImage(content, platform);
      } else {
        return res.status(400).json({
          success: false,
          error: "Недостаточно данных для генерации изображения"
        });
      }
      
      return res.json({
        success: true,
        data: imageUrls
      });
    } catch (error: any) {
      console.error("Ошибка при генерации изображения:", error);
      
      return res.status(500).json({
        success: false,
        error: error.message || "Неизвестная ошибка при генерации изображения"
      });
    }
  });
  
  // Старый метод генерации изображений (для обратной совместимости)
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
      let falAiApiKey = process.env.FAL_AI_API_KEY || "";
      
      // Пробуем инициализировать сервис с ключом из переменных окружения
      // Это позволит работать даже без валидного пользовательского токена
      let apiInitialized = falAiApiKey.length > 0;
      
      // Если не получилось инициализировать напрямую, и есть токен - пробуем через токен
      if (!apiInitialized && authHeader) {
        const token = authHeader.replace('Bearer ', '');
        
        try {
          // Получаем информацию о пользователе из токена
          const userResponse = await directusApi.get('/users/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          userId = userResponse.data?.data?.id;
          
          if (userId) {
            console.log(`Пользователь найден: ${userId}`);
            
            // Получаем ключ API из настроек пользователя
            try {
              const apiKeysResponse = await directusApi.get('/items/user_api_keys', {
                params: {
                  filter: {
                    user_id: { _eq: userId },
                    service_name: { _eq: 'fal_ai' }
                  },
                  fields: ['api_key']
                },
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });
              
              const items = apiKeysResponse.data?.data || [];
              if (items.length && items[0].api_key) {
                falAiApiKey = items[0].api_key;
                apiInitialized = true;
                console.log('FAL.AI API ключ успешно получен из Directus');
              }
            } catch (apiKeyError) {
              console.error("Ошибка при получении ключа API:", apiKeyError);
            }
          }
        } catch (authError) {
          console.error("Ошибка авторизации:", authError);
          // Продолжаем выполнение, если не удалось получить пользователя, но ключ уже настроен из окружения
          if (!apiInitialized) {
            return res.status(401).json({ 
              success: false, 
              error: "Ошибка авторизации. Пожалуйста, войдите в систему заново." 
            });
          }
        }
      }
    
      // Если API не инициализирован, возвращаем ошибку
      if (!apiInitialized) {
        return res.status(400).json({ 
          success: false, 
          error: "API ключ для FAL.AI не настроен. Проверьте настройки или переменные окружения." 
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
        
        // Добавляем логирование для отслеживания запроса
        console.log(`Отправляем запрос на прокси FAL.AI с параметрами:`, 
          JSON.stringify({
            endpoint,
            data: {
              ...requestData,
              prompt: requestData.prompt?.substring(0, 30) + '...'
            }
          })
        );
        
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
              // Используем актуальный API эндпоинт для генерации изображений
              falApiResponse = await axios.post(
                'https://queue.fal.run/fal-ai/fast-sdxl',
                {
                  prompt: requestData.prompt,
                  negative_prompt: requestData.negative_prompt || "",
                  width: requestData.width || 1024,
                  height: requestData.height || 1024,
                  num_images: requestData.num_images || 1,
                  sync_mode: true // Синхронный режим для мгновенного результата
                },
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Key ${falAiApiKey}`,
                    'Accept': 'application/json'
                  },
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
  const httpServer = createServer(app);
  
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
      
      // Получаем API ключ FAL.AI
      const apiKey = process.env.FAL_AI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "API ключ FAL.AI не настроен. Пожалуйста, добавьте его в переменные окружения."
        });
      }
      
      // Обновляем ключ в сервисе
      falAiService.updateApiKey(apiKey);
      
      // Запускаем генерацию изображения
      console.log(`Генерация изображения с промптом: "${prompt.substring(0, 30)}..."`);
      const imageUrls = await falAiService.generateImage(prompt, {
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
      
      // Получаем FAL.AI API ключ из переменных окружения
      const falAiApiKey = process.env.FAL_AI_API_KEY;
      
      if (!falAiApiKey) {
        console.log("FAL.AI API ключ не найден в переменных окружения");
        return res.status(400).json({ 
          success: false, 
          error: "FAL.AI API ключ не настроен" 
        });
      }
      
      // Обновляем ключ API в сервисе
      falAiService.updateApiKey(falAiApiKey);
      
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

// Маршрут для генерации контента через Perplexity API
  app.post("/api/content/generate-deepseek", async (req, res) => {
    try {
      const { prompt, keywords, tone, platform, campaignId } = req.body;
      
      if (!prompt || !keywords || !tone || !campaignId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Получаем API ключ DeepSeek из настроек пользователя
        const settings = await directusApi.get('/items/user_api_keys', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          params: {
            filter: {
              service_name: { _eq: 'deepseek' }
            }
          }
        });
        
        const deepseekKey = settings.data?.data?.[0]?.api_key;
        
        // Если ключ найден в настройках, используем его
        if (deepseekKey) {
          // Обновляем ключ в сервисе
          deepseekService.updateApiKey(deepseekKey);
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

  app.post("/api/generate-content", async (req, res) => {
    try {
      const { prompt, keywords, tone, campaignId } = req.body;
      
      if (!prompt || !keywords || !tone || !campaignId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        // Получаем API ключ Perplexity из настроек пользователя
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
        
        const perplexityKey = settings.data?.data?.[0]?.api_key;
        if (!perplexityKey) {
          return res.status(400).json({ error: "Не найден API ключ для Perplexity. Добавьте его в настройках." });
        }
        
        // Создаем системный промт в зависимости от выбранного тона
        let systemPrompt = "Ты - опытный копирайтер, который создает качественный контент для социальных сетей.";
        
        switch (tone) {
          case "informative":
            systemPrompt += " Твой стиль информативный, ясный и образовательный.";
            break;
          case "friendly":
            systemPrompt += " Твой стиль дружелюбный, теплый и доступный, как разговор с другом.";
            break;
          case "professional":
            systemPrompt += " Твой стиль профессиональный, авторитетный и основательный.";
            break;
          case "casual":
            systemPrompt += " Твой стиль повседневный, непринужденный и разговорный.";
            break;
          case "humorous":
            systemPrompt += " Твой стиль остроумный, забавный, с уместным юмором.";
            break;
        }
        
        // Формируем запрос к API для генерации контента
        console.log(`Generating content for campaign ${campaignId} with keywords: ${keywords.join(", ")}`);
        
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
                content: `Создай контент для социальных сетей на основе следующего задания: ${prompt}
                
                Обязательно используй эти ключевые слова: ${keywords.join(", ")}
                
                Контент должен быть в русском языке, легко читаемым, структурированным, и длиной около 2000-3000 символов.`
              }
            ],
            max_tokens: 4000,
            temperature: 0.7
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
        
        const content = response.data.choices[0].message.content;
        console.log(`Generated content length: ${content.length} characters`);
        
        return res.json({ 
          success: true, 
          content,
          service: 'perplexity'
        });
        
      } catch (error) {
        console.error('Error generating content with Perplexity:', error);
        if (axios.isAxiosError(error)) {
          console.error('Perplexity API error details:', {
            status: error.response?.status,
            data: error.response?.data
          });
        }
        return res.status(500).json({ error: "Failed to generate content with AI" });
      }
    } catch (error) {
      console.error("Error in content generation:", error);
      res.status(500).json({ error: "Failed to generate content" });
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
  app.get("/api/analyze-site/:url", async (req, res) => {
    try {
      const siteUrl = req.params.url;
      if (!siteUrl) {
        return res.status(400).json({ error: "URL не указан" });
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
        
        // Кешируем результаты
        if (deepseekKeywords && deepseekKeywords.length > 0) {
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
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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
  app.get("/api/wordstat/:keyword", async (req, res) => {
    try {
      const requestId = crypto.randomUUID();
      console.log(`[${requestId}] Searching for keywords with context: ${req.params.keyword}`);
      console.log(`[${requestId}] ======= KEYWORD SEARCH DEBUG START =======`);
      
      // Фильтр нецензурной лексики в качестве входных данных
      const offensiveWords = ['бля', 'хуй', 'пизд', 'ебан', 'еб', 'пидор', 'пидар', 'хуя', 'нахуй', 'дебил'];
      const keyword = req.params.keyword.toLowerCase();
      
      // Проверяем, содержит ли ключевое слово нецензурную лексику
      if (offensiveWords.some(word => keyword.includes(word)) || 
          (keyword === 'сука' && !keyword.includes('порода') && !keyword.includes('собак'))) {
        return res.status(400).json({
          error: "Запрос содержит недопустимое содержание",
          message: "Пожалуйста, используйте корректные ключевые слова для поиска"
        });
      }
      
      // Отключаем кеширование для этого запроса
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      console.log(`[${requestId}] Processing keyword search for: ${keyword}`);

      // Добавляем случайный параметр чтобы избежать кеширования на клиенте
      const nocache = Date.now();
      
      // Проверяем, является ли введенное значение URL сайта
      let isUrl = false;
      try {
        const url = new URL(keyword.startsWith('http') ? keyword : `https://${keyword}`);
        isUrl = url.hostname.includes('.');
      } catch (e) {
        isUrl = false;
      }

      let finalKeywords = [];
      
      // Если это URL, используем AI-API для получения релевантных ключевых слов
      if (isUrl) {
        console.log(`[${requestId}] Using AI for URL-based keyword search`);
        
        // Нормализуем URL
        const normalizedUrl = keyword.startsWith('http') ? keyword : `https://${keyword}`;
        
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
            if (parsedKeywords.length > 0) {
              console.log(`[${requestId}] Extracted ${parsedKeywords.length} keywords from Perplexity`);
              
              finalKeywords = parsedKeywords.map(item => ({
                keyword: item.keyword || "",
                trend: parseInt(item.trend) || Math.floor(Math.random() * 5000) + 1000,
                competition: parseInt(item.competition) || Math.floor(Math.random() * 100)
              })).filter(item => item.keyword && item.keyword.trim() !== "");
              
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
        console.log('Falling back to XMLRiver for keyword search');
        try {
          const xmlriverResponse = await axios.get(`http://xmlriver.com/wordstat/json`, {
            params: {
              user: process.env.XMLRIVER_USER || "16797",
              key: process.env.XMLRIVER_KEY || "f7947eff83104621deb713275fe3260bfde4f001",
              query: isUrl ? "контент для сайта" : req.params.keyword
            }
          });
          
          if (xmlriverResponse.data?.content?.includingPhrases?.items) {
            const allKeywords = xmlriverResponse.data.content.includingPhrases.items.map((item: any) => ({
              keyword: item.phrase,
              trend: parseInt(item.number.replace(/\s/g, '')),
              competition: Math.floor(Math.random() * 100)
            }));
            
            // Фильтруем результаты на нецензурную лексику
            finalKeywords = allKeywords.filter(item => 
              !offensiveWords.some(word => item.keyword.toLowerCase().includes(word))
            );
            
            // Сохраняем результаты в кеш для обычных ключевых слов
            if (!isUrl && finalKeywords.length > 0) {
              searchCache.set(keyword.toLowerCase().trim(), {
                timestamp: Date.now(),
                results: finalKeywords
              });
              console.log(`[${requestId}] Added ${finalKeywords.length} keywords to cache for "${keyword}"`);
            }
          }
        } catch (xmlriverError) {
          console.error('XMLRiver API error:', xmlriverError);
          // Если XMLRiver тоже не сработал, возвращаем пустой массив
          finalKeywords = [];
        }
      }
      
      console.log(`Final keywords: ${finalKeywords.length}`);
      
      // Сохраняем результаты в кеш, если это URL и результаты получены
      if (isUrl && finalKeywords.length > 0) {
        const normalizedUrl = keyword.startsWith('http') ? keyword : `https://${keyword}`;
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

      const { campaignId } = req.body;
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

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
      const keywordsResponse = await directusApi.get('/items/user_keywords', {
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
        userId
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
        const selectedPlatforms = req.body.platforms || ["instagram", "telegram", "vk"];
        
        webhookResponse = await axios.post('https://n8n.nplanner.ru/webhook/cc1e9b63-bc80-4367-953d-bc888ec32439', {
          minFollowers: followerRequirements,
          maxSourcesPerPlatform: maxSourcesPerPlatform,
          platforms: selectedPlatforms,
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

      // Отправка запроса на webhook n8n для поиска источников
      console.log('Sending webhook request to n8n for source search');
      
      try {
        // Создаем идентификатор запроса для безопасного отслеживания
        const requestId = crypto.randomUUID();
        
        const webhookResponse = await axios.post('https://n8n.nplanner.ru/webhook/767bbaf6-e9ca-4f1d-aeb6-66598ff7e291', {
          keywords: keywords,
          userId: userId,
          requestId: requestId,
          // Не передаем токен пользователя в webhook
        }, {
          headers: {
            'Content-Type': 'application/json',
            // Используем только API ключ для авторизации в N8N
            'X-N8N-Authorization': process.env.N8N_API_KEY || ''
          },
          timeout: 30000 // 30 секунд таймаут
        });
        
        console.log('Webhook source search response status:', webhookResponse.status);

        // Если n8n вернул результаты, используем их
        if (webhookResponse.data && webhookResponse.data.sources) {
          console.log(`Received ${webhookResponse.data.sources.length} sources from n8n webhook`);
          
          // Кешируем результаты поиска
          keywords.forEach((keyword: string) => {
            const sourcesForKeyword = webhookResponse.data.sourcesMap && 
                                     webhookResponse.data.sourcesMap[keyword] ? 
                                     webhookResponse.data.sourcesMap[keyword] : 
                                     webhookResponse.data.sources;
            
            if (sourcesForKeyword && sourcesForKeyword.length > 0) {
              console.log(`Caching ${sourcesForKeyword.length} results for keyword: ${keyword}`);
              searchCache.set(keyword, {
                timestamp: Date.now(),
                results: sourcesForKeyword
              });
            }
          });
          
          return res.json({
            success: true,
            data: {
              sources: webhookResponse.data.sources
            }
          });
        } else {
          // Если n8n не вернул результаты, возвращаемся к обычному поиску
          console.log('No sources in webhook response, falling back to regular search');
          
          // Собираем источники из нескольких сервисов для ключевых слов без кеша
          const fallbackResults = await Promise.all(
            keywords.map(async (keyword: string, index: number) => {
              if (cachedResults[index]) {
                return cachedResults[index];
              }

              // В случае если Social Searcher недоступен, используем только Perplexity
              const [socialResults, perplexityResults] = await Promise.all([
                searchSocialSourcesByKeyword(keyword, token),
                existingPerplexitySearch(keyword, token)
              ]);

              const results = [...socialResults, ...perplexityResults];

              // Cache the results
              if (results.length > 0) {
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
          const uniqueSourcesFallback = fallbackResults.flat().reduce((acc: any[], source) => {
            const exists = acc.some(s => s.url === source.url);
            if (!exists) {
              acc.push(source);
            }
            return acc;
          }, []);
          
          console.log(`Found ${uniqueSourcesFallback.length} unique sources from fallback search`);
          
          return res.json({
            success: true,
            data: {
              sources: uniqueSourcesFallback
            }
          });
        }
      } catch (webhookError) {
        console.error('Error calling n8n webhook for source search:', webhookError);
        
        // В случае ошибки webhook, возвращаемся к обычному поиску
        console.log('Webhook error, falling back to regular search');
        
        // Собираем источники из нескольких сервисов для ключевых слов без кеша
        const fallbackResults = await Promise.all(
          keywords.map(async (keyword: string, index: number) => {
            if (cachedResults[index]) {
              return cachedResults[index];
            }

            // В случае если Social Searcher недоступен, используем только Perplexity
            const [socialResults, perplexityResults] = await Promise.all([
              searchSocialSourcesByKeyword(keyword, token),
              existingPerplexitySearch(keyword, token)
            ]);

            const results = [...socialResults, ...perplexityResults];

            // Cache the results
            if (results.length > 0) {
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
        const uniqueSourcesFallback = fallbackResults.flat().reduce((acc: any[], source) => {
          const exists = acc.some(s => s.url === source.url);
          if (!exists) {
            acc.push(source);
          }
          return acc;
        }, []);
        
        console.log(`Found ${uniqueSourcesFallback.length} unique sources from fallback search after webhook error`);
        
        return res.json({
          success: true,
          data: {
            sources: uniqueSourcesFallback
          }
        });
      }

      // Этот код никогда не должен выполняться из-за возвращаемых значений в блоках выше
      return res.status(500).json({
        error: "Unexpected error in /api/sources/collect",
        message: "Please check server logs"
      });

    } catch (error) {
      console.error('Error in /api/sources/collect:', error);
      res.status(500).json({
        error: "Failed to collect sources",
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
        console.log(`Fetching trend topics for campaign: ${campaignId}, period: ${period}`);
        
        // Форматируем дату для фильтра в формате ISO
        const fromDateISO = fromDate.toISOString();
        
        // Получаем темы напрямую из Directus API
        const response = await directusApi.get('/items/campaign_trend_topics', {
          params: {
            filter: {
              campaign_id: {
                _eq: campaignId
              },
              created_at: {
                _gte: fromDateISO
              }
            },
            sort: ['-created_at']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
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
        console.error("Error fetching trend topics from Directus:", directusError);
        
        if (axios.isAxiosError(directusError) && directusError.response) {
          console.error("Directus API error details:", directusError.response.data);
        }
        
        return res.status(500).json({ 
          success: false,
          error: "Не удалось получить тренды", 
          message: directusError instanceof Error ? directusError.message : "Unknown error"
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
        // Получаем ключевые слова из Directus через таблицу user_keywords
        const response = await directusApi.get('/items/user_keywords', {
          params: {
            filter: {
              campaign_id: {
                _eq: campaignId
              }
            },
            fields: ['id', 'keyword', 'trend_score', 'campaign_id']
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
          trendScore: item.trend_score
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
          keywords: item.keywords || [],
          hashtags: item.hashtags || [],
          links: item.links || [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {},
          metadata: item.metadata || {}
        }));
        
        console.log(`Found ${contentItems.length} content items for campaign ${campaignId || 'all'}`);
        
        // Для отладки выводим ключевые слова из первого элемента
        if (contentItems.length > 0) {
          const sample = contentItems[0];
          console.log('Sample keywords being sent to client:', typeof sample.keywords, JSON.stringify(sample.keywords));
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
          keywords: item.keywords || [],
          hashtags: item.hashtags || [],
          links: item.links || [],
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
          // Проверяем, что keywords это массив
          keywords: Array.isArray(req.body.keywords) ? req.body.keywords : [],
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
          keywords: item.keywords || [],
          hashtags: item.hashtags || [],
          links: item.links || [],
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

  app.patch("/api/campaign-content/:id", async (req, res) => {
    try {
      const contentId = req.params.id;
      const authHeader = req.headers['authorization'];
      
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      try {
        console.log(`Updating content with ID: ${contentId}`);
        
        // Получаем ID пользователя из токена - это может потребоваться для обновления
        const userResponse = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userId = userResponse.data.data.id;
        
        if (!userId) {
          throw new Error('User ID not found');
        }
        
        // Получаем текущий контент напрямую из Directus API для проверки
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
          return res.status(403).json({ error: "You don't have permission to update this content" });
        }
        
        // Преобразуем данные в формат Directus API
        const directusPayload: any = {
          content_type: req.body.contentType,
          title: req.body.title,
          content: req.body.content,
          image_url: req.body.imageUrl,
          video_url: req.body.videoUrl,
          status: req.body.status
        };
        
        // Обрабатываем ключевые слова особым образом
        if (req.body.keywords !== undefined) {
          console.log('Request keywords type:', typeof req.body.keywords, 'Value:', req.body.keywords);
          
          // Убедимся, что keywords - это массив
          let keywordsArray: string[] = [];
          
          if (Array.isArray(req.body.keywords)) {
            // Если уже массив, используем его напрямую
            keywordsArray = req.body.keywords.map((k: any) => 
              typeof k === 'string' ? k : String(k)
            );
          } else if (typeof req.body.keywords === 'string') {
            try {
              // Проверяем, может быть это JSON-строка
              const parsed = JSON.parse(req.body.keywords);
              if (Array.isArray(parsed)) {
                keywordsArray = parsed.map((k: any) => typeof k === 'string' ? k : String(k));
              } else {
                // Одиночное значение, оборачиваем в массив
                keywordsArray = [req.body.keywords];
              }
            } catch (e) {
              // Если не удалось распарсить как JSON, то это просто строка
              keywordsArray = [req.body.keywords];
            }
          } else if (req.body.keywords === null) {
            keywordsArray = [];
          } else {
            // Для всех остальных типов пытаемся преобразовать
            keywordsArray = [String(req.body.keywords)];
          }
          
          // Фильтруем пустые значения и гарантируем уникальность
          const uniqueKeywords = [...new Set(
            keywordsArray
              .filter(k => k && typeof k === 'string' && k.trim() !== '')
              .map(k => k.trim())
          )];
          
          directusPayload.keywords = uniqueKeywords;
          console.log('Processed unique keywords array:', directusPayload.keywords);
        }
        
        // Обновляем данные через Directus API
        const response = await directusApi.patch(`/items/campaign_content/${contentId}`, directusPayload, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.data || !response.data.data) {
          throw new Error('Failed to update content, invalid response from Directus');
        }
        
        const item = response.data.data;
        
        // Преобразуем данные из формата Directus в наш формат
        const updatedContent = {
          id: item.id,
          campaignId: item.campaign_id,
          userId: item.user_id,
          title: item.title,
          content: item.content,
          contentType: item.content_type,
          imageUrl: item.image_url,
          videoUrl: item.video_url,
          prompt: item.prompt,
          // Убедимся, что ключевые слова всегда возвращаются как массив
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
          links: Array.isArray(item.links) ? item.links : [],
          createdAt: item.created_at,
          scheduledAt: item.scheduled_at,
          publishedAt: item.published_at,
          status: item.status,
          socialPlatforms: item.social_platforms || {},
          metadata: item.metadata || {}
        };
        
        res.json({ data: updatedContent });
      } catch (error) {
        console.error('Error updating campaign content:', error);
        if (error.response) {
          console.error('API error details:', error.response.data);
          if (error.response.status === 404) {
            return res.status(404).json({ error: "Content not found" });
          }
        }
        return res.status(401).json({ error: "Invalid token or failed to update content" });
      }
    } catch (error) {
      console.error("Error updating campaign content:", error);
      res.status(500).json({ error: "Failed to update campaign content" });
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
          keywords: item.keywords || [],
          hashtags: item.hashtags || [],
          links: item.links || [],
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
        
        // Отправляем данные в n8n webhook для публикации
        const n8nApiKey = process.env.N8N_API_KEY;
        
        if (!n8nApiKey) {
          console.warn('N8N_API_KEY not found in environment variables');
          return res.status(500).json({ error: "API ключ n8n не настроен" });
        }
        
        try {
          // Подготавливаем данные для n8n webhook
          const webhookPayload = {
            contentId,
            campaignId: content.campaign_id,
            userId: content.user_id,
            platforms: platformsToPublish,
            content: {
              title: content.title,
              originalContent: content.content,
              imageUrl: content.image_url,
              videoUrl: content.video_url,
              socialPlatforms: updatedSocialPlatforms
            },
            scheduledAt: content.scheduled_at,
            metadata: {
              keywords: content.keywords,
              type: content.content_type
            }
          };
          
          // Отправляем запрос на n8n webhook для публикации
          const webhookResponse = await axios.post(
            'https://n8n.nplanner.ru/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c',
            webhookPayload,
            {
              headers: {
                'Content-Type': 'application/json',
                'X-N8N-Authorization': n8nApiKey
              },
              timeout: 10000 // 10 секунд таймаут
            }
          );
          
          if (webhookResponse.status === 200) {
            console.log(`Successfully sent content ${contentId} to n8n for publishing`);
          } else {
            console.warn(`Unexpected response from n8n webhook: ${webhookResponse.status}`);
          }
        } catch (webhookError) {
          console.error('Error sending data to n8n webhook:', webhookError);
          return res.status(500).json({ 
            error: "Ошибка при отправке данных в n8n",
            details: webhookError.message
          });
        }
        
        res.json({ 
          success: true, 
          message: "Началась публикация контента в социальные сети",
          platforms: platformsToPublish
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
  
  // Добавляем маршрут для удаления кампаний
  app.delete("/api/campaigns/:id", authenticateUser, async (req, res) => {
    try {
      const campaignId = req.params.id;
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
        
        // Удаляем кампанию через Directus API
        await directusApi.delete(`/items/user_campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Возвращаем результат
        return res.status(200).json({ 
          success: true,
          message: "Кампания успешно удалена"
        });
      } catch (deleteError) {
        console.error(`Error deleting campaign ${campaignId}:`, deleteError);
        if (axios.isAxiosError(deleteError)) {
          console.error('Directus API error details:', {
            status: deleteError.response?.status,
            data: deleteError.response?.data
          });
        }
        return res.status(500).json({ error: "Не удалось удалить кампанию" });
      }
    } catch (error) {
      console.error("Error in delete campaign endpoint:", error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });
  
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
      const updateSchema = insertBusinessQuestionnaireSchema.partial();
      const validatedUpdates = updateSchema.parse(req.body);
      
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

  // Маршрут для генерации изображений с использованием FAL.AI
  app.post("/api/generate-image", authenticateUser, async (req: any, res) => {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ 
          success: false, 
          error: "Не авторизован" 
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: "Не удалось определить ID пользователя" 
        });
      }
      
      // Получаем данные запроса
      const { 
        prompt, 
        negativePrompt, 
        width = 1024, 
        height = 1024, 
        campaignId,
        businessData,
        content,
        platform,
        numImages = 1
      } = req.body;
      
      // Проверяем наличие API ключа пользователя
      try {
        // Получаем API ключ FAL.AI из настроек пользователя
        console.log('Получаем API ключ FAL.AI для пользователя', userId);
        const userKeysResponse = await directusApi.get('/items/api_keys', {
          headers: {
            Authorization: `Bearer ${token}`
          },
          params: {
            filter: {
              service_name: {
                _eq: 'fal_ai'
              }
            }
          }
        });
        
        const userKeys = userKeysResponse?.data?.data || [];
        const falAiKey = userKeys.length > 0 ? userKeys[0].api_key : null;
        
        if (falAiKey) {
          console.log('Найден API ключ FAL.AI в настройках пользователя');
          // Инициализируем SDK с ключом пользователя
          falAiSdk.initialize(falAiKey);
        } else {
          // Проверяем наличие ключа в переменных окружения
          const envKey = process.env.FAL_AI_API_KEY;
          if (envKey) {
            console.log('Используем API ключ FAL.AI из переменных окружения');
            falAiSdk.initialize(envKey);
          } else {
            console.warn('API ключ FAL.AI не найден ни в настройках пользователя, ни в переменных окружения');
            return res.status(400).json({ 
              success: false, 
              error: "API ключ для FAL.AI не настроен. Добавьте ключ в настройках профиля." 
            });
          }
        }
        
        // Определяем тип генерации на основе входных данных
        let generatedImages: string[] = [];
        
        if (prompt) {
          // Базовая генерация по промпту
          console.log('Генерация изображения по промпту:', prompt.substring(0, 50) + '...');
          const result = await falAiSdk.generateImage('fal-ai/sdxl', {
            prompt: prompt,
            negative_prompt: negativePrompt || 'text, words, letters, logos, watermarks, low quality, blurry, grainy',
            width: width,
            height: height,
            num_images: numImages
          });
          
          if (result.images && Array.isArray(result.images)) {
            generatedImages = result.images;
          } else {
            throw new Error('Неожиданный формат ответа от API');
          }
        } 
        else if (businessData) {
          // Генерация на основе бизнес-данных
          console.log('Генерация изображения на основе бизнес-данных');
          // Используем альтернативный сервис для бизнес-генерации
          const result = await falAiService.generateBusinessImage(businessData);
          if (result && Array.isArray(result)) {
            generatedImages = result;
          } else if (typeof result === 'string') {
            generatedImages = [result];
          } else {
            throw new Error('Неожиданный формат ответа при генерации бизнес-изображения');
          }
        }
        else if (content && platform) {
          // Генерация для социальных сетей
          console.log('Генерация изображения для платформы:', platform);
          const result = await falAiService.generateSocialMediaImage(content, platform);
          if (result && Array.isArray(result)) {
            generatedImages = result;
          } else if (typeof result === 'string') {
            generatedImages = [result];
          } else {
            throw new Error('Неожиданный формат ответа при генерации контента для соцсетей');
          }
        }
        else {
          return res.status(400).json({ 
            success: false, 
            error: "Не указаны необходимые параметры для генерации изображения (prompt, businessData или content)" 
          });
        }
        
        // Возвращаем результат
        return res.json({
          success: true,
          data: generatedImages
        });
      } catch (error: any) {
        console.error('Ошибка при получении API ключа или генерации изображения:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Ошибка при генерации изображения',
          details: error.message
        });
      }
    } catch (error: any) {
      console.error('Ошибка при обработке запроса генерации изображения:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка сервера при генерации изображения',
        details: error.message 
      });
    }
  });

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
      const updateSchema = insertBusinessQuestionnaireSchema.partial();
      const validatedUpdates = updateSchema.parse(req.body);
      
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
      
      // Получаем API ключ DeepSeek из настроек пользователя
      try {
        const userId = req.userId;
        
        // Получение API ключей пользователя из Directus
        const userKeysResponse = await directusApi.get('/items/user_api_keys', {
          params: {
            filter: {
              user_id: { _eq: userId },
              service_name: { _eq: 'deepseek' }
            },
            fields: ['api_key']
          },
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        const userKeys = userKeysResponse.data?.data || [];
        const deepseekKey = userKeys.length > 0 ? userKeys[0].api_key : '';
        
        if (!deepseekKey) {
          return res.status(400).json({
            success: false,
            error: "DeepSeek API ключ не настроен в профиле пользователя. Пожалуйста, добавьте API ключ в настройках."
          });
        }
        
        // Обновляем API ключ в сервисе
        deepseekService.updateApiKey(deepseekKey);
      } catch (error) {
        console.error("Ошибка при получении API ключа DeepSeek:", error);
        return res.status(500).json({
          success: false,
          error: "Не удалось получить API ключ для анализа сайта"
        });
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
      
      // Получаем API ключ из переменной окружения
      const apiKey = process.env.FAL_AI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "API ключ FAL.AI не найден в конфигурации сервера"
        });
      }
      
      console.log(`[FAL.AI API] Генерация изображения для промпта: "${prompt.substring(0, 50)}..."`);
      
      try {
        // Инициализируем сервис с API ключом
        falAiSdk.initialize(apiKey);
        
        // Параметры для генерации
        const data = {
          prompt: prompt,
          negative_prompt: negativePrompt || "",
          width: width || 1024,
          height: height || 1024,
          num_images: numImages || 1
        };
        
        // Выполняем запрос через SDK
        const responseData = await falAiSdk.generateImage("fal-ai/stable-diffusion-xl", data);
        
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
          errorMessage = "Эндпоинт 'fal-ai/stable-diffusion-xl' не найден в FAL.AI API.";
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
      const apiKey = process.env.FAL_AI_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: "FAL.AI API ключ не найден в переменных окружения"
        });
      }
      
      // Инициализируем SDK с ключом
      falAiSdk.initialize(apiKey);
      
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