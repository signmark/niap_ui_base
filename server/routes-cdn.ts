/**
 * Маршруты для CDN - обеспечивают доступ к статическим файлам через CDN с кэшированием и оптимизацией
 */

import express from 'express';
import path from 'path';
import { cdnService } from './services/cdn-service';

// Создаем роутер Express для CDN
const cdnRouter = express.Router();

// Базовый путь для CDN
const CDN_BASE_PATH = '/cdn';

// Маршрут для обслуживания файлов через CDN (с параметрами оптимизации)
cdnRouter.get(`${CDN_BASE_PATH}/*`, async (req, res) => {
  try {
    // Извлекаем путь к файлу из URL
    const filePath = req.path.substring(CDN_BASE_PATH.length + 1);
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Добавляем путь к файлу в параметры запроса
    req.query.path = filePath;
    
    // Обрабатываем запрос через CDN сервис
    await cdnService.serveImage(req, res);
  } catch (error) {
    console.error('CDN Error:', error);
    res.status(500).json({ error: 'Error serving file from CDN' });
  }
});

// Маршрут для очистки кэша
cdnRouter.post(`${CDN_BASE_PATH}/clear-cache`, async (req, res) => {
  try {
    const imagePath = req.body.path;
    await cdnService.clearCache(imagePath);
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('CDN Cache Clear Error:', error);
    res.status(500).json({ error: 'Error clearing CDN cache' });
  }
});

// Экспортируем роутер
export default cdnRouter;