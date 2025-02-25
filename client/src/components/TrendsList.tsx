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
      const response = await directusApi.get('/items/trend_topics', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          },
          fields: ['*', 'source_id.name', 'source_id.url']
        }
      });
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
