/**
 * Тест для проверки загрузки небольшого файла на Imgur
 * Использует только минимальный тестовый файл для проверки доступности API
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Параметры Imgur
const IMGUR_CLIENT_ID = 'fc3d6ae9c21a8df';
const IMGUR_UPLOAD_URL = 'https://api.imgur.com/3/upload';

// Создаем маленький тестовый файл для проверки
async function createTestFile() {
  const testFilePath = path.join(process.cwd(), 'test-image.png');
  
  // Это простое 1x1 пиксельное PNG изображение (очень маленькое)
  const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  
  // Преобразуем base64 обратно в бинарные данные
  const imageBuffer = Buffer.from(base64Image, 'base64');
  
  // Записываем во временный файл
  fs.writeFileSync(testFilePath, imageBuffer);
  
  console.log(`Создан тестовый файл: ${testFilePath}`);
  console.log(`Размер файла: ${imageBuffer.length} байт`);
  
  return testFilePath;
}

/**
 * Загружает маленький тестовый файл на Imgur
 * @param {string} filePath Путь к файлу
 * @returns {Promise<string|null>} URL загруженного файла или null в случае ошибки
 */
async function uploadFileToImgur(filePath) {
  try {
    console.log(`Загрузка файла на Imgur: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`Файл не найден: ${filePath}`);
      return null;
    }
    
    // Читаем файл как бинарные данные
    const fileBuffer = fs.readFileSync(filePath);
    
    // Конвертируем в base64
    const base64Data = fileBuffer.toString('base64');
    console.log(`Файл прочитан и закодирован в base64, размер: ${base64Data.length} символов`);
    
    // Отправляем запрос с base64 данными
    const response = await axios.post(IMGUR_UPLOAD_URL, {
      image: base64Data,
      type: 'base64',
      name: path.basename(filePath),
      title: `Test image upload ${new Date().toISOString()}`
    }, {
      headers: {
        'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.success) {
      console.log('Изображение успешно загружено на Imgur!');
      console.log(`Imgur URL: ${response.data.data.link}`);
      return response.data.data.link;
    } else {
      console.error('Ошибка при загрузке изображения на Imgur:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Ошибка при загрузке изображения на Imgur:');
    
    if (error.response) {
      // Ответ от сервера с ошибкой
      console.error(`Статус: ${error.response.status}`);
      console.error('Заголовки:', JSON.stringify(error.response.headers, null, 2));
      console.error('Данные:', error.response.data);
    } else if (error.request) {
      // Запрос был сделан, но ответ не получен
      console.error('Запрос отправлен, но ответ не получен');
      console.error(error.request);
    } else {
      // Ошибка при настройке запроса
      console.error('Ошибка:', error.message);
    }
    
    return null;
  }
}

/**
 * Главная функция для тестирования
 */
async function runTest() {
  try {
    // Создаем тестовый файл
    const testFilePath = await createTestFile();
    
    // Загружаем на Imgur
    console.log('\n=== ТЕСТ: Загрузка маленького изображения на Imgur ===');
    const imgurUrl = await uploadFileToImgur(testFilePath);
    
    // Проверяем результаты
    if (imgurUrl) {
      console.log('\n=== РЕЗУЛЬТАТ ТЕСТА ===');
      console.log('Тест пройден успешно, API Imgur доступен');
      console.log(`Загруженное изображение: ${imgurUrl}`);
    } else {
      console.log('\n=== РЕЗУЛЬТАТ ТЕСТА ===');
      console.log('Тест не пройден, API Imgur недоступен');
      console.log('Рекомендуется продолжать использовать локальное хранилище для видео');
    }
    
    // Очищаем временные файлы
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log(`Временный файл удален: ${testFilePath}`);
    }
  } catch (error) {
    console.error('Ошибка при выполнении теста:', error);
  }
}

// Запускаем тест
runTest().catch(error => {
  console.error('Ошибка при выполнении теста:', error);
});