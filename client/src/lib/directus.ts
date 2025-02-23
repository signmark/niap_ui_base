import { createDirectus, rest, authentication } from '@directus/sdk';

interface DirectusUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface DirectusAuthResponse {
  access_token: string;
  expires: number;
}

const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL || 'https://directus.nplanner.ru';

export async function login(email: string, password: string) {
  try {
    // Выполняем вход через /auth/login
    const authResponse = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    if (!authResponse.ok) {
      throw new Error('Неверный email или пароль');
    }

    const auth = await authResponse.json();
    if (!auth.data?.access_token) throw new Error('Ошибка аутентификации');

    // Получаем данные о текущем пользователе через /users/me
    const userResponse = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${auth.data.access_token}`
      }
    });

    if (!userResponse.ok) throw new Error('Не удалось получить данные пользователя');

    const { data: user } = await userResponse.json();
    return { user: user as DirectusUser };
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof Error) {
      throw new Error(`Ошибка входа: ${error.message}`);
    }
    throw new Error('Неизвестная ошибка при входе');
  }
}

export async function logout() {
  try {
    await fetch(`${DIRECTUS_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
}

export async function getCurrentUser() {
  try {
    const response = await fetch(`${DIRECTUS_URL}/users/me`, {
      credentials: 'include'
    });

    if (!response.ok) return null;

    const { data: user } = await response.json();
    return user as DirectusUser;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}