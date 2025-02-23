import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeywordSelector } from "@/components/KeywordSelector";
import { directusApi } from "@/lib/directus";
import type { Campaign } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const campaignId = parseInt(id);
  const { toast } = useToast();

  const { data: campaign, isLoading, error } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: async () => {
      try {
        const { data } = await directusApi.get(`/items/campaigns`, {
          params: {
            filter: {
              id: {
                _eq: campaignId
              }
            },
            limit: 1
          }
        });

        if (!data?.data?.[0]) {
          throw new Error("Кампания не найдена");
        }

        return data.data[0];
      } catch (err) {
        console.error("Error fetching campaign:", err);
        throw new Error("Ошибка при загрузке кампании");
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
      <Card>
        <CardHeader>
          <CardTitle>{campaign.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">{campaign.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ключевые слова</CardTitle>
        </CardHeader>
        <CardContent>
          <KeywordSelector campaignId={campaignId} />
        </CardContent>
      </Card>
    </div>
  );
}