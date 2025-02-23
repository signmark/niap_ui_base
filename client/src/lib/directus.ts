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
    const authResponse = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!authResponse.ok) {
      throw new Error('Неверный email или пароль');
    }

    const auth = await authResponse.json() as DirectusAuthResponse;
    if (!auth.data?.access_token) {
      throw new Error('Ошибка аутентификации');
    }

    accessToken = auth.data.access_token;

    // Get user info
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Не удалось получить данные пользователя');
    }

    currentUser = user;
    return { user };
  } catch (error) {
    console.error('Login error:', error);
    throw error instanceof Error ? error : new Error('Ошибка входа');
  }
}

export async function logout() {
  try {
    await fetch(`${DIRECTUS_URL}/auth/logout`, {
      method: 'POST',
    });
    accessToken = null;
    currentUser = null;
  } catch (error) {
    console.error('Logout error:', error);
  }
}

export async function getCurrentUser() {
  try {
    if (!accessToken) return null;

    const response = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
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
  if (!accessToken || !currentUser) {
    throw new Error('Требуется авторизация');
  }

  try {
    console.log('Creating campaign with user_id:', currentUser.id);

    const response = await fetch(`${DIRECTUS_URL}/items/user_campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name,
        description,
        user_id: currentUser.id, // Explicitly set user_id
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Create campaign error:', error);
      throw new Error('Не удалось создать кампанию');
    }

    const { data } = await response.json();
    console.log('Created campaign:', data);
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
    console.log('Fetching campaigns for user:', currentUser.id);

    // Add filter to only get campaigns for current user
    const filter = JSON.stringify({
      user_id: { _eq: currentUser.id }
    });

    const url = `${DIRECTUS_URL}/items/user_campaigns?filter=${encodeURIComponent(filter)}`;
    console.log('Request URL:', url);

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