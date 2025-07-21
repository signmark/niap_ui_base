const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Создает изображение Stories с текстом на цветном фоне через Python скрипт
 */
async function createStoriesImage(text, backgroundColor = '#6366f1', textColor = '#FFFFFF') {
  try {
    console.log(`[Image Generator] Создаем изображение для Stories: "${text}"`);
    
    // Создаем временное имя файла
    const timestamp = Date.now();
    const tempFileName = `stories_${timestamp}_${Math.random().toString(36).slice(2)}.jpg`;
    const tempPath = path.join(__dirname, '..', 'temp', tempFileName);
    const pythonScriptPath = path.join(__dirname, 'generate_image.py');
    
    // Создаем папку temp если её нет
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log(`[Image Generator] Вызываем Python скрипт: ${pythonScriptPath}`);
    console.log(`[Image Generator] Параметры: text="${text}", bg="${backgroundColor}", text="${textColor}"`);
    
    // Экранируем кавычки и спецсимволы для shell
    const escapedText = text.replace(/'/g, "'\"'\"'");
    
    // Вызываем Python скрипт
    const command = `python3 "${pythonScriptPath}" '${escapedText}' --bg-color "${backgroundColor}" --text-color "${textColor}" --output "${tempPath}"`;
    
    console.log(`[Image Generator] Выполняем команду: ${command}`);
    
    const result = execSync(command, { 
      encoding: 'utf8',
      timeout: 30000 
    });
    
    console.log(`[Image Generator] Результат Python скрипта: ${result.trim()}`);
    
    // Проверяем что файл создался
    if (!fs.existsSync(tempPath)) {
      throw new Error(`Файл изображения не создан: ${tempPath}`);
    }
    
    // Читаем созданное изображение
    const imageBuffer = fs.readFileSync(tempPath);
    
    console.log(`[Image Generator] Изображение создано: ${imageBuffer.length} байт`);
    
    // Удаляем временный файл
    try {
      fs.unlinkSync(tempPath);
    } catch (cleanupError) {
      console.warn(`[Image Generator] Не удалось удалить временный файл: ${cleanupError.message}`);
    }
    
    return imageBuffer;
    
  } catch (error) {
    console.error(`[Image Generator] Ошибка создания изображения через Python:`, error);
    
    // Fallback: создаем простейший JPEG
    console.log(`[Image Generator] Используем fallback - простой JPEG`);
    
    // Простейший валидный JPEG файл 1x1 пиксель
    const simpleJpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
      0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
      0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0xAA, 0xFF, 0xD9
    ]);
    
    return simpleJpeg;
  }
}

/**
 * Сохраняет изображение во временный файл
 */
function saveImageToTempFile(imageBuffer, filename) {
  try {
    const tempDir = path.join(__dirname, '../../temp');
    
    // Создаем папку temp если не существует
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, imageBuffer);
    
    console.log(`[Image Generator] Изображение сохранено: ${filePath}`);
    return filePath;
    
  } catch (error) {
    console.error(`[Image Generator] Ошибка сохранения файла:`, error);
    throw error;
  }
}

module.exports = {
  createStoriesImage,
  saveImageToTempFile
};