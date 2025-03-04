import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { NewSourcesDialog } from "@/components/NewSourcesDialog";
import type { Campaign } from "@shared/schema";

export default function Keywords() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isShowingResults, setIsShowingResults] = useState(false);
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

  const { mutate: searchSources, isPending: isSearching } = useMutation({
    mutationFn: async (keywords: string[]) => {
      console.log('Searching sources for keywords:', keywords);
      const response = await fetch('/api/sources/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ keywords })
      });

      if (!response.ok) {
        throw new Error("Failed to collect sources");
      }

      const data = await response.json();
      console.log('Search response:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('Search success - full data:', data);

      // Debug check
      if (!data || !data.success || !data.data || !data.data.sources) {
        console.error('Invalid data structure:', data);
        toast({
          description: "Неверный формат данных от сервера",
          variant: "destructive"
        });
        return;
      }

      setSearchResults(data);
      setIsShowingResults(true);

      toast({
        description: `Найдено ${data.data.sources.length} источников`
      });
    },
    onError: (error: Error) => {
      console.error('Search sources error:', error);
      setSearchResults(null);
      toast({
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSearch = () => {
    if (!selectedCampaign || selectedCampaign === "loading" || selectedCampaign === "empty") {
      toast({
        description: "Выберите кампанию для поиска источников",
        variant: "destructive"
      });
      return;
    }

    // Используем тестовые ключевые слова для демонстрации
    const testKeywords = ["здоровое питание", "правильное питание", "диета"];
    console.log(`Starting search with test keywords: ${testKeywords.length} keywords`);
    searchSources(testKeywords);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Источники</h1>
        <p className="text-muted-foreground mt-2">
          Выберите кампанию для поиска источников по её ключевым словам
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
              onClick={handleSearch}
              disabled={isSearching || !selectedCampaign || selectedCampaign === "loading" || selectedCampaign === "empty"}
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

      {/* Sources Results Dialog */}
      {isShowingResults && searchResults && (
        <Dialog open={isShowingResults} onOpenChange={setIsShowingResults}>
          <NewSourcesDialog
            campaignId={selectedCampaign}
            onClose={() => setIsShowingResults(false)}
            sourcesData={searchResults}
          />
        </Dialog>
      )}

      <KeywordTable
        keywords={[{
          keyword: "Найденные источники",
          trend: 0,
          competition: 0,
          sources: searchResults?.data?.sources || []
        }]}
        existingKeywords={[]}
        isLoading={isLoadingCampaigns || isSearching}
        campaignId={selectedCampaign}
        onKeywordsUpdated={() => {}}
      />
    </div>
  );
}