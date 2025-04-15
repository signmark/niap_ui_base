/**
 * API маршруты для работы с Beget S3 хранилищем
 */
import { Router } from 'express';
import { begetS3StorageAws } from '../services/beget-s3-storage-aws';
import { log } from '../utils/logger';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const logPrefix = 'beget-s3-api';

// Настройка multer для загрузки файлов
const tempDir = path.join(os.tmpdir(), 'beget-s3-uploads');

// Создаем временную директорию, если ее нет
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  log.info(`Created temporary directory for S3 uploads: ${tempDir}`, logPrefix);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Загрузка файла
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const filePath = req.file.path;
    const fileName = req.body.fileName || req.file.originalname;
    const folder = req.body.folder;

    const uploadResult = await begetS3StorageAws.uploadLocalFile(
      filePath,
      fileName,
      req.file.mimetype,
      folder
    );

    // Удаляем временный файл
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkError) {
      log.error(`Error deleting temporary file: ${(unlinkError as Error).message}`, logPrefix);
    }

    if (!uploadResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: uploadResult.error || 'Error uploading file to S3' 
      });
    }

    return res.json({
      success: true,
      url: uploadResult.url,
      key: uploadResult.key
    });
  } catch (error) {
    log.error(`Error in upload endpoint: ${(error as Error).message}`, logPrefix);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Загрузка файла из URL
router.post('/upload-from-url', authMiddleware, async (req, res) => {
  try {
    const { url, fileName, folder, contentType } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const uploadResult = await begetS3StorageAws.uploadFromUrl(
      url,
      fileName,
      contentType,
      folder
    );

    if (!uploadResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: uploadResult.error || 'Error uploading file from URL to S3' 
      });
    }

    return res.json({
      success: true,
      url: uploadResult.url,
      key: uploadResult.key
    });
  } catch (error) {
    log.error(`Error in upload-from-url endpoint: ${(error as Error).message}`, logPrefix);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Получение списка файлов
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const folder = req.query.folder as string | undefined;
    const maxKeys = req.query.maxKeys ? parseInt(req.query.maxKeys as string) : 1000;

    const files = await begetS3StorageAws.listFiles(folder, maxKeys);

    return res.json({
      success: true,
      files,
      count: files.length
    });
  } catch (error) {
    log.error(`Error in list endpoint: ${(error as Error).message}`, logPrefix);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Получение временной ссылки на файл
router.get('/signed-url/:key', authMiddleware, async (req, res) => {
  try {
    const fileKey = req.params.key;
    const expiration = req.query.expiration ? parseInt(req.query.expiration as string) : 3600;

    if (!fileKey) {
      return res.status(400).json({ success: false, error: 'File key is required' });
    }

    const signedUrl = await begetS3StorageAws.getSignedUrl(fileKey, expiration);

    if (!signedUrl) {
      return res.status(404).json({ success: false, error: 'Could not generate signed URL' });
    }

    return res.json({
      success: true,
      url: signedUrl,
      expiresIn: expiration,
      key: fileKey
    });
  } catch (error) {
    log.error(`Error in signed-url endpoint: ${(error as Error).message}`, logPrefix);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Удаление файла
router.delete('/delete/:key', authMiddleware, async (req, res) => {
  try {
    const fileKey = req.params.key;

    if (!fileKey) {
      return res.status(400).json({ success: false, error: 'File key is required' });
    }

    const deleted = await begetS3StorageAws.deleteFile(fileKey);

    if (!deleted) {
      return res.status(500).json({ success: false, error: 'Failed to delete file' });
    }

    return res.json({
      success: true,
      message: `File ${fileKey} deleted successfully`
    });
  } catch (error) {
    log.error(`Error in delete endpoint: ${(error as Error).message}`, logPrefix);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Проверка существования файла
router.get('/exists/:key', authMiddleware, async (req, res) => {
  try {
    const fileKey = req.params.key;

    if (!fileKey) {
      return res.status(400).json({ success: false, error: 'File key is required' });
    }

    const exists = await begetS3StorageAws.fileExists(fileKey);

    return res.json({
      success: true,
      exists,
      key: fileKey
    });
  } catch (error) {
    log.error(`Error in exists endpoint: ${(error as Error).message}`, logPrefix);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;