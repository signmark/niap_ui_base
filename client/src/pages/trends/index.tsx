import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ArrowUpIcon, ArrowDownIcon, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

/**
 * Создает проксированный URL для загрузки изображений/видео через серверный прокси
 * с учетом специфики разных источников (Instagram, VK, Telegram)
 */
function createProxyImageUrl(imageUrl: string, itemId: string): string {
  // Если URL пустой или undefined, возвращаем пустую строку
  if (!imageUrl) return '';
  
  // Добавляем cache-busting параметр
  const timestamp = Date.now();
  
  // Определяем тип источника (Instagram, VK, etc)
  const isInstagram = imageUrl.includes('instagram.') || 
                     imageUrl.includes('fbcdn.net') || 
                     imageUrl.includes('cdninstagram.com');
  
  const isVk = imageUrl.includes('vk.com') || 
               imageUrl.includes('vk.me') || 
               imageUrl.includes('userapi.com');
  
  const isTelegram = imageUrl.includes('tgcnt.ru') || 
                    imageUrl.includes('t.me');
  
  // Формируем параметры для прокси
  let forcedType = isInstagram ? 'instagram' : 
                  isVk ? 'vk' : 
                  isTelegram ? 'telegram' : null;
  
  // Базовый URL прокси с параметрами
  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}&_t=${timestamp}${forcedType ? '&forceType=' + forcedType : ''}&itemId=${itemId}`;
}
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { SourcePostsList } from "@/components/SourcePostsList";
import { SourcePostsSearchForm } from "@/components/SourcePostsSearchForm";
import { Loader2, Search, Plus, RefreshCw, Bot, Trash2, CheckCircle, Clock, AlertCircle, FileText, ThumbsUp, MessageSquare, Eye, Bookmark, Flame, Download, ExternalLink, BarChart } from "lucide-react";
import { TrendDetailDialog } from "@/components/TrendDetailDialog";
import { Dialog } from "@/components/ui/dialog";
import { AddSourceDialog } from "@/components/AddSourceDialog";
import { NewSourcesDialog } from "@/components/NewSourcesDialog";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import { TrendContentGenerator } from "@/components/TrendContentGenerator";
import { SocialNetworkSelectorDialog } from "@/components/SocialNetworkSelectorDialog";
import { SourcesSearchDialog } from "@/components/SourcesSearchDialog";
import { Badge } from "@/components/ui/badge";
import { BulkSourcesImportDialog } from "@/components/BulkSourcesImportDialog";

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
  description?: string;
}

interface TrendTopic {
  id: string;
  title: string;
  source_id?: string;  // Версия с подчеркиванием (snake_case)
  sourceId?: string;   // Версия в camelCase
  sourceName?: string; // Имя источника, может приходить напрямую от API
  sourceUrl?: string;  // URL источника (аккаунта или страницы)
  url?: string;        // URL оригинальной публикации
  reactions: number;
  comments: number;
  views: number;
  created_at?: string; // Версия с подчеркиванием (snake_case)
  createdAt?: string;  // Версия в camelCase
  is_bookmarked?: boolean; // Версия с подчеркиванием (snake_case)
  isBookmarked?: boolean;  // Версия в camelCase
  campaign_id?: string;    // Версия с подчеркиванием (snake_case)
  campaignId?: string;     // Версия в camelCase
  media_links?: string;    // JSON строка с медиа-данными
  mediaLinks?: string;     // Альтернативное имя поля
  description?: string;    // Описание или контент тренда
  accountUrl?: string;     // URL аккаунта источника
  urlPost?: string;        // URL оригинального поста
  sourceDescription?: string; // Описание источника
  trendScore?: number;     // Оценка тренда
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

type Period = "3days" | "7days" | "14days" | "30days" | "all";

const isValidPeriod = (period: string): period is Period => {
  return ['3days', '7days', '14days', '30days'].includes(period);
};


// Функция форматирования относительного времени (например, "2 часа назад")
const formatRelativeTime = (date: Date): string => {
  try {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: ru
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Н/Д';
  }
};

export default function Trends() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("7days");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSearchingNewSources, setIsSearchingNewSources] = useState(false);
  const [foundSourcesData, setFoundSourcesData] = useState<any>(null);
  const [selectedTopics, setSelectedTopics] = useState<TrendTopic[]>([]);
  
  // Состояния для сортировки
  type SortField = 'reactions' | 'comments' | 'views' | 'trendScore' | 'date' | 'platform' | 'none';
  const [sortField, setSortField] = useState<SortField>('none');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Состояние для фильтра по соцсетям
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  // Используем глобальный стор кампаний
  const { selectedCampaign } = useCampaignStore();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(selectedCampaign?.id || "");

  const [activeTab, setActiveTab] = useState('trends');
  const [isSocialNetworkDialogOpen, setIsSocialNetworkDialogOpen] = useState(false);
  const [isSourceSearchDialogOpen, setIsSourceSearchDialogOpen] = useState(false);
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
  const [selectedTrendTopic, setSelectedTrendTopic] = useState<TrendTopic | null>(null);
  const [previewTrendTopic, setPreviewTrendTopic] = useState<TrendTopic | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Состояния для комментариев
  const [trendComments, setTrendComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [collectingCommentsForTrend, setCollectingCommentsForTrend] = useState<string | null>(null);
  
  // Состояние для анализа настроения
  const [sentimentData, setSentimentData] = useState<any>(null);
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
  

  const [selectedKeyword, setSelectedKeyword] = useState<string>("");

  // Функция для сбора комментариев к тренду
  const collectTrendComments = async (trendId: string, trendUrl: string) => {
    try {
      setCollectingCommentsForTrend(trendId);
      
      const response = await fetch('https://n8n.roboflow.tech/webhook/collect-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trend_id: trendId,
          url: trendUrl
        })
      });

      if (response.ok) {
        toast({
          title: "Сбор комментариев запущен",
          description: "Комментарии будут собраны и появятся в соответствующем разделе",
        });
      } else {
        throw new Error('Failed to start comment collection');
      }
    } catch (error) {
      toast({
        title: "Ошибка сбора комментариев",
        description: "Не удалось запустить сбор комментариев",
        variant: "destructive",
      });
    } finally {
      setCollectingCommentsForTrend(null);
    }
  };

  // Функция для загрузки комментариев выбранного тренда
  const loadTrendComments = async (trendId: string) => {
    try {
      setIsLoadingComments(true);
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      const response = await fetch(`/api/trend-comments/${trendId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTrendComments(data.data || []);
      } else {
        throw new Error('Failed to load comments');
      }
    } catch (error) {
      console.error('Error loading trend comments:', error);
      setTrendComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };
  
  // Обновляем локальный ID кампании когда меняется глобальный выбор
  useEffect(() => {
    if (selectedCampaign?.id) {
      setSelectedCampaignId(selectedCampaign.id);
      // Принудительно обновляем данные трендов для получения sentiment_analysis
      queryClient.invalidateQueries({ queryKey: ["trends"] });
    }
  }, [selectedCampaign, queryClient]);

  // Загрузка существующего анализа настроения для тренда из кэшированных данных
  const loadExistingSentimentAnalysis = (selectedTrend: TrendTopic | null) => {
    if (selectedTrend && (selectedTrend as any).sentiment_analysis) {
      console.log('✅ Загружаем существующий анализ для тренда:', selectedTrend.id, (selectedTrend as any).sentiment_analysis);
      setSentimentData((selectedTrend as any).sentiment_analysis);
    } else {
      console.log('❌ Анализ настроения не найден для тренда:', selectedTrend?.id);
      console.log('🔍 Все доступные поля тренда:', selectedTrend ? Object.keys(selectedTrend) : 'нет тренда');
      setSentimentData(null);
    }
  };

  // Автоматическая загрузка комментариев при выборе тренда и переходе на вкладку "Комментарии"
  useEffect(() => {
    if (selectedTrendTopic && activeTab === 'comments') {
      loadTrendComments(selectedTrendTopic.id);
      // Загружаем существующий анализ настроения если есть
      loadExistingSentimentAnalysis(selectedTrendTopic);
    } else if (selectedTrendTopic) {
      // Если просто меняется тренд, загружаем анализ
      loadExistingSentimentAnalysis(selectedTrendTopic);
    } else {
      // Очищаем данные анализа настроения при отсутствии выбранного тренда
      setSentimentData(null);
    }
  }, [selectedTrendTopic, activeTab]);

  // Функции для работы с выбором всех трендов
  const selectAllVisibleTrends = () => {
    const visibleTrends = trends.filter((topic: TrendTopic) => {
      // Применяем те же фильтры, что и в основном рендере
      const detectPlatform = () => {
        const sourceType = (topic as any).sourceType || '';
        if (!sourceType) return 'unknown';
        
        const normalized = sourceType.toLowerCase().trim();
        if (normalized === 'instagram') return 'instagram';
        if (normalized === 'vk' || normalized === 'vkontakte') return 'vk';
        if (normalized === 'telegram') return 'telegram';
        if (normalized === 'facebook') return 'facebook';
        
        return 'unknown';
      };

      const detectedPlatform = detectPlatform();
      const matchesSearch = topic.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      let platformMatches = false;
      if (selectedPlatform === 'all') {
        platformMatches = true;
      } else {
        switch (selectedPlatform) {
          case 'instagram':
            platformMatches = detectedPlatform === 'instagram';
            break;
          case 'vk':
            platformMatches = detectedPlatform === 'vk';
            break;
          case 'telegram':
            platformMatches = detectedPlatform === 'telegram';
            break;
          case 'facebook':
            platformMatches = detectedPlatform === 'facebook';
            break;
          default:
            platformMatches = true;
        }
      }
      
      return matchesSearch && platformMatches;
    });

    setSelectedTopics(visibleTrends);
  };

  const deselectAllTrends = () => {
    setSelectedTopics([]);
  };

  const areAllVisibleTrendsSelected = () => {
    const visibleTrends = trends.filter((topic: TrendTopic) => {
      // Применяем те же фильтры, что и в основном рендере
      const detectPlatform = () => {
        const sourceType = (topic as any).sourceType || '';
        if (!sourceType) return 'unknown';
        
        const normalized = sourceType.toLowerCase().trim();
        if (normalized === 'instagram') return 'instagram';
        if (normalized === 'vk' || normalized === 'vkontakte') return 'vk';
        if (normalized === 'telegram') return 'telegram';
        if (normalized === 'facebook') return 'facebook';
        
        return 'unknown';
      };

      const detectedPlatform = detectPlatform();
      const matchesSearch = topic.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      let platformMatches = false;
      if (selectedPlatform === 'all') {
        platformMatches = true;
      } else {
        switch (selectedPlatform) {
          case 'instagram':
            platformMatches = detectedPlatform === 'instagram';
            break;
          case 'vk':
            platformMatches = detectedPlatform === 'vk';
            break;
          case 'telegram':
            platformMatches = detectedPlatform === 'telegram';
            break;
          case 'facebook':
            platformMatches = detectedPlatform === 'facebook';
            break;
          default:
            platformMatches = true;
        }
      }
      
      return matchesSearch && platformMatches;
    });

    return visibleTrends.length > 0 && visibleTrends.every(trend => 
      selectedTopics.some(selected => selected.id === trend.id)
    );
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

  // Используем useRef для отслеживания необходимости обновления данных
  const shouldRefreshSources = useRef<boolean>(false);
  
  // Настраиваем интервал для периодического обновления статусов источников
  useEffect(() => {
    if (!selectedCampaignId) return;
    
    // Создаем интервал обновления для всех источников
    const refreshInterval = setInterval(() => {
      // Помечаем, что нужно обновить данные
      shouldRefreshSources.current = true;
      // И запускаем обновление запроса
      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
    }, 5000); // Обновляем каждые 5 секунд
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [selectedCampaignId, queryClient]);

  const { data: sources = [], isLoading: isLoadingSources } = useQuery<ContentSource[]>({
    queryKey: ["campaign_content_sources", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      console.log('Fetching sources for campaign:', selectedCampaignId);

      // Убираем фильтр is_active для получения всех источников кампании
      try {
        // Используем явно указанные параметры в GET-запросе
        const response = await directusApi.get('/items/campaign_content_sources', {
          params: {
            'filter[campaign_id][_eq]': selectedCampaignId,
            'fields[]': ['id', 'name', 'url', 'type', 'is_active', 'campaign_id', 'created_at', 'status']
          },
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        console.log('Sources API response:', {
          status: response.status,
          dataLength: response.data?.data?.length,
          firstSource: response.data?.data?.[0],
          allSources: response.data?.data
        });
        
        // Сбрасываем флаг обновления
        shouldRefreshSources.current = false;

        // Фильтруем активные источники на стороне клиента (если нужно)
        const allSources = response.data?.data || [];
        // return allSources.filter(source => source.is_active === true);
        return allSources; // Возвращаем все источники для отображения

      } catch (error) {
        console.error("Error fetching sources:", error);
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось загрузить источники данных"
        });
        return [];
      }
    },
    enabled: !!selectedCampaignId,
    refetchInterval: 3000 // Обновляем каждые 3 секунды автоматически
  });



  const { mutate: deleteSource } = useMutation({
    mutationFn: async (sourceId: string) => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      // Полностью удаляем источник вместо обновления is_active
      return await directusApi.delete(`/items/campaign_content_sources/${sourceId}`, {
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
      console.error('Error deleting source:', error);
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
      const response = await directusApi.get('/items/campaign_keywords', {
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

  const { mutate: searchNewSourcesExecute, isPending: isSearching } = useMutation({
    mutationFn: async (params: { keyword: string; platforms: string[]; customPrompt?: string }) => {
      if (!selectedCampaignId) {
        throw new Error("Выберите кампанию");
      }

      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация. Пожалуйста, войдите в систему снова.");
      }

      try {
        const res = await fetch('/api/sources/collect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ 
            keywords: [params.keyword],
            platforms: params.platforms,
            customPrompt: params.customPrompt
          })
        });
        
        // Проверяем тип контента
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        } else {
          console.error(`Неверный тип контента для ключевого слова ${params.keyword}:`, contentType);
          const text = await res.text();
          console.error('Полученный ответ:', text.substring(0, 200) + '...');
          throw new Error(`Получен неверный формат ответа для ключевого слова "${params.keyword}"`);
        }
      } catch (error) {
        console.error(`Ошибка при поиске источников для ключевого слова "${params.keyword}":`, error);
        throw error;
      }
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
  
  // Функция, открывающая диалог выбора платформ для поиска
  const searchNewSources = () => {
    if (!selectedCampaignId) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите кампанию"
      });
      return;
    }

    if (!keywords?.length) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Добавьте ключевые слова в кампанию"
      });
      return;
    }
    
    // Выбираем случайное ключевое слово из списка
    const randomIndex = Math.floor(Math.random() * keywords.length);
    const keyword = keywords[randomIndex]?.keyword || "";
    setSelectedKeyword(keyword);
    
    // Открываем диалог выбора платформ
    setIsSourceSearchDialogOpen(true);
  };

  // Интервалы для обновления данных
  const trendsRefreshInterval = useRef<NodeJS.Timeout>();
  const sourcesRefreshInterval = useRef<NodeJS.Timeout>();

  // Эффект для постоянного обновления трендов и источников
  useEffect(() => {
    // Не запускаем обновление без ID кампании
    if (!selectedCampaignId) return;
    
    console.log('Starting automatic data refresh intervals');
    
    // Создаем интервал обновления трендов (реже)
    trendsRefreshInterval.current = setInterval(() => {
      console.log('Refreshing trends data...');
      queryClient.invalidateQueries({ queryKey: ["trends", selectedPeriod, selectedCampaignId] });
    }, 15000); // Обновление трендов каждые 15 секунд
    
    // Создаем интервал обновления источников (реже)
    sourcesRefreshInterval.current = setInterval(() => {
      console.log('Refreshing sources data...');
      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
    }, 10000); // Обновление источников каждые 10 секунд
    
    return () => {
      // Очищаем интервалы при размонтировании компонента или смене кампании
      if (trendsRefreshInterval.current) {
        clearInterval(trendsRefreshInterval.current);
      }
      if (sourcesRefreshInterval.current) {
        clearInterval(sourcesRefreshInterval.current);
      }
    };
  }, [selectedCampaignId, selectedPeriod]);

  const { data: trends = [], isLoading: isLoadingTrends } = useQuery({
    queryKey: ["trends", selectedPeriod, selectedCampaignId],
    staleTime: 0, // Принудительно загружаем свежие данные
    gcTime: 0, // Не кэшируем данные
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      // Используем наш собственный API эндпоинт вместо прямого обращения к Directus
      const response = await fetch(`/api/campaign-trends?campaignId=${selectedCampaignId}&period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        console.error("Error fetching trends:", response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch trends");
      }
      
      const data = await response.json();
      console.log("Fetched trends data:", data);
      
      // Преобразуем данные, добавляя поля url и sourceUrl если они есть
      const processedTrends = (data.data || []).map((trend: any) => {
        // Добавляем обработку дополнительных полей
        return {
          ...trend,
          // Явно обрабатываем поля url и sourceUrl, если они присутствуют
          url: trend.url || trend.original_url || trend.originalUrl,
          sourceUrl: trend.sourceUrl || trend.source_url || trend.source?.url
        };
      });

      // Для периода "all" возвращаем все данные без дополнительной фильтрации
      if (selectedPeriod === 'all') {
        return processedTrends;
      }

      // Фильтруем тренды по выбранному периоду на клиентской стороне
      const now = new Date();
      const filterDate = new Date();
      
      switch (selectedPeriod) {
        case '3days':
          filterDate.setDate(now.getDate() - 3);
          break;
        case '7days':
          filterDate.setDate(now.getDate() - 7);
          break;
        case '14days':
          filterDate.setDate(now.getDate() - 14);
          break;
        case '30days':
          filterDate.setDate(now.getDate() - 30);
          break;
        default:
          return processedTrends; // Для неизвестных периодов возвращаем все данные
      }

      // Специальная диагностика для проблемного тренда
      const targetTrendId = "166eb032-3372-4807-926a-c6ca93a3db43";
      const targetTrend = processedTrends.find((trend: any) => trend.id === targetTrendId);
      
      if (targetTrend) {
        console.log(`[ДИАГНОСТИКА] Тренд ${targetTrendId} НАЙДЕН в данных:`, {
          id: targetTrend.id,
          title: targetTrend.title,
          created_at: targetTrend.created_at,
          createdAt: targetTrend.createdAt,
          campaign_id: targetTrend.campaign_id
        });
      } else {
        console.log(`[ДИАГНОСТИКА] Тренд ${targetTrendId} НЕ найден в ${processedTrends.length} трендах`);
        console.log(`[ДИАГНОСТИКА] Все ID трендов:`, processedTrends.map((t: any) => t.id));
      }

      // Фильтруем тренды по дате
      const filteredTrends = processedTrends.filter((trend: any) => {
        if (!trend.created_at && !trend.createdAt) return true; // Показываем тренды без даты
        
        const trendDate = new Date(trend.created_at || trend.createdAt);
        return trendDate >= filterDate;
      });

      // Проверяем, остался ли целевой тренд после фильтрации
      const targetTrendAfterFilter = filteredTrends.find((trend: any) => trend.id === targetTrendId);
      if (targetTrend && !targetTrendAfterFilter) {
        console.log(`[ДИАГНОСТИКА] Тренд ${targetTrendId} исключён фильтром по дате. Дата тренда: ${targetTrend.created_at || targetTrend.createdAt}, фильтр от: ${filterDate.toISOString()}`);
      }
      
      return filteredTrends;
    },
    enabled: !!selectedCampaignId
  });

  // Запрос для получения постов из источников
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
          firstPost: response.data?.data?.[0],
          fullResponse: response.data
        });

        const posts = response.data?.data || [];
        console.log("Returning posts array:", {
          length: posts.length,
          isEmpty: posts.length === 0,
          campaignId: selectedCampaignId,
          period: selectedPeriod
        });
        
        return posts;
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


  const { mutate: collectTrendsWithPlatforms, isPending: isCollecting } = useMutation({
    mutationFn: async ({ platforms, collectSources, collectComments }: { platforms: string[], collectSources?: boolean, collectComments?: string[] }) => {
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
      console.log('Sending keywords to webhook with platforms:', keywordsList, platforms);
      
      // Send request to our API endpoint which will forward to n8n webhook
      const webhookResponse = await fetch('/api/trends/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          campaignId: selectedCampaignId,
          keywords: keywordsList,
          platforms: platforms,
          collectSources: collectSources, // Добавляем флаг сбора источников
          collectComments: collectComments // Добавляем массив платформ для сбора комментариев
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

      queryClient.invalidateQueries({ queryKey: ["trends", selectedPeriod, selectedCampaignId] });
      return trendData;
    },
    onSuccess: (data, { platforms, collectSources, collectComments }) => {
      toast({
        title: "Успешно",
        description: collectSources 
          ? `Задача по сбору источников ${collectComments && collectComments.length > 0 ? 'и комментариев ' : ''}запущена. Данные будут обновляться автоматически.`
          : `Задача по сбору трендов запущена. Данные будут обновляться автоматически.`
      });
      
      // Refresh the trend topics list и источники
      queryClient.invalidateQueries({ queryKey: ["trends", selectedPeriod, selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
      
      // Сразу же обновляем, чтобы не ждать 3 секунды до первого обновления
      queryClient.invalidateQueries({ queryKey: ["trends", selectedPeriod, selectedCampaignId] });
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

  // Функция для открытия диалога выбора социальных сетей
  const collectTrends = () => {
    setIsSocialNetworkDialogOpen(true);
  };

  // Мониторинг данных о постах из источников (только для диагностики)
  useEffect(() => {
    if (sourcePosts?.length > 0) {
      console.log("sourcePosts loaded:", sourcePosts.length, "posts");
    }
  }, [sourcePosts?.length]);


  


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

  // Мутация для обновления статуса закладки
  const { mutate: updateTrendBookmark } = useMutation({
    mutationFn: async ({ id, isBookmarked }: { id: string, isBookmarked: boolean }) => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      
      return await fetch(`/api/campaign-trends/${id}/bookmark`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ isBookmarked })
      }).then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.message || 'Ошибка при обновлении закладки');
          });
        }
        return response.json();
      });
    },
    onSuccess: (data) => {
      console.log('Bookmark updated:', data);
      
      // Обновляем данные в кеше
      queryClient.setQueryData(
        ["trends", selectedPeriod, selectedCampaignId],
        (old: TrendTopic[] | undefined) => {
          if (!old) return [];
          return old.map(topic => 
            topic.id === data.id 
              ? { ...topic, is_bookmarked: data.is_bookmarked }
              : topic
          );
        }
      );
      
      // Обновляем выбранный тренд, если это тот же самый
      if (selectedTrendTopic && selectedTrendTopic.id === data.id) {
        setSelectedTrendTopic({
          ...selectedTrendTopic,
          is_bookmarked: data.is_bookmarked
        });
      }
      
      toast({
        title: data.is_bookmarked ? "Сохранено" : "Удалено из закладок",
        description: data.is_bookmarked ? "Тренд добавлен в закладки" : "Тренд удален из закладок",
      });
    },
    onError: (error: Error) => {
      console.error("Error updating bookmark:", error);
      toast({
        title: "Ошибка!",
        description: error.message || "Не удалось обновить закладку",
        variant: "destructive",
      });
    }
  });

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
      <div className="flex justify-between items-center bg-background pb-4">
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
          <Button
            onClick={() => setIsBulkImportDialogOpen(true)}
            disabled={!isValidCampaignSelected}
            variant="outline"
          >
            <FileText className="mr-2 h-4 w-4" />
            Импорт источников
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Используется глобальный селектор кампаний */}

        {isValidCampaignSelected && (
          <>
            <Card className="bg-white shadow-md">
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
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {sources
                      // Фильтрация дубликатов по URL - показываем только первый источник с уникальным URL
                      .filter((source, index, array) => {
                        return array.findIndex(s => s.url === source.url) === index;
                      })
                      .sort((a, b) => {
                        // Сортировка по типу источника в алфавитном порядке
                        const typeA = a.type === 'website' ? 'Веб-сайт' :
                          a.type === 'telegram' ? 'Telegram канал' :
                            a.type === 'vk' ? 'VK группа' :
                              a.type === 'instagram' ? 'Instagram аккаунт' : a.type;
                        const typeB = b.type === 'website' ? 'Веб-сайт' :
                          b.type === 'telegram' ? 'Telegram канал' :
                            b.type === 'vk' ? 'VK группа' :
                              b.type === 'instagram' ? 'Instagram аккаунт' : b.type;
                        return typeA.localeCompare(typeB);
                      })
                      .map((source) => (
                      <div key={source.id} className="flex items-center justify-between p-2 rounded-lg border">
                        <div className="flex items-center gap-2">
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
                                source.type === 'vk' ? 'VK группа' :
                                  source.type === 'instagram' ? 'Instagram аккаунт' : source.type}
                          </div>

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

            <Card className="bg-white shadow-md">
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
                      className={`px-4 py-2 border-b-2 ${activeTab === 'comments' ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
                      onClick={() => setActiveTab('comments')}
                    >
                      Комментарии
                    </button>
                  </div>
                </div>

                {activeTab === 'trends' ? (
                  <>
                    <div className="flex items-center flex-wrap gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground mr-1">Период:</div>
                        <Select
                          value={selectedPeriod}
                          onValueChange={(value: Period) => setSelectedPeriod(value)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Выберите период" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3days">За 3 дня</SelectItem>
                            <SelectItem value="7days">За неделю</SelectItem>
                            <SelectItem value="14days">За 2 недели</SelectItem>
                            <SelectItem value="30days">За месяц</SelectItem>
                            <SelectItem value="all">Все периоды</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground mr-1">Соцсеть:</div>
                        <Select
                          value={selectedPlatform}
                          onValueChange={(value: string) => setSelectedPlatform(value)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Все соцсети" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Все соцсети</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="vk">VKontakte</SelectItem>
                            <SelectItem value="telegram">Telegram</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground mr-1">Сортировка:</div>
                        {/* Force update - platform sorting added */}
                        <Select 
                          defaultValue="none" 
                          value={sortField}
                          onValueChange={(value) => setSortField(value as SortField)}
                        >
                          <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder="Выберите поле">
                              {sortField === 'none' && (
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                  <span>По умолчанию</span>
                                </div>
                              )}
                              {sortField === 'reactions' && (
                                <div className="flex items-center gap-2">
                                  <ThumbsUp className="h-4 w-4 text-blue-500" />
                                  <span>По лайкам</span>
                                </div>
                              )}
                              {sortField === 'comments' && (
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-green-500" />
                                  <span>По комментариям</span>
                                </div>
                              )}
                              {sortField === 'views' && (
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4 text-purple-500" />
                                  <span>По просмотрам</span>
                                </div>
                              )}
                              {sortField === 'trendScore' && (
                                <div className="flex items-center gap-2">
                                  <Flame className="h-4 w-4 text-orange-500" />
                                  <span>По трендовости</span>
                                </div>
                              )}
                              {sortField === 'date' && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-500" />
                                  <span>По дате</span>
                                </div>
                              )}
                              {sortField === 'platform' && (
                                <div className="flex items-center gap-2">
                                  <Globe className="h-4 w-4 text-indigo-500" />
                                  <span>По соцсетям</span>
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                <span>По умолчанию</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="reactions">
                              <div className="flex items-center gap-2">
                                <ThumbsUp className="h-4 w-4 text-blue-500" />
                                <span>По лайкам</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="comments">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-green-500" />
                                <span>По комментариям</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="views">
                              <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-purple-500" />
                                <span>По просмотрам</span>
                              </div>
                            </SelectItem>
                            {activeTab === 'trends' && (
                              <SelectItem value="trendScore">
                                <div className="flex items-center gap-2">
                                  <Flame className="h-4 w-4 text-orange-500" />
                                  <span>По трендовости</span>
                                </div>
                              </SelectItem>
                            )}
                            <SelectItem value="date">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-500" />
                                <span>По дате</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="platform">
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-indigo-500" />
                                <span>По соцсетям</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {sortField !== 'none' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                            className="h-9 px-2"
                          >
                            {sortDirection === 'asc' ? (
                              <ArrowUpIcon className="h-4 w-4" />
                            ) : (
                              <ArrowDownIcon className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>

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
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <div className="text-xs text-gray-500">
                            Всего трендов: {trends.length} | Период: {selectedPeriod} | Платформа: {selectedPlatform}
                            {selectedPeriod === 'all' && <span className="text-green-600"> (загружены ВСЕ записи)</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={areAllVisibleTrendsSelected()}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  selectAllVisibleTrends();
                                } else {
                                  deselectAllTrends();
                                }
                              }}
                              className="h-4 w-4 border-gray-400"
                            />
                            <span className="text-xs text-gray-600 cursor-pointer"
                              onClick={() => {
                                if (areAllVisibleTrendsSelected()) {
                                  deselectAllTrends();
                                } else {
                                  selectAllVisibleTrends();
                                }
                              }}
                            >
                              Выбрать все
                            </span>
                            {selectedTopics.length > 0 && (
                              <span className="text-xs text-blue-600 ml-2">
                                ({selectedTopics.length} выбрано)
                              </span>
                            )}
                          </div>
                        </div>
                        {trends
                          .filter((topic: TrendTopic) => {
                            // Определяем платформу ТОЛЬКО по полю sourceType
                            const detectPlatform = () => {
                              const sourceType = (topic as any).sourceType || '';
                              if (!sourceType) return 'unknown';
                              
                              const normalized = sourceType.toLowerCase().trim();
                              if (normalized === 'instagram') return 'instagram';
                              if (normalized === 'vk' || normalized === 'vkontakte') return 'vk';
                              if (normalized === 'telegram') return 'telegram';
                              if (normalized === 'facebook') return 'facebook';
                              
                              return 'unknown';
                            };

                            const detectedPlatform = detectPlatform();
                            
                            // Фильтр по периоду времени - сервер уже отфильтровал данные по периоду
                            // Показываем ВСЕ полученные от сервера записи
                            const withinPeriod = true;
                            
                            // Фильтр по поисковому запросу
                            const matchesSearch = topic.title.toLowerCase().includes(searchQuery.toLowerCase());
                            
                            // Фильтр по соцсети
                            let platformMatches = false;
                            if (selectedPlatform === 'all') {
                              platformMatches = true;
                            } else {
                              switch (selectedPlatform) {
                                case 'instagram':
                                  platformMatches = detectedPlatform === 'instagram';
                                  break;
                                case 'vk':
                                  platformMatches = detectedPlatform === 'vk';
                                  break;
                                case 'telegram':
                                  platformMatches = detectedPlatform === 'telegram';
                                  break;
                                case 'facebook':
                                  platformMatches = detectedPlatform === 'facebook';
                                  break;
                                default:
                                  platformMatches = true;
                              }
                            }
                            
                            const finalResult = withinPeriod && matchesSearch && platformMatches;
                            

                            
                            return finalResult;
                          })
                          .filter((topic: TrendTopic, index: number, array: TrendTopic[]) => {
                            return true;
                          })
                          // Сортировка трендов
                          .sort((a: TrendTopic, b: TrendTopic) => {
                            if (sortField === 'none') return 0;
                            
                            let valueA, valueB;
                            
                            // Определяем значения для сравнения в зависимости от выбранного поля сортировки
                            switch(sortField) {
                              case 'reactions':
                                valueA = a.reactions || 0;
                                valueB = b.reactions || 0;
                                break;
                              case 'comments':
                                valueA = a.comments || 0;
                                valueB = b.comments || 0;
                                break;
                              case 'views':
                                valueA = a.views || 0;
                                valueB = b.views || 0;
                                break;
                              case 'trendScore':
                                valueA = a.trendScore || 0;
                                valueB = b.trendScore || 0;
                                break;
                              case 'date':
                                valueA = new Date(a.created_at || a.createdAt || 0).getTime();
                                valueB = new Date(b.created_at || b.createdAt || 0).getTime();
                                break;
                              case 'platform':
                                // Определяем платформу по источнику
                                const sourceA = sources.find(s => s.id === a.source_id || s.id === a.sourceId);
                                const sourceB = sources.find(s => s.id === b.source_id || s.id === b.sourceId);
                                
                                const getPlatform = (source: any) => {
                                  if (!source) return 'zz_unknown'; // Неизвестные в конце
                                  const url = source.url.toLowerCase();
                                  if (url.includes('instagram.com')) return 'instagram';
                                  if (url.includes('vk.com') || url.includes('vkontakte.ru')) return 'vk';
                                  if (url.includes('t.me') || url.includes('telegram.org')) return 'telegram';
                                  if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
                                  return 'zz_other';
                                };
                                
                                valueA = getPlatform(sourceA);
                                valueB = getPlatform(sourceB);
                                
                                // Для строковых значений используем localeCompare
                                return sortDirection === 'asc' 
                                  ? valueA.localeCompare(valueB) 
                                  : valueB.localeCompare(valueA);
                              default:
                                return 0;
                            }
                            
                            // Применяем выбранное направление сортировки
                            return sortDirection === 'asc' 
                              ? valueA - valueB 
                              : valueB - valueA;
                          })
                          .map((topic: TrendTopic) => {
                            const sourceName = sources.find(s => s.id === topic.source_id || s.id === topic.sourceId)?.name || topic.sourceName || 'Неизвестный источник';
                            
                            // Используем локальные заглушки-изображения вместо picsum.photos
                            // Это временное решение, пока не настроены медиа-данные в базе
                            // Не используем внешние URL, которые могут вызывать ошибки
                            
                            // Разбор JSON из поля media_links для превью (в реальном режиме)
                            let mediaData: { images: string[], videos: string[] } = { 
                              images: [],  // Пустой массив, если нет реальных изображений 
                              videos: [] 
                            };
                            
                            // Проверяем разные варианты имен полей (snake_case и camelCase)
                            const mediaLinksStr = topic.media_links || topic.mediaLinks;
                            
                            if (mediaLinksStr) {
                              try {
                                if (typeof mediaLinksStr === 'string') {
                                  const parsed = JSON.parse(mediaLinksStr);
                                  if (parsed.images && Array.isArray(parsed.images) && parsed.images.length > 0) {
                                    mediaData = parsed;
                                  }
                                } else if (typeof mediaLinksStr === 'object') {
                                  // Может прийти уже распарсенным
                                  if (mediaLinksStr.images && Array.isArray(mediaLinksStr.images) && mediaLinksStr.images.length > 0) {
                                    mediaData = mediaLinksStr as { images: string[], videos: string[] };
                                  }
                                }
                              } catch (e) {
                                // Ошибка парсинга, оставляем временные изображения
                              }
                            }
                            
                            // Первое изображение для отображения (если есть)
                            const firstImage = mediaData.images && mediaData.images.length > 0 ? mediaData.images[0] : undefined;
                            
                            return (
                              <Card 
                                key={topic.id} 
                                className={`hover:shadow-md transition-shadow cursor-pointer ${
                                  selectedTrendTopic?.id === topic.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                                }`}
                                onClick={() => {
                                  console.log('Выбран тренд для просмотра комментариев:', topic.id, topic.title);
                                  setSelectedTrendTopic(topic);
                                  // НЕ открываем превью - только выбираем для комментариев
                                }}
                              >
                                <CardContent className="py-3 px-4">
                                  <div className="flex items-start gap-3">
                                    {/* Чекбокс для выбора тренда */}
                                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <Checkbox
                                        checked={selectedTopics.some(t => t.id === topic.id)}
                                        onCheckedChange={() => toggleTopicSelection(topic)}
                                        className="h-4 w-4 border-gray-400"
                                      />
                                    </div>
                                    
                                    {/* Изображение из media_links */}
                                    {firstImage ? (
                                      <div className="flex-shrink-0">
                                        <img 
                                          src={createProxyImageUrl(firstImage, topic.id)}
                                          alt="Миниатюра"
                                          className="h-16 w-16 object-cover rounded-md"
                                          onError={(e) => {
                                            console.log('Ошибка загрузки изображения:', firstImage);
                                            e.currentTarget.onerror = null;
                                            // Пробуем повторную загрузку с прямой ссылкой если это не Instagram
                                            if (firstImage.includes('instagram') || 
                                                firstImage.includes('fbcdn') || 
                                                firstImage.includes('cdninstagram')) {
                                              const retryUrl = createProxyImageUrl(firstImage, topic.id) + "&_retry=true";
                                              e.currentTarget.src = retryUrl;
                                            } else {
                                              e.currentTarget.src = 'https://placehold.co/100x100/jpeg?text=Нет+фото';
                                            }
                                          }}
                                          loading="lazy"
                                          referrerPolicy="no-referrer"
                                          crossOrigin="anonymous"
                                        />
                                      </div>
                                    ) : null}
                                    
                                    <div className="flex-1 min-w-0">
                                      {/* Название канала вверху как ссылка на канал */}
                                      <div className="mb-1 font-medium">
                                        <a 
                                          href={topic.accountUrl || topic.urlPost || ""} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {sourceName}
                                        </a>
                                      </div>
                                      
                                      {/* Описание канала из базы данных */}
                                      <div className="text-xs mb-2 text-muted-foreground">
                                        {sources.find(s => s.id === topic.source_id)?.description || 
                                         (topic.sourceDescription && topic.sourceDescription) || 
                                         topic.accountUrl || ""}
                                      </div>
                                      
                                      {/* Первая строка описания поста (если есть) */}
                                      <div 
                                        className="text-sm line-clamp-2 cursor-pointer"
                                        onClick={() => setSelectedTrendTopic(topic)}
                                      >
                                        {topic.description ? topic.description.split('\n')[0] : topic.title}
                                      </div>
                                      
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                        <div className="flex items-center gap-1">
                                          <ThumbsUp className="h-3 w-3" />
                                          <span>{typeof topic.reactions === 'number' ? Math.round(topic.reactions).toLocaleString('ru-RU') : (topic.reactions ?? 0)}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <MessageSquare className="h-3 w-3" />
                                          <span>{typeof topic.comments === 'number' ? Math.round(topic.comments).toLocaleString('ru-RU') : (topic.comments ?? 0)}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Eye className="h-3 w-3" />
                                          <span>{typeof topic.views === 'number' ? Math.round(topic.views).toLocaleString('ru-RU') : (topic.views ?? 0)}</span>
                                        </div>
                                        {/* Показываем trendScore - показатель трендовости */}
                                        <div className="flex items-center gap-1">
                                          <Flame className="h-3 w-3 text-orange-500" />
                                          <span>{typeof topic.trendScore === 'number' ? Math.round(topic.trendScore).toLocaleString('ru-RU') : (topic.trendScore ?? 0)}</span>
                                        </div>
                                        {topic.is_bookmarked && (
                                          <div className="flex items-center gap-1">
                                            <Bookmark className="h-3 w-3 text-primary" />
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          <span>
                                            {/* Удаляем многоточие - показываем только дату */}
                                            {topic.created_at
                                              ? formatRelativeTime(new Date(topic.created_at))
                                              : topic.createdAt 
                                                ? formatRelativeTime(new Date(topic.createdAt)) 
                                                : formatRelativeTime(new Date())}
                                          </span>
                                        </div>
                                        
                                        {/* Кнопка превью поста */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            console.log('Открываем превью тренда:', topic.id, topic.title);
                                            setPreviewTrendTopic(topic);
                                          }}
                                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800"
                                          title="Открыть превью"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          <span>Превью</span>
                                        </button>
                                        
                                        {/* Кнопка сбора комментариев для ВК и ТГ */}
                                        {(topic.urlPost?.includes('vk.com') || topic.urlPost?.includes('t.me') || 
                                          topic.accountUrl?.includes('vk.com') || topic.accountUrl?.includes('t.me')) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              collectTrendComments(topic.id, topic.urlPost || topic.accountUrl || '');
                                            }}
                                            disabled={collectingCommentsForTrend === topic.id}
                                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Собрать комментарии"
                                          >
                                            {collectingCommentsForTrend === topic.id ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <Download className="h-3 w-3" />
                                            )}
                                            <span>Комментарии</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    )}
                  </>
                ) : activeTab === 'comments' ? (
                  <>
                    <div className="mb-4">
                      {selectedTrendTopic ? (
                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium text-sm text-blue-900 mb-2">
                                Комментарии к тренду: {selectedTrendTopic.title}
                              </h3>
                              <p className="text-xs text-blue-700">
                                Источник: {selectedTrendTopic.accountUrl || selectedTrendTopic.urlPost}
                              </p>
                            </div>
                            {/* Кнопка для сбора комментариев если это ВК или ТГ тренд */}
                            {(selectedTrendTopic.urlPost?.includes('vk.com') || selectedTrendTopic.urlPost?.includes('t.me') || 
                              selectedTrendTopic.accountUrl?.includes('vk.com') || selectedTrendTopic.accountUrl?.includes('t.me')) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  collectTrendComments(selectedTrendTopic.id, selectedTrendTopic.urlPost || selectedTrendTopic.accountUrl || '');
                                }}
                                disabled={collectingCommentsForTrend === selectedTrendTopic.id}
                                className="text-xs"
                              >
                                {collectingCommentsForTrend === selectedTrendTopic.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Собираем...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-3 w-3 mr-1" />
                                    Собрать комментарии
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p>Выберите тренд для просмотра комментариев</p>
                          <p className="text-xs mt-1 mb-2">
                            Комментарии доступны для трендов ВК и Telegram
                          </p>
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left max-w-md mx-auto">
                            <p className="text-xs text-yellow-800 font-medium mb-1">💡 Как посмотреть комментарии:</p>
                            <p className="text-xs text-yellow-700">
                              1. Перейдите на вкладку "Тренды"<br/>
                              2. Кликните на карточку нужного тренда (не галочку!)<br/>
                              3. Вернитесь на вкладку "Комментарии"<br/>
                              4. Для просмотра поста используйте кнопку "Превью"
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedTrendTopic && (
                      <div className="max-h-[400px] overflow-y-auto pr-2">
                        {isLoadingComments ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span>Загрузка комментариев...</span>
                          </div>
                        ) : trendComments.length > 0 ? (
                          <div>
                            <div className="mb-4 flex justify-between items-center">
                              <h4 className="font-medium text-gray-900">
                                Комментарии ({trendComments.length})
                              </h4>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isAnalyzingSentiment}
                                onClick={() => {
                                  const analyzeSentiment = async () => {
                                    try {
                                      setIsAnalyzingSentiment(true);
                                      const authToken = localStorage.getItem('auth_token');
                                      const response = await fetch(`/api/trend-sentiment/${selectedTrendTopic.id}`, {
                                        method: 'POST',
                                        headers: {
                                          'Authorization': `Bearer ${authToken}`,
                                          'Content-Type': 'application/json'
                                        }
                                      });
                                      
                                      if (response.ok) {
                                        const data = await response.json();
                                        console.log('Результат анализа настроения (JSON):', JSON.stringify(data, null, 2));
                                        setSentimentData(data.data);
                                        toast({
                                          title: "Анализ настроения завершен",
                                          description: `Проанализировано ${data.commentsAnalyzed || trendComments.length} комментариев`,
                                        });
                                        // Принудительно обновляем кэш React Query для получения свежих данных с базы
                                        console.log('🔄 Обновляем кэш трендов и комментариев после сохранения анализа настроения');
                                        queryClient.invalidateQueries({ queryKey: ["trends"] });
                                        queryClient.invalidateQueries({ queryKey: ["trend-comments", selectedTrendTopic.id] });
                                        
                                        // Добавляем небольшую задержку и обновляем данные
                                        setTimeout(() => {
                                          queryClient.refetchQueries({ queryKey: ["trends"] });
                                          console.log('🔄 Принудительно обновили данные трендов');
                                        }, 1000);
                                        
                                        // Обновляем локальные данные тренда, чтобы анализ сохранился
                                        if (selectedTrendTopic) {
                                          (selectedTrendTopic as any).sentiment_analysis = data.data;
                                        }
                                      } else {
                                        const errorText = await response.text();
                                        console.error('Ошибка сервера:', response.status, errorText);
                                        toast({
                                          title: "Ошибка анализа",
                                          description: `Ошибка сервера: ${response.status}`,
                                          variant: "destructive"
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Ошибка анализа:', error);
                                      toast({
                                        title: "Ошибка анализа",
                                        description: `Ошибка подключения: ${error.message}`,
                                        variant: "destructive"
                                      });
                                    } finally {
                                      setIsAnalyzingSentiment(false);
                                    }
                                  };
                                  analyzeSentiment();
                                }}
                                className="gap-2"
                              >
                                {isAnalyzingSentiment ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <BarChart className="h-4 w-4" />
                                )}
                                {isAnalyzingSentiment ? 'Анализируем...' : 'Анализ настроения'}
                              </Button>
                            </div>
                            
                            {/* Блок результатов анализа настроения */}
                            {sentimentData && (
                              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                  <BarChart className="h-5 w-5 text-blue-600" />
                                  <h5 className="font-medium text-gray-900">Анализ настроения</h5>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                  <div className="text-center">
                                    <div className="text-lg font-semibold text-green-600">
                                      {sentimentData.details?.positive || 0}%
                                    </div>
                                    <div className="text-xs text-gray-600">Позитивные</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-lg font-semibold text-red-600">
                                      {sentimentData.details?.negative || 0}%
                                    </div>
                                    <div className="text-xs text-gray-600">Негативные</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-lg font-semibold text-gray-600">
                                      {sentimentData.details?.neutral || 0}%
                                    </div>
                                    <div className="text-xs text-gray-600">Нейтральные</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-lg font-semibold text-blue-600">
                                      {sentimentData.confidence || 0}%
                                    </div>
                                    <div className="text-xs text-gray-600">Уверенность</div>
                                  </div>
                                </div>
                                <div className="text-sm text-gray-700 bg-white p-2 rounded border">
                                  <strong>Общее настроение:</strong> {sentimentData.sentiment === 'positive' ? '😊 Позитивное' : sentimentData.sentiment === 'negative' ? '😔 Негативное' : '😐 Нейтральное'}
                                  {sentimentData.summary && (
                                    <>
                                      <br />
                                      <strong>Описание:</strong> {sentimentData.summary}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="space-y-3">
                              {trendComments.map((comment, index) => (
                                <Card key={comment.id || index} className="p-3">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0">
                                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                        <span className="text-xs font-medium text-gray-600">
                                          👤
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm text-gray-900">
                                          {comment.author || 'Неизвестный автор'}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {comment.platform?.toUpperCase()}
                                        </span>
                                        {comment.date && (
                                          <span className="text-xs text-gray-400">
                                            {new Date(comment.date).toLocaleDateString('ru-RU')}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {comment.text}
                                      </p>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 py-8">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            <p>Комментарии к этому тренду еще не собраны</p>
                            <p className="text-xs mt-1">
                              Используйте кнопку "Комментарии" в списке трендов для их сбора
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : null}
              </CardContent>
            </Card>

            {selectedTopics.length > 0 && (
              <TrendContentGenerator
                selectedTopics={selectedTopics}
                onGenerated={() => setSelectedTopics([])}
                campaignId={selectedCampaignId}
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

      <Dialog open={isBulkImportDialogOpen} onOpenChange={setIsBulkImportDialogOpen}>
        {selectedCampaignId && (
          <BulkSourcesImportDialog
            campaignId={selectedCampaignId}
            onClose={() => setIsBulkImportDialogOpen(false)}
          />
        )}
      </Dialog>

      {/* Диалог поиска источников */}
      {selectedKeyword && (
        <SourcesSearchDialog
          open={isSourceSearchDialogOpen}
          onOpenChange={setIsSourceSearchDialogOpen}
          campaignId={selectedCampaignId}
          keyword={selectedKeyword}
          onClose={() => setIsSourceSearchDialogOpen(false)}
          onSearch={(sources) => {
            setFoundSourcesData({ success: true, data: { sources } });
            setIsSearchingNewSources(true);
            setIsSourceSearchDialogOpen(false);
          }}
        />
      )}

      {/* Диалог выбора социальных сетей для сбора трендов */}
      <SocialNetworkSelectorDialog
        isOpen={isSocialNetworkDialogOpen}
        onClose={() => setIsSocialNetworkDialogOpen(false)}
        onConfirm={(platforms, collectSources, collectComments) => {
          setIsSocialNetworkDialogOpen(false);
          collectTrendsWithPlatforms({ platforms, collectSources, collectComments });
        }}
        isLoading={isCollecting}
      />

      {/* Модальное окно для детального просмотра тренда */}
      {previewTrendTopic && (
        <TrendDetailDialog
          topic={previewTrendTopic}
          isOpen={!!previewTrendTopic}
          onClose={() => setPreviewTrendTopic(null)}
          onBookmark={(id, isBookmarked) => updateTrendBookmark({ id, isBookmarked })}
          sourceName={sources.find(s => s.id === previewTrendTopic.source_id || s.id === previewTrendTopic.sourceId)?.name || previewTrendTopic.sourceName}
        />
      )}
    </div>
  );
}