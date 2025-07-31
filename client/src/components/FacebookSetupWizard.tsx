import { useState } from "react";
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

        {/* Список страниц */}
        {pages.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Выберите Facebook страницу:</h4>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPages([])}
              >
                Скрыть
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
                        </div>
                      </div>
                      <Button 
                        onClick={() => handlePageSelect(page.id, page.name)}
                        disabled={loadingPages}
                        size="sm"
                        variant="outline"
                      >
                        Выбрать
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}