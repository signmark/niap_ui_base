import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '../utils/logger';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

/**
 * Сервис для обработки видео и преобразования в форматы, совместимые с социальными сетями
 */
export class VideoProcessorService {
  private tempDir: string;
  private outputDir: string;

  constructor() {
    // Создаем директории для временных файлов и выходных данных, если они не существуют
    this.tempDir = path.join(process.cwd(), 'uploads', 'temp');
    this.outputDir = path.join(process.cwd(), 'uploads', 'processed');
    this.ensureDirectoriesExist();
  }

  /**
   * Создает необходимые директории, если они не существуют
   */
  private ensureDirectoriesExist(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      log(`[VideoProcessor] Создана директория для временных файлов: ${this.tempDir}`, 'video-processor');
    }

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      log(`[VideoProcessor] Создана директория для обработанных видео: ${this.outputDir}`, 'video-processor');
    }
  }

  /**
   * Скачивает видео по URL в локальный файл
   * @param url URL видео
   * @returns Путь к локальному файлу или null в случае ошибки
   */
  async downloadVideo(url: string): Promise<string | null> {
    try {
      log(`[VideoProcessor] Начинаем скачивание видео: ${url}`, 'video-processor');
      
      const randomFileName = `${uuidv4()}.mp4`;
      const localFilePath = path.join(this.tempDir, randomFileName);
      
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 60000 // 60 секунд таймаут
      });
      
      // Сохраняем файл на диск
      const writer = fs.createWriteStream(localFilePath);
      
      return new Promise((resolve, reject) => {
        response.data.pipe(writer);
        
        let error: Error | null = null;
        writer.on('error', (err) => {
          error = err;
          writer.close();
          fs.unlink(localFilePath, () => {}); // Удаляем файл в случае ошибки
          reject(err);
        });
        
        writer.on('close', () => {
          if (!error) {
            log(`[VideoProcessor] Видео успешно скачано: ${localFilePath}`, 'video-processor');
            resolve(localFilePath);
          }
          // В случае ошибки не делаем ничего, так как ошибка уже обработана выше
        });
      });
    } catch (error: any) {
      log(`[VideoProcessor] Ошибка при скачивании видео: ${error.message}`, 'video-processor');
      return null;
    }
  }

  /**
   * Преобразует видео в формат Instagram Reels
   * @param inputPath Путь к исходному видео
   * @returns URL обработанного видео или null в случае ошибки
   */
  async convertToInstagramReels(inputPath: string): Promise<string | null> {
    try {
      log(`[VideoProcessor] Начинаем конвертацию видео для Instagram: ${inputPath}`, 'video-processor');
      
      const outputFileName = `instagram_reels_${path.basename(inputPath)}`;
      const outputPath = path.join(this.outputDir, outputFileName);
      
      // Используем ffmpeg для конвертации видео в формат, совместимый с Instagram Reels
      // Instagram рекомендует соотношение сторон 9:16 и следующие параметры
      const command = `ffmpeg -i "${inputPath}" -c:v libx264 -profile:v baseline -level 3.0 -c:a aac -ar 44100 -ac 2 -b:a 128k -pix_fmt yuv420p -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -r 30 -b:v 3.5M -maxrate 4M -bufsize 6M -movflags +faststart -strict experimental "${outputPath}"`;
      
      log(`[VideoProcessor] Выполнение команды ffmpeg: ${command}`, 'video-processor');
      
      const { stdout, stderr } = await execAsync(command);
      
      // Проверяем наличие выходного файла
      if (fs.existsSync(outputPath)) {
        log(`[VideoProcessor] Видео успешно конвертировано: ${outputPath}`, 'video-processor');
        
        // Создаем URL для доступа к файлу через HTTP
        // Предполагается, что файлы из outputDir доступны через HTTP
        const baseUrl = process.env.APP_URL || 'http://localhost:5000';
        const fileUrl = `${baseUrl}/uploads/processed/${outputFileName}`;
        
        log(`[VideoProcessor] URL доступа к конвертированному видео: ${fileUrl}`, 'video-processor');
        
        return fileUrl;
      } else {
        log(`[VideoProcessor] Ошибка: выходной файл не создан после конвертации`, 'video-processor');
        log(`[VideoProcessor] STDOUT: ${stdout}`, 'video-processor');
        log(`[VideoProcessor] STDERR: ${stderr}`, 'video-processor');
        return null;
      }
    } catch (error: any) {
      log(`[VideoProcessor] Ошибка при конвертации видео для Instagram: ${error.message}`, 'video-processor');
      return null;
    } finally {
      // Удаляем временный файл после обработки
      try {
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
          log(`[VideoProcessor] Удален временный файл: ${inputPath}`, 'video-processor');
        }
      } catch (error: any) {
        log(`[VideoProcessor] Ошибка при удалении временного файла: ${error.message}`, 'video-processor');
      }
    }
  }

  /**
   * Проверяет доступность ffmpeg в системе
   * @returns true если ffmpeg доступен, иначе false
   */
  async checkFfmpegAvailability(): Promise<boolean> {
    try {
      const { stdout, stderr } = await execAsync('ffmpeg -version');
      log(`[VideoProcessor] ffmpeg доступен: ${stdout.substring(0, 100)}...`, 'video-processor');
      return true;
    } catch (error: any) {
      log(`[VideoProcessor] ffmpeg не доступен: ${error.message}`, 'video-processor');
      return false;
    }
  }
  
  /**
   * Преобразует видео в формат, совместимый с социальными сетями
   * @param url URL исходного видео
   * @param platform Целевая социальная платформа ('instagram', 'facebook', и т.д.)
   * @returns URL обработанного видео или null в случае ошибки
   */
  async processVideoForSocialMedia(url: string, platform: string): Promise<string | null> {
    try {
      // Проверяем поддерживаемые платформы
      if (platform !== 'instagram' && platform !== 'facebook') {
        log(`[VideoProcessor] Неподдерживаемая платформа: ${platform}`, 'video-processor');
        return url; // Возвращаем исходный URL для неподдерживаемых платформ
      }
      
      // Проверяем доступность ffmpeg
      const ffmpegAvailable = await this.checkFfmpegAvailability();
      if (!ffmpegAvailable) {
        log(`[VideoProcessor] Невозможно обработать видео: ffmpeg не доступен`, 'video-processor');
        return url; // Возвращаем исходный URL, если ffmpeg не доступен
      }
      
      // Скачиваем видео
      const localFilePath = await this.downloadVideo(url);
      if (!localFilePath) {
        log(`[VideoProcessor] Не удалось скачать видео: ${url}`, 'video-processor');
        return null;
      }
      
      // Обрабатываем видео в зависимости от платформы
      if (platform === 'instagram') {
        return await this.convertToInstagramReels(localFilePath);
      } else {
        // Для других платформ пока просто возвращаем исходный URL
        return url;
      }
    } catch (error: any) {
      log(`[VideoProcessor] Ошибка при обработке видео: ${error.message}`, 'video-processor');
      return null;
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
export const videoProcessorService = new VideoProcessorService();