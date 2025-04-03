/**
 * Маршруты для проксирования файлов через сервер для доступа к защищенным ресурсам
 */

import { Express, Request, Response } from 'express';
import axios from 'axios';
import { log } from './utils/logger';
import { directusCrud } from './services/directus-crud';
import { directusAuthManager } from './services/directus-auth-manager';

/**
 * Регистрирует маршруты для проксирования файлов
 * @param app Экземпляр Express приложения
 */
export function registerProxyRoutes(app: Express) {
  // Маршрут для проксирования файлов через сервер с авторизацией по ID
  app.get('/api/proxy-file/:fileId', async (req: Request, res: Response) => {
    try {
      const fileId = req.params.fileId;
      if (!fileId) {
        return res.status(400).json({ error: 'Не указан ID файла' });
      }
      
      log(`Запрос на доступ к файлу Directus через прокси (ID): ${fileId}`, 'proxy');
      
      // Получаем системный токен для авторизации
      const adminToken = await directusCrud.getAdminToken();
      if (!adminToken) {
        log(`Не удалось получить токен администратора для проксирования файла`, 'proxy');
        return res.status(500).json({ error: 'Не удалось получить токен авторизации' });
      }
      
      // Формируем URL для доступа к файлу
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      const fileUrl = `${directusUrl}/assets/${fileId}`;
      
      log(`Пересылаем запрос к Directus URL: ${fileUrl}`, 'proxy');
      
      // Отправляем запрос к Directus с авторизацией
      const response = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        },
        maxRedirects: 5,
        timeout: 15000
      });
      
      // Копируем заголовки из ответа Directus
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });
      
      // Передаем поток данных клиенту
      response.data.pipe(res);
      log(`Проксирование файла по ID ${fileId} выполнено успешно`, 'proxy');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Ошибка при проксировании файла: ${errorMessage}`, 'proxy');
      
      // Проверяем на ошибку доступа
      const axiosError = error as any;
      if (axiosError.response && axiosError.response.status === 403) {
        const fileIdParam = req.params.fileId; // Получаем ID файла из параметров запроса
        log(`Ошибка доступа 403 при запросе к файлу по ID: ${fileIdParam}`, 'proxy');
        
        // Перенаправляем на изображение-заглушку вместо ошибки
        if (!res.headersSent) {
          res.redirect('https://placehold.co/400x225?text=Access+Denied');
          return;
        }
      }
      
      // Если уже начали отправлять ответ, не можем отправить JSON с ошибкой
      if (!res.headersSent) {
        res.status(500).json({ error: 'Ошибка при получении файла' });
      } else {
        // Просто завершаем ответ, если заголовки уже отправлены
        res.end();
      }
    }
  });
  
  // Маршрут для проксирования файлов через сервер с авторизацией по URL
  app.get('/api/proxy-file', async (req: Request, res: Response) => {
    try {
      const fileUrl = req.query.url as string;
      if (!fileUrl) {
        return res.status(400).json({ error: 'Не указан URL файла' });
      }
      
      log(`Запрос на доступ к файлу через прокси (URL): ${fileUrl}`, 'proxy');
      
      // Проверяем, это URL Directus?
      const isDirectusUrl = fileUrl.includes('directus.nplanner.ru') || 
                           fileUrl.includes('assets.directus') || 
                           fileUrl.includes('files.directus');
      
      let headers: Record<string, string> = {};
      
      // Если это URL Directus, добавляем токен авторизации
      if (isDirectusUrl) {
        // Получаем системный токен для авторизации
        const adminToken = await directusCrud.getAdminToken();
        if (adminToken) {
          headers = {
            'Authorization': `Bearer ${adminToken}`
          };
          log(`Добавлен токен авторизации для Directus URL`, 'proxy');
        } else {
          log(`Не удалось получить токен администратора для Directus URL`, 'proxy');
        }
      }
      
      // Отправляем запрос к источнику
      const response = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
        headers,
        maxRedirects: 5,
        timeout: 15000
      });
      
      // Копируем заголовки из ответа источника
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });
      
      // Передаем поток данных клиенту
      response.data.pipe(res);
      log(`Проксирование файла по URL выполнено успешно`, 'proxy');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Ошибка при проксировании файла по URL: ${errorMessage}`, 'proxy');
      
      // Проверяем на ошибку доступа
      const axiosError = error as any;
      if (axiosError.response && axiosError.response.status === 403) {
        const fileUrlParam = req.query.url as string; // Получаем URL файла из параметров запроса
        log(`Ошибка доступа 403 при запросе к файлу по URL: ${fileUrlParam}`, 'proxy');
        
        // Перенаправляем на изображение-заглушку вместо ошибки
        if (!res.headersSent) {
          res.redirect('https://placehold.co/400x225?text=Access+Denied');
          return;
        }
      }
      
      // Если уже начали отправлять ответ, не можем отправить JSON с ошибкой
      if (!res.headersSent) {
        res.status(500).json({ error: 'Ошибка при получении файла' });
      } else {
        // Просто завершаем ответ, если заголовки уже отправлены
        res.end();
      }
    }
  });
  
  // Маршрут для проксирования медиа с внешних ресурсов (соц. сети, защищенные ресурсы)
  app.get('/api/proxy-media', async (req: Request, res: Response) => {
    try {
      const mediaUrl = req.query.url as string;
      const platform = req.query.platform as string | undefined;
      
      if (!mediaUrl) {
        return res.status(400).json({ error: 'Не указан URL медиа-файла' });
      }
      
      log(`Запрос на доступ к внешнему медиа через прокси для платформы ${platform || 'не указана'}: ${mediaUrl}`, 'proxy');
      
      // Базовые заголовки для запроса в зависимости от платформы
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://nplanner.replit.app/',
        'Origin': 'https://nplanner.replit.app',
        'Cache-Control': 'no-cache'
      };
      
      // Специфичные настройки для разных платформ
      if (platform === 'vk') {
        // Для VK добавляем дополнительные заголовки
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        headers['Referer'] = 'https://vk.com/';
        headers['Origin'] = 'https://vk.com';
        headers['Accept'] = '*/*';
        log(`Добавлены специальные заголовки для VK`, 'proxy');
      } else if (platform === 'telegram') {
        // Для Telegram
        headers['User-Agent'] = 'TelegramBot (like TwitterBot)';
        headers['Referer'] = 'https://t.me/';
        headers['Accept'] = '*/*';
        log(`Добавлены специальные заголовки для Telegram`, 'proxy');
      } else if (platform === 'instagram' || platform === 'facebook') {
        // Для Instagram/Facebook
        headers['User-Agent'] = 'Instagram 123.0.0.21.114 (iPhone; CPU iPhone OS 11_4 like Mac OS X; en_US; en-US; scale=2.00; 750x1334) AppleWebKit/605.1.15';
        headers['Referer'] = 'https://www.instagram.com/';
        headers['Origin'] = 'https://www.instagram.com';
        log(`Добавлены специальные заголовки для Instagram/Facebook`, 'proxy');
      }
      
      // Для определенных доменов требуется авторизация и особая обработка
      const protectedDomains = [
        'instagram.', 'fbcdn.net', 'cdninstagram.com', 'scontent.', 'tgcnt.ru',
        'vk.com', 'static.tgstat.ru', 'pbs.twimg.com', 'sitestat.ru', 's.TG',
        't.me', 'telegram.org', 'telesco.pe'
      ];
      
      const needsAuth = protectedDomains.some(domain => mediaUrl.includes(domain));
      
      if (needsAuth) {
        // Пытаемся получить токен администратора Directus
        try {
          // Получаем админский токен
          const adminSession = await directusAuthManager.getAdminSession();
          
          if (adminSession && adminSession.token) {
            log(`Добавлен токен администратора для запроса к защищенной платформе ${platform || '(не указана)'}`, 'proxy');
            // Устанавливаем заголовок авторизации и cookie для доступа
            headers['Authorization'] = `Bearer ${adminSession.token}`;
            headers['Cookie'] = `token=${adminSession.token.substring(0, 10)}...`;
          } else {
            // Запасной вариант - используем метод напрямую
            const adminToken = await directusCrud.getAdminToken();
            if (adminToken) {
              log(`Получен токен администратора через DirectusCrud`, 'proxy');
              headers['Authorization'] = `Bearer ${adminToken}`;
            }
          }
        } catch (authError) {
          log(`Не удалось получить токен администратора для запроса к соц. сетям: ${authError}`, 'proxy');
        }
      }
      
      // Отправляем запрос к источнику
      const response = await axios({
        method: 'get',
        url: mediaUrl,
        responseType: 'stream',
        headers,
        maxRedirects: 5,
        timeout: 15000,
        validateStatus: status => status < 400  // Принимаем любые статусы кроме ошибок 4xx-5xx
      });
      
      // Копируем основные заголовки из ответа
      const headersToForward = [
        'content-type', 'content-length', 'cache-control', 
        'content-disposition', 'etag', 'last-modified'
      ];
      
      headersToForward.forEach(header => {
        if (response.headers[header]) {
          res.setHeader(header, response.headers[header]);
        }
      });
      
      // Добавляем CORS заголовки
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      
      // Передаем поток данных клиенту
      response.data.pipe(res);
      log(`Проксирование внешнего медиа выполнено успешно: ${mediaUrl}`, 'proxy');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Ошибка при проксировании внешнего медиа: ${errorMessage}`, 'proxy');
      
      // Проверяем на ошибку доступа
      const axiosError = error as any;
      if (axiosError.response && axiosError.response.status === 403) {
        const mediaUrlParam = req.query.url as string;
        log(`Ошибка доступа 403 при запросе к медиа по URL: ${mediaUrlParam}`, 'proxy');
        
        // Перенаправляем на изображение-заглушку вместо ошибки
        if (!res.headersSent) {
          res.redirect('https://placehold.co/400x225?text=Access+Denied');
          return;
        }
      }
      
      // Если уже начали отправлять ответ, не можем отправить JSON с ошибкой
      if (!res.headersSent) {
        res.status(500).json({ error: 'Ошибка при получении медиа-файла' });
      } else {
        // Просто завершаем ответ, если заголовки уже отправлены
        res.end();
      }
    }
  });
}