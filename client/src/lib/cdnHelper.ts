/**
 * Преобразует URL изображения в URL для CDN с опциями оптимизации.
 * @param imageUrl Исходный URL изображения
 * @param options Опции оптимизации (ширина, высота, качество)
 * @returns URL для CDN
 */
export function getCdnImageUrl(
  imageUrl: string | null | undefined,
  options: {
    width?: number;
    height?: number;
    quality?: number;
  } = {}
): string {
  // Если URL не указан, возвращаем URL заглушки
  if (!imageUrl) {
    return '/placeholder.png';
  }

  // Если это абсолютный URL внешнего источника, возвращаем как есть
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Исключаем локальные URL
    if (!imageUrl.includes('localhost') && !imageUrl.includes('127.0.0.1') && !imageUrl.includes('0.0.0.0')) {
      return imageUrl;
    }
  }

  // Если это URL из нашей uploads директории, преобразуем в CDN URL
  if (imageUrl.startsWith('/uploads/')) {
    const filename = imageUrl.split('/').pop();
    if (!filename) return '/placeholder.png';

    let cdnUrl = `/cdn/image/${filename}`;
    
    // Добавляем параметры оптимизации
    const params = new URLSearchParams();
    if (options.width) params.append('w', options.width.toString());
    if (options.height) params.append('h', options.height.toString());
    if (options.quality) params.append('q', options.quality.toString());
    
    const queryString = params.toString();
    if (queryString) {
      cdnUrl += `?${queryString}`;
    }
    
    return cdnUrl;
  }

  // В других случаях просто возвращаем исходный URL
  return imageUrl;
}

/**
 * Преобразует массив URL изображений в массив URL для CDN.
 * @param imageUrls Массив исходных URL изображений
 * @param options Опции оптимизации (ширина, высота, качество)
 * @returns Массив URL для CDN
 */
export function getCdnImageUrls(
  imageUrls: (string | null | undefined)[] | null | undefined,
  options: {
    width?: number;
    height?: number;
    quality?: number;
  } = {}
): string[] {
  if (!imageUrls || !Array.isArray(imageUrls)) {
    return [];
  }

  return imageUrls
    .filter((url): url is string => !!url)
    .map(url => getCdnImageUrl(url, options));
}