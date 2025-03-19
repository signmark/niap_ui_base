import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { useAuthStore } from "@/lib/store";
import { Loader2, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface ApiKey {
  id: string;
  service_name: string;
  api_key: string;
}

// Интерфейс для XMLRiver ключа
interface XMLRiverCredentials {
  user: string;
  key: string;
}

export function SettingsDialog() {
  const [perplexityKey, setPerplexityKey] = useState("");
  const [apifyKey, setApifyKey] = useState("");
  const [socialSearcherKey, setSocialSearcherKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [falAiKey, setFalAiKey] = useState("");
  // XMLRiver API credentials
  const [xmlRiverUserId, setXmlRiverUserId] = useState("16797"); // Значение по умолчанию
  const [xmlRiverApiKey, setXmlRiverApiKey] = useState("");
  
  const { toast } = useToast();
  const userId = useAuthStore((state) => state.userId);

  const token = useAuthStore((state) => state.token);
  
  // Используем более надежную реализацию запроса API ключей
  const { data: apiKeys, isLoading, refetch } = useQuery({
    queryKey: ["user_api_keys"],
    queryFn: async () => {
      try {
        // При ошибке просто возвращаем пустой массив, чтобы не блокировать работу приложения
        try {
          const response = await directusApi.get('/items/user_api_keys', {
            params: {
              filter: {
                user_id: {
                  _eq: userId
                }
              },
              fields: ['id', 'service_name', 'api_key']
            }
          });
          return response.data?.data || [];
        } catch (directusError) {
          console.warn('Could not load API keys from Directus, using fallback:', directusError);
          
          // Резервный вариант: использовать API нашего сервера
          try {
            const fallbackResponse = await fetch('/api/settings/api-keys', {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-user-id': userId || ''
              }
            });
            
            if (fallbackResponse.ok) {
              const data = await fallbackResponse.json();
              return data.data || [];
            }
          } catch (fallbackError) {
            console.warn('Fallback API also failed:', fallbackError);
          }
          
          // Если всё равно не получилось, возвращаем пустой массив
          return [];
        }
      } catch (error) {
        console.error('Error fetching API keys:', error);
        // Возвращаем пустой массив вместо выбрасывания ошибки
        return [];
      }
    },
    enabled: !!userId,
    // Не пытаться повторять запрос при ошибке
    retry: false,
    // Приоритезируем кэшированные данные
    staleTime: 1000 * 60 * 5 // 5 минут
  });

  useEffect(() => {
    if (apiKeys) {
      const perplexityKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'perplexity');
      const apifyKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'apify');
      const socialSearcherKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'social_searcher');
      const deepseekKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'deepseek');
      const falAiKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'fal_ai');
      const xmlRiverKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'xmlriver');

      if (perplexityKeyData) {
        setPerplexityKey(perplexityKeyData.api_key);
      }
      if (apifyKeyData) {
        setApifyKey(apifyKeyData.api_key);
      }
      if (socialSearcherKeyData) {
        setSocialSearcherKey(socialSearcherKeyData.api_key);
      }
      if (deepseekKeyData) {
        setDeepseekKey(deepseekKeyData.api_key);
      }
      if (falAiKeyData) {
        setFalAiKey(falAiKeyData.api_key);
      }
      
      // Обработка XMLRiver ключа
      if (xmlRiverKeyData) {
        try {
          // Пытаемся распарсить JSON с user и key
          const credentials = JSON.parse(xmlRiverKeyData.api_key) as XMLRiverCredentials;
          setXmlRiverUserId(credentials.user);
          setXmlRiverApiKey(credentials.key);
        } catch (e) {
          // Если не получилось распарсить, значит ключ в старом формате
          // Пробуем разделить на user_id:api_key
          const apiKey = xmlRiverKeyData.api_key;
          if (apiKey.includes(':')) {
            const [user, key] = apiKey.split(':');
            setXmlRiverUserId(user.trim());
            setXmlRiverApiKey(key.trim());
          } else {
            // Если разделителя нет, считаем что это просто ключ
            setXmlRiverApiKey(apiKey.trim());
          }
        }
      }
    }
  }, [apiKeys]);

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("Пользователь не авторизован");
      }

      // Формируем ключ для XMLRiver, объединяя user_id и api_key в JSON
      const xmlRiverCombinedKey = JSON.stringify({
        user: xmlRiverUserId.trim(),
        key: xmlRiverApiKey.trim()
      });

      const services = [
        { name: 'perplexity', key: perplexityKey },
        { name: 'apify', key: apifyKey },
        { name: 'social_searcher', key: socialSearcherKey },
        { name: 'deepseek', key: deepseekKey },
        { name: 'fal_ai', key: falAiKey },
        { name: 'xmlriver', key: xmlRiverCombinedKey }
      ];

      let saveErrors = [];

      // Используем более надежный метод сохранения - через нативный fetch с обработкой ошибок
      for (const service of services) {
        // Пропускаем пустые ключи, кроме XMLRiver, которому нужно сохранить user_id даже если ключ пуст
        if (!service.key && service.name !== 'xmlriver') continue;
        if (service.name === 'xmlriver' && !xmlRiverApiKey.trim()) continue;

        const existingKey = apiKeys?.find((key: ApiKey) => key.service_name === service.name);

        try {
          if (existingKey) {
            // Пробуем сначала через наш внутренний API
            try {
              const response = await fetch(`/api/settings/api-keys/${existingKey.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                  'x-user-id': userId
                },
                body: JSON.stringify({ api_key: service.key })
              });
              
              if (!response.ok) {
                // Если не получилось через наш API, пробуем через Directus напрямую
                await directusApi.patch(`/items/user_api_keys/${existingKey.id}`, {
                  api_key: service.key
                });
              }
            } catch (e) {
              // Если наш API не сработал, пробуем через Directus напрямую
              await directusApi.patch(`/items/user_api_keys/${existingKey.id}`, {
                api_key: service.key
              });
            }
          } else {
            // Для новых ключей
            try {
              const response = await fetch('/api/settings/api-keys', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                  'x-user-id': userId
                },
                body: JSON.stringify({
                  user_id: userId,
                  service_name: service.name,
                  api_key: service.key
                })
              });
              
              if (!response.ok) {
                // Если не получилось через наш API, пробуем через Directus напрямую
                await directusApi.post('/items/user_api_keys', {
                  user_id: userId,
                  service_name: service.name,
                  api_key: service.key
                });
              }
            } catch (e) {
              // Если наш API не сработал, пробуем через Directus напрямую
              await directusApi.post('/items/user_api_keys', {
                user_id: userId,
                service_name: service.name,
                api_key: service.key
              });
            }
          }
        } catch (err) {
          console.error(`Ошибка при сохранении ключа ${service.name}:`, err);
          saveErrors.push(service.name);
        }
      }
      
      // Обновляем список ключей после сохранения независимо от результата
      try {
        await refetch();
      } catch (e) {
        console.warn("Не удалось обновить список API ключей после сохранения", e);
      }
      
      // Если есть ошибки, сообщаем о них
      if (saveErrors.length > 0) {
        throw new Error(`Не удалось сохранить ключи для: ${saveErrors.join(', ')}`);
      }
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Настройки сохранены"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось сохранить настройки"
      });
    }
  });

  if (isLoading) {
    return (
      <DialogContent>
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Настройки API ключей</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>API Ключ Perplexity</Label>
          <Input
            type="password"
            value={perplexityKey}
            onChange={(e) => setPerplexityKey(e.target.value)}
            placeholder="Введите API ключ"
          />
          <p className="text-sm text-muted-foreground">
            Ключ используется для поиска источников и генерации контента через Perplexity
          </p>
        </div>

        <div className="space-y-2">
          <Label>API Ключ Social Searcher</Label>
          <Input
            type="password"
            value={socialSearcherKey}
            onChange={(e) => setSocialSearcherKey(e.target.value)}
            placeholder="Введите API ключ"
          />
          <p className="text-sm text-muted-foreground">
            Ключ используется для поиска источников и анализа социальных сетей через Social Searcher
          </p>
        </div>

        <div className="space-y-2">
          <Label>API Ключ Apify</Label>
          <Input
            type="password"
            value={apifyKey}
            onChange={(e) => setApifyKey(e.target.value)}
            placeholder="Введите API ключ"
          />
          <p className="text-sm text-muted-foreground">
            Ключ используется для парсинга социальных сетей
          </p>
        </div>
        
        <div className="space-y-2">
          <Label>API Ключ DeepSeek</Label>
          <Input
            type="password"
            value={deepseekKey}
            onChange={(e) => setDeepseekKey(e.target.value)}
            placeholder="Введите API ключ"
          />
          <p className="text-sm text-muted-foreground">
            Ключ используется для анализа веб-сайтов и генерации контента
          </p>
        </div>
        
        <div className="space-y-2">
          <Label>API Ключ FAL.AI</Label>
          <Input
            type="password"
            value={falAiKey}
            onChange={(e) => setFalAiKey(e.target.value)}
            placeholder="Введите API ключ"
          />
          <p className="text-sm text-muted-foreground">
            Ключ используется для генерации изображений и медиа-контента
          </p>
        </div>
        
        <Separator className="my-4" />
        
        <div className="space-y-4">
          <div className="flex items-center">
            <Label className="text-lg font-semibold">XMLRiver (Yandex.Wordstat)</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-2">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>XMLRiver используется для получения точных данных по ключевым словам из Яндекс.Вордстат. Требует user ID и API ключ.</p>
                  <p className="mt-2">Получить можно на сайте: <a href="https://xmlriver.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">xmlriver.com</a></p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>User ID в XMLRiver</Label>
              <Input
                type="text"
                value={xmlRiverUserId}
                onChange={(e) => setXmlRiverUserId(e.target.value)}
                placeholder="Введите ID пользователя XMLRiver"
              />
              <p className="text-sm text-muted-foreground">
                ID вашего аккаунта в XMLRiver
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>API Ключ XMLRiver</Label>
              <Input
                type="password"
                value={xmlRiverApiKey}
                onChange={(e) => setXmlRiverApiKey(e.target.value)}
                placeholder="Введите API ключ XMLRiver"
              />
              <p className="text-sm text-muted-foreground">
                Ключ для доступа к API XMLRiver
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => saveSettings()}
          disabled={isPending}
          className="w-full mt-6"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить"
          )}
        </Button>
      </div>
    </DialogContent>
  );
}