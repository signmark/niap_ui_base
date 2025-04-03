/**
 * Утилиты для работы с URL
 */

/**
 * Преобразует URL файла Directus в прямой URL с правильным форматом
 * @param fileUrl Исходный URL файла из Directus
 * @returns URL для доступа к файлу
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
  
  // Для всех URL Directus, содержащих UUID, используем наш прокси для решения CORS
  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  const match = fileUrl.match(uuidRegex);
  
  if (match && (fileUrl.includes('directus.nplanner.ru') || fileUrl.includes('assets/') || fileUrl.includes('assets?'))) {
    console.log('Используем прокси для URL Directus с UUID:', fileUrl);
    return `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;
  }
  
  // Проверяем, это URL Directus в любом формате?
  const isDirectusUrl = fileUrl.includes('directus.nplanner.ru') || 
                       fileUrl.includes('assets.directus') || 
                       fileUrl.includes('files.directus');
  
  // Для любого URL Directus используем прокси
  if (isDirectusUrl) {
    console.log('Используем прокси для формата URL Directus:', fileUrl);
    return `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;
  }
  
  // Если URL начинается с https://v3.fal.media/ - это сгенерированное изображение, используем прокси
  if (fileUrl.startsWith('https://v3.fal.media/') || fileUrl.startsWith('https://fal.media/')) {
    console.log('Используем прокси для fal.media URL:', fileUrl);
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