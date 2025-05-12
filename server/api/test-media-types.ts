import express, { Request, Response } from 'express';
import { log } from '../utils/logger';

/**
 * Тестовый маршрут для проверки функции определения типа медиа
 */
export function registerMediaTypesTestRoute(app: express.Express) {
  /**
   * Универсальная функция для определения типа медиа файла
   * Обрабатывает различные форматы объектов и URL
   * @param mediaItem - Медиа-объект или URL-строка
   * @returns 'VIDEO' или 'IMAGE' в зависимости от определения типа
   */
  function determineMediaType(mediaItem: string | any): string {
    // Логируем входные данные для начала
    log(`[MediaTest] Определение типа для: ${typeof mediaItem === 'string' ? 
      mediaItem.substring(0, 30) + '...' : 
      (typeof mediaItem === 'object' ? 'Объект' : typeof mediaItem)}`, 'media-test');
    
    // Обработка null или undefined значений
    if (mediaItem === null || mediaItem === undefined) {
      log(`[MediaTest] Получен null/undefined, по умолчанию будет использован тип IMAGE`, 'media-test');
      return 'IMAGE';
    }
    
    // Обработка объектов
    if (typeof mediaItem !== 'string') {
      // Если это массив, обрабатываем первый элемент
      if (Array.isArray(mediaItem)) {
        if (mediaItem.length === 0) {
          log(`[MediaTest] Получен пустой массив, по умолчанию будет использован тип IMAGE`, 'media-test');
          return 'IMAGE';
        }
        log(`[MediaTest] Обрабатываю первый элемент массива`, 'media-test');
        return determineMediaType(mediaItem[0]);
      }
      
      // Если это объект, ищем в нем тип или URL
      if (mediaItem && typeof mediaItem === 'object') {
        // 1. Проверка явного поля type
        if (mediaItem.type) {
          const typeStr = String(mediaItem.type).toLowerCase();
          if (typeStr === 'video' || typeStr.includes('video')) {
            log(`[MediaTest] Тип определен из объекта: VIDEO (из поля type: ${mediaItem.type})`, 'media-test');
            return 'VIDEO';
          }
          if (typeStr === 'image' || typeStr.includes('image') || typeStr === 'photo' || typeStr.includes('photo')) {
            log(`[MediaTest] Тип определен из объекта: IMAGE (из поля type: ${mediaItem.type})`, 'media-test');
            return 'IMAGE';
          }
        }
        
        // 2. Проверка поля mediaType
        if (mediaItem.mediaType) {
          const mediaTypeStr = String(mediaItem.mediaType).toLowerCase();
          if (mediaTypeStr === 'video' || mediaTypeStr.includes('video')) {
            log(`[MediaTest] Тип определен из объекта: VIDEO (из поля mediaType: ${mediaItem.mediaType})`, 'media-test');
            return 'VIDEO';
          }
          if (mediaTypeStr === 'image' || mediaTypeStr.includes('image') || mediaTypeStr === 'photo' || mediaTypeStr.includes('photo')) {
            log(`[MediaTest] Тип определен из объекта: IMAGE (из поля mediaType: ${mediaItem.mediaType})`, 'media-test');
            return 'IMAGE';
          }
        }
        
        // 3. Проверка поля mime или mimeType
        if (mediaItem.mime || mediaItem.mimeType) {
          const mimeStr = String(mediaItem.mime || mediaItem.mimeType).toLowerCase();
          if (mimeStr.includes('video/')) {
            log(`[MediaTest] Тип определен из объекта: VIDEO (из поля mime: ${mimeStr})`, 'media-test');
            return 'VIDEO';
          }
          if (mimeStr.includes('image/')) {
            log(`[MediaTest] Тип определен из объекта: IMAGE (из поля mime: ${mimeStr})`, 'media-test');
            return 'IMAGE';
          }
        }
        
        // 4. Проверка на основе имени файла, если оно есть
        if (mediaItem.filename || mediaItem.fileName || mediaItem.name) {
          const filename = String(mediaItem.filename || mediaItem.fileName || mediaItem.name).toLowerCase();
          log(`[MediaTest] Проверка имени файла: ${filename}`, 'media-test');
          
          // Проверка по расширению файла
          const videoExtensions = ['.mp4', '.mov', '.avi', '.mpeg', '.mpg', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
          if (videoExtensions.some(ext => filename.endsWith(ext))) {
            log(`[MediaTest] Тип определен по имени файла: VIDEO (${filename})`, 'media-test');
            return 'VIDEO';
          }
          
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.ico', '.heic', '.heif'];
          if (imageExtensions.some(ext => filename.endsWith(ext))) {
            log(`[MediaTest] Тип определен по имени файла: IMAGE (${filename})`, 'media-test');
            return 'IMAGE';
          }
        }
        
        // 5. Если есть URL в объекте, используем его для определения
        const possibleUrlFields = ['url', 'file', 'src', 'source', 'path', 'link', 'href'];
        for (const field of possibleUrlFields) {
          if (mediaItem[field] && typeof mediaItem[field] === 'string') {
            log(`[MediaTest] Определение типа по полю ${field} из объекта: ${mediaItem[field].substring(0, 30)}...`, 'media-test');
            const typeByUrl = determineMediaTypeFromUrl(mediaItem[field]);
            if (typeByUrl) {
              return typeByUrl;
            }
          }
        }
        
        log(`[MediaTest] Не удалось определить тип из объекта: ${JSON.stringify(mediaItem).substring(0, 100)}...`, 'media-test');
      }
      
      // Если мы не смогли определить тип из объекта, используем тип по умолчанию
      return 'IMAGE';
    }
    
    // Если mediaItem - строка, определяем тип по URL
    return determineMediaTypeFromUrl(mediaItem);
  }
  
  /**
   * Вспомогательная функция для определения типа медиа по URL
   * @param url - URL медиа-файла
   * @returns 'VIDEO', 'IMAGE' или null, если не удалось определить тип
   */
  function determineMediaTypeFromUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return 'IMAGE'; // По умолчанию
    }
    
    const urlLower = url.toLowerCase();
    
    // Проверка по расширению файла
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mpeg', '.mpg', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
    if (videoExtensions.some(ext => urlLower.endsWith(ext))) {
      log(`[MediaTest] Тип определен по расширению файла: VIDEO (${urlLower})`, 'media-test');
      return 'VIDEO';
    }
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.ico', '.heic', '.heif'];
    if (imageExtensions.some(ext => urlLower.endsWith(ext))) {
      log(`[MediaTest] Тип определен по расширению файла: IMAGE (${urlLower})`, 'media-test');
      return 'IMAGE';
    }
    
    // Проверка по ключевым словам в URL
    const videoKeywords = ['video', 'mp4', 'mov', 'avi', 'movie', 'film'];
    if (videoKeywords.some(keyword => urlLower.includes(keyword))) {
      log(`[MediaTest] Тип определен по ключевым словам в URL: VIDEO (${urlLower})`, 'media-test');
      return 'VIDEO';
    }
    
    const imageKeywords = ['image', 'photo', 'picture', 'pic', 'img', 'jpg', 'jpeg', 'png'];
    if (imageKeywords.some(keyword => urlLower.includes(keyword))) {
      log(`[MediaTest] Тип определен по ключевым словам в URL: IMAGE (${urlLower})`, 'media-test');
      return 'IMAGE';
    }
    
    // Если не удалось определить, используем тип по умолчанию
    log(`[MediaTest] Не удалось определить тип по URL: ${urlLower}, использую IMAGE по умолчанию`, 'media-test');
    return 'IMAGE';
  }

  // Маршрут для тестирования определения типов медиа
  app.post('/api/test/media-types', async (req: Request, res: Response) => {
    try {
      const { urls, objects } = req.body;
      
      log(`[MediaTest] Запуск тестирования определения типов медиа`, 'media-test');
      log(`[MediaTest] Получено ${urls?.length || 0} URL и ${objects?.length || 0} объектов для проверки`, 'media-test');
      
      const results = {
        urls: [] as { url: string, type: string }[],
        objects: [] as { object: any, type: string }[]
      };
      
      // Обработка URL
      if (urls && Array.isArray(urls)) {
        for (const url of urls) {
          const type = determineMediaType(url);
          results.urls.push({ url, type });
          log(`[MediaTest] URL: ${url} -> Тип: ${type}`, 'media-test');
        }
      }
      
      // Обработка объектов
      if (objects && Array.isArray(objects)) {
        for (const objectStr of objects) {
          try {
            // Парсим объект, если он пришел в строковом виде
            const object = typeof objectStr === 'string' ? JSON.parse(objectStr) : objectStr;
            const type = determineMediaType(object);
            results.objects.push({ object, type });
            log(`[MediaTest] Объект: ${JSON.stringify(object).substring(0, 50)}... -> Тип: ${type}`, 'media-test');
          } catch (error) {
            log(`[MediaTest] Ошибка при обработке объекта: ${error}`, 'media-test');
            results.objects.push({ object: objectStr, type: 'ERROR', error: String(error) });
          }
        }
      }
      
      // Отправляем результаты
      res.json({
        success: true,
        results
      });
      
    } catch (error) {
      log(`[MediaTest] Ошибка при тестировании типов медиа: ${error}`, 'media-test');
      res.status(500).json({
        success: false,
        error: String(error)
      });
    }
  });
}