import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, User, Lock } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface InstagramDirectAuthProps {
  campaignId: string;
  onAuthSuccess: (sessionData: any) => void;
  existingSession?: any;
}

interface AuthResponse {
  success: boolean;
  challengeRequired?: boolean;
  sessionData?: any;
  message?: string;
}

export function InstagramDirectAuth({ campaignId, onAuthSuccess, existingSession }: InstagramDirectAuthProps) {
  const [credentials, setCredentials] = useState({
    username: existingSession?.username || '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [authStatus, setAuthStatus] = useState<'idle' | 'challenge' | 'success'>('idle');

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      return await apiRequest('POST', '/api/instagram-direct/login', {
        username,
        password,
        campaignId
      }) as AuthResponse;
    },
    onSuccess: (data) => {
      if (data.success) {
        if (data.challengeRequired) {
          setAuthStatus('challenge');
        } else {
          setAuthStatus('success');
          onAuthSuccess(data.sessionData);
        }
      }
    }
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/instagram-direct/confirm-session', {
        username: credentials.username,
        campaignId
      }) as AuthResponse;
    },
    onSuccess: (data) => {
      if (data.success) {
        setAuthStatus('success');
        onAuthSuccess(data.sessionData);
      }
    }
  });

  const handleLogin = () => {
    if (!credentials.username || !credentials.password) {
      return;
    }
    loginMutation.mutate(credentials);
  };

  const handleConfirmSession = () => {
    confirmMutation.mutate();
  };

  const isLoading = loginMutation.isPending || confirmMutation.isPending;
  const error = loginMutation.error || confirmMutation.error;

  if (existingSession?.status === 'active') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Instagram подключен
          </CardTitle>
          <CardDescription>
            Аккаунт @{existingSession.username} успешно авторизован
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>Пользователь: {existingSession.fullName}</div>
            <div>ID: {existingSession.userId}</div>
            <div>Дата авторизации: {new Date(existingSession.lastAuth).toLocaleDateString('ru-RU')}</div>
            <div>Действует до: {new Date(existingSession.expiresAt).toLocaleDateString('ru-RU')}</div>
          </div>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => {
              setAuthStatus('idle');
              setCredentials({ username: '', password: '' });
            }}
          >
            Сменить аккаунт
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Авторизация Instagram</CardTitle>
        <CardDescription>
          Введите данные вашего Instagram аккаунта для прямого подключения
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {authStatus === 'challenge' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Instagram требует подтверждение входа. Пожалуйста, откройте Instagram в браузере, 
              подтвердите вход и нажмите кнопку "Подтвердить сессию" ниже.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : 'Ошибка авторизации'}
            </AlertDescription>
          </Alert>
        )}

        {authStatus !== 'challenge' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Имя пользователя</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  placeholder="Введите username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Введите пароль"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button 
              onClick={handleLogin}
              disabled={!credentials.username || !credentials.password || isLoading}
              className="w-full"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Войти в Instagram
            </Button>
          </div>
        )}

        {authStatus === 'challenge' && (
          <Button 
            onClick={handleConfirmSession}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Подтвердить сессию
          </Button>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <div>• Ваши данные передаются напрямую в Instagram API</div>
          <div>• Пароль не сохраняется, только сессионные токены</div>
          <div>• Сессия действует 7 дней с автоматическим продлением</div>
        </div>
      </CardContent>
    </Card>
  );
}