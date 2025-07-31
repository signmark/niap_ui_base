import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";

const facebookSetupSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  manualPageId: z.string().optional(),
  manualPageName: z.string().optional(),
});

type FacebookSetupForm = z.infer<typeof facebookSetupSchema>;

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
  tasks?: string[];
}

interface FacebookSetupWizardProps {
  campaignId: string;
  onComplete: (data: { token: string; pageId: string; pageName: string }) => void;
  onCancel: () => void;
}

export default function FacebookSetupWizard({
  campaignId,
  onComplete,
  onCancel,
}: FacebookSetupWizardProps) {
  const [pages, setPages] = useState<any[]>([]);
  const [isPagesLoading, setIsPagesLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const { toast } = useToast();

  const form = useForm<FacebookSetupForm>({
    resolver: zodResolver(facebookSetupSchema),
    defaultValues: {
      token: "",
      manualPageId: "",
      manualPageName: "",
    },
  });

  // Функция для диагностики Facebook токена
  const debugFacebookToken = async () => {
    const formData = form.getValues();
    const token = formData.token;
    
    if (!token || token.length < 10) {
      toast({
        title: "Ошибка",
        description: "Введите действительный токен доступа",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/facebook/debug-token?token=${encodeURIComponent(token)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        const permissions = data.permissions.map((p: any) => p.permission).join(', ');
        const hasPublishToGroups = data.permissions.some((p: any) => p.permission === 'publish_to_groups');
        const hasPagesPosts = data.permissions.some((p: any) => p.permission === 'pages_manage_posts');
        const hasPagesEngagement = data.permissions.some((p: any) => p.permission === 'pages_read_engagement');
        const hasInstagramBasic = data.permissions.some((p: any) => p.permission === 'instagram_basic');
        const hasInstagramPublish = data.permissions.some((p: any) => p.permission === 'instagram_content_publish');
        
        console.log('🔍 Facebook токен разрешения:', {
          permissions,
          hasPublishToGroups,
          hasPagesPosts,
          hasPagesEngagement,
          hasInstagramBasic,
          hasInstagramPublish,
          user: data.user,
          pages: data.pages
        });

        const missingPermissions = [];
        if (!hasPublishToGroups) missingPermissions.push('publish_to_groups');
        if (!hasPagesPosts) missingPermissions.push('pages_manage_posts');
        if (!hasPagesEngagement) missingPermissions.push('pages_read_engagement');
        if (!hasInstagramBasic) missingPermissions.push('instagram_basic');
        if (!hasInstagramPublish) missingPermissions.push('instagram_content_publish');

        toast({
          title: "Диагностика токена",
          description: missingPermissions.length > 0 
            ? `Отсутствуют разрешения: ${missingPermissions.join(', ')}. Необходимо повторно авторизоваться через Instagram Setup Wizard.`
            : `Токен имеет все необходимые разрешения: ${permissions}`,
          variant: missingPermissions.length > 0 ? "destructive" : "default"
        });
      } else {
        toast({
          title: "Ошибка диагностики",
          description: data.error || "Не удалось проверить токен",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Debug token error:', error);
      toast({
        title: "Ошибка диагностики",
        description: "Произошла ошибка при проверке токена",
        variant: "destructive",
      });
    }
  };

  // Загрузка существующих Facebook настроек при открытии wizard
  useEffect(() => {
    const loadFacebookSettings = async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        const data = await response.json();
        if (data.social_media_settings?.facebook?.token) {
          form.setValue('token', data.social_media_settings.facebook.token);
          // Автоматически загружаем страницы если токен уже есть
          handleFetchPages();
        }
      } catch (error) {
        console.error('Ошибка загрузки Facebook настроек:', error);
      }
    };

    loadFacebookSettings();
  }, [campaignId]);

  // Функция для получения Instagram связанных страниц
  const handleFetchInstagramConnectedPages = async () => {
    setIsPagesLoading(true);
    
    try {
      console.log('Facebook Wizard: Получение Instagram связанных страниц из настроек кампании...');
      
      // Сначала получаем Instagram токен из настроек кампании
      const campaignResponse = await fetch(`/api/campaigns/${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      const campaignData = await campaignResponse.json();
      console.log('Facebook Wizard: Данные кампании получены:', campaignData);
      
      // Ищем Instagram токен в настройках
      const instagramSettings = campaignData.data?.social_media_settings?.instagram;
      const instagramToken = instagramSettings?.accessToken || 
                           instagramSettings?.token ||
                           instagramSettings?.longLivedToken;
      
      console.log('Facebook Wizard: Instagram настройки найдены:', {
        hasInstagramSettings: !!instagramSettings,
        tokenKeys: instagramSettings ? Object.keys(instagramSettings) : [],
        tokenLength: instagramToken ? instagramToken.length : 0
      });
      
      if (!instagramToken) {
        toast({
          title: "Instagram токен не найден",
          description: "Сначала настройте Instagram через Instagram Setup Wizard",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Facebook Wizard: Используем Instagram токен для поиска связанных страниц...');
      
      const response = await fetch(`/api/facebook/instagram-connected-pages?campaignId=${campaignId}`);
      const data = await response.json();
      
      console.log('Facebook Wizard: Ответ API Instagram связанных страниц:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при получении связанных страниц');
      }
      
      if (data.success && data.connected_pages) {
        // Преобразуем данные в формат, который ожидает интерфейс
        const formattedPages = data.connected_pages.map((item: any) => ({
          id: item.facebook_page.id,
          name: `${item.facebook_page.name} → @${item.instagram_account.username}`,
          access_token: item.facebook_page.access_token,
          category: item.facebook_page.category,
          instagram_info: item.instagram_account
        }));
        
        setPages(formattedPages);
        
        toast({
          title: "Instagram связанные страницы получены",
          description: `Найдено ${formattedPages.length} страниц связанных с Instagram`,
        });
      } else {
        toast({
          title: "Страницы не найдены",
          description: "У вас нет Facebook страниц связанных с Instagram Business аккаунтами",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Facebook Wizard: Ошибка при получении Instagram связанных страниц:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось получить Instagram связанные страницы",
        variant: "destructive",
      });
    } finally {
      setIsPagesLoading(false);
    }
  };

  // Функция для получения Facebook страниц
  const handleFetchPages = async () => {
    const formData = form.getValues();
    const token = formData.token;
    
    if (!token || token.length < 10) {
      toast({
        title: "Ошибка",
        description: "Введите действительный токен доступа",
        variant: "destructive",
      });
      return;
    }

    // Проверяем что токен не содержит лог консоли
    if (token.includes('Facebook Wizard:') || token.includes('%20') || token.includes('FacebookSetupWizard')) {
      toast({
        title: "Ошибка",
        description: "Поле токена содержит некорректные данные. Введите настоящий Facebook токен.",
        variant: "destructive",
      });
      return;
    }

    setIsPagesLoading(true);
    try {
      const response = await fetch(`/api/facebook/pages?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка получения страниц');
      }

      if (data.pages && data.pages.length > 0) {
        setPages(data.pages);
        toast({
          title: "Успешно",
          description: `Найдено ${data.pages.length} страниц`,
        });
      } else {
        toast({
          title: "Внимание",
          description: "Facebook страницы не найдены",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching Facebook pages:', error);
      
      // Проверяем тип ошибки для более понятного сообщения
      let errorMessage = "Не удалось получить Facebook страницы";
      let shouldShowReauth = false;
      
      if (error instanceof Error) {
        if (error.message.includes('400') || error.message.includes('Bad Request')) {
          errorMessage = 'Токен Facebook недействителен или истек';
          shouldShowReauth = true;
        } else if (error.message.includes('401') || error.message.includes('TOKEN_EXPIRED')) {
          errorMessage = 'Авторизация Facebook истекла. Необходима переавторизация.';
          shouldShowReauth = true;
        } else if (error.message.includes('403')) {
          errorMessage = 'Нет доступа к Facebook API. Проверьте права доступа.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: shouldShowReauth ? "Требуется переавторизация" : "Ошибка",
        description: errorMessage + (shouldShowReauth ? " Получите новый токен через Instagram Setup Wizard." : ""),
        variant: "destructive",
      });
    } finally {
      setIsPagesLoading(false);
    }
  };

  // Загружаем существующие Facebook настройки при открытии мастера
  useEffect(() => {
    const loadExistingFacebookSettings = async () => {
      try {
        console.log('🔄 Loading existing Facebook settings for campaign:', campaignId);
        const response = await fetch(`/api/campaigns/${campaignId}/facebook-settings`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Facebook settings loaded:', data);
          
          if (data.success && data.settings && data.settings.token) {
            // Проверяем что токен корректный
            const token = data.settings.token;
            if (!token.includes('Facebook Wizard:') && !token.includes('%20') && !token.includes('FacebookSetupWizard')) {
              console.log('✅ Setting Facebook token in form:', token.substring(0, 20) + '...');
              form.setValue('token', token);
              
              // Автоматически загружаем страницы если токен найден
              setTimeout(() => {
                handleFetchPages();
              }, 500);
            } else {
              console.log('❌ Facebook token is corrupted, not loading');
            }
          }
        }
      } catch (error) {
        console.error('Error loading Facebook settings:', error);
      }
    };

    loadExistingFacebookSettings();
  }, [campaignId]);

  // Получение токена конкретной страницы
  const handleGetPageToken = async (pageId: string) => {
    const token = form.getValues('token');
    
    if (!token || !pageId) {
      toast({
        title: "Ошибка",
        description: "Введите токен и ID страницы",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/facebook/page-token/${pageId}?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (data.success && data.page) {
        const { id, name, access_token } = data.page;
        
        // Обновляем токен в форме на токен страницы
        form.setValue('token', access_token);
        form.setValue('manualPageName', name);
        
        toast({
          title: "Токен страницы получен",
          description: `Получен токен для "${name}". Теперь нажмите "Получить страницы" для обновления списка.`,
        });
        
        console.log('🔑 Page token retrieved:', {
          pageId: id,
          pageName: name,
          tokenPreview: access_token.substring(0, 20) + '...'
        });
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось получить токен страницы",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error getting page token:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось получить токен страницы",
        variant: "destructive",
      });
    }
  };

  // Обработчик ручного выбора страницы
  const handleManualPageSelect = () => {
    const formData = form.getValues();
    const token = formData.token;
    const manualPageId = formData.manualPageId;
    const manualPageName = formData.manualPageName;
    
    if (!token || token.length < 10) {
      toast({
        title: "Ошибка",
        description: "Сначала введите токен доступа",
        variant: "destructive",
      });
      return;
    }

    if (!manualPageId) {
      toast({
        title: "Ошибка", 
        description: "Введите ID страницы",
        variant: "destructive",
      });
      return;
    }

    onComplete({
      token,
      pageId: manualPageId,
      pageName: manualPageName || `Facebook Page ${manualPageId}`,
    });

    toast({
      title: "Страница выбрана",
      description: `Используется страница: ${manualPageName || manualPageId}`,
    });
  };

  // Обработчик выбора Facebook страницы из списка
  const handlePageSelect = async (pageId: string, pageName: string) => {
    const token = form.getValues('token');
    
    // Проверяем что токен не содержит лог консоли перед передачей
    if (token.includes('Facebook Wizard:') || token.includes('%20') || token.includes('FacebookSetupWizard')) {
      toast({
        title: "Ошибка",
        description: "Токен поврежден. Введите новый токен Facebook.",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Facebook Wizard: Выбрана страница:', {
      pageId,
      pageName,
      tokenLength: token.length,
      tokenValid: token.length > 50 && !token.includes('Facebook Wizard:')
    });

    // Получаем токен конкретной страницы
    try {
      const response = await fetch(`/api/facebook/page-token/${pageId}?token=${encodeURIComponent(token)}`);
      const data = await response.json();
      
      console.log('Facebook Wizard: Токен страницы получен:', data);
      
      if (data.success && data.page) {
        onComplete({
          token: data.page.access_token, // Используем токен страницы
          pageId,
          pageName,
        });
        
        toast({
          title: "Страница выбрана",
          description: `Выбрана страница: ${pageName} с персональным токеном`,
        });
      } else {
        // Если не удалось получить токен страницы, используем основной токен
        onComplete({
          token,
          pageId,
          pageName,
        });
        
        toast({
          title: "Страница выбрана",
          description: `Выбрана страница: ${pageName} с основным токеном`,
        });
      }
    } catch (error) {
      console.error('Facebook Wizard: Ошибка получения токена страницы:', error);
      
      // В случае ошибки используем основной токен
      onComplete({
        token,
        pageId,
        pageName,
      });
      
      toast({
        title: "Страница выбрана",
        description: `Выбрана страница: ${pageName} (токен страницы недоступен)`,
      });
    }
    
    setPages([]); // Скрываем список страниц после выбора
    setShowManualInput(false); // Скрываем ручной ввод
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Настройка Facebook</h3>
        <Button variant="outline" onClick={onCancel} size="sm">
          Отмена
        </Button>
      </div>

      <div className="space-y-4">
        <Form {...form}>
          <div className="space-y-4">
            {/* Ввод токена */}
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facebook Access Token</FormLabel>
                  <div className="flex space-x-2 mt-1">
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Введите Facebook Access Token"
                        {...field}
                      />
                    </FormControl>
                    <Button 
                      type="button" 
                      onClick={handleFetchPages}
                      disabled={isPagesLoading || !form.getValues('token')}
                      size="sm"
                    >
                      {isPagesLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Поиск...
                        </>
                      ) : (
                        '📋 Получить страницы'
                      )}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={debugFacebookToken}
                      disabled={isPagesLoading || !form.getValues('token')}
                      size="sm"
                    >
                      🔍 Диагностика
                    </Button>
                  </div>
                  <FormMessage />
                  <div className="text-xs text-muted-foreground">
                    Получите токен в Facebook для разработчиков → Graph API Explorer
                  </div>
                </FormItem>
              )}
            />
          </div>
        </Form>

        {/* Шаг 2: Получение страниц или ручной ввод */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Шаг 2: Выберите Facebook страницу</h3>
          
          {/* Автоматическое получение страниц */}
          <div className="flex gap-2">
            <Button 
              onClick={handleFetchPages}
              disabled={isPagesLoading || !form.getValues('token')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPagesLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Получение...
                </>
              ) : (
                <>📋 Все страницы</>
              )}
            </Button>
            
            <Button 
              onClick={handleFetchInstagramConnectedPages}
              disabled={isPagesLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isPagesLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Получение...
                </>
              ) : (
                <>📱 Instagram связанные</>
              )}
            </Button>
            
            <Button 
              onClick={() => setShowManualInput(!showManualInput)}
              variant="outline"
            >
              {showManualInput ? 'Скрыть ручной ввод' : '✏️ Ввести вручную'}
            </Button>
          </div>

          {/* Ручной ввод (опционально) */}
          {showManualInput && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-4">
              <h4 className="font-medium">Ручной ввод данных страницы</h4>
              
              <FormField
                control={form.control}
                name="manualPageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Facebook страницы</FormLabel>
                    <div className="flex space-x-2">
                      <FormControl>
                        <Input
                          placeholder="Например: 2120362494678794"
                          {...field}
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => handleGetPageToken(field.value || '')}
                        disabled={!field.value || !form.getValues('token')}
                        size="sm"
                      >
                        🔑 Получить токен
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manualPageName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название страницы (необязательно)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Например: SMM Бизнес"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('manualPageId') && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm text-green-700">
                    ✅ ID: <code className="bg-green-100 px-1 rounded">{form.watch('manualPageId')}</code>
                    {form.watch('manualPageName') && <span>, название: <strong>{form.watch('manualPageName')}</strong></span>}
                  </p>
                  <Button 
                    onClick={() => handleManualPageSelect()}
                    size="sm"
                    className="mt-2 bg-green-600 hover:bg-green-700"
                  >
                    Использовать эти данные
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Список найденных страниц */}
          {pages.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-green-700">📋 Найденные Facebook страницы:</h4>
              <div className="grid gap-3">
                {pages.map((page) => (
                  <div 
                    key={page.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h5 className="font-medium">{page.name}</h5>
                        <p className="text-sm text-gray-600">ID: {page.id}</p>
                        {page.category && (
                          <p className="text-sm text-gray-500">Категория: {page.category}</p>
                        )}
                        {page.link && (
                          <p className="text-sm text-blue-600">
                            <a href={page.link} target="_blank" rel="noopener noreferrer">
                              {page.link}
                            </a>
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => handlePageSelect(page.id, page.name)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Выбрать
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Инструкция по получению ID страницы */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="font-medium text-blue-800 mb-3">📝 Как найти ID Facebook страницы:</h4>
          <ol className="text-sm text-blue-700 list-decimal list-inside space-y-2">
            <li>Откройте вашу Facebook страницу</li>
            <li>Нажмите "Настройки страницы" в левом меню</li>
            <li>Выберите "Информация о странице"</li>
            <li>Найдите поле "ID страницы" - это длинное число</li>
            <li>Скопируйте этот ID и вставьте выше</li>
          </ol>
          
          <div className="mt-3 border-t border-blue-200 pt-3">
            <h5 className="font-medium text-blue-800 mb-2">Альтернативный способ:</h5>
            <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
              <li>Откройте страницу в браузере</li>
              <li>В адресной строке найдите длинное число</li>
              <li>Например: facebook.com/<strong>2120362494678794</strong></li>
            </ol>
          </div>

          <div className="mt-3 flex gap-2">
            <Button 
              onClick={() => window.open('https://www.facebook.com/pages/create', '_blank')}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              🔗 Создать новую страницу
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}