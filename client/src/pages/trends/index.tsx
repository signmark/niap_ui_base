import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { SourcePostsList } from "@/components/SourcePostsList";
import { Loader2, Search, Plus, RefreshCw, Bot, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { AddSourceDialog } from "@/components/AddSourceDialog";
import { NewSourcesDialog } from "@/components/NewSourcesDialog";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

interface Campaign {
  id: string;
  name: string;
  description: string;
  link: string | null;
  created_at: string;
  updated_at: string;
}

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

interface SourcePost {
  id: string;
  post_content: string | null;
  image_url: string | null;
  likes: number | null;
  views: number | null;
  comments: number | null;
  shares: number | null;
  source_id: string;
  campaign_id: string;
  url: string | null;
  post_type: string | null;
  video_url: string | null;
  date: string | null;
  metadata: any | null;
}

type Period = "3days" | "7days" | "14days" | "30days";

const isValidPeriod = (period: string): period is Period => {
  return ['3days', '7days', '14days', '30days'].includes(period);
};


export default function Trends() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("7days");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSearchingNewSources, setIsSearchingNewSources] = useState(false);
  const [foundSourcesData, setFoundSourcesData] = useState<any>(null);
  const [selectedTopics, setSelectedTopics] = useState<TrendTopic[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [activeTab, setActiveTab] = useState('trends');
  const { add: toast } = useToast(); 
  const queryClient = useQueryClient();

  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ["user_data"],
    queryFn: async () => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      try {
        const response = await directusApi.get('/users/me', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        return response.data?.data;
      } catch (error) {
        console.error("Error fetching user data:", error);
        throw error;
      }
    }
  });

  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery<Campaign[]>({
    queryKey: ["user_campaigns", userData?.id],
    queryFn: async () => {
      try {
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          throw new Error("Требуется авторизация");
        }

        const response = await directusApi.get('/items/user_campaigns', {
          params: {
            filter: {
              user_id: {
                _eq: userData?.id
              }
            },
            fields: ['id', 'name', 'description', 'link', 'created_at', 'updated_at']
          },
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (!response.data?.data) {
          return [];
        }

        return response.data.data;
      } catch (error) {
        console.error("Error fetching campaigns:", error);
        throw error;
      }
    },
    enabled: Boolean(userData?.id)
  });

  const { data: sources = [], isLoading: isLoadingSources } = useQuery<ContentSource[]>({
    queryKey: ["campaign_content_sources", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      console.log('Fetching sources for campaign:', selectedCampaignId);

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
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      console.log('Sources API response:', {
        status: response.status,
        dataLength: response.data?.data?.length,
        firstSource: response.data?.data?.[0]
      });

      return response.data?.data || [];
    },
    enabled: !!selectedCampaignId
  });

  const { mutate: deleteSource } = useMutation({
    mutationFn: async (sourceId: string) => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      return await directusApi.patch(`/items/campaign_content_sources/${sourceId}`, {
        is_active: false
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
      toast({
        title: "Успешно",
        description: "Источник удален"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось удалить источник"
      });
    }
  });

  const { data: keywords = [], isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["campaign_keywords", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      const response = await directusApi.get('/items/user_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: selectedCampaignId
            }
          }
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return response.data?.data || [];
    },
    enabled: !!selectedCampaignId
  });

  const { mutate: searchNewSources, isPending: isSearching } = useMutation({
    mutationFn: async () => {
      if (!selectedCampaignId) {
        throw new Error("Выберите кампанию");
      }

      if (!keywords?.length) {
        throw new Error("Добавьте ключевые слова в кампанию");
      }

      const keywordsList = keywords.map((k: { keyword: string }) => k.keyword);
      console.log('Keywords for search:', keywordsList);
      const authToken = localStorage.getItem('auth_token');

      if (!authToken) {
        throw new Error("Требуется авторизация. Пожалуйста, войдите в систему снова.");
      }

      // Поиск источников для каждого ключевого слова отдельно
      const searchPromises = keywordsList.map((keyword: string) =>
        fetch('/api/sources/collect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ keywords: [keyword] })
        }).then(res => res.json())
      );

      const results = await Promise.all(searchPromises);

      // Объединяем все результаты
      const allSources = results.reduce((acc: { url: string; rank: number }[], result: any) => {
        if (result?.success && result?.data?.sources) {
          result.data.sources.forEach((source: { url: string; rank: number }) => {
            if (!acc.some(s => s.url === source.url)) {
              acc.push(source);
            }
          });
        }
        return acc;
      }, []);

      return {
        success: true,
        data: {
          sources: allSources
        }
      };
    },
    onSuccess: (data) => {
      console.log('Success Data:', data);
      setFoundSourcesData(data);
      setIsSearchingNewSources(true);
      toast({
        title: "Найдены источники",
        description: `Найдено ${data.data.sources.length} качественных источников`
      });
    },
    onError: (error: Error) => {
      console.error('Search Error:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message
      });
    }
  });

  const { data: trends = [], isLoading: isLoadingTrends } = useQuery({
    queryKey: ["campaign_trend_topics", selectedPeriod, selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

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
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return response.data?.data || [];
    },
    enabled: !!selectedCampaignId
  });

  const { data: sourcePosts = [], isLoading: isLoadingSourcePosts } = useQuery<SourcePost[]>({
    queryKey: ['source_posts', selectedCampaignId, selectedPeriod],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      console.log("Fetching source posts with params:", {
        campaignId: selectedCampaignId,
        period: selectedPeriod
      });

      try {
        // Используем точный формат запроса, который работает
        console.log("Using exact API URL format that works");

        // Подготовка параметров для фильтрации по дате в зависимости от периода
        const dateParams: Record<string, any> = {};
        if (isValidPeriod(selectedPeriod)) {
          const from = new Date();
          switch (selectedPeriod) {
            case '3days':
              from.setDate(from.getDate() - 3);
              break;
            case '14days':
              from.setDate(from.getDate() - 14);
              break;
            case '30days':
              from.setDate(from.getDate() - 30);
              break;
            default: // '7days'
              from.setDate(from.getDate() - 7);
          }
          // Добавляем фильтр только если выбран период
          dateParams['filter[date][_gte]'] = from.toISOString();
        }

        const response = await directusApi.get('/items/source_posts', {
          params: {
            'fields[]': ['id', 'post_content', 'image_url', 'likes', 'views', 'comments', 'shares', 'source_id', 'campaign_id', 'url', 'post_type', 'video_url', 'date', 'metadata'],
            'limit': 50,
            'sort[]': ['-date'],
            'filter[campaign_id][_eq]': selectedCampaignId,
            ...dateParams
          },
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        console.log("Source posts API response:", {
          status: response.status,
          dataLength: response.data?.data?.length,
          firstPost: response.data?.data?.[0]
        });

        return response.data?.data || [];
      } catch (error) {
        console.error("Error fetching source posts:", error);
        toast({
          variant: "destructive",
          description: "Ошибка загрузки постов из источников"
        });
        return [];
      }
    },
    enabled: !!selectedCampaignId,
    retry: 1,
    staleTime: 1000 * 60 * 5
  });


  const { mutate: collectTrends, isPending: isCollecting } = useMutation({
    mutationFn: async () => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      const response = await directusApi.post('/items/crawler_tasks', {
        campaign_id: selectedCampaignId,
        status: 'pending',
        type: 'trend_collection'
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      queryClient.invalidateQueries({ queryKey: ["campaign_trend_topics"] });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Запущен сбор трендов. Результаты появятся в течение нескольких минут."
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось запустить сбор трендов"
      });
    }
  });

  const { mutate: createCrawlerTask } = useMutation({
    mutationFn: async (sourceId: string) => {
      if (!selectedCampaignId) {
        throw new Error('No campaign selected');
      }

      const response = await fetch('https://n8n.nplanner.ru/webhook/0b4d5ad4-00bf-420a-b107-5f09a9ae913c', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sourceId })
      });

      if (!response.ok) {
        throw new Error(`Failed to start crawler task: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data, sourceId) => {
      const source = sources.find(s => s.id === sourceId);
      // Показываем уведомление
      toast({
        title: "Задача запущена",
        description: source ? `Запущен сбор данных для источника ${source.name}` : "Запущен сбор данных",
        variant: "default",
        duration: 5000
      });
    },
    onError: (error: Error) => {
      console.error('Mutation error:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось запустить задачу"
      });
    }
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

  const isValidCampaignSelected = selectedCampaignId &&
    selectedCampaignId !== "loading" &&
    selectedCampaignId !== "empty";

  if (isLoadingUser || isLoadingCampaigns) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center sticky top-0 bg-background z-10 pb-4">
        <div>
          <h1 className="text-2xl font-bold">SMM Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Анализ популярных тем и управление контентом в социальных медиа
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => searchNewSources()}
            disabled={isSearching || !isValidCampaignSelected}
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Поиск источников...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Найти источники
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => collectTrends()}
            disabled={isCollecting || !isValidCampaignSelected}
          >
            {isCollecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сбор трендов...
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

      <div className="space-y-6">
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
                          <p className="text-sm text-muted-foreground">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              {source.url}
                            </a>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-foreground">
                            {source.type === 'website' ? 'Веб-сайт' :
                              source.type === 'telegram' ? 'Telegram канал' :
                                source.type === 'vk' ? 'VK группа' : source.type}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => createCrawlerTask(source.id)}
                          >
                            <Bot className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteSource(source.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="border-b mb-4">
                  <div className="flex">
                    <button
                      className={`px-4 py-2 border-b-2 ${activeTab === 'trends' ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
                      onClick={() => setActiveTab('trends')}
                    >
                      Тренды
                    </button>
                    <button
                      className={`px-4 py-2 border-b-2 ${activeTab === 'source-posts' ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
                      onClick={() => setActiveTab('source-posts')}
                    >
                      Посты из источников
                    </button>
                  </div>
                </div>

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
                    placeholder={activeTab === 'trends' ? "Поиск по темам" : "Поиск постов"}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>

                {activeTab === 'trends' ? (
                  <>
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
                            .filter((topic) => topic.title.toLowerCase().includes(searchQuery.toLowerCase()))
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
                  </>
                ) : (
                  <div>
                    <SourcePostsList
                      posts={sourcePosts.filter(post =>
                        post.post_content?.toLowerCase().includes(searchQuery.toLowerCase())
                      )}
                      isLoading={isLoadingSourcePosts}
                    />
                  </div>
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
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {selectedCampaignId && (
          <AddSourceDialog
            campaignId={selectedCampaignId}
            onClose={() => setIsDialogOpen(false)}
          />
        )}
      </Dialog>

      <Dialog open={isSearchingNewSources} onOpenChange={setIsSearchingNewSources}>
        {selectedCampaignId && foundSourcesData && (
          <NewSourcesDialog
            campaignId={selectedCampaignId}
            onClose={() => {
              setIsSearchingNewSources(false);
              setFoundSourcesData(null);
            }}
            sourcesData={foundSourcesData}
          />
        )}
      </Dialog>
    </div>
  );
}