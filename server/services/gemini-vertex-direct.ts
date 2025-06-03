import { log } from '../utils/logger.js';
import { GoogleAuth } from 'google-auth-library';

/**
 * Прямой сервис для работы с Gemini через Vertex AI без зависимостей
 */
export class GeminiVertexDirect {
  private projectId = 'laboratory-449308';
  private location = 'us-central1';
  private credentials = {
    "type": "service_account",
    "project_id": "laboratory-449308",
    "private_key_id": "e59e916c28da2bdb47f11046b6e1ed4e71fb7c55",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQClIuhxbUn4zuda\nnuR3RgHNFo1SpP/hGBSkcExPadN6y3bC0w54ApMj8gfmquCcjc1cFq6snfwaqmee\n3zydnzXY9m4DBYgqkcn0mr1PpCaO9Y8S029igw9Yy7WNiSdIPUcu7upSx1fJHpkt\nOVk1Ip3Mz68/2cZSw5SSJZSOmpx27H0UHzDACYA0Lw44Ap39ZJhI9m6qOI8afpwJ\nsSFUTfpqihd9gnWkych4q9fsdRwN5IiSepSMry+IYz4tfnVV1C4CMcdbcWCnE2Ml\nGxU8/FpNcjmtAH/ck1MZk5oKD4RaJX8uB3BA1Z0YGDCLrDzfITw1ucgOQ+HBAYa9\nS8JX6EClAgMBAAECggEADBXJarT4/bnv9Cb+XlI5GIVm00kFpuH9xL5T1K37JENB\nTjxm6dZ6ZojfFiekPMt4ih2TgUjQkIevAfv2sixazaV/OJO45YX6KyoAjRRcyV05\nhW2u0Ef6IWFLHfAPIroapwR6ET51yLSyDhK32hZ4nkAGucavZ72DdndEmh5rhp0Q\nPr8Aeqw3z20A7oxA98MEdkJZogtD9UKyGkVlaFpyWOaFyQPaZLRsgB/83Vjs5gjC\ngVTLBk64KsjIdgRFr//bmZ+3Hou1WyeJGFGn42SisQD9MKXtQzOKrt6FsgF3In8s\nxD8p3/gVEt2lDxv5Qs2nhfQro8GIUg+0swqVE2JbQwKBgQDOScow0N3co8gBnJL9\nQTtd2nmmo9AsPJx4rK35ey/1nGZkz1fAU3vPoDlppI/0t6PR/r9J8xuljA1RKnGa\nqIDEMqU4VYkFt8rp/Gstmd+NhN+QOIw/YoyzloBRTp1VXWPPJynDUn6WqeL4yQ8A\nVtTWYrT4X9cAWJ728V4mGnDr8wKBgQDM7manuJ5c0MHXKER7QV7VG/gl2QsqO8Ny\nA7txxPd6wagK6u2P5eCe1U6tp+KdM7ydTr67oswebtRp7B8muSn6t/LuACSxbco3\niDUzQmcjpTp3MbE9GSZqJlLZ93n8mjnQXjFV+Xia7yA36CLBI5v0eYPHXhXWiCa0\nVkgKbXs/BwKBgA+8My8MD5BP8ealkdS9kBC1pIfggPWO3gSab17TVbIvbuQLqM7j\nz1LkDt0PD2gERfuzqdWzNI2pJC7nxOieJ8xPbKjiZWRJQ7IbbfV5gkLiOsdeeNww\n4Tilpz4MeBXV3NIlU5sxhLRrWwPNGlbVSMDdoJ49eUHugJmniZ3wcGKfAoGAeAWc\nS9i9ryB4lrm3ufRkRS33XLtMZbTQ2ALFknFIfDXVZGeJMQDyWDQXu28bMvStH/iR\njrVfFOfWMh8fc394zaVUev3Mf7oMeA+nENlwLJlFr6+D3YPQUtUVKyFc6YuuFpJE\nFNViRGOOnA+x4yom2b0dZ/N7mMTu3im2UZ0jVJsCgYEAyVYlNx76MytTAcgjfktB\nSFQZgNdvwPLuFE0bNzzIFvz7D7g8YHpVEds7dIegLrvVH3kXvS3+qqjyp5xBPCuJ\nOGoStzxEmeEPRHGj+sr5bxWvm2eZj1R28LHoo7XXynh66740EsU3i2EGINNT0DkM\n2jfR5u9hsY14SuOqepciuAU=\n-----END PRIVATE KEY-----\n",
    "client_email": "laboratory@laboratory-449308.iam.gserviceaccount.com",
    "client_id": "110680889001338472512",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/laboratory%40laboratory-449308.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
  };

  /**
   * Получает access token напрямую через JWT
   */
  private async getDirectAccessToken(): Promise<string> {
    try {
      log(`[gemini-vertex-direct] Получаем прямой access token`, 'info');
      
      const auth = new GoogleAuth({
        credentials: this.credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      
      const client = await auth.getClient();
      const accessTokenResponse = await client.getAccessToken();
      
      if (!accessTokenResponse.token) {
        throw new Error('Не удалось получить access token');
      }
      
      log(`[gemini-vertex-direct] Access token получен успешно`, 'info');
      return accessTokenResponse.token;
      
    } catch (error) {
      log(`[gemini-vertex-direct] Ошибка получения токена: ${(error as Error).message}`, 'error');
      throw error;
    }
  }

  /**
   * Улучшает текст с помощью Gemini через Vertex AI
   */
  async improveText(params: { text: string; prompt: string; model?: string }): Promise<string> {
    try {
      const { text, prompt, model = 'gemini-2.5-flash-preview-05-20' } = params;
      
      log(`[gemini-vertex-direct] Запрос улучшения текста с моделью: ${model}`, 'info');
      
      // Получаем токен доступа
      const accessToken = await this.getDirectAccessToken();
      
      // Формируем URL для Vertex AI API
      const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model}:generateContent`;
      
      const requestData = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${prompt}\n\nТекст для улучшения:\n${text}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192
        }
      };
      
      log(`[gemini-vertex-direct] Отправляем запрос к: ${url}`, 'info');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 секунд
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      log(`[gemini-vertex-direct] Ответ получен (${response.status}): ${responseText.substring(0, 200)}...`, 'info');
      
      if (!response.ok) {
        throw new Error(`Vertex AI HTTP error ${response.status}: ${responseText}`);
      }
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Неверный формат ответа от Vertex AI');
      }
      
      // Извлекаем текст из ответа
      const candidates = responseData.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('Vertex AI не вернул результатов');
      }
      
      const content = candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        throw new Error('Vertex AI вернул пустой контент');
      }
      
      const improvedText = content.parts[0].text;
      if (!improvedText) {
        throw new Error('Vertex AI не вернул улучшенный текст');
      }
      
      log(`[gemini-vertex-direct] Текст успешно улучшен`, 'info');
      return improvedText.trim();
      
    } catch (error) {
      log(`[gemini-vertex-direct] Ошибка: ${(error as Error).message}`, 'error');
      throw error;
    }
  }
}

// Экспортируем экземпляр сервиса
export const geminiVertexDirect = new GeminiVertexDirect();