import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, Instagram } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface InstagramSetupWizardProps {
  campaignId: string;
  instagramSettings?: {
    appId?: string;
    appSecret?: string;
    instagramId?: string;
  };
  onSettingsUpdate?: (settings: any) => void;
}

const InstagramSetupWizard: React.FC<InstagramSetupWizardProps> = ({ 
  campaignId, 
  instagramSettings = {}, 
  onSettingsUpdate 
}) => {
  const [formData, setFormData] = useState({
    appId: instagramSettings.appId || '',
    appSecret: instagramSettings.appSecret || '',
    instagramId: instagramSettings.instagramId || ''
  });
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();

  // Инициализация формы из переданных настроек
  useEffect(() => {
    if (instagramSettings) {
      setFormData({
        appId: instagramSettings.appId || '',
        appSecret: instagramSettings.appSecret || '',
        instagramId: instagramSettings.instagramId || ''
      });
    }
  }, [instagramSettings]);

  const handleSaveSettings = async () => {
    console.log('🔥 SAVE INSTAGRAM SETTINGS CALLED');
    console.log('🔥 FORM DATA:', formData);
    console.log('🔥 CAMPAIGN ID:', campaignId);
    
    if (!formData.appId || !formData.appSecret) {
      console.log('🔥 VALIDATION FAILED - missing fields');
      toast({
        title: "Ошибка",
        description: "Введите App ID и App Secret",
        variant: "destructive"
      });
      return;
    }

    console.log('🔥 VALIDATION PASSED');
    setLoading(true);

    try {
      // Сохраняем настройки Instagram в JSON кампании
      const instagramConfig = {
        appId: formData.appId,
        appSecret: formData.appSecret,
        instagramId: formData.instagramId || '',
        setupCompletedAt: new Date().toISOString()
      };

      // Отправляем данные на сервер для сохранения в social_media_settings
      const response = await apiRequest(`/api/campaigns/${campaignId}/instagram-settings`, {
        method: 'PATCH',
        data: instagramConfig
      });

      if (response) {
        // Обновляем родительский компонент
        if (onSettingsUpdate) {
          onSettingsUpdate({ instagram: instagramConfig });
        }

        toast({
          title: "Успешно сохранено",
          description: "Настройки Instagram сохранены в кампании",
          variant: "default"
        });
      }
      
    } catch (error) {
      console.error('Error saving Instagram settings:', error);
      toast({
        title: "Ошибка",
        description: (error as any)?.message || "Ошибка сохранения настроек",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Определяем есть ли уже сохраненные настройки
  const hasSettings = formData.appId && formData.appSecret;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Instagram className="h-6 w-6 text-pink-600" />
          <span>Instagram API настройки</span>
        </CardTitle>
        <CardDescription>
          Настройте API для публикации в Instagram через Facebook
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {hasSettings && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Instagram API настроен для этой кампании
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="appId">App ID *</Label>
              <Input
                id="appId"
                placeholder="Введите App ID из Facebook приложения"
                value={formData.appId}
                onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="appSecret">App Secret *</Label>
              <Input
                id="appSecret"
                type="password"
                placeholder="Введите App Secret из Facebook приложения"
                value={formData.appSecret}
                onChange={(e) => setFormData({ ...formData, appSecret: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="instagramId">Instagram Business Account ID (опционально)</Label>
              <Input
                id="instagramId"
                placeholder="ID Instagram Business аккаунта"
                value={formData.instagramId}
                onChange={(e) => setFormData({ ...formData, instagramId: e.target.value })}
              />
              <p className="text-sm text-gray-500 mt-1">
                Можно оставить пустым, будет определен автоматически
              </p>
            </div>

            <Button 
              onClick={handleSaveSettings} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Сохранение...
                </>
              ) : (
                hasSettings ? 'Обновить настройки' : 'Сохранить настройки'
              )}
            </Button>
          </div>

          <Separator />

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Как получить App ID и App Secret:</strong><br />
              1. Перейдите в <a href="https://developers.facebook.com/" target="_blank" className="text-blue-600 hover:underline">Facebook Developers</a><br />
              2. Создайте приложение типа "Business"<br />
              3. Добавьте продукт "Instagram Basic Display"<br />
              4. Скопируйте App ID и App Secret из настроек приложения
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
};

export default InstagramSetupWizard;