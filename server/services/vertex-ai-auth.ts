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
      // Использование ваших креденшалов для проекта laboratory-449308
      const credentials = {
        "type": "service_account",
        "project_id": "laboratory-449308",
        "private_key_id": "e59e916c28da2bdb47f11046b6e1ed4e71fb7c55",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQClIuhxbUn4zuda\nnuR3RgHNFo1SpP/hGBSkcExPadN6y3bC0w54ApMj8gfmquCcjc1cFq6snfwaqmee\n3zydnzXY9m4DBYgqkcn0mr1PpCaO9Y8S029igw9Yy7WNiSdIPUcu7upSx1fJHpkt\nOVk1Ip3Mz68/2cZSw5SSJZSOmpx27H0UHzDACYA0Lw44Ap39ZJhI9m6qOI8afpwJ\nsSFUTfpqihd9gnWkych4q9fsdRwN5IiSepSMry+IYz4tfnVV1C4CMcdbcWCnE2Ml\nGxU8/FpNcjmtAH/ck1MZk5oKD4RaJX8uB3BA1Z0YGDCLrDzfITw1ucgOQ+HBAYa9\nS8JX6EClAgMBAAECggEADBXJarT4/bnv9Cb+XlI5GI6HVCJiREZHlOtGLGh0IaYg\nGBg4UjWJnj5xN1oHBpRN/XUYaUq3xRwsY8MjP6wD4nSHy8u2fVKLuaG7DfYdKDfF\nxzFoUDxsLRPeQLBBJiLbj4K/V8LGjFZZXcSyXLfCG8TpRxKQVKZXMrC0YU3FjT2u\nXjKp8mOvj6UY3zLb8Dv5pYZl0w8oKZU7dJ6wH8Ug2Xh9aLkKdJ8mD4VeR5NwY9fL\nQn8Z6tOxWZJmVzBQJCJBdJyP0uCZwQqH6dN8GzQx8fM8K8Jb3H5Y6Xk0A6M8nC7R\nTbQvDhH6PNr2XLG0iU7B5E8rCQ7GfZQH0x5V8Qx4PwKBgQDPKaBTpjnYKmKm6j/1\ndTYOZLaZzDCLjNRWS8GQJHlr0ZUmDhOXlYe8nTx7eCN9kxSJX9y0HGpVJL8a3uQ1\nUg2Xm8zN9FjhY7HQLT3JzGJ6vZnL8cj8D9Fvq8QjQ9YfkxR0DfY2PjzB0K8XH3c4\nQ6zCxZ8H5JyQ1KQwKfx8D8Gx5wKBgQDMBMX6Qj1qYvU7VJdz8hY2xL6j0r9c4fZ2\nG8HQa0wNH1LgP2xH8qYvV6Y0KbUjQ8XGV0QpJ1Y6L9r4wX7kC8Fv6DfP4Z2nT5bO\ndR8Lm6v5Q6nY7JfF8gD2P9oG2M2G0K8QjH6V7YfN1xJ8wZ5z6Q6vC0L8yK7QxV2n\n8mV5wQKBgQCc5JdXzLhq8gU6Vh8rQm3Z5pV8nFj2Y7KzQ8fG2Lq1vZp8nX1U6Q0X\nJdZhJ1J4g6T2K8P1YjF1QpVcLxJ8Q4Z8vN7uD1G8c6QjL9r8Y5wXz7M1kG4V1Y8Q\nt8fP6Q8ZcC1P2xK8nL5Y1TfJ8K1Q8xYvQ6Z8LfG2J7N5Y8QfG1VYQKBgBYoLg0Q\nU8vF1Y7Q6Z1XfP8L4K9G1vYjQ8L2z6Y8nP7cF2T8vJ1G9L5Q4xR8ZfN6Y2Q7T8L\nP3J8nG1vYcQ5Z8Lf9Y1P6Q8xRvT2YjF7QpZ8L1G5Y4zQ6N8vCpQ7T8L2Y1J8nX5Q\nvP6Y8ZcF1G9L4Q7R8Zf2Y1T6Q8xJvL3Y5N8Q9cBGP1FY8Q7ZfL2J4Y6QxPVc3\nVYQKBgBg7KQjL5Y1T8Q6Z8nF2vY9PcQ7L8G1Y4Q6Z8LfP2Y1T6Q8xRvN5Y8Qf1G\n7L2J4Y6Q8xP5Y1ZcF8L9Q7G2vYjT6Q8nP7cF2Y8L1G5Q4xR8ZfY1T6Q8nL7Y4Q9\nvCpQ7T8L2Y1J8nX5QvP6Y8ZcF1G9L4Q7R8Zf2Y1T6Q8xJvL3Y5N8Q9cB8YnG1P\n-----END PRIVATE KEY-----\n",
        "client_email": "laboratory@laboratory-449308.iam.gserviceaccount.com",
        "client_id": "110680889001338472512",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/laboratory%40laboratory-449308.iam.gserviceaccount.com",
        "universe_domain": "googleapis.com"
      };

      this.projectId = credentials.project_id;
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