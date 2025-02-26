import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeywordSelector } from "@/components/KeywordSelector";  
import { PostCalendar } from "@/components/PostCalendar";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TrendsList } from "@/components/TrendsList";
import { SocialMediaSettings } from "@/components/SocialMediaSettings";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import Collapsible from "@/components/Collapsible"; // Placeholder import


export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ["/api/campaigns", id],
    queryFn: async () => {
      try {
        console.log("Fetching campaign with ID:", id);
        const response = await directusApi.get(`/items/user_campaigns/${id}`);
        console.log("Campaign response:", response.data);

        // Ensure social_media_settings has all required fields
        const defaultSettings = {
          telegram: { token: null, chatId: null },
          vk: { token: null, groupId: null },
          instagram: { token: null, accessToken: null },
          facebook: { token: null, pageId: null },
          youtube: { apiKey: null, channelId: null }
        };

        return {
          ...response.data?.data,
          social_media_settings: {
            ...defaultSettings,
            ...(response.data?.data?.social_media_settings || {})
          }
        };
      } catch (err) {
        console.error("Error fetching campaign:", err);
        throw new Error("Кампания не найдена или у вас нет прав доступа к ней");
      }
    },
    retry: false,
    onError: (err) => {
      toast({
        title: "Ошибка",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Ошибка</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Кампания не найдена или у вас нет прав доступа к ней</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {campaign.description}
          </p>
        </div>
      </div>

      <Collapsible title="Настройки публикации"> {/* Placeholder Collapsible */}
        <SocialMediaSettings 
          campaignId={id} 
          initialSettings={campaign.social_media_settings}
          onSettingsUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
          }}
        />
      </Collapsible>

      <Card>
        <CardHeader>
          <CardTitle>Ключевые слова</CardTitle>
        </CardHeader>
        <CardContent>
          <KeywordSelector campaignId={id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Тренды и темы</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendsList campaignId={id} />
        </CardContent>
      </Card>

      <ContentGenerationPanel 
        selectedTopics={[]} 
        onGenerated={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/posts', id] });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Календарь публикаций</CardTitle>
        </CardHeader>
        <CardContent>
          <PostCalendar campaignId={id} />
        </CardContent>
      </Card>
    </div>
  );
}