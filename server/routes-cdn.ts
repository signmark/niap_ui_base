import express from 'express';
import path from 'path';
import fs from 'fs';
import { getOptimizedImagePath } from './services/cdn-service';
import { logger } from './utils/logger';

const router = express.Router();

// Базовые директории
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

// Обработчик для получения изображений через CDN
router.get('/cdn/image/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // Параметры для изменения размера и качества изображения
    const width = req.query.w ? parseInt(req.query.w as string, 10) : undefined;
    const height = req.query.h ? parseInt(req.query.h as string, 10) : undefined;
    const quality = req.query.q ? parseInt(req.query.q as string, 10) : 80;
    
    // Полный путь к исходному файлу
    const originalPath = path.join(UPLOADS_DIR, filename);
    
    // Проверяем существование исходного файла
    if (!fs.existsSync(originalPath)) {
      logger.warn(`[CDN] Файл не найден: ${originalPath}`);
      
      // Проверяем, существует ли файл в директории публичных статических файлов
      const publicPath = path.join(PUBLIC_DIR, filename);
      if (fs.existsSync(publicPath)) {
        return res.sendFile(publicPath);
      }
      
      // Если файл не найден, возвращаем заглушку
      return res.sendFile(path.join(PUBLIC_DIR, 'placeholder.png'));
    }
    
    // Получаем путь к оптимизированному изображению
    const optimizedPath = getOptimizedImagePath(originalPath, width, height, quality);
    
    // Отправляем файл
    return res.sendFile(optimizedPath);
  } catch (error) {
    logger.error(`[CDN] Ошибка при обработке запроса: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    return res.status(500).send('Ошибка при обработке изображения');
  }
});

// Обработчик для получения любых файлов через оптимизированный CDN
router.get('/cdn/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // Полный путь к исходному файлу
    const originalPath = path.join(UPLOADS_DIR, filename);
    
    // Проверяем существование исходного файла
    if (!fs.existsSync(originalPath)) {
      logger.warn(`[CDN] Файл не найден: ${originalPath}`);
      
      // Проверяем, существует ли файл в директории публичных статических файлов
      const publicPath = path.join(PUBLIC_DIR, filename);
      if (fs.existsSync(publicPath)) {
        return res.sendFile(publicPath);
      }
      
      // Если файл не найден, возвращаем 404
      return res.status(404).send('Файл не найден');
    }
    
    // Отправляем файл
    return res.sendFile(originalPath);
  } catch (error) {
    logger.error(`[CDN] Ошибка при обработке запроса: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    return res.status(500).send('Ошибка при обработке файла');
  }
});

export default router;