/**
 * Модуль инициализации патчей системы
 * 
 * Централизованный модуль для инициализации и применения
 * всех необходимых патчей к системе
 */

import { log } from '../utils/logger.js';
import { applyPatches as applySocialPublishingPatches } from '../services/social-publishing-patch.js';

// Флаг применения патчей
let patchesInitialized = false;

/**
 * Инициализирует и применяет все патчи системы
 * @returns {Promise<boolean>} Результат инициализации патчей
 */
export async function initializePatches() {
  if (patchesInitialized) {
    log.debug('Патчи уже были инициализированы', 'PatchManager');
    return true;
  }
  
  log.debug('Начало инициализации патчей системы', 'PatchManager');
  
  try {
    // Применяем патч для системы публикации в социальные сети
    const socialPublishingPatchResult = await applySocialPublishingPatches();
    
    if (socialPublishingPatchResult) {
      log.debug('Патч для системы публикации в социальные сети успешно применен', 'PatchManager');
    } else {
      log.error('Не удалось применить патч для системы публикации в социальные сети', null, 'PatchManager');
      return false;
    }
    
    // Здесь можно добавить инициализацию других патчей по мере необходимости
    
    // Устанавливаем флаг применения патчей
    patchesInitialized = true;
    
    log.debug('Все патчи успешно инициализированы', 'PatchManager');
    return true;
  } catch (error) {
    log.error(`Ошибка при инициализации патчей: ${error.message}`, error, 'PatchManager');
    return false;
  }
}