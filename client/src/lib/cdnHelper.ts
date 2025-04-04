/**
 * Вспомогательные функции для работы с CDN
 */

interface CdnOptions {
  width?: number;
  height?: number;
  format?: string;
  quality?: number;
}

/**
 * Преобразует URL изображения в URL для CDN
 * 
 * @param imageUrl URL изображения
 * @param options Опции для оптимизации (ширина, высота, формат, качество)
 * @returns URL для доступа к изображению через CDN
 */
export function getCdnUrl(imageUrl: string, options: CdnOptions = {}): string {
  // Если изображение отсутствует или это уже CDN URL, возвращаем как есть
  if (!imageUrl || imageUrl.startsWith('/cdn/')) {
    return imageUrl;
  }

  // Если это URL из Directus, сохраняем как есть
  if (imageUrl.includes('directus.nplanner.ru')) {
    return imageUrl;
  }

  // Если это внешний URL (начинается с http:// или https://), возвращаем как есть
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // Если это путь к файлу в uploads, преобразуем в CDN URL
  if (imageUrl.startsWith('/uploads/')) {
    // Удаляем начальный слеш для правильного формирования пути в CDN
    const filePath = imageUrl.substring(1);
    
    // Формируем параметры запроса
    const params = new URLSearchParams();
    if (options.width) params.append('width', options.width.toString());
    if (options.height) params.append('height', options.height.toString());
    if (options.format) params.append('format', options.format);
    if (options.quality) params.append('quality', options.quality.toString());
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    
    return `/cdn/${filePath}${queryString}`;
  }

  // Для остальных случаев предполагаем, что это относительный путь в uploads
  // Формируем параметры запроса
  const params = new URLSearchParams();
  if (options.width) params.append('width', options.width.toString());
  if (options.height) params.append('height', options.height.toString());
  if (options.format) params.append('format', options.format);
  if (options.quality) params.append('quality', options.quality.toString());
  
  const queryString = params.toString() ? `?${params.toString()}` : '';
  
  // Удаляем начальный слеш, если он есть
  const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
  
  return `/cdn/uploads/${cleanPath}${queryString}`;
}

/**
 * Преобразует URL изображения в URL для превью (миниатюры)
 * 
 * @param imageUrl URL изображения
 * @param width Ширина превью
 * @param height Высота превью (если не указана, вычисляется пропорционально)
 * @returns URL для доступа к миниатюре изображения через CDN
 */
export function getImageThumbnail(imageUrl: string, width: number = 300, height?: number): string {
  return getCdnUrl(imageUrl, { 
    width, 
    height, 
    format: 'webp', 
    quality: 85 
  });
}

/**
 * Преобразует URL изображения в оптимизированный URL для CDN
 * 
 * @param imageUrl URL изображения
 * @returns URL для доступа к оптимизированному изображению через CDN
 */
export function getOptimizedImage(imageUrl: string): string {
  return getCdnUrl(imageUrl, { 
    format: 'webp', 
    quality: 90 
  });
}