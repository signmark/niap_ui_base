import { useState, useEffect, useRef, createRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Plus, Pencil, Calendar, Send, Trash2, FileText, 
  ImageIcon, Video, FilePlus2, CheckCircle2, Clock, RefreshCw,
  Wand2, Share, Sparkles, CalendarDays, ChevronDown, ChevronRight,
  CalendarIcon, XCircle, Filter, Play
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PublishingStatus } from "@/components/PublishingStatus";
import { ScheduledPostInfo } from "@/components/ScheduledPostInfo";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import type { Campaign, CampaignContent } from "@shared/schema";
import { formatDistanceToNow, format, isAfter, isBefore, parseISO, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { ContentGenerationDialog } from "@/components/ContentGenerationDialog";
import { SocialContentAdaptationDialog } from "@/components/SocialContentAdaptationDialog";
import { ImageGenerationDialog } from "@/components/ImageGenerationDialog";
import { ContentPlanGenerator } from "@/components/ContentPlanGenerator";
import { useCampaignStore } from "@/lib/campaignStore";
import RichTextEditor from "@/components/RichTextEditor";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// Создаем формат даты
const formatDate = (date: string | Date) => {
  if (!date) return "";
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ru });
};

// Функция для преобразования Markdown-подобного синтаксиса в HTML
const processMarkdownSyntax = (content: string): string => {
  if (!content) return "";
  
  // Сохраняем исходный контент для проверки изменений
  let processedContent = content;
  
  // Обработка заголовков разных уровней
  processedContent = processedContent
    .replace(/^###\s+(.*?)(?:\n|$)/gm, '<h3>$1</h3>') // h3 заголовки
    .replace(/^##\s+(.*?)(?:\n|$)/gm, '<h2>$1</h2>')  // h2 заголовки
    .replace(/^#\s+(.*?)(?:\n|$)/gm, '<h1>$1</h1>');  // h1 заголовки
  
  // Обработка жирного текста **текст** или __текст__
  processedContent = processedContent.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
  
  // Обработка курсива *текст* или _текст_
  processedContent = processedContent.replace(/(\*|_)([^\*_]+)\1/g, '<em>$2</em>');
  
  // Обработка переносов строк (двойной перенос строки на абзацы)
  // Сначала разделяем контент на абзацы по двойным переносам
  const paragraphs = processedContent.split(/\n\s*\n/);
  
  // Обрабатываем каждый абзац
  processedContent = paragraphs.map(paragraph => {
    // Если абзац уже содержит HTML-тег, оставляем как есть
    if (paragraph.trim().startsWith('<') && !paragraph.trim().startsWith('<em>') && !paragraph.trim().startsWith('<strong>')) {
      return paragraph;
    }
    
    // Иначе оборачиваем в <p>
    return `<p>${paragraph.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  
  return processedContent;
};

export default function ContentPage() {
  // Используем глобальный стор выбранной кампании
  const { selectedCampaign } = useCampaignStore();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(selectedCampaign?.id || "");
  
  // Обновляем локальный ID кампании когда меняется глобальный выбор
  useEffect(() => {
    if (selectedCampaign?.id) {
      setSelectedCampaignId(selectedCampaign.id);
    }
  }, [selectedCampaign]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isAdaptDialogOpen, setIsAdaptDialogOpen] = useState(false);
  const [isImageGenerationDialogOpen, setIsImageGenerationDialogOpen] = useState(false);
  const [isContentPlanDialogOpen, setIsContentPlanDialogOpen] = useState(false);
  const [currentContent, setCurrentContent] = useState<CampaignContent | null>(null);
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<string>>(new Set());
  
  // Вспомогательная функция для безопасной установки контента с гарантией наличия массива keywords
  // ВАЖНО: Всегда используйте эту функцию вместо setCurrentContent при установке ненулевых значений,
  // чтобы избежать ошибок типа "keywords is not iterable"
  const setCurrentContentSafe = (content: CampaignContent | null) => {
    if (content) {
      // Гарантируем, что keywords всегда массив
      let processedKeywords: string[] = [];
      
      // Обрабатываем ключевые слова для обеспечения правильного формата
      if (content.keywords) {
        if (Array.isArray(content.keywords)) {
          processedKeywords = content.keywords.map(k => typeof k === 'string' ? k : String(k));
        } else if (typeof content.keywords === 'string') {
          try {
            // Пытаемся разобрать JSON строку
            const parsed = JSON.parse(content.keywords);
            if (Array.isArray(parsed)) {
              processedKeywords = parsed.map(k => typeof k === 'string' ? k : String(k));
            } else {
              processedKeywords = [content.keywords];
            }
          } catch (e) {
            // Если не JSON, просто используем как строку
            processedKeywords = [content.keywords];
          }
        } else if (content.keywords !== null) {
          // Для всех других случаев
          processedKeywords = [String(content.keywords)];
        }
      }
      
      const safeContent = {
        ...content,
        keywords: processedKeywords
      };
      
      console.log('Setting content with processed keywords:', safeContent.keywords);
      setCurrentContent(safeContent);
      
      // Сбрасываем и заново устанавливаем выбранные ключевые слова
      const newSelectedKeywords = new Set<string>();
      
      // Добавляем ID из предопределенных ключевых слов
      if (Array.isArray(safeContent.keywords)) {
        console.log('Comparing keywords for selection:', safeContent.keywords);
        
        campaignKeywords.forEach(kw => {
          // Строгое сравнение и нормализация строк для более надежного сопоставления
          const normalizedKeyword = kw.keyword.trim().toLowerCase();
          const hasKeyword = safeContent.keywords.some(
            k => typeof k === 'string' && k.trim().toLowerCase() === normalizedKeyword
          );
          
          console.log(`Keyword "${kw.keyword}" (${kw.id}) match:`, hasKeyword);
          
          if (hasKeyword) {
            newSelectedKeywords.add(kw.id);
          }
        });
      }
      
      setSelectedKeywordIds(newSelectedKeywords);
      console.log('Selected keyword IDs updated:', Array.from(newSelectedKeywords));
    } else {
      setCurrentContent(null);
      setSelectedKeywordIds(new Set());
    }
  };
  const [newContent, setNewContent] = useState({
    title: "",
    content: "",
    contentType: "text",
    imageUrl: "",
    videoUrl: "",
    prompt: "", // Добавляем поле промта для генерации изображений
    keywords: [] as string[]
  });
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<{[key: string]: boolean}>({
    instagram: false,
    telegram: false,
    vk: false,
    facebook: false
  });
  const [activeTab, setActiveTab] = useState<string>("all");
  
  // Состояние для фильтрации по датам
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  // Состояние для отображения фильтра по датам
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Запрос списка кампаний
  const { data: campaignsResponse, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      return response.json();
    }
  });
  
  const campaigns = campaignsResponse?.data || [];

  // Запрос списка контента для выбранной кампании
  const { data: campaignContent = [], isLoading: isLoadingContent } = useQuery<CampaignContent[]>({
    queryKey: ["/api/campaign-content", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      const response = await fetch(`/api/campaign-content?campaignId=${selectedCampaignId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaign content');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!selectedCampaignId
  });
  
  // Запрос ключевых слов кампании
  const { data: campaignKeywords = [], isLoading: isLoadingKeywords } = useQuery<any[]>({
    queryKey: ["/api/keywords", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];

      const response = await fetch(`/api/keywords?campaignId=${selectedCampaignId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaign keywords');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!selectedCampaignId
  });

  // Мутация для создания контента
  const createContentMutation = useMutation({
    mutationFn: async (contentData: any) => {
      return await apiRequest('/api/campaign-content', { 
        method: 'POST',
        data: contentData 
      });
    },
    onSuccess: () => {
      // Сначала обновляем данные, затем закрываем диалог
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] })
        .then(() => {
          // Показываем уведомление об успехе
          toast({
            description: "Контент успешно создан",
          });
          
          // Сбрасываем форму
          setNewContent({
            title: "",
            content: "",
            contentType: "text",
            imageUrl: "",
            videoUrl: "",
            prompt: "", // Сохраняем поле prompt
            keywords: []
          });
          
          // Закрываем диалог
          setIsCreateDialogOpen(false);
        });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при создании контента",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для обновления контента
  const updateContentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      // Убедимся, что keywords всегда массив и JSON-сериализуем его
      if (data.keywords) {
        console.log('Updating content with keywords:', data.keywords);
        
        // Проверяем, что keywords это массив
        if (!Array.isArray(data.keywords)) {
          console.warn('Keywords is not an array, converting:', data.keywords);
          data.keywords = data.keywords ? [String(data.keywords)] : [];
        }
      }
      
      return await apiRequest(`/api/campaign-content/${id}`, { 
        method: 'PATCH',
        data
      });
    },
    onSuccess: (data) => {
      console.log('Content update success response:', data);
      
      // Принудительное обновление
      if (data?.data) {
        // Показываем тост в любом случае, чтобы уведомить пользователя
        toast({
          description: "Контент успешно обновлен",
        });
      }
      
      // Сначала обновляем данные, затем закрываем диалог
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] })
        .then(() => {
          // Принудительно закрываем форму
          setIsEditDialogOpen(false);
          setCurrentContent(null);
        });
    },
    onError: (error: Error) => {
      console.error('Content update error:', error);
      toast({
        title: "Ошибка при обновлении контента",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для удаления контента
  const deleteContentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/campaign-content/${id}`, { 
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      // Сначала обновляем данные, затем показываем уведомление
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] })
        .then(() => {
          toast({
            description: "Контент успешно удален",
          });
        });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при удалении контента",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для планирования публикации
  const scheduleContentMutation = useMutation({
    mutationFn: async ({ id, scheduledAt, platforms }: { id: string, scheduledAt: string, platforms?: {[key: string]: boolean} }) => {
      // Подготовка данных о платформах
      const socialPlatformsData: Record<string, any> = {};
      
      // Если есть выбранные платформы, настраиваем их в JSON-структуру
      if (platforms) {
        Object.entries(platforms).forEach(([platform, isEnabled]) => {
          if (isEnabled) {
            socialPlatformsData[platform] = {
              status: 'pending',
              publishedAt: null,
              postId: null,
              postUrl: null,
              error: null
            };
          }
        });
      }

      return await apiRequest(`/api/campaign-content/${id}`, { 
        method: 'PATCH',
        data: {
          scheduledAt,
          status: 'scheduled',
          socialPlatforms: socialPlatformsData // Всегда передаем объект, даже если он пустой
        }
      });
    },
    onSuccess: () => {
      // Сначала обновляем данные, затем закрываем диалог
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] })
        .then(() => {
          toast({
            description: "Публикация запланирована",
          });
          setIsScheduleDialogOpen(false);
          setCurrentContent(null);
        });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при планировании публикации",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Обработчик создания контента
  const handleCreateContent = () => {
    if (!selectedCampaignId) {
      toast({
        description: "Выберите кампанию для создания контента",
        variant: "destructive"
      });
      return;
    }

    if (!newContent.title) {
      toast({
        description: "Введите название контента",
        variant: "destructive"
      });
      return;
    }

    if (!newContent.content) {
      toast({
        description: "Введите текст контента",
        variant: "destructive"
      });
      return;
    }

    // Проверяем корректность URL для изображения или видео
    if (
      (newContent.contentType === "text-image" && !newContent.imageUrl) ||
      (newContent.contentType === "video" && !newContent.videoUrl) ||
      (newContent.contentType === "video-text" && !newContent.videoUrl)
    ) {
      toast({
        description: "Добавьте URL изображения или видео",
        variant: "destructive"
      });
      return;
    }

    createContentMutation.mutate({
      campaignId: selectedCampaignId,
      ...newContent,
      status: 'draft'
    });
  };

  // Обработчик обновления контента
  const handleUpdateContent = () => {
    if (!currentContent) return;

    console.log('Current content before update:', currentContent);
    console.log('Selected keyword IDs:', Array.from(selectedKeywordIds));
    
    // Собираем выбранные ключевые слова из нашего состояния
    let selectedKeywordTexts: string[] = [];
    
    // Проверяем каждое ключевое слово из кампании
    campaignKeywords.forEach(keyword => {
      // Используем наш Set для проверки, выбрано ли ключевое слово
      if (selectedKeywordIds.has(keyword.id)) {
        // Добавляем нормализованное ключевое слово (без изменения регистра для отображения)
        selectedKeywordTexts.push(keyword.keyword);
        console.log(`Adding keyword from campaign: "${keyword.keyword}"`);
      }
    });
    
    // Добавляем пользовательские ключевые слова, которые не являются частью кампании
    if (Array.isArray(currentContent.keywords)) {
      currentContent.keywords.forEach(keyword => {
        if (typeof keyword !== 'string' || !keyword.trim()) return;
        
        // Нормализуем для сравнения
        const normalizedKeyword = keyword.trim();
        
        // Проверяем, не входит ли уже это ключевое слово в список из предопределенных кампаний
        // используя нормализованное сравнение (без учета регистра)
        const isAlreadyIncluded = campaignKeywords.some(
          k => k.keyword.trim().toLowerCase() === normalizedKeyword.toLowerCase()
        );
        
        const isAlreadySelected = selectedKeywordTexts.some(
          k => k.trim().toLowerCase() === normalizedKeyword.toLowerCase()
        );
        
        // Если ключевое слово не из предопределенных в кампании, добавляем его
        if (!isAlreadyIncluded && !isAlreadySelected) {
          selectedKeywordTexts.push(normalizedKeyword);
          console.log(`Adding custom keyword: "${normalizedKeyword}"`);
        }
      });
    }
    
    console.log('FINAL Selected keywords from React state + extras:', selectedKeywordTexts);

    // Создаем типизированный объект для обновления
    const updateData = {
      title: currentContent.title,
      content: currentContent.content,
      contentType: currentContent.contentType,
      imageUrl: currentContent.imageUrl,
      videoUrl: currentContent.videoUrl,
      // НЕ включаем поле prompt, чтобы сохранить промт, созданный при генерации изображения
      // Убедимся, что мы отправляем именно массив, а не объект
      keywords: [...selectedKeywordTexts.filter(k => k && k.trim() !== '')] // Фильтруем пустые значения и создаем новый массив
    };

    console.log('Update data being sent:', updateData);
    console.log('Keywords type:', Array.isArray(updateData.keywords) ? 'Array' : typeof updateData.keywords);

    updateContentMutation.mutate({
      id: currentContent.id,
      data: updateData
    });
  };

  // Обработчик планирования публикации
  const handleScheduleContent = () => {
    if (!currentContent || !scheduleDate) return;

    // Проверяем наличие выбранных платформ
    const selectedPlatformsCount = Object.values(selectedPlatforms).filter(Boolean).length;
    
    // Если платформы не выбраны, показываем предупреждение
    if (selectedPlatformsCount === 0) {
      toast({
        description: "Выберите хотя бы одну платформу для публикации",
        variant: "destructive"
      });
      return;
    }

    scheduleContentMutation.mutate({
      id: currentContent.id,
      scheduledAt: new Date(scheduleDate).toISOString(),
      platforms: selectedPlatforms
    });
  };

  // Фильтруем контент в зависимости от выбранной вкладки
  // Функция для группировки контента по датам
  const groupContentByDate = (content: CampaignContent[]) => {
    const groups: { [key: string]: CampaignContent[] } = {};
    
    content.forEach(item => {
      // Используем дату публикации, планирования или создания
      const date = item.publishedAt || item.scheduledAt || item.createdAt;
      if (!date) return;
      
      // Преобразуем в строку даты (только дата, без времени)
      const dateStr = new Date(date).toISOString().split('T')[0];
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      
      groups[dateStr].push(item);
    });
    
    return groups;
  };
  
  // Фильтрация контента по активной вкладке
  // Функция для форматирования даты для группировки (только день, месяц, год)
  const formatDateForGrouping = (date: Date): string => {
    return new Date(date).toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric' 
    });
  };

  // Функция для сброса фильтрации по датам
  const resetDateFilter = () => {
    setDateRange({
      from: undefined,
      to: undefined
    });
  };

  // Фильтрация и сортировка контента
  const filteredContent = campaignContent
    .filter(content => {
      // Фильтр по статусу (вкладки)
      if (activeTab !== "all" && content.status !== activeTab) {
        return false;
      }
      
      // Фильтр по диапазону дат, если указан
      if (dateRange.from || dateRange.to) {
        const contentDate = new Date(content.publishedAt || content.scheduledAt || content.createdAt || 0);
        
        // Проверка начальной даты диапазона
        if (dateRange.from && contentDate < startOfDay(dateRange.from)) {
          return false;
        }
        
        // Проверка конечной даты диапазона
        if (dateRange.to && contentDate > endOfDay(dateRange.to)) {
          return false;
        }
      }
      
      return true;
    })
    // Сортировка контента по дате (новые сверху)
    .sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.scheduledAt || a.createdAt || 0);
      const dateB = new Date(b.publishedAt || b.scheduledAt || b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
  // Группировка контента по дате
  const contentByDate: Record<string, CampaignContent[]> = {};
  
  filteredContent.forEach(content => {
    const dateStr = formatDateForGrouping(new Date(content.publishedAt || content.scheduledAt || content.createdAt || new Date()));
    if (!contentByDate[dateStr]) {
      contentByDate[dateStr] = [];
    }
    contentByDate[dateStr].push(content);
  });
  
  // Состояние для отслеживания, какие группы развернуты/свернуты
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  // Состояние для модального окна предпросмотра контента
  const [previewContent, setPreviewContent] = useState<CampaignContent | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Получаем иконку для типа контента
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return <FileText className="h-4 w-4" />;
      case "text-image":
        return <ImageIcon className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "video-text":
        return <FilePlus2 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Получаем иконку для статуса
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return <Pencil className="h-4 w-4" />;
      case "scheduled":
        return <Clock className="h-4 w-4" />;
      case "published":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Pencil className="h-4 w-4" />;
    }
  };

  // Получаем цвет бейджа для статуса
  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "draft":
        return "outline";
      case "scheduled":
        return "secondary";
      case "published":
        return "default";
      default:
        return "outline";
    }
  };

  // Получаем текст статуса
  const getStatusText = (status: string) => {
    switch (status) {
      case "draft":
        return "Черновик";
      case "scheduled":
        return "Запланировано";
      case "published":
        return "Опубликовано";
      default:
        return "Черновик";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Управление контентом</h1>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setIsContentPlanDialogOpen(true)}
            disabled={!selectedCampaignId || selectedCampaignId === "loading" || selectedCampaignId === "empty"}
            variant="outline"
            className="bg-blue-50 border-blue-200 hover:bg-blue-100"
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Сгенерировать контент-план
          </Button>
          <Button 
            onClick={() => setIsGenerateDialogOpen(true)}
            disabled={!selectedCampaignId || selectedCampaignId === "loading" || selectedCampaignId === "empty"}
            variant="outline"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Генерация через AI
          </Button>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)} 
            disabled={!selectedCampaignId || selectedCampaignId === "loading" || selectedCampaignId === "empty"}
          >
            <Plus className="mr-2 h-4 w-4" />
            Создать контент
          </Button>
        </div>
      </div>

      {/* Используется глобальный выбор кампаний в верхней панели */}

      {/* Контент кампании */}
      {selectedCampaignId && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center mb-4">
              <CardTitle>Контент кампании</CardTitle>
              <div className="flex items-center gap-2">
                <Popover open={isDateFilterOpen} onOpenChange={setIsDateFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-range-filter"
                      variant={dateRange.from || dateRange.to ? "default" : "outline"}
                      size="sm"
                      className={dateRange.from || dateRange.to ? "bg-blue-500 hover:bg-blue-600" : ""}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from || dateRange.to ? (
                        <>
                          {dateRange.from ? format(dateRange.from, "dd.MM.yyyy") : "..."}
                          {" – "}
                          {dateRange.to ? format(dateRange.to, "dd.MM.yyyy") : "..."}
                        </>
                      ) : (
                        "Фильтр по дате"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="flex flex-col space-y-2 p-2">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">Выберите диапазон дат</div>
                          {(dateRange.from || dateRange.to) && (
                            <Button variant="ghost" size="sm" onClick={resetDateFilter} className="h-7 px-2">
                              <XCircle className="h-4 w-4" />
                              <span className="sr-only">Сбросить</span>
                            </Button>
                          )}
                        </div>
                        <CalendarComponent
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange.from}
                          selected={{
                            from: dateRange.from,
                            to: dateRange.to,
                          }}
                          onSelect={(range) => {
                            if (range?.from) {
                              setDateRange({
                                from: range.from,
                                to: range.to,
                              });
                            } else {
                              resetDateFilter();
                            }
                          }}
                          numberOfMonths={2}
                          locale={ru}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="draft">Черновики</TabsTrigger>
                <TabsTrigger value="scheduled">Запланированные</TabsTrigger>
                <TabsTrigger value="published">Опубликованные</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoadingContent ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !filteredContent.length ? (
              <p className="text-center text-muted-foreground py-8">
                Нет контента для этой кампании
                {(dateRange.from || dateRange.to) && (
                  <div className="text-center mt-2">
                    <Button variant="outline" size="sm" onClick={resetDateFilter}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Сбросить фильтр по датам
                    </Button>
                  </div>
                )}
              </p>
            ) : (
              <div className="space-y-4">
                {/* Группировка по датам */}
                <Accordion type="multiple" defaultValue={Object.keys(contentByDate)}>
                  {Object.entries(contentByDate).map(([dateStr, contents]) => (
                    <AccordionItem key={dateStr} value={dateStr}>
                      <AccordionTrigger className="py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 opacity-70" />
                          <span className="font-medium">{dateStr}</span>
                          <Badge className="ml-2">{contents.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                          {contents.map((content) => (
                            <Card 
                              key={content.id} 
                              className="overflow-hidden border border-muted cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all" 
                              onClick={() => {
                                setPreviewContent(content);
                                setIsPreviewOpen(true);
                              }}
                            >
                              <div className="p-3">
                                {/* Header with type, status and actions */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    {getContentTypeIcon(content.contentType || 'text')}
                                    <Badge variant={getStatusBadgeVariant(content.status || 'draft')} className="text-xs px-2">
                                      {getStatusIcon(content.status || 'draft')}
                                      <span className="ml-1">{getStatusText(content.status || 'draft')}</span>
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation(); // Предотвращаем открытие превью
                                        setCurrentContentSafe(content);
                                        setIsEditDialogOpen(true);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    {content.status === "draft" && (
                                      <>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation(); // Предотвращаем открытие превью
                                            setCurrentContentSafe(content);
                                            setIsScheduleDialogOpen(true);
                                          }}
                                        >
                                          <Calendar className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation(); // Предотвращаем открытие превью
                                            setCurrentContentSafe(content);
                                            setIsAdaptDialogOpen(true);
                                          }}
                                        >
                                          <Share className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    )}
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                      onClick={(e) => {
                                        e.stopPropagation(); // Предотвращаем открытие превью
                                        deleteContentMutation.mutate(content.id);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                
                                {/* Content title */}
                                {content.title && (
                                  <div className="mb-1.5">
                                    <h3 className="text-base font-medium line-clamp-1">{content.title}</h3>
                                  </div>
                                )}
                                
                                {/* Content preview */}
                                <div className="flex gap-3">
                                  {/* Text content */}
                                  <div className="flex-1">
                                    <div className="max-h-14 overflow-hidden relative card-content mb-2">
                                      <div 
                                        className="prose prose-sm max-w-none text-xs"
                                        dangerouslySetInnerHTML={{ 
                                          __html: content.content.startsWith('<') 
                                            ? content.content 
                                            : processMarkdownSyntax(content.content) 
                                        }}
                                      />
                                      <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white to-transparent dark:from-background"></div>
                                    </div>
                                    
                                    {/* Keywords */}
                                    {content.keywords && Array.isArray(content.keywords) && content.keywords.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {content.keywords.slice(0, 3).map((keyword, index) => (
                                          <Badge key={index} variant="outline" className="text-xs px-1.5 py-0 h-5">
                                            {keyword}
                                          </Badge>
                                        ))}
                                        {content.keywords.length > 3 && (
                                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                                            +{content.keywords.length - 3}
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Media content */}
                                  {content.contentType === "text-image" && content.imageUrl && (
                                    <div className="w-20 h-20 flex-shrink-0">
                                      <img 
                                        src={content.imageUrl} 
                                        alt={content.title || "Content Image"} 
                                        className="rounded-md w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = "https://placehold.co/400x225?text=Image+Error";
                                        }}
                                      />
                                    </div>
                                  )}
                                  {(content.contentType === "video" || content.contentType === "video-text") && content.videoUrl && (
                                    <div className="w-20 h-20 flex-shrink-0 relative bg-black rounded-md overflow-hidden">
                                      <video 
                                        src={content.videoUrl} 
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                                        <Button variant="outline" size="sm" className="h-7 w-7 rounded-full p-0 bg-white bg-opacity-70">
                                          <Play className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Publishing status for published content */}
                                {content.status === 'published' && content.socialPlatforms && 
                                 typeof content.socialPlatforms === 'object' && 
                                 Object.keys(content.socialPlatforms as Record<string, any>).length > 0 && (
                                  <div className="mt-2">
                                    <PublishingStatus contentId={content.id} className="mt-1" />
                                  </div>
                                )}
                                
                                {/* Enhanced scheduled post information */}
                                {content.status === 'scheduled' && content.scheduledAt && 
                                 content.socialPlatforms && 
                                 typeof content.socialPlatforms === 'object' && (
                                  <div className="mt-2">
                                    <ScheduledPostInfo 
                                      socialPlatforms={content.socialPlatforms as Record<string, any>} 
                                      scheduledAt={content.scheduledAt}
                                      className="mt-1" 
                                    />
                                  </div>
                                )}
                                
                                {/* Dates */}
                                <div className="mt-2 pt-1.5 border-t text-xs text-muted-foreground flex flex-wrap gap-x-3">
                                  {content.publishedAt && (
                                    <span>Опубл.: {formatDate(content.publishedAt)}</span>
                                  )}
                                  {content.scheduledAt && !content.publishedAt && content.status !== 'scheduled' && (
                                    <span>План: {formatDate(content.scheduledAt)}</span>
                                  )}
                                  {!content.publishedAt && !content.scheduledAt && (
                                    <span>Создано: {formatDate(content.createdAt || new Date())}</span>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Диалог создания контента */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создание нового контента</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Название контента</Label>
              <Input
                id="title"
                placeholder="Введите название контента"
                value={newContent.title}
                onChange={(e) => setNewContent({...newContent, title: e.target.value})}
                className="mb-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contentType">Тип контента</Label>
              <Select
                value={newContent.contentType}
                onValueChange={(value) => setNewContent({...newContent, contentType: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип контента" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Только текст</SelectItem>
                  <SelectItem value="text-image">Текст с изображением</SelectItem>
                  <SelectItem value="video">Видео</SelectItem>
                  <SelectItem value="video-text">Видео с текстом</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Контент</Label>
              <div className="max-h-[200px] overflow-y-auto">
                <RichTextEditor
                  content={newContent.content || ''}
                  onChange={(html: string) => setNewContent({...newContent, content: html})}
                  minHeight="150px"
                  className="tiptap"
                />
              </div>
            </div>
            {(newContent.contentType === "text-image") && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="imageUrl">URL изображения</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => setIsImageGenerationDialogOpen(true)}
                  >
                    <Sparkles className="h-4 w-4" />
                    Сгенерировать изображение
                  </Button>
                </div>
                <Input
                  id="imageUrl"
                  placeholder="Введите URL изображения"
                  value={newContent.imageUrl}
                  onChange={(e) => setNewContent({...newContent, imageUrl: e.target.value})}
                />
              </div>
            )}
            {(newContent.contentType === "video" || newContent.contentType === "video-text") && (
              <div className="space-y-2">
                <Label htmlFor="videoUrl">URL видео</Label>
                <Input
                  id="videoUrl"
                  placeholder="Введите URL видео"
                  value={newContent.videoUrl}
                  onChange={(e) => setNewContent({...newContent, videoUrl: e.target.value})}
                />
              </div>
            )}
            
            {/* Список ключевых слов кампании */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Выберите ключевые слова</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/keywords", selectedCampaignId] });
                  }}
                  disabled={isLoadingKeywords}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingKeywords ? 'animate-spin' : ''}`} />
                  <span className="sr-only">Обновить</span>
                </Button>
              </div>
              <Card>
                <CardContent className="p-4">
                  {isLoadingKeywords ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : !campaignKeywords.length ? (
                    <p className="text-center text-muted-foreground py-2">
                      Нет ключевых слов для этой кампании
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      {campaignKeywords.map((keyword) => (
                        <div key={keyword.id || keyword.keyword} className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            id={`keyword-${keyword.id || keyword.keyword}`}
                            className="h-3 w-3 rounded border-gray-300"
                            checked={newContent.keywords.includes(keyword.keyword)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewContent({
                                  ...newContent,
                                  keywords: [...newContent.keywords, keyword.keyword]
                                });
                              } else {
                                setNewContent({
                                  ...newContent,
                                  keywords: newContent.keywords.filter(k => k !== keyword.keyword)
                                });
                              }
                            }}
                          />
                          <label 
                            htmlFor={`keyword-${keyword.id || keyword.keyword}`}
                            className="text-sm"
                          >
                            {keyword.keyword}
                            {keyword.trendScore && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({keyword.trendScore})
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Поле для ввода дополнительных ключевых слов */}
            <div className="space-y-2">
              <Label htmlFor="additionalKeywords">Дополнительные ключевые слова (введите и нажмите Enter)</Label>
              <Input
                id="additionalKeywords"
                placeholder="Например: здоровье, диета, питание"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    
                    const value = e.currentTarget.value.trim();
                    if (!value) return;
                    
                    // Не добавляем, если ключевое слово уже есть в списке
                    if (!newContent.keywords.includes(value)) {
                      setNewContent({
                        ...newContent,
                        keywords: [...newContent.keywords, value]
                      });
                    }
                    
                    // Очищаем поле ввода
                    e.currentTarget.value = "";
                  }
                }}
                onBlur={(e) => {
                  const value = e.currentTarget.value.trim();
                  if (!value) return;
                  
                  // Не добавляем, если ключевое слово уже есть в списке
                  if (!newContent.keywords.includes(value)) {
                    setNewContent({
                      ...newContent,
                      keywords: [...newContent.keywords, value]
                    });
                  }
                  
                  // Очищаем поле ввода
                  e.currentTarget.value = "";
                }}
              />
            </div>
            
            {/* Предпросмотр выбранных ключевых слов */}
            {newContent.keywords.length > 0 && (
              <div className="space-y-2">
                <Label>Выбранные ключевые слова:</Label>
                <div className="flex flex-wrap gap-2">
                  {newContent.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {keyword}
                      <button
                        type="button"
                        className="h-4 w-4 rounded-full"
                        onClick={() => {
                          setNewContent({
                            ...newContent,
                            keywords: newContent.keywords.filter((_, i) => i !== index)
                          });
                        }}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              type="button" 
              onClick={handleCreateContent}
              disabled={createContentMutation.isPending}
            >
              {createContentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования контента */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактирование контента</DialogTitle>
          </DialogHeader>
          {currentContent && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Название контента</Label>
                <Input
                  id="title"
                  placeholder="Введите название контента"
                  value={currentContent.title || ""}
                  onChange={(e) => {
                    const updatedContent = {...currentContent, title: e.target.value};
                    setCurrentContentSafe(updatedContent);
                  }}
                  className="mb-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contentType">Тип контента</Label>
                <Select
                  value={currentContent.contentType || 'text'}
                  onValueChange={(value) => {
                    const updatedContent = {...currentContent, contentType: value};
                    setCurrentContentSafe(updatedContent);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип контента" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Только текст</SelectItem>
                    <SelectItem value="text-image">Текст с изображением</SelectItem>
                    <SelectItem value="video">Видео</SelectItem>
                    <SelectItem value="video-text">Видео с текстом</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="content">Контент</Label>
                <div className="max-h-[200px] overflow-y-auto">
                  <RichTextEditor
                    content={currentContent.content || ''}
                    onChange={(html: string) => {
                      const updatedContent = {...currentContent, content: html};
                      setCurrentContentSafe(updatedContent);
                    }}
                    minHeight="150px"
                    className="tiptap"
                  />
                </div>
              </div>
              {(currentContent.contentType === "text-image") && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="imageUrl">URL изображения</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={() => {
                        // Открываем диалог генерации изображения для редактирования
                        setCurrentContentSafe(currentContent);
                        setIsImageGenerationDialogOpen(true);
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Сгенерировать изображение
                    </Button>
                  </div>
                  <Input
                    id="imageUrl"
                    placeholder="Введите URL изображения"
                    value={currentContent.imageUrl || ""}
                    onChange={(e) => {
                      const updatedContent = {...currentContent, imageUrl: e.target.value};
                      setCurrentContentSafe(updatedContent);
                    }}
                  />
                </div>
              )}
              {(currentContent.contentType === "video" || currentContent.contentType === "video-text") && (
                <div className="space-y-2">
                  <Label htmlFor="videoUrl">URL видео</Label>
                  <Input
                    id="videoUrl"
                    placeholder="Введите URL видео"
                    value={currentContent.videoUrl || ""}
                    onChange={(e) => {
                      const updatedContent = {...currentContent, videoUrl: e.target.value};
                      setCurrentContentSafe(updatedContent);
                    }}
                  />
                </div>
              )}
              
              {/* Список ключевых слов кампании */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Выберите ключевые слова</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/keywords", selectedCampaignId] });
                    }}
                    disabled={isLoadingKeywords}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingKeywords ? 'animate-spin' : ''}`} />
                    <span className="sr-only">Обновить</span>
                  </Button>
                </div>
                <Card>
                  <CardContent className="p-4">
                    {isLoadingKeywords ? (
                      <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : !campaignKeywords.length ? (
                      <p className="text-center text-muted-foreground py-2">
                        Нет ключевых слов для этой кампании
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1">
                        {campaignKeywords.map((keyword) => {
                          // Проверяем, выбрано ли это ключевое слово в нашем React-состоянии
                          const isSelected = selectedKeywordIds.has(keyword.id);
                          
                          return (
                            <div key={keyword.id || keyword.keyword} className="flex items-center space-x-1">
                              <input
                                type="checkbox"
                                id={`edit-keyword-${keyword.id || keyword.keyword}`}
                                className="h-3 w-3 rounded border-gray-300"
                                checked={isSelected}
                                data-testid={`keyword-checkbox-${keyword.id}`}
                                onChange={(e) => {
                                  console.log('Checkbox changed:', keyword.keyword, e.target.checked);
                                  
                                  // Создаем новую копию Set для обновления
                                  const newSelectedKeywordIds = new Set(selectedKeywordIds);
                                  
                                  if (e.target.checked) {
                                    // Добавляем ID ключевого слова в Set
                                    newSelectedKeywordIds.add(keyword.id);
                                    
                                    // Также обновляем currentContent для визуального отображения
                                    const updatedContent = {
                                      ...currentContent,
                                      keywords: [
                                        ...Array.isArray(currentContent.keywords) ? currentContent.keywords : [], 
                                        keyword.keyword
                                      ].filter((v, i, a) => a.indexOf(v) === i) // Удаляем дубликаты
                                    };
                                    setCurrentContent(updatedContent);
                                  } else {
                                    // Удаляем ID ключевого слова из Set
                                    newSelectedKeywordIds.delete(keyword.id);
                                    
                                    // Также обновляем currentContent для визуального отображения
                                    if (Array.isArray(currentContent.keywords)) {
                                      const updatedContent = {
                                        ...currentContent,
                                        keywords: currentContent.keywords.filter(k => 
                                          k.trim().toLowerCase() !== keyword.keyword.trim().toLowerCase()
                                        )
                                      };
                                      setCurrentContent(updatedContent);
                                    }
                                  }
                                  
                                  // Обновляем состояние выбранных ключевых слов
                                  console.log('Updated keyword IDs:', newSelectedKeywordIds);
                                  setSelectedKeywordIds(newSelectedKeywordIds);
                                }}
                              />
                              <label 
                                htmlFor={`edit-keyword-${keyword.id || keyword.keyword}`}
                                className="text-sm"
                              >
                                {keyword.keyword}
                                {keyword.trendScore && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({keyword.trendScore})
                                  </span>
                                )}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Поле для ввода дополнительных ключевых слов */}
              <div className="space-y-2">
                <Label htmlFor="editAdditionalKeywords">Дополнительные ключевые слова (введите и нажмите Enter)</Label>
                <Input
                  id="editAdditionalKeywords"
                  placeholder="Например: здоровье, диета, питание"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      
                      const value = e.currentTarget.value.trim();
                      if (!value) return;
                      
                      console.log('Adding new keyword:', value);
                      
                      // Гарантируем, что keywords всегда массив
                      const existingKeywords = Array.isArray(currentContent.keywords) 
                        ? [...currentContent.keywords] 
                        : [];
                      
                      // Не добавляем, если ключевое слово уже есть в списке
                      if (!existingKeywords.includes(value)) {
                        const updatedKeywords = [...existingKeywords, value];
                        console.log('New keywords array:', updatedKeywords);
                        
                        const updatedContent = {
                          ...currentContent,
                          keywords: updatedKeywords
                        };
                        setCurrentContentSafe(updatedContent);
                      }
                      
                      // Очищаем поле ввода
                      e.currentTarget.value = "";
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.currentTarget.value.trim();
                    if (!value) return;
                    
                    console.log('Adding keyword on blur:', value);
                    
                    // Гарантируем, что keywords всегда массив
                    const existingKeywords = Array.isArray(currentContent.keywords) 
                      ? [...currentContent.keywords] 
                      : [];
                    
                    // Не добавляем, если ключевое слово уже есть в списке
                    if (!existingKeywords.includes(value)) {
                      const updatedKeywords = [...existingKeywords, value];
                      console.log('New keywords array on blur:', updatedKeywords);
                      
                      const updatedContent = {
                        ...currentContent,
                        keywords: updatedKeywords
                      };
                      setCurrentContentSafe(updatedContent);
                    }
                    
                    // Очищаем поле ввода
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              
              {/* Предпросмотр выбранных ключевых слов */}
              {currentContent.keywords && currentContent.keywords.length > 0 && (
                <div className="space-y-2">
                  <Label>Выбранные ключевые слова:</Label>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(currentContent.keywords) ? (
                      currentContent.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {keyword}
                          <button
                            type="button"
                            className="h-4 w-4 rounded-full"
                            onClick={() => {
                              console.log('Removing keyword:', keyword);
                              // Гарантируем, что keywords всегда массив
                              const existingKeywords = Array.isArray(currentContent.keywords) 
                                ? [...currentContent.keywords] 
                                : [];
                              
                              // Удаляем ключевое слово по индексу
                              const updatedKeywords = existingKeywords.filter((_, i) => i !== index);
                              console.log('Keywords after removal:', updatedKeywords);
                              
                              const updatedContent = {
                                ...currentContent,
                                keywords: updatedKeywords
                              };
                              setCurrentContentSafe(updatedContent);
                            }}
                          >
                            ×
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <div>Нет ключевых слов</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              type="button" 
              onClick={handleUpdateContent}
              disabled={updateContentMutation.isPending}
            >
              {updateContentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог планирования публикации */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Планирование публикации</DialogTitle>
          </DialogHeader>
          {currentContent && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="scheduleDate">Дата и время публикации</Label>
                <Input
                  id="scheduleDate"
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Платформы для публикации</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['instagram', 'telegram', 'vk', 'facebook'] as const).map(platform => {
                    const platformIcons: Record<string, string> = {
                      instagram: '📸',
                      telegram: '📱',
                      vk: '💬',
                      facebook: '👥'
                    };
                    
                    return (
                      <div 
                        key={platform} 
                        className={`flex items-center gap-2 p-2 border rounded-md cursor-pointer transition-all 
                          ${selectedPlatforms[platform] 
                            ? 'bg-primary/5 border-primary/30' 
                            : 'bg-muted/20 border-border hover:bg-muted/30'
                          }`}
                        onClick={() => {
                          setSelectedPlatforms(prev => ({
                            ...prev,
                            [platform]: !prev[platform]
                          }));
                        }}
                      >
                        <Checkbox 
                          id={`platform-${platform}`} 
                          checked={selectedPlatforms[platform]} 
                          onCheckedChange={(checked) => 
                            setSelectedPlatforms(prev => ({
                              ...prev,
                              [platform]: !!checked
                            }))
                          }
                          className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        />
                        <Label 
                          htmlFor={`platform-${platform}`}
                          className="capitalize cursor-pointer font-medium flex items-center gap-1.5 w-full"
                        >
                          <span className="text-lg">{platformIcons[platform]}</span>
                          <span>{platform}</span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
                
                {/* Summary of selected platforms */}
                <div className="bg-muted/30 p-3 rounded-md mt-2">
                  <h4 className="text-sm font-medium mb-1">Выбрано платформ: {Object.values(selectedPlatforms).filter(Boolean).length}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(selectedPlatforms)
                      .filter(([_, isSelected]) => isSelected)
                      .map(([platform]) => (
                        <Badge key={platform} variant="outline" className="capitalize">
                          {platform}
                        </Badge>
                      ))
                    }
                    {!Object.values(selectedPlatforms).some(Boolean) && (
                      <p className="text-xs text-muted-foreground">Выберите хотя бы одну платформу для публикации</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsScheduleDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              type="button" 
              onClick={handleScheduleContent}
              disabled={
                scheduleContentMutation.isPending || 
                !scheduleDate || 
                !Object.values(selectedPlatforms).some(Boolean)
              }
            >
              {scheduleContentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Запланировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог генерации контента через AI */}
      {isGenerateDialogOpen && (
        <ContentGenerationDialog
          campaignId={selectedCampaignId || ''}
          keywords={campaignKeywords}
          onClose={() => {
            setIsGenerateDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', selectedCampaignId] });
          }}
        />
      )}

      {/* Диалог адаптации контента для социальных сетей */}
      {isAdaptDialogOpen && currentContent && (
        <SocialContentAdaptationDialog
          contentId={currentContent.id}
          originalContent={currentContent.content}
          onClose={() => {
            setIsAdaptDialogOpen(false);
            // Используем null, так как это явное обнуление, а не обновление содержимого
            setCurrentContent(null);
            queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', selectedCampaignId] });
          }}
        />
      )}
      
      {/* Диалог генерации изображений */}
      <Dialog open={isImageGenerationDialogOpen} onOpenChange={setIsImageGenerationDialogOpen}>
        <ImageGenerationDialog 
          campaignId={selectedCampaignId}
          contentId={currentContent?.id} // Передаем ID контента, если редактируем
          // Корректно передаем контент в зависимости от режима (редактирование или создание)
          initialContent={currentContent ? currentContent.content : newContent.content}
          // Передаем промт только если мы редактируем существующий контент, иначе пустая строка
          initialPrompt={currentContent ? (currentContent.prompt || "") : ""}
          onImageGenerated={(imageUrl, promptText) => {
            console.log("Изображение успешно сгенерировано:", imageUrl);
            console.log("Промт использованный для генерации:", promptText?.substring(0, 100) + "...");
            
            // Проверяем, находимся ли мы в режиме редактирования или создания
            if (currentContent) {
              // Обновляем URL изображения и промт в форме редактирования
              const updatedContent = {
                ...currentContent, 
                imageUrl,
                // Сохраняем промт только если он был передан
                ...(promptText ? { prompt: promptText } : {})
              };
              setCurrentContentSafe(updatedContent);
            } else {
              // Обновляем URL изображения и промт в форме создания контента
              setNewContent({
                ...newContent,
                imageUrl,
                // Сохраняем промт только если он был передан
                ...(promptText ? { prompt: promptText } : {})
              });
            }
            // Закрываем диалог после выбора изображения
            setIsImageGenerationDialogOpen(false);
          }}
          onClose={() => setIsImageGenerationDialogOpen(false)}
        />
      </Dialog>

      {/* Диалог генерации контент-плана */}
      <Dialog open={isContentPlanDialogOpen} onOpenChange={setIsContentPlanDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          {selectedCampaignId && (
            <ContentPlanGenerator
              isOpen={isContentPlanDialogOpen}
              onClose={() => setIsContentPlanDialogOpen(false)}
              campaignId={selectedCampaignId}
              onPlanGenerated={(contentItems, closeDialog) => {
                console.log("Сгенерирован контент-план:", contentItems);
                
                // Последовательно сохраняем каждый элемент контент-плана
                const saveContentPromises = contentItems.map(item => {
                  // Нормализуем структуру данных для API
                  const contentData = {
                    campaignId: selectedCampaignId,
                    title: item.title || "Без названия",
                    content: item.content || item.text || "",
                    contentType: item.contentType || item.type || "text",
                    scheduledAt: item.scheduledAt || item.scheduled_at || null,
                    hashtags: item.hashtags || [],
                    keywords: item.keywords || [],
                    imageUrl: item.imageUrl || item.image_url || null,
                    videoUrl: item.videoUrl || item.video_url || null,
                    prompt: item.prompt || "", // Добавляем поле промта для генерации изображений
                    status: 'draft'
                  };
                  
                  // Отправляем запрос на сохранение через API
                  return apiRequest('/api/campaign-content', {
                    method: 'POST',
                    data: contentData
                  }).catch(error => {
                    console.error('Ошибка при сохранении элемента контент-плана:', error);
                    return null; // Возвращаем null чтобы не прерывать Promise.all
                  });
                });
                
                // Ожидаем сохранение всех элементов
                Promise.all(saveContentPromises)
                  .then(results => {
                    const successCount = results.filter(Boolean).length;
                    console.log(`Успешно сохранено ${successCount} из ${contentItems.length} элементов`);
                    
                    // Обновляем список контента
                    return queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
                  })
                  .then(() => {
                    toast({
                      description: "Контент-план успешно создан и сохранен",
                    });
                    // Закрываем диалог только если closeDialog установлен в true
                    if (closeDialog) {
                      setIsContentPlanDialogOpen(false);
                    }
                  })
                  .catch(error => {
                    console.error('Ошибка при сохранении контент-плана:', error);
                    toast({
                      variant: 'destructive',
                      title: 'Ошибка',
                      description: 'Не удалось сохранить контент-план'
                    });
                  });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог просмотра контента */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewContent?.title || "Просмотр контента"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Тип контента */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              {previewContent?.contentType === "text" && <FileText size={16} />}
              {previewContent?.contentType === "text-image" && <ImageIcon size={16} />}
              {previewContent?.contentType === "video" && <Video size={16} />}
              {previewContent?.contentType === "video-text" && <Video size={16} />}
              <span>
                {previewContent?.contentType === "text" && "Текстовый контент"}
                {previewContent?.contentType === "text-image" && "Контент с изображением"}
                {previewContent?.contentType === "video" && "Видео контент"}
                {previewContent?.contentType === "video-text" && "Видео с текстом"}
              </span>
            </div>

            {/* Основной контент */}
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: previewContent?.content?.startsWith('<') 
                    ? previewContent?.content 
                    : processMarkdownSyntax(previewContent?.content || "") 
                }}
              />
            </div>

            {/* Медиа-контент */}
            {previewContent?.contentType === "text-image" && previewContent.imageUrl && (
              <div className="mt-4">
                <img
                  src={previewContent.imageUrl}
                  alt={previewContent.title || "Content Image"}
                  className="rounded-md max-h-[400px] max-w-full object-contain mx-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/800x400?text=Image+Error";
                  }}
                />
              </div>
            )}
            
            {(previewContent?.contentType === "video" || previewContent?.contentType === "video-text") && previewContent.videoUrl && (
              <div className="mt-4">
                <video
                  src={previewContent.videoUrl}
                  controls
                  className="rounded-md max-h-[400px] max-w-full mx-auto"
                />
              </div>
            )}

            {/* Ключевые слова */}
            {previewContent?.keywords && Array.isArray(previewContent.keywords) && previewContent.keywords.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Ключевые слова:</h4>
                <div className="flex flex-wrap gap-2">
                  {previewContent.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Информация о публикации */}
            <div className="mt-4 pt-4 border-t flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {previewContent?.publishedAt && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  <span>Опубликовано: {format(new Date(previewContent.publishedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
                </div>
              )}
              {previewContent?.scheduledAt && !previewContent?.publishedAt && (
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>Запланировано: {format(new Date(previewContent.scheduledAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
                </div>
              )}
              {previewContent?.createdAt && (
                <div className="flex items-center gap-1">
                  <CalendarDays size={14} />
                  <span>Создано: {format(new Date(previewContent.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsPreviewOpen(false)}
            >
              Закрыть
            </Button>
            {previewContent && (
              <Button 
                onClick={() => {
                  setCurrentContentSafe(previewContent);
                  setIsEditDialogOpen(true);
                  setIsPreviewOpen(false);
                }}
              >
                Редактировать
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}