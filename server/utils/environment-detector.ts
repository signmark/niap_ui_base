/**
 * Environment detector for multi-server deployments
 * Handles different admin credentials across Docker, Replit, and production environments
 */

export interface EnvironmentConfig {
  adminEmail: string;
  adminPassword: string;
  directusUrl: string;
  n8nUrl: string;
  environment: 'development' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  debugScheduler: boolean;
  verboseLogs: boolean;
}

/**
 * Detects current environment and returns appropriate admin credentials
 */
export function detectEnvironment(): EnvironmentConfig {
  // Автоматически определяем окружение по переменным среды
  const envVariable = process.env.ENV || process.env.NODE_ENV || 'production';
  const environment = envVariable === 'development' ? 'development' : 'production';
  
  // Получаем URL из переменных окружения с fallback
  const directusUrl = process.env.DIRECTUS_URL || process.env.VITE_DIRECTUS_URL || 'https://directus.nplanner.ru';
  const n8nUrl = process.env.N8N_URL || process.env.VITE_N8N_URL || 'https://n8n.nplanner.ru';

  // Получаем учетные данные из переменных окружения
  const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL || process.env.DIRECTUS_EMAIL || 'lbrspb@gmail.com';
  const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD || process.env.DIRECTUS_PASSWORD || 'QtpZ3dh7';

  // Конфигурация логгирования в зависимости от окружения
  const logLevel = (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 
    (environment === 'development' ? 'debug' : 'info');
  
  const debugScheduler = process.env.DEBUG_SCHEDULER === 'true' || environment === 'development';
  const verboseLogs = process.env.VERBOSE_LOGS === 'true' || environment === 'development';

  return {
    adminEmail,
    adminPassword,
    directusUrl,
    n8nUrl,
    environment,
    logLevel,
    debugScheduler,
    verboseLogs
  };
}