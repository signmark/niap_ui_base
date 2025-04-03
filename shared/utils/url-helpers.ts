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
  
  // Если URL содержит Directus UUID (с расширением или без)
  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  const match = fileUrl.match(uuidRegex);
  
  if (match) {
    const uuid = match[0];
    
    // Проверяем, есть ли в строке расширение файла после UUID
    const hasExtension = /\.[a-z0-9]{3,4}$/i.test(fileUrl);
    
    // Если расширение уже есть в URL, используем его, иначе добавляем .jpg
    if (hasExtension) {
      // Извлекаем расширение из исходного URL
      const extension = fileUrl.substring(fileUrl.lastIndexOf('.'));
      return `https://directus.nplanner.ru/assets/${uuid}${extension}`;
    } else {
      // Добавляем расширение .jpg, чтобы Directus корректно определил MIME-тип
      return `https://directus.nplanner.ru/assets/${uuid}.jpg`;
    }
  }
  
  // Проверяем, это URL Directus в старом формате?
  const isDirectusUrl = fileUrl.includes('directus.nplanner.ru') || 
                       fileUrl.includes('assets.directus') || 
                       fileUrl.includes('files.directus');
  
  // Если это URL Directus, но не в новом формате - используем прокси
  if (isDirectusUrl) {
    console.log('Используем прокси для старого формата URL Directus:', fileUrl);
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