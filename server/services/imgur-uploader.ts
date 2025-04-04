import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';

// Функция для логирования с указанием контекста
function log(message: string, context: string = 'imgur-uploader') {
  console.log(`${new Date().toLocaleTimeString()} [${context}] ${message}`);
}

export class ImgurUploaderService {
  private readonly imgurApiKey: string = '24b7a2b8c7d4563497ca48e07d0c76ba'; // Используем ключ из n8n
  private readonly uploadEndpoint: string = 'https://api.imgbb.com/1/upload';
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
   * Загружает изображение из URL на Imgur
   * @param imageUrl URL изображения для загрузки
   * @returns URL загруженного изображения на Imgur или null в случае ошибки
   */
  async uploadImageFromUrl(imageUrl: string): Promise<string | null> {
    try {
      log(`Загрузка изображения на Imgur из URL: ${imageUrl}`);
      
      // Скачиваем изображение во временный файл
      const tempFilePath = path.join(this.tempDir, `${randomUUID()}.jpg`);
      
      try {
        // Получаем изображение
        const response = await axios({
          method: 'GET',
          url: imageUrl,
          responseType: 'stream',
        });

        // Сохраняем изображение во временный файл
        await pipeline(response.data, createWriteStream(tempFilePath));
        log(`Изображение скачано во временный файл: ${tempFilePath}`);
        
        // Загружаем изображение на Imgur
        const imgurUrl = await this.uploadImageFromFile(tempFilePath);
        
        // Удаляем временный файл
        fs.unlinkSync(tempFilePath);
        log(`Временный файл удален: ${tempFilePath}`);
        
        return imgurUrl;
      } catch (error) {
        log(`Ошибка при скачивании изображения: ${error}`);
        // Удаляем временный файл при ошибке, если он был создан
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          log(`Временный файл удален после ошибки: ${tempFilePath}`);
        }
        return null;
      }
    } catch (error) {
      log(`Ошибка при загрузке изображения на Imgur: ${error}`);
      return null;
    }
  }

  /**
   * Загружает изображение из файла на Imgur
   * @param filePath Путь к файлу изображения
   * @returns URL загруженного изображения на Imgur или null в случае ошибки
   */
  async uploadImageFromFile(filePath: string): Promise<string | null> {
    try {
      log(`Загрузка изображения на Imgur из файла: ${filePath}`);
      
      // Создаем объект FormData для отправки файла
      const formData = new FormData();
      formData.append('key', this.imgurApiKey);
      formData.append('image', fs.createReadStream(filePath));

      // Отправляем запрос на Imgur API
      const response = await axios.post(this.uploadEndpoint, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      // Проверяем ответ
      if (response.data && response.data.success && response.data.data && response.data.data.url) {
        log(`Изображение успешно загружено на Imgur: ${response.data.data.url}`);
        return response.data.data.url;
      } else {
        log(`Неожиданный формат ответа от Imgur API: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error) {
      log(`Ошибка при загрузке изображения на Imgur из файла: ${error}`);
      return null;
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