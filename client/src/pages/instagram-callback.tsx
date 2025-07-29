import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2, Instagram } from 'lucide-react';
import { useLocation } from 'wouter';

const InstagramCallback: React.FC = () => {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [accountData, setAccountData] = useState<any>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Получаем параметры из URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`Ошибка авторизации: ${error}`);
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Отсутствуют необходимые параметры авторизации');
          return;
        }

        // Отправляем данные на сервер для обработки
        const response = await fetch(`/api/instagram/auth/callback?code=${code}&state=${state}`);
        const data = await response.json();

        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Instagram успешно авторизован!');
          setAccountData(data.data);
          
          // Отправляем сообщение родительскому окну об успешной авторизации
          if (window.opener) {
            window.opener.postMessage({
              type: 'INSTAGRAM_OAUTH_SUCCESS',
              data: data.data
            }, window.location.origin);
          }
          
          // Закрываем окно через 3 секунды
          setTimeout(() => {
            window.close();
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Произошла ошибка при обработке авторизации');
        }
      } catch (error) {
        console.error('Callback error:', error);
        setStatus('error');
        setMessage('Произошла ошибка при обработке авторизации');
      }
    };

    handleCallback();
  }, []);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-center">Обрабатываем авторизацию Instagram...</p>
            <p className="text-sm text-muted-foreground text-center">
              Получаем долгосрочный токен и сохраняем настройки
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center space-y-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="text-center">
              <h3 className="font-semibold text-green-800">Успешно!</h3>
              <p className="text-green-700">{message}</p>
            </div>
            
            {accountData?.instagramAccounts && accountData.instagramAccounts.length > 0 && (
              <div className="w-full space-y-2">
                <h4 className="font-medium text-sm">Найденные Instagram аккаунты:</h4>
                {accountData.instagramAccounts.map((account: any, index: number) => (
                  <div key={index} className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-sm">
                    <div className="font-medium">@{account.username}</div>
                    <div className="text-muted-foreground">{account.name}</div>
                    <div className="text-xs text-muted-foreground">ID: {account.instagramId}</div>
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-sm text-muted-foreground text-center">
              Это окно закроется автоматически через несколько секунд
            </p>
            
            <Button 
              onClick={() => window.close()} 
              size="sm"
              className="mt-2"
            >
              Закрыть окно
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center space-y-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div className="text-center">
              <h3 className="font-semibold text-red-800">Ошибка</h3>
              <p className="text-red-700">{message}</p>
            </div>
            
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Проверьте настройки приложения в Facebook Developers и убедитесь, что:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Redirect URI корректно настроен</li>
                  <li>App ID и App Secret правильные</li>
                  <li>Все необходимые разрешения добавлены</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => window.close()} 
                size="sm"
                variant="outline"
              >
                Закрыть окно
              </Button>
              <Button 
                onClick={() => setLocation('/settings')} 
                size="sm"
              >
                Вернуться к настройкам
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Instagram className="h-5 w-5" />
            Instagram Авторизация
          </CardTitle>
          <CardDescription>
            Обработка OAuth ответа от Facebook/Instagram
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default InstagramCallback;