/**
 * Тестовый модуль для проверки работы с FAL.AI API
 * Используется для отладки проблем с авторизацией и форматированием API ключа
 */

import axios from 'axios';
import { log } from '../utils/logger';

/**
 * Тестирует подключение к FAL.AI API с различными форматами ключа
 * @param apiKey Исходный API ключ
 * @returns Результаты тестирования
 */
export async function testFalApiConnection(apiKey: string): Promise<any> {
  if (!apiKey) {
    return {
      success: false,
      error: "API ключ не предоставлен",
      details: "Необходимо указать API ключ FAL.AI для тестирования"
    };
  }

  // Подробное логирование ключа (без вывода чувствительной информации)
  const keyInfo = {
    length: apiKey.length,
    hasPrefix: apiKey.startsWith('Key '),
    hasColon: apiKey.includes(':'),
    format: apiKey.startsWith('Key ') ? 'Key prefix' : 'No Key prefix'
  };
  
  log(`Testing FAL.AI API connection with key format: ${keyInfo.format}`, 'fal-tester');
  
  // Подготовка вариантов ключа для тестирования
  const keyVariants = prepareKeyVariants(apiKey);
  
  // Результаты тестирования для каждого варианта ключа
  const results = [];
  
  // Простой запрос для тестирования
  const requestData = {
    prompt: "Test image",
    negative_prompt: "",
    width: 512,
    height: 512,
    num_images: 1
  };
  
  // Проверяем каждый вариант форматирования ключа
  for (const variant of keyVariants) {
    try {
      log(`Testing FAL.AI API with key format: "${variant.description}"`, 'fal-tester');
      
      const response = await axios.post(
        'https://queue.fal.run/fal-ai/fast-sdxl',
        requestData,
        {
          headers: {
            'Authorization': variant.key,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000 // 10 секунд таймаут для тестов
        }
      );
      
      results.push({
        format: variant.description,
        success: true,
        status: response.status,
        data: typeof response.data === 'object' ? 
          Object.keys(response.data) : 
          'Non-object response'
      });
      
      log(`✅ Successful test for format: "${variant.description}"`, 'fal-tester');
    } catch (error: any) {
      // Логирование ошибки без вывода чувствительных данных
      const errorDetails = error.response ? {
        status: error.response.status,
        data: error.response.data
      } : {
        message: error.message
      };
      
      results.push({
        format: variant.description,
        success: false,
        error: errorDetails
      });
      
      log(`❌ Failed test for format: "${variant.description}"`, 'fal-tester');
    }
  }
  
  return {
    success: results.some(r => r.success),
    keyInfo,
    results
  };
}

/**
 * Подготавливает различные варианты форматирования API ключа
 * @param originalKey Исходный API ключ
 * @returns Массив вариантов ключа с описанием
 */
function prepareKeyVariants(originalKey: string): Array<{key: string, description: string}> {
  const variants = [];
  
  // Оригинальный ключ без изменений
  variants.push({
    key: originalKey,
    description: "Original (unchanged)"
  });
  
  // Если ключ не начинается с "Key ", добавляем вариант с префиксом
  if (!originalKey.startsWith('Key ')) {
    variants.push({
      key: `Key ${originalKey}`,
      description: "With 'Key ' prefix added"
    });
  }
  
  // Если ключ начинается с "Key ", добавляем вариант без префикса
  if (originalKey.startsWith('Key ')) {
    variants.push({
      key: originalKey.substring(4), // Удаляем "Key "
      description: "Without 'Key ' prefix"
    });
  }
  
  return variants;
}