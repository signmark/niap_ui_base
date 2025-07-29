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
  Link as LinkIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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
    instagramId: instagramSettings.instagramId || ''
  });
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  
  const { toast } = useToast();

  // Webhook URL для N8N колбека
  const webhookUrl = 'https://n8n.roboflow.space/webhook/instagram-auth';
  const redirectUri = `${window.location.origin}/instagram-callback`;

  useEffect(() => {
    if (instagramSettings) {
      setFormData({
        appId: instagramSettings.appId || '',
        appSecret: instagramSettings.appSecret || '',
        instagramId: instagramSettings.instagramId || ''
      });
      
      // Если уже есть настройки, переходим к шагу 4
      if (instagramSettings.appId && instagramSettings.appSecret) {
        setCurrentStep(4);
      }
    }
  }, [instagramSettings]);

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
          instagramId: formData.instagramId
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
        body: {
          instagram: {
            appId: formData.appId,
            appSecret: formData.appSecret,
            instagramId: formData.instagramId
          }
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
              <h4 className="font-medium">Добавьте Instagram Basic Display</h4>
              <p className="text-sm text-muted-foreground">
                В разделе "Products" добавьте <strong>"Instagram Basic Display"</strong>
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
            Найдите App ID и App Secret в разделе "Basic Settings" вашего Facebook приложения
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="appId">App ID *</Label>
            <Input
              id="appId"
              type="text"
              placeholder="Например: 1234567890123456"
              value={formData.appId}
              onChange={(e) => setFormData(prev => ({ ...prev, appId: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="appSecret">App Secret *</Label>
            <Input
              id="appSecret"
              type="password"
              placeholder="Введите App Secret"
              value={formData.appSecret}
              onChange={(e) => setFormData(prev => ({ ...prev, appSecret: e.target.value }))}
            />
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
            Система автоматически получит долгосрочный токен и сохранит его в базе данных через N8N webhook
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Как это работает:</h4>
            <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
              <li>Откроется окно авторизации Facebook</li>
              <li>Вы авторизуете доступ к Instagram</li>
              <li>Система получит краткосрочный токен</li>
              <li>N8N автоматически обменяет его на долгосрочный токен</li>
              <li>Токен сохранится в базе данных кампании</li>
            </ol>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium">N8N Webhook URL:</h4>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md flex items-center justify-between">
              <code className="text-sm">{webhookUrl}</code>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(webhookUrl)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
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
          <h4 className="font-medium">Или сохраните текущие настройки:</h4>
          <Button 
            onClick={handleSaveSettings}
            variant="outline"
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить настройки
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Instagram API Setup Wizard</h3>
        <Badge variant="outline">Шаг {currentStep} из 4</Badge>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center space-x-2">
        {[1, 2, 3, 4].map((step) => (
          <React.Fragment key={step}>
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
            </div>
            {step < 4 && (
              <div className={`flex-1 h-1 ${step < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>
    </div>
  );
};

export default InstagramSetupWizardComplete;