import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, User, Calendar, CheckCircle, XCircle, AlertCircle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InstagramDirectAuthProps {
  campaignId: string;
  onAuthComplete?: () => void;
  initialSettings?: any;
}

interface InstagramSessionStatus {
  isAuthenticated: boolean;
  username?: string;
  userId?: string;
  fullName?: string;
  status?: 'active' | 'challenge_required' | 'failed' | 'expired';
  lastAuth?: string;
  expiresAt?: string;
  error?: string;
}

export function InstagramDirectAuth({ campaignId, onAuthComplete, initialSettings }: InstagramDirectAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [sessionStatus, setSessionStatus] = useState<InstagramSessionStatus>({
    isAuthenticated: false
  });
  const [authStep, setAuthStep] = useState<'input' | 'authenticating' | 'challenge' | 'completed' | 'error'>('input');
  const [errorMessage, setErrorMessage] = useState('');
  
  const { toast } = useToast();

  // Проверяем текущий статус сессии при загрузке
  useEffect(() => {
    checkSessionStatus();
  }, [campaignId]);

  // Загружаем статус из initialSettings если есть
  useEffect(() => {
    if (initialSettings?.instagram) {
      const instagramData = initialSettings.instagram;
      setSessionStatus({
        isAuthenticated: instagramData.isAuthenticated || false,
        username: instagramData.username,
        userId: instagramData.userId,
        fullName: instagramData.fullName,
        status: instagramData.status || 'failed',
        lastAuth: instagramData.lastAuthDate,
        expiresAt: instagramData.expiresAt
      });
    }
  }, [initialSettings]);

  const checkSessionStatus = async () => {
    try {
      const response = await api.get(`/api/campaigns/${campaignId}`);
      const instagramSettings = response.data?.social_media_settings?.instagram;
      
      if (instagramSettings) {
        setSessionStatus({
          isAuthenticated: instagramSettings.isAuthenticated || false,
          username: instagramSettings.username,
          userId: instagramSettings.userId,
          fullName: instagramSettings.fullName,
          status: instagramSettings.status || 'failed',
          lastAuth: instagramSettings.lastAuthDate,
          expiresAt: instagramSettings.expiresAt
        });
      }
    } catch (error) {
      console.error('Ошибка проверки статуса Instagram сессии:', error);
    }
  };

  const startAuthentication = async () => {
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Ошибка",
        description: "Введите логин и пароль Instagram",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setAuthStep('authenticating');
    setErrorMessage('');

    try {
      const response = await api.post('/api/instagram-direct/login', {
        username: credentials.username,
        password: credentials.password,
        campaignId: campaignId
      });

      if (response.data.success) {
        if (response.data.challengeRequired) {
          setAuthStep('challenge');
          toast({
            title: "Требуется подтверждение",
            description: "Instagram требует подтверждение входа. Пожалуйста, подтвердите вход в браузере Instagram.",
            variant: "default"
          });
        } else {
          setAuthStep('completed');
          setSessionStatus(response.data.sessionData);
          toast({
            title: "Успешно",
            description: `Авторизация выполнена для @${response.data.sessionData.username}`,
            variant: "default"
          });
          setIsDialogOpen(false);
          onAuthComplete?.();
        }
      } else {
        throw new Error(response.data.message || 'Ошибка авторизации');
      }
    } catch (error: any) {
      console.error('Ошибка авторизации Instagram:', error);
      setAuthStep('error');
      const errorMsg = error.response?.data?.message || error.message || 'Неизвестная ошибка авторизации';
      setErrorMessage(errorMsg);
      toast({
        title: "Ошибка авторизации",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSession = async () => {
    setIsLoading(true);
    setAuthStep('authenticating');

    try {
      const response = await api.post('/api/instagram-direct/confirm-session', {
        username: credentials.username,
        campaignId: campaignId
      });

      if (response.data.success) {
        setAuthStep('completed');
        setSessionStatus(response.data.sessionData);
        toast({
          title: "Авторизация завершена",
          description: `Сессия Instagram подтверждена для @${response.data.sessionData.username}`,
          variant: "default"
        });
        setIsDialogOpen(false);
        onAuthComplete?.();
      } else {
        throw new Error(response.data.message || 'Ошибка подтверждения сессии');
      }
    } catch (error: any) {
      console.error('Ошибка подтверждения сессии:', error);
      setAuthStep('error');
      const errorMsg = error.response?.data?.message || error.message || 'Ошибка подтверждения сессии';
      setErrorMessage(errorMsg);
      toast({
        title: "Ошибка",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAuth = () => {
    setAuthStep('input');
    setCredentials({ username: '', password: '' });
    setErrorMessage('');
    setIsLoading(false);
  };

  const reauthenticate = () => {
    setCredentials({ username: sessionStatus.username || '', password: '' });
    setIsDialogOpen(true);
    resetAuth();
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'challenge_required': return 'bg-yellow-500';
      case 'expired': return 'bg-orange-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'active': return 'Активен';
      case 'challenge_required': return 'Требуется подтверждение';
      case 'expired': return 'Истек срок действия';
      case 'failed': return 'Ошибка авторизации';
      default: return 'Не авторизован';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Неизвестно';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Instagram - Прямая авторизация
        </CardTitle>
        <CardDescription>
          Авторизация через логин и пароль для персональных аккаунтов Instagram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessionStatus.isAuthenticated ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span className="font-medium">@{sessionStatus.username}</span>
                </div>
                <Badge className={getStatusColor(sessionStatus.status)}>
                  {getStatusText(sessionStatus.status)}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={reauthenticate}>
                Переавторизоваться
              </Button>
            </div>
            
            {sessionStatus.fullName && (
              <div className="text-sm text-muted-foreground">
                {sessionStatus.fullName}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Последняя авторизация:</div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(sessionStatus.lastAuth)}
                </div>
              </div>
              {sessionStatus.expiresAt && (
                <div>
                  <div className="text-muted-foreground">Истекает:</div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(sessionStatus.expiresAt)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center py-4">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Instagram не авторизован</p>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  Войти через логин/пароль
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Авторизация Instagram</DialogTitle>
                  <DialogDescription>
                    Введите данные вашего аккаунта Instagram для авторизации
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {authStep === 'input' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="username">Логин Instagram</Label>
                        <Input
                          id="username"
                          type="text"
                          placeholder="username"
                          value={credentials.username}
                          onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Пароль</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={credentials.password}
                          onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                      <Button 
                        onClick={startAuthentication} 
                        className="w-full"
                        disabled={isLoading || !credentials.username || !credentials.password}
                      >
                        Войти
                      </Button>
                    </>
                  )}
                  
                  {authStep === 'authenticating' && (
                    <div className="text-center py-4">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
                      <p>Выполняется авторизация...</p>
                    </div>
                  )}
                  
                  {authStep === 'challenge' && (
                    <div className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Instagram требует подтверждение входа. Пожалуйста:
                          <br />1. Откройте Instagram в браузере
                          <br />2. Подтвердите вход с этого устройства
                          <br />3. Нажмите "Подтвердить сессию" ниже
                        </AlertDescription>
                      </Alert>
                      <div className="flex gap-2">
                        <Button 
                          onClick={confirmSession} 
                          className="flex-1"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Проверка...
                            </>
                          ) : (
                            'Подтвердить сессию'
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={resetAuth}
                          disabled={isLoading}
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {authStep === 'error' && (
                    <div className="space-y-4">
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          {errorMessage}
                        </AlertDescription>
                      </Alert>
                      <Button 
                        onClick={resetAuth} 
                        variant="outline" 
                        className="w-full"
                      >
                        Попробовать снова
                      </Button>
                    </div>
                  )}
                  
                  {authStep === 'completed' && (
                    <div className="text-center py-4">
                      <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
                      <p>Авторизация успешно завершена!</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}