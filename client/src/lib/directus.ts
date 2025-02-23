import { createDirectus, rest, authentication } from '@directus/sdk';

interface DirectusUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

const directus = createDirectus(import.meta.env.VITE_DIRECTUS_URL || 'https://directus.nplanner.ru/')
  .with(rest())
  .with(authentication('json'));

export async function login(email: string, password: string) {
  try {
    // Выполняем вход и получаем токен
    const auth = await directus.login(email, password);
    if (!auth) throw new Error('Ошибка аутентификации');

    // Получаем данные о текущем пользователе через /users/me
    const response = await fetch(`${import.meta.env.VITE_DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${auth.access_token}`
      }
    });

    if (!response.ok) throw new Error('Не удалось получить данные пользователя');

    const user = await response.json();
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
    await directus.logout();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

export async function getCurrentUser() {
  try {
    const response = await fetch(`${import.meta.env.VITE_DIRECTUS_URL}/users/me`, {
      credentials: 'include'
    });

    if (!response.ok) return null;

    const user = await response.json();
    return user as DirectusUser;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}