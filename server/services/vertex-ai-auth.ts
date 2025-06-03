import { GoogleAuth } from 'google-auth-library';
import { log } from '../utils/logger';

/**
 * Сервис для авторизации в Vertex AI через Service Account
 */
class VertexAIAuth {
  private auth: GoogleAuth;
  private projectId: string;
  private location: string;

  constructor() {
    try {
      // Получаем учетные данные из переменных окружения
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      
      if (!serviceAccountKey) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY не найден в переменных окружения');
      }

      let credentials;
      try {
        credentials = JSON.parse(serviceAccountKey);
      } catch (parseError) {
        throw new Error(`Ошибка парсинга GOOGLE_SERVICE_ACCOUNT_KEY: ${parseError.message}`);
      }

      this.projectId = credentials.project_id || 'gen-lang-client-0762407615';
      this.location = 'us-central1';
      
      this.auth = new GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      
      log(`[vertex-ai-auth] Инициализирован для проекта ${this.projectId}`, 'vertex-ai');
    } catch (error) {
      log(`[vertex-ai-auth] Ошибка инициализации: ${error}`, 'vertex-ai');
      throw new Error('Не удалось инициализировать Vertex AI авторизацию');
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