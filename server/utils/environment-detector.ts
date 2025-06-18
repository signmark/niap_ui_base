/**
 * Environment detector for multi-server deployments
 * Handles different admin credentials across Docker, Replit, and production environments
 */

export interface EnvironmentConfig {
  adminEmail: string;
  adminPassword: string;
  directusUrl: string;
  environment: 'development' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  debugScheduler: boolean;
  verboseLogs: boolean;
}

/**
 * Detects current environment and returns appropriate admin credentials
 */
export function detectEnvironment(): EnvironmentConfig {
  // Используем переменную ENV для определения окружения
  const envVariable = process.env.ENV || 'production';
  const environment = envVariable === 'development' ? 'development' : 'production';
  
  // ПРИНУДИТЕЛЬНО используем продакшн URL для подключения к реальному серверу
  const directusUrl = 'https://directus.nplanner.ru';

  // Конфигурация логгирования в зависимости от окружения
  const logLevel = (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 
    (environment === 'development' ? 'debug' : 'info');
  
  const debugScheduler = process.env.DEBUG_SCHEDULER === 'true' || environment === 'development';
  const verboseLogs = process.env.VERBOSE_LOGS === 'true' || environment === 'development';

  return {
    adminEmail: 'lbrspb@gmail.com',
    adminPassword: 'QtpZ3dh7',
    directusUrl,
    environment,
    logLevel,
    debugScheduler,
    verboseLogs
  };
}