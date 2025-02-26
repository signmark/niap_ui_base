import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { AddSourceDialog } from "@/components/AddSourceDialog";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import type { Campaign } from "@shared/schema";
import { directusApi } from "@/lib/directus";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface ContentSource {
  id: string;
  name: string;
  url: string;
  type: string;
  is_active: boolean;
  campaign_id: string;
  created_at: string;
}

interface TrendTopic {
  id: string;
  title: string;
  source_id: string;
  reactions: number;
  comments: number;
  views: number;
  created_at: string;
  is_bookmarked: boolean;
  campaign_id: string;
}

type Period = "3days" | "7days" | "14days" | "30days";

export default function Trends() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("7days");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<TrendTopic[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const { toast } = useToast();

  // Получаем список кампаний
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      return response.json();
    }
  });

  // Получаем источники для выбранной кампании через Directus
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
              },
              is_active: {
                _eq: true
              }
            },
            fields: ['id', 'name', 'url', 'type', 'is_active', 'campaign_id', 'created_at']
          }
        });
        return response.data?.data || [];
      } catch (error) {
        throw error;
      }
    },
    enabled: !!selectedCampaignId
  });

  // Получаем тренды через Directus
  const { data: trends = [], isLoading: isLoadingTrends } = useQuery<TrendTopic[]>({
    queryKey: ["campaign_trend_topics", selectedPeriod, selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      try {
        const response = await directusApi.get('/items/campaign_trend_topics', {
          params: {
            filter: {
              campaign_id: {
                _eq: selectedCampaignId
              }
            },
            fields: [
              'id',
              'title',
              'source_id',
              'reactions',
              'comments',
              'views',
              'created_at',
              'is_bookmarked',
              'campaign_id'
            ],
            sort: ['-reactions']
          }
        });

        console.log("Trends API response:", response.data);
        return response.data?.data || [];
      } catch (error) {
        console.error("Error fetching trends:", error);
        throw error;
      }
    },
    enabled: !!selectedCampaignId
  });

  const toggleTopicSelection = (topic: TrendTopic) => {
    setSelectedTopics(prev => {
      const isSelected = prev.some(t => t.id === topic.id);
      if (isSelected) {
        return prev.filter(t => t.id !== topic.id);
      } else {
        return [...prev, topic];
      }
    });
  };

  // Запуск сбора трендов
  const { mutate: collectTrends, isPending: isCollecting } = useMutation({
    mutationFn: async () => {
      return await directusApi.post('/utils/crawler/run', {
        campaignId: selectedCampaignId
      });
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Запущен сбор трендов"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message
      });
    }
  });

  // Валидируем выбранную кампанию
  const isValidCampaignSelected = selectedCampaignId && 
    selectedCampaignId !== "loading" && 
    selectedCampaignId !== "empty";

  if (isLoadingCampaigns) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">SMM Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Анализ популярных тем и управление контентом в социальных медиа
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => collectTrends()}
            disabled={isCollecting || !isValidCampaignSelected}
          >
            {isCollecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сбор данных...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Собрать тренды
              </>
            )}
          </Button>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            disabled={!isValidCampaignSelected}
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить источник
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Select
            value={selectedCampaignId}
            onValueChange={setSelectedCampaignId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите кампанию" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((campaign) => (
                <SelectItem 
                  key={campaign.id} 
                  value={campaign.id}
                >
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isValidCampaignSelected && (
        <>
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Источники данных</h2>
              {isLoadingSources ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !sources.length ? (
                <p className="text-center text-muted-foreground">
                  Нет добавленных источников
                </p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div>
                        <h3 className="font-medium">{source.name}</h3>
                        <p className="text-sm text-muted-foreground">{source.url}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          {source.type === 'website' ? 'Веб-сайт' :
                            source.type === 'telegram' ? 'Telegram канал' :
                              source.type === 'vk' ? 'VK группа' : source.type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-4">
                <Select
                  value={selectedPeriod}
                  onValueChange={(value: Period) => setSelectedPeriod(value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Выберите период" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3days">За 3 дня</SelectItem>
                    <SelectItem value="7days">За неделю</SelectItem>
                    <SelectItem value="14days">За 2 недели</SelectItem>
                    <SelectItem value="30days">За месяц</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Поиск по темам"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>

              {isLoadingTrends ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30px]"></TableHead>
                      <TableHead>Тема</TableHead>
                      <TableHead>Источник</TableHead>
                      <TableHead>Кампания</TableHead>
                      <TableHead className="text-right">Реакции</TableHead>
                      <TableHead className="text-right">Комментарии</TableHead>
                      <TableHead className="text-right">Просмотры</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trends
                      .filter(topic => topic.title.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((topic) => (
                        <TableRow key={topic.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTopics.some(t => t.id === topic.id)}
                              onCheckedChange={() => toggleTopicSelection(topic)}
                            />
                          </TableCell>
                          <TableCell>{topic.title}</TableCell>
                          <TableCell>
                            {sources.find(s => s.id === topic.source_id)?.name || 'Неизвестный источник'}
                          </TableCell>
                          <TableCell>
                            {campaigns.find(c => c.id === topic.campaign_id)?.name}
                          </TableCell>
                          <TableCell className="text-right">
                            {topic.reactions?.toLocaleString() ?? 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {topic.comments?.toLocaleString() ?? 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {topic.views?.toLocaleString() ?? 0}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {selectedTopics.length > 0 && (
            <ContentGenerationPanel
              selectedTopics={selectedTopics}
              onGenerated={() => setSelectedTopics([])}
            />
          )}
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {selectedCampaignId && (
          <AddSourceDialog 
            campaignId={selectedCampaignId} 
            onClose={() => setIsDialogOpen(false)} 
          />
        )}
      </Dialog>
    </div>
  );
}