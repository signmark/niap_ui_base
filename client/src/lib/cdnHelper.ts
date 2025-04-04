/**
 * Хелпер для работы с CDN и оптимизацией изображений
 */

/**
 * Опции для оптимизации изображения
 */
export interface CdnOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
}

/**
 * Получает оптимизированный URL изображения
 * @param url URL изображения (абсолютный или относительный)
 * @param options Опции оптимизации
 * @returns Оптимизированный URL для CDN
 */
export function getCdnUrl(url: string, options: CdnOptions = {}): string {
  // Проверяем, есть ли URL
  if (!url) {
    return '';
  }
  
  // Проверяем, является ли URL внешним
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Для внешних URL мы не применяем CDN
    return url;
  }
  
  // Нормализуем URL (убираем начальный слеш, если он есть)
  const normalizedPath = url.startsWith('/') ? url.slice(1) : url;
  
  // Если URL уже указывает на CDN, возвращаем его как есть
  if (normalizedPath.startsWith('uploads/cdn/')) {
    return `/${normalizedPath}`;
  }
  
  // Базовый путь к CDN
  const cdnBasePath = '/api/cdn';
  
  // Параметры запроса
  const queryParams = new URLSearchParams();
  
  // Добавляем параметры оптимизации, если они указаны
  if (options.width) queryParams.append('width', options.width.toString());
  if (options.height) queryParams.append('height', options.height.toString());
  if (options.quality) queryParams.append('quality', options.quality.toString());
  if (options.format) queryParams.append('format', options.format);
  
  // Формируем итоговый URL
  const queryString = queryParams.toString();
  const cdnUrl = `${cdnBasePath}/${normalizedPath}${queryString ? `?${queryString}` : ''}`;
  
  return cdnUrl;
}

/**
 * Получает URL для изображения с адаптивными размерами
 * @param url URL изображения
 * @param size Размер изображения (маленький, средний, большой)
 * @returns Оптимизированный URL с соответствующими размерами
 */
export function getResponsiveImageUrl(url: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  if (!url) return '';
  
  const sizeMap: Record<string, CdnOptions> = {
    small: { width: 320, quality: 70 },
    medium: { width: 768, quality: 80 },
    large: { width: 1280, quality: 85 }
  };
  
  return getCdnUrl(url, sizeMap[size]);
}