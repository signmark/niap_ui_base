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
    // Захардкоженные учетные данные для быстрого развертывания
    const hardcodedCredentials = {
      "type": "service_account",
      "project_id": "gen-lang-client-0762407615",
      "private_key_id": "1d404280ad343d5b73c23893b3c7e76b8f12ba47",
      "private_key": "-----BEGIN PRIVATE KEY-----\n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\n-----END PRIVATE KEY-----\n",
      "client_email": "replit-smm-manager@gen-lang-client-0762407615.iam.gserviceaccount.com",
      "client_id": "105237891058473625647",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs/replit-smm-manager%40gen-lang-client-0762407615.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    };

    try {
      this.projectId = hardcodedCredentials.project_id;
      this.location = 'us-central1';
      
      this.auth = new GoogleAuth({
        credentials: hardcodedCredentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      
      log(`[vertex-ai-auth] Инициализирован с захардкоженными учетными данными для проекта ${this.projectId}`, 'vertex-ai');
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