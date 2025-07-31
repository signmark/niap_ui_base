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
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [pages, setPages] = useState<any[]>([]);
  const [isPagesLoading, setIsPagesLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
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
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось получить страницы",
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

  // Обработчик ручного выбора страницы
  const handleManualPageSelect = () => {
    const token = form.getValues('token');
    
    if (!token || token.length < 10) {
      toast({
        title: "Ошибка",
        description: "Сначала введите токен доступа",
        variant: "destructive",
      });
      return;
    }

    if (!pageId) {
      toast({
        title: "Ошибка", 
        description: "Введите ID страницы",
        variant: "destructive",
      });
      return;
    }

    onComplete({
      token,
      pageId,
      pageName: pageName || `Facebook Page ${pageId}`,
    });

    toast({
      title: "Страница выбрана",
      description: `Используется страница: ${pageName || pageId}`,
    });
  };

  // Обработчик выбора Facebook страницы из списка
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
    setShowManualInput(false); // Скрываем ручной ввод
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
                <>📋 Получить мои страницы</>
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
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  ID Facebook страницы
                </label>
                <input
                  type="text"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder="Например: 2120362494678794"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Название страницы (необязательно)
                </label>
                <input
                  type="text"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  placeholder="Например: SMM Бизнес"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {pageId && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm text-green-700">
                    ✅ ID: <code className="bg-green-100 px-1 rounded">{pageId}</code>
                    {pageName && <span>, название: <strong>{pageName}</strong></span>}
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