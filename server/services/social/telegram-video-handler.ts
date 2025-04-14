import axios from 'axios';
import { log } from '../../utils/logger';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { promisify } from 'util';
import { glob } from 'glob';

// Для детального логирования поиска файлов
const globPromise = promisify(glob);

/**
 * Улучшенная версия отправки локальных видеофайлов в Telegram
 * @param videoPath Путь к локальному видеофайлу
 * @param chatId ID чата Telegram
 * @param token Токен бота Telegram
 * @param caption Подпись к видео
 * @returns Результат отправки видео
 */
export async function sendLocalVideoToTelegram(
  videoPath: string,
  chatId: string,
  token: string,
  caption: string = ''
): Promise<{ success: boolean; messageId?: number | string; error?: string }> {
  try {
    log(`[IMPROVED] Отправка локального видео в Telegram: ${videoPath} в чат ${chatId}`, 'social-publishing');
    
    // Проверяем валидность chat_id
    let formattedChatId = chatId;
    if (!formattedChatId.startsWith('@') && !formattedChatId.startsWith('-')) {
      formattedChatId = `-100${formattedChatId}`;
      log(`Преобразован chatId для канала: ${formattedChatId}`, 'social-publishing');
    }
    
    // Формируем URL запроса
    const apiUrl = `https://api.telegram.org/bot${token}/sendVideo`;
    
    // Подготавливаем данные формы
    const formData = new FormData();
    formData.append('chat_id', formattedChatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    
    // Проверяем существование файла
    // Определяем возможные пути к файлу
    const possiblePaths = [
      videoPath,
      videoPath.startsWith('/') ? `.${videoPath}` : `/${videoPath}`,
      videoPath.startsWith('.') ? videoPath : `./${videoPath}`,
      path.join(process.cwd(), 'uploads', 'videos', path.basename(videoPath))
    ];
    
    let fileFound = false;
    let videoBuffer: Buffer | null = null;
    let fileName = '';
    
    for (const possiblePath of possiblePaths) {
      log(`[IMPROVED] Проверка наличия файла по пути: ${possiblePath}`, 'social-publishing');
      if (fs.existsSync(possiblePath)) {
        log(`[IMPROVED] Файл найден по пути: ${possiblePath}`, 'social-publishing');
        // Читаем файл в буфер
        videoBuffer = fs.readFileSync(possiblePath);
        fileName = path.basename(possiblePath);
        
        log(`[IMPROVED] Видео прочитано, размер: ${videoBuffer.length} байт`, 'social-publishing');
        fileFound = true;
        break;
      }
    }
    
    if (!fileFound || !videoBuffer) {
      log(`[IMPROVED] Ошибка: видеофайл не найден по указанным путям: ${possiblePaths.join(', ')}`, 'social-publishing');
      return { success: false, error: 'Видеофайл не найден' };
    }
    
    // Добавляем видео в форму
    formData.append('video', videoBuffer, { filename: fileName });
    log(`[IMPROVED] Видео добавлено в форму, размер: ${videoBuffer.length} байт`, 'social-publishing');
    
    // Отправляем запрос
    log(`[IMPROVED] Отправка запроса на публикацию видео в Telegram`, 'social-publishing');
    const response = await axios.post(apiUrl, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 60000, // Увеличенный таймаут для загрузки видео
    });
    
    // Проверяем результат
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`[IMPROVED] Видео успешно отправлено в Telegram, messageId: ${messageId}`, 'social-publishing');
      return { success: true, messageId };
    } else {
      log(`[IMPROVED] Ошибка при отправке видео в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
      return { success: false, error: JSON.stringify(response.data) };
    }
  } catch (error: any) {
    log(`[IMPROVED] Исключение при отправке видео в Telegram: ${error.message}`, 'social-publishing');
    
    if (error.response) {
      log(`[IMPROVED] Ответ сервера: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      return { success: false, error: JSON.stringify(error.response.data) };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет видео в Telegram
 * @param videoUrl URL видео для отправки
 * @param caption Подпись к видео (опционально)
 * @param chatId ID чата Telegram
 * @param token Токен бота Telegram
 * @param baseAppUrl Базовый URL приложения для формирования полных путей к локальным видео
 * @returns Результат отправки видео
 */
export async function sendVideoToTelegram(
  videoUrl: string, 
  caption: string | null, 
  chatId: string, 
  token: string,
  baseAppUrl: string
): Promise<{ success: boolean, result?: any, error?: string, messageId?: number | string }> {
  try {
    log(`Отправка видео в Telegram: ${videoUrl}`, 'social-publishing');
    
    // Формируем полный URL, если это локальный путь
    let fullVideoUrl = videoUrl;
    if (!videoUrl.startsWith('http')) {
      fullVideoUrl = `${baseAppUrl}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
      log(`Исправлен URL для видео: ${fullVideoUrl}`, 'social-publishing');
    }
    
    // Ограничиваем длину подписи (Telegram ограничивает подписи до 1024 символов)
    let formattedCaption = '';
    if (caption && caption.trim() !== '') {
      formattedCaption = caption.length > 1024 ? caption.substring(0, 1021) + '...' : caption;
      if (caption.length > 1024) {
        log(`Подпись для видео обрезана до 1024 символов`, 'social-publishing');
      }
    }
    
    const baseUrl = `https://api.telegram.org/bot${token}`;
    
    // Создаем объект FormData для отправки файла
    const formData = new FormData();
    formData.append('chat_id', chatId);
    
    // Если есть подпись, добавляем ее
    if (formattedCaption) {
      formData.append('caption', formattedCaption);
      formData.append('parse_mode', 'HTML');
    }
    
    // Проверяем, локальный ли это файл или удаленный URL
    if (videoUrl.startsWith('http')) {
      // Для удаленного URL скачиваем файл сначала
      log(`Скачивание видео с удаленного URL: ${fullVideoUrl}`, 'social-publishing');
      try {
        const response = await fetch(fullVideoUrl);
        if (!response.ok) {
          throw new Error(`Ошибка при скачивании видео: ${response.status} ${response.statusText}`);
        }
        
        const buffer = await response.buffer();
        formData.append('video', buffer, { filename: 'video.mp4' });
        
        log(`Видео успешно скачано, размер: ${buffer.length} байт`, 'social-publishing');
      } catch (downloadError) {
        log(`Ошибка при скачивании видео: ${downloadError}`, 'social-publishing');
        // Если не удалось скачать, попробуем передать URL напрямую
        formData.append('video', fullVideoUrl);
      }
    } else {
      // Для локального файла
      try {
        // Извлекаем локальный путь к файлу
        let localPath = videoUrl.replace(baseAppUrl, '');
        // Убираем начальный слеш, если он есть
        if (localPath.startsWith('/')) {
          localPath = localPath.substring(1);
        }
        
        const absolutePath = path.resolve(process.cwd(), localPath);
        const videoFileName = path.basename(videoUrl);
        
        log(`Чтение локального файла видео: ${absolutePath}`, 'social-publishing');
        
        if (fs.existsSync(absolutePath)) {
          const videoBuffer = fs.readFileSync(absolutePath);
          const fileName = path.basename(absolutePath);
          
          formData.append('video', videoBuffer, { filename: fileName });
          log(`Локальный файл видео успешно прочитан, размер: ${videoBuffer.length} байт`, 'social-publishing');
        } else {
          // Попробуем найти файл без базового пути
          const originalPath = path.resolve(process.cwd(), videoUrl);
          log(`Файл не найден, пробуем оригинальный путь: ${originalPath}`, 'social-publishing');
          
          if (fs.existsSync(originalPath)) {
            const videoBuffer = fs.readFileSync(originalPath);
            const fileName = path.basename(originalPath);
            
            formData.append('video', videoBuffer, { filename: fileName });
            log(`Локальный файл видео успешно прочитан, размер: ${videoBuffer.length} байт`, 'social-publishing');
          } else {
            log(`Файл видео не найден по стандартным путям. Выполняем поиск по шаблону...`, 'social-publishing');
            
            // Выполняем поиск видео в uploads/videos по имени файла
            try {
              const videos = await globPromise(path.join(process.cwd(), 'uploads', 'videos', '*'));
              log(`Найдено ${videos.length} видео в директории uploads/videos`, 'social-publishing');
              
              // Сначала ищем по полному совпадению имени файла
              const exactMatch = videos.find(v => path.basename(v) === videoFileName);
              if (exactMatch) {
                const videoBuffer = fs.readFileSync(exactMatch);
                formData.append('video', videoBuffer, { filename: path.basename(exactMatch) });
                log(`Найдено точное совпадение по имени файла: ${exactMatch}, размер: ${videoBuffer.length} байт`, 'social-publishing');
                return; // Успешно нашли и прикрепили видео
              }
              
              // Затем ищем по совпадению базового имени (без временной метки)
              const baseNameWithoutTimestamp = videoFileName.replace(/^\d+\-\d+\-/, '');
              const partialMatch = videos.find(v => path.basename(v).includes(baseNameWithoutTimestamp));
              if (partialMatch) {
                const videoBuffer = fs.readFileSync(partialMatch);
                formData.append('video', videoBuffer, { filename: path.basename(partialMatch) });
                log(`Найдено частичное совпадение по имени файла: ${partialMatch}, размер: ${videoBuffer.length} байт`, 'social-publishing');
                return; // Успешно нашли и прикрепили видео
              }
            } catch (globError) {
              log(`Ошибка при поиске файлов: ${globError}`, 'social-publishing');
            }
            
            // Если глобальный поиск не помог, пробуем последний вариант - полный путь без изменений
            if (fs.existsSync(videoUrl)) {
              const videoBuffer = fs.readFileSync(videoUrl);
              const fileName = path.basename(videoUrl);
              
              formData.append('video', videoBuffer, { filename: fileName });
              log(`Локальный файл видео успешно прочитан, размер: ${videoBuffer.length} байт`, 'social-publishing');
            } else {
              throw new Error(`Файл видео не найден: ${absolutePath}`);
            }
          }
        }
      } catch (fileError) {
        log(`Ошибка при чтении файла видео: ${fileError}`, 'social-publishing');
        // В случае ошибки с файлом, делаем дополнительную попытку найти файл
        try {
          // Пробуем полный путь к uploads/videos
          const videosDir = path.join(process.cwd(), 'uploads', 'videos');
          const videoFileName = path.basename(videoUrl);
          const possiblePaths = [
            path.join(videosDir, videoFileName),
            fullVideoUrl,
            videoUrl
          ];
          
          log(`Попытка поиска видео в альтернативных местах: ${possiblePaths.join(', ')}`, 'social-publishing');
          
          // Ищем файл в возможных местах
          for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
              const videoBuffer = fs.readFileSync(possiblePath);
              const fileName = path.basename(possiblePath);
              
              formData.append('video', videoBuffer, { filename: fileName });
              log(`Видео найдено и прочитано из альтернативного места: ${possiblePath}, размер: ${videoBuffer.length} байт`, 'social-publishing');
              break;
            }
          }
          
          // Если видео не найдено, отправляем URL как последнее средство
          // Нет прямого способа проверить наличие поля в FormData, 
          // поэтому используем переменную для отслеживания
          let videoFound = false;
          for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
              videoFound = true;
              break;
            }
          }
          
          if (!videoFound) {
            log(`Видео не найдено нигде, пробуем передать URL напрямую: ${fullVideoUrl}`, 'social-publishing');
            formData.append('video', fullVideoUrl);
          }
        } catch (secondError) {
          log(`Вторая попытка чтения файла видео также неудачна: ${secondError}`, 'social-publishing');
          // В случае повторной ошибки, пробуем передать URL
          formData.append('video', fullVideoUrl);
        }
      }
    }
    
    // Отправляем запрос с FormData
    log(`Отправка запроса на ${baseUrl}/sendVideo с использованием FormData`, 'social-publishing');
    const response = await axios.post(`${baseUrl}/sendVideo`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000 // Увеличенный таймаут для больших видео
    });
    
    // Проверяем успешность запроса
    if (response.status === 200 && response.data && response.data.ok) {
      const messageId = response.data?.result?.message_id;
      log(`Видео успешно отправлено в Telegram, ID сообщения: ${messageId}`, 'social-publishing');
      
      return {
        success: true,
        result: response.data,
        messageId
      };
    } else {
      log(`Ошибка при отправке видео в Telegram: ${JSON.stringify(response.data)}`, 'social-publishing');
      return {
        success: false,
        error: `API Error: ${JSON.stringify(response.data)}`
      };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    log(`Исключение при отправке видео в Telegram: ${errorMessage}`, 'social-publishing');
    
    return {
      success: false,
      error: `Exception: ${errorMessage}`
    };
  }
}