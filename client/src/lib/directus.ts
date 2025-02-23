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


export async function login(email: string, password: string) {
  try {
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

    const auth = await authResponse.json() as DirectusAuthResponse;

    if (!auth.data?.access_token) {
      throw new Error('Ошибка аутентификации');
    }

    // Get user info using the new token
    const userResponse = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${auth.data.access_token}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Не удалось получить данные пользователя');
    }

    const { data: user } = await userResponse.json();
    useAuthStore.setState({token: auth.data.access_token, userId: user.id});
    return { user, token: auth.data.access_token };
  } catch (error) {
    console.error('Login error:', error);
    throw error instanceof Error ? error : new Error('Ошибка входа');
  }
}

export async function logout() {
  const store = useAuthStore.getState();
  const token = store.token;

  try {
    if (token) {
      await fetch(`${DIRECTUS_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
    useAuthStore.setState({token: null, userId: null});
  } catch (error) {
    console.error('Logout error:', error);
  }
}

export async function getCurrentUser() {
  const store = useAuthStore.getState();
  const token = store.token;

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const { data: user } = await response.json();
    return user as DirectusUser;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export async function createCampaign(name: string, description?: string) {
  const store = useAuthStore.getState();
  const token = store.token;
  const userId = store.userId;

  if (!token || !userId) {
    throw new Error('Требуется авторизация');
  }

  try {
    const response = await fetch(`${DIRECTUS_URL}/items/user_campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name,
        description,
        user_id: userId
      })
    });

    if (!response.ok) {
      throw new Error('Не удалось создать кампанию');
    }

    const { data } = await response.json();
    return data as Campaign;
  } catch (error) {
    console.error('Create campaign error:', error);
    throw error instanceof Error ? error : new Error('Не удалось создать кампанию');
  }
}

export async function getCampaigns() {
  const store = useAuthStore.getState();
  const token = store.token;
  const userId = store.userId;

  if (!token || !userId) {
    throw new Error('Требуется авторизация');
  }

  try {
    const filter = JSON.stringify({
      user_id: { _eq: userId }
    });

    const url = `${DIRECTUS_URL}/items/user_campaigns?filter=${encodeURIComponent(filter)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Не удалось получить список кампаний');
    }

    const { data } = await response.json();
    return data as Campaign[];
  } catch (error) {
    console.error('Get campaigns error:', error);
    throw error instanceof Error ? error : new Error('Не удалось получить список кампаний');
  }
}