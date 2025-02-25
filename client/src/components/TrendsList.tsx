import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { directusApi } from "@/lib/directus";

interface TrendsListProps {
  campaignId: string; // This is directus_id from the URL
}

export function TrendsList({ campaignId }: TrendsListProps) {
  // First fetch campaign info from Directus to get internal ID
  const { data: campaign, isLoading: isLoadingCampaign } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: async () => {
      console.log("Fetching campaign info for directus_id:", campaignId);
      const response = await directusApi.get('/items/user_campaigns', {
        params: {
          filter: {
            directus_id: {
              _eq: campaignId
            }
          },
          limit: 1
        }
      });

      const campaignData = response.data?.data?.[0];
      console.log("Found campaign:", campaignData);
      return campaignData;
    },
    enabled: !!campaignId
  });

  // Then fetch trends using the campaign's internal ID
  const { data: trends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ["/api/trends", campaign?.id],
    queryFn: async () => {
      if (!campaign?.id) return [];

      console.log("Fetching trends for campaign internal id:", campaign.id);
      const response = await directusApi.get('/items/trend_topics', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaign.id
            }
          },
          fields: [
            '*',
            'source_id.*'
          ],
          sort: ['-created_at']
        }
      });

      console.log("Trends response:", response.data);
      return response.data?.data || [];
    },
    enabled: !!campaign?.id
  });

  if (isLoadingCampaign || isLoadingTrends) {
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