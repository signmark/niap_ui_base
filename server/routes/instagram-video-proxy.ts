/**
 * Прокси-сервер для видео Instagram
 * Обходит проблемы с заголовками S3 для Instagram Graph API
 */
import { Router, Request, Response } from 'express';
import { log } from '../utils/logger';

const router = Router();

/**
 * GET /api/instagram-video-proxy/:videoId
 * Прокси для видео с правильными заголовками для Instagram
 */
router.get('/instagram-video-proxy/:videoId', async (req: Request, res: Response) => {
  try {
    const videoId = req.params.videoId;
    const rangeHeader = req.headers.range;
    
    log(`[Instagram Video Proxy] Запрос видео: ${videoId}`, 'instagram-proxy');
    log(`[Instagram Video Proxy] Range header: ${rangeHeader || 'отсутствует'}`, 'instagram-proxy');

    // Получаем оригинальный URL из S3
    const { begetS3StorageAws } = await import('../services/beget-s3-storage-aws');
    
    // Пытаемся найти файл в разных папках
    let s3Key = `videos/${videoId}`;
    let originalUrl = begetS3StorageAws.getPublicUrl(s3Key);
    let fileExists = await begetS3StorageAws.fileExists(s3Key);
    
    // Если не найден в videos/, пробуем test/
    if (!fileExists) {
      s3Key = `test/${videoId}`;
      originalUrl = begetS3StorageAws.getPublicUrl(s3Key);
      fileExists = await begetS3StorageAws.fileExists(s3Key);
    }
    
    // Если всё еще не найден, пробуем корень
    if (!fileExists) {
      s3Key = videoId;
      originalUrl = begetS3StorageAws.getPublicUrl(s3Key);
      fileExists = await begetS3StorageAws.fileExists(s3Key);
    }
    
    log(`[Instagram Video Proxy] Оригинальный S3 URL: ${originalUrl}`, 'instagram-proxy');

    // Проверяем существование файла в S3 (уже проверено выше)
    if (!fileExists) {
      log(`[Instagram Video Proxy] Файл не найден в S3: попробованы videos/, test/, и корень`, 'instagram-proxy');
      return res.status(404).json({
        error: 'Video file not found'
      });
    }
    
    log(`[Instagram Video Proxy] Файл найден в S3: ${s3Key}`, 'instagram-proxy');

    // Делаем запрос к S3
    const s3Response = await fetch(originalUrl, {
      headers: rangeHeader ? { 'Range': rangeHeader } : {}
    });

    if (!s3Response.ok) {
      log(`[Instagram Video Proxy] Ошибка S3 ответа: ${s3Response.status}`, 'instagram-proxy');
      return res.status(s3Response.status).json({
        error: 'Failed to fetch video from S3'
      });
    }

    // Получаем метаданные файла
    const contentLength = s3Response.headers.get('content-length');
    const contentType = s3Response.headers.get('content-type') || 'video/mp4';
    const contentRange = s3Response.headers.get('content-range');

    // Устанавливаем правильные заголовки для Instagram
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');  // КРИТИЧНО для Instagram
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Обрабатываем Range запросы (важно для Instagram)
    if (rangeHeader && contentRange) {
      res.status(206); // Partial Content
      res.setHeader('Content-Range', contentRange);
      log(`[Instagram Video Proxy] Partial content response: ${contentRange}`, 'instagram-proxy');
    } else if (rangeHeader && contentLength) {
      // Если S3 не поддерживает Range, эмулируем частичный контент
      const range = parseRangeHeader(rangeHeader, parseInt(contentLength));
      if (range) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${contentLength}`);
        res.setHeader('Content-Length', (range.end - range.start + 1).toString());
        log(`[Instagram Video Proxy] Эмуляция partial content: ${range.start}-${range.end}`, 'instagram-proxy');
      }
    }

    // Передаем тело ответа
    if (s3Response.body) {
      const reader = s3Response.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
    } else {
      res.end();
    }

    log(`[Instagram Video Proxy] Видео успешно передано через прокси`, 'instagram-proxy');

  } catch (error: any) {
    log(`[Instagram Video Proxy] Ошибка: ${error.message}`, 'instagram-proxy');
    res.status(500).json({
      error: 'Internal proxy error',
      details: error.message
    });
  }
});

/**
 * HEAD /api/instagram-video-proxy/:videoId
 * Возвращает метаданные видео с правильными заголовками
 */
router.head('/instagram-video-proxy/:videoId', async (req: Request, res: Response) => {
  try {
    const videoId = req.params.videoId;
    
    log(`[Instagram Video Proxy HEAD] Запрос метаданных: ${videoId}`, 'instagram-proxy');

    const { begetS3StorageAws } = await import('../services/beget-s3-storage-aws');
    const s3Key = `videos/${videoId}`;
    
    // Проверяем существование файла
    const fileExists = await begetS3StorageAws.fileExists(s3Key);
    if (!fileExists) {
      return res.status(404).end();
    }

    // Получаем размер файла (если возможно)
    const originalUrl = begetS3StorageAws.getPublicUrl(s3Key);
    const headResponse = await fetch(originalUrl, { method: 'HEAD' });

    if (!headResponse.ok) {
      return res.status(headResponse.status).end();
    }

    const contentLength = headResponse.headers.get('content-length');
    const contentType = headResponse.headers.get('content-type') || 'video/mp4';

    // Устанавливаем Instagram-совместимые заголовки
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    res.status(200).end();
    
    log(`[Instagram Video Proxy HEAD] Метаданные отправлены успешно`, 'instagram-proxy');

  } catch (error: any) {
    log(`[Instagram Video Proxy HEAD] Ошибка: ${error.message}`, 'instagram-proxy');
    res.status(500).end();
  }
});

/**
 * Парсит Range заголовок
 */
function parseRangeHeader(range: string, totalSize: number): { start: number; end: number } | null {
  const matches = range.match(/bytes=(\d+)-(\d*)/);
  if (!matches) return null;

  const start = parseInt(matches[1]);
  const end = matches[2] ? parseInt(matches[2]) : totalSize - 1;

  if (start >= totalSize || end >= totalSize || start > end) {
    return null;
  }

  return { start, end };
}

export default router;