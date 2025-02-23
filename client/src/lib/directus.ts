import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useAuthStore } from './store';

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

// Вспомогательная функция для выполнения авторизованных запросов
async function authorizedFetch(url: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error('Не авторизован');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    useAuthStore.getState().setAuth(null, null);
    throw new Error('Сессия истекла');
  }

  return response;
}

export async function login(email: string, password: string) {
  try {
    const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Неверный email или пароль');
    }

    const auth = await response.json() as DirectusAuthResponse;

    if (!auth.data?.access_token) {
      throw new Error('Ошибка аутентификации');
    }

    const userResponse = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${auth.data.access_token}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Не удалось получить данные пользователя');
    }

    const { data: user } = await userResponse.json();
    return { user, token: auth.data.access_token };
  } catch (error) {
    console.error('Login error:', error);
    throw error instanceof Error ? error : new Error('Ошибка входа');
  }
}

export async function logout() {
  try {
    await authorizedFetch(`${DIRECTUS_URL}/auth/logout`, {
      method: 'POST'
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    useAuthStore.getState().setAuth(null, null);
  }
}

export async function getCurrentUser(): Promise<DirectusUser | null> {
  try {
    const response = await authorizedFetch(`${DIRECTUS_URL}/users/me`);
    const { data: user } = await response.json();
    return user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export async function getCampaigns(): Promise<Campaign[]> {
  try {
    const userId = useAuthStore.getState().userId;
    const filter = JSON.stringify({
      user_id: { _eq: userId }
    });

    const response = await authorizedFetch(
      `${DIRECTUS_URL}/items/user_campaigns?filter=${encodeURIComponent(filter)}`
    );

    const { data } = await response.json();
    return data;
  } catch (error) {
    console.error('Get campaigns error:', error);
    throw error instanceof Error ? error : new Error('Не удалось получить список кампаний');
  }
}

export async function createCampaign(name: string, description?: string): Promise<Campaign> {
  try {
    const userId = useAuthStore.getState().userId;
    const response = await authorizedFetch(`${DIRECTUS_URL}/items/user_campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        user_id: userId
      })
    });

    const { data } = await response.json();
    return data;
  } catch (error) {
    console.error('Create campaign error:', error);
    throw error instanceof Error ? error : new Error('Не удалось создать кампанию');
  }
}