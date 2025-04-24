import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsStatusProps {
  campaignId: string;
  onRefresh?: () => void;
}

export default function AnalyticsStatus({ campaignId, onRefresh }: AnalyticsStatusProps) {
  const { toast } = useToast();

  // Запрос статуса сбора аналитики
  const { 
    data: statusData, 
    isLoading: isStatusLoading,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ["/api/analytics/status"],
    queryFn: async () => {
      const response = await api.get("/analytics/status");
      return response.data;
    },
    refetchInterval: 5000, // Обновляем каждые 5 секунд во время сбора данных
  });

  // Запрос для запуска сбора аналитики
  const { 
    refetch: collectAnalytics, 
    isRefetching: isCollecting
  } = useQuery({
    queryKey: ["collect-analytics", campaignId],
    queryFn: async () => {
      try {
        const response = await api.post("/analytics/collect", { campaignId });
        if (response.data.success) {
          toast({
            title: "Сбор аналитики запущен",
            description: "Данные будут собраны в фоновом режиме",
            variant: "default"
          });
          // Сразу обновляем статус после запуска
          refetchStatus();
          if (onRefresh) {
            onRefresh();
          }
        } else {
          toast({
            title: "Ошибка запуска сбора аналитики",
            description: response.data.message || "Возникла ошибка при запуске сбора аналитики",
            variant: "destructive"
          });
        }
        return response.data;
      } catch (error) {
        console.error("Error collecting analytics:", error);
        toast({
          title: "Ошибка сбора данных",
          description: "Не удалось запустить сбор аналитики. Пожалуйста, попробуйте позже.",
          variant: "destructive"
        });
        throw error;
      }
    },
    enabled: false, // Не запускаем автоматически
  });

  // Запускаем сбор аналитики вручную
  const handleCollectAnalytics = () => {
    if (!campaignId) {
      toast({
        title: "Выберите кампанию",
        description: "Для сбора аналитики необходимо выбрать кампанию",
        variant: "default"
      });
      return;
    }
    collectAnalytics();
  };

  // Обновляем данные при смене кампании
  useEffect(() => {
    if (campaignId) {
      refetchStatus();
    }
  }, [campaignId, refetchStatus]);

  // Определяем статусы и данные
  const isLoadingStatus = isStatusLoading;
  const analyticsStatus = statusData?.data || {};
  const { isCollecting: isActiveCollection, progress, lastCollectionTime, processedPosts, totalPosts } = analyticsStatus;

  // Форматируем дату последнего сбора
  const formatDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return "Нет данных";
    const date = new Date(dateTimeStr);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Статус аналитики</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingStatus ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Статус:</span>
                <span className={isActiveCollection ? "text-green-500 font-medium" : "text-muted-foreground"}>
                  {isActiveCollection ? "Сбор данных" : "Ожидание"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Последнее обновление:</span>
                <span className="text-muted-foreground">{formatDateTime(lastCollectionTime)}</span>
              </div>
              <div className="flex justify-between">
                <span>Обработано постов:</span>
                <span>{processedPosts} из {totalPosts}</span>
              </div>
            </div>

            {isActiveCollection && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Прогресс:</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => refetchStatus()}
          disabled={isCollecting}
        >
          Обновить статус
        </Button>
        <Button 
          onClick={handleCollectAnalytics}
          disabled={isActiveCollection || isCollecting}
        >
          {isCollecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Запуск сбора...
            </>
          ) : (
            "Собрать аналитику"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}