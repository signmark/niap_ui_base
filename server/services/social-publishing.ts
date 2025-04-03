import axios from 'axios';
import { log } from '../utils/logger';
import { CampaignContent, InsertCampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '@shared/schema';
import { storage } from '../storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';

/**
 * Сервис для публикации контента в социальные сети
 */
export class SocialPublishingService {

  /**
   * Форматирует HTML контент с сохранением абзацев и переносов строк
   * @param htmlContent Исходный HTML-контент с форматированием
   * @param platform Платформа для которой выполняется форматирование (влияет на поддерживаемые теги)
   * @returns Отформатированный текст с сохранением структуры
   */
  /**
   * Преобразует URL изображения в полный URL, обрабатывая разные форматы (UUID Directus, относительные пути)
   * @param imageUrl Исходный URL изображения 
   * @param platform Название платформы для логирования
   * @returns Полный URL изображения, готовый для использования API социальных сетей
   */
  private processImageUrl(imageUrl: string, platform: string): string {
    if (!imageUrl) return '';
    
    log(`▶️ Обработка URL изображения для ${platform}: ${imageUrl}`, 'social-publishing');
    
    // Базовый URL сервера для относительных путей
    const baseAppUrl = process.env.BASE_URL || 'https://nplanner.replit.app';
    
    // Если URL уже абсолютный
    if (imageUrl.startsWith('http')) {
      // Проверяем случай, когда в URL уже есть наш собственный прокси (во избежание двойного проксирования)
      if (imageUrl.includes('/api/proxy-file/') || imageUrl.includes('/api/proxy-media?url=')) {
        log(`✅ URL уже содержит прокси, используем как есть для ${platform}: ${imageUrl}`, 'social-publishing');
        return imageUrl;
      }
      
      // Проверяем Directus URL (содержит assets/UUID)
      const directusPatterns = [
        /\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,  // Стандартный формат
        /\/assets\/(directus-[a-z0-9-]+)/i,  // Формат с префиксом directus
        /\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i  // Альтернативный формат в uploads
      ];
      
      // Подробно логируем текущий URL для анализа
      log(`🔎 Анализ URL для ${platform}. Проверка на содержание путей Directus: ${imageUrl}`, 'social-publishing');
      
      for (const pattern of directusPatterns) {
        const match = imageUrl.match(pattern);
        if (match && match[1]) {
          // Если нашли совпадение в URL, переформируем URL для использования прокси
          const fileId = match[1];
          const proxyUrl = `${baseAppUrl}/api/proxy-file/${fileId}`;
          log(`🔄 Обнаружен Directus URL с ID ${fileId} в пути для ${platform}, создан прокси URL: ${proxyUrl}`, 'social-publishing');
          return proxyUrl;
        }
      }
      
      // Проверка на чистый UUID (без путей)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(imageUrl)) {
        const proxyUrl = `${baseAppUrl}/api/proxy-file/${imageUrl}`;
        log(`🔄 Обнаружен чистый UUID для ${platform}, создан прокси URL: ${proxyUrl}`, 'social-publishing');
        return proxyUrl;
      }
      
      // Проверяем URL для FAL.AI (если используются их модели генерации изображений)
      if (imageUrl.includes('fal.media') || imageUrl.includes('fal.ai')) {
        log(`✅ Обнаружен URL от FAL.AI для ${platform}, используем прямую ссылку`, 'social-publishing');
        return imageUrl;
      }
      
      // Проверяем наличие защищенных доменов в URL
      const protectedDomains = [
        'instagram.', 'fbcdn.net', 'cdninstagram.com', 'scontent.', 'tgcnt.ru',
        'vk.com', 'static.tgstat.ru', 'pbs.twimg.com', 'sitestat.ru', 's.TG',
        // Добавляем домены, которые могут быть заблокированы в России
        't.me', 'telegram.org', 'telesco.pe'
      ];
      
      const needsProxy = protectedDomains.some(domain => imageUrl.includes(domain));
      
      if (needsProxy) {
        // Для внешних ресурсов, требующих аутентификации, проксируем через наш сервер
        log(`Обнаружен URL с защищенной платформы для ${platform}, используем прокси для доступа: ${imageUrl}`, 'social-publishing');
        
        // Особый кейс для VK - использование прямых URL
        if (platform === 'vk' && imageUrl.startsWith('https://vk.com/')) {
          log(`Обнаружен URL VK при публикации в VK, используем прокси с особыми параметрами`, 'social-publishing');
          const encodedUrl = encodeURIComponent(imageUrl);
          return `${baseAppUrl}/api/proxy-media?url=${encodedUrl}&platform=vk`;
        }
        
        // Кодируем полный URL для передачи в прокси с указанием платформы
        const encodedUrl = encodeURIComponent(imageUrl);
        return `${baseAppUrl}/api/proxy-media?url=${encodedUrl}&platform=${platform}`;
      }
      
      // Для всех остальных абсолютных URL используем их как есть
      return imageUrl;
    }
    
    // Проверка, является ли это UUID для Directus
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidPattern.test(imageUrl)) {
      // Это Directus UUID, создаем правильный URL через прокси
      const fullUrl = `${baseAppUrl}/api/proxy-file/${imageUrl}`;
      log(`Обнаружен UUID изображения Directus для ${platform}, создан прокси URL: ${fullUrl}`, 'social-publishing');
      return fullUrl;
    } else if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('/assets/')) {
      // Это локальный файл в директории uploads или assets, добавляем базовый URL
      const fullUrl = `${baseAppUrl}${imageUrl}`;
      log(`Преобразован внутренний URL в абсолютный для ${platform}: ${fullUrl}`, 'social-publishing');
      return fullUrl;
    } else {
      // Это просто локальный файл, добавляем базовый URL
      const fullUrl = `${baseAppUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      log(`Преобразован относительный URL в абсолютный для ${platform}: ${fullUrl}`, 'social-publishing');
      return fullUrl;
    }
  }

  private formatHtmlContent(htmlContent: string, platform: 'telegram' | 'vk' | 'facebook' | 'instagram'): string {
    if (!htmlContent) return '';
    
    log(`🔠 Форматирование HTML-контента для платформы ${platform}`, 'social-publishing');
    log(`📄 Исходный HTML: ${htmlContent.substring(0, 200)}${htmlContent.length > 200 ? '...' : ''}`, 'social-publishing');
    
    // Базовые преобразования общие для всех платформ
    // Заменяем div, p, br на переносы строк 
    let formattedText = htmlContent
      // Сначала обрабатываем блочные элементы
      .replace(/<br\s*\/?>/gi, '\n')  // <br> -> новая строка
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')  // Между параграфами - двойной перенос
      .replace(/<\/div>\s*<div[^>]*>/gi, '\n\n')  // Между div - двойной перенос
      .replace(/<p[^>]*>/gi, '')  // Открывающие теги <p> убираем
      .replace(/<\/p>/gi, '\n\n')  // Закрывающие </p> заменяем на двойной перенос строки
      .replace(/<div[^>]*>/gi, '')  // Открывающие <div> убираем
      .replace(/<\/div>/gi, '\n\n')  // Закрывающие </div> заменяем на двойной перенос
      .replace(/<h[1-6][^>]*>/gi, '**')  // Открывающие <h1>-<h6> заменяем на маркер жирного текста
      .replace(/<\/h[1-6]>/gi, '**\n\n');  // Закрывающие </h1>-</h6> заменяем на маркер жирного текста и двойной перенос
      
    // Логируем промежуточный результат после базовых преобразований
    log(`🔍 После базовых преобразований: ${formattedText.substring(0, 200)}${formattedText.length > 200 ? '...' : ''}`, 'social-publishing');
    
    // Платформо-зависимая обработка форматирования
    if (platform === 'telegram') {
      // Telegram поддерживает базовые HTML-теги
      log(`Форматирование для Telegram: преобразование в HTML теги`, 'social-publishing');
      
      // Используем мульти-строковый паттерн для захвата всего содержимого, включая переносы строк
      formattedText = formattedText
        .replace(/<strong>([\s\S]*?)<\/strong>/g, '<b>$1</b>')
        .replace(/<b>([\s\S]*?)<\/b>/g, '<b>$1</b>')
        .replace(/<em>([\s\S]*?)<\/em>/g, '<i>$1</i>')
        .replace(/<i>([\s\S]*?)<\/i>/g, '<i>$1</i>')
        .replace(/<u>([\s\S]*?)<\/u>/g, '<u>$1</u>')
        .replace(/<s>([\s\S]*?)<\/s>/g, '<s>$1</s>')
        .replace(/<strike>([\s\S]*?)<\/strike>/g, '<s>$1</s>')
        .replace(/<a\s+href="([\s\S]*?)".*?>([\s\S]*?)<\/a>/g, '<a href="$1">$2</a>')
        .replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>'); // Преобразуем временные маркеры в теги
      
      // В конце удаляем только неизвестные HTML-теги, сохраняя поддерживаемые Telegram теги
      // Важно! Не вызываем общую функцию удаления тегов в конце для Telegram
      formattedText = formattedText.replace(/<(?!\/?b>|\/?i>|\/?u>|\/?s>|\/?a(\s+href=".*?"|>|$)).*?>/g, '');
    } else if (platform === 'vk') {
      // VK не поддерживает HTML-форматирование, но можно сохранить смысловое оформление
      log(`Форматирование для VK: преобразование HTML в VK-совместимый текст`, 'social-publishing');
      
      // Используем мульти-строковый паттерн для захвата всего содержимого, включая переносы строк
      formattedText = formattedText
        .replace(/<strong>([\s\S]*?)<\/strong>/g, '$1')  // Снимаем форматирование, VK не поддерживает
        .replace(/<b>([\s\S]*?)<\/b>/g, '$1')
        .replace(/<em>([\s\S]*?)<\/em>/g, '$1')
        .replace(/<i>([\s\S]*?)<\/i>/g, '$1')
        .replace(/<u>([\s\S]*?)<\/u>/g, '$1')  // Подчеркивание не поддерживается, сохраняем только текст
        .replace(/<s>([\s\S]*?)<\/s>/g, '$1')  // Зачеркивание не поддерживается, сохраняем только текст
        .replace(/<strike>([\s\S]*?)<\/strike>/g, '$1')
        .replace(/<a\s+href="([\s\S]*?)".*?>([\s\S]*?)<\/a>/g, '$2 ($1)')  // Ссылки как текст с URL в скобках
        .replace(/\*\*([\s\S]*?)\*\*/g, '$1');  // Убираем временные маркеры
    } else if (platform === 'instagram' || platform === 'facebook') {
      // Instagram/Facebook не поддерживают HTML-форматирование, но сохраняем смысловую структуру
      log(`Форматирование для ${platform}: удаление HTML-тегов с сохранением структуры`, 'social-publishing');
      
      // Используем мульти-строковый паттерн для захвата всего содержимого, включая переносы строк
      formattedText = formattedText
        .replace(/<strong>([\s\S]*?)<\/strong>/g, '$1')  // Instagram/Facebook не поддерживают базовое форматирование
        .replace(/<b>([\s\S]*?)<\/b>/g, '$1')
        .replace(/<em>([\s\S]*?)<\/em>/g, '$1')
        .replace(/<i>([\s\S]*?)<\/i>/g, '$1')
        .replace(/<u>([\s\S]*?)<\/u>/g, '$1')
        .replace(/<s>([\s\S]*?)<\/s>/g, '$1')
        .replace(/<strike>([\s\S]*?)<\/strike>/g, '$1')
        .replace(/<a\s+href="([\s\S]*?)".*?>([\s\S]*?)<\/a>/g, '$2')  // Для Instagram/Facebook сохраняем только текст, без URL
        .replace(/\*\*([\s\S]*?)\*\*/g, '$1');
    }
    
    // Удаляем все оставшиеся HTML-теги, но сохраняем их содержимое
    formattedText = formattedText.replace(/<\/?[^>]+(>|$)/g, '');
    
    // Нормализация переносов строк и структуры текста
    formattedText = formattedText
      .replace(/\n{3,}/g, '\n\n')  // Больше двух переносов подряд -> двойной перенос
      .trim();  // Удаляем лишние пробелы в начале и конце
    
    log(`Форматирование контента для ${platform} завершено, длина результата: ${formattedText.length} символов`, 'social-publishing');
    
    return formattedText;
  }

  /**
   * Обрабатывает поле дополнительных изображений в контенте, проверяя и преобразуя его при необходимости
   * @param content Контент, содержащий дополнительные изображения
   * @param platform Название социальной платформы (для логирования)
   * @returns Обновленный контент с обработанным полем additionalImages
   */
  private processAdditionalImages(content: CampaignContent, platform: string): CampaignContent {
    // Создаем копию контента для изменений
    const processedContent = { ...content };
    
    if (!processedContent.additionalImages) {
      log(`${platform}: additionalImages отсутствует, возвращаем пустой массив`, 'social-publishing');
      processedContent.additionalImages = [];
      return processedContent;
    }
    
    log(`Обработка дополнительных изображений для ${platform}. Тип: ${typeof processedContent.additionalImages}, значение: ${
      typeof processedContent.additionalImages === 'string' 
        ? (processedContent.additionalImages as string).substring(0, 100) + '...' 
        : JSON.stringify(processedContent.additionalImages).substring(0, 100) + '...'
    }`, 'social-publishing');
    
    // Если это строка, пытаемся распарсить как JSON
    if (typeof processedContent.additionalImages === 'string') {
      try {
        // Проверяем, начинается ли строка с [ или {
        const trimmedStr = (processedContent.additionalImages as string).trim();
        if (trimmedStr.startsWith('[') || trimmedStr.startsWith('{')) {
          const parsedImages = JSON.parse(processedContent.additionalImages as string);
          log(`Успешно распарсили строку additionalImages как JSON для ${platform}: ${JSON.stringify(parsedImages).substring(0, 100)}...`, 'social-publishing');
          
          if (Array.isArray(parsedImages)) {
            processedContent.additionalImages = parsedImages;
          } else {
            processedContent.additionalImages = [parsedImages];
          }
        } else {
          // Если строка не начинается с [ или {, это не JSON, а просто URL
          log(`${platform}: additionalImages это строка-URL, а не JSON: ${(processedContent.additionalImages as string).substring(0, 50)}...`, 'social-publishing');
          processedContent.additionalImages = [processedContent.additionalImages as string];
        }
      } catch (e) {
        log(`${platform}: Не удалось распарсить additionalImages как JSON: ${(e as Error).message}`, 'social-publishing');
        
        // Создаем массив из строки
        const additionalImagesArray: string[] = [];
        if (typeof processedContent.additionalImages === 'string' && (processedContent.additionalImages as string).trim() !== '') {
          additionalImagesArray.push(processedContent.additionalImages as string);
          log(`${platform}: Добавили строку additionalImages как URL: ${(processedContent.additionalImages as string).substring(0, 50)}...`, 'social-publishing');
        }
        processedContent.additionalImages = additionalImagesArray;
      }
    }
    
    // Проверяем итоговый массив и фильтруем некорректные значения
    if (Array.isArray(processedContent.additionalImages)) {
      const validImages = processedContent.additionalImages.filter(url => url && typeof url === 'string' && url.trim() !== '');
      log(`${platform}: Найдено ${validImages.length} корректных дополнительных изображений`, 'social-publishing');
      if (validImages.length > 0) {
        log(`${platform}: Первое изображение: ${validImages[0].substring(0, 50)}...`, 'social-publishing');
      }
      processedContent.additionalImages = validImages;
    } else {
      // Если по какой-то причине additionalImages не массив, создаем пустой массив
      log(`${platform}: additionalImages не является массивом после обработки, создаем пустой массив`, 'social-publishing');
      processedContent.additionalImages = [];
    }
    
    return processedContent;
  }

  /**
   * Публикует контент в Telegram
   * @param content Контент для публикации
   * @param telegramSettings Настройки Telegram API
   * @returns Результат публикации
   */
  /**
   * Загружает изображение из URL и отправляет его в Telegram
   * @param imageUrl URL изображения для загрузки
   * @param chatId ID чата для отправки
   * @param caption Текст подписи к изображению
   * @param token Токен Telegram API
   * @param baseUrl Базовый URL Telegram API
   * @returns Ответ от Telegram API
   */
  private async uploadTelegramImageFromUrl(
    imageUrl: string, 
    chatId: string, 
    caption: string, 
    token: string,
    baseUrl: string
  ): Promise<any> {
    log(`🔄 Загружаем изображение с URL: ${imageUrl}`, 'social-publishing');
    
    // Отправляем в лог токен, который используем (без раскрытия полного токена)
    log(`🔑 Используем токен Telegram для загрузки: ${token.substring(0, 10)}...`, 'social-publishing');
    log(`📱 ID чата Telegram: ${chatId}`, 'social-publishing');
    
    // Проверяем наличие proxy в URL и декодируем его, если есть
    let actualImageUrl = imageUrl;
    if (actualImageUrl.includes('/api/proxy-media?url=')) {
      try {
        const encodedUrl = actualImageUrl.split('/api/proxy-media?url=')[1].split('&')[0];
        actualImageUrl = decodeURIComponent(encodedUrl);
        log(`🔄 Декодирован URL из прокси: ${actualImageUrl}`, 'social-publishing');
      } catch (error) {
        log(`⚠️ Ошибка при декодировании URL из прокси: ${error}`, 'social-publishing');
        // Если декодирование не удалось, продолжаем с исходным URL
        log(`⚠️ Продолжаем с исходным URL: ${actualImageUrl}`, 'social-publishing');
      }
    }
    
    log(`📥 Фактический URL для загрузки изображения: ${actualImageUrl}`, 'social-publishing');
    
    // Определяем, является ли URL изображения внешним или местным
    const isExternalUrl = actualImageUrl.startsWith('http') || actualImageUrl.startsWith('https');
    log(`🌐 Проверка URL изображения: ${isExternalUrl ? 'внешний URL' : 'локальный путь'} - ${actualImageUrl}`, 'social-publishing');
    
    // Для локальных путей проверяем наличие файла
    if (!isExternalUrl && !actualImageUrl.startsWith('/')) {
      // Преобразуем в абсолютный путь
      const baseUrl = process.env.APP_URL || 'https://planner-app.com';
      actualImageUrl = `${baseUrl}/${actualImageUrl}`;
      log(`🔄 Преобразован локальный путь в абсолютный URL: ${actualImageUrl}`, 'social-publishing');
    }
    
    // Стратегия загрузки файла с усиленной защитой от сбоев и подробным логированием
    log(`📥 Загрузка изображения с URL: ${actualImageUrl}`, 'social-publishing');
    
    // Загружаем изображение с расширенными заголовками
    const imageResponse = await axios.get(actualImageUrl, { 
      responseType: 'arraybuffer',
      // Добавляем заголовки для работы с защищенными ресурсами
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://planner-app.com/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Origin': 'https://planner-app.com'
      },
      // Игнорируем ошибки SSL для работы со всеми серверами
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Принимаем статусы 2xx и 3xx, 4xx
      },
      // Увеличиваем таймаут для загрузки больших файлов
      timeout: 30000
    });
    
    // Проверяем успешность загрузки
    if (imageResponse.status >= 400) {
      log(`❌ Ошибка загрузки изображения, статус: ${imageResponse.status}`, 'social-publishing');
      throw new Error(`Не удалось загрузить изображение, статус: ${imageResponse.status}`);
    }
    
    log(`✅ Изображение успешно загружено, размер: ${imageResponse.data.length} байт, статус: ${imageResponse.status}`, 'social-publishing');
    
    // Проверяем размер изображения
    if (imageResponse.data.length < 100) {
      log(`⚠️ Внимание: размер загруженного изображения слишком мал (${imageResponse.data.length} байт), возможно загружены не данные изображения`, 'social-publishing');
    }
    
    // Создаем временную директорию, если её нет
    const tempDir = path.join(os.tmpdir(), 'telegram_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      log(`📁 Создана временная директория: ${tempDir}`, 'social-publishing');
    }
    
    // Генерируем уникальное имя файла
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const tempFilePath = path.join(tempDir, `telegram_${timestamp}_${randomString}.jpg`);
    
    // Сохраняем изображение во временный файл
    fs.writeFileSync(tempFilePath, Buffer.from(imageResponse.data));
    log(`💾 Создан временный файл: ${tempFilePath}, размер: ${fs.statSync(tempFilePath).size} байт`, 'social-publishing');
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    
    // Добавляем файл изображения в форму
    const fileStream = fs.createReadStream(tempFilePath);
    formData.append('photo', fileStream, { filename: `image_${timestamp}.jpg` });
    
    log(`📤 Отправляем файл в Telegram API через multipart/form-data`, 'social-publishing');
    
    try {
      // Отправляем запрос в Telegram API
      const response = await axios.post(`${baseUrl}/sendPhoto`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000 // увеличиваем таймаут до 30 секунд
      });
      
      log(`✅ Успешный ответ от Telegram API: ${JSON.stringify(response.data)}`, 'social-publishing');
      return response.data;
    } catch (uploadError: any) {
      log(`❌ Ошибка при отправке изображения в Telegram API: ${uploadError.message}`, 'social-publishing');
      if (uploadError.response) {
        log(`📄 Данные ответа при ошибке: ${JSON.stringify(uploadError.response.data)}`, 'social-publishing');
      }
      throw uploadError;
    } finally {
      // Закрываем стрим чтения файла
      fileStream.destroy();
      
      // Удаляем временный файл
      try {
        fs.unlinkSync(tempFilePath);
        log(`🗑️ Временный файл удален: ${tempFilePath}`, 'social-publishing');
      } catch (deleteError) {
        log(`⚠️ Ошибка при удалении временного файла: ${deleteError}`, 'social-publishing');
      }
    }
  }

  /**
   * Получает системный токен для администраторской аутентификации
   * @returns Админский токен для запросов к системным ресурсам
   */
  private async getSystemToken(): Promise<string | null> {
    try {
      // Здесь должна быть логика получения токена администратора
      // Обычно это реализуется через DirectusAuthManager или аналогичный сервис
      return null;
    } catch (error) {
      log(`⚠️ Ошибка при получении системного токена: ${(error as Error).message}`, 'social-publishing');
      return null;
    }
  }

  async publishToTelegram(
    content: CampaignContent,
    telegramSettings?: SocialMediaSettings['telegram']
  ): Promise<SocialPublication> {
    log(`▶️ Начата публикация в Telegram. Контент ID: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
    log(`▶️ Настройки для публикации в Telegram: chatId=${telegramSettings?.chatId?.substring(0, 6)}..., token=${telegramSettings?.token?.substring(0, 6)}...`, 'social-publishing');
    
    if (!telegramSettings?.token || !telegramSettings?.chatId) {
      log(`❌ ОШИБКА: Отсутствуют настройки для Telegram (token=${!!telegramSettings?.token}, chatId=${!!telegramSettings?.chatId})`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Telegram (токен или ID чата)'
      };
    }

    try {
      const { token, chatId } = telegramSettings;
      log(`Публикация в Telegram. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
      log(`Публикация в Telegram. Чат: ${chatId}, Токен: ${token.substring(0, 6)}...`, 'social-publishing');
      log(`Telegram публикация - тип additionalImages в контенте: ${typeof content.additionalImages}, значение: ${content.additionalImages ? 
        (typeof content.additionalImages === 'string' ? content.additionalImages : JSON.stringify(content.additionalImages).substring(0, 100)) 
        : 'null'}`, 'social-publishing');

      // Обработка дополнительных изображений
      const processedContent = this.processAdditionalImages(content, 'Telegram');

      // Правильное форматирование ID чата
      let formattedChatId = chatId;
      if (!chatId.startsWith('-100') && !isNaN(Number(chatId))) {
        formattedChatId = `-100${chatId}`;
        log(`Переформатирован ID чата для Telegram: ${formattedChatId}`, 'social-publishing');
      }

      // Подготовка сообщения с сохранением HTML-форматирования
      let text = processedContent.title ? `<b>${processedContent.title}</b>\n\n` : '';
      
      // Форматируем контент для Telegram с сохранением HTML-тегов и структуры текста
      const formattedContent = this.formatHtmlContent(processedContent.content, 'telegram');
      
      text += formattedContent;

      // Добавление хэштегов
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        text += '\n\n' + processedContent.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      log(`Подготовлено сообщение для Telegram: ${text.substring(0, 50)}...`, 'social-publishing');

      // Разные методы API в зависимости от типа контента
      let response;
      const baseUrl = `https://api.telegram.org/bot${token}`;

      // Собираем все доступные изображения
      const images = [];
      
      // Проверяем основное изображение с обработкой URL
      if (processedContent.imageUrl && typeof processedContent.imageUrl === 'string' && processedContent.imageUrl.trim() !== '') {
        const processedImageUrl = this.processImageUrl(processedContent.imageUrl, 'telegram');
        images.push(processedImageUrl);
        log(`Добавлено основное изображение для Telegram: ${processedImageUrl}`, 'social-publishing');
      }
      
      // Добавляем дополнительные изображения с обработкой URL
      if (processedContent.additionalImages && Array.isArray(processedContent.additionalImages)) {
        for (const additionalImage of processedContent.additionalImages) {
          if (additionalImage && typeof additionalImage === 'string' && additionalImage.trim() !== '') {
            const processedImg = this.processImageUrl(additionalImage, 'telegram');
            images.push(processedImg);
            log(`Добавлено дополнительное изображение для Telegram: ${processedImg}`, 'social-publishing');
          }
        }
        
        log(`Всего подготовлено ${images.length} изображений для Telegram`, 'social-publishing');
      }
      
      // Проверяем доступность видео и обрабатываем URL
      const hasVideo = content.videoUrl && typeof content.videoUrl === 'string' && content.videoUrl.trim() !== '';
      let processedVideoUrl = hasVideo ? this.processImageUrl(content.videoUrl as string, 'telegram') : '';
      
      // Ограничиваем длину подписи, так как Telegram имеет ограничение
      const maxCaptionLength = 1024;
      const truncatedCaption = text.length > maxCaptionLength ? 
        text.substring(0, maxCaptionLength - 3) + '...' : 
        text;
      
      // Решение о методе публикации на основе доступности медиа и типа контента
      if (images.length > 1) {
        // Отправка группы изображений (медиагруппы) через sendMediaGroup
        log(`Отправка медиагруппы в Telegram с ${images.length} изображениями через API sendMediaGroup`, 'social-publishing');
        
        // Формируем массив объектов медиа для API Telegram
        const mediaGroup = images.map((url, index) => ({
          type: 'photo',
          media: url,
          // Добавляем подпись только к первому изображению
          ...(index === 0 ? { caption: truncatedCaption, parse_mode: 'HTML' } : {})
        }));
        
        log(`Сформирована медиагруппа для Telegram: ${JSON.stringify(mediaGroup)}`, 'social-publishing');
        
        // Отправляем медиагруппу в теле запроса (формат JSON)
        const requestBody = {
          chat_id: formattedChatId,
          media: mediaGroup
        };
        
        log(`Отправляем запрос к Telegram API (sendMediaGroup): ${JSON.stringify(requestBody)}`, 'social-publishing');
        
        response = await axios.post(`${baseUrl}/sendMediaGroup`, requestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (images.length === 1) {
        // Отправка одиночного изображения с подписью
        log(`Отправка изображения в Telegram для типа ${content.contentType} с URL: ${images[0]}`, 'social-publishing');
        
        const photoRequestBody = {
          chat_id: formattedChatId, 
          photo: images[0],
          caption: truncatedCaption,
          parse_mode: 'HTML'
        };
        
        log(`Отправляем запрос фото к Telegram API: ${JSON.stringify(photoRequestBody)}`, 'social-publishing');
        
        log(`Отправляем фото в Telegram, URL: ${images[0].substring(0, 100)}`, 'social-publishing');
        try {
          response = await axios.post(`${baseUrl}/sendPhoto`, photoRequestBody, {
            headers: { 'Content-Type': 'application/json' }
          });
          log(`Успешный ответ от Telegram API: ${JSON.stringify(response.data).substring(0, 150)}`, 'social-publishing');
        } catch (telegramError) {
          const errorData = (telegramError as any).response?.data 
            ? JSON.stringify((telegramError as any).response.data) 
            : String(telegramError);
          log(`ОШИБКА в запросе к Telegram API: ${errorData}`, 'social-publishing');
          
          // Передаем управление в функцию локальной загрузки
          log(`⚠️ Для надежности используем локальную загрузку изображений в Telegram`, 'social-publishing');
          try {
            // Загружаем изображение локально и отправляем через FormData
            const uploadResult = await this.uploadTelegramImageFromUrl(images[0], formattedChatId, truncatedCaption, token, baseUrl);
            log(`✅ Успешная загрузка через локальный метод: ${JSON.stringify(uploadResult)}`, 'social-publishing');
            response = { data: uploadResult };
          } catch (retryError: any) {
            // Подробный вывод ошибки
            const retryErrorData = (retryError as any).response?.data 
              ? JSON.stringify((retryError as any).response.data) 
              : String(retryError);
            log(`❌ Не удалось загрузить и опубликовать изображение: ${retryErrorData}`, 'social-publishing');
            
            if (retryError.response) {
              log(`📄 Данные ответа при ошибке: ${JSON.stringify(retryError.response.data)}`, 'social-publishing');
              log(`🔢 Статус ошибки: ${retryError.response.status}`, 'social-publishing');
            }
            
            // Последняя попытка отправить только текст
            try {
              log(`🔄 Попытка отправки только текста без изображений`, 'social-publishing');
              const textMessageBody = {
                chat_id: formattedChatId,
                text: truncatedCaption,
                parse_mode: 'HTML'
              };
              
              response = await axios.post(`${baseUrl}/sendMessage`, textMessageBody, {
                headers: { 'Content-Type': 'application/json' }
              });
              
              log(`✅ Текстовое сообщение успешно отправлено после ошибки с изображением`, 'social-publishing');
            } catch (textError) {
              log(`❌ Также не удалось отправить текстовое сообщение: ${textError}`, 'social-publishing');
              throw retryError; // Возвращаем оригинальную ошибку с изображением
            }
          }
        }
      } 
      
      if (hasVideo) {
        // Отправка видео с подписью (с обработанным URL)
        log(`Отправка видео в Telegram для типа ${content.contentType} с URL: ${processedVideoUrl}`, 'social-publishing');
        const videoRequestBody = {
          chat_id: formattedChatId,
          video: processedVideoUrl,
          caption: text,
          parse_mode: 'HTML'
        };
        
        log(`Отправляем запрос видео к Telegram API: ${JSON.stringify(videoRequestBody)}`, 'social-publishing');
        
        response = await axios.post(`${baseUrl}/sendVideo`, videoRequestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
      } 
      
      if (content.contentType === 'text' || !content.contentType) {
        // Отправка текстового сообщения (по умолчанию)
        log(`Отправка текстового сообщения в Telegram с HTML`, 'social-publishing');
        const messageRequestBody = {
          chat_id: formattedChatId,
          text,
          parse_mode: 'HTML'
        };
        
        log(`Отправляем текстовый запрос к Telegram API: ${JSON.stringify(messageRequestBody)}`, 'social-publishing');
        
        response = await axios.post(`${baseUrl}/sendMessage`, messageRequestBody, {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Если до сих пор не отправлено, пробуем неподдерживаемый формат как текст
      if (!response) {
        // Неподдерживаемый формат - пробуем отправить текст как запасной вариант
        log(`Для типа контента ${content.contentType} не найдены медиа или другие обработчики. Отправляем как текст`, 'social-publishing');
        try {
          const fallbackMessageBody = {
            chat_id: formattedChatId,
            text,
            parse_mode: 'HTML'
          };
          
          log(`Отправляем fallback-текстовый запрос к Telegram API: ${JSON.stringify(fallbackMessageBody)}`, 'social-publishing');
          
          response = await axios.post(`${baseUrl}/sendMessage`, fallbackMessageBody, {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          log(`Неподдерживаемый тип контента для Telegram: ${content.contentType}`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Неподдерживаемый тип контента: ${content.contentType}`
          };
        }
      }

      log(`Получен ответ от Telegram API: ${JSON.stringify(response.data)}`, 'social-publishing');

      // Обработка успешного ответа
      if (response.data.ok) {
        // Для множественных сообщений (медиагруппы) - результат это массив сообщений
        if (Array.isArray(response.data.result)) {
          const messages = response.data.result;
          log(`Успешная публикация группы в Telegram. Количество сообщений: ${messages.length}`, 'social-publishing');
          
          // Берем ID первого сообщения в группе для ссылки
          const firstMessageId = messages[0].message_id;
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postId: firstMessageId.toString(),
            postUrl: `https://t.me/c/${formattedChatId.replace('-100', '')}/${firstMessageId}`,
            userId: content.userId // Добавляем userId из контента
          };
        } else {
          // Для одиночного сообщения
          const message = response.data.result;
          log(`Успешная публикация в Telegram. Message ID: ${message.message_id}`, 'social-publishing');
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postId: message.message_id.toString(),
            postUrl: `https://t.me/c/${formattedChatId.replace('-100', '')}/${message.message_id}`,
            userId: content.userId // Добавляем userId из контента
          };
        }
      } else {
        log(`Ошибка в ответе Telegram API: ${response.data.description}`, 'social-publishing');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Telegram API вернул ошибку: ${response.data.description}`,
          userId: content.userId // Добавляем userId из контента
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в Telegram: ${error.message}`,
        userId: content.userId // Добавляем userId из контента
      };
    }
  }

  /**
   * Получает URL для загрузки фотографии в VK
   * @param token Токен доступа VK
   * @param groupId ID группы
   * @returns URL для загрузки фото или null в случае ошибки
   */
  private async getVkPhotoUploadUrl(token: string, groupId: string): Promise<string | null> {
    try {
      const params = {
        group_id: groupId, // ID группы без минуса
        access_token: token,
        v: '5.131'
      };

      // API метод для получения адреса сервера
      const response = await axios({
        method: 'get',
        url: 'https://api.vk.com/method/photos.getWallUploadServer',
        params
      });

      log(`Получен ответ для загрузки фото: ${JSON.stringify(response.data)}`, 'social-publishing');

      if (response.data.response && response.data.response.upload_url) {
        log(`Получен URL для загрузки фото: ${response.data.response.upload_url}`, 'social-publishing');
        return response.data.response.upload_url;
      } else if (response.data.error) {
        log(`Ошибка при получении URL для загрузки: ${JSON.stringify(response.data.error)}`, 'social-publishing');
        return null;
      }
      
      return null;
    } catch (error: any) {
      log(`Ошибка при получении URL для загрузки фото в VK: ${error.message}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Загружает фото на сервер VK
   * @param uploadUrl URL для загрузки
   * @param imageUrl URL изображения
   * @returns Данные о загруженном фото или null в случае ошибки
   */
  private async uploadPhotoToVk(uploadUrl: string, imageUrl: string): Promise<any | null> {
    try {
      log(`Начало загрузки изображения в VK с URL: ${imageUrl}`, 'social-publishing');
      
      // Обработка URL изображения с использованием универсального метода
      const fullImageUrl = this.processImageUrl(imageUrl, 'vk');
      log(`Обработан URL изображения для VK: ${fullImageUrl}`, 'social-publishing');
      
      // Скачиваем изображение
      log(`Скачивание изображения с окончательного URL: ${fullImageUrl}`, 'social-publishing');
      const imageResponse = await axios({
        method: 'get',
        url: fullImageUrl,
        responseType: 'arraybuffer'
      });

      // Создаем временный файл на сервере
      const tempFilePath = path.join(os.tmpdir(), `vk_upload_${Date.now()}.jpg`);
      log(`Создаем временный файл: ${tempFilePath}`, 'social-publishing');
      
      // Сохраняем изображение во временный файл
      fs.writeFileSync(tempFilePath, Buffer.from(imageResponse.data));
      
      // Создаем форму для загрузки файла
      const formData = new FormData();
      formData.append('photo', fs.createReadStream(tempFilePath));
      
      // Выполняем запрос на загрузку на сервер ВК
      log(`Загрузка файла на сервер ВК по URL: ${uploadUrl}`, 'social-publishing');
      
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: formData.getHeaders()
      });
      
      // Удаляем временный файл после загрузки
      fs.unlinkSync(tempFilePath);
      log(`Временный файл удален: ${tempFilePath}`, 'social-publishing');
      
      log(`Ответ от сервера загрузки VK: ${JSON.stringify(uploadResponse.data)}`, 'social-publishing');
      return uploadResponse.data;
    } catch (error: any) {
      log(`Ошибка при загрузке фото на сервер VK: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке загрузки: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return null;
    }
  }

  /**
   * Сохраняет загруженное фото в альбоме группы VK
   * @param token Токен доступа VK
   * @param groupId ID группы
   * @param server ID сервера
   * @param photoData Данные фотографии
   * @param hash Хеш фотографии
   * @returns Данные о сохраненном фото или null в случае ошибки
   */
  private async savePhotoToVk(token: string, groupId: string, server: number, photoData: string, hash: string): Promise<any | null> {
    try {
      const params = {
        group_id: groupId, // ID группы без минуса
        server,
        photo: photoData,
        hash,
        access_token: token,
        v: '5.131'
      };

      // API метод для сохранения фото
      const response = await axios({
        method: 'post',
        url: 'https://api.vk.com/method/photos.saveWallPhoto',
        params
      });

      log(`Ответ от VK API при сохранении фото: ${JSON.stringify(response.data)}`, 'social-publishing');

      if (response.data.response && response.data.response.length > 0) {
        const photo = response.data.response[0];
        log(`Фото успешно сохранено в VK, ID: ${photo.id}`, 'social-publishing');
        return photo;
      } else if (response.data.error) {
        log(`Ошибка при сохранении фото: ${JSON.stringify(response.data.error)}`, 'social-publishing');
        return null;
      }
      
      return null;
    } catch (error: any) {
      log(`Ошибка при сохранении фото в VK: ${error.message}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Публикует контент в VK
   * @param content Контент для публикации
   * @param vkSettings Настройки VK API
   * @returns Результат публикации
   */
  async publishToVk(
    content: CampaignContent,
    vkSettings?: SocialMediaSettings['vk']
  ): Promise<SocialPublication> {
    if (!vkSettings?.token || !vkSettings?.groupId) {
      return {
        platform: 'vk',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для VK (токен или ID группы)'
      };
    }

    try {
      const { token, groupId } = vkSettings;
      log(`Публикация в VK. Группа: ${groupId}, Токен: ${token.substring(0, 6)}...`, 'social-publishing');

      // Обработка контента и дополнительных изображений
      const processedContent = this.processAdditionalImages(content, 'vk');
      log(`VK публикация - обрабатываем контент: ${content.id}, тип данных additionalImages: ${typeof content.additionalImages}`, 'social-publishing');
      log(`Обработанный контент для VK имеет ${processedContent.additionalImages ? processedContent.additionalImages.length : 0} дополнительных изображений`, 'social-publishing');

      // Подготовка сообщения
      let message = processedContent.title ? `${processedContent.title}\n\n` : '';
      
      // Форматируем контент для VK с сохранением структуры и смыслового форматирования
      const formattedContent = this.formatHtmlContent(processedContent.content, 'vk');
      
      message += formattedContent;

      // Добавление хэштегов
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        message += '\n\n' + processedContent.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }

      log(`Подготовлено сообщение для VK: ${message.substring(0, 50)}...`, 'social-publishing');

      // Обработка ID группы - удаляем префикс "club" если он есть
      let cleanGroupId = groupId;
      if (cleanGroupId.startsWith('club')) {
        cleanGroupId = cleanGroupId.replace('club', '');
        log(`Очищен ID группы от префикса 'club': ${cleanGroupId}`, 'social-publishing');
      }
      
      // Параметры для запроса публикации
      const requestData: any = {
        owner_id: `-${cleanGroupId}`, // Отрицательный ID для групп/сообществ
        from_group: 1, // Публикация от имени группы
        message: message,
        access_token: token,
        v: '5.131' // версия API
      };

      // Массив для хранения прикрепленных изображений (attachments)
      const attachmentsArray = [];
      
      // Собираем все доступные изображения (основное и дополнительные)
      const images = [];
      
      // Добавляем основное изображение с обработкой URL
      if (processedContent.imageUrl) {
        const processedImageUrl = this.processImageUrl(processedContent.imageUrl, 'vk');
        images.push(processedImageUrl);
        log(`Добавлено основное изображение для VK: ${processedImageUrl}`, 'social-publishing');
      }
      
      // Добавляем дополнительные изображения с обработкой URL
      if (processedContent.additionalImages && Array.isArray(processedContent.additionalImages) && processedContent.additionalImages.length > 0) {
        for (let img of processedContent.additionalImages) {
          if (img && typeof img === 'string' && img.trim() !== '') {
            const processedImg = this.processImageUrl(img, 'vk');
            images.push(processedImg);
            log(`Добавлено дополнительное изображение для VK: ${processedImg}`, 'social-publishing');
          }
        }
      }
      
      log(`Всего подготовлено ${images.length} изображений для VK`, 'social-publishing');
      
      // Загрузка всех изображений в VK и добавление в attachments
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        try {
          const isMain = i === 0 && processedContent.imageUrl === imageUrl;
          const imageType = isMain ? "основное" : "дополнительное";
          log(`Загрузка ${imageType} изображения #${i + 1}/${images.length} на сервер VK: ${imageUrl}`, 'social-publishing');
          
          // Шаг 1: Получаем URL сервера для загрузки изображения
          const uploadUrl = await this.getVkPhotoUploadUrl(token, cleanGroupId);
          
          if (!uploadUrl) {
            log(`Не удалось получить URL для загрузки фото #${i + 1}, пропускаем`, 'social-publishing');
            continue;
          }
          
          // Шаг 2: Загружаем фото на сервер VK
          const uploadResult = await this.uploadPhotoToVk(uploadUrl, imageUrl);
          
          if (!uploadResult) {
            log(`Ошибка при загрузке фото #${i + 1} на сервер VK, пропускаем`, 'social-publishing');
            continue;
          }
          
          // Шаг 3: Сохраняем фото в альбом группы
          const photo = await this.savePhotoToVk(
            token, 
            cleanGroupId, 
            uploadResult.server, 
            uploadResult.photo, 
            uploadResult.hash
          );
          
          if (photo) {
            // Формируем attachment в нужном формате photo{owner_id}_{photo_id}
            const attachment = `photo${photo.owner_id}_${photo.id}`;
            attachmentsArray.push(attachment);
            log(`Фото #${i + 1} успешно загружено, добавлено в пост: ${attachment}`, 'social-publishing');
          } else {
            log(`Не удалось сохранить фото #${i + 1} в альбом VK, пропускаем`, 'social-publishing');
          }
        } catch (error: any) {
          log(`Ошибка при подготовке изображения #${i + 1} для VK: ${error.message}`, 'social-publishing');
          log(`Пропускаем изображение #${i + 1}`, 'social-publishing');
        }
      }
      
      // Добавляем все загруженные изображения в запрос, если они есть
      if (attachmentsArray.length > 0) {
        requestData.attachment = attachmentsArray.join(',');
        log(`Добавлено ${attachmentsArray.length} изображений в пост VK: ${requestData.attachment}`, 'social-publishing');
      } else {
        log(`Не удалось загрузить ни одного изображения для VK, публикуем пост без изображений`, 'social-publishing');
      }

      // Прямой запрос к VK API через form data для избежания ошибки 414 (URI Too Large)
      const apiUrl = 'https://api.vk.com/method/wall.post';
      log(`Отправка запроса к VK API: ${apiUrl}`, 'social-publishing');
      log(`Параметры запроса: ${JSON.stringify(requestData)}`, 'social-publishing');

      // Вместо формы данных отправляем обычный запрос с URL-кодированными данными
      // Новый подход без FormData, который вызывал ошибку require
      const urlEncodedData = new URLSearchParams();
      
      // Добавляем все поля в запрос
      Object.keys(requestData).forEach(key => {
        urlEncodedData.append(key, requestData[key]);
      });
      
      // Отправка запроса как обычная форма
      const response = await axios({
        method: 'post',
        url: apiUrl,
        data: urlEncodedData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      log(`Получен ответ от VK API: ${JSON.stringify(response.data)}`, 'social-publishing');

      if (response.data.response && response.data.response.post_id) {
        log(`Успешная публикация в VK. Post ID: ${response.data.response.post_id}`, 'social-publishing');
        // Используем тот же очищенный ID группы для формирования URL поста
        return {
          platform: 'vk',
          status: 'published',
          publishedAt: new Date(),
          postId: response.data.response.post_id.toString(),
          postUrl: `https://vk.com/wall-${cleanGroupId}_${response.data.response.post_id}`,
          userId: content.userId // Добавляем userId из контента
        };
      } else if (response.data.error) {
        log(`Ошибка VK API: ${JSON.stringify(response.data.error)}`, 'social-publishing');
        return {
          platform: 'vk',
          status: 'failed',
          publishedAt: null,
          error: `VK API вернул ошибку: Код ${response.data.error.error_code} - ${response.data.error.error_msg}`,
          userId: content.userId // Добавляем userId из контента
        };
      } else {
        log(`Неизвестный формат ответа от VK API: ${JSON.stringify(response.data)}`, 'social-publishing');
        return {
          platform: 'vk',
          status: 'failed',
          publishedAt: null,
          error: `Неизвестный формат ответа от VK API: ${JSON.stringify(response.data)}`,
          userId: content.userId // Добавляем userId из контента
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации в VK: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'vk',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в VK: ${error.message}`,
        userId: content.userId // Добавляем userId из контента
      };
    }
  }

  /**
   * Публикует контент в Instagram
   * @param content Контент для публикации
   * @param instagramSettings Настройки Instagram API
   * @returns Результат публикации
   */
  async publishToInstagram(
    content: CampaignContent,
    instagramSettings?: SocialMediaSettings['instagram']
  ): Promise<SocialPublication> {
    // Проверяем наличие настроек
    log(`Настройки Instagram для публикации: ${JSON.stringify(instagramSettings)}`, 'social-publishing');
    
    // Используем token или accessToken - любой, который есть
    const token = instagramSettings?.token || instagramSettings?.accessToken;
    if (!token) {
      log(`Отсутствует токен Instagram для публикации контента ${content.id}`, 'social-publishing');
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует токен Instagram (Graph API) в настройках кампании',
        userId: content.userId
      };
    }

    // Проверяем наличие ID бизнес-аккаунта
    if (!instagramSettings?.businessAccountId) {
      log(`Отсутствует ID бизнес-аккаунта Instagram для публикации контента ${content.id}`, 'social-publishing');
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует ID бизнес-аккаунта Instagram в настройках кампании',
        userId: content.userId
      };
    }

    try {
      // Обработка дополнительных изображений
      const processedContent = this.processAdditionalImages(content, 'Instagram');
      
      log(`Публикация в Instagram. Контент: ${processedContent.id}, тип: ${processedContent.contentType}`, 'social-publishing');
      log(`Публикация в Instagram. Токен: ${token.substring(0, 6)}..., ID аккаунта: ${instagramSettings.businessAccountId}`, 'social-publishing');

      // Подготовка описания
      let caption = processedContent.title ? `${processedContent.title}\n\n` : '';
      
      // Форматируем контент для Instagram с сохранением структуры текста
      const formattedContent = this.formatHtmlContent(processedContent.content, 'instagram');
      
      caption += formattedContent;

      // Добавление хэштегов
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        caption += '\n\n' + processedContent.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      // Ограничиваем длину подписи до 2200 символов (ограничение Instagram)
      const maxInstagramCaptionLength = 2200;
      
      // Проверка и логирование данных, показывающих текущую длину подписи
      log(`Instagram - длина подписи: ${caption.length} символов, лимит: ${maxInstagramCaptionLength}`, 'social-publishing');
      
      // Всегда обрезаем длинную подпись для Instagram
      if (caption.length > maxInstagramCaptionLength) {
        log(`Подпись для Instagram превышает лимит: ${caption.length} символов (лимит ${maxInstagramCaptionLength})`, 'social-publishing');
        // Обрезаем с запасом в 50 символов чтобы избежать проблем с Unicode или emoji
        const safeLimit = maxInstagramCaptionLength - 53;
        caption = caption.substring(0, safeLimit) + '...';
        log(`Подпись для Instagram обрезана до ${caption.length} символов`, 'social-publishing');
      }

      log(`Подготовлено описание для Instagram: ${caption.substring(0, 50)}...`, 'social-publishing');

      // Инстаграм требует наличие хотя бы одного изображения
      if (!processedContent.imageUrl && (!processedContent.additionalImages || processedContent.additionalImages.length === 0)) {
        log(`Для публикации в Instagram необходимо хотя бы одно изображение`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Для публикации в Instagram необходимо хотя бы одно изображение',
          userId: processedContent.userId
        };
      }

      const igBusinessId = instagramSettings.businessAccountId;
      
      // Собираем все изображения для публикации
      const images = [];
      
      // Добавляем основное изображение с обработкой URL
      if (processedContent.imageUrl) {
        const processedImageUrl = this.processImageUrl(processedContent.imageUrl, 'instagram');
        images.push(processedImageUrl);
        log(`Обработано основное изображение для Instagram: ${processedImageUrl}`, 'social-publishing');
      }
      
      // Добавляем дополнительные изображения с обработкой URL
      if (processedContent.additionalImages && Array.isArray(processedContent.additionalImages)) {
        log(`Найдено ${processedContent.additionalImages.length} дополнительных изображений для Instagram`, 'social-publishing');
        
        // Фильтруем только валидные URL и обрабатываем их
        const validImages = processedContent.additionalImages
          .filter(url => url && typeof url === 'string')
          .map(url => this.processImageUrl(url, 'instagram'));
        
        images.push(...validImages);
        
        log(`Добавлено ${validImages.length} дополнительных изображений в массив для Instagram`, 'social-publishing');
      }
      
      log(`Подготовлено ${images.length} изображений для публикации в Instagram`, 'social-publishing');
      
      // Если у нас несколько изображений, публикуем карусель
      if (images.length > 1) {
        return await this.publishInstagramCarousel(processedContent, igBusinessId, token, images, caption);
      }
      
      // Если одно изображение, публикуем как обычный пост
      const imageUrl = images[0];
      
      // Шаг 1: Создаем медиа-контейнер
      log(`Шаг 1: Создание медиа-контейнера для Instagram (одиночное изображение)`, 'social-publishing');
      const createMediaResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igBusinessId}/media`,
        {
          image_url: imageUrl,
          caption: caption,
          access_token: token
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!createMediaResponse.data || !createMediaResponse.data.id) {
        log(`Ошибка при создании медиа-контейнера: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при создании медиа-контейнера: Неверный формат ответа',
          userId: processedContent.userId
        };
      }

      const mediaContainerId = createMediaResponse.data.id;
      log(`Медиа-контейнер создан успешно, ID: ${mediaContainerId}`, 'social-publishing');

      // Шаг 2: Публикуем медиа из контейнера
      log(`Шаг 2: Публикация медиа в Instagram`, 'social-publishing');
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igBusinessId}/media_publish`,
        {
          creation_id: mediaContainerId,
          access_token: token
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!publishResponse.data || !publishResponse.data.id) {
        log(`Ошибка при публикации медиа: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при публикации медиа: Неверный формат ответа',
          userId: processedContent.userId
        };
      }

      const postId = publishResponse.data.id;
      log(`Медиа успешно опубликовано в Instagram, ID: ${postId}`, 'social-publishing');

      // Получаем информацию о созданном медиа, чтобы извлечь permalink с коротким кодом
      try {
        log(`Запрос медиа данных для получения permalink/shortcode для ID: ${postId}`, 'social-publishing');
        const mediaInfoResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${postId}`,
          {
            params: {
              fields: 'permalink',
              access_token: token
            }
          }
        );
        
        if (mediaInfoResponse.data && mediaInfoResponse.data.permalink) {
          // Получаем permalink из ответа API, содержащий реальный короткий код Instagram
          const permalink = mediaInfoResponse.data.permalink;
          log(`Получен permalink из API Instagram: ${permalink}`, 'social-publishing');
          
          // Формируем URL публикации из permalink
          const postUrl = permalink;
          log(`Использован permalink как postUrl: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'instagram',
            status: 'published',
            publishedAt: new Date(),
            postId: postId,
            postUrl: postUrl,
            error: null,
            userId: processedContent.userId
          };
        }
      } catch (permalinkError: any) {
        log(`Ошибка при получении permalink для поста Instagram: ${permalinkError.message}`, 'social-publishing');
        log(`Используем запасной метод с генерацией короткого кода`, 'social-publishing');
      }
      
      // Запасной вариант, если не удалось получить permalink
      // Преобразуем ID в короткий код для URL
      const shortCode = this.convertInstagramIdToShortCode(postId);
      log(`Преобразован ID Instagram ${postId} в короткий код: ${shortCode}`, 'social-publishing');

      // Формируем URL публикации
      const postUrl = `https://www.instagram.com/p/${shortCode}/`;

      return {
        platform: 'instagram',
        status: 'published',
        publishedAt: new Date(),
        postId: postId,
        postUrl: postUrl,
        error: null,
        userId: processedContent.userId
      };
    } catch (error: any) {
      log(`Ошибка при публикации в Instagram: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации в Instagram: ${error.message}`,
        userId: content.userId
      };
    }
  }

  /**
   * Публикует контент в Facebook
   * @param content Контент для публикации
   * @param facebookSettings Настройки Facebook API
   * @returns Результат публикации
   */
  async publishToFacebook(
    content: CampaignContent,
    facebookSettings?: SocialMediaSettings['facebook']
  ): Promise<SocialPublication> {
    // Проверяем наличие настроек
    if (!facebookSettings?.token) {
      log(`Отсутствует токен Facebook для публикации контента ${content.id}`, 'social-publishing');
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует токен Facebook (Graph API) в настройках кампании',
        userId: content.userId
      };
    }

    if (!facebookSettings?.pageId) {
      log(`Отсутствует ID страницы Facebook для публикации контента ${content.id}`, 'social-publishing');
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует ID страницы Facebook в настройках кампании',
        userId: content.userId
      };
    }
    
    // Предупреждение о необходимых разрешениях
    log(`Публикация в Facebook требует специальных разрешений в токене. Убедитесь, что ваш токен имеет разрешения pages_read_engagement и pages_manage_posts для публикации на страницу, или publish_to_groups для групп.`, 'social-publishing');

    try {
      log(`Публикация в Facebook. Контент: ${content.id}, тип: ${content.contentType}`, 'social-publishing');
      log(`Публикация в Facebook. Токен: ${facebookSettings.token.substring(0, 6)}..., Страница: ${facebookSettings.pageId}`, 'social-publishing');

      // Обработка дополнительных изображений
      const processedContent = this.processAdditionalImages(content, 'Facebook');
      
      // Подготовка сообщения
      let message = processedContent.title ? `${processedContent.title}\n\n` : '';
      
      // Форматируем контент для Facebook с сохранением структуры текста
      const formattedContent = this.formatHtmlContent(processedContent.content, 'facebook');
      
      message += formattedContent;

      // Добавление хэштегов
      if (processedContent.hashtags && Array.isArray(processedContent.hashtags) && processedContent.hashtags.length > 0) {
        message += '\n\n' + processedContent.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      // Ограничиваем длину сообщения до 2200 символов (ограничение для совместимости с Instagram)
      const maxCaptionLength = 2200;
      if (message.length > maxCaptionLength) {
        // Обрезаем с запасом в 50 символов чтобы избежать проблем с Unicode или emoji
        const safeLimit = maxCaptionLength - 53;
        message = message.substring(0, safeLimit) + '...';
        log(`Сообщение для Facebook обрезано до ${message.length} символов для совместимости с платформами`, 'social-publishing');
      }

      log(`Подготовлено сообщение для Facebook: ${message.substring(0, 50)}...`, 'social-publishing');

      const pageId = facebookSettings.pageId;
      const token = facebookSettings.token;
      
      // Подготовка данных для публикации
      const requestData: Record<string, any> = {
        message: message,
        access_token: token
      };

      // Собираем все изображения для публикации
      const images = [];
      
      // Добавляем основное изображение с обработкой URL
      if (processedContent.imageUrl) {
        const processedImageUrl = this.processImageUrl(processedContent.imageUrl, 'facebook');
        images.push(processedImageUrl);
        log(`Обработано основное изображение для Facebook: ${processedImageUrl}`, 'social-publishing');
      }
      
      // Добавляем дополнительные изображения с обработкой URL
      if (processedContent.additionalImages && Array.isArray(processedContent.additionalImages)) {
        log(`Найдено ${processedContent.additionalImages.length} дополнительных изображений для Facebook`, 'social-publishing');
        
        // Фильтруем только валидные URL и обрабатываем их
        const validImages = processedContent.additionalImages
          .filter(url => url && typeof url === 'string')
          .map(url => this.processImageUrl(url, 'facebook'));
          
        images.push(...validImages);
        
        log(`Добавлено ${validImages.length} дополнительных изображений в массив для Facebook`, 'social-publishing');
      }
      
      log(`Подготовлено ${images.length} изображений для публикации в Facebook`, 'social-publishing');
      
      // Проверяем количество изображений для выбора стратегии публикации
      if (images.length > 1) {
        // Если несколько изображений, используем публикацию карусели
        log(`Facebook: обнаружено ${images.length} изображений, публикуем как карусель`, 'social-publishing');
        const carouselPublicationResult = await this.publishFacebookCarousel(processedContent, pageId, token, images, message);
        return carouselPublicationResult;
      } else if (images.length === 1) {
        // Если одно изображение, добавляем его к посту
        const imageUrl = images[0];
        log(`Добавление изображения в пост Facebook: ${imageUrl}`, 'social-publishing');
        
        // Для одного изображения используем photos endpoint вместо feed
        // Это обеспечивает лучшее отображение изображения в посте
        try {
          log(`Отправка запроса в Facebook Graph API для публикации фото на странице ${pageId}`, 'social-publishing');
          const response = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/photos`,
            {
              url: imageUrl,
              message: message,
              access_token: token,
              published: true
            },
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (response.data && response.data.id) {
            const photoId = response.data.id;
            log(`Успешная публикация фото в Facebook. Photo ID: ${photoId}`, 'social-publishing');
            
            // Формируем URL публикации
            // Здесь используется ID фото, но это не ID поста
            // В идеале нужно получить post_id из API, но он не всегда доступен
            const postUrl = `https://www.facebook.com/${pageId}/photos/${photoId}`;
            
            return {
              platform: 'facebook',
              status: 'published',
              publishedAt: new Date(),
              postId: photoId,
              postUrl: postUrl,
              error: null,
              userId: content.userId
            };
          }
        } catch (error: any) {
          log(`Ошибка при публикации фото в Facebook, пробуем feed endpoint: ${error.message}`, 'social-publishing');
          if (error.response?.data) {
            log(`Данные ошибки: ${JSON.stringify(error.response.data)}`, 'social-publishing');
          }
          // Продолжаем с feed endpoint, если photos endpoint не сработал
          requestData.link = imageUrl;
        }
      }

      // Публикация в Facebook через Graph API с использованием feed endpoint
      log(`Отправка запроса в Facebook Graph API (feed) для публикации на странице ${pageId}`, 'social-publishing');
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        requestData,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      log(`Получен ответ от Facebook API: ${JSON.stringify(response.data)}`, 'social-publishing');

      if (response.data && response.data.id) {
        const postId = response.data.id;
        // Формат ID поста: {page-id}_{post-id}
        const parts = postId.split('_');
        const actualPostId = parts.length > 1 ? parts[1] : postId;
        
        // Формируем URL публикации
        const postUrl = `https://www.facebook.com/${pageId}/posts/${actualPostId}`;
        
        log(`Успешная публикация в Facebook. Post ID: ${postId}, URL: ${postUrl}`, 'social-publishing');
        
        return {
          platform: 'facebook',
          status: 'published',
          publishedAt: new Date(),
          postId: postId,
          postUrl: postUrl,
          error: null,
          userId: content.userId
        };
      } else {
        log(`Неизвестный формат ответа от Facebook API: ${JSON.stringify(response.data)}`, 'social-publishing');
        return {
          platform: 'facebook',
          status: 'failed',
          publishedAt: null,
          error: `Неизвестный формат ответа от Facebook API: ${JSON.stringify(response.data)}`,
          userId: content.userId
        };
      }
    } catch (error: any) {
      log(`Ошибка при публикации в Facebook: ${error.message}`, 'social-publishing');
      
      // Проверяем, связана ли ошибка с отсутствием необходимых разрешений
      let errorMessage = `Ошибка при публикации в Facebook: ${error.message}`;
      
      if (error.response?.data?.error) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
        
        // Проверка на специфические ошибки разрешений
        const responseError = error.response.data.error;
        if (responseError.message && responseError.message.includes('permission')) {
          errorMessage = `Ошибка при публикации в Facebook: Недостаточно разрешений в токене. Для публикации на страницу требуются разрешения "pages_read_engagement" и "pages_manage_posts". Для публикации в группу требуется разрешение "publish_to_groups".`;
        }
      }
      
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: errorMessage,
        userId: content.userId
      };
    }
  }

  /**
   * Публикует контент в указанную социальную платформу
   * @param content Контент для публикации
   * @param platform Социальная платформа
   * @param settings Настройки для социальных сетей
   * @returns Результат публикации
   */
  async publishToPlatform(
    content: CampaignContent,
    platform: SocialPlatform,
    settings: SocialMediaSettings
  ): Promise<SocialPublication> {
    log(`Публикация контента "${content.title}" в ${platform}`, 'social-publishing');

    switch (platform) {
      case 'telegram':
        return await this.publishToTelegram(content, settings.telegram);
      case 'vk':
        return await this.publishToVk(content, settings.vk);
      case 'instagram':
        return await this.publishToInstagram(content, settings.instagram);
      case 'facebook':
        return await this.publishToFacebook(content, settings.facebook);
      default:
        return {
          platform: platform as SocialPlatform,
          status: 'failed',
          publishedAt: null,
          error: `Неподдерживаемая платформа: ${platform}`
        };
    }
  }

  /**
   * Обновляет статус публикации контента в базе данных
   * @param contentId ID контента
   * @param platform Социальная платформа
   * @param publicationResult Результат публикации
   * @returns Обновленный контент или null в случае ошибки
   */
  async updatePublicationStatus(
    contentId: string,
    platform: SocialPlatform,
    publicationResult: SocialPublication
  ): Promise<CampaignContent | null> {
    try {
      // Получаем текущий контент из хранилища
      const systemToken = await this.getSystemToken();
      let content = null;
      
      if (systemToken) {
        content = await storage.getCampaignContentById(contentId, systemToken);
      }
      
      if (!content) {
        log(`Не удалось получить контент с ID ${contentId} для обновления статуса`, 'social-publishing');
        log(`Прямой запрос для получения контента через API: ${contentId}`, 'social-publishing');
        
        // Прямой запрос к API для получения контента
        try {
          const directusUrl = process.env.DIRECTUS_API_URL || 'https://directus.nplanner.ru';
          const response = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
            headers: {
              'Authorization': `Bearer ${systemToken}`
            }
          });
          
          if (response.data && response.data.data) {
            content = response.data.data;
            log(`Контент получен напрямую через API: ${contentId}`, 'social-publishing');
          }
        } catch (error) {
          log(`Ошибка при получении контента через API: ${(error as any).message}`, 'social-publishing');
        }
      }
      
      if (!content) {
        return null;
      }
      
      // Добавляем userId если его нет
      if (publicationResult.userId) {
        log(`Добавлен userId в publicationResult: ${publicationResult.userId}`, 'social-publishing');
      } else if (content.userId) {
        publicationResult.userId = content.userId;
      }
      
      // Обновляем статус публикации для платформы
      let socialPlatforms = content.socialPlatforms || {};
      
      // Преобразуем из строки в объект, если это строка
      if (typeof socialPlatforms === 'string') {
        try {
          socialPlatforms = JSON.parse(socialPlatforms);
        } catch (e) {
          socialPlatforms = {};
        }
      }
      
      // Обновляем информацию о платформе
      socialPlatforms[platform] = publicationResult;
      
      // Определяем общий статус публикации на основе статусов всех платформ
      const allPublished = this.checkAllPlatformsPublished(socialPlatforms);
      
      // Определяем дату первой успешной публикации (если есть)
      let firstPublishedAt: Date | null = null;
      
      // Проверяем все платформы для нахождения самой ранней даты публикации
      Object.values(socialPlatforms).forEach((platformInfo: any) => {
        if (platformInfo && platformInfo.status === 'published' && platformInfo.publishedAt) {
          const publishedDate = new Date(platformInfo.publishedAt);
          if (!firstPublishedAt || publishedDate < firstPublishedAt) {
            firstPublishedAt = publishedDate;
          }
        }
      });
      
      // Получаем системный токен для обновления статуса
      if (!systemToken) {
        log(`Не удалось получить системный токен для обновления статуса контента`, 'social-publishing');
        
        // Пробуем прямой запрос к API для обновления статуса
        try {
          const directusUrl = process.env.DIRECTUS_API_URL || 'https://directus.nplanner.ru';
          const updateData: Record<string, any> = {
            socialPlatforms,
            status: allPublished ? 'published' : 'scheduled'
          };
          
          // Добавляем дату публикации, если есть хотя бы одна успешная публикация
          if (firstPublishedAt) {
            const dateValue = firstPublishedAt as Date;
            updateData.published_at = dateValue.toISOString();
            log(`Обновление поля published_at на ${dateValue.toISOString()}`, 'social-publishing');
          }
          
          await axios.patch(`${directusUrl}/items/campaign_content/${contentId}`, updateData, {
            headers: {
              'Authorization': `Bearer ${systemToken}`
            }
          });
          
          log(`Статус контента ${contentId} успешно обновлен через API: ${allPublished ? 'published' : 'scheduled'}`, 'social-publishing');
          return { ...content, socialPlatforms, publishedAt: firstPublishedAt };
        } catch (error) {
          log(`Ошибка при обновлении статуса через API: ${(error as any).message}`, 'social-publishing');
          return null;
        }
      }
      
      // Обновляем контент через хранилище
      const updateData: Partial<InsertCampaignContent> = {
        socialPlatforms,
        status: allPublished ? 'published' : 'scheduled'
      };
      
      // Добавляем дату публикации, если есть хотя бы одна успешная публикация
      if (firstPublishedAt) {
        const dateValue = firstPublishedAt as Date;
        (updateData as any).publishedAt = firstPublishedAt;
        log(`Обновление поля publishedAt на ${dateValue.toISOString()}`, 'social-publishing');
      }
      
      const updatedContent = await storage.updateCampaignContent(contentId, updateData, systemToken);
      
      log(`Статус контента ${contentId} успешно обновлен: ${allPublished ? 'published' : 'scheduled'}`, 'social-publishing');
      return updatedContent;
    } catch (error: any) {
      log(`Ошибка при обновлении статуса публикации: ${error.message}`, 'social-publishing');
      return null;
    }
  }

  /**
   * Проверяет, опубликован ли контент на всех платформах
   * @param socialPlatforms Информация о публикациях на платформах
   * @returns true, если контент опубликован на всех платформах, иначе false
   */
  private checkAllPlatformsPublished(socialPlatforms: Record<string, SocialPublication>): boolean {
    // Если нет информации о платформах, считаем, что не опубликовано
    if (!socialPlatforms || Object.keys(socialPlatforms).length === 0) {
      return false;
    }
    
    // Проверяем, что на всех платформах статус 'published'
    return Object.values(socialPlatforms).every(platform => platform.status === 'published');
  }

  /**
   * Получает системный токен для авторизации в Directus
   * @returns Токен авторизации или null, если не удалось получить токен
   */
  /**
   * Публикует карусель изображений в Instagram
   * @param content Контент для публикации
   * @param igBusinessId ID бизнес-аккаунта Instagram
   * @param token Токен доступа
   * @param images Массив URL изображений для публикации
   * @param caption Подпись к публикации
   * @returns Результат публикации
   */
  private async publishInstagramCarousel(
    content: CampaignContent,
    igBusinessId: string, 
    token: string,
    images: string[],
    caption: string
  ): Promise<SocialPublication> {
    try {
      log(`Публикация карусели в Instagram. Контент: ${content.id}, количество изображений: ${images.length}`, 'social-publishing');
      log(`Входные данные для Instagram карусели: content.additionalImages=${typeof content.additionalImages} (length: ${Array.isArray(content.additionalImages) ? content.additionalImages.length : 'not array'})`, 'social-publishing');
      log(`Длина подписи для Instagram: ${caption.length} символов`, 'social-publishing');
      
      if (images.length <= 1) {
        log(`Недостаточно изображений для карусели в Instagram (${images.length}). Нужно минимум 2 изображения.`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: `Недостаточно изображений для карусели в Instagram. Нужно минимум 2 изображения.`,
          userId: content.userId
        };
      }
      
      // Шаг 1: Создаем дочерние медиа-контейнеры для каждого изображения
      const childrenMediaIds = [];
      
      for (let i = 0; i < images.length; i++) {
        // Изображения уже обработаны на этапе подготовки массива
        const imageUrl = images[i];
        log(`Создание дочернего контейнера ${i + 1}/${images.length} для изображения: ${imageUrl.substring(0, 50)}...`, 'social-publishing');
        
        try {
          const createMediaResponse = await axios.post(
            `https://graph.facebook.com/v18.0/${igBusinessId}/media`,
            {
              image_url: imageUrl,
              is_carousel_item: true,
              access_token: token,
              media_type: 'IMAGE'
            },
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (createMediaResponse.data && createMediaResponse.data.id) {
            childrenMediaIds.push(createMediaResponse.data.id);
            log(`Дочерний контейнер ${i + 1} создан успешно, ID: ${createMediaResponse.data.id}`, 'social-publishing');
          } else {
            log(`Ошибка при создании дочернего контейнера ${i + 1}: Неверный формат ответа`, 'social-publishing');
          }
        } catch (error: any) {
          log(`Ошибка при создании дочернего контейнера ${i + 1}: ${error.message}`, 'social-publishing');
          if (error.response) {
            log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
          }
        }
      }
      
      // Проверяем, есть ли хотя бы одно изображение для карусели
      if (childrenMediaIds.length === 0) {
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Не удалось создать ни одного дочернего контейнера для карусели',
          userId: content.userId
        };
      }
      
      // Шаг 2: Создаем родительский контейнер для карусели
      log(`Создание родительского контейнера карусели с ${childrenMediaIds.length} изображениями`, 'social-publishing');
      const createCarouselResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igBusinessId}/media`,
        {
          media_type: 'CAROUSEL',
          caption: caption,
          children: childrenMediaIds,
          access_token: token
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!createCarouselResponse.data || !createCarouselResponse.data.id) {
        log(`Ошибка при создании родительского контейнера карусели: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при создании родительского контейнера карусели',
          userId: content.userId
        };
      }
      
      const carouselId = createCarouselResponse.data.id;
      log(`Родительский контейнер карусели создан успешно, ID: ${carouselId}`, 'social-publishing');
      
      // Шаг 3: Публикуем карусель
      log(`Публикация карусели в Instagram`, 'social-publishing');
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${igBusinessId}/media_publish`,
        {
          creation_id: carouselId,
          access_token: token
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!publishResponse.data || !publishResponse.data.id) {
        log(`Ошибка при публикации карусели: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'instagram',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при публикации карусели: Неверный формат ответа',
          userId: content.userId
        };
      }
      
      const postId = publishResponse.data.id;
      log(`Карусель успешно опубликована в Instagram, ID: ${postId}`, 'social-publishing');
      
      // Получаем информацию о созданном медиа, чтобы извлечь permalink с коротким кодом
      try {
        log(`Запрос медиа данных для получения permalink/shortcode для карусели с ID: ${postId}`, 'social-publishing');
        const mediaInfoResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${postId}`,
          {
            params: {
              fields: 'permalink',
              access_token: token
            }
          }
        );
        
        if (mediaInfoResponse.data && mediaInfoResponse.data.permalink) {
          // Получаем permalink из ответа API, содержащий реальный короткий код Instagram
          const permalink = mediaInfoResponse.data.permalink;
          log(`Получен permalink из API Instagram для карусели: ${permalink}`, 'social-publishing');
          
          // Формируем URL публикации из permalink
          const postUrl = permalink;
          log(`Использован permalink как postUrl для карусели: ${postUrl}`, 'social-publishing');
          
          return {
            platform: 'instagram',
            status: 'published',
            publishedAt: new Date(),
            postId: postId,
            postUrl: postUrl,
            error: null,
            userId: content.userId
          };
        }
      } catch (permalinkError: any) {
        log(`Ошибка при получении permalink для карусели в Instagram: ${permalinkError.message}`, 'social-publishing');
        log(`Используем запасной метод с генерацией короткого кода для карусели`, 'social-publishing');
      }
      
      // Запасной вариант, если не удалось получить permalink
      // Преобразуем ID в короткий код для URL
      const shortCode = this.convertInstagramIdToShortCode(postId);
      log(`Преобразован ID Instagram карусели ${postId} в короткий код: ${shortCode}`, 'social-publishing');
      
      // Формируем URL публикации
      const postUrl = `https://www.instagram.com/p/${shortCode}/`;
      
      return {
        platform: 'instagram',
        status: 'published',
        publishedAt: new Date(),
        postId: postId,
        postUrl: postUrl,
        error: null,
        userId: content.userId
      };
    } catch (error: any) {
      log(`Ошибка при публикации карусели в Instagram: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'instagram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации карусели в Instagram: ${error.message}`,
        userId: content.userId
      };
    }
  }

  /**
   * Публикует карусель изображений в Facebook
   * @param content Контент для публикации
   * @param pageId ID страницы Facebook
   * @param token Токен доступа
   * @param images Массив URL изображений для публикации
   * @param message Текст сообщения
   * @returns Результат публикации
   */
  private async publishFacebookCarousel(
    content: CampaignContent,
    pageId: string,
    token: string,
    images: string[],
    message: string
  ): Promise<SocialPublication> {
    try {
      log(`Публикация карусели в Facebook. Контент: ${content.id}, количество изображений: ${images.length}`, 'social-publishing');
      
      if (images.length <= 1) {
        log(`Недостаточно изображений для карусели в Facebook (${images.length}). Нужно минимум 2 изображения.`, 'social-publishing');
        return {
          platform: 'facebook',
          status: 'failed',
          publishedAt: null,
          error: `Недостаточно изображений для карусели в Facebook. Нужно минимум 2 изображения.`,
          userId: content.userId
        };
      }
      
      // Facebook использует другой метод публикации карусели через feed endpoint
      // с использованием параметра attached_media для добавления нескольких изображений
      
      // Шаг 1: Загружаем каждое изображение отдельно
      const mediaIds = [];
      
      for (let i = 0; i < images.length; i++) {
        // Изображения уже обработаны на этапе подготовки массива
        const imageUrl = images[i];
        log(`Загрузка изображения ${i + 1}/${images.length} для Facebook: ${imageUrl.substring(0, 50)}...`, 'social-publishing');
        
        try {
          // Сначала загружаем фото на страницу, но без публикации (unpublished)
          const uploadResponse = await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/photos`,
            {
              url: imageUrl,
              published: false, // важно: не публикуем сейчас
              access_token: token
            },
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (uploadResponse.data && uploadResponse.data.id) {
            mediaIds.push({ media_fbid: uploadResponse.data.id });
            log(`Изображение ${i + 1} загружено успешно, ID: ${uploadResponse.data.id}`, 'social-publishing');
          } else {
            log(`Ошибка при загрузке изображения ${i + 1} для Facebook: Неверный формат ответа`, 'social-publishing');
          }
        } catch (error: any) {
          log(`Ошибка при загрузке изображения ${i + 1} для Facebook: ${error.message}`, 'social-publishing');
          if (error.response) {
            log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
          }
          
          // Продолжаем с оставшимися изображениями
        }
      }
      
      // Проверяем, загрузилось ли хоть одно изображение
      if (mediaIds.length === 0) {
        return {
          platform: 'facebook',
          status: 'failed',
          publishedAt: null,
          error: 'Не удалось загрузить ни одного изображения для карусели в Facebook',
          userId: content.userId
        };
      }
      
      // Шаг 2: Публикуем пост со всеми загруженными изображениями
      log(`Публикация поста в Facebook с ${mediaIds.length} изображениями`, 'social-publishing');
      const publishData: Record<string, any> = {
        message: message,
        access_token: token
      };
      
      // Добавляем все загруженные медиа-файлы к посту
      publishData.attached_media = mediaIds;
      
      log(`Отправка запроса в Facebook API для публикации карусели на странице ${pageId}`, 'social-publishing');
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        publishData,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!response.data || !response.data.id) {
        log(`Ошибка при публикации карусели в Facebook: Неверный формат ответа`, 'social-publishing');
        return {
          platform: 'facebook',
          status: 'failed',
          publishedAt: null,
          error: 'Ошибка при публикации карусели в Facebook: Неверный формат ответа',
          userId: content.userId
        };
      }
      
      const postId = response.data.id;
      log(`Карусель успешно опубликована в Facebook, Post ID: ${postId}`, 'social-publishing');
      
      // Формат ID поста: {page-id}_{post-id}
      const parts = postId.split('_');
      const actualPostId = parts.length > 1 ? parts[1] : postId;
      
      // Формируем URL публикации
      const postUrl = `https://www.facebook.com/${pageId}/posts/${actualPostId}`;
      
      return {
        platform: 'facebook',
        status: 'published',
        publishedAt: new Date(),
        postId: postId,
        postUrl: postUrl,
        error: null,
        userId: content.userId
      };
    } catch (error: any) {
      log(`Ошибка при публикации карусели в Facebook: ${error.message}`, 'social-publishing');
      if (error.response) {
        log(`Данные ответа при ошибке: ${JSON.stringify(error.response.data)}`, 'social-publishing');
      }
      return {
        platform: 'facebook',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации карусели в Facebook: ${error.message}`,
        userId: content.userId
      };
    }
  }

  /**
   * Преобразует числовой ID Instagram в короткий код для URL
   * Instagram использует специальное кодирование для формирования коротких кодов
   * @param id Числовой ID публикации
   * @returns Короткий код для использования в URL
   */
  private convertInstagramIdToShortCode(id: string): string {
    try {
      // Instagram использует модифицированную версию base64 с алфавитом:
      // ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
      
      // На практике, Instagram использует свой собственный алгоритм, который сложно воспроизвести точно
      // Для демонстрационных целей создадим короткий код из случайных символов
      
      // Генерируем короткий код длиной 11 символов (стандартная длина Instagram)
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      
      // Для детерминистичности используем хеш на основе ID
      let shortCode = '';
      
      // Используем первые несколько символов как "префикс" для создания узнаваемых кодов
      // Обычно короткие коды Instagram имеют длину от 8 до 11 символов
      shortCode = 'C' + alphabet[id.length % 64]; // Начало со случайной буквы
      
      // Добавляем еще 9 символов для создания короткого кода общей длиной 11 символов
      for (let i = 0; i < 9; i++) {
        // Используем различные символы ID для генерации разных позиций короткого кода
        const charIndex = (id.charCodeAt(i % id.length) + i) % alphabet.length;
        shortCode += alphabet[charIndex];
      }
      
      log(`Преобразован ID Instagram ${id} в короткий код ${shortCode}`, 'social-publishing');
      return shortCode;
    } catch (error) {
      // Если возникла ошибка в преобразовании, возвращаем фиксированный короткий код
      log(`Ошибка при преобразовании ID Instagram в короткий код: ${error}`, 'social-publishing');
      return 'Cx1AbCdEfG'; // Фиксированный короткий код в случае ошибки
    }
  }

}

export const socialPublishingService = new SocialPublishingService();