import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordSelector } from "@/components/KeywordSelector";  
import PublicationCalendar from "@/components/PublicationCalendar";
import { directusApi } from "@/lib/directus";
import { api } from "@/lib/api";
import { Loader2, Search, Wand2, Check, CheckCircle, Circle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TrendsList } from "@/components/TrendsList";
import { SocialMediaSettings } from "@/components/SocialMediaSettings";
import { TrendAnalysisSettings } from "@/components/TrendAnalysisSettings";
import { ContentGenerationPanel } from "@/components/ContentGenerationPanel";
import { ContentGenerationDialog } from "@/components/ContentGenerationDialog";
import { TrendContentGenerator } from "@/components/TrendContentGenerator";
import { BusinessQuestionnaireForm } from "@/components/BusinessQuestionnaireForm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useCampaignStore } from "@/lib/campaignStore";

interface SuggestedKeyword {
  keyword: string;
  isSelected: boolean;
}



export default function CampaignDetails() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSearchingKeywords, setIsSearchingKeywords] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<SuggestedKeyword[]>([]);
  const [showContentGenerationDialog, setShowContentGenerationDialog] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [urlSaveStatus, setUrlSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Получаем доступ к глобальному хранилищу кампаний
  const { setSelectedCampaign } = useCampaignStore();
  
  // Для хранения выбранных трендов - изменяем тип на конкретный с правильными полями для улучшения типизации
  const [selectedTrends, setSelectedTrends] = useState<Array<{
    id: string;
    title: string;
    sourceId?: string;
    source_id?: string;
    campaignId?: string;
    campaign_id?: string;
    [key: string]: any;  // Для поддержки других полей
  }>>([]);
  
  // Используем useCallback для стабилизации функции обратного вызова
  const handleSelectTrends = useCallback((trends: any[]) => {
    if (Array.isArray(trends)) {

      setSelectedTrends(trends);
    } else {
      console.warn("handleSelectTrends received non-array:", trends);
      setSelectedTrends([]);
    }
  }, []);

  // Запрос для получения списка ключевых слов
  const { data: keywordList } = useQuery({
    queryKey: ["/api/keywords", id],
    queryFn: async () => {

      const response = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: { _eq: id }
          }
        }
      });
      return response.data?.data || [];
    },
    // Отключаем кеширование, чтобы всегда получать свежие данные при переходе на страницу
    staleTime: 0, // Запрос сразу считается устаревшим
    refetchOnMount: true, // Обновляем данные при монтировании компонента
    refetchOnWindowFocus: true // Обновляем данные при фокусе на окне
  });

  // Запрос для получения трендов кампании
  const { data: campaignTrends } = useQuery({
    queryKey: ["campaign-trends", id],
    queryFn: async () => {
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('user_token') || localStorage.getItem('token');

        
        const response = await fetch(`/api/campaign-trends?campaignId=${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        

        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Trends API: Ошибка ответа:', errorText);
          return [];
        }
        
        const data = await response.json();

        return data.data || [];
      } catch (error) {
        console.error("Ошибка при загрузке трендов:", error);
        return [];
      }
    },
    enabled: !!id
  });
  
  // Запрос контента кампании для календаря публикаций
  const { data: allCampaignContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ['/api/campaign-content', id],
    queryFn: async () => {
      if (!id) return [];
      
      try {

        const token = localStorage.getItem("auth_token");
        
        const response = await fetch(`/api/campaign-content?campaignId=${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные о контенте');
        }
        
        const responseData = await response.json();

        return responseData.data || [];
      } catch (error) {
        console.error('Ошибка при загрузке контента:', error);
        return [];
      }
    },
    enabled: !!id,
    refetchOnMount: true,
    staleTime: 0
  });

  // Фильтруем только действительно запланированный контент для календаря
  const campaignContent = useMemo(() => {
    if (!allCampaignContent || !Array.isArray(allCampaignContent)) return [];
    
    return allCampaignContent.filter(content => {
      // Только статус 'scheduled'
      if (content.status !== 'scheduled') return false;
      
      // Дополнительная проверка: исключаем контент с опубликованными платформами
      if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
        const platforms = Object.values(content.socialPlatforms);
        const hasPublishedPlatforms = platforms.some(platform => platform?.status === 'published');
        
        // Если есть опубликованные платформы - не показываем в календаре запланированных
        if (hasPublishedPlatforms) {
          return false;
        }
      }
      
      return true;
    });
  }, [allCampaignContent]);

  // Запрос бизнес-анкеты для отображения статуса завершенности
  const { data: businessQuestionnaire } = useQuery({
    queryKey: ['business-questionnaire', id],
    queryFn: async () => {
      if (!id) return null;
      
      try {
        const token = localStorage.getItem("auth_token");
        const response = await fetch(`/api/campaigns/${id}/questionnaire`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          return null;
        }
        
        const responseData = await response.json();
        return responseData.data || null;
      } catch (error) {
        console.error('Ошибка при загрузке анкеты:', error);
        return null;
      }
    },
    enabled: !!id,
    staleTime: 0
  });

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["/api/campaigns", id],
    queryFn: async () => {
      try {

        const token = localStorage.getItem("auth_token");

        
        const response = await directusApi.get(`/items/user_campaigns/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}` 
          }
        });
        

        return response.data?.data;
      } catch (err: any) {
        console.error("Error fetching campaign:", err);
        
        // Извлекаем более подробную информацию об ошибке
        let errorMessage = "Кампания не найдена или у вас нет прав доступа к ней";
        
        if (err.response) {
          console.error("Directus API error response:", {
            status: err.response.status,
            statusText: err.response.statusText,
            data: err.response.data
          });
          
          // Добавляем код ошибки для диагностики
          errorMessage += ` (Код: ${err.response.status})`;
          
          if (err.response.data?.errors?.[0]?.message) {
            errorMessage += `: ${err.response.data.errors[0].message}`;
          }
        }
        
        throw new Error(errorMessage);
      }
    },
    // Устанавливаем настройки для обновления данных при каждом монтировании компонента
    staleTime: 0, // Запрос сразу считается устаревшим
    refetchOnMount: true, // Обновляем данные при монтировании компонента
    refetchOnWindowFocus: true, // Обновляем данные при фокусе на окне
    retry: false,
    onSuccess: (data) => {
      // Устанавливаем загруженную кампанию как активную в глобальном хранилище
      if (data && data.id && data.name) {

        setSelectedCampaign(data.id, data.name);
      }
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка доступа к кампании",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const { mutate: updateCampaign } = useMutation({
    mutationFn: async (values: { name?: string; link?: string }) => {
      if (values.link) {
        setUrlSaveStatus('saving');
      }
      await directusApi.patch(`/items/user_campaigns/${id}`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", id] });
      if (!silentUpdate) {
        toast({
          title: "Успешно",
          description: "Данные кампании обновлены"
        });
      }
      setUrlSaveStatus('saved'); // Галочка остается навсегда
      setSilentUpdate(false); // Сбрасываем флаг
    },
    onError: () => {
      setUrlSaveStatus('idle');
      setSilentUpdate(false); // Сбрасываем флаг при ошибке
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить данные кампании"
      });
    }
  });

  // Синхронизируем currentUrl с данными кампании
  useEffect(() => {
    if (campaign && campaign.link) {
      setCurrentUrl(campaign.link);
    }
  }, [campaign]);

  const { mutate: searchKeywords, isPending: isSearching } = useMutation({
    mutationFn: async (url: string) => {
      if (!url || !url.trim()) {
        throw new Error('Пожалуйста, введите корректный URL сайта');
      }

      // Нормализуем URL
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // Используем новый API для анализа ключевых слов
      console.log('🔍 CAMPAIGNS PAGE: Отправляем запрос к NEW API:', normalizedUrl);
      console.log('🔍 CAMPAIGNS PAGE: Используется endpoint /keywords/analyze-website');
      const response = await api.post('/keywords/analyze-website', {
        url: normalizedUrl
      });
      
      console.log('📋 Получен ответ:', response.data);
      console.log('📋 Ключевые слова из API:', response.data?.data?.keywords);
      
      if (!response.data?.success || !response.data?.data?.keywords?.length) {
        console.error('❌ Неудачный ответ API:', response.data);
        throw new Error("Не удалось извлечь ключевые слова с сайта");
      }

      // Возвращаем массив строк ключевых слов
      const keywords = response.data.data.keywords.map((kw: any) => kw.keyword || kw);
      console.log('📋 Обработанные ключевые слова:', keywords);
      return keywords;
    },
    onSuccess: (data) => {
      const formattedKeywords = data.map((keyword: string) => ({
        keyword,
        isSelected: false
      }));
      setSuggestedKeywords(formattedKeywords);
      setIsSearchingKeywords(true);
      toast({
        description: "Ключевые слова успешно найдены"
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        description: error.message
      });
    }
  });

  // Мутация для добавления ключевых слов с их метриками
  const { mutate: addKeywords } = useMutation({
    mutationFn: async (keywordsInput: string[] | { keyword: string; frequency?: number; competition?: number }[]) => {
      let newKeywords: { keyword: string; frequency?: number; competition?: number }[] = [];
      
      // Проверяем тип входных данных и конвертируем в нужный формат
      if (Array.isArray(keywordsInput) && keywordsInput.length > 0) {
        if (typeof keywordsInput[0] === 'string') {
          // Если простой массив строк, преобразуем его в массив объектов с метриками по умолчанию
          newKeywords = (keywordsInput as string[]).map(keyword => ({
            keyword,
            frequency: 3500, // Значение по умолчанию
            competition: 75  // Значение по умолчанию
          }));
        } else {
          // Если уже массив объектов с метриками, используем его напрямую
          newKeywords = keywordsInput as { keyword: string; frequency?: number; competition?: number }[];
        }
      }
      
      console.log("Добавление ключевых слов с метриками:", newKeywords);
      
      // Сначала получаем список существующих ключевых слов для проверки на дубликаты
      const existingKeywordsResponse = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: { _eq: id }
          },
          fields: ['keyword']
        }
      });
      
      const existingKeywords = existingKeywordsResponse.data?.data || [];
      const existingKeywordsLower = existingKeywords.map((k: any) => k.keyword.toLowerCase());
      
      let addedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let results: any[] = [];
      
      // Обрабатываем каждое ключевое слово по-отдельности для корректной работы с дубликатами
      for (const item of newKeywords) {
        // Проверяем, существует ли уже такое ключевое слово (независимо от регистра)
        if (existingKeywordsLower.includes(item.keyword.toLowerCase())) {
          console.log(`Ключевое слово "${item.keyword}" уже существует - пропускаем`);
          skippedCount++;
          continue;
        }
        
        try {
          const result = await directusApi.post('/items/campaign_keywords', {
            campaign_id: id,
            keyword: item.keyword,
            trend_score: item.frequency || 3500, // Используем существующую частоту или значение по умолчанию
            mentions_count: item.competition || 75, // Используем существующую конкуренцию или значение по умолчанию
            last_checked: new Date().toISOString()
          });
          
          results.push(result);
          addedCount++;
        } catch (err: any) {
          // Проверяем, связана ли ошибка с дубликатом
          const errorMessage = err.response?.data?.errors?.[0]?.message || '';
          if (errorMessage.includes('Дубликат ключевого слова') || 
              errorMessage.includes('duplicate') || 
              errorMessage.includes('unique') || 
              errorMessage.includes('already exists')) {
            console.log(`Ключевое слово "${item.keyword}" вызвало ошибку дубликата - пропускаем`);
            skippedCount++;
          } else {
            console.error(`Ошибка при добавлении ключевого слова "${item.keyword}":`, err);
            errorCount++;
          }
        }
      }
      
      // Проверяем, есть ли серьезные ошибки, при которых мы должны вообще отменить операцию
      if (errorCount > 0 && addedCount === 0) {
        // Если не добавлено ни одного ключевого слова, сообщаем об ошибке
        throw new Error(`Не удалось добавить ни одного ключевого слова. Пропущено дубликатов: ${skippedCount}, ошибок: ${errorCount}`);
      }
      
      // Возвращаем информативный результат даже если были некоторые ошибки, но хотя бы одно ключевое слово добавлено
      return { 
        added: addedCount, 
        skipped: skippedCount,
        errors: errorCount,
        total: newKeywords.length,
        newKeywords: newKeywords.map(k => k.keyword), 
        results
      };
    },
    // Оптимистичное обновление UI
    onMutate: async (keywordsInput: string[] | { keyword: string; frequency?: number; competition?: number }[]) => {
      // Отменяем запросы на получение ключевых слов
      await queryClient.cancelQueries({ queryKey: ["/api/keywords", id] });
      
      // Сохраняем предыдущие данные для возможного отката
      const previousKeywords = queryClient.getQueryData(["/api/keywords", id]);
      
      // Получаем текущие ключевые слова для фильтрации только новых
      const currentKeywords = ((previousKeywords as any[]) || []).map(k => k.keyword);
      
      // Конвертируем входные данные в стандартный формат
      let newKeywords: { keyword: string; frequency?: number; competition?: number }[] = [];
      
      if (Array.isArray(keywordsInput) && keywordsInput.length > 0) {
        if (typeof keywordsInput[0] === 'string') {
          // Если простой массив строк, фильтруем их и преобразуем
          const stringKeywords = keywordsInput as string[];
          const filteredKeywords = stringKeywords.filter(k => !currentKeywords.includes(k));
          
          newKeywords = filteredKeywords.map(keyword => ({
            keyword,
            frequency: 3500, // Значение по умолчанию
            competition: 75  // Значение по умолчанию
          }));
        } else {
          // Если массив объектов с метриками, фильтруем их
          const objectKeywords = keywordsInput as { keyword: string; frequency?: number; competition?: number }[];
          newKeywords = objectKeywords.filter(item => !currentKeywords.includes(item.keyword));
        }
      }
      
      if (newKeywords.length > 0) {
        try {
          // Оптимистично обновляем кэш сразу, не дожидаясь API-запроса
          // Это ускорит взаимодействие с интерфейсом
          queryClient.setQueryData(["/api/keywords", id], (old: any[] = []) => {
            const newItems = newKeywords.map(item => ({
              id: `temp-${Date.now()}-${Math.random()}`, // Временный ID
              campaign_id: id,
              keyword: item.keyword,
              trend_score: item.frequency || 3500, // Используем существующее значение или по умолчанию
              mentions_count: item.competition || 75, // Используем существующее значение или по умолчанию
              date_created: new Date().toISOString()
            }));
            
            console.log("Оптимистичное обновление кэша с данными:", newItems);
            return [...old, ...newItems];
          });
          
          // Больше не запускаем асинхронное обогащение данных,
          // так как мы уже используем значения, которые были получены ранее
          
        } catch (error) {
          console.error("Критическая ошибка при обновлении кэша:", error);
          
          // В случае критической ошибки используем значения по умолчанию
          queryClient.setQueryData(["/api/keywords", id], (old: any[] = []) => {
            const newItems = newKeywords.map(item => ({
              id: `temp-${Date.now()}-${Math.random()}`, // Временный ID
              campaign_id: id,
              keyword: item.keyword,
              trend_score: item.frequency || 3500,
              mentions_count: item.competition || 75,
              date_created: new Date().toISOString()
            }));
            
            return [...old, ...newItems];
          });
        }
      }
      
      // Возвращаем контекст для возможного отката
      return { 
        previousKeywords, 
        newKeywordsCount: newKeywords.length,
        newKeywords: newKeywords.map(k => k.keyword)
      };
    },
    onSuccess: (result) => {
      // Обновляем данные с сервера, чтобы получить правильные ID и другие поля
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", id] });
      
      // Также инвалидируем кэш для страницы ключевых слов
      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", id] });
      
      // Очищаем диалог поиска ключевых слов
      setIsSearchingKeywords(false);
      setSuggestedKeywords([]);
      
      // Формируем информативное сообщение о результате
      let message = '';
      if (result.added > 0) {
        message += `Добавлено ${result.added} ключевых слов. `;
      }
      if (result.skipped > 0) {
        message += `Пропущено ${result.skipped} дубликатов. `;
      }
      if (result.errors > 0) {
        message += `Не удалось добавить ${result.errors} ключевых слов. `;
      }
      
      // Показываем сообщение о результате
      toast({
        title: result.added > 0 ? "Успешно" : "Информация",
        description: message || `Обработано ${result.total} ключевых слов`,
        variant: result.errors > 0 ? "destructive" : "default"
      });
    },
    onError: (error, variables, context) => {
      console.error("Ошибка при добавлении ключевых слов:", error);
      
      // Восстанавливаем предыдущие данные в случае ошибки
      if (context?.previousKeywords) {
        queryClient.setQueryData(["/api/keywords", id], context.previousKeywords);
      }
      
      // Проверяем, есть ли частичные результаты
      // Это позволит более информативно сообщать о проблемах
      let errorMessage = "Не удалось добавить ключевые слова";
      
      // Пытаемся извлечь более конкретное сообщение об ошибке
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as any;
        if (errorObj.response?.data?.errors?.[0]?.message) {
          errorMessage = errorObj.response.data.errors[0].message;
        } else if (errorObj.message) {
          errorMessage = errorObj.message;
        }
      }
      
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: errorMessage
      });
      
      // Принудительно обновляем данные, чтобы показать актуальное состояние
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", id] });
    }
  });
  
  // Мутация для удаления ключевого слова при клике на него
  const { mutate: removeKeyword } = useMutation({
    mutationFn: async (keyword: string) => {
      // Сначала получаем ID ключевого слова по его значению
      const response = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: { _eq: id },
            keyword: { _eq: keyword }
          }
        }
      });
      
      // Проверяем, что нашли запись
      if (response.data && response.data.data && response.data.data.length > 0) {
        const keywordId = response.data.data[0].id;
        // Удаляем ключевое слово по ID
        await directusApi.delete(`/items/campaign_keywords/${keywordId}`);
        return { keyword, keywordId };
      } else {
        throw new Error(`Ключевое слово "${keyword}" не найдено`);
      }
    },
    // Оптимистичное обновление UI до получения ответа от сервера
    onMutate: async (keyword) => {
      // Отменяем все запросы на получение ключевых слов, чтобы они не перезаписали наше обновление
      await queryClient.cancelQueries({ queryKey: ["/api/keywords", id] });
      
      // Сохраняем текущие данные для возможного отката
      const previousKeywords = queryClient.getQueryData(["/api/keywords", id]);
      
      // Оптимистично обновляем кэш
      queryClient.setQueryData(["/api/keywords", id], (old: any[]) => {
        return old ? old.filter(item => item.keyword !== keyword) : [];
      });
      
      // Возвращаем контекст для отката в случае ошибки
      return { previousKeywords };
    },
    onSuccess: (result, keyword) => {
      // Запрашиваем новые данные, чтобы убедиться, что интерфейс синхронизирован с сервером
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", id] });
      
      // Также инвалидируем кэш для страницы ключевых слов
      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", id] });
      
      console.log(`Ключевое слово "${keyword}" успешно удалено`);
      // Удаляем дубликат уведомления, так как оно уже показывается в KeywordSelector
    },
    onError: (error, keyword, context) => {
      console.error("Ошибка при удалении ключевого слова:", error);
      // Восстанавливаем предыдущее состояние кэша в случае ошибки
      if (context?.previousKeywords) {
        queryClient.setQueryData(["/api/keywords", id], context.previousKeywords);
      }
      toast({
        variant: "destructive",
        description: `Не удалось удалить ключевое слово "${keyword}"`
      });
    },
    // Всегда запрашиваем новые данные после мутации, независимо от результата
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords", id] });
      // Обновляем кэш для страницы ключевых слов
      queryClient.invalidateQueries({ queryKey: ["campaign_keywords", id] });
    }
  });

  const toggleKeywordSelection = (index: number) => {
    setSuggestedKeywords(prev => prev.map((kw, i) => 
      i === index ? { ...kw, isSelected: !kw.isSelected } : kw
    ));
  };

  const handleAddSelectedKeywords = () => {
    const selectedKeywords = suggestedKeywords
      .filter(kw => kw.isSelected)
      .map(kw => kw.keyword);

    if (selectedKeywords.length > 0) {
      addKeywords(selectedKeywords);
      setIsSearchingKeywords(false); // Закрываем диалог с результатами
      setSuggestedKeywords([]); // Очищаем результаты
    }
  };

  const [silentUpdate, setSilentUpdate] = useState(false);

  const handleUrlUpdate = (newUrl: string, silent: boolean = false) => {
    if (newUrl && newUrl !== campaign?.link) {
      setSilentUpdate(silent);
      updateCampaign({ link: newUrl });
    }
  };

  // Функция для проверки завершенности разделов
  const getSectionCompletionStatus = () => {
    
    const sections = {
      site: {
        completed: Boolean(campaign?.link && campaign.link.trim()),
        label: "URL сайта указан"
      },
      keywords: {
        completed: Boolean(keywordList && keywordList.length > 0),
        label: `Добавлено ${keywordList?.length || 0} ключевых слов`
      },
      questionnaire: {
        completed: Boolean(businessQuestionnaire && Object.keys(businessQuestionnaire).length > 0),
        label: "Бизнес-анкета заполнена"
      },
      trends: {
        completed: Boolean(campaignTrends && campaignTrends.length > 0),
        label: `Собрано ${campaignTrends?.length || 0} трендов`
      },
      trendAnalysis: {
        completed: Boolean(
          campaign?.social_media_settings && 
          typeof campaign.social_media_settings === 'object' &&
          Object.keys(campaign.social_media_settings).length > 0 &&
          Object.values(campaign.social_media_settings).some((setting: any) => 
            setting && typeof setting === 'object' && 
            (setting.enabled === true || setting.configured === true || setting.access_token || setting.token)
          )
        ),
        label: campaign?.social_media_settings && Object.keys(campaign.social_media_settings).length > 0 ? "Соцсети настроены" : "Соцсети не настроены"
      },
      content: {
        completed: Boolean(allCampaignContent && Array.isArray(allCampaignContent) && allCampaignContent.length > 0),
        label: (() => {
          if (!allCampaignContent || !Array.isArray(allCampaignContent) || allCampaignContent.length === 0) return "Создано 0 публикаций";
          const draftCount = allCampaignContent.filter(post => post.status === 'draft').length;
          const totalCount = allCampaignContent.length;
          if (draftCount === totalCount) {
            return `Создано ${draftCount} черновиков`;
          } else if (draftCount > 0) {
            return `Создано ${totalCount} публикаций (${draftCount} черновиков)`;
          } else {
            return `Создано ${totalCount} публикаций`;
          }
        })()
      },
      socialMedia: {
        completed: Boolean(
          campaign?.social_media_settings && 
          typeof campaign.social_media_settings === 'object' &&
          Object.keys(campaign.social_media_settings).length > 0 &&
          Object.values(campaign.social_media_settings).some((setting: any) => 
            setting && typeof setting === 'object' && 
            (setting.enabled === true || setting.configured === true || setting.access_token || setting.token)
          )
        ),
        label: campaign?.social_media_settings && Object.keys(campaign.social_media_settings).length > 0 ? "Соцсети настроены" : "Соцсети не настроены"
      },
      schedule: {
        completed: Boolean(
          campaignContent && Array.isArray(campaignContent) && campaignContent.length > 0 && 
          campaignContent.some(post => post.status === 'scheduled' || post.status === 'published')
        ),
        label: (() => {
          // Используем отфильтрованный контент для подсчета запланированных
          const scheduledCount = campaignContent ? campaignContent.length : 0;
          
          if (scheduledCount === 0) {
            return "Нет запланированных публикаций";
          } else {
            return `${scheduledCount} запланировано`;
          }
        })()
      }
    };
    
    return sections;
  };


  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <Card>
          <CardContent>
            <p className="text-destructive">Кампания не найдена или у вас нет прав доступа к ней</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold mb-6">{campaign.name}</h1>
      </div>

      <Accordion type="single" defaultValue="site">
        <AccordionItem value="site" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="site" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            <div className="flex items-center gap-3">
              {getSectionCompletionStatus().site.completed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span>Сайт</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {getSectionCompletionStatus().site.label}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="flex gap-4 items-center pt-2">
              <div className="relative">
                <Input
                  placeholder="Введите URL сайта"
                  value={currentUrl}
                  onChange={(e) => setCurrentUrl(e.target.value)}
                  onBlur={(e) => handleUrlUpdate(e.target.value.trim())}
                  className="max-w-md pr-10"
                />
                {urlSaveStatus === 'saving' && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-500 transition-all duration-200" />
                )}
                {urlSaveStatus === 'saved' && (
                  <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500 transition-all duration-200" />
                )}
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  if (currentUrl) {
                    searchKeywords(currentUrl);
                  }
                }}
                disabled={isSearching || !currentUrl}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Поиск ключевых слов...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Найти ключевые слова
                  </>
                )}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="keywords" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="keywords" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            <div className="flex items-center gap-3">
              {getSectionCompletionStatus().keywords.completed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span>Ключевые слова</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {getSectionCompletionStatus().keywords.label}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div>
              {/* Запрос на получение ключевых слов */}
              <KeywordSelector 
                campaignId={id}
                showUpdateMetricsButton={false}
                onSelect={(keywords) => {
                  console.log("onSelect вызван с keywords:", keywords);
                  
                  // Проверяем тип входных данных
                  const isStringArray = Array.isArray(keywords) && 
                    keywords.length > 0 && 
                    typeof keywords[0] === 'string';
                  
                  const isObjectArray = Array.isArray(keywords) && 
                    keywords.length > 0 && 
                    typeof keywords[0] === 'object' && 
                    keywords[0] !== null &&
                    'keyword' in keywords[0];
                  
                  if (isStringArray) {
                    // Если передан массив строк
                    const keywordStrings = keywords as string[];
                    
                    if (keywordStrings.length === 1) {
                      // Проверяем, если это одиночное слово и оно передано для удаления
                      // (это происходит при клике на бейдж)
                      const existingKeywords = keywordList?.map(k => k.keyword) || [];
                      if (existingKeywords.includes(keywordStrings[0])) {
                        console.log("Удаляем существующее ключевое слово:", keywordStrings[0]);
                        // Это существующее ключевое слово, значит его нужно удалить
                        removeKeyword(keywordStrings[0]);
                        return; // Важно выйти после удаления, чтобы не попасть в ветку добавления
                      } else {
                        console.log("Добавляем одиночное ключевое слово:", keywordStrings[0]);
                        // Добавляем новое ключевое слово
                        addKeywords(keywordStrings);
                        return; // Выходим после добавления
                      }
                    } else if (keywordStrings.length > 1) {
                      // Пакетное добавление нескольких ключевых слов в виде строк
                      addKeywords(keywordStrings);
                    }
                  } else if (isObjectArray) {
                    // Если передан массив объектов с метриками
                    console.log("Добавляем ключевые слова с метриками:", keywords);
                    // Используем напрямую массив объектов
                    addKeywords(keywords);
                  }
                }}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="business-questionnaire" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="business-questionnaire" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            <div className="flex items-center gap-3">
              {getSectionCompletionStatus().questionnaire.completed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span>Бизнес-анкета</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {getSectionCompletionStatus().questionnaire.label}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <BusinessQuestionnaireForm 
              campaignId={id}
              onQuestionnaireUpdated={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${id}/questionnaire`] });
              }}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="trend-analysis" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="trend-analysis" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            <div className="flex items-center gap-3">
              {campaign?.social_media_settings ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span>Настройки анализа трендов</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {campaign?.social_media_settings ? "Соцсети настроены" : "Соцсети не настроены"}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold">Параметры сбора трендов</h3>
                <p className="text-muted-foreground mt-1 mb-3">
                  Настройте параметры для сбора трендовых тем из социальных сетей. Эти параметры влияют на то, 
                  какие аккаунты будут анализироваться и какие тренды будут учитываться.
                </p>
              </div>
              <TrendAnalysisSettings 
                campaignId={id} 
                initialSettings={campaign.trend_analysis_settings}
                onSettingsUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
                }}
              />
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  После настройки параметров, перейдите в раздел «Тренды» для сбора актуальных трендовых тем, 
                  которые затем будут отображаться в блоке «Тренды» ниже.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="trends" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="trends" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            <div className="flex items-center gap-3">
              {getSectionCompletionStatus().trends.completed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span>Тренды</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {getSectionCompletionStatus().trends.label}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold">Мониторинг актуальных трендов</h3>
                <p className="text-muted-foreground mt-1 mb-3">
                  Здесь отображаются актуальные тренды в вашей тематике из различных источников. 
                  Тренды обновляются автоматически при их сборе на странице «Тренды».
                </p>
              </div>
              <TrendsList 
                campaignId={id} 
                selectable={true} 
                onSelectTrends={handleSelectTrends} 
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="content" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="content" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            <div className="flex items-center gap-3">
              {getSectionCompletionStatus().content.completed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span>Генерация контента</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {getSectionCompletionStatus().content.label}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold">Создание контента на основе трендов</h3>
                  <Button
                    onClick={() => setShowContentGenerationDialog(true)}
                    variant="default"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Wand2 className="h-4 w-4" />
                    Генерировать с ИИ
                  </Button>
                </div>
                <p className="text-muted-foreground mt-1 mb-3">
                  Используйте собранные тренды для генерации контента. Система будет учитывать ключевые слова кампании и позволяет 
                  создавать тексты, изображения и комбинированный контент для разных социальных платформ.
                </p>
              </div>
              <TrendContentGenerator 
                selectedTopics={selectedTrends} 
                onGenerated={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/posts', id] });
                  queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', id] });
                }}
                campaignId={id}
              />
            </div>
            
            {/* Диалог с ИИ для генерации контента */}
            {showContentGenerationDialog && (
              <ContentGenerationDialog 
                campaignId={id}
                keywords={keywordList?.map(k => ({
                  id: k.id,
                  keyword: k.keyword,
                  trendScore: k.trend_score || 0,
                  campaignId: k.campaign_id
                })) || []}
                onClose={() => {
                  setShowContentGenerationDialog(false);
                  queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', id] });
                }} 
              />
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="social-media" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="social-media" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            <div className="flex items-center gap-3">
              {getSectionCompletionStatus().socialMedia.completed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span>Настройки публикации</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {getSectionCompletionStatus().socialMedia.label}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold">Подключение социальных сетей</h3>
                <p className="text-muted-foreground mt-1 mb-3">
                  Настройте доступ к вашим социальным сетям для автоматической публикации контента. 
                  Вам потребуются API-ключи и идентификаторы ваших аккаунтов или сообществ для каждой платформы.
                </p>
              </div>
              <SocialMediaSettings 
                campaignId={id} 
                initialSettings={campaign.social_media_settings}
                onSettingsUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
                }}
              />
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  После настройки доступа, вы сможете публиковать контент напрямую из системы в выбранные 
                  социальные сети согласно установленному расписанию в разделе «Календарь публикаций».
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
            
        <AccordionItem value="schedule" campaignId={id} className="accordion-item px-6">
          <AccordionTrigger value="schedule" campaignId={id} className="py-4 hover:no-underline hover:bg-accent hover:text-accent-foreground">
            <div className="flex items-center gap-3">
              {getSectionCompletionStatus().schedule.completed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <span>Календарь публикаций</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {getSectionCompletionStatus().schedule.label}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <div className="space-y-4">
              <div className="flex flex-col">
                <h3 className="text-xl font-semibold">Планирование и отслеживание публикаций</h3>
                <p className="text-muted-foreground mt-1 mb-3">
                  Здесь вы можете запланировать публикации вашего контента в разные социальные сети, 
                  а также отслеживать статус опубликованного контента на календаре.
                </p>
              </div>
              <div className="h-full w-full">
                {/* Получаем контент кампании и передаем в PublicationCalendar */}
                {campaign && (
                  <>
                    {!isLoadingContent && campaignContent && campaignContent.length === 0 ? (
                      <div className="text-center py-12 border rounded-lg">
                        <p className="text-muted-foreground">Нет запланированных публикаций</p>
                      </div>
                    ) : (
                      <PublicationCalendar 
                        content={campaignContent || []} 
                        isLoading={isLoadingContent}
                        onCreateClick={() => window.location.href = '/content'}
                        onViewPost={(post) => {
                          console.log('View post:', post);
                          // Здесь можно добавить дополнительную логику просмотра поста
                        }}
                      />
                    )}
                  </>
                )}
              </div>
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Система автоматически опубликует контент в указанное время в настроенных в предыдущем разделе социальных сетях. 
                  Вы можете перетаскивать элементы в календаре для изменения даты и времени публикации.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={isSearchingKeywords} onOpenChange={setIsSearchingKeywords}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Найденные ключевые слова</DialogTitle>
            <DialogDescription>
              Выберите ключевые слова для добавления в кампанию
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              {suggestedKeywords.map((kw, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`keyword-${index}`}
                    checked={kw.isSelected} 
                    onCheckedChange={() => toggleKeywordSelection(index)}
                    className="data-[state=checked]:bg-primary"
                  />
                  <label 
                    htmlFor={`keyword-${index}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {kw.keyword}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsSearchingKeywords(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddSelectedKeywords}>
              Добавить выбранные
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}