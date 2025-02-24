import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { directusApi } from "@/lib/directus";
import type { Keyword } from "@shared/schema";

export default function Keywords() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Keyword[]>([]);
  const { toast } = useToast();

  // Получаем список кампаний
  const { data: campaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await directusApi.get("/items/user_campaigns");
      return response.data?.data || [];
    }
  });

  // Получаем существующие ключевые слова кампании
  const { data: campaignKeywords, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["/api/keywords", selectedCampaign],
    queryFn: async () => {
      if (!selectedCampaign) return [];
      const response = await directusApi.get("/items/user_keywords", {
        params: {
          filter: {
            campaign_id: {
              _eq: selectedCampaign
            }
          }
        }
      });
      return response.data?.data || [];
    },
    enabled: !!selectedCampaign
  });

  // Поиск ключевых слов
  const { mutate: searchKeywords, isPending: isSearching } = useMutation({
    mutationFn: async (keyword: string) => {
      const res = await fetch(`/api/wordstat/${encodeURIComponent(keyword)}`);
      if (!res.ok) throw new Error("Не удалось найти ключевые слова");
      return res.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.keywords);
      toast({ description: "Ключевые слова найдены" });
    },
    onError: () => {
      toast({
        description: "Не удалось найти ключевые слова",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!searchTerm || !selectedCampaign) return;
    searchKeywords(searchTerm);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Ключевые слова</h1>
          <p className="text-muted-foreground mt-2">
            Выберите кампанию и найдите релевантные ключевые слова
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-4">
              <Select 
                value={selectedCampaign} 
                onValueChange={(value) => {
                  setSelectedCampaign(value);
                  setSearchResults([]);
                }}
              >
                <SelectTrigger className="w-[300px]">
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
            </div>

            <div className="flex gap-4">
              <Input
                placeholder="Введите ключевое слово для поиска"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !searchTerm || !selectedCampaign}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Поиск...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Искать
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <KeywordTable 
          keywords={searchResults} 
          existingKeywords={campaignKeywords || []} 
          isLoading={isLoadingKeywords || isSearching} 
          campaignId={selectedCampaign}
        />
      </div>
    </Layout>
  );
}