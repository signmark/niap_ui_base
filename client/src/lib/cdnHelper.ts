/**
 * Утилиты для работы с CDN и оптимизированными изображениями
 */

/**
 * Формирует URL для изображения из CDN
 * @param path Путь к изображению или полный URL
 * @returns URL с CDN
 */
export function getCdnUrl(path: string): string {
  if (!path) return '';
  
  // Если уже полный URL, возвращаем его
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Если путь начинается с /cdn, то это уже ссылка на CDN
  if (path.startsWith('/cdn/')) {
    return path;
  }
  
  // Если путь начинается с /uploads, но не с /uploads/cdn,
  // преобразуем его в CDN путь
  if (path.startsWith('/uploads/') && !path.includes('/cdn/')) {
    return `/cdn${path.replace('/uploads', '')}`;
  }
  
  // Просто добавляем /cdn/ перед путем
  return `/cdn/${path}`;
}

/**
 * Получает URL изображения для предпросмотра
 * @param path Путь к изображению или полный URL
 * @param width Ширина изображения (по умолчанию 300)
 * @returns URL с CDN для предпросмотра
 */
export function getImageThumbnail(path: string, width: number = 300): string {
  if (!path) return '';
  
  const cdnUrl = getCdnUrl(path);
  // Добавляем параметры для CDN оптимизации
  return `${cdnUrl}?width=${width}&format=webp`;
}

/**
 * Получает URL оптимизированного изображения
 * @param path Путь к изображению или полный URL
 * @param width Ширина изображения (по умолчанию 1200)
 * @param format Формат изображения (по умолчанию webp)
 * @returns URL с CDN для оптимизированного изображения
 */
export function getOptimizedImage(path: string, width: number = 1200, format: string = 'webp'): string {
  if (!path) return '';
  
  const cdnUrl = getCdnUrl(path);
  // Добавляем параметры для CDN оптимизации
  return `${cdnUrl}?width=${width}&format=${format}`;
}

/**
 * Проверяет, существует ли изображение
 * @param path Путь к изображению или полный URL
 * @returns Промис с результатом проверки
 */
export async function imageExists(path: string): Promise<boolean> {
  if (!path) return false;
  
  try {
    const cdnUrl = getCdnUrl(path);
    const response = await fetch(cdnUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Error checking image existence:', error);
    return false;
  }
}

/**
 * Преобразует относительный путь к файлу в полный URL
 * @param path Путь к файлу
 * @returns Полный URL к файлу
 */
export function getFileUrl(path: string): string {
  if (!path) return '';
  
  // Если уже полный URL, возвращаем его
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Если путь начинается с /, то это уже от корня
  if (path.startsWith('/')) {
    return path;
  }
  
  // Добавляем / перед путем
  return `/${path}`;
}