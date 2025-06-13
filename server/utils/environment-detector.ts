/**
 * Environment detector for multi-server deployments
 * Handles different admin credentials across Docker, Replit, and production environments
 */

interface EnvironmentConfig {
  adminEmail: string;
  adminPassword: string;
  directusUrl: string;
  environment: string;
}

/**
 * Detects current environment and returns appropriate admin credentials
 */
export function detectEnvironment(): EnvironmentConfig {
  // Используем только переменные окружения DIRECTUS_URL и N8N_URL
  const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
  
  // Определяем окружение на основе URL
  let environment = 'production';
  if (directusUrl && directusUrl.includes('roboflow.tech')) {
    environment = 'development';
  }

  return {
    adminEmail: 'admin@roboflow.tech',
    adminPassword: 'asdASD123!@#',
    directusUrl: directusUrl,
    environment
  };
}