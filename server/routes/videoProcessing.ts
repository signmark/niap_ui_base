import express from 'express';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/temp/' });

interface TextOverlay {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  startTime: number;
  endTime: number;
}

// Обработка видео с наложением текста
router.post('/process-video', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Видео файл не найден' });
    }

    const { textOverlays } = req.body;
    const overlays: TextOverlay[] = JSON.parse(textOverlays || '[]');
    
    const inputPath = req.file.path;
    const outputFileName = `processed_${Date.now()}_${req.file.originalname}`;
    const outputPath = path.join('uploads/processed/', outputFileName);

    // Ensure output directory exists
    if (!fs.existsSync('uploads/processed/')) {
      fs.mkdirSync('uploads/processed/', { recursive: true });
    }

    console.log('[VIDEO] Processing video with text overlays:', {
      inputPath,
      outputPath,
      overlaysCount: overlays.length
    });

    let command = ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .size('1080x1920') // Instagram Stories format
      .fps(30);

    // Добавляем текстовые overlays
    if (overlays.length > 0) {
      let filterComplex = '';
      
      overlays.forEach((overlay, index) => {
        const escapedText = overlay.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
        const fontColor = overlay.color.replace('#', '');
        
        // Конвертируем hex цвет в RGB для FFmpeg
        const r = parseInt(fontColor.substr(0, 2), 16);
        const g = parseInt(fontColor.substr(2, 2), 16);
        const b = parseInt(fontColor.substr(4, 2), 16);
        
        const textFilter = `drawtext=text='${escapedText}':` +
          `x=${overlay.x}:y=${overlay.y}:` +
          `fontsize=${overlay.fontSize}:` +
          `fontcolor=rgb(${r},${g},${b}):` +
          `fontfile='/System/Library/Fonts/Arial.ttf':` +
          `enable='between(t,${overlay.startTime},${overlay.endTime})'`;
        
        if (index === 0) {
          filterComplex = `[0:v]${textFilter}[v${index}]`;
        } else {
          filterComplex += `;[v${index-1}]${textFilter}[v${index}]`;
        }
      });

      command = command.complexFilter(filterComplex).map(`[v${overlays.length-1}]`);
    }

    command
      .on('start', (commandLine) => {
        console.log('[VIDEO] FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`[VIDEO] Processing: ${Math.round(progress.percent || 0)}%`);
      })
      .on('end', () => {
        console.log('[VIDEO] Processing finished successfully');
        
        // Удаляем временный файл
        fs.unlinkSync(inputPath);
        
        res.json({
          success: true,
          videoUrl: `/uploads/processed/${outputFileName}`,
          message: 'Видео обработано успешно'
        });
      })
      .on('error', (err) => {
        console.error('[VIDEO] FFmpeg error:', err);
        
        // Удаляем временный файл при ошибке
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
        }
        
        res.status(500).json({
          error: 'Ошибка обработки видео',
          details: err.message
        });
      })
      .save(outputPath);

  } catch (error) {
    console.error('[VIDEO] Error processing video:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Получение информации о видео
router.post('/video-info', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Видео файл не найден' });
    }

    const inputPath = req.file.path;

    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      // Удаляем временный файл
      fs.unlinkSync(inputPath);

      if (err) {
        console.error('[VIDEO] Error getting video info:', err);
        return res.status(500).json({ error: 'Ошибка получения информации о видео' });
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      
      res.json({
        success: true,
        duration: metadata.format.duration,
        width: videoStream?.width,
        height: videoStream?.height,
        bitrate: metadata.format.bit_rate,
        size: metadata.format.size
      });
    });

  } catch (error) {
    console.error('[VIDEO] Error getting video info:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;