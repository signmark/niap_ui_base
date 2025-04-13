import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';
import * as http from 'http';
import * as https from 'https';

// Функция для логирования с указанием контекста
function log(message: string, context: string = 'imgur-uploader') {
  console.log(`${new Date().toLocaleTimeString()} [${context}] ${message}`);
}

export class ImgurUploaderService {
  private readonly imgurApiKey: string = '24b7a2b8c7d4563497ca48e07d0c76ba'; // ImgBB API Key
  private readonly imgurClientId: string = 'fc3d6ae9c21a8df'; // Imgur Client ID
  private readonly imgbbUploadEndpoint: string = 'https://api.imgbb.com/1/upload';
  private readonly imgurUploadEndpoint: string = 'https://api.imgur.com/3/upload';
  private readonly tempDir: string = path.join(process.cwd(), 'uploads', 'temp');

  constructor() {
    log('ImgurUploaderService инициализирован');
    this.ensureTempDirExists();
  }

  /**
   * Проверяет существование временной директории и создаёт её при необходимости
   */
  private async ensureTempDirExists(): Promise<void> {
    try {
      await mkdir(this.tempDir, { recursive: true });
      log(`Временная директория создана: ${this.tempDir}`);
    } catch (error) {
      log(`Ошибка при создании временной директории: ${error}`);
    }
  }

  /**
   * Загружает изображение из URL на Imgur, работает только с локальными файлами
   * @param imageUrl URL изображения для загрузки
   * @returns URL загруженного изображения на Imgur или null в случае ошибки
   */
  async uploadImageFromUrl(imageUrl: string): Promise<string | null> {
    try {
      log(`Загрузка изображения на Imgur из URL: ${imageUrl}`);
      
      // Если это не локальный файл, то возвращаем исходный URL
      if (imageUrl.startsWith('http') && !imageUrl.includes('localhost') && !imageUrl.includes('127.0.0.1')) {
        log(`URL не является локальным, возвращаем исходный URL: ${imageUrl}`);
        return imageUrl;
      }
      
      // Проверяем, является ли URL локальным файлом
      if (!imageUrl.startsWith('/') && !imageUrl.startsWith('./')) {
        log(`URL не является путем к локальному файлу: ${imageUrl}`);
        return imageUrl;
      }
      
      // Преобразуем относительный путь в абсолютный
      let filePath = imageUrl;
      if (imageUrl.startsWith('./')) {
        filePath = path.join(process.cwd(), imageUrl.substring(2));
      } else if (!path.isAbsolute(imageUrl)) {
        filePath = path.join(process.cwd(), imageUrl);
      }
      
      // Проверяем, существует ли файл
      if (!fs.existsSync(filePath)) {
        log(`Локальный файл не найден: ${filePath}`);
        return imageUrl;
      }
      
      // Загружаем изображение на Imgur
      const imgurUrl = await this.uploadImageFromFile(filePath);
      if (imgurUrl) {
        log(`Локальный файл успешно загружен на Imgur: ${imgurUrl}`);
        return imgurUrl;
      } else {
        log(`Не удалось загрузить локальный файл на Imgur: ${filePath}`);
        return imageUrl;
      }
    } catch (error) {
      log(`Ошибка при загрузке изображения на Imgur: ${error}`);
      return imageUrl; // Возвращаем исходный URL в случае ошибки
    }
  }

  /**
   * Загружает изображение из файла на ImgBB
   * @param filePath Путь к файлу изображения
   * @returns URL загруженного изображения на ImgBB или null в случае ошибки
   */
  async uploadImageFromFile(filePath: string): Promise<string | null> {
    try {
      log(`Загрузка изображения на ImgBB из файла: ${filePath}`);
      
      // Создаем объект FormData для отправки файла
      const formData = new FormData();
      formData.append('key', this.imgurApiKey);
      formData.append('image', fs.createReadStream(filePath));

      // Отправляем запрос на ImgBB API
      const response = await axios.post(this.imgbbUploadEndpoint, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      // Проверяем ответ
      if (response.data && response.data.success && response.data.data && response.data.data.url) {
        log(`Изображение успешно загружено на ImgBB: ${response.data.data.url}`);
        return response.data.data.url;
      } else {
        log(`Неожиданный формат ответа от ImgBB API: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error) {
      log(`Ошибка при загрузке изображения на ImgBB из файла: ${error}`);
      return null;
    }
  }
  
  /**
   * Загружает видео из файла на Imgur
   * @param filePath Путь к файлу видео
   * @returns URL загруженного видео на Imgur или null в случае ошибки
   */
  async uploadVideoFromFile(filePath: string): Promise<string | null> {
    try {
      log(`Загрузка видео на Imgur из файла: ${filePath}`);
      
      // Создаем объект FormData для отправки файла
      const formData = new FormData();
      formData.append('video', fs.createReadStream(filePath));
      
      // Отправляем запрос на Imgur API
      const response = await axios.post(this.imgurUploadEndpoint, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Client-ID ${this.imgurClientId}`
        },
      });
      
      // Проверяем ответ
      if (response.data && response.data.success && response.data.data && response.data.data.link) {
        log(`Видео успешно загружено на Imgur: ${response.data.data.link}`);
        return response.data.data.link;
      } else {
        log(`Неожиданный формат ответа от Imgur API: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error) {
      log(`Ошибка при загрузке видео на Imgur из файла: ${error}`);
      return null;
    }
  }
  
  /**
   * Загружает видео из URL на Imgur
   * @param videoUrl URL видео для загрузки
   * @returns URL загруженного видео на Imgur или null в случае ошибки
   */
  async uploadVideoFromUrl(videoUrl: string): Promise<string | null> {
    try {
      log(`Загрузка видео на Imgur из URL: ${videoUrl}`);
      
      // Если это не локальный файл, то возвращаем исходный URL для видео с внешних источников
      if (videoUrl.startsWith('http') && !videoUrl.includes('localhost') && !videoUrl.includes('127.0.0.1')) {
        log(`URL не является локальным, возвращаем исходный URL: ${videoUrl}`);
        return videoUrl;
      }
      
      // Проверяем, является ли URL локальным файлом
      if (!videoUrl.startsWith('/') && !videoUrl.startsWith('./')) {
        log(`URL не является путем к локальному файлу: ${videoUrl}`);
        return videoUrl;
      }
      
      // Преобразуем относительный путь в абсолютный
      let filePath = videoUrl;
      if (videoUrl.startsWith('./')) {
        filePath = path.join(process.cwd(), videoUrl.substring(2));
      } else if (!path.isAbsolute(videoUrl)) {
        filePath = path.join(process.cwd(), videoUrl);
      }
      
      // Проверяем, существует ли файл
      if (!fs.existsSync(filePath)) {
        log(`Локальный файл не найден: ${filePath}`);
        return videoUrl;
      }
      
      // Загружаем видео на Imgur
      const imgurUrl = await this.uploadVideoFromFile(filePath);
      if (imgurUrl) {
        log(`Локальное видео успешно загружено на Imgur: ${imgurUrl}`);
        return imgurUrl;
      } else {
        log(`Не удалось загрузить локальное видео на Imgur: ${filePath}`);
        return videoUrl;
      }
    } catch (error) {
      log(`Ошибка при загрузке видео на Imgur: ${error}`);
      return videoUrl; // Возвращаем исходный URL в случае ошибки
    }
  }

  /**
   * Загружает изображения из массива URL на Imgur
   * @param imageUrls Массив URL изображений для загрузки
   * @returns Массив URL загруженных изображений на Imgur
   */
  async uploadMultipleImagesFromUrls(imageUrls: string[]): Promise<string[]> {
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      log('Передан пустой массив URL изображений');
      return [];
    }

    log(`Загрузка ${imageUrls.length} изображений на Imgur`);
    const results: string[] = [];

    // Загружаем изображения последовательно, чтобы не перегружать сервер
    for (const imageUrl of imageUrls) {
      if (!imageUrl) continue;
      
      try {
        const imgurUrl = await this.uploadImageFromUrl(imageUrl);
        if (imgurUrl) {
          results.push(imgurUrl);
        }
      } catch (error) {
        log(`Ошибка при загрузке изображения ${imageUrl}: ${error}`);
      }
    }

    log(`Успешно загружено ${results.length} из ${imageUrls.length} изображений на Imgur`);
    return results;
  }
}

// Экспортируем экземпляр сервиса
export const imgurUploaderService = new ImgurUploaderService();