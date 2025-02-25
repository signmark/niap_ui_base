import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TrendsListProps {
  campaignId: string | number | null;
}

export function TrendsList({ campaignId }: TrendsListProps) {
  const { data: trends, isLoading } = useQuery({
    queryKey: ["/api/trends", campaignId],
    queryFn: async () => {
      console.log("Fetching trends for campaign:", campaignId);
      const response = await apiRequest('/api/trends', {
        params: { campaignId }
      });
      console.log("Trends response:", response);
      return response?.data || [];
    },
    enabled: campaignId !== null && campaignId !== undefined
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
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h3 className="font-medium">{trend.title}</h3>
              <p className="text-sm text-muted-foreground">
                Источник: {trend.source_id?.name || 'Неизвестный источник'}
              </p>
              <div className="flex gap-4 text-sm">
                <span>👁 {trend.views || 0}</span>
                <span>💬 {trend.comments || 0}</span>
                <span>❤️ {trend.reactions || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}