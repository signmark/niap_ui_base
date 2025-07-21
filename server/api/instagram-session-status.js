/**
 * Instagram Session Status API
 * Показывает статус сохраненных сессий Instagram
 */

const sessionManager = require('../services/instagram-session-manager');

module.exports = function(app) {
  // Статус всех сессий
  app.get('/api/instagram-direct/sessions', (req, res) => {
    try {
      const sessionsInfo = sessionManager.getSessionsInfo();
      
      res.json({
        success: true,
        ...sessionsInfo,
        message: `Найдено ${sessionsInfo.memoryCount} сессий в памяти, ${sessionsInfo.fileCount} файлов`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Ошибка получения статуса сессий',
        details: error.message
      });
    }
  });

  // Проверка конкретной сессии
  app.get('/api/instagram-direct/sessions/:username', (req, res) => {
    try {
      const { username } = req.params;
      const hasValidSession = sessionManager.hasValidSession(username);
      
      res.json({
        success: true,
        username: username,
        hasValidSession: hasValidSession,
        message: hasValidSession ? 'Сессия найдена и валидна' : 'Валидная сессия не найдена'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Ошибка проверки сессии',
        details: error.message
      });
    }
  });

  // Удаление сессии
  app.delete('/api/instagram-direct/sessions/:username', (req, res) => {
    try {
      const { username } = req.params;
      sessionManager.deleteSession(username);
      
      res.json({
        success: true,
        message: `Сессия для ${username} удалена`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Ошибка удаления сессии',
        details: error.message
      });
    }
  });
  
  console.log('[Instagram Session Status API] Маршруты зарегистрированы');
};