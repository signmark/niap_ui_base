import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import * as path from 'path';
import { log } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

/**
 * Сервис для обработки видео: изменение разрешения, соотношения сторон и других параметров
 * для приведения в соответствие требованиям социальных платформ
 */
export class VideoProcessor {
  private tempDir: string = 'temp';
  
  constructor() {
    this.ensureTempDirectory();
  }
  
  /**
   * Проверяет и создает временную директорию для хранения обработанных видео
   * @private
   */
  private ensureTempDirectory(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch (error) {
      log(`Ошибка при создании временной директории: ${error}`, 'video-processor');
    }
  }
  
  /**
   * Загружает видео с URL в локальную файловую систему
   * @param url URL видео для загрузки
   * @returns Путь к загруженному файлу или null в случае ошибки
   */
  private async downloadVideo(url: string): Promise<string | null> {
    try {
      const tempFilePath = path.join(this.tempDir, `original_${uuidv4()}.mp4`);
      
      log(`Начинаем загрузку видео с URL: ${url}`, 'video-processor');
      
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 60000 // 1 минута на загрузку
      });
      
      const writer = fs.createWriteStream(tempFilePath);
      
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          log(`Видео успешно загружено в ${tempFilePath}`, 'video-processor');
          resolve(tempFilePath);
        });
        
        writer.on('error', (err) => {
          log(`Ошибка при сохранении видео: ${err.message}`, 'video-processor');
          fs.unlink(tempFilePath, () => {}); // Удаляем файл при ошибке
          reject(err);
        });
      });
    } catch (error) {
      log(`Ошибка при загрузке видео: ${error}`, 'video-processor');
      return null;
    }
  }
  
  /**
   * Получает информацию о видеофайле с помощью ffprobe
   * @param filePath Путь к видеофайлу
   * @returns Объект с информацией о видео или null в случае ошибки
   */
  private async getVideoInfo(filePath: string): Promise<any | null> {
    try {
      const command = `ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name,duration -show_entries format=duration -of json "${filePath}"`;
      
      log(`Получение информации о видео: ${command}`, 'video-processor');
      
      const { stdout } = await execAsync(command);
      const info = JSON.parse(stdout);
      
      // Найдем видео поток
      const videoStream = info.streams.find((stream: any) => stream.codec_name === 'h264' || stream.codec_type === 'video');
      
      if (!videoStream) {
        log(`Видео поток не найден в файле`, 'video-processor');
        return null;
      }
      
      // Возвращаем объект с важными параметрами
      return {
        width: parseInt(videoStream.width),
        height: parseInt(videoStream.height),
        duration: parseFloat(videoStream.duration || info.format.duration),
        codec: videoStream.codec_name,
        aspectRatio: parseInt(videoStream.width) / parseInt(videoStream.height)
      };
    } catch (error) {
      log(`Ошибка при получении информации о видео: ${error}`, 'video-processor');
      return null;
    }
  }
  
  /**
   * Преобразует видео для Instagram (оптимизирует размер, соотношение сторон)
   * @param inputPath Путь к исходному видео
   * @param platform Целевая платформа (по умолчанию instagram)
   * @returns Путь к преобразованному видео или null в случае ошибки
   */
  private async convertVideo(inputPath: string, platform: 'instagram' | 'vk' | 'telegram' = 'instagram'): Promise<string | null> {
    try {
      // Получаем информацию о видео
      const videoInfo = await this.getVideoInfo(inputPath);
      
      if (!videoInfo) {
        log(`Не удалось получить информацию о видео для конвертации`, 'video-processor');
        return null;
      }
      
      log(`Информация о видео: ${JSON.stringify(videoInfo)}`, 'video-processor');
      
      // Создаем имя выходного файла
      const outputPath = path.join(this.tempDir, `converted_${uuidv4()}.mp4`);
      
      // Параметры для различных платформ
      const platformSettings: Record<string, { width: number, height: number, aspectRatio: number }> = {
        instagram: { width: 1080, height: 1920, aspectRatio: 9/16 }, // Вертикальное соотношение для Instagram Reels
        vk: { width: 1280, height: 720, aspectRatio: 16/9 }, // Стандартное соотношение для VK
        telegram: { width: 1280, height: 720, aspectRatio: 16/9 } // Стандартное соотношение для Telegram
      };
      
      const settings = platformSettings[platform];
      
      // Расчет целевого разрешения
      let targetWidth: number;
      let targetHeight: number;
      
      // Проверяем соотношение сторон и корректируем размеры
      if (Math.abs(videoInfo.aspectRatio - settings.aspectRatio) < 0.05) {
        // Соотношение сторон почти правильное, просто масштабируем
        targetWidth = settings.width;
        targetHeight = settings.height;
      } else if (videoInfo.aspectRatio > settings.aspectRatio) {
        // Видео шире, чем нужно - подгоняем по высоте и центрируем
        targetHeight = settings.height;
        targetWidth = Math.round(targetHeight * settings.aspectRatio);
      } else {
        // Видео уже, чем нужно - подгоняем по ширине и центрируем
        targetWidth = settings.width;
        targetHeight = Math.round(targetWidth / settings.aspectRatio);
      }
      
      log(`Целевое разрешение: ${targetWidth}x${targetHeight}`, 'video-processor');
      
      // Формируем команду ffmpeg для преобразования
      // Стратегия: Масштабирование с сохранением соотношения сторон и добавлением черных полос если нужно
      const command = `ffmpeg -i "${inputPath}" -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k "${outputPath}"`;
      
      log(`Команда конвертации: ${command}`, 'video-processor');
      
      await execAsync(command);
      
      log(`Видео успешно преобразовано: ${outputPath}`, 'video-processor');
      
      return outputPath;
    } catch (error) {
      log(`Ошибка при конвертации видео: ${error}`, 'video-processor');
      return null;
    }
  }
  
  /**
   * Загружает обработанное видео на Beget S3 хранилище
   * @param filePath Путь к преобразованному видео
   * @returns URL загруженного видео или null в случае ошибки
   */
  private async uploadToS3(filePath: string): Promise<string | null> {
    // Здесь должен быть код для загрузки на Beget S3
    // Используем временное решение с локальным хостингом файла
    try {
      // Генерируем имя для файла в хранилище
      const fileName = `processed_${path.basename(filePath)}`;
      
      // Копируем файл в публичную директорию или загружаем через API
      const publicPath = `/uploads/${fileName}`; // Относительный путь для доступа
      fs.copyFileSync(filePath, `.${publicPath}`); // Копируем в публичную директорию
      
      // Возвращаем URL для доступа к файлу через веб-сервер
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const fileUrl = `${baseUrl}${publicPath}`;
      
      log(`Видео доступно по URL: ${fileUrl}`, 'video-processor');
      
      return fileUrl;
    } catch (error) {
      log(`Ошибка при загрузке видео на S3: ${error}`, 'video-processor');
      return null;
    }
  }
  
  /**
   * Удаляет все временные файлы, созданные во время обработки
   * @param files Массив путей к файлам для удаления
   */
  private cleanupFiles(files: string[]): void {
    files.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          log(`Файл удален: ${file}`, 'video-processor');
        }
      } catch (error) {
        log(`Ошибка при удалении файла ${file}: ${error}`, 'video-processor');
      }
    });
  }
  
  /**
   * Анализирует видео и возвращает информацию о нем
   * @param videoUrl URL исходного видео
   * @returns Объект с информацией о видео или null в случае ошибки
   */
  async analyzeVideo(videoUrl: string): Promise<any | null> {
    try {
      log(`Анализ видео: ${videoUrl}`, 'video-processor');
      
      // Загружаем видео
      const downloadedPath = await this.downloadVideo(videoUrl);
      if (!downloadedPath) {
        throw new Error('Не удалось загрузить видео');
      }
      
      // Получаем информацию о видео
      const videoInfo = await this.getVideoInfo(downloadedPath);
      
      // Удаляем скачанный файл
      this.cleanupFiles([downloadedPath]);
      
      return videoInfo;
    } catch (error) {
      log(`Ошибка при анализе видео: ${error.message}`, 'video-processor');
      return null;
    }
  }
  
  /**
   * Обрабатывает видео для социальных медиа
   * Алиас для метода processVideo для поддержки API тестовых маршрутов
   * @param videoUrl URL исходного видео
   * @param platform Целевая платформа
   * @returns URL обработанного видео или null в случае ошибки
   */
  async processVideoForSocialMedia(videoUrl: string, platform: 'instagram' | 'vk' | 'telegram' = 'instagram'): Promise<string | null> {
    return this.processVideo(videoUrl, platform);
  }
  
  /**
   * Обрабатывает видео для соответствия требованиям платформы
   * @param videoUrl URL исходного видео
   * @param platform Целевая платформа
   * @returns URL обработанного видео или null в случае ошибки
   */
  async processVideo(videoUrl: string, platform: 'instagram' | 'vk' | 'telegram' = 'instagram'): Promise<string | null> {
    const filesToCleanup: string[] = [];
    
    try {
      log(`Начало обработки видео для ${platform}: ${videoUrl}`, 'video-processor');
      
      // Шаг 1: Загружаем видео
      const downloadedPath = await this.downloadVideo(videoUrl);
      if (!downloadedPath) {
        return null;
      }
      filesToCleanup.push(downloadedPath);
      
      // Шаг 2: Получаем информацию о видео
      const videoInfo = await this.getVideoInfo(downloadedPath);
      if (!videoInfo) {
        this.cleanupFiles(filesToCleanup);
        return null;
      }
      
      // Шаг 3: Проверяем необходимость конвертации
      let finalVideoPath = downloadedPath;
      
      // Проверяем соотношение сторон для Instagram
      const platformAspectRatio = platform === 'instagram' ? 9/16 : 16/9;
      const needsConversion = Math.abs(videoInfo.aspectRatio - platformAspectRatio) > 0.05;
      
      if (needsConversion) {
        log(`Видео требует конвертации для ${platform}. Текущее соотношение: ${videoInfo.aspectRatio.toFixed(2)}, целевое: ${platformAspectRatio}`, 'video-processor');
        
        const convertedPath = await this.convertVideo(downloadedPath, platform);
        if (!convertedPath) {
          this.cleanupFiles(filesToCleanup);
          return null;
        }
        filesToCleanup.push(convertedPath);
        finalVideoPath = convertedPath;
      } else {
        log(`Видео уже соответствует требованиям ${platform}, конвертация не требуется`, 'video-processor');
      }
      
      // Шаг 4: Загружаем обработанное видео на Beget S3 или другое хранилище
      const uploadedUrl = await this.uploadToS3(finalVideoPath);
      
      // Шаг 5: Очищаем временные файлы
      this.cleanupFiles(filesToCleanup);
      
      return uploadedUrl;
    } catch (error) {
      log(`Общая ошибка при обработке видео: ${error}`, 'video-processor');
      this.cleanupFiles(filesToCleanup);
      return null;
    }
  }
}

export const videoProcessor = new VideoProcessor();