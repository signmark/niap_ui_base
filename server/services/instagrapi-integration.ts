/**
 * Instagrapi интеграция для публикации Stories с интерактивными элементами
 * Обеспечивает реальную интерактивность в Instagram через instagrapi
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';

interface InstagramCredentials {
  username: string;
  password: string;
}

interface StoryPublishOptions {
  storyData: any;
  credentials: InstagramCredentials;
  mediaUrl?: string;
}

interface StoryPublishResult {
  success: boolean;
  storyId?: string;
  storyUrl?: string;
  error?: string;
}

/**
 * Генерирует базовое изображение для Stories (фон + статичные элементы)
 */
async function generateBaseImage(storyData: any): Promise<string> {
  // Создаем временную копию storyData только со статичными элементами
  const staticStoryData = {
    ...storyData,
    slides: storyData.slides.map((slide: any) => ({
      ...slide,
      elements: slide.elements.filter((element: any) => 
        !['poll', 'quiz', 'slider', 'question'].includes(element.type)
      )
    }))
  };

  // Генерируем базовое изображение через Python генератор
  const response = await axios.post('http://localhost:5000/generate-stories', {
    metadata: { storyData: staticStoryData }
  });

  if (response.data.success && response.data.imageUrls.length > 0) {
    return response.data.imageUrls[0].imageUrl;
  }

  throw new Error('Не удалось сгенерировать базовое изображение');
}

/**
 * Скачивает изображение по URL и сохраняет локально
 */
async function downloadImageToLocal(imageUrl: string): Promise<string> {
  const response = await axios.get(imageUrl, { responseType: 'stream' });
  
  const tempDir = path.join(__dirname, '..', 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  
  const filename = `story_${Date.now()}.jpg`;
  const filepath = path.join(tempDir, filename);
  
  const writer = require('fs').createWriteStream(filepath);
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filepath));
    writer.on('error', reject);
  });
}

/**
 * Публикует Stories через instagrapi с интерактивными элементами
 */
export async function publishInstagramStoryWithInstagrapi(
  options: StoryPublishOptions
): Promise<StoryPublishResult> {
  try {
    // 1. Генерируем или получаем изображение
    let mediaPath: string;
    
    if (options.mediaUrl) {
      // Скачиваем готовое изображение
      mediaPath = await downloadImageToLocal(options.mediaUrl);
    } else {
      // Генерируем базовое изображение без интерактивных элементов
      const baseImageUrl = await generateBaseImage(options.storyData);
      mediaPath = await downloadImageToLocal(baseImageUrl);
    }

    // 2. Подготавливаем данные для Python скрипта
    const pythonInput = {
      storyData: options.storyData,
      credentials: options.credentials,
      mediaPath: mediaPath
    };

    // 3. Запускаем Python скрипт с instagrapi
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [
        path.join(__dirname, 'instagrapi-stories.py')
      ]);

      // Отправляем данные в Python процесс
      pythonProcess.stdin.write(JSON.stringify(pythonInput));
      pythonProcess.stdin.end();

      let result = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        // Удаляем временный файл
        try {
          await fs.unlink(mediaPath);
        } catch (e) {
          console.warn('Не удалось удалить временный файл:', e);
        }

        if (code === 0) {
          try {
            const response = JSON.parse(result);
            resolve(response);
          } catch (parseError) {
            reject(new Error(`Ошибка парсинга ответа: ${parseError}`));
          }
        } else {
          reject(new Error(`Python процесс завершился с ошибкой: ${error}`));
        }
      });

      pythonProcess.on('error', (err) => {
        reject(new Error(`Ошибка запуска Python процесса: ${err.message}`));
      });
    });

  } catch (error) {
    return {
      success: false,
      error: `Ошибка публикации Stories: ${error}`
    };
  }
}

/**
 * Проверяет, содержит ли Stories интерактивные элементы
 */
export function hasInteractiveElements(storyData: any): boolean {
  if (!storyData?.slides?.[0]?.elements) {
    return false;
  }

  return storyData.slides[0].elements.some((element: any) =>
    ['poll', 'quiz', 'slider', 'question'].includes(element.type)
  );
}

/**
 * Определяет метод публикации в зависимости от наличия интерактивных элементов
 */
export async function publishInstagramStoryOptimal(
  storyData: any,
  credentials: InstagramCredentials,
  mediaUrl?: string
): Promise<StoryPublishResult> {
  
  if (hasInteractiveElements(storyData)) {
    // Используем instagrapi для интерактивных Stories
    console.log('[instagram] Публикация интерактивных Stories через instagrapi');
    return publishInstagramStoryWithInstagrapi({
      storyData,
      credentials,
      mediaUrl
    });
  } else {
    // Для простых Stories можно использовать обычную загрузку изображения
    console.log('[instagram] Публикация простых Stories через базовую загрузку');
    
    if (!mediaUrl) {
      const baseImageUrl = await generateBaseImage(storyData);
      mediaUrl = baseImageUrl;
    }

    return publishInstagramStoryWithInstagrapi({
      storyData,
      credentials,
      mediaUrl
    });
  }
}

/**
 * Валидация учетных данных Instagram
 */
export function validateInstagramCredentials(credentials: InstagramCredentials): boolean {
  return !!(credentials.username && credentials.password);
}