/**
 * Тест отправки изображений в Telegram
 * Проверяет функциональность отправки одиночных изображений и групп изображений с HTML-подписями
 * 
 * Запуск: node telegram-image-test.js
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Выводит заголовок теста
 * @param {string} title Заголовок теста
 */
function printHeader(title) {
  console.log(`\n${colors.cyan}======== ${title} ========${colors.reset}`);
}

/**
 * Выводит результат теста
 * @param {string} name Название теста
 * @param {boolean} success Успешность выполнения
 * @param {object} response Ответ от API
 */
function printResult(name, success, response) {
  const statusText = success 
    ? `${colors.green}✓ ПРОЙДЕН${colors.reset}` 
    : `${colors.red}✗ ПРОВАЛЕН${colors.reset}`;
  
  console.log(`\n${colors.bright}=== Тест: ${name} ===${colors.reset}`);
  console.log(`Статус: ${statusText}`);
  
  if (response) {
    if (response.ok === true) {
      console.log(`\n${colors.blue}Результат отправки:${colors.reset}`);
      if (response.result.photo) {
        console.log(`Изображение отправлено: ID: ${response.result.message_id}`);
        console.log(`Текст подписи: ${response.result.caption || "(без подписи)"}`);
      } else if (response.result.media_group_id) {
        console.log(`Группа медиа отправлена: Group ID: ${response.result.media_group_id}`);
        console.log(`Сообщение ID: ${response.result.message_id}`);
      } else {
        console.log(JSON.stringify(response, null, 2));
      }
    } else {
      console.log(`\n${colors.red}Ошибка:${colors.reset}`);
      console.log(JSON.stringify(response, null, 2));
    }
  }
}

/**
 * Отправляет отдельное изображение в Telegram
 * @param {string} imagePath Путь к изображению
 * @param {string} caption HTML-подпись (опционально)
 * @returns {Promise<object>} Ответ от Telegram API
 */
async function sendImage(imagePath, caption = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    throw new Error('Отсутствуют переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
  }
  
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Файл не найден: ${imagePath}`);
  }
  
  console.log(`Отправка изображения в Telegram: ${path.basename(imagePath)}`);
  if (caption) {
    console.log(`С подписью: ${caption.substring(0, 100)}${caption.length > 100 ? '...' : ''}`);
  }
  
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;
  const formData = new FormData();
  
  formData.append('chat_id', chatId);
  formData.append('photo', fs.createReadStream(imagePath));
  
  if (caption) {
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка при отправке изображения:', error);
    return {
      ok: false,
      error: error.message
    };
  }
}

/**
 * Отправляет группу изображений в Telegram
 * @param {string[]} imagePaths Массив путей к изображениям
 * @param {string} caption HTML-подпись (опционально)
 * @returns {Promise<object>} Ответ от Telegram API
 */
async function sendMediaGroup(imagePaths, caption = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    throw new Error('Отсутствуют переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
  }
  
  // Проверяем существование всех файлов
  for (const imagePath of imagePaths) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Файл не найден: ${imagePath}`);
    }
  }
  
  console.log(`Отправка группы из ${imagePaths.length} изображений в Telegram`);
  if (caption) {
    console.log(`С подписью: ${caption.substring(0, 100)}${caption.length > 100 ? '...' : ''}`);
  }
  
  // Формируем медиагруппу
  const mediaItems = [];
  const formData = new FormData();
  
  formData.append('chat_id', chatId);
  
  // Добавляем все изображения
  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    const filename = `file${i}`;
    
    // Добавляем файл в форму
    formData.append(filename, fs.createReadStream(imagePath));
    
    // Создаем медиа-элемент
    const mediaItem = {
      type: 'photo',
      media: `attach://${filename}`
    };
    
    // Добавляем подпись только к первому изображению
    if (i === 0 && caption) {
      mediaItem.caption = caption;
      mediaItem.parse_mode = 'HTML';
    }
    
    mediaItems.push(mediaItem);
  }
  
  // Добавляем JSON с медиагруппой
  formData.append('media', JSON.stringify(mediaItems));
  
  const url = `https://api.telegram.org/bot${token}/sendMediaGroup`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    // Если получен массив, вернем первый элемент для упрощения вывода
    if (result.ok && Array.isArray(result.result)) {
      // Добавляем флаг для медиагруппы
      result.result = {
        ...result.result[0],
        media_group_id: result.result[0].media_group_id
      };
    }
    
    return result;
  } catch (error) {
    console.error('Ошибка при отправке группы изображений:', error);
    return {
      ok: false,
      error: error.message
    };
  }
}

/**
 * Находит тестовые изображения в проекте
 * @returns {string[]} Массив путей к изображениям
 */
function findTestImages() {
  // Приоритетные директории для поиска
  const searchDirs = [
    './test-images',  // Добавляем директорию test-images в начало списка
    './uploads',
    './public/uploads',
    './public/images',
    './client/public/images',
    './assets',
    './attached_assets'
  ];
  
  console.log(`Поиск изображений в директориях: ${searchDirs.join(', ')}`);
  
  // Разрешенные расширения файлов
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  // Ищем существующую директорию
  let imagesDir = null;
  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const stat = fs.statSync(dir);
        if (stat.isDirectory()) {
          console.log(`Найдена директория с изображениями: ${dir}`);
          imagesDir = dir;
          break;
        }
      } catch (error) {
        // Игнорируем ошибки доступа
      }
    }
  }
  
  if (!imagesDir) {
    console.log(`${colors.red}Не найдено ни одной директории с изображениями${colors.reset}`);
    
    // Создаем тестовые изображения если нужно
    if (!fs.existsSync('./test-images')) {
      console.log(`Создаем директорию test-images для тестовых изображений`);
      fs.mkdirSync('./test-images', { recursive: true });
      
      // Создадим пустой файл README.md в этой директории
      fs.writeFileSync('./test-images/README.md', '# Тестовые изображения\n\nЭта директория содержит тестовые изображения для Telegram интеграции.');
    }
    
    // Используем изображения из attached_assets, которые были загружены в репозиторий
    console.log(`${colors.yellow}Попытка найти изображения в директории attached_assets...${colors.reset}`);
    const allFiles = fs.readdirSync('./attached_assets');
    console.log(`Найдено ${allFiles.length} файлов в attached_assets`);
    
    // Фильтруем только изображения
    const imagePaths = [];
    for (const file of allFiles) {
      const extension = path.extname(file).toLowerCase();
      if (allowedExtensions.includes(extension)) {
        const filePath = path.join('./attached_assets', file);
        const stat = fs.statSync(filePath);
        if (stat.isFile() && stat.size > 0) {
          console.log(`Найдено изображение: ${filePath}`);
          imagePaths.push(filePath);
        }
      }
    }
    
    // Ограничиваем количество найденных изображений
    return imagePaths.slice(0, 5);
  }
  
  // Ищем изображения
  try {
    const files = fs.readdirSync(imagesDir);
    const imagePaths = [];
    
    for (const file of files) {
      const extension = path.extname(file).toLowerCase();
      const filePath = path.join(imagesDir, file);
      
      if (allowedExtensions.includes(extension)) {
        // Проверяем, что это файл
        const stat = fs.statSync(filePath);
        if (stat.isFile() && stat.size > 0) {
          console.log(`Найдено изображение: ${filePath}`);
          imagePaths.push(filePath);
        }
      }
    }
    
    // Ограничиваем количество найденных изображений
    return imagePaths.slice(0, 5);
  } catch (error) {
    console.error(`Ошибка при поиске изображений в ${imagesDir}:`, error);
    return [];
  }
}

/**
 * Запускает тесты отправки одиночных изображений
 */
async function testSingleImage() {
  printHeader('Тест отправки одиночного изображения');
  
  const testImages = findTestImages();
  
  if (testImages.length === 0) {
    console.log(`${colors.red}Не найдены тестовые изображения${colors.reset}`);
    return false;
  }
  
  const testImagePath = testImages[0];
  console.log(`Найдено тестовое изображение: ${testImagePath}`);
  
  // Тест 1: Изображение без подписи
  const result1 = await sendImage(testImagePath);
  printResult('Изображение без подписи', result1.ok === true, result1);
  
  // Тест 2: Изображение с простой подписью
  const result2 = await sendImage(testImagePath, 'Тестовая подпись без форматирования');
  printResult('Изображение с простой подписью', result2.ok === true, result2);
  
  // Тест 3: Изображение с HTML-подписью
  const htmlCaption = '<b>Заголовок</b>\n\nОписание изображения с <i>форматированием</i> и <u>подчеркиванием</u>';
  const result3 = await sendImage(testImagePath, htmlCaption);
  printResult('Изображение с HTML-подписью', result3.ok === true, result3);
  
  return result1.ok === true && result2.ok === true && result3.ok === true;
}

/**
 * Запускает тесты отправки групп изображений
 */
async function testMediaGroup() {
  printHeader('Тест отправки группы изображений');
  
  const testImages = findTestImages();
  
  if (testImages.length < 2) {
    console.log(`${colors.red}Недостаточно тестовых изображений (нужно минимум 2)${colors.reset}`);
    return false;
  }
  
  // Используем первые 2-3 изображения
  const groupImages = testImages.slice(0, Math.min(3, testImages.length));
  console.log(`Найдено ${groupImages.length} изображений для тестирования группы`);
  
  // Тест 1: Группа изображений без подписи
  const result1 = await sendMediaGroup(groupImages);
  printResult('Группа изображений без подписи', result1.ok === true, result1);
  
  // Тест 2: Группа изображений с HTML-подписью
  const htmlCaption = '<b>Альбом изображений</b>\n\nГруппа из нескольких изображений с <i>форматированной</i> подписью';
  const result2 = await sendMediaGroup(groupImages, htmlCaption);
  printResult('Группа изображений с HTML-подписью', result2.ok === true, result2);
  
  return result1.ok === true && result2.ok === true;
}

/**
 * Запускает все тесты
 */
async function runAllTests() {
  try {
    printHeader('ТЕСТЫ ОТПРАВКИ ИЗОБРАЖЕНИЙ В TELEGRAM');
    
    console.log(`${colors.yellow}Проверка настроек...${colors.reset}`);
    
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      console.log(`${colors.red}Ошибка: Отсутствуют необходимые переменные окружения${colors.reset}`);
      console.log(`TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'Установлен' : 'Отсутствует'}`);
      console.log(`TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? 'Установлен' : 'Отсутствует'}`);
      return false;
    }
    
    let success = true;
    
    // Запуск тестов с одиночными изображениями
    const singleImageResult = await testSingleImage();
    success = success && singleImageResult;
    
    // Небольшая пауза между тестами
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Запуск тестов с группами изображений
    const mediaGroupResult = await testMediaGroup();
    success = success && mediaGroupResult;
    
    // Вывод общего результата
    printHeader('РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
    
    if (success) {
      console.log(`${colors.green}✓ Все тесты успешно пройдены${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Некоторые тесты не пройдены${colors.reset}`);
    }
    
    return success;
  } catch (error) {
    console.error(`${colors.red}Критическая ошибка при выполнении тестов:${colors.reset}`, error);
    return false;
  }
}

// Запускаем тесты
runAllTests();