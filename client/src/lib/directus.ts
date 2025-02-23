import { createDirectus, rest, authentication, readItems } from '@directus/sdk';

interface DirectusUser {
  id: string;
  email: string;
  // Add other relevant fields
}

const directus = createDirectus(import.meta.env.VITE_DIRECTUS_URL || 'https://directus.nplanner.ru/')
  .with(rest())
  .with(authentication());

export async function login(email: string, password: string) {
  try {
    await directus.login(email, password);
    const response = await directus.request(readItems('directus_users', {
      filter: {
        email: { _eq: email }
      },
      limit: 1
    }));

    if (!response?.[0]) throw new Error('User not found');
    return { user: response[0] as DirectusUser };
  } catch (error) {
    throw new Error('Login failed');
  }
}

export async function logout() {
  await directus.logout();
}

export async function getCurrentUser() {
  try {
    const response = await directus.request(readItems('directus_users', {
      filter: {
        status: { _eq: 'active' }
      },
      limit: 1
    }));

    return response?.[0] as DirectusUser | null;
  } catch {
    return null;
  }
}