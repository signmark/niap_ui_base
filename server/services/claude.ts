import axios from 'axios';
import * as logger from '../utils/logger';

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  temperature?: number;
  messages: {
    role: string;
    content: string;
  }[];
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: {
    type: string;
    text: string;
  }[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeImproveTextParams {
  text: string;
  prompt: string;
  model?: string;
}

/**
 * Сервис для работы с Claude API
 */
export class ClaudeService {
  private apiKey: string;
  private apiUrl = 'https://api.anthropic.com/v1/messages';
  private defaultModel = 'claude-3-sonnet-20240229';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Проверяет доступность API ключа
   */
  async testApiKey(): Promise<boolean> {
    try {
      logger.log('Testing Claude API key...', 'claude');
      
      // Небольшой prompt для проверки ключа
      const result = await this.makeRequest({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Say "API key is valid" if you can read this message.'
          }
        ]
      });
      
      // Проверяем, получили ли мы осмысленный ответ
      const hasValidResponse = result && 
        result.content && 
        result.content.length > 0 && 
        result.content[0].text.includes('valid');
      
      logger.log(`Claude API key test result: ${hasValidResponse ? 'Valid' : 'Invalid'}`, 'claude');
      return hasValidResponse;
    } catch (error) {
      logger.error('Error testing Claude API key:', error, 'claude');
      return false;
    }
  }

  /**
   * Улучшает текст с помощью Claude AI
   */
  async improveText({ text, prompt, model }: ClaudeImproveTextParams): Promise<string> {
    logger.log('Improving text with Claude AI...', 'claude');
    
    const requestModel = model || this.defaultModel;
    
    try {
      const contentPrompt = `${prompt}\n\nИсходный текст:\n"""${text}"""\n\nУлучшенный текст:`;
      
      const result = await this.makeRequest({
        model: requestModel,
        max_tokens: 4000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: contentPrompt
          }
        ]
      });
      
      if (!result || !result.content || result.content.length === 0) {
        throw new Error('Claude API returned empty response');
      }
      
      const improvedText = result.content[0].text.trim();
      logger.log('Text successfully improved with Claude AI', 'claude');
      return improvedText;
    } catch (error) {
      logger.error('Error improving text with Claude:', error, 'claude');
      throw new Error('Failed to improve text with Claude: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Генерирует контент на основе промпта
   */
  async generateContent(prompt: string, model?: string): Promise<string> {
    logger.log('Generating content with Claude AI...', 'claude');
    
    const requestModel = model || this.defaultModel;
    
    try {
      const result = await this.makeRequest({
        model: requestModel,
        max_tokens: 4000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      if (!result || !result.content || result.content.length === 0) {
        throw new Error('Claude API returned empty response');
      }
      
      const generatedContent = result.content[0].text.trim();
      logger.log('Content successfully generated with Claude AI', 'claude');
      return generatedContent;
    } catch (error) {
      logger.error('Error generating content with Claude:', error, 'claude');
      throw new Error('Failed to generate content with Claude: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * Выполняет запрос к Claude API
   */
  private async makeRequest(requestData: ClaudeRequest): Promise<ClaudeResponse> {
    try {
      logger.debug(`Making Claude API request to ${this.apiUrl}`, 'claude');
      logger.debug(`Using model: ${requestData.model}`, 'claude');
      
      const response = await axios.post<ClaudeResponse>(
        this.apiUrl,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      if (response.status !== 200) {
        throw new Error(`Claude API responded with status code ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        logger.error(`Claude API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`, 'claude');
      } else {
        logger.error('Error making Claude API request:', error, 'claude');
      }
      throw error;
    }
  }
}