import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { useAuthStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

interface ApiKey {
  id: string;
  service_name: string;
  api_key: string;
}

export function SettingsDialog() {
  const [perplexityKey, setPerplexityKey] = useState("");
  const [apifyKey, setApifyKey] = useState("");
  const [socialSearcherKey, setSocialSearcherKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const { toast } = useToast();
  const userId = useAuthStore((state) => state.userId);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["user_api_keys"],
    queryFn: async () => {
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
      } catch (error) {
        console.error('Error fetching API keys:', error);
        throw error;
      }
    },
    enabled: !!userId
  });

  useEffect(() => {
    if (apiKeys) {
      const perplexityKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'perplexity');
      const apifyKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'apify');
      const socialSearcherKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'social_searcher');
      const deepseekKeyData = apiKeys.find((k: ApiKey) => k.service_name === 'deepseek');

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
    }
  }, [apiKeys]);

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("Пользователь не авторизован");
      }

      const services = [
        { name: 'perplexity', key: perplexityKey },
        { name: 'apify', key: apifyKey },
        { name: 'social_searcher', key: socialSearcherKey },
        { name: 'deepseek', key: deepseekKey }
      ];

      for (const service of services) {
        if (!service.key) continue;

        const existingKey = apiKeys?.find((key: ApiKey) => key.service_name === service.name);

        if (existingKey) {
          await directusApi.patch(`/items/user_api_keys/${existingKey.id}`, {
            api_key: service.key
          });
        } else {
          await directusApi.post('/items/user_api_keys', {
            user_id: userId,
            service_name: service.name,
            api_key: service.key
          });
        }
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
    <DialogContent>
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

        <Button
          onClick={() => saveSettings()}
          disabled={isPending}
          className="w-full"
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