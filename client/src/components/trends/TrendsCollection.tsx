import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, MessageCircle } from "lucide-react";
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

  const collectCommentsMutation = useMutation({
    mutationFn: async () => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      const response = await fetch(`/api/trends/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId,
          collectComments: ['vk', 'telegram'],  // Собираем комментарии для VK и Telegram
          platforms: []  // Не собираем новые тренды, только комментарии
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Ошибка сбора комментариев');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Сбор комментариев начат",
        description: "Комментарии к существующим трендам собираются. Обновление произойдет автоматически.",
      });

      // Автоматически обновляем данные через 30 секунд
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["campaign-trend-topics", campaignId] });
        queryClient.invalidateQueries({ queryKey: ["trends"] });
      }, 30000);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка сбора комментариев",
        description: error.message || "Не удалось запустить сбор комментариев",
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
    <div className="flex gap-2 mb-4">
      <Button
        onClick={() => collectTrendsMutation.mutate()}
        disabled={collectTrendsMutation.isPending}
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

      <Button
        onClick={() => collectCommentsMutation.mutate()}
        disabled={collectCommentsMutation.isPending}
        variant="outline"
      >
        {collectCommentsMutation.isPending ? (
          <>
            <MessageCircle className="w-4 h-4 mr-2 animate-spin" />
            Собираются...
          </>
        ) : (
          <>
            <MessageCircle className="w-4 h-4 mr-2" />
            Собрать комментарии
          </>
        )}
      </Button>
    </div>
  );
}