/**
 * Тест для проверки загрузки видео на Imgur
 * Этот скрипт проверяет работу метода uploadVideoFromFile сервиса ImgurUploader
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Параметры Imgur
const IMGUR_CLIENT_ID = 'fc3d6ae9c21a8df'; // Используем тот же Client ID, что и в сервисе
const IMGUR_UPLOAD_URL = 'https://api.imgur.com/3/upload';

/**
 * Загружает тестовое видео на Imgur с помощью прямого запроса
 * @param {string} filePath Путь к видео-файлу
 * @returns {Promise<string|null>} URL загруженного видео или null в случае ошибки
 */
async function uploadVideoToImgur(filePath) {
  try {
    console.log(`Загрузка видео на Imgur: ${filePath}`);
    
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
      title: `Test video upload ${new Date().toISOString()}`
    }, {
      headers: {
        'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // Увеличиваем таймаут до 30 секунд
    });
    
    if (response.data && response.data.success) {
      console.log('Видео успешно загружено на Imgur!');
      console.log(`Imgur URL: ${response.data.data.link}`);
      return response.data.data.link;
    } else {
      console.error('Ошибка при загрузке видео на Imgur:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Ошибка при загрузке видео на Imgur:');
    
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
 * Альтернативный метод загрузки с использованием FormData
 * @param {string} filePath Путь к видео-файлу
 * @returns {Promise<string|null>} URL загруженного видео или null в случае ошибки
 */
async function uploadVideoWithFormData(filePath) {
  try {
    console.log(`Загрузка видео на Imgur с использованием FormData: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`Файл не найден: ${filePath}`);
      return null;
    }
    
    const formData = new FormData();
    formData.append('image', fs.createReadStream(filePath));
    formData.append('type', 'file');
    formData.append('name', path.basename(filePath));
    formData.append('title', `Test video upload with FormData ${new Date().toISOString()}`);
    
    const response = await axios.post(IMGUR_UPLOAD_URL, formData, {
      headers: {
        'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
        ...formData.getHeaders()
      },
      timeout: 30000, // Увеличиваем таймаут до 30 секунд
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    if (response.data && response.data.success) {
      console.log('Видео успешно загружено на Imgur с использованием FormData!');
      console.log(`Imgur URL: ${response.data.data.link}`);
      return response.data.data.link;
    } else {
      console.error('Ошибка при загрузке видео на Imgur с FormData:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Ошибка при загрузке видео на Imgur с FormData:');
    
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
 * Пробует загрузить видео на ImgBB как альтернативу
 * @param {string} filePath Путь к видео-файлу
 * @returns {Promise<string|null>} URL загруженного видео или null в случае ошибки
 */
async function uploadVideoToImgBB(filePath) {
  try {
    const IMGBB_API_KEY = '24b7a2b8c7d4563497ca48e07d0c76ba'; // Ключ из сервиса imgur-uploader
    const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';
    
    console.log(`Загрузка видео на ImgBB: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`Файл не найден: ${filePath}`);
      return null;
    }
    
    // Читаем файл как бинарные данные
    const fileBuffer = fs.readFileSync(filePath);
    
    // Конвертируем в base64
    const base64Data = fileBuffer.toString('base64');
    console.log(`Файл прочитан и закодирован в base64, размер: ${base64Data.length} символов`);
    
    // Формируем FormData
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64Data);
    
    // Отправляем запрос
    const response = await axios.post(IMGBB_UPLOAD_URL, formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });
    
    if (response.data && response.data.success) {
      console.log('Видео успешно загружено на ImgBB!');
      console.log(`ImgBB URL: ${response.data.data.url}`);
      return response.data.data.url;
    } else {
      console.error('Ошибка при загрузке видео на ImgBB:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Ошибка при загрузке видео на ImgBB:');
    
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
      console.error('Данные:', error.response.data);
    } else if (error.request) {
      console.error('Запрос отправлен, но ответ не получен');
    } else {
      console.error('Ошибка:', error.message);
    }
    
    return null;
  }
}

/**
 * Основная функция для запуска тестов
 */
async function runTests() {
  // Находим тестовое видео в uploads/videos
  const videosDir = path.join(process.cwd(), 'uploads', 'videos');
  
  if (!fs.existsSync(videosDir)) {
    console.error(`Директория с видео не найдена: ${videosDir}`);
    return;
  }
  
  console.log(`Поиск видео файлов в директории: ${videosDir}`);
  
  // Читаем содержимое директории
  const files = fs.readdirSync(videosDir);
  
  // Фильтруем только видео файлы
  const videoFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(ext);
  });
  
  if (videoFiles.length === 0) {
    console.error('Видео файлы не найдены в директории uploads/videos');
    return;
  }
  
  console.log(`Найдены видео файлы: ${JSON.stringify(videoFiles, null, 2)}`);
  
  // Берем первый файл для теста
  const testVideoPath = path.join(videosDir, videoFiles[0]);
  console.log(`Выбран файл для тестирования: ${testVideoPath}`);
  
  // Получаем размер файла
  const stats = fs.statSync(testVideoPath);
  console.log(`Размер файла: ${stats.size} байт (${(stats.size / 1024 / 1024).toFixed(2)} МБ)`);
  
  // Запуск тестов
  console.log('\n=== ТЕСТ 1: Загрузка на Imgur с base64 ===');
  const imgurUrl = await uploadVideoToImgur(testVideoPath);
  
  console.log('\n=== ТЕСТ 2: Загрузка на Imgur с FormData ===');
  const formDataUrl = await uploadVideoWithFormData(testVideoPath);
  
  console.log('\n=== ТЕСТ 3: Загрузка на ImgBB ===');
  const imgbbUrl = await uploadVideoToImgBB(testVideoPath);
  
  // Выводим итоги
  console.log('\n=== РЕЗУЛЬТАТЫ ТЕСТОВ ===');
  console.log(`Тест 1 (Imgur base64): ${imgurUrl ? 'УСПЕХ' : 'НЕУДАЧА'}`);
  console.log(`Тест 2 (Imgur FormData): ${formDataUrl ? 'УСПЕХ' : 'НЕУДАЧА'}`);
  console.log(`Тест 3 (ImgBB): ${imgbbUrl ? 'УСПЕХ' : 'НЕУДАЧА'}`);
}

// Запускаем тесты
runTests().catch(error => {
  console.error('Ошибка при выполнении тестов:', error);
});