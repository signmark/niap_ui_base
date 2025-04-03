/**
 * Маршруты для проксирования файлов через сервер для доступа к защищенным ресурсам
 */

import { Express, Request, Response } from 'express';
import axios from 'axios';
import { log } from './utils/logger';
import { directusCrud } from './services/directus-crud';

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
}