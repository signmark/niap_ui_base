import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ExternalLink, ArrowRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface VkSetupWizardProps {
  campaignId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const VkSetupWizard: React.FC<VkSetupWizardProps> = ({ campaignId, onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [availableGroups, setAvailableGroups] = useState<Array<{
    id: string;
    name: string;
    screen_name: string;
    members_count: number;
  }>>([]);

  const getVkOAuthUrl = () => {
    // Используем разрешенный redirect_uri от VK
    const redirectUri = 'https://oauth.vk.com/blank.html';
    return `https://oauth.vk.com/authorize?client_id=6121396&scope=1073737727&redirect_uri=${encodeURIComponent(redirectUri)}&display=page&response_type=token&revoke=1`;
  };

  const steps = [
    {
      title: "Получение VK токена",
      description: "Авторизация в VK API для получения токена доступа"
    },
    {
      title: "Выбор группы",
      description: "Выбор VK группы для публикации контента"
    },
    {
      title: "Завершение настройки",
      description: "Сохранение настроек VK в кампанию"
    }
  ];

  const handleVkAuth = () => {
    setIsProcessing(true);
    
    // Открываем VK OAuth в новом окне
    window.open(
      getVkOAuthUrl(),
      'vk_auth',
      'width=600,height=600,scrollbars=yes,resizable=yes'
    );
    
    // Показываем инструкции пользователю для ручного копирования токена
  };

  const fetchVkGroups = async (token: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/vk/groups?access_token=${token}`);
      const data = await response.json();
      
      if (data.success && data.groups) {
        setAvailableGroups(data.groups);
        setCurrentStep(2);
      } else {
        throw new Error(data.error || 'Ошибка получения групп');
      }
    } catch (error: any) {
      console.error('Error fetching VK groups:', error);
      alert('Ошибка получения списка групп: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectVkGroup = async (groupId: string, groupName: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/vk-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          token: accessToken,
          groupId: groupId,
          groupName: groupName,
          setupCompletedAt: new Date().toISOString()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentStep(3);
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        throw new Error(data.error || 'Ошибка сохранения настроек');
      }
    } catch (error: any) {
      console.error('Error saving VK settings:', error);
      alert('Ошибка сохранения настроек: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Нажмите кнопку ниже для авторизации в VK API. После авторизации окно автоматически закроется.
              </AlertDescription>
            </Alert>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  VK OAuth Авторизация
                </CardTitle>
                <CardDescription>
                  Откроется новое окно для авторизации в VK API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleVkAuth}
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Обработка...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Авторизоваться в VK
                    </>
                  )}
                </Button>
                
                {isProcessing && (
                  <Alert>
                    <AlertDescription>
                      <strong>После авторизации:</strong><br/>
                      1. Скопируйте access_token из URL (после #access_token=)<br/>
                      2. Вставьте токен в поле ниже<br/>
                      3. Нажмите "Продолжить"
                    </AlertDescription>
                  </Alert>
                )}
                
                {isProcessing && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">VK Access Token:</label>
                    <input 
                      type="text"
                      placeholder="Вставьте access_token сюда"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button 
                      onClick={() => {
                        if (accessToken.trim()) {
                          setIsProcessing(false);
                          fetchVkGroups(accessToken.trim());
                        }
                      }}
                      disabled={!accessToken.trim()}
                      className="w-full"
                    >
                      Продолжить с токеном
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {accessToken && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ✅ Токен получен успешно! Загружаем список групп...
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Выберите VK группу для публикации контента:
              </AlertDescription>
            </Alert>

            <div className="grid gap-3">
              {availableGroups.map((group) => (
                <Card key={group.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold">{group.name}</h4>
                        <p className="text-sm text-gray-600">@{group.screen_name}</p>
                        <Badge variant="outline" className="mt-1">
                          {group.members_count} участников
                        </Badge>
                      </div>
                      <Button 
                        onClick={() => selectVkGroup(group.id, group.name)}
                        disabled={isProcessing}
                        size="sm"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Выбрать
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {availableGroups.length === 0 && !isProcessing && (
              <Alert>
                <AlertDescription>
                  Группы не найдены. Убедитесь, что у вас есть права администратора в VK группах.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 3:
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-xl font-semibold">Настройка VK завершена!</h3>
            <p className="text-gray-600">
              VK интеграция успешно настроена. Теперь вы можете публиковать контент в выбранную группу.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Настройка VK интеграции</h2>
        <div className="flex space-x-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${currentStep > index + 1 ? 'bg-green-500 text-white' : 
                  currentStep === index + 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}
              `}>
                {currentStep > index + 1 ? <CheckCircle className="h-4 w-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-1 mx-2 ${currentStep > index + 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <h3 className="font-semibold">{steps[currentStep - 1]?.title}</h3>
          <p className="text-sm text-gray-600">{steps[currentStep - 1]?.description}</p>
        </div>
      </div>

      {renderStep()}

      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        {currentStep === 3 && (
          <Button onClick={onComplete}>
            Завершить
          </Button>
        )}
      </div>
    </div>
  );
};

export default VkSetupWizard;