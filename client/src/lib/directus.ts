interface DirectusUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface DirectusAuthResponse {
  data: {
    access_token: string;
    expires: number;
    refresh_token: string;
  }
}

const DIRECTUS_URL = 'https://directus.nplanner.ru';

export async function login(email: string, password: string) {
  try {
    const authResponse = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    if (!authResponse.ok) {
      throw new Error('Неверный email или пароль');
    }

    const auth = await authResponse.json() as DirectusAuthResponse;
    if (!auth.data?.access_token) {
      throw new Error('Ошибка аутентификации');
    }

    const userResponse = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${auth.data.access_token}`
      },
      credentials: 'include'
    });

    if (!userResponse.ok) {
      throw new Error('Не удалось получить данные пользователя');
    }

    const { data: user } = await userResponse.json();
    return { user: user as DirectusUser };
  } catch (error) {
    console.error('Login error:', error);
    throw error instanceof Error ? error : new Error('Ошибка входа');
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