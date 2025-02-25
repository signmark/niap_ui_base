import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import type { TrendTopic } from "@shared/schema";

export default function ContentManagement() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();
  const [selectedTopics, setSelectedTopics] = useState<TrendTopic[]>([]);

  // Получаем список кампаний
  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await directusApi.get('/items/user_campaigns');
      console.log("Campaigns response:", response.data);
      return response.data?.data || [];
    }
  });

  // Получаем тренды для выбранной кампании
  const { data: trends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ["/api/trends", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      console.log("Fetching trends for campaign directus_id:", selectedCampaignId);
      const response = await directusApi.get('/items/trend_topics', {
        params: {
          filter: {
            user_campaigns_id: {
              _eq: selectedCampaignId
            }
          },
          fields: ['*', 'source_id.*'],
          sort: ['-created_at']
        }
      });
      console.log("Trends response:", response.data);
      return response.data?.data || [];
    },
    enabled: !!selectedCampaignId
  });

  if (isLoadingCampaigns) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Управление контентом</h1>

        <Card>
          <CardHeader>
            <CardTitle>Выберите кампанию</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedCampaignId}
              onValueChange={(value) => {
                console.log("Selected campaign:", value);
                setSelectedCampaignId(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите кампанию" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedCampaignId && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Тренды и темы</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTrends ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : trends?.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    Нет актуальных трендов для этой кампании
                  </p>
                ) : (
                  <div className="space-y-4">
                    {trends?.map((trend) => (
                      <Card key={trend.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium">{trend.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                Источник: {trend.source_id?.name}
                              </p>
                              <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                                <span>👍 {trend.reactions}</span>
                                <span>💬 {trend.comments}</span>
                                <span>👀 {trend.views}</span>
                              </div>
                            </div>
                            <button
                              className={`px-3 py-1 rounded-full text-sm ${
                                selectedTopics.some(t => t.id === trend.id)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-secondary-foreground"
                              }`}
                              onClick={() => {
                                setSelectedTopics(prev => 
                                  prev.some(t => t.id === trend.id)
                                    ? prev.filter(t => t.id !== trend.id)
                                    : [...prev, trend]
                                );
                              }}
                            >
                              {selectedTopics.some(t => t.id === trend.id)
                                ? "Выбрано"
                                : "Выбрать"}
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedTopics.length > 0 && (
              <ContentGenerationPanel
                selectedTopics={selectedTopics}
                onGenerated={() => {
                  setSelectedTopics([]);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}