import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
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
import { Loader2, Search, Plus, RefreshCw, Bot, Trash2, CheckCircle, Clock, AlertCircle, FileText, ThumbsUp, MessageSquare, Eye, Play, Bookmark, Flame } from "lucide-react";
import { TrendDetailDialog } from "@/components/TrendDetailDialog";
import { Dialog } from "@/components/ui/dialog";
import { AddSourceDialog } from "@/components/AddSourceDialog";
import { NewSourcesDialog } from "@/components/NewSourcesDialog";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import { SocialNetworkSelectorDialog } from "@/components/SocialNetworkSelectorDialog";
import { Badge } from "@/components/ui/badge";

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

type Period = "3days" | "7days" | "14days" | "30days";

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
  // Используем глобальный стор кампаний
  const { selectedCampaign } = useCampaignStore();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(selectedCampaign?.id || "");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const statusCheckInterval = useRef<NodeJS.Timeout>();
  const [activeTab, setActiveTab] = useState('trends');
  const [isSocialNetworkDialogOpen, setIsSocialNetworkDialogOpen] = useState(false);
  const [selectedTrendTopic, setSelectedTrendTopic] = useState<TrendTopic | null>(null);
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
      if (activeSourceId) {
        // Если есть активный источник, обновление будет происходить через checkSourceStatus
        return;
      }
      
      // Иначе помечаем, что нужно обновить данные
      shouldRefreshSources.current = true;
      // И запускаем обновление запроса
      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
    }, 5000); // Обновляем каждые 5 секунд если нет активного источника
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [selectedCampaignId, activeSourceId, queryClient]);

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
      
      // Добавляем источник в список активных процессов
      setProcessingSourceIds(prev => {
        const newSet = new Set(prev);
        newSet.add(sourceId);
        return newSet;
      });
      
      // Сразу же устанавливаем статус "processing" для мгновенной обратной связи
      queryClient.setQueryData(
        ["campaign_content_sources", selectedCampaignId],
        (old: any[]) => old?.map(source =>
          source.id === sourceId
            ? { ...source, status: 'processing' }
            : source
        )
      );
      
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

  // Интервалы для обновления данных
  const trendsRefreshInterval = useRef<NodeJS.Timeout>();
  const sourcesRefreshInterval = useRef<NodeJS.Timeout>();

  // Эффект для постоянного обновления трендов и источников
  useEffect(() => {
    // Не запускаем обновление без ID кампании
    if (!selectedCampaignId) return;
    
    console.log('Starting automatic data refresh intervals');
    
    // Создаем интервал обновления трендов
    trendsRefreshInterval.current = setInterval(() => {
      console.log('Refreshing trends data...');
      queryClient.invalidateQueries({ queryKey: ["trends", selectedPeriod, selectedCampaignId] });
    }, 3000); // Обновление трендов каждые 3 секунды
    
    // Создаем интервал обновления источников
    sourcesRefreshInterval.current = setInterval(() => {
      console.log('Refreshing sources data...');
      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
    }, 3000); // Обновление источников каждые 3 секунды
    
    return () => {
      // Очищаем интервалы при размонтировании компонента или смене кампании
      if (trendsRefreshInterval.current) {
        clearInterval(trendsRefreshInterval.current);
      }
      if (sourcesRefreshInterval.current) {
        clearInterval(sourcesRefreshInterval.current);
      }
    };
  }, [selectedCampaignId, queryClient]);

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
      
      return processedTrends;
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


  const { mutate: collectTrendsWithPlatforms, isPending: isCollecting } = useMutation({
    mutationFn: async (platforms: string[]) => {
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
          platforms: platforms // Добавляем выбранные платформы
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
    onSuccess: (data) => {
      toast({
        title: "Успешно",
        description: `Задача по сбору трендов запущена. Данные будут обновляться автоматически.`
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

  // Отслеживаем активные источники для стабильного отображения статуса
  const [processingSourceIds, setProcessingSourceIds] = useState<Set<string>>(new Set());
  
  // Обновляем список активных источников при изменении статуса
  useEffect(() => {
    if (!sources) return;
    
    const newProcessingSources = new Set<string>();
    sources.forEach(source => {
      if (source.status === 'start' || source.status === 'processing' || source.status === 'running' || source.id === activeSourceId) {
        newProcessingSources.add(source.id);
      }
    });
    
    setProcessingSourceIds(newProcessingSources);
  }, [sources, activeSourceId]);
  
  // Функция определения иконки для текущего статуса
  const getStatusIcon = (status: string | null, sourceId: string) => {
    // Если источник в списке обрабатываемых, показываем анимацию
    if (processingSourceIds.has(sourceId)) {
      return <RefreshCw className="h-4 w-4 animate-spin text-yellow-500" />;
    }
    
    // Иначе показываем статус из базы данных
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
                          {getStatusIcon(source.status, source.id)}
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
                      <div className="space-y-2">
                        {trends
                          .filter((topic: TrendTopic) => topic.title.toLowerCase().includes(searchQuery.toLowerCase()))
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

      {/* Диалог выбора социальных сетей для сбора трендов */}
      <SocialNetworkSelectorDialog
        isOpen={isSocialNetworkDialogOpen}
        onClose={() => setIsSocialNetworkDialogOpen(false)}
        onConfirm={(platforms) => {
          setIsSocialNetworkDialogOpen(false);
          collectTrendsWithPlatforms(platforms);
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