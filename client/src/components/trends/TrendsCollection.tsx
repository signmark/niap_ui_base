import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface TrendsCollectionProps {
  campaignId: string;
}

export function TrendsCollection({ campaignId }: TrendsCollectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTips, setShowTips] = useState(false);

  const collectTrendsMutation = useMutation({
    mutationFn: async () => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      const response = await fetch(`/api/campaign-trend-topics/${campaignId}/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Ошибка сбора трендов');
      }

      return response.json();
    },
    onSuccess: () => {
      // Немедленное уведомление
      toast({
        title: "Сбор начат",
        description: "Сбор трендов запущен. Новые тренды появятся автоматически.",
      });

      // Показываем полезные советы через 60 секунд
      setTimeout(() => {
        setShowTips(true);
        const tips = [
          "Пока собираются тренды, вы можете настроить другие разделы кампании",
          "Анализ трендов поможет создать более актуальный контент",
          "Рекомендуем собирать тренды регулярно для актуальности"
        ];
        
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        toast({
          title: "Полезный совет",
          description: randomTip,
          duration: 5000,
        });
      }, 60000);

      // Автоматически обновляем данные через некоторое время
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["campaign-trend-topics", campaignId] });
        queryClient.invalidateQueries({ queryKey: ["trends"] }); // Обновляем и основной список трендов
      }, 30000);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка сбора трендов",
        description: error.message || "Не удалось запустить сбор трендов",
        variant: "destructive",
      });
    }
  });

  // Обновляем данные каждые 2 минуты если идет сбор
  useEffect(() => {
    if (collectTrendsMutation.isPending || showTips) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["campaign-trend-topics", campaignId] });
      }, 120000); // 2 минуты

      return () => clearInterval(interval);
    }
  }, [collectTrendsMutation.isPending, showTips, campaignId, queryClient]);

  return (
    <Button
      onClick={() => collectTrendsMutation.mutate()}
      disabled={collectTrendsMutation.isPending}
      className="mb-4"
    >
      {collectTrendsMutation.isPending ? (
        <>
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Собирается...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 mr-2" />
          Собрать тренды
        </>
      )}
    </Button>
  );
}