import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { token: string; pageId: string; pageName: string }) => void;
  campaignId: string;
}

export default function FacebookSetupWizard({
  isOpen,
  onClose,
  onComplete,
  campaignId,
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
    const token = form.getValues('token');
    if (!token) {
      toast({
        title: "Ошибка",
        description: "Введите токен доступа",
        variant: "destructive",
      });
      return;
    }

    setLoadingPages(true);
    try {
      const response = await fetch(`/api/facebook/pages?access_token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (data.success) {
        setPages(data.pages);
        toast({
          title: "Успешно",
          description: `Найдено ${data.pages.length} страниц`,
        });
      } else {
        throw new Error(data.error || 'Ошибка получения страниц');
      }
    } catch (error) {
      console.error('Error fetching Facebook pages:', error);
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
    onComplete({
      token,
      pageId,
      pageName,
    });
    setPages([]); // Скрываем список страниц после выбора
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🌐 Настройка Facebook для публикации</DialogTitle>
          <DialogDescription>
            Настройте Facebook API для автоматической публикации контента на ваших страницах
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Form {...form}>
            <div className="space-y-4">
              {/* Ввод токена */}
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>🔑 Facebook Access Token</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Вставьте ваш Facebook Access Token..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <div className="text-xs text-gray-500">
                      Получите токен в Facebook for Developers → Graph API Explorer
                    </div>
                  </FormItem>
                )}
              />

              {/* Кнопка получения страниц */}
              <Button
                type="button"
                onClick={fetchFacebookPages}
                disabled={loadingPages || !form.getValues('token')}
                className="w-full"
              >
                {loadingPages ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загружаем страницы...
                  </>
                ) : (
                  <>
                    📋 Получить страницы
                  </>
                )}
              </Button>
            </div>
          </Form>

          {/* Facebook Pages Selection */}
          {pages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  🎯 Выберите Facebook страницу для публикации
                </h4>
                <span className="text-xs text-gray-500">
                  Найдено: {pages.length} страниц
                </span>
              </div>
              
              <div className="grid gap-3 max-h-64 overflow-y-auto">
                {pages.map((page) => (
                  <div 
                    key={page.id}
                    className="p-4 rounded-lg border cursor-pointer transition-all duration-200 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handlePageSelect(page.id, page.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold text-lg">
                              {page.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {page.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              ID: {page.id}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              📂 {page.category}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        type="button" 
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePageSelect(page.id, page.name);
                        }}
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
      </DialogContent>
    </Dialog>
  );
}