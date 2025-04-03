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
      if (!mediaUrl) {
        return res.status(400).json({ error: 'Не указан URL медиа-файла' });
      }
      
      log(`Запрос на доступ к внешнему медиа через прокси: ${mediaUrl}`, 'proxy');
      
      // Добавляем необходимые заголовки для доступа к ресурсам социальных сетей
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://nplanner.replit.app/',
        'Origin': 'https://nplanner.replit.app',
        'Cache-Control': 'no-cache'
      };
      
      // Для ресурсов Instagram/Facebook/VK могут потребоваться дополнительные заголовки
      if (
        mediaUrl.includes('instagram.') || 
        mediaUrl.includes('fbcdn.net') || 
        mediaUrl.includes('cdninstagram.com') || 
        mediaUrl.includes('scontent.') || 
        mediaUrl.includes('vk.com')
      ) {
        // Пытаемся получить токен администратора Directus
        try {
          // Получаем админский токен
          const adminSession = await directusAuthManager.getAdminSession();
          
          if (adminSession && adminSession.token) {
            log(`Добавлен токен администратора для запроса к социальным сетям`, 'proxy');
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