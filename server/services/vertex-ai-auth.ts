import { GoogleAuth } from 'google-auth-library';
import { log } from '../utils/logger';

/**
 * Сервис для авторизации в Vertex AI через Service Account
 * Использует GOOGLE_SERVICE_ACCOUNT_KEY из переменных окружения
 */
class VertexAIAuth {
  private auth: GoogleAuth;
  private projectId: string;
  private location: string;

  constructor() {
    let credentials: any;
    
    try {
      // Пытаемся получить из переменной окружения
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      
      if (serviceAccountKey) {
        // Если это JSON строка
        if (serviceAccountKey.trim().startsWith('{')) {
          credentials = JSON.parse(serviceAccountKey);
        } else {
          // Если это base64 или путь к файлу, используем google-auth-library напрямую
          this.auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
          });
          this.projectId = 'gen-lang-client-0762407615';
          this.location = 'us-central1';
          log(`[vertex-ai-auth] Инициализирован с Application Default Credentials`, 'vertex-ai');
          return;
        }
      } else {
        // Используем файл google-service-account.json
        this.auth = new GoogleAuth({
          keyFile: './google-service-account.json',
          scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        this.projectId = 'gen-lang-client-0762407615';
        this.location = 'us-central1';
        log(`[vertex-ai-auth] Инициализирован с файлом google-service-account.json`, 'vertex-ai');
        return;
      }
      
      // Если получили JSON учетные данные
      this.projectId = credentials.project_id || 'gen-lang-client-0762407615';
      this.location = 'us-central1';
      
      this.auth = new GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      
      log(`[vertex-ai-auth] Инициализирован для проекта ${this.projectId}`, 'vertex-ai');
    } catch (error) {
      log(`[vertex-ai-auth] Ошибка инициализации: ${error}`, 'vertex-ai');
      
      // Fallback: используем Application Default Credentials
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      this.projectId = 'gen-lang-client-0762407615';
      this.location = 'us-central1';
      log(`[vertex-ai-auth] Fallback: используем Application Default Credentials`, 'vertex-ai');
    }
  }

  /**
   * Получает access token для Vertex AI API
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const client = await this.auth.getClient();
      const accessTokenResponse = await client.getAccessToken();
      
      if (accessTokenResponse.token) {
        log(`[vertex-ai-auth] Получен access token для Vertex AI`, 'vertex-ai');
        return accessTokenResponse.token;
      }
      
      log(`[vertex-ai-auth] Не удалось получить access token`, 'vertex-ai');
      return null;
    } catch (error) {
      log(`[vertex-ai-auth] Ошибка получения access token: ${error}`, 'vertex-ai');
      return null;
    }
  }

  /**
   * Получает ID проекта
   */
  getProjectId(): string {
    return this.projectId;
  }

  /**
   * Получает локацию
   */
  getLocation(): string {
    return this.location;
  }

  /**
   * Формирует URL для Vertex AI API
   */
  getVertexAIUrl(model: string): string {
    return `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model}:generateContent`;
  }
}

// Экспортируем единственный экземпляр
export const vertexAIAuth = new VertexAIAuth();