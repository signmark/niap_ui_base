import { useState, useEffect } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Settings, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { SettingsDialog } from "@/components/SettingsDialog";

/**
 * Компонент для проверки наличия API ключа Perplexity и отображения предупреждения, 
 * если ключ не настроен.
 * 
 * Используется на странице Sources для обеспечения корректной работы функции поиска источников.
 */
export function PerplexityKeyAlert() {
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isKeyMissing, setIsKeyMissing] = useState(false);

  // Проверяем наличие API ключа Perplexity через API debug эндпоинт
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/debug/api-keys'],
    retry: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    // Проверяем наличие ключа Perplexity в данных
    if (data && data.data) {
      const { serviceResults } = data.data;
      
      if (Array.isArray(serviceResults)) {
        const perplexityKey = serviceResults.find(
          (service: any) => service.service === 'perplexity'
        );
        
        setIsKeyMissing(!perplexityKey || !perplexityKey.keyExists);
      }
    }
  }, [data]);

  // Если ключ настроен или данные загружаются, не показываем алерт
  if (isLoading || !isKeyMissing) {
    return null;
  }

  return (
    <>
      <Alert className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20">
        <AlertTitle className="flex items-center text-amber-800 dark:text-amber-400">
          <Settings className="h-4 w-4 mr-2 text-amber-600" />
          Требуется настройка API ключа Perplexity
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300 mt-2">
          <p className="mb-2">
            Для использования функции поиска источников необходимо настроить API ключ Perplexity в настройках учетной записи.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              variant="outline" 
              onClick={() => setIsSettingsDialogOpen(true)}
              className="border-amber-600 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
            >
              <Settings className="h-4 w-4 mr-2" />
              Открыть настройки
            </Button>
            <Button 
              variant="link"
              className="text-amber-700 dark:text-amber-300"
              onClick={() => window.open('https://perplexity.ai/settings', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Получить ключ Perplexity API
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <SettingsDialog />
      </Dialog>
    </>
  );
}

export default PerplexityKeyAlert;