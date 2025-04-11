/**
 * Тест для проверки конкретной preview модели Gemini
 * Запуск: node test-preview-model.js
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// API ключ
const API_KEY = 'AIzaSyDaYtWfHwI9vq3kTatny217HnbKauAvdxE';

// Модель для тестирования
const MODEL = 'gemini-2.5-pro-preview-03-25';

// Тестовый текст
const TEST_TEXT = "Пример текста для улучшения с помощью модели Gemini. Это тестовый текст, который нужно сделать лучше.";

async function testPreviewModel() {
  try {
    console.log(`Тестирование preview модели: ${MODEL}`);
    
    // Настраиваем клиента для v1beta API
    const apiConfig = { apiOptions: { apiVersion: 'v1beta' } };
    
    // Создаем клиент с указанной версией API
    const genAI = new GoogleGenerativeAI(API_KEY, apiConfig);
    
    console.log(`Создан клиент для API v1beta`);
    
    // Получаем модель
    const geminiModel = genAI.getGenerativeModel({ model: MODEL });
    
    console.log(`Получена модель, отправляем запрос...`);
    
    // Создаем простой запрос
    const prompt = `Улучши этот текст, сделай его более профессиональным
    
    Исходный текст:
    """${TEST_TEXT}"""`;
    
    // Измеряем время выполнения
    const startTime = Date.now();
    
    // Генерируем контент
    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const improvedText = response.text();
    
    // Рассчитываем время выполнения
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`\n✓ УСПЕХ! Время выполнения: ${executionTime}мс\n`);
    console.log(`Полный результат:`);
    console.log(`--------------------------------------------------`);
    console.log(improvedText);
    console.log(`--------------------------------------------------`);
    
    return {
      success: true,
      model: MODEL,
      executionTime,
      text: improvedText
    };
  } catch (error) {
    console.log(`\n✗ ОШИБКА: ${error.message}`);
    console.log(`Полная ошибка:`, error);
    
    return {
      success: false,
      model: MODEL,
      error: error.message
    };
  }
}

// Запускаем тест
console.log("=== ТЕСТИРОВАНИЕ PREVIEW МОДЕЛИ GEMINI ===");
testPreviewModel()
  .then(result => {
    if (result.success) {
      console.log("\n=== ТЕСТИРОВАНИЕ УСПЕШНО ЗАВЕРШЕНО ===");
    } else {
      console.log("\n=== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО С ОШИБКОЙ ===");
    }
  })
  .catch(error => {
    console.log("\n=== НЕПРЕДВИДЕННАЯ ОШИБКА ===");
    console.error(error);
  });