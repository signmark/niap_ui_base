import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ArrowUpIcon, ArrowDownIcon, Globe, ChevronDown, ChevronUp } from "lucide-react";
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
import { Loader2, Search, Plus, RefreshCw, Bot, Trash2, CheckCircle, Clock, AlertCircle, FileText, ThumbsUp, MessageSquare, Eye, Bookmark, Flame, Download, ExternalLink, BarChart, Target, Building, TrendingUp } from "lucide-react";
import { TrendDetailDialog } from "@/components/TrendDetailDialog";
import { Dialog } from "@/components/ui/dialog";
import { AddSourceDialog } from "@/components/AddSourceDialog";
import { NewSourcesDialog } from "@/components/NewSourcesDialog";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import { TrendContentGenerator } from "@/components/TrendContentGenerator";
import { SocialNetworkSelectorDialog } from "@/components/SocialNetworkSelectorDialog";
import { SourcesSearchDialog } from "@/components/SourcesSearchDialog";
import { Badge } from "@/components/ui/badge";
import { getSentimentEmoji, getSentimentCategory, formatNumber } from "@/lib/trends-utils";
import { BulkSourcesImportDialog } from "@/components/BulkSourcesImportDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendCard } from "@/components/trends/TrendCard";
import { SentimentEmoji } from "@/components/trends/SentimentEmoji";
import { TrendsCollection } from "@/components/trends/TrendsCollection";
import { SourceCollectionDialog } from "@/components/SourceCollectionDialog";

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
  sentiment_analysis?: {
    total_trends?: number;
    analyzed_trends?: number;
    positive_percentage?: number;
    negative_percentage?: number;
    neutral_percentage?: number;
    overall_sentiment?: string;
    average_score?: number;
    emoji?: string;
    analyzed_at?: string;
  };
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
  sentiment_analysis?: any; // Данные анализа тональности
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
  // Состояние для фильтра по тональности
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  // Используем глобальный стор кампаний
  const { selectedCampaign } = useCampaignStore();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(selectedCampaign?.id || "");

  const [activeTab, setActiveTab] = useState('trends');
  const [isSocialNetworkDialogOpen, setIsSocialNetworkDialogOpen] = useState(false);
  const [isSourceSearchDialogOpen, setIsSourceSearchDialogOpen] = useState(false);
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
  const [isSourceCollectionDialogOpen, setIsSourceCollectionDialogOpen] = useState(false);
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
  
  // Состояние для результатов анализа комментариев
  const [commentsAnalysisData, setCommentsAnalysisData] = useState<{
    trend_level?: any;
    source_level?: any;
  }>({});
  
  // Состояние для анализа источников
  const [sourceAnalysisData, setSourceAnalysisData] = useState<{
    [sourceId: string]: {
      sentiment: string;
      confidence: number;
      summary: string;
    }
  }>({});
  const [analyzingSourceId, setAnalyzingSourceId] = useState<string | null>(null);
  
  // Состояние для отображения детального анализа источника
  const [selectedSourceForAnalysis, setSelectedSourceForAnalysis] = useState<string | null>(null);
  
  // Состояние для выбора источников для массового сбора комментариев
  const [selectedSourcesForComments, setSelectedSourcesForComments] = useState<Set<string>>(new Set());
  const [isCollectingBulkComments, setIsCollectingBulkComments] = useState(false);
  const [isCollectingTrendComments, setIsCollectingTrendComments] = useState(false);
  
  // Состояние для выбора трендов для массового сбора комментариев
  const [selectedTrendsForComments, setSelectedTrendsForComments] = useState<Set<string>>(new Set());

  
  // Состояния для сворачивания/разворачивания секций
  const [isDataSourcesExpanded, setIsDataSourcesExpanded] = useState(true); // По умолчанию развернута
  const [isTrendsExpanded, setIsTrendsExpanded] = useState(false); // По умолчанию свернута
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null); // Выбранный источник для фильтрации трендов

  const [selectedKeyword, setSelectedKeyword] = useState<string>("");
  
  // Refs для автоматического скролла к элементам
  const sourcesRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const sourcesContainerRef = useRef<HTMLDivElement | null>(null);

  // Функция для автоматического выбора источника при выборе тренда
  const syncTrendWithSource = (trendTopic: TrendTopic) => {
    const sourceId = trendTopic.source_id || trendTopic.sourceId;
    
    console.log('🔗 Синхронизация тренда с источником:', {
      trendTitle: trendTopic.title,
      sourceId: sourceId,
      currentSelectedSourceId: selectedSourceId,
      sortField: sortField,
      sortDirection: sortDirection
    });
    
    // Дополнительное логирование для отладки ID источников
    console.log('🔍 Поиск источника в списке sources:');
    console.log('  - ID тренда source_id:', trendTopic.source_id);
    console.log('  - ID тренда sourceId:', trendTopic.sourceId); 
    console.log('  - Используемый sourceId:', sourceId);
    console.log('  - Все доступные источники:', sources.map(s => ({id: s.id, name: s.name})));
    
    if (sourceId) {
      // Устанавливаем выбранный источник для синхронизации
      setSelectedSourceId(sourceId);
      
      // КРИТИЧНО: Также добавляем источник в selectedSourcesForComments для синхронизации checkbox'а
      setSelectedSourcesForComments(prev => {
        const newSet = new Set(prev);
        newSet.add(sourceId);
        return newSet;
      });
      
      // Разворачиваем секцию источников если она свернута
      if (!isDataSourcesExpanded) {
        setIsDataSourcesExpanded(true);
      }
      
      // Переключаемся на вкладку "Тренды" если находимся на вкладке "Комментарии"
      if (activeTab !== 'trends') {
        setActiveTab('trends');
      }
      
      // Проверяем, есть ли источник в списке загруженных источников
      const sourceExists = sources.find(s => s.id === sourceId);
      
      if (sourceExists) {
        console.log('✅ Источник найден в списке:', sourceExists.name);
        
        // Пытаемся найти элемент источника
        setTimeout(() => {
          console.log('🔍 Поиск элемента источника для ID:', sourceId);
          console.log('📝 Доступные refs:', Object.keys(sourcesRefs.current));
          
          const sourceElement = sourcesRefs.current[sourceId];
          const fallbackElement = document.querySelector(`[data-source-id="${sourceId}"]`);
          const targetElement = sourceElement || fallbackElement;
          
          console.log('🔍 Элемент найден в refs:', !!sourceElement);
          console.log('🔍 Элемент найден через querySelector:', !!fallbackElement);
          
          if (targetElement) {
            console.log('✅ Элемент найден, выполняю скроллинг к источнику:', sourceId);
            targetElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
            
            // Применяем визуальный эффект
            const element = targetElement as HTMLElement;
            element.style.cssText += `
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.8) !important;
              border: 2px solid #3b82f6 !important;
              background-color: rgba(59, 130, 246, 0.1) !important;
              transform: scale(1.02) !important;
              transition: all 0.3s ease !important;
            `;
            
            console.log('🎯 Применен визуальный эффект выделения к источнику');
            
            setTimeout(() => {
              element.style.cssText = element.style.cssText.replace(/box-shadow[^;]*;?/g, '')
                                                           .replace(/border[^;]*;?/g, '')
                                                           .replace(/background-color[^;]*;?/g, '')
                                                           .replace(/transform[^;]*;?/g, '')
                                                           .replace(/transition[^;]*;?/g, '');
              console.log('🎯 Визуальный эффект выделения убран');
            }, 3000);
          } else {
            console.log('❌ Элемент источника не найден для подсветки ID:', sourceId);
            console.log('🔍 Это нормально если источник отфильтрован или не отображается');
          }
        }, 300);
      } else {
        console.log('⚠️ Источник не найден в списке источников:', sourceId);
        console.log('🔍 Доступные источники:', sources.map(s => s.id));
      }
    } else {
      console.log('❌ ID источника не найден в данных тренда');
    }
  };

  // Загрузка состояния из localStorage при инициализации
  useEffect(() => {
    const savedDataSourcesExpanded = localStorage.getItem('trends_data_sources_expanded');
    const savedTrendsExpanded = localStorage.getItem('trends_trends_expanded');
    const savedSelectedSourceId = localStorage.getItem('trends_selected_source_id');
    
    if (savedDataSourcesExpanded !== null) {
      setIsDataSourcesExpanded(JSON.parse(savedDataSourcesExpanded));
    }
    if (savedTrendsExpanded !== null) {
      setIsTrendsExpanded(JSON.parse(savedTrendsExpanded));
    }
    if (savedSelectedSourceId && savedSelectedSourceId !== 'null') {
      setSelectedSourceId(savedSelectedSourceId);
    }
  }, []);

  // Сохранение состояния в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('trends_data_sources_expanded', JSON.stringify(isDataSourcesExpanded));
  }, [isDataSourcesExpanded]);

  useEffect(() => {
    localStorage.setItem('trends_trends_expanded', JSON.stringify(isTrendsExpanded));
  }, [isTrendsExpanded]);

  useEffect(() => {
    localStorage.setItem('trends_selected_source_id', selectedSourceId || 'null');
  }, [selectedSourceId]);

  // Восстанавливаем selectedSourceId из выбранного тренда только при первой загрузке
  useEffect(() => {
    if (selectedTrendTopic && !selectedSourceId && !localStorage.getItem('trends_selected_source_id')) {
      const sourceId = selectedTrendTopic.source_id || selectedTrendTopic.sourceId;
      if (sourceId) {
        setSelectedSourceId(sourceId);
      }
    }
  }, [selectedTrendTopic]);

  // Функция для сбора комментариев к тренду
  const collectTrendComments = async (trendId: string, trendUrl: string) => {
    try {
      setCollectingCommentsForTrend(trendId);
      
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      const response = await fetch('/api/trends/collect-comments-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          trendId: trendId,
          campaignId: selectedCampaignId
        })
      });

      if (response.ok) {
        toast({
          title: "Сбор комментариев запущен",
          description: "Комментарии будут собраны и появятся в соответствующем разделе",
        });
        
        // Автоматически проверяем комментарии через интервалы

        
        // Если тренд выбран - сразу загружаем комментарии
        if (selectedTrendTopic?.id === trendId) {

          loadTrendComments(trendId);
        }
        
        // Проверяем комментарии несколько раз через интервалы
        const checkIntervals = [5000, 15000, 30000]; // 5, 15, 30 секунд
        
        checkIntervals.forEach((delay, index) => {
          setTimeout(() => {
            // Если этот тренд сейчас выбран - загружаем комментарии
            if (selectedTrendTopic?.id === trendId) {
              loadTrendComments(trendId);

            } else {

            }
          }, delay);
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

      // Сначала проверяем, есть ли комментарии у этого тренда в поле comments
      const trendTopic = trends?.find(t => t.id === trendId);
      if (!trendTopic || !trendTopic.comments || trendTopic.comments === 0) {
        console.log(`Тренд ${trendId} не имеет комментариев (comments: ${trendTopic?.comments || 0})`);
        setTrendComments([]);
        return;
      }

      console.log(`Загружаем комментарии для тренда ${trendId}, количество: ${trendTopic.comments}`);

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

  // Мутация для анализа комментариев
  const analyzeCommentsMutation = useMutation({
    mutationFn: async ({ trendId, level }: { trendId: string, level: 'trend' | 'source' }) => {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }

      const response = await fetch('/api/analyze-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          trendId, 
          level,
          campaignId: selectedCampaignId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Ошибка анализа комментариев');
      }

      return await response.json();
    },
    onSuccess: (data, { level }) => {
      toast({
        title: "Анализ завершен",
        description: `Анализ комментариев на уровне ${level === 'trend' ? 'тренда' : 'источника'} успешно выполнен`,
      });
      
      // Сохраняем результаты анализа в состояние
      setCommentsAnalysisData(prev => ({
        ...prev,
        [level + '_level']: data.data?.analysis
      }));
      
      // Перезагружаем комментарии для обновления данных
      if (selectedTrendTopic) {
        loadTrendComments(selectedTrendTopic.id);
      }
      
      // Обновляем данные трендов для получения новой аналитики
      queryClient.invalidateQueries({ queryKey: ["trends", selectedPeriod, selectedCampaignId] });
    },
    onError: (error: any) => {
      console.error('Ошибка анализа комментариев:', error);
      toast({
        title: "Ошибка анализа",
        description: error.message || "Не удалось провести анализ комментариев",
        variant: "destructive",
      });
    }
  });
  
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
      setSentimentData((selectedTrend as any).sentiment_analysis);
      
      // Проверяем наличие многоуровневого анализа комментариев в sentiment_analysis
      const sentimentAnalysis = (selectedTrend as any).sentiment_analysis;
      if (sentimentAnalysis && (sentimentAnalysis.trend_level || sentimentAnalysis.source_level)) {
        setCommentsAnalysisData({
          trend_level: sentimentAnalysis.trend_level,
          source_level: sentimentAnalysis.source_level
        });
      } else {
        setCommentsAnalysisData({});
      }
    } else {
      setSentimentData(null);
      setCommentsAnalysisData({});
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

    return visibleTrends.length > 0 && visibleTrends.every((trend: any) => 
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



      // Убираем фильтр is_active для получения всех источников кампании
      try {
        // Используем явно указанные параметры в GET-запросе
        const response = await directusApi.get('/items/campaign_content_sources', {
          params: {
            'filter[campaign_id][_eq]': selectedCampaignId,
            'fields[]': ['id', 'name', 'url', 'type', 'is_active', 'campaign_id', 'created_at', 'status', 'sentiment_analysis']
          },
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
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

  // Функция для массового сбора комментариев для выбранных источников
  const collectBulkComments = async () => {
    if (selectedSourcesForComments.size === 0) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите хотя бы один источник"
      });
      return;
    }

    if (!selectedCampaignId) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите кампанию"
      });
      return;
    }

    setIsCollectingBulkComments(true);
    const authToken = localStorage.getItem('auth_token');
    
    try {
      // Получаем все тренды для выбранных источников
      const selectedSourcesList = Array.from(selectedSourcesForComments);
      const sourceTrends = trends.filter((trend: any) => 
        selectedSourcesList.includes(trend.sourceId || trend.source_id)
      );

      if (sourceTrends.length === 0) {
        toast({
          variant: "destructive",
          title: "Нет трендов",
          description: "Для выбранных источников не найдено трендов"
        });
        return;
      }

      toast({
        title: "Запуск сбора комментариев",
        description: `Начинаем сбор комментариев для ${sourceTrends.length} трендов из ${selectedSourcesList.length} источников`
      });

      // Собираем все ID трендов и отправляем одним запросом
      const trendIds = sourceTrends.map(trend => trend.id);

      
      try {
        const response = await fetch('/api/trends/collect-comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            trendIds,
            campaignId: selectedCampaignId
          })
        });

        const responseData = await response.json();
        
        if (response.ok) {
          const successCount = responseData.data?.successCount || 0;
          const errorCount = responseData.data?.errorCount || 0;

        } else {

          throw new Error(responseData.message || 'API error');
        }
      } catch (error) {

        throw error;
      }

      toast({
        title: "Сбор комментариев завершен",
        description: `Запущен сбор комментариев для ${trendIds.length} трендов из выбранных источников`
      });

      // Обновляем данные трендов
      queryClient.invalidateQueries({ queryKey: ["trends"] });
      
    } catch (error) {
      console.error('Ошибка массового сбора комментариев:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось выполнить массовый сбор комментариев"
      });
    } finally {
      setIsCollectingBulkComments(false);
    }
  }

  // Функция для массового сбора комментариев для выбранных трендов
  const collectSelectedTrendsComments = async () => {
    if (selectedTopics.length === 0) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите хотя бы один тренд"
      });
      return;
    }

    if (!selectedCampaignId) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Выберите кампанию"
      });
      return;
    }

    setIsCollectingTrendComments(true);
    const authToken = localStorage.getItem('auth_token');
    
    try {
      toast({
        title: "Запуск сбора комментариев",
        description: `Начинаем сбор комментариев для ${selectedTopics.length} выбранных трендов`
      });

      // Собираем все ID выбранных трендов и отправляем запрос с campaignId
      const trendIds = selectedTopics.map(trend => trend.id);

      
      const response = await fetch('/api/trends/collect-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          trendIds,
          campaignId: selectedCampaignId
        })
      });

      const responseData = await response.json();
      
      if (response.ok) {
        const successCount = responseData.data?.successCount || 0;
        const errorCount = responseData.data?.errorCount || 0;

        
        toast({
          title: "Сбор комментариев завершен", 
          description: `Запущен сбор комментариев для ${trendIds.length} выбранных трендов`
        });
      } else {

        throw new Error(responseData.message || 'API error');
      }

      // Обновляем данные трендов
      queryClient.invalidateQueries({ queryKey: ["trends"] });
      
    } catch (error) {

      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось выполнить массовый сбор комментариев"
      });
    } finally {
      setIsCollectingTrendComments(false);
    }
  }

  // Функции для работы с выбором источников
  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSourcesForComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId);
      } else {
        newSet.add(sourceId);
      }
      return newSet;
    });
  };

  const selectAllSources = () => {
    if (selectedSourcesForComments.size === sources.length) {
      // Если все выбраны, снимаем выбор
      setSelectedSourcesForComments(new Set());
    } else {
      // Выбираем все источники
      setSelectedSourcesForComments(new Set(sources.map(s => s.id)));
    }
  };

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

  // Эффект для обновления данных (менее частое)
  useEffect(() => {
    // Не запускаем обновление без ID кампании
    if (!selectedCampaignId) return;
    
    // Создаем интервал обновления трендов (реже)
    trendsRefreshInterval.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["trends", selectedPeriod, selectedCampaignId] });
    }, 60000); // Обновление трендов каждую минуту
    
    // Создаем интервал обновления источников (реже)
    sourcesRefreshInterval.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
    }, 120000); // Обновление источников каждые 2 минуты
    
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

      // Диагностика удалена - избыточное логирование

      // Фильтруем тренды по дате
      const filteredTrends = processedTrends.filter((trend: any) => {
        if (!trend.created_at && !trend.createdAt) return true; // Показываем тренды без даты
        
        const trendDate = new Date(trend.created_at || trend.createdAt);
        return trendDate >= filterDate;
      });

      // Диагностика фильтрации удалена
      
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

      // Для сбора трендов проверяем наличие источников
      console.log('🔍 FRONTEND DEBUG: selectedSourcesForComments.size:', selectedSourcesForComments.size);
      console.log('🔍 FRONTEND DEBUG: selectedSourcesForComments content:', Array.from(selectedSourcesForComments));
      
      if (!collectSources && selectedSourcesForComments.size === 0) {
        throw new Error("Выберите источники для сбора трендов");
      }

      if (!keywords?.length) {
        throw new Error("Добавьте ключевые слова в кампанию");
      }

      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error("Требуется авторизация");
      }
      
      // Показываем уведомление о начале сбора сразу после валидации
      toast({
        title: "Сбор начат",
        description: collectSources 
          ? `Сбор источников ${collectComments && collectComments.length > 0 ? 'и комментариев ' : ''}запущен. Результаты появятся по мере обновления.`
          : `Сбор трендов запущен. Результаты появятся по мере обновления.`
      });
      
      // Логика отправки данных:
      // 1. Если выбраны источники - ищем тренды в этих источниках (отправляем ID источников)
      // 2. Если источники не выбраны - ищем новые источники по ключевым словам
      let dataToSend;
      const selectedSourcesList = Array.from(selectedSourcesForComments);
      
      console.log('🔍 FRONTEND CRITICAL DEBUG:');
      console.log('- selectedSourcesForComments (Set):', selectedSourcesForComments);
      console.log('- selectedSourcesList (Array):', selectedSourcesList);
      console.log('- selectedSourcesList length:', selectedSourcesList.length);
      console.log('- collectSources flag:', collectSources);
      
      if (selectedSourcesList.length > 0) {
        // Есть выбранные источники - ищем тренды в них
        dataToSend = {
          campaignId: selectedCampaignId,
          sourcesList: selectedSourcesList, // Отправляем ID источников для поиска трендов
          userID: authToken, // Используем токен как userID
          platforms: platforms,
          collectSources: false, // НЕ собираем новые источники
          collectComments: collectComments
        };
        console.log('🎯 FRONTEND: Selected sources count:', selectedSourcesList.length);
        console.log('🎯 FRONTEND: Selected sources IDs:', selectedSourcesList);
        console.log('🎯 FRONTEND: Sending source IDs for trend collection in existing sources:', selectedSourcesList, platforms);
      } else if (collectSources) {
        // Нет выбранных источников и включен флаг collectSources - ищем новые источники
        const keywordsList = keywords.map((k: { keyword: string }) => k.keyword);
        dataToSend = {
          campaignId: selectedCampaignId,
          keywords: keywordsList,
          platforms: platforms,
          collectSources: true, // Собираем новые источники
          collectComments: collectComments
        };
        console.log('Sending keywords for new source collection:', keywordsList, platforms);
      } else {
        // Fallback - используем старую логику
        const keywordsList = keywords.map((k: { keyword: string }) => k.keyword);
        dataToSend = {
          campaignId: selectedCampaignId,
          keywords: keywordsList,
          platforms: platforms,
          collectSources: false,
          collectComments: collectComments
        };
        console.log('Fallback: sending keywords for trend collection:', keywordsList, platforms);
      }
      
      // Send request to our API endpoint which will forward to n8n webhook
      const webhookResponse = await fetch('/api/trends/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(dataToSend)
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
        title: "Успешно завершено",
        description: collectSources 
          ? `Задача по сбору источников ${collectComments && collectComments.length > 0 ? 'и комментариев ' : ''}передана в обработку. Данные обновляются автоматически.`
          : `Задача по сбору трендов передана в обработку. Данные обновляются автоматически.`
      });
      
      // Refresh the trend topics list и источники (делаем это только один раз)
      queryClient.invalidateQueries({ queryKey: ["trends", selectedPeriod, selectedCampaignId] });
      if (collectSources) {
        queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
      }
      
      // Если запущен сбор комментариев
      if (collectComments && collectComments.length > 0) {
        console.log('🔄 Запущен сбор комментариев через основной диалог');
        
        if (selectedTrendTopic) {
          console.log('🔄 Выбран тренд:', selectedTrendTopic.id, '- загружаем комментарии');
          loadTrendComments(selectedTrendTopic.id);
          
          // Одна дополнительная проверка через 30 секунд
          setTimeout(() => {
            if (selectedTrendTopic) {
              loadTrendComments(selectedTrendTopic.id);
              console.log(`🔄 Повторная проверка комментариев для выбранного тренда ${selectedTrendTopic.id}`);
            }
          }, 30000);
        } else {
          console.log('⚠️ Тренд не выбран - комментарии будут загружены при выборе тренда');
          // Убираем немедленный совет - пользователь только что запустил сбор
          // Совет может появиться позже, если пользователь не выберет тренд в течение минуты
          setTimeout(() => {
            // Показываем совет только если есть тренды, но ни один не выбран
            if (!selectedTrendTopic && collectComments && collectComments.length > 0 && trends && trends.length > 0) {
              toast({
                title: "Совет",
                description: "Выберите тренд, чтобы увидеть собранные комментарии"
              });
            }
          }, 60000); // 1 минута задержка
        }
      }
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

  // Функция для анализа источника
  const analyzeSource = async (sourceId: string, sourceName: string) => {
    try {
      setAnalyzingSourceId(sourceId);
      const authToken = localStorage.getItem('auth_token');
      
      const response = await fetch(`/api/sources/${sourceId}/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaignId: selectedCampaignId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Результат анализа источника:', data);
        
        // Сохраняем результат анализа
        setSourceAnalysisData(prev => ({
          ...prev,
          [sourceId]: data.data
        }));

        // Принудительно обновляем кэш источников для отображения emoji
        queryClient.invalidateQueries({ queryKey: ["campaign_content_sources", selectedCampaignId] });
        queryClient.refetchQueries({ queryKey: ["campaign_content_sources", selectedCampaignId] });
        
        toast({
          title: "Анализ источника завершен",
          description: `${sourceName}: ${data.data.summary}`,
        });
      } else {
        const errorText = await response.text();
        console.error('Ошибка анализа источника:', response.status, errorText);
        toast({
          title: "Ошибка анализа",
          description: `Не удалось проанализировать источник: ${response.status}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Ошибка анализа источника:', error);
      toast({
        title: "Ошибка анализа",
        description: `Ошибка подключения: ${(error as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setAnalyzingSourceId(null);
    }
  };

  // Функция для пересчета анализа настроения источника на основе трендов
  const recalculateSourceSentiment = async (sourceId: string, sourceName: string) => {
    try {
      setAnalyzingSourceId(sourceId);
      
      // Сначала запускаем полноценный анализ источника через backend (который собирает комментарии)
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/sources/${sourceId}/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaignId: selectedCampaignId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Результат анализа источника:', data);
        
        // Принудительно обновляем локальные данные
        queryClient.invalidateQueries({ queryKey: ["campaign_content_sources", selectedCampaignId] });
        queryClient.refetchQueries({ queryKey: ["campaign_content_sources", selectedCampaignId] });
        
        toast({
          title: "Анализ источника завершен",
          description: `${sourceName}: ${data.data.summary}`,
        });
        return; // Выходим, так как полный анализ уже выполнен
      } else {
        console.log('Backend анализ не сработал, выполняем клиентский пересчет...');
      }

      // FALLBACK: если backend анализ не сработал, делаем клиентский пересчет существующих данных
      const sourcesTrends = trends.filter((t: any) => 
        t.sourceId === sourceId || t.source_id === sourceId
      );
      const analyzedTrends = sourcesTrends.filter((t: any) => 
        t.sentiment_analysis?.sentiment
      );
      
      if (analyzedTrends.length === 0) {
        toast({
          title: "Нет данных для анализа",
          description: "Нет трендов с анализом настроения. Используйте кнопку 'Собрать комментарии' для трендов.",
          variant: "destructive"
        });
        return;
      }

      // Вычисляем статистику
      const positiveCount = analyzedTrends.filter((t: any) => 
        t.sentiment_analysis?.sentiment === 'positive'
      ).length;
      const negativeCount = analyzedTrends.filter((t: any) => 
        t.sentiment_analysis?.sentiment === 'negative'
      ).length;
      const neutralCount = analyzedTrends.filter((t: any) => 
        t.sentiment_analysis?.sentiment === 'neutral'
      ).length;

      const totalTrends = analyzedTrends.length;
      const positivePercentage = (positiveCount / totalTrends) * 100;
      const negativePercentage = (negativeCount / totalTrends) * 100;
      const neutralPercentage = (neutralCount / totalTrends) * 100;

      // Определяем общее настроение
      const maxCount = Math.max(positiveCount, negativeCount, neutralCount);
      let overallSentiment = 'neutral';
      let emoji = '😐';
      if (maxCount === positiveCount) {
        overallSentiment = 'positive';
        emoji = '😊';
      } else if (maxCount === negativeCount) {
        overallSentiment = 'negative';
        emoji = '😞';
      }

      // Вычисляем средний score (если есть)
      const scoresWithValues = analyzedTrends
        .map((t: any) => t.sentiment_analysis?.score)
        .filter(score => score !== undefined && score !== null);

      const averageScore = scoresWithValues.length > 0 
        ? scoresWithValues.reduce((sum: number, score: number) => sum + score, 0) / scoresWithValues.length
        : 5; // Дефолтный средний score

      // Создаем объект анализа источника
      const analysisData = {
        total_trends: sourcesTrends.length,
        analyzed_trends: analyzedTrends.length,
        positive_percentage: Math.round(positivePercentage),
        negative_percentage: Math.round(negativePercentage),
        neutral_percentage: Math.round(neutralPercentage),
        overall_sentiment: overallSentiment,
        average_score: Math.round(averageScore * 10) / 10,
        emoji: emoji,
        analyzed_at: new Date().toISOString()
      };

      // Сохраняем анализ источника
      const updateResponse = await fetch(`/api/sources/${sourceId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sentiment_analysis: analysisData
        })
      });

      if (updateResponse.ok) {
        // Обновляем кэш источников
        queryClient.invalidateQueries({ queryKey: ["campaign_content_sources", selectedCampaignId] });
        
        toast({
          title: "Анализ источника завершен",
          description: `${sourceName}: ${overallSentiment === 'positive' ? 'Положительное' : overallSentiment === 'negative' ? 'Отрицательное' : 'Нейтральное'} настроение`,
        });
      } else {
        throw new Error('Не удалось сохранить анализ источника');
      }
    } catch (error) {
      console.error('Ошибка анализа источника:', error);
      toast({
        title: "Ошибка анализа",
        description: `Ошибка: ${(error as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setAnalyzingSourceId(null);
    }
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
      <div className="flex justify-between items-center bg-background pb-4">
        <div>
          <h1 className="text-2xl font-bold">SMM Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Анализ популярных тем и управление контентом в социальных медиа
          </p>
        </div>
        <div className="flex gap-2">
          {isValidCampaignSelected && (
            <TrendsCollection 
              campaignId={selectedCampaignId} 
              selectedSourcesForComments={selectedSourcesForComments}
            />
          )}
          <Button
            variant="outline"
            onClick={() => setIsSourceCollectionDialogOpen(true)}
            disabled={!isValidCampaignSelected}
          >
            <Search className="mr-2 h-4 w-4" />
            Собрать источники
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
              <Collapsible open={isDataSourcesExpanded} onOpenChange={setIsDataSourcesExpanded}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold">Источники данных</h2>
                      {sources.length > 0 && (
                        <>
                          <Button
                            variant={selectedSourceId === null ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setSelectedSourceId(null);
                              setIsTrendsExpanded(true);
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            Все источники
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={selectAllSources}
                            className="h-7 px-2 text-xs"
                          >
                            {selectedSourcesForComments.size === sources.length ? 'Снять выбор' : 'Выбрать все'}
                          </Button>

                        </>
                      )}
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-1 h-auto">
                        {isDataSourcesExpanded ? 
                          <ChevronUp className="h-4 w-4" /> : 
                          <ChevronDown className="h-4 w-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                {isLoadingSources ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !sources.length ? (
                  <p className="text-center text-muted-foreground">
                    Нет добавленных источников
                  </p>
                ) : (
                  <div ref={sourcesContainerRef} className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
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
                      <div 
                        key={source.id} 
                        data-source-id={source.id}
                        ref={(el) => {
                          if (el) {
                            sourcesRefs.current[source.id] = el;
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                          selectedSourceId === source.id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Checkbox
                            checked={selectedSourcesForComments.has(source.id)}
                            onCheckedChange={() => toggleSourceSelection(source.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0"
                          />
                          <div 
                            className="cursor-pointer flex-1" 
                            onClick={() => {
                              setSelectedSourceId(selectedSourceId === source.id ? null : source.id);
                              setIsTrendsExpanded(true); // Автоматически разворачиваем секцию трендов при выборе источника
                            }}
                          >
                            <div>
                              <h3 className="font-medium">{source.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {source.url}
                                </a>
                              </p>
                            </div>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              // Если есть уже сохраненный анализ, пересчитываем на основе трендов
                              if (source.sentiment_analysis) {
                                recalculateSourceSentiment(source.id, source.name);
                              } else {
                                analyzeSource(source.id, source.name);
                              }
                            }}
                            title="Анализ источника"
                            disabled={analyzingSourceId === source.id}
                          >
                            {analyzingSourceId === source.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : sourceAnalysisData[source.id] ? (
                              <SentimentEmoji 
                                sentiment={{sentiment: sourceAnalysisData[source.id].sentiment || 'unknown', score: (sourceAnalysisData[source.id] as any).score || 5, confidence: sourceAnalysisData[source.id].confidence}} 
                                className="text-lg" 
                              />
                            ) : (() => {
                              // Используем сохраненные данные анализа настроения источника
                              if (source.sentiment_analysis) {
                                // Если есть готовое emoji в данных
                                if (source.sentiment_analysis.emoji) {
                                  return (
                                    <span 
                                      className="text-lg select-none" 
                                      title={`Общая тональность: ${source.sentiment_analysis.overall_sentiment || source.sentiment_analysis.sentiment || 'не определена'}`}
                                    >
                                      {source.sentiment_analysis.emoji}
                                    </span>
                                  );
                                }
                                // Используем sentiment для создания emoji  
                                else if (source.sentiment_analysis.overall_sentiment || source.sentiment_analysis.sentiment) {
                                  return (
                                    <SentimentEmoji 
                                      sentiment={{
                                        sentiment: source.sentiment_analysis.overall_sentiment || source.sentiment_analysis.sentiment || 'neutral', 
                                        score: source.sentiment_analysis.score || source.sentiment_analysis.average_score || 5, 
                                        confidence: source.sentiment_analysis.confidence || 0.5
                                      }} 
                                      className="text-lg" 
                                    />
                                  );
                                }
                              }
                              
                              return <BarChart className="h-4 w-4 text-blue-500" />;
                            })()}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSource(source.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}

                  </div>
                )}
                  </CollapsibleContent>
                </CardContent>
              </Collapsible>
            </Card>

            <Card className="bg-white shadow-md">
              <Collapsible open={isTrendsExpanded} onOpenChange={setIsTrendsExpanded}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">
                      Тренды{selectedSourceId ? ` - ${sources.find(s => s.id === selectedSourceId)?.name || 'Выбранный источник'}` : ''}
                    </h2>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-1 h-auto">
                        {isTrendsExpanded ? 
                          <ChevronUp className="h-4 w-4" /> : 
                          <ChevronDown className="h-4 w-4" />
                        }
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="space-y-4">
                      {/* Статистика по тональности */}
                      {(() => {
                        // Получаем тренды для статистики (учитывая выбранный источник)
                        const statsData = selectedSourceId 
                          ? trends.filter((t: any) => t.sourceId === selectedSourceId || t.source_id === selectedSourceId)
                          : trends;
                        
                        // Собираем статистику по сентиментам - проверяем как анализ тренда, так и источника
                        const sourcesSentimentStats = statsData.reduce((acc: any, trend: any) => {
                          let sentiment = null;
                          
                          // Сначала проверяем анализ на уровне тренда
                          if (trend.sentiment_analysis?.sentiment) {
                            sentiment = trend.sentiment_analysis.sentiment;
                          } else {
                            // Если нет анализа тренда, проверяем источник
                            const sourceId = trend.sourceId || trend.source_id;
                            const source = sources.find(s => s.id === sourceId);
                            if (source?.sentiment_analysis?.sentiment) {
                              sentiment = source.sentiment_analysis.sentiment;
                            }
                          }
                          
                          switch (sentiment) {
                            case 'positive':
                              acc.positive += 1;
                              break;
                            case 'negative':
                              acc.negative += 1;
                              break;
                            case 'neutral':
                              acc.neutral += 1;
                              break;
                            default:
                              acc.unknown += 1;
                          }
                          
                          return acc;
                        }, { positive: 0, negative: 0, neutral: 0, unknown: 0 });
                        
                        return statsData.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                            <Card>
                              <CardContent className="p-3 text-center">
                                <div className="text-lg font-bold">{statsData.length}</div>
                                <div className="text-xs text-muted-foreground">Всего трендов</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-3 text-center">
                                <div className="text-lg font-bold text-green-600">
                                  {sourcesSentimentStats.positive}
                                </div>
                                <div className="text-xs text-muted-foreground">😊 Позитивных</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-3 text-center">
                                <div className="text-lg font-bold text-gray-600">
                                  {sourcesSentimentStats.neutral}
                                </div>
                                <div className="text-xs text-muted-foreground">😐 Нейтральных</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-3 text-center">
                                <div className="text-lg font-bold text-red-600">
                                  {sourcesSentimentStats.negative}
                                </div>
                                <div className="text-xs text-muted-foreground">😞 Негативных</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-3 text-center">
                                <div className="text-lg font-bold text-yellow-600">
                                  {sourcesSentimentStats.unknown}
                                </div>
                                <div className="text-xs text-muted-foreground">❓ Неопределенных</div>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })()}

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
                        <div className="text-sm text-muted-foreground mr-1">Тональность:</div>
                        <Select
                          value={selectedSentiment}
                          onValueChange={(value: string) => setSelectedSentiment(value)}
                        >
                          <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Все тональности" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Все тональности</SelectItem>
                            <SelectItem value="positive">😊 Позитивные</SelectItem>
                            <SelectItem value="neutral">😐 Нейтральные</SelectItem>
                            <SelectItem value="negative">😞 Негативные</SelectItem>
                            <SelectItem value="unknown">❓ Неопределенные</SelectItem>
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
                          <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                            <span>Всего трендов: {trends.length}</span>
                            {selectedSourceId && (
                              <>
                                <span>|</span>
                                <span className="text-blue-600 font-medium">
                                  Фильтр по источнику: {sources.find(s => s.id === selectedSourceId)?.name || 'Неизвестный'}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedSourceId(null)}
                                  className="h-5 px-2 text-xs"
                                >
                                  Показать все источники
                                </Button>
                              </>
                            )}
                            <span>|</span>
                            <span>Период: {selectedPeriod}</span>
                            <span>| Платформа: {selectedPlatform}</span>
                            <span>| Тональность: {selectedSentiment === 'all' ? 'все' : selectedSentiment === 'positive' ? 'позитивные' : selectedSentiment === 'negative' ? 'негативные' : selectedSentiment === 'neutral' ? 'нейтральные' : 'неопределенные'}</span>
                            {selectedPeriod === 'all' && <span className="text-green-600"> (загружены ВСЕ записи)</span>}
                            {sortField !== 'none' && (
                              <>
                                <span>|</span>
                                <span className="text-purple-600">
                                  Сортировка: {sortField === 'comments' ? 'по комментариям' : 
                                              sortField === 'reactions' ? 'по реакциям' : 
                                              sortField === 'views' ? 'по просмотрам' : 
                                              sortField === 'date' ? 'по дате' : 
                                              sortField === 'platform' ? 'по соцсетям' : sortField} 
                                  ({sortDirection === 'asc' ? '↑' : '↓'})
                                </span>
                              </>
                            )}
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
                              <>
                                <span className="text-xs text-blue-600 ml-2">
                                  ({selectedTopics.length} выбрано)
                                </span>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={collectSelectedTrendsComments}
                                  disabled={isCollectingTrendComments}
                                  className="h-7 px-2 text-xs ml-2"
                                >
                                  {isCollectingTrendComments ? (
                                    <>
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      Сбор комментариев...
                                    </>
                                  ) : (
                                    <>
                                      <MessageSquare className="mr-1 h-3 w-3" />
                                      Собрать комментарии
                                    </>
                                  )}
                                </Button>
                              </>
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
                            
                            // Фильтр по выбранному источнику
                            const sourceMatches = selectedSourceId === null || 
                              topic.source_id === selectedSourceId || 
                              topic.sourceId === selectedSourceId;
                            
                            // Логирование убрано - проблема найдена
                            
                            // Фильтр по тональности
                            let sentimentMatches = false;
                            if (selectedSentiment === 'all') {
                              sentimentMatches = true;
                            } else {
                              const sentimentCategory = getSentimentCategory(topic.sentiment_analysis);
                              sentimentMatches = sentimentCategory === selectedSentiment;
                            }
                            
                            const finalResult = withinPeriod && matchesSearch && platformMatches && sourceMatches && sentimentMatches;
                            

                            
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
                                  if ((mediaLinksStr as any).images && Array.isArray((mediaLinksStr as any).images) && (mediaLinksStr as any).images.length > 0) {
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
                                  setSelectedTrendTopic(topic);
                                  // Синхронизируем выбор тренда с соответствующим источником
                                  syncTrendWithSource(topic);
                                  // Сразу загружаем комментарии для выбранного тренда
                                  loadTrendComments(topic.id);
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
                                        className="text-sm line-clamp-2 cursor-pointer flex items-start gap-2"
                                        onClick={() => {
                                          console.log('Тренд выбран:', topic.title, 'sentiment_analysis:', topic.sentiment_analysis);
                                          setSelectedTrendTopic(topic);
                                          // Синхронизируем выбор тренда с соответствующим источником
                                          syncTrendWithSource(topic);
                                        }}
                                      >
                                        <SentimentEmoji sentiment={topic.sentiment_analysis} className="text-sm" />
                                        <span className="flex-1">
                                          {topic.description ? topic.description.split('\n')[0] : topic.title}
                                        </span>
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
                                        
                                        {/* Кнопка сбора комментариев для ВК и ТГ, только если есть комментарии */}
                                        {(topic.urlPost?.includes('vk.com') || topic.urlPost?.includes('t.me') || 
                                          topic.accountUrl?.includes('vk.com') || topic.accountUrl?.includes('t.me')) && 
                                          topic.comments && topic.comments > 0 && (
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
                            {/* Кнопка для сбора комментариев если это ВК или ТГ тренд и есть комментарии */}
                            {(selectedTrendTopic.urlPost?.includes('vk.com') || selectedTrendTopic.urlPost?.includes('t.me') || 
                              selectedTrendTopic.accountUrl?.includes('vk.com') || selectedTrendTopic.accountUrl?.includes('t.me')) && 
                              selectedTrendTopic.comments && selectedTrendTopic.comments > 0 && (
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

                    {/* Блок детального анализа источника */}
                    {selectedTrendTopic && (() => {
                      const sourceId = selectedTrendTopic.source_id || selectedTrendTopic.sourceId;
                      const source = sources.find(s => s.id === sourceId);
                      const sourceAnalysis = source?.sentiment_analysis;
                      
                      return sourceAnalysis && (
                        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <Building className="h-5 w-5 text-indigo-600" />
                            <h5 className="font-medium text-gray-900">Анализ источника: {source?.name}</h5>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="text-center p-2 bg-white rounded border">
                              <div className="text-lg font-semibold text-blue-600">
                                {(sourceAnalysis as any).score || (sourceAnalysis as any).average_score || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-600">Рейтинг</div>
                            </div>
                            <div className="text-center p-2 bg-white rounded border">
                              <div className="text-lg font-semibold text-purple-600">
                                {Math.round(((sourceAnalysis as any).confidence || 0) * 100)}%
                              </div>
                              <div className="text-xs text-gray-600">Точность</div>
                            </div>
                            <div className="text-center p-2 bg-white rounded border">
                              <div className="text-lg font-semibold text-orange-600">
                                {(sourceAnalysis as any).totalComments || (sourceAnalysis as any).commentsAnalyzed || (sourceAnalysis as any).total_comments || 0}
                              </div>
                              <div className="text-xs text-gray-600">Комментариев</div>
                            </div>
                            <div className="text-center p-2 bg-white rounded border">
                              <div className="text-lg font-semibold text-teal-600">
                                {(sourceAnalysis as any).avgCommentsPerTrend || Math.round(((sourceAnalysis as any).totalComments || (sourceAnalysis as any).total_comments || 0) / Math.max((sourceAnalysis as any).trendsAnalyzed || (sourceAnalysis as any).analyzed_trends || 1, 1))}
                              </div>
                              <div className="text-xs text-gray-600">На пост</div>
                            </div>
                          </div>
                          
                          {/* Дополнительная статистика если есть детальные данные */}
                          {(sourceAnalysis.positive_percentage || sourceAnalysis.negative_percentage || sourceAnalysis.neutral_percentage) && (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                                <div className="text-sm font-semibold text-green-700">
                                  {sourceAnalysis.positive_percentage || 0}%
                                </div>
                                <div className="text-xs text-green-600">Позитивные</div>
                              </div>
                              <div className="text-center p-2 bg-red-50 rounded border border-red-200">
                                <div className="text-sm font-semibold text-red-700">
                                  {sourceAnalysis.negative_percentage || 0}%
                                </div>
                                <div className="text-xs text-red-600">Негативные</div>
                              </div>
                              <div className="text-center p-2 bg-gray-50 rounded border border-gray-200">
                                <div className="text-sm font-semibold text-gray-700">
                                  {sourceAnalysis.neutral_percentage || 0}%
                                </div>
                                <div className="text-xs text-gray-600">Нейтральные</div>
                              </div>
                            </div>
                          )}
                          
                          <div className="text-sm text-gray-700 bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg">{sourceAnalysis.emoji || '😐'}</span>
                              <strong>Общее настроение:</strong>
                              <span className={`font-medium ${
                                (sourceAnalysis as any).overall_sentiment === 'positive' ? 'text-green-600' :
                                (sourceAnalysis as any).overall_sentiment === 'negative' ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {(sourceAnalysis as any).overall_sentiment === 'positive' ? 'Позитивное' :
                                 (sourceAnalysis as any).overall_sentiment === 'negative' ? 'Негативное' : 'Нейтральное'}
                              </span>
                            </div>
                            
                            {/* Основной summary - всегда показываем */}
                            <div className="mb-3 p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                              <strong className="text-blue-800">Анализ источника:</strong>
                              <p className="mt-1 text-blue-700 text-sm">{(sourceAnalysis as any).summary}</p>
                            </div>
                            
                            {/* Детальное описание аудитории от AI */}
                            {(sourceAnalysis as any).detailed_summary && (
                              <div className="mb-3 p-2 bg-purple-50 rounded border-l-4 border-purple-400">
                                <strong className="text-purple-800">Характеристика аудитории:</strong>
                                <p className="mt-1 text-purple-700 text-sm">{(sourceAnalysis as any).detailed_summary}</p>
                              </div>
                            )}
                            
                            {/* AI summary (короткое описание) */}
                            {(sourceAnalysis as any).ai_summary && (sourceAnalysis as any).ai_summary !== (sourceAnalysis as any).detailed_summary && (
                              <div className="mb-3 p-2 bg-green-50 rounded border-l-4 border-green-400">
                                <strong className="text-green-800">AI анализ:</strong>
                                <p className="mt-1 text-green-700 text-sm">{(sourceAnalysis as any).ai_summary}</p>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t">
                              <div>
                                Трендов: {(sourceAnalysis as any).trendsAnalyzed || (sourceAnalysis as any).analyzed_trends || 0}/{(sourceAnalysis as any).totalTrends || (sourceAnalysis as any).total_trends || 0}
                                <span className="ml-2">
                                  • Метод: {(sourceAnalysis as any).analysisMethod === 'AI' ? '🤖 AI' : 
                                          (sourceAnalysis as any).analysisMethod === 'keywords' ? '🔤 Ключевые слова' : '📊 Базовый'}
                                </span>
                              </div>
                              {((sourceAnalysis as any).analyzedAt || (sourceAnalysis as any).analyzed_at) && (
                                <div>
                                  {new Date((sourceAnalysis as any).analyzedAt || (sourceAnalysis as any).analyzed_at).toLocaleString('ru-RU', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

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
                                        // Обновляем данные после анализа настроения (без интервалов)
                                        console.log('✅ Анализ настроения завершен, данные обновлены локально');
                                        queryClient.invalidateQueries({ queryKey: ["trends", selectedPeriod, selectedCampaignId] });
                                        
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
                                        description: `Ошибка подключения: ${(error as Error).message}`,
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
                              

                              <Button
                                onClick={() => {
                                  // Получаем sourceId для текущего тренда
                                  const sourceId = selectedTrendTopic.source_id || selectedTrendTopic.sourceId;
                                  const source = sources.find(s => s.id === sourceId);
                                  const sourceName = source?.name || 'Источник';
                                  
                                  if (sourceId) {
                                    // Используем ту же логику что и в списке источников
                                    if (source?.sentiment_analysis) {
                                      recalculateSourceSentiment(sourceId, sourceName);
                                    } else {
                                      analyzeSource(sourceId, sourceName);
                                    }
                                  } else {
                                    toast({
                                      title: "Ошибка",
                                      description: "Не удалось определить источник для анализа",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                                disabled={analyzingSourceId !== null}
                                size="sm"
                                variant="outline"
                                className="gap-2"
                              >
                                {analyzingSourceId !== null ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Building className="h-4 w-4" />
                                )}
                                {analyzingSourceId !== null ? 'Анализируем...' : 'Анализ источника'}
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
                            
                            {/* Блок результатов многоуровневого анализа комментариев */}
                            {(commentsAnalysisData.trend_level || commentsAnalysisData.source_level) && (
                              <div className="mb-4 space-y-4">
                                {/* Анализ на уровне тренда */}
                                {commentsAnalysisData.trend_level && (
                                  <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Target className="h-5 w-5 text-green-600" />
                                      <h5 className="font-medium text-gray-900">Анализ тренда</h5>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-green-600">
                                          {commentsAnalysisData.trend_level.sentiment === 'positive' ? '😊' : 
                                           commentsAnalysisData.trend_level.sentiment === 'negative' ? '😔' : '😐'}
                                        </div>
                                        <div className="text-xs text-gray-600">Настроение</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-blue-600">
                                          {commentsAnalysisData.trend_level.confidence || 0}%
                                        </div>
                                        <div className="text-xs text-gray-600">Уверенность</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-purple-600">
                                          {commentsAnalysisData.trend_level.engagement || 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-600">Вовлеченность</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-orange-600">
                                          {commentsAnalysisData.trend_level.viral_potential || 0}%
                                        </div>
                                        <div className="text-xs text-gray-600">Вирусность</div>
                                      </div>
                                    </div>
                                    {commentsAnalysisData.trend_level.themes && commentsAnalysisData.trend_level.themes.length > 0 && (
                                      <div className="mb-3">
                                        <div className="text-xs text-gray-600 mb-1">Основные темы:</div>
                                        <div className="flex flex-wrap gap-1">
                                          {commentsAnalysisData.trend_level.themes.map((theme: string, index: number) => (
                                            <span key={index} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                              {theme}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="text-sm text-gray-700 bg-white p-2 rounded border">
                                      <strong>Анализ тренда:</strong> {commentsAnalysisData.trend_level.summary}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Анализ на уровне источника */}
                                {commentsAnalysisData.source_level && (
                                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Building className="h-5 w-5 text-amber-600" />
                                      <h5 className="font-medium text-gray-900">Анализ источника</h5>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-amber-600">
                                          {commentsAnalysisData.source_level.sentiment === 'positive' ? '😊' : 
                                           commentsAnalysisData.source_level.sentiment === 'negative' ? '😔' : '😐'}
                                        </div>
                                        <div className="text-xs text-gray-600">Настроение</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-blue-600">
                                          {commentsAnalysisData.source_level.confidence || 0}%
                                        </div>
                                        <div className="text-xs text-gray-600">Уверенность</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-purple-600">
                                          {commentsAnalysisData.source_level.source_reputation || 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-600">Репутация</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-green-600">
                                          {commentsAnalysisData.source_level.audience_trust || 0}%
                                        </div>
                                        <div className="text-xs text-gray-600">Доверие</div>
                                      </div>
                                    </div>
                                    {commentsAnalysisData.source_level.themes && commentsAnalysisData.source_level.themes.length > 0 && (
                                      <div className="mb-3">
                                        <div className="text-xs text-gray-600 mb-1">Основные темы:</div>
                                        <div className="flex flex-wrap gap-1">
                                          {commentsAnalysisData.source_level.themes.map((theme: string, index: number) => (
                                            <span key={index} className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                                              {theme}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="text-sm text-gray-700 bg-white p-2 rounded border">
                                      <strong>Анализ источника:</strong> {commentsAnalysisData.source_level.summary}
                                    </div>
                                  </div>
                                )}
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
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Collapsible>
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

      {/* Диалог сбора источников */}
      <SourceCollectionDialog
        isOpen={isSourceCollectionDialogOpen}
        onClose={() => setIsSourceCollectionDialogOpen(false)}
        campaignId={selectedCampaignId || ''}
      />

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