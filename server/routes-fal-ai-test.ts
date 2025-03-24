import { Express, Request, Response } from "express";
import axios from "axios";
import { apiKeyService } from './services/api-keys';
import { falAiClient } from './services/fal-ai-client';
import { log } from "./utils/logger";

export function registerFalAiTestRoutes(app: Express) {
  // Маршрут для проверки API ключа FAL.AI (простая версия)
  app.get('/api/test-fal-ai', async (req: Request, res: Response) => {
    try {
      // Получаем userId из запроса
      const authHeader = req.headers['authorization'];
      let userId = null;
      let token = null;
      
      // Если есть авторизация, получаем userId из токена
      if (authHeader) {
        token = authHeader.replace('Bearer ', '');
        try {
          const userResponse = await axios.get('https://directus.nplanner.ru/users/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          userId = userResponse?.data?.data?.id;
        } catch (error) {
          console.error("Ошибка при получении информации о пользователе:", error);
        }
      }
      
      // Получаем API ключ из сервиса ключей
      const apiKey = await apiKeyService.getApiKey(userId || '53921f16-f51d-4591-80b9-8caa4fde4d13', 'fal_ai', token || undefined);
      
      if (!apiKey) {
        return res.status(404).json({
          success: false,
          error: "API ключ FAL.AI не найден. Пожалуйста, добавьте его в настройки."
        });
      }
      
      log(`Тестирование API ключа FAL.AI: ${apiKey.substring(0, 10)}...`);
      
      // Правильно форматируем ключ - сначала удаляем префикс "Key " если он есть
      // И очищаем от возможных пробелов, переносов строк и других лишних символов
      let rawKey = apiKey.startsWith('Key ') ? apiKey.substring(4) : apiKey;
      rawKey = rawKey.trim(); // Удаляем лишние пробелы в начале и конце
      
      // Затем проверяем форматирование самого ключа
      log(`Проверка формата ключа: длина=${rawKey.length}, содержит двоеточие=${rawKey.includes(':')}`);
      
      // Попробуем сначала без префикса "Key "
      try {
        log(`Пробуем запрос без префикса "Key "`);
        const response = await axios.post('https://queue.fal.run/fal-ai/fast-sdxl', {
          prompt: "Test image", // Минимальный запрос
          width: 512,
          height: 512
        }, {
          headers: {
            Authorization: rawKey,
            'Content-Type': 'application/json'
          }
        });
        
        // Если запрос успешен, возвращаем положительный результат
        if (response.data) {
          return res.json({
            success: true,
            message: "API ключ FAL.AI работает корректно (без префикса 'Key')",
            key_format: "raw",
            status: "active"
          });
        }
      } catch (error) {
        log(`Запрос без префикса "Key " не сработал, пробуем с префиксом`);
      }
      
      // Если первый способ не сработал, пробуем с префиксом "Key "
      const formattedKey = `Key ${rawKey}`;
      
      // Делаем тестовый запрос к FAL.AI API с префиксом Key
      const response = await axios.post('https://queue.fal.run/fal-ai/fast-sdxl', {
        prompt: "Test image", // Минимальный запрос
        width: 512,
        height: 512
      }, {
        headers: {
          Authorization: formattedKey,
          'Content-Type': 'application/json'
        }
      });
      
      // Если запрос успешен, возвращаем положительный результат
      if (response.data) {
        return res.json({
          success: true,
          message: "API ключ FAL.AI работает корректно",
          key_format: "valid",
          status: "active"
        });
      }
      
      return res.status(500).json({
        success: false,
        error: "Неожиданная ошибка при запросе к FAL.AI API",
        details: "Успешный запрос, но неверный формат ответа"
      });
      
    } catch (error: any) {
      console.error("Ошибка при тестировании API ключа FAL.AI:", error.message);
      
      // Извлекаем детали ошибки для диагностики
      const errorDetails = error.response 
        ? {
            status: error.response.status,
            data: error.response.data
          } 
        : {
            message: error.message
          };
      
      return res.status(500).json({
        success: false,
        error: "Ошибка при тестировании API ключа FAL.AI",
        details: errorDetails,
        message: error.message
      });
    }
  });
}