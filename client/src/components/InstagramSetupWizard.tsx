import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, CheckCircle, AlertCircle, Instagram, Facebook } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuthStore } from '@/lib/store';

interface InstagramAccount {
  instagramId: string;
  username: string;
  name: string;
  profilePicture?: string;
  pageId: string;
  pageName: string;
}

interface InstagramSetupData {
  connected: boolean;
  expired?: boolean;
  instagramAccounts?: InstagramAccount[];
  setupCompletedAt?: string;
  tokenExpiresAt?: string;
}

const InstagramSetupWizard: React.FC = () => {
  const [step, setStep] = useState<'instructions' | 'form' | 'callback' | 'loading' | 'success'>('instructions');
  const [formData, setFormData] = useState({
    appId: '',
    appSecret: '',
    instagramId: ''
  });
  const [callbackData, setCallbackData] = useState({
    code: '',
    state: ''
  });
  const [instagramData, setInstagramData] = useState<InstagramSetupData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuthStore() as { user: { id: string } };

  // Проверяем статус подключения при загрузке
  useEffect(() => {
    if (user?.id) {
      checkInstagramStatus();
    }
  }, [user?.id]);

  const checkInstagramStatus = async () => {
    try {
      const response = await apiRequest(`/api/instagram-setup/status/${user?.id}`);
      setInstagramData(response);
      
      if (response.connected && !response.expired) {
        setStep('success');
      }
    } catch (error) {
      console.error('Error checking Instagram status:', error);
    }
  };

  const handleStartOAuth = async () => {
    if (!formData.appId || !formData.appSecret) {
      toast({
        title: "Ошибка",
        description: "Введите App ID и App Secret",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const redirectUri = `https://n8n.roboflow.space/webhook/authorize-ig`;
      const scopes = [
        'pages_manage_posts',
        'pages_read_engagement', 
        'pages_show_list',
        'instagram_basic',
        'instagram_content_publish',
        'business_management',
        'pages_manage_metadata',
        'instagram_manage_insights',
        'publish_to_groups',
        'user_posts'
      ];
      
      // Генерируем state для безопасности
      const state = `${user?.id}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Формируем URL авторизации Facebook напрямую
      const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?` +
        `client_id=${formData.appId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes.join(','))}&` +
        `response_type=code&` +
        `state=${state}`;

      // Сохраняем данные для последующей обработки в N8N
      await apiRequest('/api/instagram-setup/save-config', {
        method: 'POST',
        body: JSON.stringify({
          appId: formData.appId,
          appSecret: formData.appSecret,
          instagramId: formData.instagramId,
          userId: user?.id,
          state: state
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Открываем Facebook OAuth
      window.open(authUrl, '_blank', 'width=600,height=700');
      
      setStep('success');
      toast({
        title: "Настройка завершена",
        description: "Перейдите в открывшееся окно Facebook для завершения авторизации",
        variant: "default"
      });
      
    } catch (error) {
      console.error('Error starting OAuth:', error);
      toast({
        title: "Ошибка",
        description: (error as any)?.message || "Ошибка инициализации авторизации",
        variant: "destructive"
      });
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessCallback = async () => {
    if (!callbackData.code) {
      toast({
        title: "Ошибка",
        description: "Введите код авторизации",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setStep('loading');

    try {
      const response = await apiRequest('/api/instagram-setup/callback', {
        method: 'POST'
      }, {
        code: callbackData.code,
        state: callbackData.state,
        userId: user?.id
      });

      if (response.success) {
        setInstagramData(response.data);
        setStep('success');
        
        toast({
          title: "Успешно!",
          description: `Instagram подключен. Найдено аккаунтов: ${response.data.instagramAccounts?.length || 0}`
        });
      } else {
        throw new Error(response.error || 'Ошибка обработки авторизации');
      }
    } catch (error) {
      console.error('Error processing callback:', error);
      toast({
        title: "Ошибка",
        description: (error as any)?.message || "Ошибка обработки авторизации",
        variant: "destructive"
      });
      setStep('callback');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiRequest(`/api/instagram-setup/disconnect/${user?.id}`, {
        method: 'DELETE'
      });
      
      setInstagramData(null);
      setStep('instructions');
      
      toast({
        title: "Успешно",
        description: "Instagram отключен"
      });
    } catch (error) {
      console.error('Error disconnecting Instagram:', error);
      toast({
        title: "Ошибка",
        description: "Ошибка отключения Instagram",
        variant: "destructive"
      });
    }
  };

  const handleRefreshToken = async () => {
    try {
      await apiRequest(`/api/instagram-setup/refresh-token/${user?.id}`, {
        method: 'POST'
      });
      
      await checkInstagramStatus();
      
      toast({
        title: "Успешно",
        description: "Токен обновлен"
      });
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast({
        title: "Ошибка",
        description: "Ошибка обновления токена",
        variant: "destructive"
      });
    }
  };

  if (step === 'callback') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Instagram className="h-6 w-6 text-pink-600" />
            <span>Шаг 2: Обработка авторизации</span>
          </CardTitle>
          <CardDescription>
            Скопируйте код авторизации из адресной строки браузера
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                После авторизации в Facebook вас перенаправит на страницу с кодом в URL. 
                Скопируйте значение параметра <code>code=...</code> из адресной строки.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label htmlFor="authCode">Код авторизации</Label>
                <Input
                  id="authCode"
                  placeholder="Введите код из параметра code=... в URL"
                  value={callbackData.code}
                  onChange={(e) => setCallbackData({ ...callbackData, code: e.target.value })}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Пример: AQAB...xyz (длинная строка символов после code=)
                </p>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleProcessCallback} disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Обработка...
                    </>
                  ) : (
                    'Подключить Instagram'
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setStep('form')}
                  disabled={loading}
                >
                  Назад
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'loading') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span>Подключение к Instagram...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'success' && instagramData?.connected) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <span>Instagram подключен</span>
          </CardTitle>
          <CardDescription>
            Ваш Instagram Business аккаунт успешно подключен к SMM Manager
          </CardDescription>
        </CardHeader>
        <CardContent>
          {instagramData.expired && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Токен доступа истек. Обновите токен для продолжения работы.
                <Button onClick={handleRefreshToken} className="ml-2" size="sm">
                  Обновить токен
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Подключенные аккаунты Instagram:</Label>
              <div className="mt-2 space-y-2">
                {instagramData.instagramAccounts?.map((account) => (
                  <div key={account.instagramId} className="flex items-center space-x-3 p-3 border rounded-lg">
                    {account.profilePicture && (
                      <img 
                        src={account.profilePicture} 
                        alt={account.username}
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Instagram className="h-4 w-4 text-pink-600" />
                        <span className="font-medium">@{account.username}</span>
                        <Badge variant="secondary">{account.name}</Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {account.instagramId}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Подключено: {new Date(instagramData.setupCompletedAt!).toLocaleString('ru-RU')}
                {instagramData.tokenExpiresAt && (
                  <div>Токен истекает: {new Date(instagramData.tokenExpiresAt).toLocaleString('ru-RU')}</div>
                )}
              </div>
              <Button onClick={handleDisconnect} variant="outline" size="sm">
                Отключить Instagram
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'instructions') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Instagram className="h-6 w-6 text-pink-600" />
            <span>Подключение Instagram Business</span>
          </CardTitle>
          <CardDescription>
            Настройте публикацию в Instagram через Facebook Business API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Важно:</strong> Для публикации в Instagram требуется Instagram Business аккаунт, 
                подключенный к Facebook странице, и Facebook приложение с соответствующими разрешениями.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="font-semibold">Шаг 1: Создайте Facebook Business страницу</h3>
              <p className="text-sm text-gray-600">
                Если у вас нет Facebook Business страницы, создайте её и подключите к ней ваш Instagram Business аккаунт.
              </p>
              <Button variant="outline" asChild>
                <a href="https://business.facebook.com/pages/create" target="_blank" rel="noopener noreferrer">
                  <Facebook className="h-4 w-4 mr-2" />
                  Создать Facebook страницу
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Шаг 2: Создайте Facebook приложение</h3>
              <p className="text-sm text-gray-600">
                Создайте приложение Facebook для получения App ID и App Secret.
              </p>
              <Button variant="outline" asChild>
                <a href="https://developers.facebook.com/apps/create/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Создать Facebook App
                </a>
              </Button>
              
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p><strong>При создании приложения:</strong></p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Выберите тип "Consumer" или "Business"</li>
                  <li>Добавьте продукт "Facebook Login"</li>
                  <li>Добавьте продукт "Instagram Basic Display" (если доступно)</li>
                  <li>В настройках OAuth добавьте Redirect URI: <code className="bg-white px-1 rounded">https://n8n.roboflow.space/webhook/authorize-ig</code></li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Шаг 3: Получите разрешения</h3>
              <p className="text-sm text-gray-600">
                В Facebook App Dashboard запросите следующие разрешения:
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <ul className="text-sm space-y-1">
                  <li>• <code>pages_manage_posts</code> - для публикации постов</li>
                  <li>• <code>pages_read_engagement</code> - для чтения статистики</li>
                  <li>• <code>pages_show_list</code> - для получения списка страниц</li>
                  <li>• <code>instagram_basic</code> - базовый доступ к Instagram</li>
                  <li>• <code>instagram_content_publish</code> - публикация в Instagram</li>
                </ul>
              </div>
            </div>

            <Button onClick={() => setStep('form')} className="w-full">
              Продолжить настройку
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Введите данные Facebook приложения</CardTitle>
        <CardDescription>
          Введите App ID и App Secret вашего Facebook приложения
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); handleStartOAuth(); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="appId">App ID *</Label>
            <Input
              id="appId"
              type="text"
              value={formData.appId}
              onChange={(e) => setFormData(prev => ({ ...prev, appId: e.target.value }))}
              placeholder="Введите App ID из Facebook Developer Console"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appSecret">App Secret *</Label>
            <Input
              id="appSecret"
              type="password"
              value={formData.appSecret}
              onChange={(e) => setFormData(prev => ({ ...prev, appSecret: e.target.value }))}
              placeholder="Введите App Secret из Facebook Developer Console"
              required
            />
          </div>



          <div className="space-y-2">
            <Label htmlFor="instagramId">Instagram Business Account ID (опционально)</Label>
            <Input
              id="instagramId"
              type="text"
              value={formData.instagramId}
              onChange={(e) => setFormData(prev => ({ ...prev, instagramId: e.target.value }))}
              placeholder="17841400455970028"
            />
            <p className="text-xs text-gray-500">
              Если знаете ID вашего Instagram Business аккаунта, введите его
            </p>
          </div>

          <div className="flex space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setStep('instructions')}
              className="flex-1"
            >
              Назад
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.appId || !formData.appSecret}
              className="flex-1"
            >
              {loading ? 'Подключение...' : 'Подключить Instagram'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default InstagramSetupWizard;