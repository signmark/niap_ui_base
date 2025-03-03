import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TrendsListProps {
  campaignId: string;
}

type Period = "3days" | "7days" | "14days" | "30days";

export function TrendsList({ campaignId }: TrendsListProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("7days");

  const { data: trends = [], isLoading: isLoadingTrends } = useQuery({
    queryKey: ["campaign_trend_topics", campaignId, selectedPeriod],
    queryFn: async () => {
      try {
        const response = await directusApi.get('/items/campaign_trend_topics', {
          params: {
            filter: {
              campaign_id: {
                _eq: campaignId
              }
            },
            fields: [
              'id',
              'title',
              'source_id',
              'source_id.name',
              'source_id.url',
              'reactions',
              'comments',
              'views',
              'created_at',
              'is_bookmarked'
            ],
            sort: ['-created_at']
          }
        });

        return response.data?.data || [];
      } catch (error) {
        console.error("Error fetching trends:", error);
        throw new Error("Не удалось загрузить тренды");
      }
    },
    enabled: !!campaignId
  });

  if (isLoadingTrends) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!trends?.length) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Select
            value={selectedPeriod}
            onValueChange={(value: Period) => setSelectedPeriod(value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Выберите период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3days">За 3 дня</SelectItem>
              <SelectItem value="7days">За неделю</SelectItem>
              <SelectItem value="14days">За 2 недели</SelectItem>
              <SelectItem value="30days">За месяц</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-center p-8 text-muted-foreground">
          Нет актуальных трендов для этой кампании
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Select
          value={selectedPeriod}
          onValueChange={(value: Period) => setSelectedPeriod(value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Выберите период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3days">За 3 дня</SelectItem>
            <SelectItem value="7days">За неделю</SelectItem>
            <SelectItem value="14days">За 2 недели</SelectItem>
            <SelectItem value="30days">За месяц</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trends.map((trend: any) => (
          <Card key={trend.id}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="font-medium">{trend.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Источник: {trend.source_id?.name || 'Неизвестный источник'}
                  {trend.source_id?.url && (
                    <a 
                      href={trend.source_id.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-500 hover:underline"
                    >
                      (открыть)
                    </a>
                  )}
                </p>
                <div className="flex gap-4 text-sm">
                  <span title="Просмотры">👁 {trend.views?.toLocaleString() || 0}</span>
                  <span title="Комментарии">💬 {trend.comments?.toLocaleString() || 0}</span>
                  <span title="Реакции">❤️ {trend.reactions?.toLocaleString() || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}