/**
 * Обновленная функция processImageUrl для использования прокси-маршрута
 * @param imageUrl Исходный URL изображения
 * @param platform Платформа, для которой обрабатывается URL
 * @returns Обработанный URL для использования
 */
function processImageUrl(imageUrl: string, platform: string): string {
  if (!imageUrl) return '';
  
  console.log(`▶️ Обработка URL изображения для ${platform}: ${imageUrl}`);
  
  // Базовый URL сервера для относительных путей
  const baseAppUrl = process.env.BASE_URL || 'https://nplanner.replit.app';
  
  // Проверяем случай, когда в URL уже есть наш собственный прокси (во избежание двойного проксирования)
  if (imageUrl.includes('/api/proxy-file') || imageUrl.includes('/api/proxy-media')) {
    console.log(`✅ URL уже содержит прокси, используем как есть для ${platform}: ${imageUrl}`);
    return imageUrl;
  }
  
  // Если URL содержит Directus URL
  if (imageUrl.includes('directus.nplanner.ru')) {
    // Формируем URL через прокси-файл для доступа к ресурсу
    const encodedUrl = encodeURIComponent(imageUrl);
    const proxyUrl = `${baseAppUrl}/api/proxy-file?url=${encodedUrl}&_t=${Date.now()}`;
    console.log(`🔄 Обнаружен Directus URL для ${platform}, создан прокси URL: ${proxyUrl}`);
    return proxyUrl;
  }
  
  // Проверка на чистый UUID (без путей)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(imageUrl)) {
    // Формируем полный URL для Directus и затем проксируем его
    const directusUrl = `https://directus.nplanner.ru/assets/${imageUrl}`;
    const encodedUrl = encodeURIComponent(directusUrl);
    const proxyUrl = `${baseAppUrl}/api/proxy-file?url=${encodedUrl}&_t=${Date.now()}`;
    console.log(`🔄 Обнаружен чистый UUID для ${platform}, создан прокси URL: ${proxyUrl}`);
    return proxyUrl;
  }
  
  // Если URL уже абсолютный (начинается с http/https)
  if (imageUrl.startsWith('http')) {
    // Всегда используем прокси для внешних URL для обхода CORS и других ограничений
    const encodedUrl = encodeURIComponent(imageUrl);
    const proxyUrl = `${baseAppUrl}/api/proxy-file?url=${encodedUrl}&_t=${Date.now()}`;
    console.log(`🔄 Обнаружен внешний URL для ${platform}, создан прокси URL: ${proxyUrl}`);
    return proxyUrl;
  }
  
  // Проверяем, является ли путь относительным (начинается с /)
  if (imageUrl.startsWith('/')) {
    // Формируем полный URL с базовым урлом сервера и проксируем его
    const fullUrl = `${baseAppUrl}${imageUrl}`;
    const encodedUrl = encodeURIComponent(fullUrl);
    const proxyUrl = `${baseAppUrl}/api/proxy-file?url=${encodedUrl}&_t=${Date.now()}`;
    console.log(`🔄 Относительный путь преобразован в прокси URL для ${platform}: ${proxyUrl}`);
    return proxyUrl;
  }
  
  // Для всех остальных случаев предполагаем, что это относительный путь без начального слеша
  const fullUrl = `${baseAppUrl}/${imageUrl}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const proxyUrl = `${baseAppUrl}/api/proxy-file?url=${encodedUrl}&_t=${Date.now()}`;
  console.log(`🔄 Относительный путь без / преобразован в прокси URL для ${platform}: ${proxyUrl}`);
  return proxyUrl;
}