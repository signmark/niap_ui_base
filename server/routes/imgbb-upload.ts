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
      timeout: 30000 // 30 секунд timeout
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
        message: 'Ошибка загрузки изображения',
        details: error?.response?.data || error?.message 
      });
    }
  }
});

export default router;