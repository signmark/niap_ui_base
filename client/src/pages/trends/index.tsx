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
import { Loader2, Search, Plus, RefreshCw, Bot, Trash2, CheckCircle, Clock, AlertCircle, FileText, ThumbsUp, MessageSquare, Eye, Bookmark, Flame } from "lucide-react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedKeyword, setSelectedKeyword] = useState<string>("");
  
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

      // Если статус finished, error или null, останавливаем проверку
      // Не удаляем источник из списка активных в случае ошибки или завершения
      if (status === 'finished' || status === 'error' || !status) {
        
        // Удаляем источник из списка активных процессов только при завершении успешно или с ошибкой
        setProcessingSourceIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(sourceId);
          return newSet;
        });
        if (statusCheckInterval.current) {
          clearInterval(statusCheckInterval.current);
          statusCheckInterval.current = undefined;
        }
        setActiveSourceId(null);
        
        // Выводим уведомление о завершении или ошибке
        if (status === 'error') {
          toast({
            title: "Ошибка",
            description: "Произошла ошибка при сборе данных из источника",
            variant: "destructive",
          });
        } else if (status === 'finished') {
          toast({
            title: "Готово",
            description: "Сбор данных из источника завершен",
          });
        }
      }

      // Обновляем кеш с новым статусом, гарантируя немедленное обновление UI
      queryClient.setQueryData(
        ["campaign_content_sources", selectedCampaignId],
        (old: any[]) => {
          if (!old) return [];
          return old.map(source =>
            source.id === sourceId
              ? { ...source, status: status || 'processing' }
              : source
          );
        }
      );
      
      // Перезапрашиваем данные для обновления отображения на UI
      if (status === 'start' || status === 'running' || status === 'processing') {
        queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
      }
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
          filterDate.setDate(now.getDate() - 7);
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
    mutationFn: async ({ platforms, collectSources }: { platforms: string[], collectSources?: boolean }) => {
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
          collectSources: collectSources // Добавляем флаг сбора источников
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
    onSuccess: (data, { platforms, collectSources }) => {
      toast({
        title: "Успешно",
        description: collectSources 
          ? `Задача по сбору источников запущена. Данные будут обновляться автоматически.`
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
                      className={`px-4 py-2 border-b-2 ${activeTab === 'source-posts' ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}
                      onClick={() => setActiveTab('source-posts')}
                    >
                      Посты из источников
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
                        <div className="text-xs text-gray-500 mb-2">
                          Всего трендов: {trends.length} | Период: {selectedPeriod} | Платформа: {selectedPlatform}
                        </div>
                        {trends
                          .filter((topic: TrendTopic) => {
                            // Определяем платформу по нескольким критериям
                            const detectPlatform = () => {
                              const source = sources.find(s => s.id === topic.source_id || s.id === topic.sourceId);
                              
                              // 1. Проверяем поле sourceType или type напрямую из данных
                              const sourceType = (topic as any).sourceType || (topic as any).type || '';
                              if (sourceType) {
                                const typeStr = sourceType.toLowerCase();
                                if (typeStr === 'instagram') return 'instagram';
                                if (typeStr === 'vk') return 'vk';
                                if (typeStr === 'telegram') return 'telegram';
                                if (typeStr === 'facebook') return 'facebook';
                              }
                              
                              // 2. Проверяем медиа-ссылки
                              const mediaLinks = topic.media_links;
                              if (mediaLinks) {
                                const mediaStr = JSON.stringify(mediaLinks).toLowerCase();
                                if (mediaStr.includes('instagram.com') || mediaStr.includes('fbcdn.net')) return 'instagram';
                                if (mediaStr.includes('vk.com') || mediaStr.includes('userapi.com')) return 'vk';
                                if (mediaStr.includes('t.me') || mediaStr.includes('telegram')) return 'telegram';
                                if (mediaStr.includes('facebook.com') || mediaStr.includes('fb.com')) return 'facebook';
                              }
                              
                              // 3. Проверяем URL источника
                              if (source) {
                                const url = source.url.toLowerCase();
                                if (url.includes('instagram.com')) return 'instagram';
                                if (url.includes('vk.com') || url.includes('vkontakte.ru')) return 'vk';
                                if (url.includes('t.me') || url.includes('telegram.org')) return 'telegram';
                                if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
                              }
                              
                              return 'unknown';
                            };

                            const detectedPlatform = detectPlatform();
                            
                            // Фильтр по периоду времени
                            let withinPeriod = true;
                            if (selectedPeriod !== 'all') {
                              const periodDays = {
                                '3days': 3,
                                '7days': 7,
                                '14days': 14,
                                '30days': 30
                              }[selectedPeriod] || 7;
                              
                              const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
                              const topicDate = new Date(topic.created_at || topic.createdAt || 0);
                              withinPeriod = topicDate >= cutoffDate;
                            }
                            
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
                            
                            // Отладочная информация для всех Instagram постов
                            if (detectedPlatform === 'instagram' || (topic as any).sourceType === 'instagram') {
                              const postDate = topic.created_at || topic.createdAt;
                              console.log(`Instagram post ${topic.id}: ${postDate} - ${finalResult ? 'ПОКАЗАН' : 'СКРЫТ'}`);
                            }
                            
                            // Ищем посты 2023 года
                            const postDate = new Date(topic.created_at || topic.createdAt || 0);
                            if (postDate.getFullYear() === 2023) {
                              console.log(`Пост 2023 года: ${topic.id} - ${postDate.toLocaleDateString()} - платформа: ${detectedPlatform} - показан: ${finalResult}`);
                            }
                            
                            return finalResult;
                          })
                          .filter((topic, index, array) => {
                            // Логируем итоговое количество отфильтрованных результатов
                            if (index === 0) {
                              console.log('Total trends after filtering:', array.length);
                              const instagramCount = array.filter(t => {
                                const source = sources.find(s => s.id === t.source_id || s.id === t.sourceId);
                                const sourceType = (t as any).sourceType || (t as any).type || '';
                                const mediaLinks = t.media_links;
                                let isInstagram = false;
                                
                                if (sourceType && sourceType.toLowerCase() === 'instagram') isInstagram = true;
                                if (mediaLinks && JSON.stringify(mediaLinks).toLowerCase().includes('fbcdn.net')) isInstagram = true;
                                if (source && source.url.toLowerCase().includes('instagram.com')) isInstagram = true;
                                
                                return isInstagram;
                              }).length;
                              console.log('Instagram posts in filtered results:', instagramCount);
                            }
                            return true;
                          })
                          // Сортировка трендов
                          .sort((a, b) => {
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
                              <Card key={topic.id} className="hover:shadow-md transition-shadow cursor-pointer">
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
                ) : (
                  <>
                    <SourcePostsSearchForm
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      sortField={sortField}
                      setSortField={(value) => setSortField(value as SortField)}
                      sortDirection={sortDirection}
                      setSortDirection={setSortDirection}
                      selectedPeriod={selectedPeriod}
                      setSelectedPeriod={setSelectedPeriod}
                      isValidPeriod={isValidPeriod}
                    />
                    <div className="max-h-[400px] overflow-y-auto pr-2">
                      {/* Логируем состояние постов перед фильтрацией в useEffect */}
                      <SourcePostsList
                      posts={sourcePosts
                        .filter(post => {
                          // Обрабатываем случай, когда post_content может быть null
                          const content = post.post_content || '';
                          return content.toLowerCase().includes(searchQuery.toLowerCase());
                        })
                        // Сортировка постов
                        .sort((a, b) => {
                          if (sortField === 'none') return 0;
                          
                          let valueA, valueB;
                          
                          // Определяем значения для сравнения в зависимости от выбранного поля сортировки
                          switch(sortField) {
                            case 'reactions':
                              valueA = a.likes || 0;
                              valueB = b.likes || 0;
                              break;
                            case 'comments':
                              valueA = a.comments || 0;
                              valueB = b.comments || 0;
                              break;
                            case 'views':
                              valueA = a.views || 0;
                              valueB = b.views || 0;
                              break;
                            case 'date':
                              valueA = new Date(a.date || 0).getTime();
                              valueB = new Date(b.date || 0).getTime();
                              break;
                            default:
                              return 0;
                          }
                          
                          // Применяем выбранное направление сортировки
                          return sortDirection === 'asc' 
                            ? valueA - valueB 
                            : valueB - valueA;
                        })
                      }
                      isLoading={isLoadingSourcePosts}
                    />
                  </div>
                  </>
                )}
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
        onConfirm={(platforms, collectSources) => {
          setIsSocialNetworkDialogOpen(false);
          collectTrendsWithPlatforms({ platforms, collectSources });
        }}
        isLoading={isCollecting}
      />

      {/* Модальное окно для детального просмотра тренда */}
      {selectedTrendTopic && (
        <TrendDetailDialog
          topic={selectedTrendTopic}
          isOpen={!!selectedTrendTopic}
          onClose={() => setSelectedTrendTopic(null)}
          onBookmark={(id, isBookmarked) => updateTrendBookmark({ id, isBookmarked })}
          sourceName={sources.find(s => s.id === selectedTrendTopic.source_id || s.id === selectedTrendTopic.sourceId)?.name || selectedTrendTopic.sourceName}
        />
      )}
    </div>
  );
}