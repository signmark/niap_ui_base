/**
 * Скрипт для тестирования различных моделей Gemini
 * Запуск: node test-gemini-models.js
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// API ключ, который нам предоставил пользователь
const API_KEY = 'AIzaSyDaYtWfHwI9vq3kTatny217HnbKauAvdxE';

// Текст для улучшения в тестах
const TEST_TEXT = "Пример текста для улучшения с помощью модели Gemini. Это тестовый текст, который нужно сделать лучше.";

// Список моделей для тестирования
const MODELS_TO_TEST = [
  // Стабильная модель для сравнения
  'gemini-1.5-pro',           // Стабильная
  
  // Экспериментальные и бета модели, которые самые важные для тестирования
  'gemini-2.5-pro-preview-03-25', // Preview
  'gemini-2.5-pro-exp-03-25',    // Экспериментальная
];

/**
 * Функция для проверки улучшения текста с определенной моделью
 * @param {string} model Модель для тестирования
 * @returns {Promise<object>} Результат тестирования
 */
async function testModelImproveText(model) {
  try {
    console.log(`\n=== Тестирование модели: ${model} ===`);
    
    // Используем уже импортированный GoogleGenerativeAI
    
    // Определяем нужную версию API в зависимости от модели
    const isExperimental = model.includes('exp') || 
                           model.includes('preview') || 
                           model.includes('latest') ||
                           model === 'gemini-2.0-flash-live-001';
    
    const apiVersion = isExperimental ? 'v1beta' : 'v1';
    console.log(`Используем API версию: ${apiVersion}`);
    
    // Создаем клиент с нужной версией API
    const apiConfig = apiVersion === 'v1beta' 
      ? { apiOptions: { apiVersion: 'v1beta' } } 
      : undefined;
    
    // @ts-ignore - Игнорируем ошибку типов, так как библиотека поддерживает второй параметр
    const genAI = new GoogleGenerativeAI(API_KEY, apiConfig);
    
    try {
      // Пробуем использовать модель напрямую
      console.log(`Прямой запрос к модели ${model} с API ${apiVersion}...`);
      
      const geminiModel = genAI.getGenerativeModel({ model });
      
      // Создаем простой запрос
      const prompt = `Улучши этот текст, сделай его более профессиональным
      
      Исходный текст:
      """${TEST_TEXT}"""`;
      
      // Засекаем время
      const startTime = Date.now();
      
      // Генерируем контент
      const result = await geminiModel.generateContent(prompt);
      const response = result.response;
      const improvedText = response.text();
      
      // Вычисляем время выполнения
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Выводим результат
      console.log(`✓ УСПЕХ (${executionTime}мс)`);
      console.log(`Результат: ${improvedText.substring(0, 100)}...`);
      
      return {
        model,
        success: true,
        apiVersion,
        executionTime,
        text: improvedText
      };
    } catch (modelError) {
      console.log(`✗ ОШИБКА: ${modelError.message}`);
      console.log('Пробуем fallback на стабильную модель...');
      
      // Пробуем использовать fallback на стабильную модель
      const fallbackModel = 'gemini-1.5-pro';
      const fallbackGenAI = new GoogleGenerativeAI(API_KEY);
      const fallbackGeminiModel = fallbackGenAI.getGenerativeModel({ model: fallbackModel });
      
      const prompt = `Улучши этот текст, сделай его более профессиональным
      
      Исходный текст:
      """${TEST_TEXT}"""`;
      
      try {
        // Засекаем время
        const startTime = Date.now();
        
        // Генерируем контент с fallback моделью
        const fallbackResult = await fallbackGeminiModel.generateContent(prompt);
        const fallbackResponse = fallbackResult.response;
        const fallbackImprovedText = fallbackResponse.text();
        
        // Вычисляем время выполнения
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        console.log(`✓ FALLBACK УСПЕХ (${executionTime}мс)`);
        console.log(`Результат (fallback): ${fallbackImprovedText.substring(0, 100)}...`);
        
        return {
          model,
          originalError: modelError.message,
          success: true,
          fallback: true,
          fallbackModel,
          executionTime,
          text: fallbackImprovedText
        };
      } catch (fallbackError) {
        console.log(`✗ FALLBACK ОШИБКА: ${fallbackError.message}`);
        
        return {
          model,
          success: false,
          error: modelError.message,
          fallbackError: fallbackError.message
        };
      }
    }
  } catch (error) {
    console.log(`✗ ОБЩАЯ ОШИБКА: ${error.message}`);
    
    return {
      model,
      success: false,
      error: error.message
    };
  }
}

/**
 * Главная функция для запуска всех тестов
 */
async function runAllTests() {
  console.log("=== НАЧИНАЕМ ТЕСТИРОВАНИЕ МОДЕЛЕЙ GEMINI ===");
  console.log(`Всего моделей для тестирования: ${MODELS_TO_TEST.length}`);
  
  const results = [];
  
  for (const model of MODELS_TO_TEST) {
    const result = await testModelImproveText(model);
    results.push(result);
  }
  
  // Выводим итоговые результаты
  console.log("\n=== ИТОГОВЫЕ РЕЗУЛЬТАТЫ ===");
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const withFallback = results.filter(r => r.fallback);
  
  console.log(`Успешно: ${successful.length}/${MODELS_TO_TEST.length}`);
  console.log(`Через fallback: ${withFallback.length}/${MODELS_TO_TEST.length}`);
  console.log(`Не удалось: ${failed.length}/${MODELS_TO_TEST.length}`);
  
  console.log("\nУспешные модели:");
  successful.filter(r => !r.fallback).forEach(r => {
    console.log(`- ${r.model} (${r.apiVersion}): ${r.executionTime}мс`);
  });
  
  console.log("\nМодели с fallback:");
  withFallback.forEach(r => {
    console.log(`- ${r.model}: Ошибка "${r.originalError}"`);
  });
  
  console.log("\nНеудачные модели:");
  failed.forEach(r => {
    console.log(`- ${r.model}: ${r.error}`);
  });
}

// Запускаем тесты
runAllTests().catch(console.error);