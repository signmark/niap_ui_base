import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

const execAsync = promisify(exec);

interface VideoConversionResult {
  success: boolean;
  convertedUrl?: string;
  originalUrl?: string;
  localPath?: string;
  error?: string;
  duration?: number;
  metadata?: {
    width: number;
    height: number;
    duration: number;
    codec: string;
    size: number;
  };
}

/**
 * Реальный видео конвертер с FFmpeg для Instagram Stories
 * Конвертирует видео в формат 9:16, MP4, до 59 секунд
 */
export class RealVideoConverter {
  private tempDir = '/tmp/video-conversion';

  constructor() {
    // Создаем временную папку
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Проверяет, нужна ли конвертация видео
   */
  needsConversion(videoUrl: string): boolean {
    const url = videoUrl.toLowerCase();
    
    // Если уже содержит метку конвертации - пропускаем
    if (url.includes('_converted') || url.includes('ig_stories_converted')) {
      return false;
    }
    
    // Конвертируем все форматы для Instagram Stories
    return true;
  }

  /**
   * Конвертирует видео для Instagram Stories
   */
  async convertForInstagramStories(videoUrl: string): Promise<VideoConversionResult> {
    console.log('[real-video-converter] Starting conversion:', videoUrl);

    const startTime = Date.now();
    let inputFile: string | null = null;
    let outputFile: string | null = null;

    try {
      // Шаг 1: Скачиваем исходное видео
      const fileName = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const ext = this.getFileExtension(videoUrl);
      inputFile = path.join(this.tempDir, `${fileName}${ext}`);
      outputFile = path.join(this.tempDir, `${fileName}_ig_stories_converted.mp4`);

      console.log('[real-video-converter] Downloading video from:', videoUrl);
      
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream',
        timeout: 120000 // 2 минуты для скачивания
      });

      const writeStream = fs.createWriteStream(inputFile);
      response.data.pipe(writeStream);

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const inputStats = fs.statSync(inputFile);
      console.log('[real-video-converter] Video downloaded:', {
        size: inputStats.size,
        path: inputFile
      });

      // Шаг 2: Получаем информацию о видео
      const mediaInfo = await this.getVideoInfo(inputFile);
      console.log('[real-video-converter] Original video info:', mediaInfo);

      // Шаг 3: Конвертируем для Instagram Stories
      await this.convertVideo(inputFile, outputFile);

      // Шаг 4: Проверяем результат
      if (!fs.existsSync(outputFile)) {
        throw new Error('Converted file was not created');
      }

      const outputStats = fs.statSync(outputFile);
      const convertedInfo = await this.getVideoInfo(outputFile);
      
      console.log('[real-video-converter] Conversion completed:', {
        originalSize: inputStats.size,
        convertedSize: outputStats.size,
        duration: Date.now() - startTime,
        convertedInfo
      });

      // Шаг 5: Загружаем на S3
      const uploadedUrl = await this.uploadToS3(outputFile);

      return {
        success: true,
        convertedUrl: uploadedUrl,
        originalUrl: videoUrl,
        localPath: outputFile,
        duration: convertedInfo.duration,
        metadata: {
          width: convertedInfo.width,
          height: convertedInfo.height,
          duration: convertedInfo.duration,
          codec: convertedInfo.codec,
          size: outputStats.size
        }
      };

    } catch (error: any) {
      console.error('[real-video-converter] Conversion failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        originalUrl: videoUrl
      };
    } finally {
      // Очищаем временные файлы
      this.cleanupFiles([inputFile, outputFile]);
    }
  }

  /**
   * Получает информацию о видео файле
   */
  private async getVideoInfo(filePath: string): Promise<any> {
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    const { stdout } = await execAsync(command);
    const info = JSON.parse(stdout);
    
    const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
    
    return {
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      duration: parseFloat(info.format.duration || '0'),
      codec: videoStream?.codec_name || 'unknown',
      bitrate: parseInt(info.format.bit_rate || '0')
    };
  }

  /**
   * Конвертирует видео для Instagram Stories
   */
  private async convertVideo(inputPath: string, outputPath: string): Promise<void> {
    // Параметры для Instagram Stories:
    // - Соотношение сторон: 9:16 (1080x1920)
    // - Максимальная длительность: 59 секунд
    // - Кодек: H.264
    // - Аудио: AAC
    // - FPS: 30
    
    const ffmpegCommand = [
      'ffmpeg',
      '-i', `"${inputPath}"`,
      '-t', '59', // Максимум 59 секунд
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', // 9:16 с обрезкой
      '-c:v', 'libx264', // H.264 видео кодек
      '-c:a', 'aac', // AAC аудио кодек
      '-b:v', '2500k', // Битрейт видео
      '-b:a', '128k', // Битрейт аудио
      '-r', '30', // 30 FPS
      '-preset', 'medium', // Качество vs скорость
      '-crf', '23', // Качество (23 = хорошее качество)
      '-movflags', '+faststart', // Оптимизация для веб
      '-f', 'mp4', // Формат MP4
      '-y', // Перезаписать если есть
      `"${outputPath}"`
    ].join(' ');

    console.log('[real-video-converter] Running FFmpeg conversion...');
    console.log('[real-video-converter] Command:', ffmpegCommand);
    
    const { stdout, stderr } = await execAsync(ffmpegCommand, { 
      timeout: 600000 // 10 минут максимум
    });

    if (stderr) {
      console.log('[real-video-converter] FFmpeg stderr:', stderr);
    }
  }

  /**
   * Загружает конвертированное видео на S3 через прямой сервис
   */
  private async uploadToS3(filePath: string): Promise<string> {
    try {
      const fileName = `ig_stories_converted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
      
      console.log('[real-video-converter] Uploading to S3:', fileName);

      // Используем beget-s3-storage-aws напрямую для загрузки видео
      const { begetS3StorageAws } = await import('./beget-s3-storage-aws');
      const videoKey = `videos/${fileName}`;
      
      const uploadResult = await begetS3StorageAws.uploadFile({
        key: videoKey,
        filePath: filePath,
        contentType: 'video/mp4'
      });

      if (uploadResult.success && uploadResult.url) {
        console.log('[real-video-converter] S3 upload successful:', uploadResult.url);
        return uploadResult.url;
      } else {
        throw new Error('S3 upload failed: ' + uploadResult.error);
      }
    } catch (error: any) {
      console.error('[real-video-converter] S3 upload error:', error.message);
      throw new Error('Failed to upload converted video to S3: ' + error.message);
    }
  }

  /**
   * Получает расширение файла из URL
   */
  private getFileExtension(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDotIndex = pathname.lastIndexOf('.');
      
      if (lastDotIndex > 0) {
        return pathname.substring(lastDotIndex);
      }
      
      return '.mp4'; // По умолчанию
    } catch {
      return '.mp4';
    }
  }

  /**
   * Очищает временные файлы
   */
  private cleanupFiles(filePaths: (string | null)[]): void {
    filePaths.forEach(filePath => {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('[real-video-converter] Cleaned up:', filePath);
        } catch (error) {
          console.warn('[real-video-converter] Could not delete file:', filePath);
        }
      }
    });
  }

  /**
   * Проверяет доступность FFmpeg
   */
  async checkFFmpegAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      return stdout.includes('ffmpeg version');
    } catch (error) {
      return false;
    }
  }

  /**
   * Обновляет URL видео в контенте Directus
   */
  async updateContentVideoUrl(contentId: string, newVideoUrl: string, authHeader?: string): Promise<boolean> {
    try {
      const { directusApi } = await import('../directus');
      
      const updateData = {
        video_url: newVideoUrl,
        updated_at: new Date().toISOString()
      };

      // Пробуем с пользовательским токеном
      if (authHeader) {
        try {
          await directusApi.patch(`/items/campaign_content/${contentId}`, updateData, {
            headers: {
              'Authorization': authHeader
            }
          });
          console.log('[real-video-converter] Content updated with user token');
          return true;
        } catch (userError) {
          console.log('[real-video-converter] User token failed, trying system token');
        }
      }

      // Fallback на системный токен
      await directusApi.patch(`/items/campaign_content/${contentId}`, updateData, {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
        }
      });

      console.log('[real-video-converter] Content updated with system token');
      return true;
    } catch (error: any) {
      console.error('[real-video-converter] Failed to update content:', error.message);
      return false;
    }
  }
}

export const realVideoConverter = new RealVideoConverter();