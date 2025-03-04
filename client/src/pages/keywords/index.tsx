import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { NewSourcesDialog } from "@/components/NewSourcesDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { directusApi } from "@/lib/directus";
import type { Campaign } from "@shared/schema";

export default function Keywords() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [foundSourcesData, setFoundSourcesData] = useState<any>(null);
  const [isSearchingNewSources, setIsSearchingNewSources] = useState(false);
  const { add: toast } = useToast();

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      return await response.json();
    }
  });

  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["campaign_keywords", selectedCampaign],
    queryFn: async () => {
      if (!selectedCampaign) return [];
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      const response = await directusApi.get('/items/user_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: selectedCampaign
            }
          }
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return response.data?.data || [];
    },
    enabled: !!selectedCampaign
  });

  const { mutate: searchNewSources, isPending: isSearching } = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) {
        throw new Error("Выберите кампанию");
      }

      if (!keywords?.length) {
        throw new Error("Добавьте ключевые слова в кампанию");
      }

      const keywordsList = keywords.map((k: { keyword: string }) => k.keyword);
      console.log('Keywords for search:', keywordsList);

      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      // Sending all keywords in a single request
      const response = await fetch('/api/sources/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ keywords: keywordsList })
      });

      if (!response.ok) {
        throw new Error("Failed to collect sources");
      }

      const data = await response.json();
      console.log('Search response:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('Success Data:', data);
      setFoundSourcesData(data);
      setIsSearchingNewSources(true);
      toast({
        description: `Найдено ${data.data.data.sources.length} источников`
      });
    },
    onError: (error: Error) => {
      console.error('Search sources error:', error);
      toast({
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Источники</h1>
        <p className="text-muted-foreground mt-2">
          Выберите кампанию для поиска источников
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 items-center">
            <Select
              value={selectedCampaign}
              onValueChange={setSelectedCampaign}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Выберите кампанию" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingCampaigns ? (
                  <SelectItem value="loading">Загрузка...</SelectItem>
                ) : !campaigns || campaigns.length === 0 ? (
                  <SelectItem value="empty">Нет доступных кампаний</SelectItem>
                ) : (
                  campaigns.map((campaign: Campaign) => (
                    <SelectItem
                      key={campaign.id}
                      value={String(campaign.id)}
                    >
                      {campaign.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Button
              onClick={() => searchNewSources()}
              disabled={isSearching || !selectedCampaign || selectedCampaign === "loading" || selectedCampaign === "empty" || isLoadingKeywords}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Поиск...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Найти источники
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isSearchingNewSources} onOpenChange={setIsSearchingNewSources}>
        {selectedCampaign && foundSourcesData && (
          <NewSourcesDialog
            campaignId={selectedCampaign}
            onClose={() => {
              setIsSearchingNewSources(false);
              setFoundSourcesData(null);
            }}
            sourcesData={foundSourcesData}
          />
        )}
      </Dialog>

      <KeywordTable
        keywords={[{
          keyword: "Найденные источники",
          trend: 0,
          competition: 0,
          sources: foundSourcesData?.data?.data?.sources || []
        }]}
        existingKeywords={[]}
        isLoading={isLoadingCampaigns || isSearching || isLoadingKeywords}
        campaignId={selectedCampaign}
        onKeywordsUpdated={() => {}}
      />
    </div>
  );
}