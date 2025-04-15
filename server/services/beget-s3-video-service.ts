/**
 * Специализированный сервис для работы с видео в Beget S3
 */
import { begetS3StorageAws } from './beget-s3-storage-aws';
import { log } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export interface VideoMetadata {
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  size?: number;
  bitrate?: number;
  codec?: string;
}

export interface UploadVideoResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  metadata?: VideoMetadata;
  key?: string;
  error?: string;
}

export class BegetS3VideoService {
  private logPrefix = 'beget-s3-video';
  private videoFolder = 'videos';
  private thumbnailFolder = 'thumbnails';

  /**
   * Загружает видео в Beget S3 из URL
   * @param videoUrl URL видео
   * @param generateThumbnail Флаг для генерации превью видео
   * @returns Результат загрузки видео
   */
  async uploadVideoFromUrl(
    videoUrl: string,
    generateThumbnail: boolean = false
  ): Promise<UploadVideoResult> {
    try {
      log.info(`Uploading video from URL: ${videoUrl}`, this.logPrefix);
      
      // Скачиваем видео во временный файл
      const tempFilePath = await this.downloadVideoToTempFile(videoUrl);
      
      if (!tempFilePath) {
        throw new Error('Failed to download video to temp file');
      }
      
      log.info(`Video downloaded to temp file: ${tempFilePath}`, this.logPrefix);
      
      // Загружаем видео в Beget S3
      const result = await this.uploadVideoFile(tempFilePath, generateThumbnail);
      
      // Удаляем временный файл
      this.cleanupTempFile(tempFilePath);
      
      return result;
    } catch (error) {
      log.error(`Error uploading video from URL: ${(error as Error).message}`, this.logPrefix);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Загружает видео-файл в Beget S3
   * @param filePath Путь к файлу видео
   * @param generateThumbnail Флаг для генерации превью видео
   * @returns Результат загрузки видео
   */
  async uploadVideoFile(
    filePath: string, 
    generateThumbnail: boolean = false
  ): Promise<UploadVideoResult> {
    try {
      log.info(`Uploading video file: ${filePath}`, this.logPrefix);
      
      // Генерируем уникальный ключ для видео
      const fileName = path.basename(filePath);
      const fileExt = path.extname(fileName);
      const uniqueId = uuidv4();
      const videoKey = `${this.videoFolder}/${uniqueId}${fileExt}`;
      
      // Получаем метаданные видео
      const metadata = await this.getVideoMetadata(filePath);
      
      // Загружаем видео в Beget S3
      log.info(`Uploading video to S3 with key: ${videoKey}`, this.logPrefix);
      const uploadResult = await begetS3StorageAws.uploadFile({
        key: videoKey,
        filePath,
        contentType: this.getContentTypeFromExtension(fileExt)
      });
      
      if (!uploadResult.success) {
        throw new Error(`Failed to upload video to S3: ${uploadResult.error}`);
      }
      
      log.info(`Video uploaded successfully: ${uploadResult.url}`, this.logPrefix);
      
      // Результат с URL видео
      const result: UploadVideoResult = {
        success: true,
        videoUrl: uploadResult.url,
        metadata,
        key: videoKey
      };
      
      // Если требуется, генерируем и загружаем превью
      if (generateThumbnail) {
        const thumbnailResult = await this.generateAndUploadThumbnail(filePath, uniqueId);
        
        if (thumbnailResult.success && thumbnailResult.url) {
          result.thumbnailUrl = thumbnailResult.url;
        }
      }
      
      return result;
    } catch (error) {
      log.error(`Error uploading video file: ${(error as Error).message}`, this.logPrefix);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Генерирует и загружает превью видео
   * @param videoPath Путь к файлу видео
   * @param uniqueId Уникальный идентификатор для имени файла
   * @returns Результат загрузки превью
   */
  private async generateAndUploadThumbnail(
    videoPath: string,
    uniqueId: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      log.info(`Generating thumbnail for video: ${videoPath}`, this.logPrefix);
      
      // Генерируем временный путь для превью
      const thumbnailPath = path.join(os.tmpdir(), `${uniqueId}-thumb.jpg`);
      
      // Используем ffmpeg для создания превью
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -filter:v scale="640:-1" "${thumbnailPath}" -y`;
      
      try {
        execSync(ffmpegCommand, { stdio: 'ignore' });
      } catch (error) {
        log.error(`Failed to generate thumbnail with ffmpeg: ${(error as Error).message}`, this.logPrefix);
        return { success: false, error: 'Thumbnail generation failed' };
      }
      
      // Проверяем, был ли создан файл превью
      if (!fs.existsSync(thumbnailPath)) {
        return { success: false, error: 'Thumbnail file was not created' };
      }
      
      // Загружаем превью в Beget S3
      const thumbnailKey = `${this.thumbnailFolder}/${uniqueId}.jpg`;
      
      log.info(`Uploading thumbnail to S3 with key: ${thumbnailKey}`, this.logPrefix);
      
      const uploadResult = await begetS3StorageAws.uploadFile({
        key: thumbnailKey,
        filePath: thumbnailPath,
        contentType: 'image/jpeg'
      });
      
      // Удаляем временный файл превью
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
      
      if (!uploadResult.success) {
        return { success: false, error: `Failed to upload thumbnail: ${uploadResult.error}` };
      }
      
      log.info(`Thumbnail uploaded successfully: ${uploadResult.url}`, this.logPrefix);
      
      return {
        success: true,
        url: uploadResult.url
      };
    } catch (error) {
      log.error(`Error generating or uploading thumbnail: ${(error as Error).message}`, this.logPrefix);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Скачивает видео по URL во временный файл
   * @param url URL видео
   * @returns Путь к временному файлу или null в случае ошибки
   */
  private async downloadVideoToTempFile(url: string): Promise<string | null> {
    try {
      // Создаем временный файл
      const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}.mp4`);
      
      log.info(`Downloading video to temporary file: ${tempFilePath}`, this.logPrefix);
      
      // Используем wget для скачивания файла (более надежно для больших файлов)
      const wgetCommand = `wget "${url}" -O "${tempFilePath}" --quiet`;
      
      try {
        execSync(wgetCommand, { stdio: 'ignore' });
      } catch (error) {
        log.error(`Failed to download with wget: ${(error as Error).message}`, this.logPrefix);
        
        // Удаляем временный файл, если скачивание не удалось
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        
        return null;
      }
      
      // Проверяем, был ли скачан файл
      if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
        log.error('Downloaded file is empty or does not exist', this.logPrefix);
        return null;
      }
      
      return tempFilePath;
    } catch (error) {
      log.error(`Error downloading video to temp file: ${(error as Error).message}`, this.logPrefix);
      return null;
    }
  }

  /**
   * Получает метаданные видео-файла
   * @param filePath Путь к файлу видео
   * @returns Метаданные видео
   */
  private async getVideoMetadata(filePath: string): Promise<VideoMetadata> {
    try {
      log.info(`Getting video metadata: ${filePath}`, this.logPrefix);
      
      // Используем ffprobe для получения метаданных
      const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name -show_entries format=duration,size,bit_rate -of json "${filePath}"`;
      
      const output = execSync(ffprobeCommand, { encoding: 'utf-8' });
      const data = JSON.parse(output);
      
      // Извлекаем метаданные
      const stream = data.streams && data.streams.length > 0 ? data.streams[0] : {};
      const format = data.format || {};
      
      const metadata: VideoMetadata = {
        width: stream.width,
        height: stream.height,
        duration: parseFloat(stream.duration || format.duration || '0'),
        codec: stream.codec_name,
        format: path.extname(filePath).substring(1), // Удаляем точку из расширения
        size: parseInt(format.size || '0', 10),
        bitrate: parseInt(format.bit_rate || '0', 10)
      };
      
      log.info(`Video metadata: ${JSON.stringify(metadata)}`, this.logPrefix);
      
      return metadata;
    } catch (error) {
      log.error(`Error getting video metadata: ${(error as Error).message}`, this.logPrefix);
      return {}; // Возвращаем пустой объект в случае ошибки
    }
  }

  /**
   * Удаляет временный файл
   * @param filePath Путь к файлу
   */
  private cleanupTempFile(filePath: string | null): void {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        log.info(`Temporary file deleted: ${filePath}`, this.logPrefix);
      } catch (error) {
        log.error(`Error deleting temporary file: ${(error as Error).message}`, this.logPrefix);
      }
    }
  }

  /**
   * Получает MIME-тип на основе расширения файла
   * @param extension Расширение файла
   * @returns MIME-тип
   */
  private getContentTypeFromExtension(extension: string): string {
    // Убираем точку из расширения, если она есть
    const ext = extension.startsWith('.') ? extension.substring(1) : extension;
    
    // Определяем MIME-тип на основе расширения
    switch (ext.toLowerCase()) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'avi':
        return 'video/x-msvideo';
      case 'wmv':
        return 'video/x-ms-wmv';
      case 'flv':
        return 'video/x-flv';
      case 'mov':
        return 'video/quicktime';
      case '3gp':
        return 'video/3gpp';
      case 'mkv':
        return 'video/x-matroska';
      default:
        return 'application/octet-stream';
    }
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const begetS3VideoService = new BegetS3VideoService();