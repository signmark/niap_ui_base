/**
 * Утилиты для работы с URL
 */

/**
 * Преобразует URL файла Directus в прокси-URL, чтобы обойти проблемы с CORS и доступом
 * @param fileUrl Исходный URL файла из Directus
 * @returns URL для доступа к файлу через прокси
 */
export function getProxiedFileUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  
  // Если это локальный URL (начинается с /) - оставляем как есть
  if (fileUrl.startsWith('/uploads/')) {
    return fileUrl;
  }
  
  // Если это уже прокси-URL - оставляем как есть
  if (fileUrl.includes('/api/proxy-file')) {
    return fileUrl;
  }
  
  // Проверяем, это URL Directus?
  const isDirectusUrl = fileUrl.includes('directus.nplanner.ru') || 
                         fileUrl.includes('assets.directus') || 
                         fileUrl.includes('files.directus');
  
  // Если это URL Directus - формируем прокси-URL
  if (isDirectusUrl) {
    return `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;
  }
  
  // Иначе возвращаем URL как есть
  return fileUrl;
}

/**
 * Получает URL для отображения превью изображения (корректирует URL для избежания проблем с CORS)
 * @param imageUrl URL изображения
 * @returns URL для отображения превью
 */
export function getImagePreviewUrl(imageUrl: string): string {
  if (!imageUrl) {
    return '/placeholder-image.png';
  }
  
  return getProxiedFileUrl(imageUrl);
}