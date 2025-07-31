import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Facebook, 
  Instagram, 
  Settings, 
  Copy,
  ChevronRight,
  User,
  Key,
  Link as LinkIcon,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import FacebookGroupsSelector from './FacebookGroupsSelector';

interface InstagramSetupWizardProps {
  campaignId: string;
  instagramSettings?: {
    appId?: string;
    appSecret?: string;
    instagramId?: string;
    accessToken?: string;
  };
  onSettingsUpdate?: (settings: any) => void;
}

const InstagramSetupWizardComplete: React.FC<InstagramSetupWizardProps> = ({ 
  campaignId, 
  instagramSettings = {}, 
  onSettingsUpdate 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    appId: instagramSettings.appId || '',
    appSecret: instagramSettings.appSecret || '',
    instagramId: instagramSettings.instagramId || '',
    accessToken: instagramSettings.accessToken || ''
  });
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [facebookToken, setFacebookToken] = useState('');
  
  const { toast } = useToast();

  // Webhook URL для N8N колбека
  const webhookUrl = 'https://n8n.roboflow.space/webhook/instagram-auth';
  const redirectUri = `${window.location.origin}/instagram-callback`;

  useEffect(() => {
    if (instagramSettings) {
      setFormData({
        appId: instagramSettings.appId || '',
        appSecret: instagramSettings.appSecret || '',
        instagramId: instagramSettings.instagramId || '',
        accessToken: instagramSettings.accessToken || ''
      });
      
      // Если уже есть настройки, переходим к шагу 4
      if (instagramSettings.appId && instagramSettings.appSecret) {
        setCurrentStep(4);
      }
    }
  }, [instagramSettings]);

  // Обработчик postMessage от OAuth callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'INSTAGRAM_OAUTH_SUCCESS') {
        console.log('🎉 OAUTH SUCCESS - Received from callback:', event.data.data);
        
        // Обновляем форму с полученными данными
        if (event.data.data.token) {
          setFormData(prev => ({
            ...prev,
            accessToken: event.data.data.token
          }));
          
          toast({
            title: "Успешно!",
            description: "Instagram авторизован и токен получен",
            variant: "default"
          });
          
          // Вызываем callback для обновления родительского компонента
          // Этот callback должен перезагрузить данные из базы
          if (onSettingsUpdate) {
            onSettingsUpdate({
              ...event.data.data,
              needsRefresh: true // Флаг для перезагрузки данных
            });
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSettingsUpdate, toast]);

  // Слушатель сообщений из OAuth callback окна
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('📡 WIZARD - Message received from callback:', event.data);
      
      if (event.origin !== window.location.origin) {
        console.log('❌ WIZARD - Origin mismatch, ignoring message');
        return;
      }

      if (event.data.type === 'INSTAGRAM_OAUTH_SUCCESS') {
        console.log('✅ WIZARD - OAuth success message received!');
        console.log('📋 WIZARD - OAuth data:', event.data.data);
        
        // Обновляем локальное состояние с полученным токеном
        if (event.data.data.token) {
          console.log('🔑 WIZARD - Updating accessToken in form:', event.data.data.token.substring(0, 20) + '...');
          setFormData(prev => ({
            ...prev,
            accessToken: event.data.data.token
          }));
          
          // Сохраняем токен для Facebook групп и переходим к шагу 5
          setFacebookToken(event.data.data.token);
          setCurrentStep(5);
        }
        
        // Обновляем настройки через callback
        if (onSettingsUpdate && event.data.data) {
          console.log('🔄 WIZARD - Calling onSettingsUpdate callback');
          onSettingsUpdate(event.data.data);
        }
        
        toast({
          title: "Instagram авторизован!",
          description: "Токен получен и сохранен в настройки кампании"
        });
        
        console.log('✅ WIZARD - OAuth processing complete, stopping loading state');
        setOauthLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSettingsUpdate, toast]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Скопировано!",
      description: "Текст скопирован в буфер обмена"
    });
  };

  const startOAuthFlow = async () => {
    if (!formData.appId || !formData.appSecret) {
      toast({
        title: "Ошибка",
        description: "Введите App ID и App Secret"
      });
      return;
    }

    setOauthLoading(true);
    
    try {
      // Используем код из прикрепленного файла для создания OAuth URL
      const response = await fetch('/api/instagram/auth/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId: formData.appId,
          appSecret: formData.appSecret,
          redirectUri: redirectUri,
          webhookUrl: webhookUrl,
          instagramId: formData.instagramId,
          campaignId: campaignId
        })
      });

      const data = await response.json();
      
      if (data.authUrl) {
        setAuthUrl(data.authUrl);
        // Открываем OAuth окно
        window.open(data.authUrl, 'instagram-auth', 'width=600,height=700');
        
        toast({
          title: "OAuth авторизация",
          description: "Откроется окно для авторизации Instagram"
        });
      } else {
        throw new Error(data.error || 'Не удалось создать URL авторизации');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      toast({
        title: "Ошибка OAuth",
        description: error instanceof Error ? error.message : "Произошла ошибка"
      });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!formData.appId || !formData.appSecret) {
      toast({
        title: "Ошибка",
        description: "Заполните все обязательные поля"
      });
      return;
    }

    setLoading(true);
    
    try {
      await apiRequest(`/api/campaigns/${campaignId}/instagram-settings`, {
        method: 'PATCH',
        data: {
          appId: formData.appId,
          appSecret: formData.appSecret,
          instagramId: formData.instagramId,
          accessToken: formData.accessToken
        }
      });

      toast({
        title: "Успех!",
        description: "Instagram настройки сохранены"
      });

      if (onSettingsUpdate) {
        onSettingsUpdate(formData);
      }
    } catch (error) {
      console.error('Error saving Instagram settings:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Facebook className="h-5 w-5 text-blue-600" />
          Шаг 1: Создайте Facebook страницу
        </CardTitle>
        <CardDescription>
          Сначала необходимо создать Facebook страницу и привязать к ней Instagram аккаунт
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Instagram className="h-4 w-4" />
          <AlertDescription>
            Instagram API работает только через Facebook Business. Необходимо иметь бизнес аккаунт Instagram, привязанный к Facebook странице.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">1</Badge>
            <div>
              <h4 className="font-medium">Создайте Facebook страницу</h4>
              <p className="text-sm text-muted-foreground">
                Перейдите на <strong>facebook.com</strong> и создайте бизнес-страницу для вашего проекта
              </p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <a href="https://www.facebook.com/pages/create" target="_blank" rel="noopener noreferrer">
                  Создать страницу <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">2</Badge>
            <div>
              <h4 className="font-medium">Переведите Instagram в бизнес режим</h4>
              <p className="text-sm text-muted-foreground">
                В приложении Instagram: Настройки → Аккаунт → Переключиться на профессиональный аккаунт
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">3</Badge>
            <div>
              <h4 className="font-medium">Привяжите Instagram к Facebook странице</h4>
              <p className="text-sm text-muted-foreground">
                В Instagram: Настройки → Бизнес → Привязать страницу Facebook
              </p>
            </div>
          </div>
        </div>

        <Button onClick={() => setCurrentStep(2)} className="w-full">
          Продолжить <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-600" />
          Шаг 2: Создайте Facebook приложение
        </CardTitle>
        <CardDescription>
          Создайте Facebook приложение для получения API ключей
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">1</Badge>
            <div>
              <h4 className="font-medium">Перейдите в Facebook Developers</h4>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">
                  Открыть developers.facebook.com <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">2</Badge>
            <div>
              <h4 className="font-medium">Создайте новое приложение</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Выберите тип: <strong>"Business"</strong> или <strong>"Other"</strong>
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">3</Badge>
            <div>
              <h4 className="font-medium">Настройте redirect URI</h4>
              <p className="text-sm text-muted-foreground mb-2">
                В настройках приложения добавьте следующий redirect URI:
              </p>
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md flex items-center justify-between">
                <code className="text-sm">{redirectUri}</code>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(redirectUri)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">4</Badge>
            <div>
              <h4 className="font-medium">Добавьте продукты в приложение</h4>
              <p className="text-sm text-muted-foreground mb-2">
                В разделе "Products" добавьте:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><strong>"Instagram Basic Display"</strong> - для доступа к Instagram</li>
                <li><strong>"Facebook Login"</strong> - для авторизации</li>
              </ul>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">5</Badge>
            <div>
              <h4 className="font-medium">Настройте разрешения</h4>
              <p className="text-sm text-muted-foreground mb-2">
                В Instagram Basic Display → Settings добавьте разрешения:
              </p>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono">
                email,<br/>
                public_profile
              </div>
              <p className="text-xs text-yellow-600 mt-2">
                ⚠️ Используем только базовые разрешения, которые точно работают. 
                Дополнительные разрешения можно добавить позже через App Review.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            Назад
          </Button>
          <Button onClick={() => setCurrentStep(3)} className="flex-1">
            Продолжить <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5 text-blue-600" />
          Шаг 3: Введите данные приложения
        </CardTitle>
        <CardDescription>
          Скопируйте App ID и App Secret из Facebook приложения
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Важно:</strong> Это НЕ токены Instagram! Нужны именно App ID и App Secret из настроек Facebook приложения в разделе "Basic Settings"
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="appId">Facebook App ID *</Label>
            <Input
              id="appId"
              type="text"
              placeholder="Только цифры, например: 1234567890123456"
              value={formData.appId}
              onChange={(e) => {
                // Оставляем только цифры
                const value = e.target.value.replace(/\D/g, '');
                setFormData(prev => ({ ...prev, appId: value }));
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              15-16 цифр из настроек Facebook приложения (НЕ Instagram токен!)
            </p>
            {formData.appId && formData.appId.length < 10 && (
              <p className="text-xs text-red-500 mt-1">
                Слишком короткий App ID - проверьте правильность
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="appSecret">Facebook App Secret *</Label>
            <Input
              id="appSecret"
              type="password"
              placeholder="Строка из букв и цифр, начинается с цифр"
              value={formData.appSecret}
              onChange={(e) => setFormData(prev => ({ ...prev, appSecret: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Секретный ключ из настроек Facebook приложения
            </p>
          </div>

          <div>
            <Label htmlFor="accessToken">Access Token</Label>
            <Input
              id="accessToken"
              type="text"
              placeholder="Будет получен автоматически после OAuth авторизации"
              value={formData.accessToken}
              onChange={(e) => setFormData(prev => ({ ...prev, accessToken: e.target.value }))}
              readOnly
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.accessToken ? 'Токен получен ✓' : 'Для получения токена перейдите к шагу 4'}
            </p>
          </div>
          
          <div>
            <Label htmlFor="instagramId">Instagram Business Account ID (опционально)</Label>
            <Input
              id="instagramId"
              type="text"
              placeholder="Если известен, введите Instagram ID"
              value={formData.instagramId}
              onChange={(e) => setFormData(prev => ({ ...prev, instagramId: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Будет получен автоматически после авторизации
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentStep(2)}>
            Назад
          </Button>
          <Button 
            onClick={() => setCurrentStep(4)} 
            className="flex-1"
            disabled={!formData.appId || !formData.appSecret}
          >
            Продолжить <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-green-600" />
          Шаг 4: Авторизация Instagram
        </CardTitle>
        <CardDescription>
          Получите долгосрочный токен доступа через OAuth
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Instagram className="h-4 w-4" />
          <AlertDescription>
            Система автоматически получит долгосрочный токен и сохранит его в настройках кампании
          </AlertDescription>
        </Alert>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Как это работает:</h4>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
            <li>Откроется окно авторизации Facebook</li>
            <li>Вы авторизуете доступ к Instagram Business аккаунту</li>
            <li>Система получит краткосрочный токен и обменяет на долгосрочный</li>
            <li>Все данные Instagram сохранятся в настройках этой кампании</li>
            <li>Готово! Можно публиковать контент в Instagram</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentStep(3)}>
            Назад
          </Button>
          <Button 
            onClick={startOAuthFlow}
            disabled={oauthLoading || !formData.appId || !formData.appSecret}
            className="flex-1"
          >
            {oauthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Авторизовать Instagram
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-medium">Или сохраните настройки и перейдите к группам:</h4>
          <div className="flex gap-2">
            <Button 
              onClick={handleSaveSettings}
              variant="outline"
              disabled={loading}
              className="flex-1"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить настройки
            </Button>
            <Button 
              onClick={() => {
                setFacebookToken(formData.accessToken);
                setCurrentStep(5);
              }}
              disabled={!formData.accessToken}
              className="flex-1"
            >
              К группам Facebook <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep5 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-600" />
          Шаг 5: Facebook Группы (Дополнительно)
        </CardTitle>
        <CardDescription>
          Настройте автоматическую публикацию в Facebook группы через Pages API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Facebook className="h-4 w-4" />
          <AlertDescription>
            Система автоматически найдет группы, связанные с вашими Facebook страницами. 
            Это позволит публиковать в группы без App Review процесса.
          </AlertDescription>
        </Alert>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Как работает интеграция с группами:</h4>
          <ol className="text-sm text-purple-800 dark:text-purple-200 space-y-1 list-decimal list-inside">
            <li>Система использует ваш Instagram/Facebook токен</li>
            <li>Автоматически обнаруживает все доступные группы через Pages API</li>
            <li>Позволяет выбрать группы для публикации</li>
            <li>Сохраняет настройки в этой кампании</li>
            <li>Публикация происходит через N8N без дополнительных разрешений</li>
          </ol>
        </div>

        {facebookToken && (
          <FacebookGroupsSelector 
            campaignId={campaignId}
            accessToken={facebookToken}
            onGroupsSelected={(groups) => {
              toast({
                title: "Facebook группы настроены",
                description: `Выбрано ${groups.length} групп для автоматической публикации`,
              });
            }}
          />
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentStep(4)}>
            Назад
          </Button>
          <Button 
            onClick={() => {
              toast({
                title: "Настройка завершена",
                description: "Instagram и Facebook интеграция готова к использованию",
              });
              onSettingsUpdate?.(formData);
            }}
            className="flex-1"
          >
            Завершить настройку <CheckCircle className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <Separator />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Настройка групп не обязательна. Вы можете пропустить этот шаг и настроить группы позже в настройках кампании.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const resetWizard = () => {
    setFormData({
      appId: '',
      appSecret: '',
      accessToken: '',
      instagramId: ''
    });
    setCurrentStep(1);
    setFacebookToken('');
    toast({
      title: "Настройки сброшены",
      description: "Можете начать заново с новым Facebook приложением"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Instagram API Setup Wizard</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={resetWizard}>
            Сбросить настройки
          </Button>
          <Badge variant="outline">Шаг {currentStep} из 5</Badge>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center space-x-2">
        {[1, 2, 3, 4, 5].map((step) => (
          <div key={step} className="flex items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
            </div>
            {step < 5 && (
              <div className={`flex-1 h-1 ${step < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </div>
    </div>
  );
};

export default InstagramSetupWizardComplete;