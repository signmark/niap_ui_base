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
  // Принудительно перезагружаем переменные окружения из .env файла
  require('dotenv').config({ override: true });
  
  // Используем только переменные окружения DIRECTUS_URL и N8N_URL
  const directusUrl = process.env.DIRECTUS_URL;
  
  // Определяем окружение на основе URL
  let environment = 'development';
  if (directusUrl && directusUrl.includes('nplanner.ru')) {
    environment = 'production';
  }

  return {
    adminEmail: 'admin@roboflow.tech',
    adminPassword: 'asdASD123!@#',
    directusUrl: directusUrl || 'https://directus.roboflow.tech',
    environment
  };
}