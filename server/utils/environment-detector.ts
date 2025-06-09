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
  
  // Check if we're in Docker environment or production server
  const isDocker = process.env.DOCKER_ENV === 'true' || 
                   process.env.NODE_ENV === 'production' ||
                   (process.platform === 'linux' && process.env.HOME === '/root') ||
                   process.cwd().includes('/root/smm');
                   
  // Check if we're in Replit environment
  const isReplit = process.env.REPL_ID !== undefined || 
                   process.env.REPLIT_DB_URL !== undefined;

  // Check if we're in staging environment
  const isStaging = process.env.NODE_ENV === 'staging' || 
                    process.env.STAGING === 'true' ||
                    process.cwd().includes('staging') ||
                    (process.env.DOMAIN && process.env.DOMAIN.includes('smm.roboflow.tech'));

  let environment = 'unknown';
  let adminEmail = envEmail;
  let adminPassword = envPassword;
  
  // Environment-specific defaults if env vars are not available
  if (!adminEmail || !adminPassword) {
    if (isStaging) {
      environment = 'staging';
      adminEmail = adminEmail || 'admin@roboflow.tech';
      adminPassword = adminPassword || 'QtpZ3dh7';
    } else if (isDocker) {
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
    if (isStaging) {
      environment = 'staging';
    } else {
      environment = envEmail === 'lbrspb@gmail.com' ? 'production' : 'development';
    }
  }

  // Determine correct Directus URL based on environment
  let directusUrl = envUrl;
  if (!directusUrl) {
    if (isDocker || environment === 'production') {
      directusUrl = 'https://directus.nplanner.ru';
    } else {
      directusUrl = 'https://directus.roboflow.tech';
    }
  }

  return {
    adminEmail: adminEmail!,
    adminPassword: adminPassword!,
    directusUrl,
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