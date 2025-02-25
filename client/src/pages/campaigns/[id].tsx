import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeywordSelector } from "@/components/KeywordSelector";
import { PostCalendar } from "@/components/PostCalendar";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TrendsList } from "@/components/TrendsList";

export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ["/api/campaigns", id],
    queryFn: async () => {
      try {
        const response = await directusApi.get(`/items/user_campaigns/${id}`);
        return response.data?.data;
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

  const { mutate: searchSemantic, isPending: isSearching } = useMutation({
    mutationFn: async () => {
      const keywords = await directusApi.get(`/items/user_keywords`, {
        params: {
          filter: {
            campaign_id: {
              _eq: id
            }
          }
        }
      });

      if (!keywords.data?.data?.length) {
        throw new Error("Добавьте ключевые слова перед запуском семантического анализа");
      }

      await fetch('/api/perplexity/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keywords: keywords.data.data.map((k: any) => k.keyword)
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Поиск запущен",
        description: "Анализ семантического ядра начат"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
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
        <Button onClick={() => searchSemantic()} disabled={isSearching}>
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Анализ...
            </>
          ) : (
            "Управлять"
          )}
        </Button>
      </div>

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