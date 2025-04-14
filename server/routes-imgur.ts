import { Router } from 'express';
import { imgurUploaderService } from './services/imgur-uploader';
import { socialPublishingWithImgurService } from './services/social-publishing-with-imgur';
import { storage } from './storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { mkdir } from 'fs/promises';
import axios from 'axios';
import http from 'http';
import https from 'https';

// Настройка Multer для загрузки файлов
const uploadsDir = path.join(process.cwd(), 'uploads', 'images');

// Создаем директорию для загрузки, если она не существует
(async () => {
  try {
    await mkdir(uploadsDir, { recursive: true });
    console.log(`Директория для загрузки изображений создана: ${uploadsDir}`);
  } catch (error) {
    console.error(`Ошибка при создании директории для загрузки: ${error}`);
  }
})();

const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Конфигурация Multer для изображений
const imageUpload = multer({ 
  storage: storage_config,
  limits: {
    fileSize: 5 * 1024 * 1024 // Ограничение размера файла (5MB)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены к загрузке'));
    }
  }
});

// Создаем директорию для загрузки видео, если она не существует
const videosDir = path.join(process.cwd(), 'uploads', 'videos');
(async () => {
  try {
    await mkdir(videosDir, { recursive: true });
    console.log(`Директория для загрузки видео создана: ${videosDir}`);
  } catch (error) {
    console.error(`Ошибка при создании директории для загрузки видео: ${error}`);
  }
})();

// Конфигурация для видео
const videoUpload = multer({ 
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, videosDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // Ограничение размера файла (50MB)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Только видео разрешены к загрузке'));
    }
  }
});

/**
 * Маршруты для работы с загрузкой изображений на Imgur
 */
export function registerImgurRoutes(router: Router) {
  // Маршрут для загрузки изображения по URL
  router.post('/api/imgur/upload-from-url', async (req, res) => {
    try {
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ 
          success: false, 
          error: 'Отсутствует URL изображения' 
        });
      }
      
      const imgurUrl = await imgurUploaderService.uploadImageFromUrl(imageUrl);
      
      if (!imgurUrl) {
        return res.status(500).json({ 
          success: false, 
          error: 'Не удалось загрузить изображение на Imgur' 
        });
      }
      
      return res.status(200).json({ 
        success: true, 
        data: { url: imgurUrl } 
      });
    } catch (error) {
      console.error('Ошибка при загрузке изображения на Imgur:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Ошибка при загрузке изображения: ${error}` 
      });
    }
  });
  
  // Маршрут для загрузки нескольких изображений по URL
  router.post('/api/imgur/upload-multiple', async (req, res) => {
    try {
      const { imageUrls } = req.body;
      
      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Отсутствует массив URL изображений' 
        });
      }
      
      const imgurUrls = await imgurUploaderService.uploadMultipleImagesFromUrls(imageUrls);
      
      return res.status(200).json({ 
        success: true, 
        data: { 
          urls: imgurUrls,
          totalUploaded: imgurUrls.length,
          totalRequested: imageUrls.length
        } 
      });
    } catch (error) {
      console.error('Ошибка при загрузке изображений на Imgur:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Ошибка при загрузке изображений: ${error}` 
      });
    }
  });
  
  // Маршрут для универсальной публикации контента через Imgur
  router.post('/api/imgur/publish-content', async (req, res) => {
    try {
      const { contentId, platform, settings, userId } = req.body;
      
      console.log(`[routes-imgur] Запрос на публикацию контента ${contentId} в платформу ${platform}`);
      
      if (!contentId) {
        return res.status(400).json({
          success: false,
          error: 'Не указан ID контента'
        });
      }
      
      if (!platform) {
        return res.status(400).json({
          success: false,
          error: 'Не указана платформа для публикации'
        });
      }
      
      // Проверяем поддерживаемые платформы
      if (!['telegram', 'vk', 'instagram', 'facebook'].includes(platform)) {
        return res.status(400).json({
          success: false,
          error: `Неподдерживаемая платформа: ${platform}`
        });
      }
      
      // Проверяем настройки в зависимости от платформы
      if (platform === 'telegram' && (!settings?.telegram?.token || !settings?.telegram?.chatId)) {
        return res.status(400).json({
          success: false,
          error: 'Не указаны настройки Telegram (токен или ID чата)'
        });
      }
      
      if (platform === 'vk' && (!settings?.vk?.token || !settings?.vk?.groupId)) {
        return res.status(400).json({
          success: false,
          error: 'Не указаны настройки VK (токен или ID группы)'
        });
      }
      
      if (platform === 'instagram' && (!settings?.instagram?.token)) {
        return res.status(400).json({
          success: false,
          error: 'Не указаны настройки Instagram (токен)'
        });
      }
      
      if (platform === 'facebook' && (!settings?.facebook?.token || !settings?.facebook?.pageId)) {
        return res.status(400).json({
          success: false,
          error: 'Не указаны настройки Facebook (токен или ID страницы)'
        });
      }
      
      // Получаем контент из базы данных
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        console.log(`[routes-imgur] Контент с ID ${contentId} не найден`);
        return res.status(404).json({
          success: false,
          error: `Контент с ID ${contentId} не найден`
        });
      }
      
      // Если передан userId, добавляем его в контент
      if (userId) {
        content.userId = userId;
        console.log(`[routes-imgur] Добавлен userId: ${userId} к контенту ${contentId}`);
      }
      
      console.log(`[routes-imgur] Публикация контента ${contentId} в ${platform}`);
      
      // Публикуем контент на выбранной платформе через универсальный метод
      const result = await socialPublishingWithImgurService.publishToPlatform(
        content,
        platform,
        settings
      );
      
      // Обновляем статус публикации в базе данных
      try {
        await socialPublishingWithImgurService.updatePublicationStatus(
          contentId,
          platform,
          result
        );
        console.log(`[routes-imgur] Статус публикации обновлен для контента ${contentId} в ${platform}`);
      } catch (updateError) {
        console.error(`[routes-imgur] Ошибка при обновлении статуса публикации: ${updateError}`);
        // Продолжаем выполнение даже если обновление статуса не удалось
      }
      
      return res.status(200).json({
        success: result.status === 'published',
        data: result
      });
    } catch (error) {
      console.error(`[routes-imgur] Ошибка при публикации контента: ${error}`);
      return res.status(500).json({
        success: false,
        error: `Ошибка при публикации контента: ${error}`
      });
    }
  });
  
  // Маршрут для проверки информации о чате Telegram
  router.post('/api/imgur/check-telegram-chat', async (req, res) => {
    try {
      const { telegramToken, telegramChatId } = req.body;
      
      if (!telegramToken) {
        return res.status(400).json({
          success: false,
          error: 'Не указан токен Telegram бота'
        });
      }
      
      if (!telegramChatId) {
        return res.status(400).json({
          success: false,
          error: 'Не указан ID чата Telegram'
        });
      }
      
      console.log(`[routes-imgur] Проверка чата в Telegram:`, {
        chatId: telegramChatId,
        tokenLength: telegramToken.length
      });
      
      // Пытаемся получить информацию о чате через API Telegram
      try {
        const baseUrl = `https://api.telegram.org/bot${telegramToken}`;
        
        // Предварительная обработка ID чата
        let formattedChatId = telegramChatId.trim();
        
        // Стратегия 1: Попробовать с исходным ID
        let chatInfoResponse = await axios.get(`${baseUrl}/getChat`, {
          params: { chat_id: formattedChatId },
          validateStatus: () => true,
          timeout: 10000
        });
        
        // Если не получилось, пробуем другие форматы
        if (chatInfoResponse.status !== 200 || !chatInfoResponse.data.ok) {
          console.log(`[routes-imgur] Не удалось получить информацию с исходным ID, пробуем другие форматы`);
          
          // Стратегия 2: Если это не username и не числовой ID, добавляем @ для username
          if (!formattedChatId.startsWith('@') && !formattedChatId.match(/^-?\d+$/) && !formattedChatId.includes('.')) {
            formattedChatId = `@${formattedChatId}`;
            console.log(`[routes-imgur] Пробуем как username с @: ${formattedChatId}`);
            
            chatInfoResponse = await axios.get(`${baseUrl}/getChat`, {
              params: { chat_id: formattedChatId },
              validateStatus: () => true,
              timeout: 10000
            });
          }
          
          // Стратегия 3: Если это числовой ID, но не канал, проверяем нужно ли добавить -100
          if ((chatInfoResponse.status !== 200 || !chatInfoResponse.data.ok) && 
              !formattedChatId.startsWith('@') && !formattedChatId.startsWith('-100') && 
              formattedChatId.match(/^\d+$/)) {
                
            // Для каналов/групп добавляем префикс -100
            formattedChatId = `-100${formattedChatId}`;
            console.log(`[routes-imgur] Пробуем как ID канала с префиксом -100: ${formattedChatId}`);
            
            chatInfoResponse = await axios.get(`${baseUrl}/getChat`, {
              params: { chat_id: formattedChatId },
              validateStatus: () => true,
              timeout: 10000
            });
          }
          
          // Стратегия 4: Если ID начинается с минуса, но не с "-100", преобразуем его
          if ((chatInfoResponse.status !== 200 || !chatInfoResponse.data.ok) && 
              formattedChatId.startsWith('-') && !formattedChatId.startsWith('-100')) {
                
            formattedChatId = `-100${formattedChatId.substring(1)}`;
            console.log(`[routes-imgur] Пробуем как ID канала, заменяя минус на -100: ${formattedChatId}`);
            
            chatInfoResponse = await axios.get(`${baseUrl}/getChat`, {
              params: { chat_id: formattedChatId },
              validateStatus: () => true,
              timeout: 10000
            });
          }
        }
        
        console.log(`[routes-imgur] Финальный ответ API Telegram:`, 
                   chatInfoResponse.status, chatInfoResponse.data.ok ? 'успех' : 'ошибка');
        
        if (chatInfoResponse.status === 200 && chatInfoResponse.data.ok) {
          // Чат найден
          const chatInfo = chatInfoResponse.data.result;
          
          // Логируем расширенную информацию о найденном чате
          console.log(`[routes-imgur] Найден чат:`, {
            id: chatInfo.id,
            type: chatInfo.type,
            title: chatInfo.title || null,
            username: chatInfo.username || null
          });
          
          return res.status(200).json({
            success: true,
            data: chatInfo,
            originalId: telegramChatId,
            formattedId: formattedChatId,
            recommendedFormat: chatInfo.username ? `@${chatInfo.username}` : String(chatInfo.id)
          });
        } else {
          // Чат не найден или другая ошибка после всех попыток
          return res.status(400).json({
            success: false,
            error: chatInfoResponse.data?.description || 'Не удалось получить информацию о чате'
          });
        }
      } catch (error: any) {
        console.error(`[routes-imgur] Ошибка при проверке чата Telegram: ${error.message}`);
        return res.status(500).json({
          success: false,
          error: `Ошибка при проверке чата Telegram: ${error.message || 'Неизвестная ошибка'}`
        });
      }
    } catch (error: any) {
      console.error(`[routes-imgur] Ошибка при проверке чата Telegram: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: `Ошибка при проверке чата Telegram: ${error.message || 'Неизвестная ошибка'}`
      });
    }
  });
  
  // Маршрут для тестирования публикации в Telegram с использованием Imgur
  router.post('/api/imgur/test-telegram-publication', async (req, res) => {
    try {
      const { contentId, telegramToken, telegramChatId } = req.body;
      
      if (!contentId) {
        return res.status(400).json({
          success: false,
          error: 'Не указан ID контента'
        });
      }
      
      if (!telegramToken || !telegramChatId) {
        return res.status(400).json({
          success: false,
          error: 'Не указаны настройки Telegram (токен или ID чата)'
        });
      }
      
      // Добавляем логирование для отладки
      console.log(`[routes-imgur] Тестовая публикация в Telegram:`, {
        chatId: telegramChatId,
        chatIdLength: telegramChatId.length,
        tokenLength: telegramToken.length,
        contentId
      });
      
      // Получаем контент из базы данных
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({
          success: false,
          error: `Контент с ID ${contentId} не найден`
        });
      }
      
      // Публикуем контент в Telegram через сервис с поддержкой Imgur
      const result = await socialPublishingWithImgurService.publishToTelegram(
        content,
        {
          token: telegramToken,
          chatId: telegramChatId
        }
      );
      
      return res.status(200).json({
        success: result.status === 'published',
        data: result
      });
    } catch (error) {
      console.error('Ошибка при тестировании публикации в Telegram:', error);
      return res.status(500).json({
        success: false,
        error: `Ошибка при тестировании публикации: ${error}`
      });
    }
  });
  
  // Маршрут для загрузки файла изображения и его отправки на ImgBB
  router.post('/api/imgur/upload-file', imageUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Файл не загружен'
        });
      }
      
      const filePath = req.file.path;
      console.log(`Файл успешно загружен: ${filePath}`);
      
      // Загружаем файл на Imgur
      const imgurUrl = await imgurUploaderService.uploadImageFromFile(filePath);
      
      if (!imgurUrl) {
        return res.status(500).json({
          success: false,
          error: 'Не удалось загрузить изображение на Imgur'
        });
      }
      
      // Отправляем ответ в двух форматах для совместимости
      const responseData = {
        success: true,
        data: {
          originalname: req.file.originalname,
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: filePath,
          url: imgurUrl,
          link: imgurUrl // Добавляем также поле link для совместимости
        },
        url: imgurUrl,  // Дублируем URL в корне ответа
        link: imgurUrl  // И также добавляем поле link для совместимости
      };
      
      console.log('Отправляем ответ на запрос загрузки файла:', JSON.stringify(responseData, null, 2));
      
      return res.status(200).json(responseData);
    } catch (error) {
      console.error('Ошибка при загрузке файла на Imgur:', error);
      return res.status(500).json({
        success: false,
        error: `Ошибка при загрузке файла: ${error}`
      });
    }
  });
  
  // Маршрут для получения списка загруженных изображений
  router.get('/api/imgur/images', (req, res) => {
    try {
      const files = fs.readdirSync(uploadsDir);
      const images = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      }).map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: `/uploads/images/${file}`,
          size: stats.size,
          created: stats.birthtime
        };
      });
      
      return res.status(200).json({
        success: true,
        data: { images }
      });
    } catch (error) {
      console.error('Ошибка при получении списка изображений:', error);
      return res.status(500).json({
        success: false,
        error: `Ошибка при получении списка изображений: ${error}`
      });
    }
  });
  
  // Маршрут для статического доступа к загруженным изображениям
  router.get('/uploads/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    } else {
      return res.status(404).json({
        success: false,
        error: 'Файл не найден'
      });
    }
  });
  
  // Прокси для изображений с Imgur и других сервисов
  router.get('/api/proxy-image', async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      
      if (!imageUrl) {
        return res.status(400).send('URL изображения не указан');
      }
      
      console.log(`Проксирование изображения: ${imageUrl}`);
      
      // Создаем HTTP или HTTPS клиент в зависимости от протокола URL
      const isHttps = imageUrl.startsWith('https://');
      const agent = isHttps ? https : http;
      
      try {
        // Получаем изображение как поток
        const response = await axios({
          method: 'GET',
          url: imageUrl,
          responseType: 'stream',
          timeout: 10000, // 10 секунд таймаут
          maxContentLength: 10 * 1024 * 1024, // Максимальный размер 10MB
        });
        
        // Устанавливаем заголовки ответа
        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400'); // Кэшировать на 1 день
        res.set('Access-Control-Allow-Origin', '*'); // Разрешаем доступ с любого домена
        
        // Отправляем изображение клиенту
        response.data.pipe(res);
      } catch (error) {
        console.error(`Ошибка при проксировании изображения: ${error}`);
        res.status(500).send('Не удалось загрузить изображение');
      }
    } catch (error) {
      console.error(`Ошибка в маршруте прокси-изображения: ${error}`);
      res.status(500).send('Ошибка сервера при загрузке изображения');
    }
  });
  
  // Маршрут для загрузки видео и сохранения его локально (с попыткой загрузки на Imgur при необходимости)
  router.post('/api/imgur/upload-video', videoUpload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Видео файл не загружен'
        });
      }
      
      const filePath = req.file.path;
      console.log(`Видео файл успешно загружен: ${filePath}`);
      
      // Формируем URL для локально сохраненного файла
      const fileName = req.file.filename;
      const videoRelativePath = `/uploads/videos/${fileName}`;
      const videoUrl = videoRelativePath;
      
      // Пытаемся загрузить видео на Imgur, но если не получится, используем локальный URL
      try {
        const imgurUrl = await imgurUploaderService.uploadVideoFromFile(filePath);
        if (imgurUrl) {
          console.log(`Видео успешно загружено на Imgur: ${imgurUrl}`);
          
          // Отправляем ответ с URL Imgur
          const responseData = {
            success: true,
            data: {
              originalname: req.file.originalname,
              filename: req.file.filename,
              mimetype: req.file.mimetype,
              size: req.file.size,
              path: filePath,
              url: imgurUrl,
              link: imgurUrl,
              localUrl: videoUrl // Добавляем и локальный URL на всякий случай
            },
            url: imgurUrl,
            link: imgurUrl
          };
          
          console.log('Отправляем ответ на запрос загрузки видео (Imgur):', JSON.stringify(responseData, null, 2));
          return res.status(200).json(responseData);
        }
      } catch (imgurError) {
        console.error('Ошибка при загрузке на Imgur, используем локальное хранение:', imgurError);
      }
      
      // Если загрузка на Imgur не удалась, используем локальный URL
      const responseData = {
        success: true,
        data: {
          originalname: req.file.originalname,
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: filePath,
          url: videoUrl,
          link: videoUrl
        },
        url: videoUrl,
        link: videoUrl
      };
      
      console.log('Отправляем ответ на запрос загрузки видео (локальное хранение):', JSON.stringify(responseData, null, 2));
      return res.status(200).json(responseData);
    } catch (error) {
      console.error('Ошибка при загрузке видео:', error);
      return res.status(500).json({
        success: false,
        error: `Ошибка при загрузке видео: ${error}`
      });
    }
  });
  
  // Маршрут для загрузки видео по URL
  router.post('/api/imgur/upload-video-from-url', async (req, res) => {
    try {
      const { videoUrl } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({ 
          success: false, 
          error: 'Отсутствует URL видео' 
        });
      }
      
      // Проверяем, что URL доступен
      try {
        const videoResponse = await axios.head(videoUrl, { 
          timeout: 5000,
          validateStatus: status => status < 400
        });
        
        // Если URL доступен, просто возвращаем его как есть, не загружая на Imgur
        if (videoResponse.status < 400) {
          console.log(`Видео по URL ${videoUrl} доступно, возвращаем исходный URL`);
          return res.status(200).json({ 
            success: true, 
            data: { url: videoUrl, link: videoUrl },
            url: videoUrl
          });
        }
      } catch (error) {
        console.error(`Ошибка при проверке доступности видео по URL ${videoUrl}:`, error);
        // Продолжаем выполнение и пытаемся загрузить через Imgur
      }
      
      // Попытка загрузить через Imgur
      try {
        const imgurUrl = await imgurUploaderService.uploadVideoFromUrl(videoUrl);
        
        if (imgurUrl) {
          console.log(`Видео успешно загружено на Imgur: ${imgurUrl}`);
          return res.status(200).json({ 
            success: true, 
            data: { url: imgurUrl, link: imgurUrl },
            url: imgurUrl
          });
        }
      } catch (imgurError) {
        console.error('Ошибка при загрузке на Imgur:', imgurError);
      }
      
      // Если загрузка на Imgur не удалась, но URL всё ещё может быть доступен напрямую
      console.log(`Возвращаем исходный URL для видео: ${videoUrl}`);
      return res.status(200).json({ 
        success: true, 
        data: { url: videoUrl, link: videoUrl },
        url: videoUrl 
      });
    } catch (error) {
      console.error('Ошибка при обработке видео URL:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Ошибка при обработке видео URL: ${error}` 
      });
    }
  });
  
  // Маршрут для получения списка загруженных видео
  router.get('/api/imgur/videos', (req, res) => {
    try {
      const files = fs.readdirSync(videosDir);
      const videos = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp4', '.webm', '.avi', '.mov', '.wmv', '.mkv'].includes(ext);
      }).map(file => {
        const filePath = path.join(videosDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: `/uploads/videos/${file}`,
          size: stats.size,
          created: stats.birthtime
        };
      });
      
      return res.status(200).json({
        success: true,
        data: { videos }
      });
    } catch (error) {
      console.error('Ошибка при получении списка видео:', error);
      return res.status(500).json({
        success: false,
        error: `Ошибка при получении списка видео: ${error}`
      });
    }
  });
  
  // Маршрут для статического доступа к загруженным видео
  router.get('/uploads/videos/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(videosDir, filename);
    
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    } else {
      return res.status(404).json({
        success: false,
        error: 'Видео файл не найден'
      });
    }
  });

  console.log('Imgur routes registered');
}