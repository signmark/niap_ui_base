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

const upload = multer({ 
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
      
      // Получаем контент из базы данных
      const content = await storage.getCampaignContentById(contentId);
      if (!content) {
        return res.status(404).json({
          success: false,
          error: `Контент с ID ${contentId} не найден`
        });
      }
      
      // Если передан userId, добавляем его в контент
      if (userId) {
        content.userId = userId;
      }
      
      // Публикуем контент на выбранной платформе
      let result;
      
      if (platform === 'telegram') {
        result = await socialPublishingWithImgurService.publishToTelegram(
          content,
          settings?.telegram
        );
      } else {
        return res.status(400).json({
          success: false,
          error: `Неподдерживаемая платформа: ${platform}`
        });
      }
      
      return res.status(200).json({
        success: result.status === 'published',
        data: result
      });
    } catch (error) {
      console.error(`Ошибка при публикации контента: ${error}`);
      return res.status(500).json({
        success: false,
        error: `Ошибка при публикации контента: ${error}`
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
  
  // Маршрут для загрузки файла изображения и его отправки на Imgur
  router.post('/api/imgur/upload-file', upload.single('image'), async (req, res) => {
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
  
  console.log('Imgur routes registered');
}