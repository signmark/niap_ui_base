/**
 * Централизованная инициализация патчей для различных модулей приложения
 * Этот файл загружает и применяет все необходимые патчи при запуске сервера
 */

import { log } from '../utils/logger.js';

/**
 * Инициализирует и применяет все патчи для приложения
 */
export async function initializePatches() {
  log('Инициализация патчей системы...', 'patches');
  
  try {
    // Применяем патч для улучшенного форматирования HTML в Telegram
    const telegramPatchResult = await initializeTelegramPatch();
    log(`Патч Telegram: ${telegramPatchResult ? 'успешно' : 'не применен'}`, 'patches');
    
    // Здесь можно добавить другие патчи в будущем
    
    log('Все патчи успешно инициализированы', 'patches');
    return true;
  } catch (error) {
    log(`Ошибка при инициализации патчей: ${error.message}`, 'patches');
    console.error(error);
    return false;
  }
}

/**
 * Инициализирует патч для улучшенного форматирования HTML в Telegram
 */
async function initializeTelegramPatch() {
  try {
    // Импортируем патч динамически, чтобы избежать проблем с циклическими зависимостями
    const telegramPatch = await import('../services/social-publishing-patch.js');
    
    // Проверяем результат применения патча
    if (telegramPatch.applyTelegramPatch) {
      return true;
    }
    
    return false;
  } catch (error) {
    log(`Ошибка при инициализации патча Telegram: ${error.message}`, 'patches');
    console.error(error);
    return false;
  }
}

// Экспортируем для возможного прямого импорта
export { initializeTelegramPatch };