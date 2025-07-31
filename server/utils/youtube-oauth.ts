import { google } from 'googleapis';
import { YouTubeConfig } from '../services/global-api-keys';

export class YouTubeOAuth {
  private oauth2Client: any;

  constructor(config?: YouTubeConfig) {
    // Если конфигурация передана, используем её
    if (config) {
      const defaultRedirectUri = this.getDefaultRedirectUri();
      const finalRedirectUri = config.redirectUri || defaultRedirectUri;
      
      console.log('[youtube-oauth] Конфигурация YouTube OAuth:');
      console.log('[youtube-oauth] - clientId:', config.clientId ? '***установлен***' : 'НЕ ЗАДАН');
      console.log('[youtube-oauth] - clientSecret:', config.clientSecret ? '***установлен***' : 'НЕ ЗАДАН');
      console.log('[youtube-oauth] - redirectUri из config:', config.redirectUri || 'НЕ ЗАДАН');
      console.log('[youtube-oauth] - getDefaultRedirectUri():', defaultRedirectUri);
      console.log('[youtube-oauth] - Финальный redirect URI:', finalRedirectUri);
      
      this.oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        finalRedirectUri
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
    console.log('[getDefaultRedirectUri] Начинаем определение redirect URI');
    console.log('[getDefaultRedirectUri] YOUTUBE_REDIRECT_URI:', process.env.YOUTUBE_REDIRECT_URI || 'НЕ ЗАДАН');
    console.log('[getDefaultRedirectUri] DIRECTUS_URL:', process.env.DIRECTUS_URL || 'НЕ ЗАДАН');
    console.log('[getDefaultRedirectUri] VITE_DIRECTUS_URL:', process.env.VITE_DIRECTUS_URL || 'НЕ ЗАДАН');
    console.log('[getDefaultRedirectUri] REPL_ID:', process.env.REPL_ID || 'НЕ ЗАДАН');
    
    // ВРЕМЕННО ОТКЛЮЧЕНО: Игнорируем YOUTUBE_REDIRECT_URI для автоопределения среды
    if (process.env.YOUTUBE_REDIRECT_URI) {
      console.log('[getDefaultRedirectUri] Игнорируем устаревшую YOUTUBE_REDIRECT_URI, используем автоопределение');
      // НЕ возвращаем process.env.YOUTUBE_REDIRECT_URI - продолжаем автоопределение
    }
    
    // Определяем среду по URL Directus
    const directusUrl = process.env.DIRECTUS_URL || process.env.VITE_DIRECTUS_URL;
    console.log('[getDefaultRedirectUri] directusUrl для проверки:', directusUrl);
    
    if (directusUrl?.includes('roboflow.space')) {
      // Стейдж среда
      return 'https://smm.roboflow.space/api/youtube/auth/callback';
    } else if (directusUrl?.includes('replit.dev') || process.env.REPL_ID) {
      // Dev среда (Replit) - формируем URL из REPL_ID и REPL_SLUG
      const replId = process.env.REPL_ID;
      const replSlug = process.env.REPL_SLUG || 'workspace';
      const replUrl = `https://${replId}-00-m8pxe5e85z61.worf.replit.dev`;
      
      console.log('[youtube-oauth] Формируем Replit URL:');
      console.log('[youtube-oauth] REPL_ID:', replId);
      console.log('[youtube-oauth] REPL_SLUG:', replSlug);
      console.log('[youtube-oauth] Полный URL:', replUrl);
      
      return `${replUrl}/api/youtube/auth/callback`;
    } else {
      // Fallback для локальной разработки
      return 'http://localhost:5000/api/youtube/auth/callback';
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