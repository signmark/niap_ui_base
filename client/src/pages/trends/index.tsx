import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { SourcePostsList } from "@/components/SourcePostsList";
import { Loader2, Search, Plus, RefreshCw, Bot, Trash2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { AddSourceDialog } from "@/components/AddSourceDialog";
import { NewSourcesDialog } from "@/components/NewSourcesDialog";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";

// Определение интерфейсов для типизации
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useCampaignStore } from "@/lib/campaignStore";

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
  status: string | null;
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
  link: string | null;
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
  // Используем глобальный стор кампаний
  const { selectedCampaign } = useCampaignStore();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(selectedCampaign?.id || "");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const statusCheckInterval = useRef<NodeJS.Timeout>();
  const [activeTab, setActiveTab] = useState('trends');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Обновляем локальный ID кампании когда меняется глобальный выбор
  useEffect(() => {
    if (selectedCampaign?.id) {
      setSelectedCampaignId(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  // Эффект для очистки интервала при размонтировании
  useEffect(() => {
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);

  // Функция для проверки статуса конкретного источника
  const checkSourceStatus = async (sourceId: string) => {
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) return;

      const response = await directusApi.get(`/items/campaign_content_sources/${sourceId}`, {
        params: {
          fields: ['status']
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const status = response.data?.data?.status;

      // Если статус finished или null, останавливаем проверку
      if (status === 'finished' || !status) {
        if (statusCheckInterval.current) {
          clearInterval(statusCheckInterval.current);
          statusCheckInterval.current = undefined;
        }
        setActiveSourceId(null);
      }

      // Обновляем кеш с новым статусом
      queryClient.setQueryData(
        ["campaign_content_sources", selectedCampaignId],
        (old: any[]) => old?.map(source =>
          source.id === sourceId
            ? { ...source, status }
            : source
        )
      );
    } catch (error) {
      console.error('Error checking source status:', error);
    }
  };

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
    enabled: Boolean(userData?.id),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: false
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
          fields: ['id', 'name', 'url', 'type', 'is_active', 'campaign_id', 'created_at', 'status']
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

  const { mutate: launchWebhook } = useMutation({
    mutationFn: async (sourceId: string) => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      
      // Отправляем запрос на запуск сбора постов из источника
      console.log(`Starting post collection for source ${sourceId} in campaign ${selectedCampaignId}`);
      
      // Найдем имя источника для передачи на сервер
      const source = sources.find(s => s.id === sourceId);
      
      return await fetch(`/api/sources/${sourceId}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          sourceName: source?.name || 'Источник' // Передаем имя источника в запросе
        })
      }).then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.message || 'Ошибка при запуске задачи');
          });
        }
        return response.json();
      });
    },
    onSuccess: (data) => {
      console.log('Webhook success response:', data);
      // Используем имя источника, полученное от сервера, или ищем в текущем списке
      const sourceName = data.sourceName || sources.find(s => s.id === data.sourceId)?.name || data.sourceId;
      const sourceId = data.sourceId;
      
      toast({
        title: "Запущено!",
        description: `Задача по сбору постов из источника ${sourceName} запущена`,
        variant: "default",
      });
      
      // Устанавливаем активный источник для проверки статуса
      setActiveSourceId(sourceId);
      
      // Запускаем интервал проверки статуса каждые 3 секунды
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
      
      statusCheckInterval.current = setInterval(() => {
        checkSourceStatus(sourceId);
      }, 3000);
      
      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
    },
    onError: (error: Error) => {
      console.error("Error launching source crawl:", error);
      toast({
        title: "Ошибка!",
        description: error.message || "Не удалось запустить задачу",
        variant: "destructive",
      });
    }
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
      const searchPromises = keywordsList.map(async (keyword: string) => {
        try {
          const res = await fetch('/api/sources/collect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ keywords: [keyword] })
          });
          
          // Проверяем тип контента
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return res.json();
          } else {
            console.error(`Неверный тип контента для ключевого слова ${keyword}:`, contentType);
            const text = await res.text();
            console.error('Полученный ответ:', text.substring(0, 200) + '...');
            throw new Error(`Получен неверный формат ответа для ключевого слова "${keyword}"`);
          }
        } catch (error) {
          console.error(`Ошибка при поиске источников для ключевого слова "${keyword}":`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

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
        console.log("Using exact API URL format that works");

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
      if (!selectedCampaignId) {
        throw new Error("Выберите кампанию");
      }

      if (!keywords?.length) {
        throw new Error("Добавьте ключевые слова в кампанию");
      }

      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      
      // Gather all keywords from the campaign for the webhook
      const keywordsList = keywords.map((k: { keyword: string }) => k.keyword);
      console.log('Sending keywords to webhook:', keywordsList);
      
      // Send request to our API endpoint which will forward to n8n webhook
      const webhookResponse = await fetch('/api/trends/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          campaignId: selectedCampaignId,
          keywords: keywordsList 
        })
      });
      
      if (!webhookResponse.ok) {
        throw new Error("Ошибка при отправке запроса на сбор трендов");
      }
      
      const trendData = await webhookResponse.json();
      console.log('Received trend data:', trendData);
      
      // If the webhook returns trend posts directly, save them to the database
      if (trendData?.trendTopics && Array.isArray(trendData.trendTopics)) {
        // Save trend topics to Directus
        for (const topic of trendData.trendTopics) {
          await directusApi.post('/items/campaign_trend_topics', {
            title: topic.title,
            campaign_id: selectedCampaignId,
            source_id: topic.sourceId,
            reactions: topic.reactions || 0,
            comments: topic.comments || 0,
            views: topic.views || 0,
            is_bookmarked: false
          }, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["campaign_trend_topics"] });
      return trendData;
    },
    onSuccess: (data) => {
      toast({
        title: "Успешно",
        description: `Собрано ${data?.trendTopics?.length || 0} трендовых тем. Обновление страницы...`
      });
      
      // Refresh the trend topics list
      queryClient.invalidateQueries({ queryKey: ["campaign_trend_topics"] });
    },
    onError: (error: Error) => {
      console.error('Error collecting trends:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось запустить сбор трендов"
      });
    }
  });

  // Функционал запуска краулера через API удален, так как больше не используется

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'start':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'running':
        return <Clock className="h-4 w-4 animate-spin text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'finished':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

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
                <div className="flex items-center">
                  <svg 
                    className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Анализ данных...</span>
                </div>
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
        {/* Используется глобальный селектор кампаний */}

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
                        <div className="flex items-center gap-2">
                          {getStatusIcon(source.status)}
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
                            onClick={() => launchWebhook(source.id)}
                            disabled={false} 
                            title="Запустить сбор данных из источника"
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
                            .filter((topic: TrendTopic) => topic.title.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((topic: TrendTopic) => (
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