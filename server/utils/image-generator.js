const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

/**
 * Создает изображение Stories с текстом на цветном фоне
 */
function createStoriesImage(text, backgroundColor = '#6366f1', textColor = '#FFFFFF') {
  try {
    console.log(`[Image Generator] Создаем изображение для Stories: "${text}"`);
    
    // Размеры для Instagram Stories (9:16)
    const width = 1080;
    const height = 1920;
    
    // Создаем canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Заливаем фон цветом
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    
    // Настраиваем текст
    ctx.fillStyle = textColor;
    ctx.font = 'bold 120px Arial'; // Крупный шрифт для Stories
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Рисуем текст по центру
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.fillText(text, centerX, centerY);
    
    // Возвращаем buffer изображения
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    
    console.log(`[Image Generator] Изображение создано: ${buffer.length} байт`);
    return buffer;
    
  } catch (error) {
    console.error(`[Image Generator] Ошибка создания изображения:`, error);
    throw error;
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