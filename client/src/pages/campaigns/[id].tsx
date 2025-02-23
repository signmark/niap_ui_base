import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeywordSelector } from "@/components/KeywordSelector";
import { directusApi } from "@/lib/directus";
import type { Campaign } from "@shared/schema";
import { Loader2 } from "lucide-react";

export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const campaignId = parseInt(id);

  const { data: campaign, isLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: async () => {
      const { data } = await directusApi.get(`/items/user_campaigns/${campaignId}`);
      return data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return <div>Кампания не найдена</div>;
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
