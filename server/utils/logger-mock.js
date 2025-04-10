/**
 * Мок функции логирования для тестирования
 * @param {string} message Сообщение для логирования
 * @param {string} [level='info'] Уровень логирования
 * @return {void}
 */
export function log(message, module = 'app') {
  console.log(`[MOCK-LOG][${module}] ${message}`);
}