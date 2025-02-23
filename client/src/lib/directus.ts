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

interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

const DIRECTUS_URL = 'https://directus.nplanner.ru';

let accessToken: string | null = null;

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

    // Store the access token for future requests
    accessToken = auth.data.access_token;

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
    accessToken = null;
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

// Campaigns API
export async function createCampaign(name: string, description?: string) {
  if (!accessToken) throw new Error('Требуется авторизация');

  const response = await fetch(`${DIRECTUS_URL}/items/user_campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      name,
      description,
    }),
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Не удалось создать кампанию');
  }

  const { data } = await response.json();
  return data as Campaign;
}

export async function getCampaigns() {
  if (!accessToken) throw new Error('Требуется авторизация');

  const response = await fetch(`${DIRECTUS_URL}/items/user_campaigns`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Не удалось получить список кампаний');
  }

  const { data } = await response.json();
  return data as Campaign[];
}