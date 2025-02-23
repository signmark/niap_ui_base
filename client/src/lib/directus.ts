import { createDirectus, rest, authentication, readItems } from '@directus/sdk';

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
    // Сначала выполняем вход
    const auth = await directus.login(email, password);
    if (!auth) throw new Error('Ошибка аутентификации');

    // После успешного входа получаем данные пользователя
    const me = await directus.request(readItems('directus_users', {
      filter: {
        email: { _eq: email }
      },
      fields: ['id', 'email', 'first_name', 'last_name'],
      limit: 1
    }));

    if (!me?.[0]) throw new Error('Пользователь не найден');

    return { user: me[0] as DirectusUser };
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
    const me = await directus.request(readItems('directus_users', {
      fields: ['id', 'email', 'first_name', 'last_name'],
      limit: 1
    }));

    return me?.[0] as DirectusUser | null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}