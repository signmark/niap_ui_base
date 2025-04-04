import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { logger } from '../utils/logger';

export interface CdnOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
}

/**
 * Сервис для работы с CDN и оптимизацией изображений
 */
export class CdnService {
  private uploadsDir: string;
  private cdnCacheDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.cdnCacheDir = path.join(this.uploadsDir, 'cdn');
    
    // Создаем папку для CDN кэша, если она не существует
    if (!fs.existsSync(this.cdnCacheDir)) {
      fs.mkdirSync(this.cdnCacheDir, { recursive: true });
    }

    logger.info(`[CDN] CDN initialized with cache directory: ${this.cdnCacheDir}`);
  }

  /**
   * Обрабатывает изображение и возвращает путь к оптимизированной версии
   * @param filePath Относительный путь к изображению (относительно uploads директории)
   * @param options Опции для оптимизации изображения
   * @returns Путь к оптимизированному изображению или null в случае ошибки
   */
  async processImage(filePath: string, options: CdnOptions = {}): Promise<string | null> {
    try {
      // Определяем пути к файлам
      const fullSourcePath = this.getFullPath(filePath);
      
      // Проверяем существование исходного файла
      if (!fs.existsSync(fullSourcePath)) {
        logger.warn(`[CDN] Source file not found: ${fullSourcePath}`);
        return null;
      }

      // Генерируем имя для кэшированного файла
      const cacheFileName = this.generateCacheFileName(filePath, options);
      const fullCachePath = path.join(this.cdnCacheDir, cacheFileName);
      
      // Если кэшированный файл уже существует, возвращаем его путь
      if (fs.existsSync(fullCachePath)) {
        return `/uploads/cdn/${cacheFileName}`;
      }

      // Определяем формат вывода
      const outputFormat = options.format || path.extname(filePath).substring(1) || 'jpeg';
      
      // Создаем объект Sharp для обработки изображения
      let sharpImage = sharp(fullSourcePath);
      
      // Применяем опции
      if (options.width || options.height) {
        sharpImage = sharpImage.resize({
          width: options.width,
          height: options.height,
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Устанавливаем формат вывода
      switch (outputFormat.toLowerCase()) {
        case 'jpg':
        case 'jpeg':
          sharpImage = sharpImage.jpeg({ quality: options.quality || 80 });
          break;
        case 'png':
          sharpImage = sharpImage.png({ quality: options.quality || 80 });
          break;
        case 'webp':
          sharpImage = sharpImage.webp({ quality: options.quality || 80 });
          break;
        case 'avif':
          sharpImage = sharpImage.avif({ quality: options.quality || 50 });
          break;
        default:
          sharpImage = sharpImage.jpeg({ quality: options.quality || 80 });
      }
      
      // Записываем обработанное изображение в файл
      await sharpImage.toFile(fullCachePath);
      
      logger.info(`[CDN] Image processed successfully: ${cacheFileName}`);
      return `/uploads/cdn/${cacheFileName}`;
    } catch (error) {
      logger.error(`[CDN] Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Получает относительный путь к изображению
   * @param urlPath URL или путь к изображению
   * @returns Относительный путь к изображению
   */
  getRelativePath(urlPath: string): string {
    // Удаляем любые параметры из URL
    const pathWithoutParams = urlPath.split('?')[0];
    
    // Удаляем '/uploads/' из пути, если он есть
    if (pathWithoutParams.startsWith('/uploads/')) {
      return pathWithoutParams.slice(9);
    }
    
    // Удаляем начальный слеш, если он есть
    if (pathWithoutParams.startsWith('/')) {
      return pathWithoutParams.slice(1);
    }
    
    return pathWithoutParams;
  }

  /**
   * Получает полный путь к файлу
   * @param relativePath Относительный путь к файлу
   * @returns Полный путь к файлу
   */
  getFullPath(relativePath: string): string {
    return path.join(this.uploadsDir, this.getRelativePath(relativePath));
  }

  /**
   * Генерирует имя файла для кэширования
   * @param filePath Путь к исходному файлу
   * @param options Опции обработки
   * @returns Имя файла для кэширования
   */
  private generateCacheFileName(filePath: string, options: CdnOptions): string {
    const { width, height, quality, format } = options;
    
    const filename = path.basename(filePath, path.extname(filePath));
    const fileExt = format || path.extname(filePath).substring(1) || 'jpg';
    
    const sizeStr = width || height ? `_${width || 'auto'}x${height || 'auto'}` : '';
    const qualityStr = quality ? `_q${quality}` : '';
    
    return `${filename}${sizeStr}${qualityStr}.${fileExt}`;
  }
}

export const cdnService = new CdnService();