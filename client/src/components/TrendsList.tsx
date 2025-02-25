import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";

interface TrendsListProps {
  campaignId: string;
}

export function TrendsList({ campaignId }: TrendsListProps) {
  // Получаем темы для выбранной кампании
  const { data: trends, isLoading } = useQuery({
    queryKey: ["/api/trends", campaignId],
    queryFn: async () => {
      console.log("Fetching trends for campaign:", campaignId);
      // Сначала получим кампанию, чтобы узнать её внутренний ID
      const campaignResponse = await directusApi.get(`/items/user_campaigns/${campaignId}`);
      const campaign = campaignResponse.data?.data;

      if (!campaign) {
        throw new Error("Кампания не найдена");
      }

      // Теперь получим тренды для этой кампании
      const response = await directusApi.get('/items/trend_topics', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaign.id // Use the actual campaign ID from the response
            }
          },
          fields: ['*', 'source_id.name', 'source_id.url'],
          sort: ['-created_at']
        }
      });
      console.log("Trends response:", response.data);
      return response.data?.data || [];
    },
    enabled: !!campaignId
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!trends?.length) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Нет актуальных трендов для этой кампании
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {trends.map((trend: any) => (
        <Card key={trend.id}>
          <CardHeader>
            <CardTitle className="text-lg">{trend.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Источник: {trend.source_id?.name}
              </p>
              <div className="flex gap-4 text-sm">
                <span>👁 {trend.views}</span>
                <span>💬 {trend.comments}</span>
                <span>❤️ {trend.reactions}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}