/**
 * Instagram Session Manager
 * Сохраняет и переиспользует Instagram сессии для избежания повторных checkpoint challenges
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class InstagramSessionManager {
  constructor() {
    this.sessionsDir = path.join(__dirname, '../sessions');
    this.sessions = new Map();
    
    // Создаем директорию для сессий если не существует
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    
    console.log('[Instagram Session Manager] Инициализация менеджера сессий');
    
    // Загружаем сохраненные сессии
    this.loadSavedSessions();
    
    // Автоочистка каждые 30 минут
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 30 * 60 * 1000);
  }

  /**
   * Создает ключ сессии для пользователя
   */
  createSessionKey(username) {
    return crypto.createHash('md5').update(username).digest('hex');
  }

  /**
   * Получает путь к файлу сессии
   */
  getSessionFilePath(username) {
    const sessionKey = this.createSessionKey(username);
    return path.join(this.sessionsDir, `${sessionKey}.json`);
  }

  /**
   * Сохраняет сессию Instagram
   */
  async saveSession(username, igClient) {
    try {
      const sessionKey = this.createSessionKey(username);
      const sessionData = {
        username: username,
        state: await igClient.state.serialize(),
        createdAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 дней
        lastUsed: Date.now()
      };

      // Сохраняем в памяти
      this.sessions.set(sessionKey, {
        ...sessionData,
        igClient: igClient
      });

      // Сохраняем в файл (без igClient)
      const filePath = this.getSessionFilePath(username);
      fs.writeFileSync(filePath, JSON.stringify({
        username: sessionData.username,
        state: sessionData.state,
        createdAt: sessionData.createdAt,
        expiresAt: sessionData.expiresAt,
        lastUsed: sessionData.lastUsed
      }, null, 2));

      console.log(`[Instagram Session Manager] Сессия сохранена для ${username} (expires: ${new Date(sessionData.expiresAt).toLocaleString()})`);
      
      return true;
    } catch (error) {
      console.error(`[Instagram Session Manager] Ошибка сохранения сессии для ${username}:`, error.message);
      return false;
    }
  }

  /**
   * Загружает сессию для пользователя
   */
  async loadSession(username, igClient) {
    try {
      const sessionKey = this.createSessionKey(username);
      
      // Проверяем сессию в памяти
      if (this.sessions.has(sessionKey)) {
        const memorySession = this.sessions.get(sessionKey);
        if (memorySession.expiresAt > Date.now()) {
          console.log(`[Instagram Session Manager] Используем сессию из памяти для ${username}`);
          
          // Обновляем время последнего использования
          memorySession.lastUsed = Date.now();
          
          return memorySession.igClient;
        }
      }

      // ПРИНУДИТЕЛЬНАЯ загрузка из файла БЕЗ проверки времени
      const filePath = this.getSessionFilePath(username);
      console.log(`[Session Manager] ПРИНУДИТЕЛЬНАЯ загрузка из файла: ${filePath}`);
      console.log(`[Session Manager] Файл существует: ${fs.existsSync(filePath)}`);
      
      if (fs.existsSync(filePath)) {
        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`[Session Manager] Файл загружен, размер: ${JSON.stringify(fileData).length} символов`);
        console.log(`[Session Manager] expiresAt: ${fileData.expiresAt}, now: ${Date.now()}`);
        
        // ИГНОРИРУЕМ ВРЕМЯ ИСТЕЧЕНИЯ - загружаем ЛЮБУЮ сессию
        console.log(`[Instagram Session Manager] ПРИНУДИТЕЛЬНО восстанавливаем сессию из файла для ${username} (игнорируем expiresAt)`);
        
        try {
          // Восстанавливаем состояние в Instagram клиенте
          await igClient.state.deserialize(fileData.state);
          console.log(`[Session Manager] Состояние клиента успешно восстановлено`);
          
          // Сохраняем в памяти
          this.sessions.set(sessionKey, {
            ...fileData,
            igClient: igClient,
            lastUsed: Date.now()
          });

          // Обновляем время последнего использования в файле
          fileData.lastUsed = Date.now();
          fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));

          console.log(`[Instagram Session Manager] Сессия ПРИНУДИТЕЛЬНО восстановлена для ${username}`);
          return igClient;
        } catch (deserializeError) {
          console.error(`[Session Manager] Ошибка десериализации состояния:`, deserializeError.message);
          return null;
        }
      } else {
        console.log(`[Session Manager] Файл сессии НЕ НАЙДЕН: ${filePath}`);
      }

      return null;
    } catch (error) {
      console.error(`[Instagram Session Manager] Ошибка загрузки сессии для ${username}:`, error.message);
      return null;
    }
  }

  /**
   * Проверяет есть ли валидная сессия
   */
  hasValidSession(username) {
    const sessionKey = this.createSessionKey(username);
    console.log(`[Session Manager] Проверяем сессию для ${username}, ключ: ${sessionKey}`);
    
    // Проверяем в памяти
    if (this.sessions.has(sessionKey)) {
      const session = this.sessions.get(sessionKey);
      const isValidMemory = session.expiresAt > Date.now();
      console.log(`[Session Manager] Сессия в памяти: существует, валидна: ${isValidMemory}`);
      return isValidMemory;
    }

    // Проверяем файл
    const filePath = this.getSessionFilePath(username);
    console.log(`[Session Manager] Проверяем файл: ${filePath}`);
    console.log(`[Session Manager] Файл существует: ${fs.existsSync(filePath)}`);
    
    if (fs.existsSync(filePath)) {
      try {
        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const isValidFile = fileData.expiresAt > Date.now();
        console.log(`[Session Manager] Файл сессии: размер ${JSON.stringify(fileData).length} символов, валидна: ${isValidFile}`);
        console.log(`[Session Manager] Expires: ${new Date(fileData.expiresAt).toLocaleString()}, сейчас: ${new Date().toLocaleString()}`);
        return isValidFile;
      } catch (error) {
        console.error(`[Session Manager] Ошибка чтения файла сессии:`, error.message);
        return false;
      }
    }

    console.log(`[Session Manager] Файл сессии не найден`);
    return false;
  }

  /**
   * Удаляет сессию
   */
  deleteSession(username) {
    const sessionKey = this.createSessionKey(username);
    
    // Удаляем из памяти
    this.sessions.delete(sessionKey);
    
    // Удаляем файл
    const filePath = this.getSessionFilePath(username);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Instagram Session Manager] Сессия удалена для ${username}`);
    }
  }

  /**
   * Загружает все сохраненные сессии при старте
   */
  loadSavedSessions() {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      let loadedCount = 0;
      let expiredCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.sessionsDir, file);
            const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (sessionData.expiresAt > Date.now()) {
              loadedCount++;
              console.log(`[Instagram Session Manager] Найдена сохраненная сессия для ${sessionData.username}`);
            } else {
              expiredCount++;
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error(`[Instagram Session Manager] Ошибка загрузки сессии из файла ${file}:`, error.message);
          }
        }
      }

      console.log(`[Instagram Session Manager] Загружено ${loadedCount} активных сессий, удалено ${expiredCount} истекших`);
    } catch (error) {
      console.error('[Instagram Session Manager] Ошибка загрузки сохраненных сессий:', error.message);
    }
  }

  /**
   * Очистка истекших сессий
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;

    // Очистка из памяти
    for (const [key, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(key);
        cleanedCount++;
      }
    }

    // Очистка файлов
    try {
      const files = fs.readdirSync(this.sessionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.sessionsDir, file);
            const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (sessionData.expiresAt < now) {
              fs.unlinkSync(filePath);
              cleanedCount++;
            }
          } catch (error) {
            // Удаляем поврежденные файлы
            const filePath = path.join(this.sessionsDir, file);
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        }
      }
    } catch (error) {
      console.error('[Instagram Session Manager] Ошибка очистки файлов сессий:', error.message);
    }

    if (cleanedCount > 0) {
      console.log(`[Instagram Session Manager] Очищено ${cleanedCount} истекших сессий`);
    }
  }

  /**
   * Получает информацию о всех сессиях
   */
  getSessionsInfo() {
    const info = {
      memoryCount: this.sessions.size,
      fileCount: 0,
      sessions: []
    };

    // Подсчитываем файлы
    try {
      const files = fs.readdirSync(this.sessionsDir);
      info.fileCount = files.filter(f => f.endsWith('.json')).length;
    } catch (error) {
      // Игнорируем ошибки
    }

    // Информация о сессиях в памяти
    for (const [key, session] of this.sessions.entries()) {
      info.sessions.push({
        username: session.username,
        createdAt: new Date(session.createdAt).toLocaleString(),
        expiresAt: new Date(session.expiresAt).toLocaleString(),
        lastUsed: new Date(session.lastUsed).toLocaleString(),
        isExpired: session.expiresAt < Date.now()
      });
    }

    return info;
  }
}

// Экспортируем singleton
const sessionManager = new InstagramSessionManager();
module.exports = sessionManager;