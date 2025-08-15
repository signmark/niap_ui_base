const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');

/**
 * Прямой сервис для работы с Gemini через Vertex AI без зависимостей
 */
class GeminiVertexDirect {
  constructor() {
    this.projectId = 'laboratory-449308';
    this.location = 'us-central1';
    this.credentials = {
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
  }

  /**
   * Получает access token напрямую через JWT
   */
  async getDirectAccessToken() {
    try {
      console.log('[gemini-vertex-direct] Получаем прямой access token');
      
      const auth = new GoogleAuth({
        credentials: this.credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      
      const client = await auth.getClient();
      const accessTokenResponse = await client.getAccessToken();
      
      if (!accessTokenResponse.token) {
        throw new Error('Не удалось получить access token');
      }
      
      console.log('[gemini-vertex-direct] Access token получен успешно');
      return accessTokenResponse.token;
      
    } catch (error) {
      console.error('[gemini-vertex-direct] Ошибка получения токена:', error.message);
      throw error;
    }
  }

  /**
   * Улучшает текст с помощью Gemini через Vertex AI
   */
  async improveText(params) {
    try {
      console.log('[gemini-vertex-direct] Начинаем улучшение текста');
      
      const { text, prompt, model = 'gemini-2.5-flash-preview-05-20' } = params;
      
      const accessToken = await this.getDirectAccessToken();
      
      const enhancementPrompt = `${prompt}

Исходный текст для улучшения:
${text}

Верни только улучшенный текст без дополнительных комментариев.`;

      // Используем новый generateContent endpoint
      const response = await fetch(
        `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{text: enhancementPrompt}]
            }],
            generationConfig: {
              maxOutputTokens: 8192,
              temperature: 0.7
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Нет ответа от Vertex AI API');
      }

      const candidate = data.candidates[0];
      let improvedText = '';

      if (candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text) {
        improvedText = candidate.content.parts[0].text;
      } else if (candidate.content && candidate.content.text) {
        improvedText = candidate.content.text;
      } else if (candidate.text) {
        improvedText = candidate.text;
      } else {
        throw new Error('Неожиданная структура ответа от Vertex AI API');
      }

      console.log('[gemini-vertex-direct] Текст успешно улучшен');
      return improvedText;
      
    } catch (error) {
      console.error('[gemini-vertex-direct] Ошибка при улучшении текста:', error.message);
      throw error;
    }
  }

  /**
   * Генерирует контент с помощью Gemini через Vertex AI
   */
  async generateContent(params) {
    try {
      console.log('[gemini-vertex-direct] Начинаем генерацию контента');
      
      const { prompt, model = 'gemini-2.5-flash-preview-05-20' } = params;
      
      const accessToken = await this.getDirectAccessToken();

      const requestBody = {
        instances: [
          {
            messages: [
              {
                role: "user",
                content: prompt
              }
            ]
          }
        ],
        parameters: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          topK: 40,
          topP: 0.95
        }
      };

      // Используем новый generateContent endpoint
      const response = await fetch(
        `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{text: prompt}]
            }],
            generationConfig: {
              maxOutputTokens: 4096,
              temperature: 0.1
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Нет ответа от Vertex AI API');
      }

      console.log('[gemini-vertex-direct] Полная структура ответа:', JSON.stringify(data, null, 2).substring(0, 1000));
      
      const candidate = data.candidates[0];
      let generatedText = '';

      // Проверяем причину завершения
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.log('[gemini-vertex-direct] ⚠️ Ответ обрезан из-за лимита токенов');
        throw new Error('Превышен лимит токенов - попробуйте сократить промпт или увеличить maxOutputTokens');
      }

      if (candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text) {
        generatedText = candidate.content.parts[0].text;
      } else if (candidate.content && candidate.content.text) {
        generatedText = candidate.content.text;
      } else if (candidate.text) {
        generatedText = candidate.text;
      } else {
        console.log('[gemini-vertex-direct] Проблема с кандидатом:', JSON.stringify(candidate, null, 2));
        throw new Error('Неполная структура ответа от Vertex AI API - нет текста в кандидате');
      }

      console.log('[gemini-vertex-direct] Текст успешно сгенерирован');
      return generatedText;
      
    } catch (error) {
      console.error('[gemini-vertex-direct] Ошибка при генерации текста:', error.message);
      throw error;
    }
  }

  /**
   * Генерирует текст (алиас для generateContent)
   */
  async generateText(params) {
    return this.generateContent(params);
  }
}

// Создаем и экспортируем экземпляр
const geminiVertexDirect = new GeminiVertexDirect();

module.exports = {
  geminiVertexDirect
};