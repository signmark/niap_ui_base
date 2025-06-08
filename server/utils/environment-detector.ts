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
  // Priority order: Environment variables > .env file > defaults
  const envEmail = process.env.DIRECTUS_ADMIN_EMAIL;
  const envPassword = process.env.DIRECTUS_ADMIN_PASSWORD;
  const envUrl = process.env.DIRECTUS_URL || process.env.VITE_DIRECTUS_URL;
  
  // Check if we're in Docker environment
  const isDocker = process.env.DOCKER_ENV === 'true' || 
                   process.env.NODE_ENV === 'production' ||
                   process.platform === 'linux' && process.env.HOME === '/root';
                   
  // Check if we're in Replit environment
  const isReplit = process.env.REPL_ID !== undefined || 
                   process.env.REPLIT_DB_URL !== undefined;

  let environment = 'unknown';
  let adminEmail = envEmail;
  let adminPassword = envPassword;
  
  // Environment-specific defaults if env vars are not available
  if (!adminEmail || !adminPassword) {
    if (isDocker) {
      environment = 'docker';
      adminEmail = adminEmail || 'lbrspb@gmail.com';
      adminPassword = adminPassword || 'QtpZ3dh7';
    } else if (isReplit) {
      environment = 'replit';
      adminEmail = adminEmail || 'admin@roboflow.tech';
      adminPassword = adminPassword || 'QtpZ3dh7';
    } else {
      environment = 'local';
      adminEmail = adminEmail || 'lbrspb@gmail.com';
      adminPassword = adminPassword || 'QtpZ3dh7';
    }
  } else {
    environment = envEmail === 'lbrspb@gmail.com' ? 'production' : 'development';
  }

  return {
    adminEmail: adminEmail!,
    adminPassword: adminPassword!,
    directusUrl: envUrl || 'https://directus.roboflow.tech',
    environment
  };
}

/**
 * Gets admin credentials for current environment
 */
export function getAdminCredentials() {
  const config = detectEnvironment();
  console.log(`[env-detector] Detected environment: ${config.environment}, using admin: ${config.adminEmail}`);
  return {
    email: config.adminEmail,
    password: config.adminPassword,
    url: config.directusUrl
  };
}