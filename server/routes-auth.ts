import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger';

// Создаем роутер для аутентификации
const router = express.Router();

// В реальной ситуации этот объект хранился бы в базе данных
// Имитируем хранилище пользователей для примера
const users = [
  {
    id: '1',
    email: 'admin@example.com',
    password: 'admin123',
    name: 'Администратор'
  }
];

// Простое хранилище активных токенов
const tokens: { [key: string]: { userId: string, expiresAt: Date } } = {};

// Очистка просроченных токенов (запускается каждый час)
setInterval(() => {
  const now = new Date();
  for (const [token, data] of Object.entries(tokens)) {
    if (data.expiresAt < now) {
      delete tokens[token];
      logger.info(`[Auth] Удален просроченный токен для пользователя ${data.userId}`);
    }
  }
}, 3600000); // 1 час

// Вход пользователя
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Email и пароль обязательны'
    });
  }

  // Поиск пользователя
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    logger.warn(`[Auth] Неудачная попытка входа для ${email}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Неверный email или пароль'
    });
  }

  // Генерация нового токена
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Токен действителен 7 дней

  // Сохранение токена
  tokens[token] = {
    userId: user.id,
    expiresAt
  };

  logger.info(`[Auth] Пользователь ${user.id} вошел в систему`);

  // Отправка данных пользователю
  res.json({
    token,
    userId: user.id,
    name: user.name,
    expiresAt: expiresAt.toISOString()
  });
});

// Выход пользователя
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Токен не найден'
    });
  }

  const token = authHeader.split(' ')[1];
  
  // Проверка существования токена
  if (token in tokens) {
    const { userId } = tokens[token];
    delete tokens[token];
    logger.info(`[Auth] Пользователь ${userId} вышел из системы`);
  }

  res.status(200).json({
    success: true,
    message: 'Выход выполнен успешно'
  });
});

// Проверка статуса аутентификации
router.get('/auth/check', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      authenticated: false,
      message: 'Токен не найден'
    });
  }

  const token = authHeader.split(' ')[1];
  
  // Проверка существования и срока действия токена
  if (token in tokens) {
    const { userId, expiresAt } = tokens[token];
    
    if (new Date() > expiresAt) {
      // Токен просрочен
      delete tokens[token];
      logger.warn(`[Auth] Обнаружен просроченный токен для пользователя ${userId}`);
      return res.status(401).json({
        authenticated: false,
        message: 'Токен просрочен'
      });
    }
    
    // Поиск пользователя по ID
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(401).json({
        authenticated: false,
        message: 'Пользователь не найден'
      });
    }
    
    // Токен действителен
    return res.json({
      authenticated: true,
      userId: user.id,
      name: user.name,
      expiresAt: expiresAt.toISOString()
    });
  }
  
  // Токен не найден в хранилище
  return res.status(401).json({
    authenticated: false,
    message: 'Недействительный токен'
  });
});

// Обновление токена
router.post('/auth/refresh', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Токен не найден'
    });
  }

  const token = authHeader.split(' ')[1];
  
  // Проверка существования токена
  if (token in tokens) {
    const { userId } = tokens[token];
    
    // Поиск пользователя по ID
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Пользователь не найден'
      });
    }
    
    // Удаляем старый токен
    delete tokens[token];
    
    // Генерация нового токена
    const newToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Токен действителен 7 дней
    
    // Сохранение нового токена
    tokens[newToken] = {
      userId: user.id,
      expiresAt
    };
    
    logger.info(`[Auth] Обновлен токен для пользователя ${user.id}`);
    
    // Отправка данных пользователю
    return res.json({
      token: newToken,
      userId: user.id,
      name: user.name,
      expiresAt: expiresAt.toISOString()
    });
  }
  
  // Токен не найден в хранилище
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Недействительный токен'
  });
});

// Экспортируем роутер
export default router;