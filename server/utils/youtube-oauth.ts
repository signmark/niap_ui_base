import { google } from 'googleapis';
import { YouTubeConfig } from '../services/global-api-keys';

export class YouTubeOAuth {
  private oauth2Client: any;

  constructor(config?: YouTubeConfig) {
    // Если конфигурация передана, используем её
    if (config) {
      const redirectUri = config.redirectUri || this.getDefaultRedirectUri();
      console.log('[youtube-oauth] Используем конфигурацию из базы данных, redirect URI:', redirectUri);
      
      this.oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        redirectUri
      );
    } else {
      // Fallback на старый способ с переменными среды
      const redirectUri = this.getDefaultRedirectUri();
      console.log('[youtube-oauth] Fallback: используем переменные среды и redirect URI:', redirectUri);
      
      this.oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        redirectUri
      );
    }
  }

  private getDefaultRedirectUri(): string {
    // Если есть переменная среды, используем её
    if (process.env.YOUTUBE_REDIRECT_URI) {
      return process.env.YOUTUBE_REDIRECT_URI;
    }
    
    // Определяем среду по URL Directus
    const directusUrl = process.env.DIRECTUS_URL || process.env.VITE_DIRECTUS_URL;
    
    if (directusUrl?.includes('roboflow.space')) {
      // Стейдж среда
      return 'https://smm.roboflow.space/api/auth/youtube/callback';
    } else if (directusUrl?.includes('replit.dev') || process.env.REPL_ID) {
      // Dev среда (Replit)
      return 'https://6813c5d2-7c73-4e24-8e70-d9b38d1135b3-00-1i11z1ktw30ct.worf.replit.dev/api/auth/youtube/callback';
    } else {
      // Fallback для локальной разработки
      return 'http://localhost:5000/api/auth/youtube/callback';
    }
  }

  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.upload'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token
    };
  }

  async getChannelInfo(accessToken: string): Promise<{
    channelId: string;
    channelTitle: string;
  }> {
    this.oauth2Client.setCredentials({
      access_token: accessToken
    });

    const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
    
    const response = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    });

    const channel = response.data.items?.[0];
    if (!channel) {
      throw new Error('Канал не найден');
    }

    return {
      channelId: channel.id!,
      channelTitle: channel.snippet?.title || 'Unknown Channel'
    };
  }
}