import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { useAuthStore } from "@/lib/store";

export function SettingsDialog() {
  const [perplexityKey, setPerplexityKey] = useState("");
  const [apifyKey, setApifyKey] = useState("");
  const { toast } = useToast();
  const userId = useAuthStore((state) => state.userId);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["user_api_keys"],
    queryFn: async () => {
      const response = await directusApi.get('/items/user_api_keys', {
        params: {
          fields: ['id', 'service_name', 'api_key']
        }
      });

      // Set initial values for form fields
      const keys = response.data?.data || [];
      const perplexityKeyData = keys.find(k => k.service_name === 'perplexity');
      const apifyKeyData = keys.find(k => k.service_name === 'apify');

      setPerplexityKey(perplexityKeyData?.api_key || '');
      setApifyKey(apifyKeyData?.api_key || '');

      return keys;
    }
  });

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("Пользователь не авторизован");
      }

      const services = [
        { name: 'perplexity', key: perplexityKey },
        { name: 'apify', key: apifyKey }
      ];

      for (const service of services) {
        if (!service.key) continue;

        const existingKey = apiKeys?.find(key => key.service_name === service.name);

        if (existingKey) {
          // Обновляем существующий ключ
          await directusApi.patch(`/items/user_api_keys/${existingKey.id}`, {
            api_key: service.key
          });
        } else {
          // Создаем новый ключ
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
    onError: () => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить настройки"
      });
    }
  });

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
            Ключ используется для поиска источников и генерации контента
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

        <Button
          onClick={() => saveSettings()}
          disabled={isPending}
          className="w-full"
        >
          Сохранить
        </Button>
      </div>
    </DialogContent>
  );
}