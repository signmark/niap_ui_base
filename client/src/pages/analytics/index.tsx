import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useCampaignStore } from "@/lib/campaignStore";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";

export default function Analytics() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    to: new Date()
  });

  // Используем глобальный стор для выбранной кампании
  const { selectedCampaign } = useCampaignStore();
  const campaignId = selectedCampaign?.id || "";

  // Получаем список всех кампаний
  const { data: campaignsResponse } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/campaigns');
        if (!response.ok) {
          throw new Error('Не удалось загрузить кампании');
        }
        return await response.json();
      } catch (error) {
        console.error("Error loading campaigns:", error);
        throw error;
      }
    }
  });
  
  // Получаем список кампаний из ответа API
  const campaigns = campaignsResponse?.data || [];
  
  // Получаем общее количество ключевых слов
  const { data: totalKeywords, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["total_keywords"],
    queryFn: async () => {
      const response = await directusApi.get('/items/user_keywords', {
        params: {
          aggregate: {
            count: "*"
          }
        }
      });
      return response.data?.data?.[0]?.count || 0;
    }
  });
  
  // Получаем общее количество сгенерированного контента
  const { data: totalContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ["total_content"],
    queryFn: async () => {
      const response = await directusApi.get('/items/campaign_content', {
        params: {
          aggregate: {
            count: "*"
          }
        }
      });
      return response.data?.data?.[0]?.count || 0;
    }
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>

        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
          </div>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                setDateRange({ from: range.from, to: range.to });
              }
            }}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingKeywords ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <p className="text-3xl font-bold">{totalKeywords}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{campaigns?.length || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated Contents</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingContent ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <p className="text-3xl font-bold">{totalContent}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}