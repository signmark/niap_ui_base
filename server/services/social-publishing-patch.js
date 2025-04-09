/**
 * Патч для системы публикации контента в социальные сети
 * 
 * Этот файл заменяет оригинальную функцию публикации в Telegram
 * на новую, исправленную версию, которая корректно обрабатывает HTML-форматирование.
 */

import { publishToTelegram } from './telegram-service-adapter.js';
import { log } from '../utils/logger.js';

/**
 * Применяет патч для функции публикации в Telegram
 * @param {number} delay Задержка перед применением патча в миллисекундах
 */
export function applyTelegramPatch(delay = 5000) {
  // Откладываем применение патча, чтобы основной код приложения успел загрузиться
  setTimeout(() => {
    try {
      // Получаем модуль социальных публикаций
      const socialPublishingPath = './social-publishing-with-imgur.js';
      
      import(socialPublishingPath)
        .then(socialPublishingModule => {
          // Сохраняем оригинальную функцию для отладки
          const originalPublishToTelegram = socialPublishingModule.publishToTelegram;
          
          // Информация о патче
          log('Применение патча для функции публикации в Telegram...', 'telegram-patch');
          
          // Заменяем оригинальную функцию на нашу новую реализацию
          if (typeof socialPublishingModule.publishToTelegram === 'function') {
            // В случае прямого экспорта функции
            socialPublishingModule.publishToTelegram = publishToTelegram;
            
            log('Патч успешно применен к функции publishToTelegram', 'telegram-patch');
          } else if (socialPublishingModule.default && typeof socialPublishingModule.default.publishToTelegram === 'function') {
            // В случае экспорта по умолчанию
            socialPublishingModule.default.publishToTelegram = publishToTelegram;
            
            log('Патч успешно применен к функции default.publishToTelegram', 'telegram-patch');
          } else {
            // Не удалось найти функцию
            log('Не удалось найти функцию publishToTelegram для патча', 'telegram-patch');
          }
        })
        .catch(error => {
          log(`Ошибка при применении патча: ${error.message}`, 'telegram-patch');
        });
    } catch (error) {
      log(`Исключение при применении патча: ${error.message}`, 'telegram-patch');
    }
  }, delay);
}

export const telegramPatchApplied = true;