/**
 * Тестовый скрипт для проверки возможности загрузки видео на Imgur
 * Запуск: node test-imgur-video-upload.js
 */

import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import { fileURLToPath } from 'url';

// Получение __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для логирования с указанием времени
function log(message) {
  console.log(`${new Date().toLocaleTimeString()} ${message}`);
}

// Константы
const IMGUR_CLIENT_ID = 'fc3d6ae9c21a8df'; // API ключ Imgur
const UPLOAD_ENDPOINT = 'https://api.imgur.com/3/upload';

// URL тестового видео
const VIDEO_URLS = [
  'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
];

// Функция для загрузки видео из URL
async function downloadVideo(url, outputPath) {
  log(`Скачивание видео из ${url}`);
  
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream'
  });
  
  const writer = fs.createWriteStream(outputPath);
  
  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    
    let error = null;
    writer.on('error', err => {
      error = err;
      writer.close();
      reject(err);
    });
    
    writer.on('close', () => {
      if (!error) {
        log(`Видео сохранено в ${outputPath}`);
        resolve(true);
      }
    });
  });
}

// Функция для загрузки файла на Imgur
async function uploadToImgur(filePath) {
  log(`Загрузка файла ${filePath} на Imgur`);
  
  try {
    const formData = new FormData();
    formData.append('video', fs.createReadStream(filePath));
    
    const response = await axios.post(UPLOAD_ENDPOINT, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`
      }
    });
    
    if (response.data && response.data.success) {
      log(`Файл успешно загружен: ${response.data.data.link}`);
      return response.data.data;
    } else {
      log(`Ошибка при загрузке: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    log(`Ошибка при загрузке на Imgur: ${error.message}`);
    if (error.response) {
      log(`Статус ошибки: ${error.response.status}`);
      log(`Данные ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

// Функция получения информации о файле
function getFileInfo(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const fileSizeInMb = stats.size / (1024 * 1024);
    return {
      size: fileSizeInMb.toFixed(2) + ' MB',
      path: filePath,
      extension: path.extname(filePath)
    };
  } catch (error) {
    log(`Ошибка при получении информации о файле: ${error.message}`);
    return null;
  }
}

// Основная функция для тестирования загрузки видео
async function testVideoUpload() {
  log('Начало тестирования загрузки видео на Imgur');
  
  // Создаем временную директорию
  const tempDir = path.join(process.cwd(), 'uploads', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    log(`Создана временная директория: ${tempDir}`);
  }
  
  let testResults = [];
  
  // Последовательно тестируем загрузку видео из разных источников
  for (let i = 0; i < VIDEO_URLS.length; i++) {
    const videoUrl = VIDEO_URLS[i];
    const videoPath = path.join(tempDir, `test-video-${i + 1}.mp4`);
    
    try {
      // Скачиваем видео
      await downloadVideo(videoUrl, videoPath);
      
      // Получаем информацию о файле
      const fileInfo = getFileInfo(videoPath);
      log(`Информация о файле: ${JSON.stringify(fileInfo)}`);
      
      // Загружаем видео на Imgur
      const result = await uploadToImgur(videoPath);
      
      testResults.push({
        videoUrl,
        success: !!result,
        result: result,
        fileInfo
      });
      
      log(`Тест ${i + 1} завершен: ${result ? 'успешно' : 'неудачно'}`);
    } catch (error) {
      log(`Ошибка при выполнении теста ${i + 1}: ${error.message}`);
      testResults.push({
        videoUrl,
        success: false,
        error: error.message
      });
    }
  }
  
  // Выводим итоговые результаты
  log('\n=== Результаты тестирования загрузки видео на Imgur ===');
  testResults.forEach((result, index) => {
    log(`\nТест ${index + 1} (${result.videoUrl}):`);
    log(`Статус: ${result.success ? 'УСПЕШНО' : 'НЕУДАЧНО'}`);
    if (result.fileInfo) {
      log(`Размер файла: ${result.fileInfo.size}`);
    }
    if (result.result) {
      log(`URL загруженного файла: ${result.result.link}`);
      log(`Тип медиа: ${result.result.type}`);
    }
    if (result.error) {
      log(`Ошибка: ${result.error}`);
    }
  });
  
  log('\n=== Тестирование завершено ===');
}

// Запускаем тестирование
testVideoUpload().catch(error => {
  log(`Критическая ошибка при тестировании: ${error.message}`);
});