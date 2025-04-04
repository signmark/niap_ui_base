/**
 * CDN Service - обеспечивает функционал CDN для изображений
 * - кэширование изображений
 * - базовая оптимизация (изменение размера, формата)
 * - поддержка заголовков кэширования
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { Request, Response } from 'express';

// Директория для кэширования обработанных изображений
const CACHE_DIR = path.join(process.cwd(), 'uploads', 'cache');

// Убедимся, что директория кэша существует
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

interface ResizeOptions {
  width?: number;
  height?: number;
  format?: string;
  quality?: number;
}

/**
 * Генерирует хеш строки для создания уникальных имен файлов
 */
function generateHash(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Получает расширение файла из пути
 */
function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Определяет MIME тип по расширению файла
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Проверяет, является ли файл изображением по его расширению
 */
function isImage(filePath: string): boolean {
  const extension = getExtension(filePath);
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'].includes(extension);
}

/**
 * Определяет, поддерживается ли изображение для обработки с помощью sharp
 */
function isProcessableImage(filePath: string): boolean {
  const extension = getExtension(filePath);
  return ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(extension);
}

/**
 * Сервис CDN для обработки изображений
 */
export class CdnService {
  /**
   * Обрабатывает запрос изображения, оптимизирует и кэширует результат
   */
  public async serveImage(req: Request, res: Response): Promise<void> {
    try {
      // Получаем путь к файлу из query параметров или из URL
      const filePath = req.query.path as string || req.params[0];
      
      if (!filePath) {
        res.status(400).json({ error: 'File path is required' });
        return;
      }
      
      // Формируем полный путь к файлу
      const fullPath = path.join(process.cwd(), 'uploads', filePath);
      
      // Проверяем существование файла
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      // Проверяем, является ли файл изображением
      if (!isImage(fullPath)) {
        res.status(400).json({ error: 'Not an image file' });
        return;
      }
      
      // Получаем параметры изменения размера и формата из запроса
      const options: ResizeOptions = {
        width: req.query.width ? parseInt(req.query.width as string) : undefined,
        height: req.query.height ? parseInt(req.query.height as string) : undefined,
        format: req.query.format as string | undefined,
        quality: req.query.quality ? parseInt(req.query.quality as string) : 80
      };
      
      // Проверяем кэш для этой комбинации файла и параметров
      const optionsHash = generateHash(JSON.stringify({ filePath, options }));
      const cachePath = path.join(CACHE_DIR, optionsHash);
      
      // Если кэш существует, сразу отдаем его
      if (fs.existsSync(cachePath)) {
        const stats = fs.statSync(cachePath);
        const extension = getExtension(fullPath);
        const mimeType = getMimeType(extension);
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Кэш на 1 год
        res.setHeader('X-CDN-Cache', 'HIT');
        
        fs.createReadStream(cachePath).pipe(res);
        return;
      }
      
      // Если кэш не найден, обрабатываем изображение
      if (isProcessableImage(fullPath) && (options.width || options.height || options.format)) {
        const extension = options.format || getExtension(fullPath).substring(1);
        const mimeType = getMimeType('.' + extension);
        
        let transformer = sharp(fullPath);
        
        // Изменение размера, если указаны параметры
        if (options.width || options.height) {
          transformer = transformer.resize(options.width, options.height);
        }
        
        // Преобразование формата, если указан
        if (options.format) {
          if (options.format === 'jpeg' || options.format === 'jpg') {
            transformer = transformer.jpeg({ quality: options.quality });
          } else if (options.format === 'png') {
            transformer = transformer.png();
          } else if (options.format === 'webp') {
            transformer = transformer.webp({ quality: options.quality });
          } else if (options.format === 'avif') {
            transformer = transformer.avif({ quality: options.quality });
          }
        }
        
        // Сохраняем в кэш
        await transformer.toFile(cachePath);
        
        // Отправляем результат
        const stats = fs.statSync(cachePath);
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Кэш на 1 год
        res.setHeader('X-CDN-Cache', 'MISS');
        
        fs.createReadStream(cachePath).pipe(res);
      } else {
        // Если формат не поддерживается для обработки, просто отдаем оригинал
        const stats = fs.statSync(fullPath);
        const extension = getExtension(fullPath);
        const mimeType = getMimeType(extension);
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Кэш на 1 год
        res.setHeader('X-CDN-Processed', 'false');
        
        fs.createReadStream(fullPath).pipe(res);
      }
    } catch (error) {
      console.error('CDN Error:', error);
      res.status(500).json({ error: 'Error processing image' });
    }
  }
  
  /**
   * Создает URL для CDN с опциональными параметрами обработки
   */
  public static createCdnUrl(filePath: string, options: ResizeOptions = {}): string {
    const baseUrl = '/cdn';
    const params = new URLSearchParams();
    
    if (options.width) params.append('width', options.width.toString());
    if (options.height) params.append('height', options.height.toString());
    if (options.format) params.append('format', options.format);
    if (options.quality) params.append('quality', options.quality.toString());
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    
    // Если путь начинается с "/", удаляем его для корректного формирования URL
    const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    
    return `${baseUrl}/${normalizedPath}${queryString}`;
  }
  
  /**
   * Очищает кэш для конкретного изображения или всего кэша
   */
  public clearCache(imagePath?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (imagePath) {
          // Очистка кэша для конкретного изображения
          // Для этого нам нужно найти все файлы, связанные с этим изображением
          const files = fs.readdirSync(CACHE_DIR);
          for (const file of files) {
            if (file.includes(imagePath)) {
              fs.unlinkSync(path.join(CACHE_DIR, file));
            }
          }
        } else {
          // Очистка всего кэша
          if (fs.existsSync(CACHE_DIR)) {
            const files = fs.readdirSync(CACHE_DIR);
            for (const file of files) {
              fs.unlinkSync(path.join(CACHE_DIR, file));
            }
          }
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Создаем и экспортируем экземпляр сервиса
export const cdnService = new CdnService();