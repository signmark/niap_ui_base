import express from 'express';
import path from 'path';
import fs from 'fs';
import { cdnService } from './services/cdn-service';
import { logger } from './utils/logger';

const router = express.Router();

// Маршрут для CDN и оптимизированных изображений
router.get('/cdn/:filePath(*)', async (req, res) => {
  try {
    // Получаем путь к файлу из параметров запроса
    const filePath = req.params.filePath;
    
    if (!filePath) {
      logger.warn('[CDN] Empty file path requested');
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Получаем параметры запроса для оптимизации изображения
    const width = req.query.width ? parseInt(req.query.width as string, 10) : undefined;
    const height = req.query.height ? parseInt(req.query.height as string, 10) : undefined;
    const quality = req.query.quality ? parseInt(req.query.quality as string, 10) : undefined;
    const format = req.query.format as string | undefined;
    
    // Путь к файлу заглушки для случая ошибки
    const placeholderPath = path.join(process.cwd(), 'uploads', 'placeholder', 'placeholder.png');
    
    // Обрабатываем изображение
    const processedImagePath = await cdnService.processImage(filePath, {
      width,
      height,
      quality,
      format
    });
    
    if (!processedImagePath) {
      logger.warn(`[CDN] Failed to process image: ${filePath}`);
      
      // Если файл заглушки существует, отправляем его
      if (fs.existsSync(placeholderPath)) {
        return res.sendFile(placeholderPath);
      }
      
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Получаем полный путь к обработанному изображению
    const fullPath = path.join(process.cwd(), processedImagePath);
    
    // Отправляем файл
    res.sendFile(fullPath);
  } catch (error) {
    logger.error(`[CDN] Error serving CDN content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    res.status(500).json({ error: 'Error serving CDN content' });
  }
});

export default router;