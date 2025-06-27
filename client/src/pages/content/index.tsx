import { useState, useEffect, useRef, createRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Plus, Pencil, Calendar, Send, SendHorizontal, Trash2, FileText, 
  ImageIcon, Video, FilePlus2, CheckCircle2, Clock, RefreshCw, Play,
  Wand2, Share, Sparkles, CalendarDays, ChevronDown, ChevronRight,
  CalendarIcon, XCircle, Filter, Ban, CheckCircle, Upload, AlertCircle, Layers
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { PublishingStatus } from "@/components/PublishingStatus";
import { ScheduledPostInfo } from "@/components/ScheduledPostInfo";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import ContentTypeDialog from "@/components/ContentTypeDialog";
import { InstagramStoriesPreview } from "@/components/InstagramStoriesPreview";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import type { Campaign, CampaignContent } from "@shared/schema";
import axios from "axios";
import { formatDistanceToNow, format, isAfter, isBefore, parseISO, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { ContentGenerationDialog } from "@/components/ContentGenerationDialog";
import { SocialContentAdaptationDialog } from "@/components/SocialContentAdaptationDialog";
import { ImageGenerationDialog } from "@/components/ImageGenerationDialog";
import { ContentPlanGenerator } from "@/components/ContentPlanGenerator";
import { useCampaignStore } from "@/lib/campaignStore";
import RichTextEditor from "@/components/RichTextEditor";
import { TextareaWithResize } from "@/components/TextareaWithResize";
import SocialMediaFilter from "@/components/SocialMediaFilter";
import SocialMediaIcon from "@/components/SocialMediaIcon";
import PlatformSelector from "@/components/PlatformSelector";
import { ImageUploader } from "@/components/ImageUploader";
import { AdditionalImagesUploader } from "@/components/AdditionalImagesUploader";
import { VideoUploader } from "@/components/VideoUploader";
import { AdditionalVideosUploader } from "@/components/AdditionalVideosUploader";
import { AdditionalMediaUploader } from "@/components/AdditionalMediaUploader";
import CreationTimeDisplay from "@/components/CreationTimeDisplay";
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
  const [location, navigate] = useLocation();
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
  const [isContentTypeDialogOpen, setIsContentTypeDialogOpen] = useState(false);
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
          processedKeywords = content.keywords.map(k => {
            // Проверяем, является ли k объектом с полем keyword
            if (k && typeof k === 'object' && 'keyword' in k) {
              return k.keyword;
            }
            // Если это простой объект без специфической структуры
            if (k && typeof k === 'object') {

              return JSON.stringify(k);
            }
            // Если это строка - используем как есть
            return typeof k === 'string' ? k : String(k);
          });
        } else if (typeof content.keywords === 'string') {
          try {
            // Пытаемся разобрать JSON строку
            const parsed = JSON.parse(content.keywords);
            if (Array.isArray(parsed)) {
              processedKeywords = parsed.map(k => {
                if (k && typeof k === 'object' && 'keyword' in k) {
                  return k.keyword;
                }
                return typeof k === 'string' ? k : String(k);
              });
            } else {
              processedKeywords = [content.keywords];
            }
          } catch (e) {
            // Если не JSON, просто используем как строку
            processedKeywords = [content.keywords];
          }
        } else if (content.keywords !== null) {
          // Для всех других случаев

          if (typeof content.keywords === 'object') {
            // Пытаемся извлечь информацию из объекта
            const extractedKeywords = Object.values(content.keywords)
              .filter(v => typeof v === 'string')
              .map(v => String(v));
            if (extractedKeywords.length > 0) {
              processedKeywords = extractedKeywords;
            } else {
              processedKeywords = [JSON.stringify(content.keywords)];
            }
          } else {
            processedKeywords = [String(content.keywords)];
          }
        }
      }
      
      const safeContent = {
        ...content,
        keywords: processedKeywords
      };
      

      setCurrentContent(safeContent);
      
      // Сбрасываем и заново устанавливаем выбранные ключевые слова
      const newSelectedKeywords = new Set<string>();
      
      // Добавляем ID из предопределенных ключевых слов
      if (Array.isArray(safeContent.keywords)) {

        
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
    additionalImages: [] as string[], // Массив URL-адресов дополнительных изображений
    videoUrl: "",
    videoThumbnail: "", // Обложка для видео (thumbnail)
    additionalVideos: [] as string[], // Массив URL-адресов дополнительных видео
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
  
  // Отслеживание предыдущих статусов контента для показа тостов при изменении
  const [previousStatuses, setPreviousStatuses] = useState<Record<string, string>>({});

  // Auto-uncheck Instagram when content has no images
  useEffect(() => {
    if (currentContent && isScheduleDialogOpen) {
      const hasImages = currentContent.imageUrl || 
        (currentContent.images && currentContent.images.length > 0) ||
        currentContent.contentType === 'text-image' ||
        currentContent.contentType === 'video';
      
      if (!hasImages && selectedPlatforms.instagram) {
        setSelectedPlatforms(prev => ({
          ...prev,
          instagram: false
        }));
      }
    }
  }, [currentContent?.id, currentContent?.imageUrl, currentContent?.images, currentContent?.contentType, isScheduleDialogOpen]);



  // Force refetch data when campaign changes
  useEffect(() => {
    if (selectedCampaignId) {
      console.log('Принудительная перезагрузка данных для кампании:', selectedCampaignId);
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", selectedCampaignId] });
    }
  }, [selectedCampaignId, queryClient]);

  // Track location changes to reload data when navigating to content page
  const [hasNavigated, setHasNavigated] = useState(false);

  // Force refetch data when navigating to content page
  useEffect(() => {
    if (location === '/content' && selectedCampaignId) {
      console.log('Переход на страницу контента, принудительная загрузка данных');
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", selectedCampaignId] });
      // Принудительная перезагрузка данных
      queryClient.refetchQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
      queryClient.refetchQueries({ queryKey: ["/api/keywords", selectedCampaignId] });
      setHasNavigated(true);
    }
  }, [location, selectedCampaignId, queryClient]);

  // Also force reload when component first mounts
  useEffect(() => {
    if (!hasNavigated && selectedCampaignId) {
      console.log('Компонент контента смонтирован, принудительная загрузка данных');
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", selectedCampaignId] });
      queryClient.refetchQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
      queryClient.refetchQueries({ queryKey: ["/api/keywords", selectedCampaignId] });
    }
  }, [selectedCampaignId, hasNavigated, queryClient]);

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
  const { data: campaignContent = [], isLoading: isLoadingContent, isFetching: isFetchingContent } = useQuery<CampaignContent[]>({
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
    enabled: !!selectedCampaignId,
    refetchOnMount: true,
    staleTime: 0, // Всегда считаем данные устаревшими и перезагружаем
    refetchInterval: 10000, // Автоматически обновлять данные каждые 10 секунд
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
    enabled: !!selectedCampaignId,
    refetchOnMount: true,
    staleTime: 0, // Всегда считаем данные устаревшими и перезагружаем
    refetchInterval: 10000 // Автоматически обновлять данные каждые 10 секунд
  });

  // Эффект для отслеживания изменений статуса контента и показа тостов
  useEffect(() => {
    if (!Array.isArray(campaignContent)) return;

    campaignContent.forEach((content: any) => {
      const contentId = content.id;
      const currentStatus = content.status;
      const previousStatus = previousStatuses[contentId];

      // Если статус изменился с любого на "published", показываем тост
      if (previousStatus && previousStatus !== 'published' && currentStatus === 'published') {
        console.log(`Контент ${contentId} изменил статус с "${previousStatus}" на "published"`);
        toast({
          title: "Контент опубликован",
          description: `"${content.title}" успешно опубликован во всех социальных сетях`,
        });
      }

      // Обновляем предыдущие статусы
      setPreviousStatuses(prev => ({
        ...prev,
        [contentId]: currentStatus
      }));
    });
  }, [campaignContent, previousStatuses, toast]);

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
            additionalImages: [],
            videoUrl: "",
            additionalVideos: [], // Сбрасываем дополнительные видео
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
      
      return await apiRequest(`/api/publish/update-content/${id}`, { 
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

      // Подробное логирование для отладки
      console.log("🚀 Подготовленные данные для планирования публикации:");
      console.log("ID контента:", id);
      console.log("Дата публикации:", scheduledAt);
      console.log("Выбранные платформы:", platforms);
      console.log("Данные socialPlatforms для сохранения:", JSON.stringify(socialPlatformsData, null, 2));

      const requestData = {
        scheduledAt,
        status: 'scheduled',
        socialPlatforms: socialPlatformsData // Всегда передаем объект, даже если он пустой
      };

      console.log("Финальный запрос:", JSON.stringify(requestData, null, 2));

      // Используем новый маршрут direct-schedule вместо patch к campaign-content
      return await apiRequest(`/api/direct-schedule/${id}`, { 
        method: 'POST',
        data: requestData
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
  
  // Мутация для немедленной публикации контента через новый API эндпоинт
  const publishContentMutation = useMutation({
    mutationFn: async ({ id, platforms }: { id: string, platforms?: {[key: string]: boolean} }) => {
      // Проверяем наличие необходимых параметров
      if (!id) {
        throw new Error('ID контента не указан');
      }
      
      // Если платформы не указаны, используем значения по умолчанию
      const platformsToPublish = platforms || {
        telegram: true,
        vk: true,
        instagram: false,
        facebook: false
      };
      
      console.log("🚀 Подготовленные данные для публикации через новый API:");
      console.log("ID контента:", id);
      console.log("Выбранные платформы:", platforms || {});
      
      // Вызываем новый API эндпоинт, который сразу публикует во все выбранные платформы
      // и сохраняет информацию о выбранных платформах в Directus
      const response = await fetch('/api/publish/now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          contentId: id,
          platforms: platforms || {} // используем переданные платформы или пустой объект
        })
      });
      
      // Проверяем статус ответа
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Ошибка публикации (${response.status})`);
      }
      
      // Получаем результат публикации
      const result = await response.json();
      console.log("✅ Результат публикации через новый API:", result);
      
      return result;
    },
    onSuccess: async (data, variables) => {
      console.log("Результат публикации:", data);
      
      // Обновляем данные в интерфейсе БЕЗ тоста
      // Тост покажется автоматически когда планировщик обновит статус на "published"
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] });
      
      console.log("Публикация отправлена в очередь. Тост появится когда все платформы будут опубликованы.");
    },
    onError: (error: Error) => {
      console.error("Ошибка публикации:", error);
      toast({
        title: "Ошибка при публикации",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Мутация для перемещения контента в черновики (отмена запланированной публикации)
  const moveToDraftMutation = useMutation({
    mutationFn: async (contentId: string) => {
      console.log(`Перемещение контента ${contentId} в черновики`);
      
      // Сначала получаем текущие данные контента
      const content = await apiRequest(`/api/campaign-content/${contentId}`, {
        method: 'GET'
      });
      
      if (!content || !content.data) {
        throw new Error('Не удалось получить данные контента');
      }
      
      console.log(`Получен контент для перемещения в черновики:`, content.data);
      
      // Используем API для обновления контента
      return await apiRequest(`/api/publish/update-content/${contentId}`, {
        method: 'PATCH',
        data: {
          status: 'draft',
          scheduled_at: null, // Важно: используем snake_case для имени поля, т.к. API ожидает такой формат
          // Очищаем информацию о публикации на платформах, но сохраняем структуру
          social_platforms: {} // Пустой объект вместо null, чтобы не потерять структуру
        }
      });
    },
    onSuccess: () => {
      // Обновляем данные в интерфейсе
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", selectedCampaignId] })
        .then(() => {
          toast({
            title: "Перемещено в черновики",
            description: "Публикация была успешно перемещена в черновики",
            variant: "default"
          });
        });
    },
    onError: (error: Error) => {
      console.error("Ошибка при перемещении в черновики:", error);
      toast({
        title: "Ошибка",
        description: `Не удалось переместить публикацию в черновики: ${error.message || 'Неизвестная ошибка'}`,
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

    // Подготавливаем дополнительные изображения включая thumbnail видео
    const additionalImages = [...(newContent.additionalImages || [])];
    if (newContent.videoThumbnail && !additionalImages.includes(newContent.videoThumbnail)) {
      additionalImages.unshift(newContent.videoThumbnail); // Thumbnail в начале списка
    }

    createContentMutation.mutate({
      campaign_id: selectedCampaignId,
      content_type: newContent.contentType,
      title: newContent.title,
      content: newContent.content,
      image_url: newContent.imageUrl,
      video_url: newContent.videoUrl,
      video_thumbnail: newContent.videoThumbnail,
      additional_images: additionalImages,
      keywords: newContent.keywords || [],
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
        }
      });
    }
    


    // Подготавливаем дополнительные изображения включая thumbnail видео
    const additionalImages = [...(currentContent.additionalImages || [])];
    if (currentContent.videoThumbnail && !additionalImages.includes(currentContent.videoThumbnail)) {
      additionalImages.unshift(currentContent.videoThumbnail); // Thumbnail в начале списка
    }

    // Создаем типизированный объект для обновления
    const updateData = {
      title: currentContent.title,
      content: currentContent.content,
      contentType: currentContent.contentType,
      imageUrl: currentContent.imageUrl,
      additionalImages: additionalImages,
      videoUrl: currentContent.videoUrl,
      videoThumbnail: currentContent.videoThumbnail,
      additionalVideos: currentContent.additionalVideos || [], // Добавляем поддержку дополнительных видео
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

    // Создаем отладочный вывод
    console.log("Планирование публикации:", {
      id: currentContent.id,
      scheduledAt: new Date(scheduleDate).toISOString(),
      platforms: selectedPlatforms
    });
    
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
      // Используем локальный часовой пояс пользователя для группировки
      const localDate = new Date(date);
      
      // Форматируем дату для использования в качестве ключа группы в формате YYYY-MM-DD
      const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      
      groups[dateStr].push(item);
    });
    
    return groups;
  };
  
  // Фильтрация контента по активной вкладке
  // Функция для форматирования даты для группировки (только день, месяц, год)
  const formatDateForGrouping = (date: Date | string): string => {
    // Если дата передана в формате ISO string (YYYY-MM-DD)
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Создаем дату из строки ISO, используя localeDate для правильного часового пояса
      const [year, month, day] = date.split('-').map(Number);
      // Месяцы в JS начинаются с 0, поэтому вычитаем 1 из месяца
      const localDate = new Date(year, month - 1, day);
      return localDate.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric' 
      });
    } else {
      // Для других форматов дат
      const localDate = new Date(date);
      return localDate.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric' 
      });
    }
  };

  // Функция для сброса фильтрации по датам
  const resetDateFilter = () => {
    setDateRange({
      from: undefined,
      to: undefined
    });
  };

  // Фильтрация и сортировка контента
  const filteredContent = Array.isArray(campaignContent) ? campaignContent
    .filter(content => {
      // Фильтр по статусу (вкладки)
      if (activeTab !== "all") {
        if (activeTab === "published") {
          // В табе "Опубликованные" показываем контент со статусом "published" и "partial"
          if (content.status !== "published" && content.status !== "partial") {
            return false;
          }
        } else if (content.status !== activeTab) {
          return false;
        }
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
    }) : [];
    
  // Группировка контента по дате
  const contentByDate: Record<string, CampaignContent[]> = {};
  
  filteredContent.forEach((content: CampaignContent) => {
    // Получаем дату в локальном часовом поясе пользователя
    const localDate = new Date(content.publishedAt || content.scheduledAt || content.createdAt || new Date());
    // Формируем строку даты в формате ISO YYYY-MM-DD для использования в качестве ключа
    const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    
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
      case "story":
        return <Layers className="h-4 w-4" />;
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
      case "partial":
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
      case "partial":
        return "secondary";
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
      case "partial":
        return "Частично";
      default:
        return "Черновик";
    }
  };

  // Получаем правильное время публикации из платформ или основного поля
  const getCorrectPublishedTime = (content: any) => {
    if (!content.socialPlatforms || typeof content.socialPlatforms !== 'object') {
      return content.publishedAt;
    }

    let latestTime = null;
    
    // Ищем самое позднее время публикации среди всех платформ
    for (const [platformName, platform] of Object.entries(content.socialPlatforms)) {
      if (platform && 
          typeof platform === 'object' && 
          'status' in platform && 
          'publishedAt' in platform && 
          platform.status === 'published' && 
          platform.publishedAt) {
        const publishedTime = new Date(platform.publishedAt);
        if (!latestTime || publishedTime > new Date(latestTime)) {
          latestTime = platform.publishedAt;
        }
      }
    }
    
    // Если найдено время в платформах, используем его, иначе основное поле
    return latestTime || content.publishedAt;
  };

  // Получаем правильное время создания контента
  const getCorrectCreatedTime = (content: any) => {
    // Для времени создания пока используем основное поле createdAt
    // В будущем можно добавить логику получения времени создания из других источников
    return content.createdAt;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Управление контентом</h1>
          <p className="text-muted-foreground mt-2">
            Создание, редактирование и публикация контента для социальных сетей
          </p>
          
          {/* Индикатор загрузки */}
          {(isLoadingContent || isFetchingContent) && (
            <div className="flex items-center gap-2 mt-3 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-md border border-blue-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isLoadingContent ? 'Загрузка контента...' : 'Обновление данных...'}</span>
            </div>
          )}
        </div>
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
            onClick={() => setIsContentTypeDialogOpen(true)} 
            disabled={!selectedCampaignId || selectedCampaignId === "loading" || selectedCampaignId === "empty"}
          >
            <Plus className="mr-2 h-4 w-4" />
            Создать контент
          </Button>
        </div>
      </div>

      {/* Используется глобальный выбор кампаний в верхней панели */}

      {/* Контент кампании */}
      {!selectedCampaignId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-muted-foreground mb-2">Выберите кампанию</h3>
              <p className="text-sm text-muted-foreground">
                Для управления контентом выберите кампанию в селекторе выше
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
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
                          {dateRange.from ? format(dateRange.from, "dd MMMM yyyy", {locale: ru}) : "..."}
                          {" – "}
                          {dateRange.to ? format(dateRange.to, "dd MMMM yyyy", {locale: ru}) : "..."}
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
                          onSelect={useCallback((range: any) => {
                            if (range?.from) {
                              setDateRange({
                                from: range.from,
                                to: range.to,
                              });
                            } else {
                              resetDateFilter();
                            }
                          }, [resetDateFilter])}
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
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Загружаем контент кампании...</p>
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
                          <span className="font-medium">{formatDateForGrouping(dateStr)}</span>
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
                                      variant="black" 
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
                                          variant="black" 
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
                                          variant="black" 
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
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-7 w-7 p-0 text-green-500 hover:text-green-600 hover:bg-green-50"
                                          title="Опубликовать сейчас"
                                          onClick={(e) => {
                                            e.stopPropagation(); // Предотвращаем открытие превью
                                            
                                            // Устанавливаем текущий контент и открываем диалог выбора платформ
                                            setCurrentContentSafe(content);
                                            // Сбрасываем выбранные платформы на дефолтные значения
                                            setSelectedPlatforms({
                                              instagram: false,
                                              telegram: true, // По умолчанию включаем Telegram
                                              vk: true,      // По умолчанию включаем VK
                                              facebook: false
                                            });
                                            setIsScheduleDialogOpen(true);
                                          }}
                                        >
                                          <SendHorizontal className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    )}
                                    
                                    {/* Кнопка "В черновики" для запланированного контента */}
                                    {content.status === "scheduled" && (
                                      <Button 
                                        variant="secondary" 
                                        size="sm"
                                        className="h-7 ml-1 text-xs"
                                        title="Переместить в черновики"
                                        onClick={(e) => {
                                          e.stopPropagation(); // Предотвращаем открытие превью
                                          moveToDraftMutation.mutate(content.id);
                                        }}
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                        В черновики
                                      </Button>
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
                                    <h3 className="text-base font-medium line-clamp-1">
                                      {typeof content.title === 'string' ? content.title : String(content.title || '')}
                                    </h3>
                                  </div>
                                )}
                                
                                {/* Content preview */}
                                <div className="flex gap-3">
                                  {/* Text content */}
                                  <div className="flex-1">
                                    {content.contentType === 'story' && content.metadata ? (
                                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-2">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Layers className="h-4 w-4 text-purple-600" />
                                          <span className="text-purple-800 font-medium text-xs">Instagram Stories</span>
                                        </div>
                                        {(() => {
                                          try {
                                            // Парсим метаданные Stories
                                            let metadata;
                                            if (typeof content.metadata === 'string') {
                                              metadata = JSON.parse(content.metadata);
                                            } else {
                                              metadata = content.metadata;
                                            }
                                            
                                            // Получаем данные Stories из content или metadata
                                            let storyData;
                                            if (typeof content.content === 'string' && content.content.startsWith('{')) {
                                              try {
                                                storyData = JSON.parse(content.content);
                                              } catch {
                                                storyData = metadata;
                                              }
                                            } else {
                                              storyData = metadata;
                                            }
                                            
                                            // Удален избыточный лог для уменьшения спама в консоли
                                            
                                            const slidesCount = storyData?.slides?.length || 0;
                                            return (
                                              <div className="text-xs text-purple-700">
                                                <div className="flex items-center gap-2">
                                                  <span>Слайдов: {slidesCount}</span>
                                                  <span className="text-purple-500">•</span>
                                                  <span>Формат: {metadata?.format || '9:16'}</span>
                                                </div>
                                              </div>
                                            );
                                          } catch (e) {
                                            return <span className="text-xs text-purple-600">Stories контент</span>;
                                          }
                                        })()}
                                      </div>
                                    ) : (
                                      <div className="max-h-14 overflow-hidden relative card-content mb-2">
                                        <div 
                                          className="prose prose-sm max-w-none text-xs"
                                          dangerouslySetInnerHTML={{ 
                                            __html: typeof content.content === 'string' 
                                              ? (content.content.startsWith('<') 
                                                ? content.content 
                                                : processMarkdownSyntax(content.content))
                                              : ''
                                          }}
                                        />
                                        <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white to-transparent dark:from-background"></div>
                                      </div>
                                    )}
                                    
                                    {/* Keywords */}
                                    {content.keywords && Array.isArray(content.keywords) && content.keywords.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {content.keywords.slice(0, 3).map((keyword, index) => (
                                          <Badge key={index} variant="outline" className="text-xs px-1.5 py-0 h-5">
                                            {typeof keyword === 'string' ? keyword : String(keyword || '')}
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
                                {((content.status === 'scheduled' && content.scheduledAt) || 
                                  (content.status === 'published' && content.publishedAt)) && 
                                 content.socialPlatforms && 
                                 typeof content.socialPlatforms === 'object' && (
                                  <ScheduledPostInfo 
                                    socialPlatforms={content.socialPlatforms as Record<string, any>} 
                                    scheduledAt={typeof content.scheduledAt === 'string' ? content.scheduledAt : content.scheduledAt?.toISOString() || null}
                                    publishedAt={typeof content.publishedAt === 'string' ? content.publishedAt : content.publishedAt?.toISOString() || null}
                                    compact={true}
                                  />
                                )}
                                
                                {/* Dates */}
                                <div className="mt-2 pt-1.5 border-t text-xs text-muted-foreground flex flex-wrap gap-x-3">
                                  {content.publishedAt && (
                                    <CreationTimeDisplay
                                      createdAt={content.publishedAt}
                                      label="Опубл.:"
                                      showIcon={false}
                                      iconType="check"
                                      className="text-xs"
                                      isFromPlatforms={false}
                                      isPublishedTime={true}
                                    />
                                  )}
                                  {content.scheduledAt && !content.publishedAt && content.status !== 'scheduled' && (
                                    <CreationTimeDisplay
                                      createdAt={content.scheduledAt}
                                      label="План:"
                                      showIcon={false}
                                      iconType="clock"
                                      className="text-xs"
                                    />
                                  )}
                                  {!content.publishedAt && !content.scheduledAt && (
                                    <CreationTimeDisplay
                                      createdAt={getCorrectCreatedTime(content) || new Date()}
                                      label="Создано:"
                                      showIcon={false}
                                      iconType="calendar"
                                      className="text-xs"
                                    />
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
                  <SelectItem value="story">Instagram Stories</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newContent.contentType !== "story" && (
              <div className="space-y-2">
                <Label htmlFor="content">Описание</Label>
                <div>
                  <RichTextEditor
                    value={newContent.content || ''}
                    onChange={(html: string) => setNewContent({...newContent, content: html})}
                    minHeight={150}
                    className="tiptap"
                    enableResize={true}
                    placeholder="Введите текст контента..."
                  />
                </div>
              </div>
            )}

            {newContent.contentType === "story" && (
              <div className="space-y-4">
                <div className="p-6 border-2 border-dashed border-purple-300 bg-purple-50 rounded-lg text-center">
                  <Layers className="mx-auto h-12 w-12 text-purple-400 mb-3" />
                  <h3 className="text-lg font-medium text-purple-900 mb-2">Instagram Stories</h3>
                  <p className="text-purple-600 mb-4">Создайте интерактивные Stories со слайдами, элементами и анимацией</p>
                  <Button 
                    onClick={() => {
                      // Сохраняем базовую информацию и переходим к редактору Stories
                      if (!newContent.title.trim()) {
                        toast({
                          title: "Ошибка",
                          description: "Введите название для Stories",
                          variant: "destructive"
                        });
                        return;
                      }
                      navigate(`/campaigns/${selectedCampaignId}/stories/new`);
                    }}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    Открыть редактор Stories
                  </Button>
                </div>
              </div>
            )}
            {(newContent.contentType === "text-image") && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="imageUrl">Основное изображение</Label>
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
                  <ImageUploader
                    id="imageUrl"
                    value={newContent.imageUrl}
                    onChange={(url) => setNewContent({...newContent, imageUrl: url})}
                    placeholder="Введите URL изображения"
                    forcePreview={true}
                  />
                </div>
                {/* Дополнительные изображения */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Дополнительные изображения</Label>
                  </div>
                  <AdditionalImagesUploader
                    images={newContent.additionalImages}
                    onChange={(images) => setNewContent({...newContent, additionalImages: images})}
                    label="Загрузите дополнительные изображения"
                    onGenerateImage={(index) => {
                      // Сохраняем индекс текущего изображения в локальном состоянии
                      localStorage.setItem('currentAdditionalImageIndex', String(index));
                      localStorage.setItem('additionalImageMode', 'create');
                      setIsImageGenerationDialogOpen(true);
                    }}
                  />
                </div>
              </div>
            )}
            {(newContent.contentType === "video" || newContent.contentType === "video-text") && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="videoUrl">URL видео</Label>
                  <VideoUploader
                    id="videoUrl"
                    value={newContent.videoUrl}
                    onChange={(url) => setNewContent({...newContent, videoUrl: url})}
                    placeholder="Введите URL видео или загрузите файл"
                    forcePreview={true}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="videoThumbnail">Обложка видео (рекомендуется для YouTube, Rutube)</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={() => {
                        localStorage.setItem('videoThumbnailMode', 'true');
                        setIsImageGenerationDialogOpen(true);
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Сгенерировать обложку
                    </Button>
                  </div>
                  <ImageUploader
                    id="videoThumbnail"
                    value={newContent.videoThumbnail}
                    onChange={(url) => setNewContent({...newContent, videoThumbnail: url})}
                    placeholder="Введите URL обложки или загрузите изображение"
                    forcePreview={true}
                  />
                </div>
              </div>
            )}
            
            {/* Дополнительные видео */}
            {(newContent.contentType === "video" || newContent.contentType === "video-text") && (
              <div className="space-y-2">
                <AdditionalVideosUploader
                  videos={newContent.additionalVideos}
                  onChange={(videos) => setNewContent({...newContent, additionalVideos: videos})}
                  label="Дополнительные видео"
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
                    <SelectItem value="story">Instagram Stories</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {currentContent.contentType !== "story" && (
                <div className="space-y-2">
                  <Label htmlFor="content">Описание</Label>
                  <div>
                    <RichTextEditor
                      value={currentContent.content || ''}
                      onChange={(html: string) => {
                        const updatedContent = {...currentContent, content: html};
                        setCurrentContentSafe(updatedContent);
                      }}
                      minHeight={150}
                      className="tiptap"
                      enableResize={true}
                      placeholder="Введите текст контента..."
                    />
                  </div>
                </div>
              )}

              {currentContent.contentType === "story" && (
                <div className="space-y-4">
                  <div className="p-6 border-2 border-dashed border-purple-300 bg-purple-50 rounded-lg text-center">
                    <Layers className="mx-auto h-12 w-12 text-purple-400 mb-3" />
                    <h3 className="text-lg font-medium text-purple-900 mb-2">Instagram Stories</h3>
                    
                    {(() => {
                      // Получаем данные Stories из content или metadata
                      let storyData;
                      if (typeof currentContent.content === 'string' && currentContent.content.startsWith('{')) {
                        try {
                          storyData = JSON.parse(currentContent.content);
                        } catch {
                          storyData = currentContent.metadata;
                        }
                      } else {
                        storyData = currentContent.metadata;
                      }
                      
                      const slidesCount = storyData?.slides?.length || 0;
                      
                      return slidesCount > 0 ? (
                        <div className="space-y-3">
                          <p className="text-purple-600">
                            Создано слайдов: {slidesCount}
                          </p>
                          <div className="flex gap-2 justify-center">
                            <Button 
                              onClick={() => {
                                navigate(`/stories/${currentContent.id}/edit`);
                              }}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              <Layers className="mr-2 h-4 w-4" />
                              Редактировать Stories
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-purple-600">Stories не созданы</p>
                          <Button 
                            onClick={() => {
                              navigate(`/campaigns/${selectedCampaignId}/stories/new`);
                            }}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Layers className="mr-2 h-4 w-4" />
                            Создать Stories
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              {(currentContent.contentType === "text-image") && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="imageUrl">Основное изображение</Label>
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
                    <ImageUploader
                      id="imageUrlEdit"
                      value={currentContent.imageUrl || ""}
                      onChange={(url) => {
                        const updatedContent = {...currentContent, imageUrl: url};
                        setCurrentContentSafe(updatedContent);
                      }}
                      placeholder="Введите URL изображения"
                      forcePreview={true}
                    />
                  </div>
                  
                  {/* Дополнительные изображения */}
                  <div className="space-y-2">
                    <AdditionalImagesUploader
                      images={currentContent.additionalImages || []}
                      onChange={(images) => setCurrentContentSafe({...currentContent, additionalImages: images})}
                      label="Дополнительные изображения"
                      onGenerateImage={(index) => {
                        // Сохраняем индекс текущего изображения в локальном состоянии
                        localStorage.setItem('currentAdditionalImageIndex', String(index));
                        localStorage.setItem('additionalImageMode', 'edit');
                        setIsImageGenerationDialogOpen(true);
                      }}
                    />
                  </div>
                </div>
              )}
              {(currentContent.contentType === "video" || currentContent.contentType === "video-text") && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="videoUrl">URL видео</Label>
                    <VideoUploader
                      id="videoUrl"
                      value={currentContent.videoUrl || ""}
                      onChange={(url) => {
                        const updatedContent = {...currentContent, videoUrl: url};
                        setCurrentContentSafe(updatedContent);
                      }}
                      placeholder="Введите URL видео или загрузите файл"
                      forcePreview={true}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="videoThumbnailEdit">Обложка видео (рекомендуется для YouTube, Rutube)</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => {
                          localStorage.setItem('videoThumbnailMode', 'true');
                          setCurrentContentSafe(currentContent);
                          setIsImageGenerationDialogOpen(true);
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                        Сгенерировать обложку
                      </Button>
                    </div>
                    <ImageUploader
                      id="videoThumbnailEdit"
                      value={currentContent.videoThumbnail || ""}
                      onChange={(url) => {
                        const updatedContent = {...currentContent, videoThumbnail: url};
                        setCurrentContentSafe(updatedContent);
                      }}
                      placeholder="Введите URL обложки или загрузите изображение"
                      forcePreview={true}
                    />
                  </div>
                </div>
              )}
              
              {/* Дополнительные видео - устаревший компонент */}
              {(currentContent.contentType === "video" || currentContent.contentType === "video-text") && (
                <div className="space-y-2">
                  <AdditionalVideosUploader
                    videos={currentContent.additionalVideos || []}
                    onChange={(videos) => setCurrentContentSafe({...currentContent, additionalVideos: videos})}
                    label="Дополнительные видео"
                  />
                </div>
              )}
              
              {/* Скрыли универсальное поле additional_media */}
              
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
              
              {/* Поле для ввода дополнительных тегов */}
              <div className="space-y-2">
                <Label htmlFor="editAdditionalKeywords">Дополнительные теги (введите и нажмите Enter)</Label>
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
              
              {/* Предпросмотр выбранных тегов */}
              {currentContent.keywords && currentContent.keywords.length > 0 && (
                <div className="space-y-2">
                  <Label>Выбранные теги:</Label>
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
                      <div>Нет тегов</div>
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
            <DialogTitle>Публикация в социальные сети</DialogTitle>
            <DialogDescription>
              Выберите платформы для публикации и укажите время или опубликуйте сразу
            </DialogDescription>
          </DialogHeader>
          {currentContent && (
            <div className="space-y-4 py-4">
              <Tabs defaultValue="now" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="now">Опубликовать сейчас</TabsTrigger>
                  <TabsTrigger value="schedule">Запланировать</TabsTrigger>
                </TabsList>
                <TabsContent value="schedule" className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="scheduleDate">Дата и время публикации</Label>
                    <Input
                      id="scheduleDate"
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-3">
                <Label>Платформы для публикации</Label>
                <PlatformSelector 
                  selectedPlatforms={{
                    instagram: selectedPlatforms.instagram || false,
                    telegram: selectedPlatforms.telegram || false,
                    vk: selectedPlatforms.vk || false,
                    facebook: selectedPlatforms.facebook || false
                  }}
                  onChange={(platform, isSelected) => {
                    setSelectedPlatforms(prev => ({
                      ...prev,
                      [platform]: isSelected
                    }));
                  }}
                  content={{
                    contentType: currentContent.contentType,
                    imageUrl: currentContent.imageUrl,
                    images: currentContent.images
                  }}
                />
                
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
          <DialogFooter className="gap-2 flex-col sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsScheduleDialogOpen(false)}
            >
              Отмена
            </Button>
            <div className="space-x-2">
              <Button 
                type="button" 
                variant="default" 
                onClick={async () => {
                  // Проверка на выбор хотя бы одной платформы
                  if (!Object.values(selectedPlatforms).some(Boolean)) {
                    toast({
                      description: "Выберите хотя бы одну платформу для публикации",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  try {
                    // Получаем выбранные платформы как массив строк для N8N API
                    const selectedPlatformList = Object.entries(selectedPlatforms)
                      .filter(([_, isSelected]) => isSelected)
                      .map(([platform]) => platform);
                    
                    const requestData = {
                      contentId: currentContent?.id,
                      platforms: selectedPlatformList
                    };
                    
                    console.log("Публикация контента - contentId:", currentContent?.id);
                    console.log("Публикация контента - platforms:", selectedPlatformList);
                    console.log("Публикация контента - полный объект:", requestData);
                    
                    // Вызываем API эндпоинт для публикации контента
                    const response = await apiRequest('/api/publish-content', {
                      method: 'POST',
                      data: requestData
                    });
                    
                    if (response.success) {
                      toast({
                        description: response.message || "Контент успешно отправлен на публикацию",
                        variant: "default"
                      });
                    } else {
                      toast({
                        description: response.error || "Ошибка при публикации контента",
                        variant: "destructive"
                      });
                    }
                  } catch (error: any) {
                    console.error("Ошибка публикации контента:", error);
                    toast({
                      description: error.message || "Ошибка при публикации контента",
                      variant: "destructive"
                    });
                  }
                  
                  setIsScheduleDialogOpen(false);
                }}
                disabled={
                  publishContentMutation.isPending || 
                  !Object.values(selectedPlatforms).some(Boolean)
                }
              >
                {publishContentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Опубликовать сразу
              </Button>
              <Button 
                type="button" 
                variant="secondary"
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог генерации контента через AI */}
      {isGenerateDialogOpen && (
        <ContentGenerationDialog
          campaignId={selectedCampaignId || ''}
          keywords={campaignKeywords.map(k => ({
            id: k.id,
            keyword: k.keyword,
            trendScore: k.trend_score || 0,
            campaignId: k.campaign_id
          }))}
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
          // Передаем промт в зависимости от режима (редактирование, создание или доп.изображение)
          initialPrompt={
            currentContent ? (currentContent.prompt || "") :
            newContent.prompt ? newContent.prompt : ""
          }
          onImageGenerated={(imageUrl, promptText) => {
            // Проверяем режим обложки видео
            const videoThumbnailMode = localStorage.getItem('videoThumbnailMode');
            const additionalImageMode = localStorage.getItem('additionalImageMode');
            const imageIndex = localStorage.getItem('currentAdditionalImageIndex');
            
            if (videoThumbnailMode === 'true') {
              // Режим генерации обложки видео
              if (currentContent) {
                // Для режима редактирования
                setCurrentContent({
                  ...currentContent,
                  videoThumbnail: imageUrl,
                  ...(promptText && !currentContent.prompt ? { prompt: promptText } : {})
                });
              } else {
                // Для режима создания
                setNewContent({
                  ...newContent,
                  videoThumbnail: imageUrl,
                  ...(promptText && !newContent.prompt ? { prompt: promptText } : {})
                });
              }
              
              // Очищаем флаг режима
              localStorage.removeItem('videoThumbnailMode');
              setIsImageGenerationDialogOpen(false);
              
            } else if (additionalImageMode) {
              // Если это режим дополнительного изображения
              const index = parseInt(imageIndex || '0', 10);
              
              if (additionalImageMode === 'create') {
                // Для режима создания
                const updatedImages = [...newContent.additionalImages];
                updatedImages[index] = imageUrl;
                setNewContent({
                  ...newContent,
                  additionalImages: updatedImages,
                  // Сохраняем промт только если он был передан и если это первая генерация
                  ...(promptText && !newContent.prompt ? { prompt: promptText } : {})
                });
              } else if (additionalImageMode === 'edit' && currentContent) {
                // Для режима редактирования
                const updatedImages = [...(currentContent.additionalImages || [])];
                updatedImages[index] = imageUrl;
                setCurrentContentSafe({
                  ...currentContent,
                  additionalImages: updatedImages,
                  // Сохраняем промт только если он был передан и если это первая генерация
                  ...(promptText && !currentContent.prompt ? { prompt: promptText } : {})
                });
              }
              
              // Очищаем localStorage после генерации
              localStorage.removeItem('additionalImageMode');
              localStorage.removeItem('currentAdditionalImageIndex');
            } else {
              // Обычный режим (основное изображение)
              if (currentContent) {
                // Для режима редактирования
                setCurrentContent({
                  ...currentContent,
                  imageUrl,
                  ...(promptText ? { prompt: promptText } : {})
                });
              } else {
                // Обновляем URL изображения и промт в форме создания контента
                setNewContent({
                  ...newContent,
                  imageUrl,
                  // Сохраняем промт только если он был передан
                  ...(promptText ? { prompt: promptText } : {})
                });
              }
              
              // Закрываем диалог только для обычного режима
              setIsImageGenerationDialogOpen(false);
            }
          }}
          onClose={() => {
            // Очищаем localStorage при закрытии диалога
            localStorage.removeItem('additionalImageMode');
            localStorage.removeItem('currentAdditionalImageIndex');
            localStorage.removeItem('videoThumbnailMode');
            setIsImageGenerationDialogOpen(false);
          }}
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
            {/* Stories Preview */}
            {previewContent?.contentType === 'story' && previewContent?.metadata ? (
              <div className="space-y-4">
                <InstagramStoriesPreview metadata={previewContent.metadata} />
              </div>
            ) : (
              <div>
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
                      __html: previewContent && typeof previewContent.content === 'string' 
                        ? (previewContent.content.startsWith('<') 
                          ? previewContent.content 
                          : processMarkdownSyntax(previewContent.content))
                        : ''
                    }}
                  />
                </div>
              </div>
            )}

            {previewContent?.contentType !== 'story' && previewContent?.contentType === "text-image" && previewContent?.imageUrl && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Основное изображение</h4>
                <img
                  src={previewContent.imageUrl}
                  alt={previewContent?.title || "Content Image"}
                  className="rounded-md max-h-[400px] max-w-full object-contain mx-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/800x400?text=Image+Error";
                  }}
                />
              </div>
            )}
            
            {previewContent?.contentType !== 'story' && previewContent?.contentType === "text-image" && 
             Array.isArray(previewContent?.additionalImages) && 
             previewContent.additionalImages.filter(url => url && url.trim() !== '').length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-2">Дополнительные изображения</h4>
                <div className="grid grid-cols-2 gap-4">
                  {previewContent.additionalImages.map((imageUrl, index) => (
                    imageUrl && imageUrl.trim() !== '' && (
                      <div key={index} className="relative border rounded-md overflow-hidden bg-muted/20 h-[300px]">
                        <img
                          src={imageUrl}
                          alt={`Дополнительное изображение ${index + 1}`}
                          className="rounded-md max-h-[300px] w-full h-full object-contain"
                          onError={(e) => {
                            console.error(`Ошибка загрузки изображения: ${imageUrl}`);
                            (e.target as HTMLImageElement).src = "https://placehold.co/400x300?text=Image+Error";
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                          {imageUrl}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
            
            {previewContent?.contentType !== 'story' && (previewContent?.contentType === "video" || previewContent?.contentType === "video-text") && previewContent?.videoUrl && (
              <div className="mt-4 space-y-4">
                <h4 className="text-sm font-medium">Видео</h4>
                <video
                  src={previewContent.videoUrl}
                  controls
                  className="rounded-md max-h-[400px] max-w-full mx-auto"
                />
                
                {previewContent.videoThumbnail && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Обложка видео</h4>
                    <img
                      src={previewContent.videoThumbnail}
                      alt="Обложка видео"
                      className="rounded-md max-h-[300px] max-w-full object-contain mx-auto border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://placehold.co/800x400?text=Обложка+не+найдена";
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Теги */}
            {previewContent?.contentType !== 'story' && previewContent?.keywords && Array.isArray(previewContent.keywords) && previewContent.keywords.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Теги:</h4>
                <div className="flex flex-wrap gap-2">
                  {previewContent.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Информация о публикации - расширенная */}
            {previewContent?.socialPlatforms && 
             typeof previewContent.socialPlatforms === 'object' &&
             ((previewContent?.status === 'scheduled' && previewContent?.scheduledAt) || 
              (previewContent?.status === 'published' && previewContent?.publishedAt) ||
              (previewContent?.status === 'partial')) ? (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Информация о публикации</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Платформы:</h5>
                    <div className="space-y-2">
                      {Object.entries(previewContent.socialPlatforms as Record<string, any>).map(([platform, platformData]) => {
                        // Show all platforms that exist in the data
                        if (!platformData) return null;
                        
                        const platformNames: Record<string, string> = {
                          vk: 'ВКонтакте',
                          telegram: 'Telegram',
                          instagram: 'Instagram',
                          facebook: 'Facebook'
                        };
                        
                        // Показываем все платформы которые имеют данные
                        const isPublished = platformData.status === 'published' || platformData.postUrl;
                        const isFailed = platformData.status === 'failed' || platformData.error;
                        const isScheduled = platformData.status === 'scheduled' || platformData.scheduledAt;
                        
                        // Показываем платформы с любым статусом
                        if (!isPublished && !isFailed && !isScheduled && !platformData.selected) return null;
                        
                        const bgColor = isPublished ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300';
                        const textColor = isPublished ? 'text-green-800' : 'text-red-800';
                        const iconColor = isPublished ? 'text-green-600' : 'text-red-600';
                        const statusText = isPublished ? 'Опубликовано' : 'Ошибка';
                        const Icon = isPublished ? CheckCircle2 : AlertCircle;
                        
                        const content = (
                          <div className={`flex items-center justify-between p-3 rounded-lg ${bgColor}`}>
                            <div className="flex items-center gap-2">
                              <Icon className={`h-5 w-5 ${iconColor}`} />
                              <span className={`text-sm font-medium ${textColor}`}>{platformNames[platform] || platform}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${isPublished ? 'text-green-700' : 'text-red-700'}`}>
                                {statusText} {isPublished && platformData.publishedAt && (() => {
                                  // Время publishedAt уже корректно в БД, не добавляем смещение
                                  const date = new Date(platformData.publishedAt);
                                  return date.toLocaleString('ru-RU', {
                                    day: '2-digit',
                                    month: 'long', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                })()}
                              </span>
                              <Icon className={`h-4 w-4 ${iconColor}`} />
                            </div>
                          </div>
                        );

                        // Если есть ссылка на пост, делаем блок кликабельным
                        if (platformData.postUrl) {
                          return (
                            <a
                              key={platform}
                              href={platformData.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block hover:opacity-90 transition-opacity"
                            >
                              {content}
                            </a>
                          );
                        }

                        return <div key={platform}>{content}</div>;
                      })}
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {previewContent?.publishedAt && (() => {
                  // Для общего времени публикации используем published_at как есть (БЕЗ добавления 3 часов)
                  // Это время уже сохранено в правильном формате из N8N
                  return (
                    <CreationTimeDisplay 
                      createdAt={previewContent.publishedAt}
                      label="Опубликовано:"
                      showIcon={true}
                      iconType="check"
                      className="flex items-center gap-1"
                      isFromPlatforms={false}
                      isPublishedTime={true}
                    />
                  );
                })()}
                {previewContent?.scheduledAt && !previewContent?.publishedAt && (
                  <CreationTimeDisplay 
                    createdAt={previewContent.scheduledAt}
                    label="Запланировано:"
                    showIcon={true}
                    iconType="clock"
                    className="flex items-center gap-1"
                  />
                )}
                {previewContent?.createdAt && (
                  <CreationTimeDisplay 
                    createdAt={previewContent.createdAt}
                    label="Создано:"
                    showIcon={true}
                    iconType="calendar"
                    className="flex items-center gap-1"
                  />
                )}
              </div>
            )}
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

      {/* Диалог выбора типа контента */}
      <ContentTypeDialog
        isOpen={isContentTypeDialogOpen}
        onClose={() => setIsContentTypeDialogOpen(false)}
        onSelectType={(type) => {
          if (type === 'story') {
            // Очищаем состояние Stories store перед созданием новой Stories
            // Это гарантирует чистое состояние при создании через диалог
            navigate(`/campaigns/${selectedCampaignId}/stories/new`);
          } else {
            setIsCreateDialogOpen(true);
          }
        }}
      />
    </div>
  );
}