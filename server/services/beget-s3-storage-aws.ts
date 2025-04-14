/**
 * Сервис для работы с Beget S3 хранилищем через AWS SDK v3
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../utils/logger';

export interface BegetS3StorageConfig {
  accessKey: string;
  secretKey: string;
  endpoint: string;
  region: string;
  bucket: string;
}

export interface UploadFileResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

export class BegetS3StorageAws {
  private client: S3Client;
  private bucket: string;
  private logPrefix = 'beget-s3-storage';

  constructor(config?: BegetS3StorageConfig) {
    const accessKey = config?.accessKey || process.env.BEGET_S3_ACCESS_KEY;
    const secretKey = config?.secretKey || process.env.BEGET_S3_SECRET_KEY;
    const endpoint = config?.endpoint || process.env.BEGET_S3_ENDPOINT || 'https://s3.ru1.storage.beget.cloud';
    const region = config?.region || process.env.BEGET_S3_REGION || 'ru-1';
    this.bucket = config?.bucket || process.env.BEGET_S3_BUCKET || '';

    if (!accessKey || !secretKey) {
      throw new Error('Beget S3 credentials not found in environment variables or config');
    }

    if (!this.bucket) {
      throw new Error('Beget S3 bucket not specified');
    }

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey
      },
      forcePathStyle: true
    });

    log.info('Beget S3 Storage service initialized', this.logPrefix);
  }

  /**
   * Загружает файл в S3 хранилище
   * @param fileData Содержимое файла (Buffer или строка)
   * @param fileName Имя файла (опционально, если не указано - генерируется UUID)
   * @param contentType MIME-тип файла
   * @param folder Папка для сохранения (опционально)
   * @returns Результат загрузки файла
   */
  async uploadFile(
    fileData: Buffer | string, 
    fileName?: string, 
    contentType: string = 'application/octet-stream',
    folder?: string
  ): Promise<UploadFileResult> {
    try {
      const fileKey = this.generateFileKey(fileName, folder);
      
      log.info(`Uploading file to Beget S3: ${fileKey}`, this.logPrefix);
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: fileData,
        ContentType: contentType,
        ACL: 'public-read'
      });

      await this.client.send(command);
      
      const fileUrl = this.getPublicUrl(fileKey);
      log.info(`File uploaded successfully: ${fileUrl}`, this.logPrefix);
      
      return {
        success: true,
        key: fileKey,
        url: fileUrl
      };
    } catch (error) {
      log.error(`Error uploading file to Beget S3: ${(error as Error).message}`, this.logPrefix);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Загружает локальный файл в S3 хранилище
   * @param filePath Путь к локальному файлу
   * @param fileName Имя файла (опционально, если не указано - берется имя локального файла)
   * @param contentType MIME-тип файла (опционально, определяется по расширению)
   * @param folder Папка для сохранения (опционально)
   * @returns Результат загрузки файла
   */
  async uploadLocalFile(
    filePath: string, 
    fileName?: string, 
    contentType?: string,
    folder?: string
  ): Promise<UploadFileResult> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileData = fs.readFileSync(filePath);
      const localFileName = fileName || path.basename(filePath);
      const mimeType = contentType || this.getMimeTypeByExtension(path.extname(filePath));

      return this.uploadFile(fileData, localFileName, mimeType, folder);
    } catch (error) {
      log.error(`Error uploading local file to Beget S3: ${(error as Error).message}`, this.logPrefix);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Загружает файл из URL в S3 хранилище
   * @param url URL файла для загрузки
   * @param fileName Имя файла (опционально, если не указано - генерируется UUID)
   * @param contentType MIME-тип файла (опционально)
   * @param folder Папка для сохранения (опционально)
   * @returns Результат загрузки файла
   */
  async uploadFromUrl(
    url: string, 
    fileName?: string, 
    contentType?: string,
    folder?: string
  ): Promise<UploadFileResult> {
    try {
      log.info(`Uploading file from URL: ${url}`, this.logPrefix);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file from URL: ${response.status} ${response.statusText}`);
      }
      
      const fileData = await response.arrayBuffer();
      const buffer = Buffer.from(fileData);
      
      // Определяем тип контента
      const mimeType = contentType || response.headers.get('content-type') || 'application/octet-stream';
      
      // Если имя файла не указано, попробуем получить из URL
      const detectedFileName = fileName || this.extractFileNameFromUrl(url);
      
      return this.uploadFile(buffer, detectedFileName, mimeType, folder);
    } catch (error) {
      log.error(`Error uploading file from URL to Beget S3: ${(error as Error).message}`, this.logPrefix);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Получает файл из S3 хранилища
   * @param fileKey Ключ файла в S3
   * @returns Буфер с содержимым файла или null в случае ошибки
   */
  async getFile(fileKey: string): Promise<Buffer | null> {
    try {
      log.info(`Getting file from Beget S3: ${fileKey}`, this.logPrefix);
      
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('File body is empty');
      }
      
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => {
          log.error(`Error reading file stream: ${err.message}`, this.logPrefix);
          reject(err);
        });
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          log.info(`File retrieved successfully, size: ${buffer.length} bytes`, this.logPrefix);
          resolve(buffer);
        });
      });
    } catch (error) {
      log.error(`Error getting file from Beget S3: ${(error as Error).message}`, this.logPrefix);
      return null;
    }
  }

  /**
   * Получает временную ссылку на файл (с ограниченным сроком действия)
   * @param fileKey Ключ файла в S3
   * @param expirationSeconds Срок действия ссылки в секундах (по умолчанию 3600 = 1 час)
   * @returns Временная ссылка на файл или null в случае ошибки
   */
  async getSignedUrl(fileKey: string, expirationSeconds: number = 3600): Promise<string | null> {
    try {
      log.info(`Getting signed URL for file: ${fileKey}`, this.logPrefix);
      
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey
      });

      const signedUrl = await getSignedUrl(this.client, command, {
        expiresIn: expirationSeconds
      });
      
      log.info(`Signed URL generated successfully`, this.logPrefix);
      return signedUrl;
    } catch (error) {
      log.error(`Error getting signed URL: ${(error as Error).message}`, this.logPrefix);
      return null;
    }
  }

  /**
   * Удаляет файл из S3 хранилища
   * @param fileKey Ключ файла в S3
   * @returns true в случае успеха, false в случае ошибки
   */
  async deleteFile(fileKey: string): Promise<boolean> {
    try {
      log.info(`Deleting file from Beget S3: ${fileKey}`, this.logPrefix);
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileKey
      });

      await this.client.send(command);
      
      log.info(`File deleted successfully`, this.logPrefix);
      return true;
    } catch (error) {
      log.error(`Error deleting file from Beget S3: ${(error as Error).message}`, this.logPrefix);
      return false;
    }
  }

  /**
   * Проверяет существование файла в S3 хранилище
   * @param fileKey Ключ файла в S3
   * @returns true если файл существует, false если файл не существует или произошла ошибка
   */
  async fileExists(fileKey: string): Promise<boolean> {
    try {
      log.info(`Checking if file exists in Beget S3: ${fileKey}`, this.logPrefix);
      
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fileKey
      });

      await this.client.send(command);
      
      log.info(`File exists: ${fileKey}`, this.logPrefix);
      return true;
    } catch (error) {
      log.info(`File does not exist or error occurred: ${fileKey}`, this.logPrefix);
      return false;
    }
  }

  /**
   * Получает список файлов в папке
   * @param folder Папка для просмотра (опционально)
   * @param maxKeys Максимальное количество файлов для получения (по умолчанию 1000)
   * @returns Массив ключей файлов или пустой массив в случае ошибки
   */
  async listFiles(folder?: string, maxKeys: number = 1000): Promise<string[]> {
    try {
      const prefix = folder ? `${folder}/` : '';
      
      log.info(`Listing files in Beget S3 bucket: ${this.bucket}, prefix: ${prefix || 'root'}`, this.logPrefix);
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys
      });

      const response = await this.client.send(command);
      
      const files = response.Contents?.map(item => item.Key as string) || [];
      
      log.info(`Retrieved ${files.length} files`, this.logPrefix);
      return files;
    } catch (error) {
      log.error(`Error listing files in Beget S3: ${(error as Error).message}`, this.logPrefix);
      return [];
    }
  }

  /**
   * Получает публичный URL файла
   * @param fileKey Ключ файла в S3
   * @returns Публичный URL файла
   */
  getPublicUrl(fileKey: string): string {
    const baseEndpoint = process.env.BEGET_S3_ENDPOINT || 'https://s3.ru1.storage.beget.cloud';
    const endpoint = baseEndpoint.replace('https://', '');
    return `https://${this.bucket}.${endpoint}/${fileKey}`;
  }

  /**
   * Генерирует ключ файла в S3
   * @param fileName Имя файла (опционально)
   * @param folder Папка (опционально)
   * @returns Ключ файла
   */
  private generateFileKey(fileName?: string, folder?: string): string {
    const actualFileName = fileName || `${uuidv4()}${this.getRandomExtension()}`;
    const sanitizedFileName = this.sanitizeFileName(actualFileName);
    
    if (folder) {
      return `${folder}/${sanitizedFileName}`;
    }
    
    return sanitizedFileName;
  }

  /**
   * Очищает имя файла от недопустимых символов
   * @param fileName Имя файла
   * @returns Очищенное имя файла
   */
  private sanitizeFileName(fileName: string): string {
    // Заменяем пробелы и специальные символы
    return fileName
      .replace(/\s+/g, '_')
      .replace(/[^\w\-\.]/g, '_');
  }

  /**
   * Определяет MIME-тип по расширению файла
   * @param extension Расширение файла (с точкой, например ".jpg")
   * @returns MIME-тип
   */
  private getMimeTypeByExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Получает случайное расширение файла для UUID
   * @returns Расширение файла
   */
  private getRandomExtension(): string {
    const extensions = ['.bin', '.file', '.data', '.tmp'];
    return extensions[Math.floor(Math.random() * extensions.length)];
  }

  /**
   * Извлекает имя файла из URL
   * @param url URL файла
   * @returns Имя файла или пустую строку
   */
  private extractFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = pathname.split('/').pop() || '';
      
      // Если имя файла содержит параметры запроса, удаляем их
      return fileName.split('?')[0];
    } catch (error) {
      // Если не удалось разобрать URL, возвращаем пустую строку
      return '';
    }
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const begetS3StorageAws = new BegetS3StorageAws();