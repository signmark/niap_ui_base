import { VertexAI } from '@google-cloud/vertexai';
import path from 'path';
import fs from 'fs';

export class VertexAIGeminiService {
  private vertexAI: VertexAI;
  private project: string = 'gen-lang-client-0762407615';
  private location: string = 'us-central1';

  constructor() {
    // Устанавливаем переменную окружения для аутентификации
    const keyPath = path.join(process.cwd(), 'google-service-account.json');
    if (fs.existsSync(keyPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
    }
    
    // Инициализация Vertex AI
    this.vertexAI = new VertexAI({
      project: this.project,
      location: this.location
    });
  }

  /**
   * Генерирует контент с помощью Gemini 2.5 Flash
   */
  async generateContent(prompt: string, model: string = 'gemini-2.0-flash-002'): Promise<string> {
    try {
      console.log(`[vertex-ai] Генерация контента с моделью ${model}`);
      console.log(`[vertex-ai] Project: ${this.project}, Location: ${this.location}`);
      
      const generativeModel = this.vertexAI.preview.getGenerativeModel({
        model: model,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
          topP: 0.95,
        },
      });

      const result = await generativeModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      });

      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      console.log(`[vertex-ai] Контент успешно сгенерирован, длина: ${text.length} символов`);
      return text;

    } catch (error: any) {
      console.error('[vertex-ai] Ошибка генерации контента:', error);
      throw new Error(`Ошибка Vertex AI: ${error.message}`);
    }
  }

  /**
   * Генерирует контент для социальных сетей
   */
  async generateSocialContent(
    prompt: string,
    platform: string = 'instagram',
    tone: string = 'дружелюбный',
    keywords: string[] = []
  ): Promise<string> {
    const keywordsText = keywords.length > 0 ? keywords.join(', ') : '';
    
    const enhancedPrompt = `
Ты - профессиональный SMM-копирайтер. Создай контент для платформы ${platform}.

Тон: ${tone}
${keywordsText ? `Ключевые слова: ${keywordsText}` : ''}

Запрос: ${prompt}

Создай качественный пост, который будет интересен аудитории и соответствует стилю платформы ${platform}.
    `;

    return this.generateContent(enhancedPrompt, 'gemini-2.0-flash-002');
  }

  /**
   * Тестирует подключение к Vertex AI
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('[vertex-ai] Тестирование подключения к Vertex AI...');
      
      const result = await this.generateContent('Ответь одним словом: "Работает"');
      const isWorking = result.toLowerCase().includes('работает') || result.toLowerCase().includes('works');
      
      console.log(`[vertex-ai] Тест подключения: ${isWorking ? 'УСПЕШНО' : 'ОШИБКА'}`);
      console.log(`[vertex-ai] Ответ: ${result}`);
      
      return isWorking;
    } catch (error) {
      console.error('[vertex-ai] Ошибка тестирования:', error);
      return false;
    }
  }

  /**
   * Получает доступные модели
   */
  getAvailableModels(): string[] {
    return [
      'gemini-2.0-flash-002',
      'gemini-1.5-pro-002',
      'gemini-1.5-flash-002'
    ];
  }
}