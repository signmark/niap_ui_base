import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ExternalLink, Loader2, Instagram, ArrowRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface InstagramSetupWizardProps {
  campaignId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const InstagramSetupWizardSimple: React.FC<InstagramSetupWizardProps> = ({ campaignId, onComplete, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<Array<{
    id: string;
    name: string;
    username?: string;
  }>>([]);
  const [formData, setFormData] = useState({
    appId: '',
    appSecret: '',
    accessToken: '',
    businessAccountId: ''
  });
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Добавляем консольный лог для диагностики
  console.log('Instagram Setup Wizard rendering with campaignId:', campaignId);

  // Загружаем существующие данные из кампании и проверяем Facebook
  useEffect(() => {
    const loadExistingSettings = async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/instagram-settings`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.settings) {
            const settings = data.settings;
            const accessToken = settings.accessToken || settings.longLivedToken || settings.token || '';
            
            setFormData({
              appId: settings.appId || '',
              appSecret: settings.appSecret || '',
              accessToken: accessToken,
              businessAccountId: settings.businessAccountId || settings.instagramId || ''
            });

            // Если есть токен - автоматически проверяем Facebook страницы
            if (accessToken) {
              console.log('🔍 Auto-checking Facebook pages for existing Instagram token...');
              try {
                const facebookResponse = await fetch(`/api/facebook/pages?token=${encodeURIComponent(accessToken)}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                  }
                });

                if (facebookResponse.ok) {
                  const facebookData = await facebookResponse.json();
                  console.log('🔍 Facebook pages found during loading:', facebookData);
                  
                  // Если найдена ровно одна Facebook страница - автоматически настраиваем её
                  if (facebookData.success && facebookData.pages && facebookData.pages.length === 1) {
                    const page = facebookData.pages[0];
                    console.log('🔧 Auto-configuring Facebook page during Instagram load:', page);
                    
                    // Проверяем что Facebook ещё не настроен
                    const currentFbResponse = await fetch(`/api/campaigns/${campaignId}/facebook-settings`, {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                      }
                    });

                    const currentFbData = await currentFbResponse.json();
                    const hasExistingFb = currentFbData.success && currentFbData.settings && currentFbData.settings.pageId;

                    if (!hasExistingFb) {
                      // Сохраняем Facebook настройки автоматически
                      const saveFacebookResponse = await fetch(`/api/campaigns/${campaignId}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                        },
                        body: JSON.stringify({
                          social_media_settings: {
                            facebook: {
                              token: accessToken,
                              pageId: page.id,
                              pageName: page.name,
                              autoConfiguredAt: new Date().toISOString()
                            }
                          }
                        })
                      });

                      if (saveFacebookResponse.ok) {
                        toast({
                          title: "Facebook настроен автоматически",
                          description: `Настроена страница: ${page.name}`,
                          variant: "default"
                        });
                        console.log('✅ Facebook page auto-configured during Instagram load');
                      }
                    }
                  }
                }
              } catch (fbError) {
                console.error('Error auto-checking Facebook pages:', fbError);
                // Не показываем ошибку пользователю
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading Instagram settings:', error);
      }
    };

    loadExistingSettings();
  }, [campaignId]);

  // Функция для загрузки доступных Instagram аккаунтов и автоматической настройки Facebook
  const handleDiscoverAccounts = async () => {
    if (!formData.accessToken) {
      toast({
        title: "Ошибка",
        description: "Введите Access Token для поиска аккаунтов",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Находим Instagram аккаунты
      const instagramResponse = await fetch(`/api/campaigns/${campaignId}/discover-instagram-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          accessToken: formData.accessToken
        })
      });

      const instagramData = await instagramResponse.json();
      
      if (instagramData.success && instagramData.accounts) {
        setAvailableAccounts(instagramData.accounts);
        setShowAccountSelection(true);
        
        // 2. Параллельно проверяем Facebook страницы тем же токеном
        try {
          console.log('🔍 Checking Facebook pages with Instagram token...');
          const facebookResponse = await fetch(`/api/facebook/pages?token=${encodeURIComponent(formData.accessToken)}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          });

          if (facebookResponse.ok) {
            const facebookData = await facebookResponse.json();
            console.log('🔍 Facebook pages found:', facebookData);
            
            // 3. Если найдена ровно одна Facebook страница - автоматически настраиваем её
            if (facebookData.success && facebookData.pages && facebookData.pages.length === 1) {
              const page = facebookData.pages[0];
              console.log('🔧 Auto-configuring single Facebook page:', page);
              
              // Сохраняем Facebook настройки автоматически
              const saveFacebookResponse = await fetch(`/api/campaigns/${campaignId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                  social_media_settings: {
                    facebook: {
                      token: formData.accessToken,
                      pageId: page.id,
                      pageName: page.name,
                      autoConfiguredAt: new Date().toISOString()
                    }
                  }
                })
              });

              if (saveFacebookResponse.ok) {
                toast({
                  title: "Facebook настроен автоматически",
                  description: `Настроена страница: ${page.name}`,
                  variant: "default"
                });
                console.log('✅ Facebook page auto-configured successfully');
              }
            } else if (facebookData.pages && facebookData.pages.length > 1) {
              toast({
                title: "Facebook страницы найдены",
                description: `Найдено ${facebookData.pages.length} страниц. Настройте вручную в разделе Facebook.`,
                variant: "default"
              });
            }
          }
        } catch (fbError) {
          console.error('Error checking Facebook pages:', fbError);
          // Не показываем ошибку пользователю, так как это дополнительная функция
        }

        toast({
          title: "Instagram аккаунты найдены",
          description: `Найдено ${instagramData.accounts.length} Instagram Business аккаунтов`
        });
      } else {
        throw new Error(instagramData.error || 'Instagram аккаунты не найдены');
      }
    } catch (error: any) {
      console.error('Error discovering Instagram accounts:', error);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Функция выбора Instagram аккаунта
  const handleSelectAccount = async (accountId: string, accountName: string) => {
    console.log('🔍 Selecting Instagram account:', { accountId, accountName });
    setFormData(prev => {
      const newData = { ...prev, businessAccountId: accountId };
      console.log('🔍 Updated formData:', newData);
      return newData;
    });
    setShowAccountSelection(false);
    
    // Сразу сохраняем выбранный аккаунт в базу данных
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          social_media_settings: {
            instagram: {
              appId: formData.appId,
              appSecret: formData.appSecret,
              accessToken: formData.accessToken,
              businessAccountId: accountId, // Используем новый ID
              longLivedToken: formData.accessToken,
              setupCompletedAt: new Date().toISOString()
            }
          }
        })
      });

      if (response.ok) {
        toast({
          title: "Аккаунт выбран",
          description: `Выбран аккаунт: ${accountName} (ID: ${accountId})`
        });
        
        // Уведомляем родительский компонент об изменениях
        if (onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      console.error('Error saving selected account:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить выбранный аккаунт",
        variant: "destructive"
      });
    }
  };

  const handleGetToken = async () => {
    if (!formData.appId || !formData.appSecret) {
      toast({
        title: "Ошибка",
        description: "Введите App ID и App Secret",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/instagram/auth/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          appId: formData.appId,
          appSecret: formData.appSecret,
          redirectUri: `${window.location.origin}/instagram-callback`,
          campaignId: campaignId
        })
      });

      const data = await response.json();
      
      if (data.success && data.authUrl) {
        // Открываем окно авторизации точно как VK
        window.open(data.authUrl, 'instagram-auth', 'width=600,height=600');
        
        toast({
          title: "Авторизация Instagram",
          description: "Скопируйте полученный токен в поле ниже, затем выберите аккаунт"
        });
      } else {
        throw new Error(data.error || 'Ошибка создания ссылки авторизации');
      }
    } catch (error: any) {
      console.error('Error starting Instagram OAuth:', error);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!formData.accessToken || !formData.businessAccountId) {
      toast({
        title: "Ошибка",
        description: "Введите Access Token и Business Account ID",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          social_media_settings: {
            instagram: {
              appId: formData.appId,
              appSecret: formData.appSecret,
              accessToken: formData.accessToken,
              businessAccountId: formData.businessAccountId,
              longLivedToken: formData.accessToken,
              setupCompletedAt: new Date().toISOString()
            }
          }
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Успех",
          description: "Instagram настроен успешно!",
          variant: "default"
        });
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        throw new Error(data.error || 'Ошибка сохранения настроек');
      }
    } catch (error: any) {
      console.error('Error saving Instagram settings:', error);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Обработка ошибок рендеринга
  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert>
          <AlertDescription>
            Ошибка загрузки мастера настройки Instagram: {error}
          </AlertDescription>
        </Alert>
        <Button onClick={onCancel} className="mt-4">
          Закрыть
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold">Настройка Instagram API</h3>
          <p className="text-sm text-gray-600">Пошаговая настройка для публикации контента</p>
          {/* Debug info */}
          <p className="text-xs text-gray-400 mt-1">
            Debug: businessAccountId = {formData.businessAccountId || 'не выбран'}
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </Button>
      </div>
      
      <Alert className="py-3">
        <AlertDescription>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Введите App ID и App Secret из Facebook приложения</li>
            <li>Нажмите "Получить токен Instagram" для авторизации</li>
            <li>Скопируйте полученный токен в поле "Access Token"</li>
            <li>Выберите Instagram Business аккаунт из списка</li>
            <li>Сохраните настройки</li>
          </ol>
        </AlertDescription>
      </Alert>
        
      <Card>
        <CardContent className="pt-4 space-y-3">
            {/* App ID и App Secret */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appId">App ID *</Label>
                <Input
                  id="appId"
                  type="text"
                  value={formData.appId}
                  onChange={(e) => setFormData(prev => ({ ...prev, appId: e.target.value }))}
                  placeholder="Введите App ID"
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
                  placeholder="Введите App Secret"
                  required
                />
              </div>
            </div>

            {/* Кнопка получения токена */}
            <Button 
              onClick={handleGetToken}
              disabled={isProcessing || !formData.appId || !formData.appSecret}
              className="w-full"
              variant="outline"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Получение токена...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Получить токен Instagram
                </>
              )}
            </Button>

            {/* Access Token */}
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token *</Label>
              <Input
                id="accessToken"
                type="text"
                value={formData.accessToken}
                onChange={(e) => setFormData(prev => ({ ...prev, accessToken: e.target.value }))}
                placeholder="Вставьте полученный токен"
                required
              />
            </div>

            {/* Кнопка поиска аккаунтов */}
            {formData.accessToken && !showAccountSelection && (
              <Button 
                onClick={handleDiscoverAccounts}
                disabled={isProcessing}
                className="w-full"
                variant="outline"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Поиск аккаунтов...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Найти Instagram аккаунты
                  </>
                )}
              </Button>
            )}

            {/* Список доступных аккаунтов */}
            {showAccountSelection && availableAccounts.length > 0 && (
              <div className="space-y-3">
                <Label>Выберите Instagram Business аккаунт:</Label>
                <div className="space-y-2">
                  {availableAccounts.map((account) => (
                    <Card key={account.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">{account.name}</h4>
                            {account.username && (
                              <p className="text-sm text-gray-600">@{account.username}</p>
                            )}
                            <Badge variant="outline" className="mt-1">
                              ID: {account.id}
                            </Badge>
                          </div>
                          <Button 
                            onClick={() => handleSelectAccount(account.id, account.name)}
                            disabled={isProcessing}
                            size="sm"
                          >
                            <>
                              Выбрать
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Business Account ID (всегда отображается если есть токен) */}
            {formData.accessToken && (
              <div className="space-y-2">
                <Label htmlFor="businessAccountId">Business Account ID</Label>
                <Input
                  id="businessAccountId"
                  type="text"
                  value={formData.businessAccountId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessAccountId: e.target.value }))}
                  placeholder={formData.businessAccountId ? "ID выбранного аккаунта" : "Сначала найдите и выберите аккаунт"}
                  readOnly={!!formData.businessAccountId}
                />
                {formData.businessAccountId && (
                  <p className="text-xs text-green-600">✓ Аккаунт выбран</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      
      {/* Кнопки управления */}
      <div className="mt-6 flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => {
            console.log('Instagram wizard: Отмена нажата');
            if (onCancel) {
              onCancel();
            }
          }}
          disabled={isProcessing}
        >
          Отмена
        </Button>
        
        <Button 
          onClick={handleSaveSettings}
          disabled={isProcessing || !formData.accessToken || !formData.businessAccountId}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Сохранить настройки
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default InstagramSetupWizardSimple;