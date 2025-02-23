import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useAuthStore } from './store';

const DIRECTUS_URL = 'https://directus.nplanner.ru';

export async function login(email: string, password: string): Promise<{ token: string }> {
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

    const data = await response.json();

    if (!data?.data?.access_token) {
      throw new Error('Неверный ответ от сервера');
    }

    return { token: data.data.access_token };
  } catch (error) {
    console.error('Login error:', error);
    throw new Error('Неверный email или пароль');
  }
}

export async function logout() {
  const token = useAuthStore.getState().token;
  if (!token) return;

  try {
    await fetch(`${DIRECTUS_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    useAuthStore.getState().clearToken();
  } catch (error) {
    console.error('Logout error:', error);
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

export async function getCampaigns(): Promise<Campaign[]> {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error('Не авторизован');
  }

  try {
    const response = await fetch(`${DIRECTUS_URL}/items/user_campaigns`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.errors?.[0]?.message || 'Не удалось получить список кампаний');
    }

    const { data } = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Некорректный формат данных');
    }

    return data;
  } catch (error) {
    console.error('Get campaigns error:', error);
    throw error instanceof Error ? error : new Error('Не удалось получить список кампаний');
  }
}

export async function createCampaign(name: string, description?: string): Promise<Campaign> {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error('Не авторизован');
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
        description
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.errors?.[0]?.message || 'Не удалось создать кампанию');
    }

    const { data } = await response.json();
    if (!data || typeof data !== 'object') {
      throw new Error('Некорректный формат данных');
    }

    return data;
  } catch (error) {
    console.error('Create campaign error:', error);
    throw error instanceof Error ? error : new Error('Не удалось создать кампанию');
  }
}