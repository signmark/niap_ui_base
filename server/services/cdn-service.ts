import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { logger } from '../utils/logger';

// Корневая директория для хранения загруженных файлов
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
// Корневая директория для хранения оптимизированных файлов (CDN)
const CDN_DIR = path.join(process.cwd(), 'uploads', 'cdn');

// Создаем директории, если они не существуют
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  logger.info(`[CDN] Создана директория для загрузок: ${UPLOADS_DIR}`);
}

if (!fs.existsSync(CDN_DIR)) {
  fs.mkdirSync(CDN_DIR, { recursive: true });
  logger.info(`[CDN] Создана директория для CDN: ${CDN_DIR}`);
}

/**
 * Возвращает имя файла из URL или пути
 * @param url URL или путь к файлу
 * @returns Имя файла
 */
export function getFilenameFromUrl(url: string): string {
  // Удаляем все параметры из URL (часть после ?)
  const urlWithoutParams = url.split('?')[0];
  // Получаем имя файла из URL или пути
  const filename = path.basename(urlWithoutParams);
  return filename;
}

/**
 * Преобразует URL в локальный путь к файлу, поддерживая различные форматы URL
 * @param url URL, который нужно преобразовать
 * @returns Локальный путь к файлу
 */
export function resolveLocalPath(url: string): string {
  // Если URL пустой, возвращаем путь к placeholder изображению
  if (!url) {
    return path.join(process.cwd(), 'public', 'placeholder.png');
  }

  // Если URL является относительным и начинается с /
  if (url.startsWith('/')) {
    // Если это путь к файлу, загруженному в uploads
    if (url.startsWith('/uploads/')) {
      return path.join(process.cwd(), url);
    }
    // Для других относительных путей
    return path.join(process.cwd(), 'public', url);
  }

  // Если URL содержит http:// или https:// и указывает на локальный сервер
  const isLocalUrl = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0');
  if ((url.startsWith('http://') || url.startsWith('https://')) && isLocalUrl) {
    // Извлекаем путь из URL (без домена и протокола)
    const urlPath = new URL(url).pathname;
    if (urlPath.startsWith('/uploads/')) {
      return path.join(process.cwd(), urlPath);
    }
    return path.join(process.cwd(), 'public', urlPath);
  }

  // В других случаях предполагаем, что путь уже является локальным
  if (fs.existsSync(url)) {
    return url;
  }

  // Проверяем, существует ли файл в директории uploads
  const uploadsPath = path.join(UPLOADS_DIR, getFilenameFromUrl(url));
  if (fs.existsSync(uploadsPath)) {
    return uploadsPath;
  }

  // Если не удалось найти файл, возвращаем путь к placeholder изображению
  logger.warn(`[CDN] Не удалось найти файл: ${url}, используем placeholder`);
  return path.join(process.cwd(), 'public', 'placeholder.png');
}

/**
 * Получает информацию об оптимизированном изображении
 * @param imageUrl URL или путь к исходному изображению
 * @param width Ширина оптимизированного изображения (опционально)
 * @param height Высота оптимизированного изображения (опционально)
 * @param quality Качество оптимизированного изображения (1-100, опционально)
 * @returns Объект с путем к файлу и URL для CDN
 */
export function getOptimizedImageInfo(
  imageUrl: string,
  width?: number,
  height?: number,
  quality: number = 80
): { filePath: string; cdnUrl: string } {
  try {
    // Получаем локальный путь к исходному изображению
    const localPath = resolveLocalPath(imageUrl);
    
    // Получаем имя исходного файла
    const originalFilename = getFilenameFromUrl(localPath);
    
    // Если файл не существует, возвращаем placeholder
    if (!fs.existsSync(localPath)) {
      logger.warn(`[CDN] Файл не найден: ${localPath}`);
      return {
        filePath: path.join(process.cwd(), 'public', 'placeholder.png'),
        cdnUrl: '/placeholder.png'
      };
    }
    
    // Генерируем хеш для создания уникального имени файла
    const hash = crypto
      .createHash('md5')
      .update(`${localPath}_${width || 'auto'}_${height || 'auto'}_${quality}`)
      .digest('hex')
      .substring(0, 10);
    
    // Определяем расширение исходного файла
    const ext = path.extname(localPath).toLowerCase();
    
    // Формируем имя для оптимизированного файла
    const optimizedFilename = `${path.basename(localPath, ext)}_${hash}${ext}`;
    const optimizedPath = path.join(CDN_DIR, optimizedFilename);
    
    // Формируем URL для CDN
    let cdnUrl = `/cdn/image/${optimizedFilename}`;
    
    // Добавляем параметры оптимизации в URL, если они указаны
    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    if (quality !== 80) params.append('q', quality.toString());
    
    const queryString = params.toString();
    if (queryString) {
      cdnUrl += `?${queryString}`;
    }
    
    // Если оптимизированный файл уже существует, просто возвращаем его информацию
    if (fs.existsSync(optimizedPath)) {
      return { filePath: optimizedPath, cdnUrl };
    }
    
    // Иначе создаем оптимизированную версию
    let transformer = sharp(localPath);
    
    // Применяем изменение размера, если указаны width или height
    if (width || height) {
      transformer = transformer.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    
    // Применяем компрессию в зависимости от формата
    if (ext === '.jpg' || ext === '.jpeg') {
      transformer = transformer.jpeg({ quality });
    } else if (ext === '.png') {
      transformer = transformer.png({ quality: Math.floor(quality * 0.8) });
    } else if (ext === '.webp') {
      transformer = transformer.webp({ quality });
    } else if (ext === '.avif') {
      transformer = transformer.avif({ quality });
    }
    
    // Сохраняем оптимизированный файл
    transformer.toFile(optimizedPath, (err) => {
      if (err) {
        logger.error(`[CDN] Ошибка при оптимизации изображения: ${err.message}`);
      } else {
        logger.info(`[CDN] Создан оптимизированный файл: ${optimizedPath}`);
      }
    });
    
    // Возвращаем информацию об оптимизированном файле
    return { filePath: optimizedPath, cdnUrl };
  } catch (error) {
    logger.error(`[CDN] Ошибка в getOptimizedImageInfo: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    // В случае ошибки возвращаем информацию об оригинальном файле
    const localPath = resolveLocalPath(imageUrl);
    return {
      filePath: localPath,
      cdnUrl: `/uploads/${getFilenameFromUrl(localPath)}`
    };
  }
}

/**
 * Получает путь к оптимизированному изображению для локального использования
 * @param imageUrl URL или путь к исходному изображению
 * @param width Ширина оптимизированного изображения (опционально)
 * @param height Высота оптимизированного изображения (опционально)
 * @param quality Качество оптимизированного изображения (1-100, опционально)
 * @returns Полный путь к оптимизированному изображению
 */
export function getOptimizedImagePath(
  imageUrl: string,
  width?: number,
  height?: number,
  quality: number = 80
): string {
  const { filePath } = getOptimizedImageInfo(imageUrl, width, height, quality);
  return filePath;
}

/**
 * Получает URL оптимизированного изображения для использования в CDN
 * @param imageUrl URL или путь к исходному изображению
 * @param width Ширина оптимизированного изображения (опционально)
 * @param height Высота оптимизированного изображения (опционально)
 * @param quality Качество оптимизированного изображения (1-100, опционально)
 * @returns URL для доступа к оптимизированному изображению через CDN
 */
export function getOptimizedImageUrl(
  imageUrl: string,
  width?: number,
  height?: number,
  quality: number = 80
): string {
  const { cdnUrl } = getOptimizedImageInfo(imageUrl, width, height, quality);
  return cdnUrl;
}