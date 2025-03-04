import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { NewSourcesDialog } from "@/components/NewSourcesDialog";
import type { Campaign } from "@shared/schema";

interface ContentSource {
  id: string;
  name: string;
  url: string;
  type: string;
  is_active: boolean;
  campaign_id: string;
  created_at: string;
}

export default function ContentPage() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();
  const [isShowingResults, setIsShowingResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const { toast } = useToast();

  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      return await response.json();
    }
  });

  const { data: sources = [], isLoading: isLoadingSources } = useQuery<ContentSource[]>({
    queryKey: ["campaign_content_sources", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      try {
        const response = await directusApi.get('/items/campaign_content_sources', {
          params: {
            filter: {
              campaign_id: {
                _eq: selectedCampaignId
              }
            }
          }
        });
        return response.data?.data || [];
      } catch (error) {
        throw error;
      }
    },
    enabled: !!selectedCampaignId
  });

  const handleSearch = async () => {
    if (!selectedCampaignId) {
      toast({
        description: "Выберите кампанию для поиска источников",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/sources/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ keywords: ["здоровое питание"] })
      });

      if (!response.ok) {
        throw new Error("Failed to collect sources");
      }

      const data = await response.json();
      console.log("Search results:", data);

      setSearchResults(data);
      setIsShowingResults(true);
    } catch (error) {
      console.error("Error searching sources:", error);
      toast({
        description: "Не удалось выполнить поиск источников",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Управление контентом</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Выберите кампанию</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Select
              value={selectedCampaignId}
              onValueChange={setSelectedCampaignId}
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
                  campaigns.map((campaign) => (
                    <SelectItem
                      key={campaign.id}
                      value={campaign.id}
                    >
                      {campaign.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Button
              onClick={handleSearch}
              disabled={!selectedCampaignId || selectedCampaignId === "loading" || selectedCampaignId === "empty"}
            >
              <Search className="mr-2 h-4 w-4" />
              Найти источники
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sources Results Dialog */}
      {isShowingResults && (
        <Dialog open={isShowingResults} onOpenChange={setIsShowingResults}>
          <NewSourcesDialog
            campaignId={selectedCampaignId!}
            onClose={() => setIsShowingResults(false)}
            sourcesData={searchResults}
          />
        </Dialog>
      )}

      {/* Display existing sources */}
      {selectedCampaignId && (
        <Card>
          <CardHeader>
            <CardTitle>Существующие источники</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSources ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !sources.length ? (
              <p className="text-center text-muted-foreground">
                Нет добавленных источников
              </p>
            ) : (
              <div className="space-y-4">
                {sources.map((source) => (
                  <Card key={source.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{source.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {source.url}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Тип: {source.type}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}