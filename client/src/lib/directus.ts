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

    return { token: auth.data.access_token };
  } catch (error) {
    console.error('Login error:', error);
    throw error instanceof Error ? error : new Error('Ошибка входа');
  }
}

export async function logout() {
  try {
    const token = useAuthStore.getState().token;
    if (token) {
      await fetch(`${DIRECTUS_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

export async function getCampaigns(): Promise<Campaign[]> {
  try {
    const token = useAuthStore.getState().token;

    const response = await fetch(
      `${DIRECTUS_URL}/items/user_campaigns`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Не удалось получить список кампаний');
    }

    const { data } = await response.json();
    return data;
  } catch (error) {
    console.error('Get campaigns error:', error);
    throw error instanceof Error ? error : new Error('Не удалось получить список кампаний');
  }
}

export async function createCampaign(name: string, description?: string): Promise<Campaign> {
  try {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${DIRECTUS_URL}/items/user_campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name,
        description
      })
    });

    if (!response.ok) {
      throw new Error('Не удалось создать кампанию');
    }

    const { data } = await response.json();
    return data;
  } catch (error) {
    console.error('Create campaign error:', error);
    throw error instanceof Error ? error : new Error('Не удалось создать кампанию');
  }
}