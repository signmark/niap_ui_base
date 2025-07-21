/**
 * Instagram Session Manager
 * Управление сессиями Instagram для аутентификации
 */

import fs from 'fs';
import path from 'path';

class InstagramSessionManager {
  constructor() {
    this.sessionsDir = path.join(process.cwd(), 'temp');
    this.sessionsFile = path.join(this.sessionsDir, 'instagram-sessions.json');
    this.sessions = {};
    
    this.ensureSessionsDir();
    this.loadSessions();
    
    console.log('[Instagram Session Manager] Инициализирован');
  }

  /**
   * Создает директорию для сессий если её нет
   */
  ensureSessionsDir() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
      console.log('[Instagram Session Manager] Создана директория для сессий:', this.sessionsDir);
    }
  }

  /**
   * Загружает сессии из файла
   */
  loadSessions() {
    try {
      if (fs.existsSync(this.sessionsFile)) {
        const data = fs.readFileSync(this.sessionsFile, 'utf8');
        this.sessions = JSON.parse(data);
        
        const sessionCount = Object.keys(this.sessions).length;
        console.log(`[Instagram Session Manager] Загружено ${sessionCount} сессий из файла`);
        
        // Проверяем на устаревшие сессии (старше 7 дней)
        this.cleanupExpiredSessions();
      } else {
        console.log('[Instagram Session Manager] Файл сессий не найден, создаем новый');
      }
    } catch (error) {
      console.error('[Instagram Session Manager] Ошибка загрузки сессий:', error.message);
      this.sessions = {};
    }
  }

  /**
   * Сохраняет сессии в файл
   */
  saveSessions() {
    try {
      const data = JSON.stringify(this.sessions, null, 2);
      fs.writeFileSync(this.sessionsFile, data, 'utf8');
      
      const sessionCount = Object.keys(this.sessions).length;
      console.log(`[Instagram Session Manager] Сохранено ${sessionCount} сессий в файл`);
    } catch (error) {
      console.error('[Instagram Session Manager] Ошибка сохранения сессий:', error.message);
    }
  }

  /**
   * Удаляет устаревшие сессии (старше 7 дней)
   */
  cleanupExpiredSessions() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    Object.keys(this.sessions).forEach(username => {
      const session = this.sessions[username];
      if (session.createdAt < sevenDaysAgo) {
        delete this.sessions[username];
        removedCount++;
      }
    });

    if (removedCount > 0) {
      console.log(`[Instagram Session Manager] Удалено ${removedCount} устаревших сессий`);
      this.saveSessions();
    }
  }

  /**
   * Сохраняет сессию пользователя
   */
  saveSession(username, sessionData) {
    try {
      const sessionRecord = {
        ...sessionData,
        username: username,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        usageCount: 1
      };

      this.sessions[username] = sessionRecord;
      this.saveSessions();

      console.log(`[Instagram Session Manager] ✅ Сессия сохранена для ${username}`);
      console.log(`[Instagram Session Manager] User ID: ${sessionRecord.userId || 'неизвестен'}`);
      console.log(`[Instagram Session Manager] Session ID: ${sessionRecord.sessionId}`);
      console.log(`[Instagram Session Manager] CSRF Token: ${sessionRecord.csrfToken ? 'есть' : 'отсутствует'}`);
      console.log(`[Instagram Session Manager] Cookies: ${sessionRecord.cookies ? 'есть' : 'отсутствуют'}`);

      return true;
    } catch (error) {
      console.error(`[Instagram Session Manager] ❌ Ошибка сохранения сессии для ${username}:`, error.message);
      return false;
    }
  }

  /**
   * Получает сессию пользователя
   */
  getSession(username) {
    const session = this.sessions[username];
    
    if (!session) {
      console.log(`[Instagram Session Manager] Сессия для ${username} не найдена`);
      return null;
    }

    // Обновляем время последнего использования
    session.lastUsed = Date.now();
    session.usageCount = (session.usageCount || 0) + 1;
    this.saveSessions();

    console.log(`[Instagram Session Manager] ✅ Сессия для ${username} найдена`);
    console.log(`[Instagram Session Manager] Последнее использование: ${new Date(session.lastUsed).toLocaleString()}`);
    console.log(`[Instagram Session Manager] Количество использований: ${session.usageCount}`);

    return session;
  }

  /**
   * Проверяет валидность сессии
   */
  isSessionValid(username) {
    const session = this.sessions[username];
    
    if (!session) {
      return false;
    }

    // Проверяем возраст сессии (не старше 7 дней)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    if (session.createdAt < sevenDaysAgo) {
      console.log(`[Instagram Session Manager] Сессия для ${username} устарела`);
      delete this.sessions[username];
      this.saveSessions();
      return false;
    }

    // Проверяем наличие необходимых данных для ручного ввода
    if (!session.authenticated || !session.csrfToken) {
      console.log(`[Instagram Session Manager] Сессия для ${username} неполная`);
      return false;
    }
    
    // Для ручного ввода (manual_input) cookies не обязательны
    if (session.source !== 'manual_input' && !session.cookies) {
      console.log(`[Instagram Session Manager] Сессия для ${username} неполная (нет cookies)`);
      return false;
    }

    return true;
  }

  /**
   * Удаляет сессию пользователя
   */
  removeSession(username) {
    if (this.sessions[username]) {
      delete this.sessions[username];
      this.saveSessions();
      console.log(`[Instagram Session Manager] Сессия для ${username} удалена`);
      return true;
    }
    
    console.log(`[Instagram Session Manager] Сессия для ${username} не найдена для удаления`);
    return false;
  }

  /**
   * Получает список всех сохраненных сессий
   */
  getAllSessions() {
    const sessionList = Object.keys(this.sessions).map(username => {
      const session = this.sessions[username];
      return {
        username: username,
        userId: session.userId,
        createdAt: new Date(session.createdAt).toLocaleString(),
        lastUsed: new Date(session.lastUsed).toLocaleString(),
        usageCount: session.usageCount || 0,
        isValid: this.isSessionValid(username)
      };
    });

    console.log(`[Instagram Session Manager] Список сессий (${sessionList.length}):`);
    sessionList.forEach(session => {
      console.log(`  - ${session.username}: ${session.isValid ? '✅ валидна' : '❌ невалидна'}`);
    });

    return sessionList;
  }

  /**
   * Очищает все сессии
   */
  clearAllSessions() {
    const count = Object.keys(this.sessions).length;
    this.sessions = {};
    this.saveSessions();
    
    console.log(`[Instagram Session Manager] Очищено ${count} сессий`);
    return count;
  }

  /**
   * Проверяет наличие валидной сессии
   */
  hasValidSession(username) {
    console.log(`[Instagram Session Manager] 🔍 Проверка валидной сессии для ${username}`);
    
    const isValid = this.isSessionValid(username);
    console.log(`[Instagram Session Manager] Результат проверки для ${username}: ${isValid ? '✅ валидна' : '❌ невалидна'}`);
    
    return isValid;
  }

  /**
   * Загружает сессию для Instagram клиента (поддержка старого API)
   */
  async loadSession(username, igClient) {
    console.log(`[Instagram Session Manager] 📥 Загрузка сессии для ${username}`);
    
    const session = this.getSession(username);
    if (!session) {
      console.log(`[Instagram Session Manager] ❌ Сессия для ${username} не найдена`);
      return null;
    }

    if (!this.isSessionValid(username)) {
      console.log(`[Instagram Session Manager] ❌ Сессия для ${username} невалидна`);
      return null;
    }

    console.log(`[Instagram Session Manager] ✅ Сессия для ${username} загружена и валидна`);
    return session;
  }
}

const instagramSessionManager = new InstagramSessionManager();
export { instagramSessionManager };