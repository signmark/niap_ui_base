import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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
let currentUser: DirectusUser | null = null;

export async function login(email: string, password: string) {
  try {
    console.log('Attempting login for:', email);

    const authResponse = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    if (!authResponse.ok) {
      console.error('Auth response not OK:', authResponse.status);
      throw new Error('Неверный email или пароль');
    }

    const auth = await authResponse.json() as DirectusAuthResponse;
    console.log('Auth response received:', { hasToken: !!auth.data?.access_token });

    if (!auth.data?.access_token) {
      throw new Error('Ошибка аутентификации');
    }

    accessToken = auth.data.access_token;

    // Get user info
    const userResponse = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      console.error('User info response not OK:', userResponse.status);
      throw new Error('Не удалось получить данные пользователя');
    }

    const { data: user } = await userResponse.json();
    currentUser = user;

    console.log('Login successful:', { userId: user.id });
    return { user, token: auth.data.access_token };
  } catch (error) {
    console.error('Login error:', error);
    accessToken = null;
    currentUser = null;
    throw error instanceof Error ? error : new Error('Ошибка входа');
  }
}

export async function logout() {
  try {
    if (accessToken) {
      await fetch(`${DIRECTUS_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    accessToken = null;
    currentUser = null;
  }
}

export async function getCurrentUser() {
  try {
    if (!accessToken) {
      console.log('No access token available');
      return null;
    }

    const response = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      console.error('Get current user response not OK:', response.status);
      return null;
    }

    const { data: user } = await response.json();
    currentUser = user;
    return user as DirectusUser;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export async function createCampaign(name: string, description?: string) {
  if (!accessToken || !currentUser) {
    throw new Error('Требуется авторизация');
  }

  try {
    const response = await fetch(`${DIRECTUS_URL}/items/user_campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name,
        description,
        user_id: currentUser.id
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Create campaign error:', error);
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
  if (!accessToken || !currentUser) {
    throw new Error('Требуется авторизация');
  }

  try {
    const filter = JSON.stringify({
      user_id: { _eq: currentUser.id }
    });

    const url = `${DIRECTUS_URL}/items/user_campaigns?filter=${encodeURIComponent(filter)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Get campaigns error:', error);
      throw new Error('Не удалось получить список кампаний');
    }

    const { data } = await response.json();
    console.log('Received campaigns:', data);
    return data as Campaign[];
  } catch (error) {
    console.error('Get campaigns error:', error);
    throw error instanceof Error ? error : new Error('Не удалось получить список кампаний');
  }
}