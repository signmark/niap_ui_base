import express from 'express';
import axios from 'axios';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Увеличиваем лимит размера запроса для ImgBB uploads
router.use(express.json({ limit: '10mb' }));
router.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Upload image to ImgBB with increased size limits
router.post('/upload', authMiddleware, async (req, res) => {
  try {
    const { image, name } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    console.log('[IMGBB-UPLOAD] Получен запрос на загрузку изображения:', {
      nameLength: name?.length || 0,
      imageSize: image.length,
      imageSizeKB: Math.round(image.length / 1024)
    });

    // Проверяем размер base64 изображения
    if (image.length > 500000) { // 500KB limit для base64
      console.warn('[IMGBB-UPLOAD] Изображение слишком большое:', image.length, 'байт');
      return res.status(413).json({ 
        error: 'Image too large', 
        message: 'Изображение должно быть меньше 500KB в base64 формате',
        currentSize: image.length,
        maxSize: 500000
      });
    }

    // Загружаем на ImgBB
    const formData = new FormData();
    formData.append('image', image);
    formData.append('name', name || `upload-${Date.now()}`);

    const imgbbResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
      params: {
        key: process.env.IMGBB_API_KEY || '24b7a2b8c7d4563497ca48e07d0c76ba'
      },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 5000 // 5 секунд timeout - очень быстрое переключение на fallback
    });

    if (imgbbResponse.data.success) {
      console.log('[IMGBB-UPLOAD] Успешная загрузка на ImgBB:', imgbbResponse.data.data.url);
      res.json({
        success: true,
        data: {
          url: imgbbResponse.data.data.url,
          delete_url: imgbbResponse.data.data.delete_url,
          size: imgbbResponse.data.data.size
        }
      });
    } else {
      console.error('[IMGBB-UPLOAD] ImgBB вернул ошибку:', imgbbResponse.data);
      res.status(400).json({
        error: 'ImgBB upload failed',
        details: imgbbResponse.data
      });
    }

  } catch (error: any) {
    console.error('[IMGBB-UPLOAD] Ошибка загрузки на ImgBB:', error?.response?.data || error?.message);
    
    // Пробуем fallback на Beget S3 если ImgBB недоступен
    try {
      console.log('[IMGBB-UPLOAD] Пробуем Beget S3 как fallback');
      
      // Импортируем готовый экземпляр Beget S3 (как в других частях проекта)
      const { begetS3StorageAws } = await import('../services/beget-s3-storage-aws');
      
      // Конвертируем base64 в Buffer
      const imageBuffer = Buffer.from(req.body.image, 'base64');
      const fileName = `images/upload-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      
      // Загружаем на Beget S3 используя готовый экземпляр
      const uploadResult = await begetS3StorageAws.uploadFile({
        key: fileName,
        fileData: imageBuffer,
        contentType: 'image/jpeg'
      });
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Beget S3 upload failed - no URL returned');
      }
      
      const s3Url = uploadResult.url;
      
      console.log('[IMGBB-UPLOAD] Успешная загрузка на Beget S3 (fallback):', s3Url);
      
      res.json({
        success: true,
        data: {
          url: s3Url,
          fallback: 'beget-s3'
        }
      });
      
    } catch (fallbackError: any) {
      console.error('[IMGBB-UPLOAD] Fallback на Beget S3 тоже не сработал:', fallbackError?.message);
      
      if (error?.response?.status === 413) {
        res.status(413).json({ 
          error: 'Request entity too large',
          message: 'Изображение слишком большое для загрузки' 
        });
      } else if (error?.code === 'ECONNABORTED') {
        res.status(408).json({ 
          error: 'Upload timeout',
          message: 'Превышено время ожидания загрузки' 
        });
      } else {
        res.status(500).json({ 
          error: 'Upload failed',
          message: 'Ошибка загрузки изображения на все сервисы',
          details: {
            imgbb: error?.response?.data || error?.message,
            beget: fallbackError?.message
          }
        });
      }
    }
  }
});

export default router;