import { Request, Response, NextFunction } from 'express';

/**
 * Middleware для аутентификации пользователей
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'] as string;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: "Отсутствует токен авторизации" 
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: "Некорректный токен авторизации" 
      });
    }
    
    // Проверяем токен через Directus API
    const response = await fetch(`${process.env.DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return res.status(401).json({ 
        error: "Недействительный токен авторизации" 
      });
    }
    
    const userData = await response.json();
    
    // Добавляем данные пользователя в запрос
    (req as any).user = {
      id: userData.data.id,
      email: userData.data.email,
      token: token
    };
    (req as any).userId = userData.data.id;
    
    console.log(`[AUTH] Пользователь авторизован: ${userData.data.id} (${userData.data.email || 'unknown@email.com'})`);
    
    next();
  } catch (error: any) {
    console.error('[AUTH] Ошибка при проверке авторизации:', error.message);
    return res.status(500).json({ 
      error: "Ошибка при проверке авторизации",
      details: error.message 
    });
  }
}