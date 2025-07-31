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
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const { toast } = useToast();

  const form = useForm<FacebookSetupForm>({
    resolver: zodResolver(facebookSetupSchema),
    defaultValues: {
      token: "",
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
        
        console.log('🔍 Facebook токен разрешения:', {
          permissions,
          hasPublishToGroups,
          hasPagesPosts,
          hasPagesEngagement,
          user: data.user,
          pages: data.pages
        });

        const missingPermissions = [];
        if (!hasPublishToGroups) missingPermissions.push('publish_to_groups');
        if (!hasPagesPosts) missingPermissions.push('pages_manage_posts');
        if (!hasPagesEngagement) missingPermissions.push('pages_read_engagement');

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
          fetchFacebookPages();
        }
      } catch (error) {
        console.error('Ошибка загрузки Facebook настроек:', error);
      }
    };

    loadFacebookSettings();
  }, [campaignId]);

  // Функция для получения Facebook страниц
  const fetchFacebookPages = async () => {
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

    setLoadingPages(true);
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
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось получить страницы",
        variant: "destructive",
      });
    } finally {
      setLoadingPages(false);
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
                fetchFacebookPages();
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

  // Обработчик выбора Facebook страницы
  const handlePageSelect = (pageId: string, pageName: string) => {
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
    
    onComplete({
      token,
      pageId,
      pageName,
    });
    setPages([]); // Скрываем список страниц после выбора
    toast({
      title: "Страница выбрана",
      description: `Выбрана страница: ${pageName}`,
    });
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
                      onClick={fetchFacebookPages}
                      disabled={loadingPages || !form.getValues('token')}
                      size="sm"
                    >
                      {loadingPages ? (
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
                      disabled={loadingPages || !form.getValues('token')}
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

        {/* Инструкция по получению страниц */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
          <h4 className="font-medium text-blue-800">📋 Как получить Facebook страницы</h4>
          <div className="bg-white border border-blue-200 rounded-md p-3">
            <h5 className="font-medium text-blue-800 mb-2">Шаг 1: Создайте новую Facebook страницу</h5>
            <p className="text-sm text-blue-700 mb-2">
              Для публикации контента нужна именно страница (Page), а не группа (Group).
            </p>
            <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
              <li>Откройте <a href="https://www.facebook.com/pages/create" target="_blank" className="underline font-medium">facebook.com/pages/create</a></li>
              <li>Выберите тип "Бизнес или бренд"</li>
              <li>Заполните: название, категория, описание</li>
              <li>Сохраните страницу</li>
              <li>Вернитесь сюда и нажмите "📋 Получить страницы"</li>
            </ol>
            <div className="mt-3">
              <Button 
                onClick={() => window.open('https://www.facebook.com/pages/create', '_blank')}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                🔗 Создать Facebook страницу
              </Button>
            </div>
          </div>
        </div>

        {/* Список страниц с предупреждением о группах */}
        {pages.length > 0 ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Найденные аккаунты Facebook:</h4>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPages([])}
              >
                Скрыть
              </Button>
            </div>
            
            {/* Предупреждение о группах */}
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
              <h5 className="font-medium text-orange-800 mb-2">⚠️ Внимание: Проверьте тип аккаунта</h5>
              <p className="text-sm text-orange-700">
                Если найденный аккаунт - это группа, создайте отдельную Facebook страницу для публикации.
              </p>
              <Button 
                onClick={() => window.open('https://www.facebook.com/pages/create', '_blank')}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                📋 Создать Facebook страницу
              </Button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pages.map((page) => (
                <Card key={page.id} className="cursor-pointer hover:bg-gray-100 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            {page.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h5 className="font-semibold">{page.name}</h5>
                          <p className="text-sm text-gray-600">{page.category}</p>
                          <span className="text-xs text-gray-500">ID: {page.id}</span>
                          <div className="text-xs text-blue-600 mt-1">
                            ℹ️ Убедитесь, что это страница, а не группа
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <Button 
                          onClick={() => handlePageSelect(page.id, page.name)}
                          disabled={loadingPages}
                          size="sm"
                          variant="outline"
                        >
                          Выбрать
                        </Button>
                        <Button 
                          onClick={() => window.open(`https://facebook.com/${page.id}`, '_blank')}
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                        >
                          Проверить
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          // Если нажали "Получить страницы" но ничего не нашли
          form.getValues('token') && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-3">
              <h4 className="font-medium text-red-800">❌ Facebook страницы не найдены</h4>
              <p className="text-sm text-red-700">
                У вас нет доступных Facebook страниц для публикации.
              </p>
              <div className="bg-white border border-red-200 rounded-md p-3">
                <h5 className="font-medium text-red-800 mb-2">Создайте Facebook страницу:</h5>
                <ol className="text-sm text-red-700 list-decimal list-inside space-y-1">
                  <li>Откройте <strong>facebook.com/pages/create</strong></li>
                  <li>Выберите "Бизнес или бренд"</li>
                  <li>Заполните информацию о компании</li>
                  <li>После создания вернитесь и обновите список</li>
                </ol>
                <Button 
                  onClick={() => window.open('https://www.facebook.com/pages/create', '_blank')}
                  size="sm"
                  className="mt-3 bg-blue-600 hover:bg-blue-700"
                >
                  🔗 Создать страницу
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}