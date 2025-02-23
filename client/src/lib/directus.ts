const DIRECTUS_URL = 'https://directus.nplanner.ru';

export async function login(email: string, password: string) {
  const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  return data;
}

export async function logout(token: string) {
  await fetch(`${DIRECTUS_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}