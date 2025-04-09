/**
 * Патч для системы публикации в социальные сети
 * 
 * Этот модуль применяет патч к существующей системе публикации,
 * заменяя оригинальную функцию публикации в Telegram на новую
 * через адаптер, что обеспечивает правильную работу с HTML-форматированием.
 */

import { log } from '../utils/logger.js';
import { telegramServiceAdapter } from './telegram-service-adapter.js';

// Переменные для хранения состояния патча
let patchApplied = false;
let patchResult = false;

/**
 * Применяет патч к системе публикации в социальные сети
 * @returns {boolean} Результат применения патча
 */
async function applyPatches() {
  // Если патч уже применен, выходим
  if (patchApplied) {
    log.debug('Патч для системы публикации уже применен', 'SocialPublishingPatch');
    return patchResult;
  }
  
  try {
    log.debug('Применение патча для системы публикации в социальные сети...', 'SocialPublishingPatch');
    
    // Находим модуль управления публикациями
    let socialPublishingSystem;
    try {
      // Импортируем модуль публикации в социальные сети
      socialPublishingSystem = await import('./social-publishing-with-imgur.js');
      log.debug('Модуль социального паблишинга успешно импортирован', 'SocialPublishingPatch');
    } catch (error) {
      log.error(`Не удалось импортировать модуль социального паблишинга: ${error.message}`, error, 'SocialPublishingPatch');
      return false;
    }
    
    // Проверяем, есть ли функция publishToTelegram в модуле
    if (!socialPublishingSystem.publishToTelegram) {
      log.error('Не найдена функция publishToTelegram в модуле социального паблишинга', null, 'SocialPublishingPatch');
      return false;
    }
    
    // Сохраняем оригинальную функцию
    const originalPublishToTelegram = socialPublishingSystem.publishToTelegram;
    
    // Заменяем функцию на нашу реализацию через адаптер
    socialPublishingSystem.publishToTelegram = async function patchedPublishToTelegram(content, telegramSettings) {
      log.debug('Вызвана патч-функция для публикации в Telegram', 'SocialPublishingPatch');
      
      // Делегируем вызов адаптеру
      return await telegramServiceAdapter.publishToTelegram(content, telegramSettings);
    };
    
    log.debug('Патч для системы публикации в социальные сети успешно применен', 'SocialPublishingPatch');
    patchApplied = true;
    patchResult = true;
    
    return true;
  } catch (error) {
    log.error(`Ошибка при применении патча для системы публикации: ${error.message}`, error, 'SocialPublishingPatch');
    patchApplied = true;
    patchResult = false;
    
    return false;
  }
}

export {
  applyPatches,
  patchResult
};