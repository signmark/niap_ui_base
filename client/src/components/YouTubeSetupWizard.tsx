import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Youtube, ExternalLink, CheckCircle, User, Users, Eye } from 'lucide-react';

interface YouTubeChannelInfo {
  channelId: string;
  channelTitle: string;
  channelDescription: string;
  thumbnails: any;
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
  publishedAt: string;
}

interface YouTubeSetupWizardProps {
  campaignId: string;
  initialSettings?: any;
  onComplete: (data: { 
    channelId: string; 
    channelTitle: string;
    accessToken: string;
    refreshToken: string;
    channelInfo: YouTubeChannelInfo;
  }) => void;
}

export function YouTubeSetupWizard({ campaignId, initialSettings, onComplete }: YouTubeSetupWizardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [channelInfo, setChannelInfo] = useState<YouTubeChannelInfo | null>(null);
  const [authTokens, setAuthTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);

  // Автоматическая загрузка существующих настроек при открытии мастера
  useEffect(() => {
    if (initialSettings?.youtube?.accessToken) {
      console.log('🔄 [YouTube Wizard] Loading existing YouTube settings...', {
        hasAccessToken: !!initialSettings.youtube.accessToken,
        hasChannelId: !!initialSettings.youtube.channelId
      });
      
      setAuthTokens({
        accessToken: initialSettings.youtube.accessToken,
        refreshToken: initialSettings.youtube.refreshToken || ''
      });
      
      // Если есть channelId, то пропускаем OAuth и сразу получаем информацию о канале
      if (initialSettings.youtube.channelId) {
        setStep(3); // Переходим к шагу показа информации о канале
        fetchChannelInfo(initialSettings.youtube.accessToken);
      } else {
        setStep(2); // Переходим к получению Channel ID
      }
    }
  }, [initialSettings]);

  const handleOAuthStart = async () => {
    setIsLoading(true);
    try {
      console.log('🚀 [YouTube Wizard] Starting OAuth process...');
      
      const response = await fetch(`/api/youtube/auth/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`OAuth start failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.authUrl) {
        console.log('✅ [YouTube Wizard] OAuth URL received, opening popup...');
        
        // Открываем popup для авторизации
        const popup = window.open(
          data.authUrl,
          'youtube-oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );
        
        // Слушаем сообщения от popup
        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'YOUTUBE_OAUTH_SUCCESS') {
            console.log('✅ [YouTube Wizard] OAuth success received:', event.data);
            popup?.close();
            window.removeEventListener('message', messageHandler);
            
            setAuthTokens({
              accessToken: event.data.accessToken,
              refreshToken: event.data.refreshToken
            });
            setStep(2);
            setIsLoading(false);
            
            toast({
              title: "Авторизация успешна!",
              description: "Получаю информацию о вашем канале..."
            });
            
            // Автоматически получаем информацию о канале
            fetchChannelInfo(event.data.accessToken, {
              accessToken: event.data.accessToken,
              refreshToken: event.data.refreshToken
            });
          } else if (event.data.type === 'YOUTUBE_OAUTH_ERROR') {
            console.error('❌ [YouTube Wizard] OAuth error:', event.data.error);
            popup?.close();
            window.removeEventListener('message', messageHandler);
            setIsLoading(false);
            
            toast({
              title: "Ошибка авторизации",
              description: event.data.error || "Произошла ошибка при авторизации",
              variant: "destructive"
            });
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Проверяем, не закрыли ли popup
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            setIsLoading(false);
          }
        }, 1000);
        
      } else {
        throw new Error(data.error || 'Failed to get authorization URL');
      }
    } catch (error: any) {
      console.error('❌ [YouTube Wizard] OAuth start error:', error);
      setIsLoading(false);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось начать авторизацию",
        variant: "destructive"
      });
    }
  };

  const fetchChannelInfo = async (accessToken: string, tokens?: { accessToken: string; refreshToken: string }) => {
    try {
      console.log('📊 [YouTube Wizard] Fetching channel info...');
      
      const response = await fetch(`/api/youtube/channel-info?accessToken=${encodeURIComponent(accessToken)}`);
      
      if (!response.ok) {
        throw new Error(`Channel info request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.channelInfo) {
        console.log('✅ [YouTube Wizard] Channel info received:', data.channelInfo);
        setChannelInfo(data.channelInfo);
        setStep(3);
        
        toast({
          title: "Канал найден!",
          description: `Канал "${data.channelInfo.channelTitle}" готов к использованию`
        });
        
        // Автоматически завершаем настройку без требования нажать кнопку
        const tokensToUse = tokens || authTokens;
        console.log('🔍 [YouTube Wizard] Checking auto-completion conditions:', {
          hasTokens: !!tokensToUse,
          tokens: tokens ? 'passed as parameter' : 'from state',
          authTokens: !!authTokens,
          onComplete: typeof onComplete
        });
        
        if (tokensToUse) {
          console.log('✅ [YouTube Wizard] Auto-completing setup with data:', {
            channelId: data.channelInfo.channelId,
            channelTitle: data.channelInfo.channelTitle,
            accessToken: tokensToUse.accessToken ? 'present' : 'missing',
            refreshToken: tokensToUse.refreshToken ? 'present' : 'missing'
          });
          
          try {
            onComplete({
              channelId: data.channelInfo.channelId,
              channelTitle: data.channelInfo.channelTitle,
              accessToken: tokensToUse.accessToken,
              refreshToken: tokensToUse.refreshToken,
              channelInfo: data.channelInfo
            });
            console.log('✅ [YouTube Wizard] onComplete called successfully');
          } catch (error) {
            console.error('❌ [YouTube Wizard] Error calling onComplete:', error);
          }
        } else {
          console.warn('⚠️ [YouTube Wizard] No tokens available for auto-completion');
        }
      } else {
        throw new Error(data.error || 'Failed to get channel info');
      }
    } catch (error: any) {
      console.error('❌ [YouTube Wizard] Channel info error:', error);
      
      // Если ошибка авторизации (401), предлагаем повторную авторизацию
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        setStep(4); // Переходим к шагу ошибки авторизации
      }
      
      toast({
        title: "Ошибка получения данных канала",
        description: error.message || "Не удалось получить информацию о канале",
        variant: "destructive"
      });
    }
  };

  const handleComplete = () => {
    if (channelInfo && authTokens) {
      console.log('✅ [YouTube Wizard] Completing setup with data:', {
        channelId: channelInfo.channelId,
        channelTitle: channelInfo.channelTitle
      });
      
      onComplete({
        channelId: channelInfo.channelId,
        channelTitle: channelInfo.channelTitle,
        accessToken: authTokens.accessToken,
        refreshToken: authTokens.refreshToken,
        channelInfo
      });
      
      toast({
        title: "YouTube настроен!",
        description: `Канал "${channelInfo.channelTitle}" готов к публикации видео`
      });
    }
  };

  const formatNumber = (num: string) => {
    const number = parseInt(num);
    if (number >= 1000000) {
      return `${(number / 1000000).toFixed(1)}M`;
    } else if (number >= 1000) {
      return `${(number / 1000).toFixed(1)}K`;
    }
    return number.toString();
  };

  return (
    <div className="space-y-6">
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Youtube className="h-6 w-6 text-red-600" />
              Настройка YouTube
            </CardTitle>
            <CardDescription>
              Подключите ваш YouTube канал для автоматической публикации видео.
              Используется системный API ключ - вам нужна только авторизация.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Что произойдет:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Откроется окно авторизации YouTube</li>
                <li>• Автоматически получится ID вашего канала</li>
                <li>• Система будет готова к публикации видео</li>
                <li>• API ключ уже настроен системой</li>
              </ul>
            </div>
            
            <Button 
              onClick={handleOAuthStart} 
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Авторизация...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Авторизоваться в YouTube
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              Получение информации о канале
            </CardTitle>
            <CardDescription>
              Авторизация прошла успешно. Получаю данные вашего YouTube канала...
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-6 w-6 text-orange-600" />
              Требуется повторная авторизация
            </CardTitle>
            <CardDescription>
              Токен авторизации истек или недействителен. Необходимо авторизоваться заново.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-medium text-orange-900 mb-2">Что произошло:</h4>
              <ul className="text-sm text-orange-800 space-y-1">
                <li>• Токен доступа YouTube истек</li>
                <li>• Или были изменены настройки канала</li>
                <li>• Требуется новая авторизация для получения свежих токенов</li>
              </ul>
            </div>
            
            <Button 
              onClick={() => {
                setStep(1);
                setAuthTokens(null);
                setChannelInfo(null);
              }}
              className="w-full"
              size="lg"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Авторизоваться заново
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && channelInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              YouTube канал готов!
            </CardTitle>
            <CardDescription>
              Ваш канал успешно подключен и готов к публикации видео
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
              {channelInfo.thumbnails?.default?.url && (
                <img 
                  src={channelInfo.thumbnails.default.url} 
                  alt="Channel Avatar"
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{channelInfo.channelTitle}</h4>
                <p className="text-sm text-gray-600 mb-2">
                  ID: {channelInfo.channelId}
                </p>
                <div className="flex gap-4 text-sm">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {formatNumber(channelInfo.subscriberCount)} подписчиков
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {formatNumber(channelInfo.viewCount)} просмотров
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Youtube className="h-3 w-3" />
                    {channelInfo.videoCount} видео
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button onClick={handleComplete} className="flex-1" size="lg">
                <CheckCircle className="h-4 w-4 mr-2" />
                Завершить настройку
              </Button>
              <Button 
                onClick={() => {
                  setStep(1);
                  setAuthTokens(null);
                  setChannelInfo(null);
                }} 
                variant="outline" 
                size="lg"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Авторизоваться заново
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}