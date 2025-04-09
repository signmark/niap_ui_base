/**
 * Прямое тестирование отправки изображений и текста в Telegram
 */

import { telegramService } from './server/services/social/telegram-service.js';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Проверяем наличие необходимых переменных окружения
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
  console.error('⚠️ Необходимо установить переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  process.exit(1);
}

const testCases = [
  {
    name: 'Одиночное изображение с кратким текстом',
    image: './attached_assets/image_1741794281561.png',
    text: '<b>Тестовая подпись</b> для изображения с <i>форматированием</i>'
  },
  {
    name: 'Одиночное изображение с длинным текстом (более 1000 символов)',
    image: './attached_assets/image_1741793506570.png',
    text: '<p>' + 'Это очень длинный текст. '.repeat(50) + '</p><p><b>Жирный текст</b> и <i>курсив</i></p><ul><li>Пункт списка 1</li><li>Пункт списка 2</li></ul>'
  },
  {
    name: 'Несколько изображений (группа) с подписью',
    images: [
      './attached_assets/image_1741794281561.png',
      './attached_assets/image_1741793506570.png'
    ],
    text: '<b>Группа изображений</b> с <i>форматированным</i> текстом'
  }
];

/**
 * Отправляет одиночное изображение с текстом в Telegram
 * @param {string} imagePath Путь к изображению
 * @param {string} caption Текстовая подпись
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithText(imagePath, caption) {
  try {
    // Проверяем существование файла
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Файл изображения не найден: ${imagePath}`);
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Инициализируем сервис
    telegramService.initialize(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_CHAT_ID
    );
    
    // Форматируем текст
    const formattedCaption = telegramService.standardizeTelegramTags(caption);
    
    // Отправляем изображение с текстом
    return await telegramService.sendImage(imageBuffer, formattedCaption);
    
  } catch (error) {
    console.error('Ошибка при отправке изображения с текстом:', error);
    throw error;
  }
}

/**
 * Отправляет группу изображений с текстом в Telegram
 * @param {string[]} imagePaths Массив путей к изображениям
 * @param {string} caption Текстовая подпись (будет добавлена к первому изображению)
 * @returns {Promise<object>} Результат отправки
 */
async function sendImagesGroupWithText(imagePaths, caption) {
  try {
    // Проверяем существование файлов
    for (const imagePath of imagePaths) {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Файл изображения не найден: ${imagePath}`);
      }
    }
    
    // Формируем массив буферов
    const imageBuffers = imagePaths.map(path => fs.readFileSync(path));
    
    // Инициализируем сервис
    telegramService.initialize(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_CHAT_ID
    );
    
    // Форматируем текст
    const formattedCaption = telegramService.standardizeTelegramTags(caption);
    
    // Отправляем группу изображений с текстом
    return await telegramService.sendMediaGroup(imageBuffers, formattedCaption);
    
  } catch (error) {
    console.error('Ошибка при отправке группы изображений с текстом:', error);
    throw error;
  }
}

/**
 * Отправляет длинный текст с изображением в Telegram
 * @param {string} imagePath Путь к изображению
 * @param {string} text Длинный текст
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithLongText(imagePath, text) {
  try {
    // Проверяем существование файла
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Файл изображения не найден: ${imagePath}`);
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Инициализируем сервис
    telegramService.initialize(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_CHAT_ID
    );
    
    // Форматируем текст
    const formattedText = telegramService.standardizeTelegramTags(text);
    
    // Отправляем изображение без подписи
    const imageResult = await telegramService.sendImage(imageBuffer);
    
    // Отправляем текст отдельно
    const textResult = await telegramService.sendTextMessage(formattedText);
    
    return {
      imageMessage: imageResult,
      textMessage: textResult
    };
    
  } catch (error) {
    console.error('Ошибка при отправке изображения с длинным текстом:', error);
    throw error;
  }
}

/**
 * Запускает все тесты
 */
async function runTests() {
  console.log('='.repeat(80));
  console.log('ТЕСТИРОВАНИЕ ОТПРАВКИ ИЗОБРАЖЕНИЙ И ТЕКСТА В TELEGRAM');
  console.log('='.repeat(80));
  console.log();

  for (const [index, testCase] of testCases.entries()) {
    console.log(`Тест #${index + 1}: ${testCase.name}`);
    
    try {
      let result;
      
      // Определяем тип теста и выполняем соответствующую операцию
      if (testCase.images) {
        // Тест с группой изображений
        console.log(`Отправка ${testCase.images.length} изображений с подписью`);
        result = await sendImagesGroupWithText(testCase.images, testCase.text);
      } else if (testCase.text.length > 1000) {
        // Тест с длинным текстом
        console.log('Отправка изображения с длинным текстом (раздельно)');
        result = await sendImageWithLongText(testCase.image, testCase.text);
      } else {
        // Тест с одиночным изображением и коротким текстом
        console.log('Отправка изображения с коротким текстом (в подписи)');
        result = await sendImageWithText(testCase.image, testCase.text);
      }
      
      console.log('Результат:', JSON.stringify(result, null, 2));
      console.log('✅ Успешно отправлено');
      
    } catch (error) {
      console.log(`❌ Ошибка: ${error.message}`);
    }
    
    console.log('-'.repeat(80));
    
    // Пауза между тестами
    if (index < testCases.length - 1) {
      console.log('Пауза перед следующим тестом...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Запуск тестов
runTests().catch(error => {
  console.error('Ошибка при выполнении тестов:', error);
  process.exit(1);
});