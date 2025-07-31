import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { api } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { YouTubeOAuthSetup } from "./YouTubeOAuthSetup";
import InstagramSetupWizardSimple from "./InstagramSetupWizardSimple";
import VkSetupWizard from "./VkSetupWizard";
import type { SocialMediaSettings } from "@shared/schema";

const socialMediaSettingsSchema = z.object({
  telegram: z.object({
    token: z.string().nullable().optional(),
    chatId: z.string().nullable().optional(),
  }).optional(),
  vk: z.object({
    token: z.string().nullable().optional(),
    groupId: z.string().nullable().optional(),
  }).optional(),
  instagram: z.object({
    token: z.string().nullable().optional(),
    accessToken: z.string().nullable().optional(),
    businessAccountId: z.string().nullable().optional(),
    appId: z.string().nullable().optional(),
    appSecret: z.string().nullable().optional(),
  }).optional(),
  facebook: z.object({
    token: z.string().nullable().optional(),
    pageId: z.string().nullable().optional(),
  }).optional(),
  youtube: z.object({
    apiKey: z.string().nullable().optional(),
    channelId: z.string().nullable().optional(),
    accessToken: z.string().nullable().optional(),
    refreshToken: z.string().nullable().optional(),
  }).optional(),
});

interface SocialMediaSettingsProps {
  campaignId: string;
  initialSettings?: SocialMediaSettings;
  onSettingsUpdated?: () => void;
}

interface ValidationStatus {
  isValid?: boolean;
  message?: string;
  isLoading: boolean;
}

export function SocialMediaSettings({
  campaignId,
  initialSettings,
  onSettingsUpdated
}: SocialMediaSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Состояние для показа Instagram wizard
  const [showInstagramWizard, setShowInstagramWizard] = useState(false);
  
  // Состояние для показа VK wizard
  const [showVkWizard, setShowVkWizard] = useState(false);
  
  // Состояние для Instagram настроек из базы данных
  const [instagramSettings, setInstagramSettings] = useState<any>(null);
  const [loadingInstagramSettings, setLoadingInstagramSettings] = useState(false);
  
  // Состояние для VK настроек из базы данных
  const [vkSettings, setVkSettings] = useState<any>(null);
  const [loadingVkSettings, setLoadingVkSettings] = useState(false);
  
  // Статусы валидации для каждой соцсети
  const [telegramStatus, setTelegramStatus] = useState<ValidationStatus>({ isLoading: false });
  const [vkStatus, setVkStatus] = useState<ValidationStatus>({ isLoading: false });
  const [instagramStatus, setInstagramStatus] = useState<ValidationStatus>({ isLoading: false });
  const [facebookStatus, setFacebookStatus] = useState<ValidationStatus>({ isLoading: false });
  const [youtubeStatus, setYoutubeStatus] = useState<ValidationStatus>({ isLoading: false });

  // Состояние для переключения Instagram аккаунтов
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  // Функция для получения имени Instagram аккаунта
  const getInstagramAccountName = (accountId: string) => {
    const knownAccounts: Record<string, string> = {
      '17841422578516105': 'Дмитрий Жданов',
      '17841422577074562': 'Сметоматика'
    };
    return knownAccounts[accountId] || 'Instagram Business Account';
  };
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  // Состояние для доступных Instagram аккаунтов
  const [availableInstagramAccounts, setAvailableInstagramAccounts] = useState<Array<{
    id: string;
    name: string;
    username?: string;
  }>>([]);

  const form = useForm<SocialMediaSettings>({
    resolver: zodResolver(socialMediaSettingsSchema),
    defaultValues: {
      telegram: initialSettings?.telegram || { token: '', chatId: '' },
      vk: initialSettings?.vk || { token: '', groupId: '' },
      instagram: initialSettings?.instagram || { token: '', accessToken: '', businessAccountId: '', appId: '', appSecret: '' },
      facebook: initialSettings?.facebook || { token: '', pageId: '' },
      youtube: initialSettings?.youtube || { apiKey: '', channelId: '', accessToken: '', refreshToken: '' }
    }
  });

  // Функция загрузки VK настроек из базы данных
  const loadVkSettings = async () => {
    setLoadingVkSettings(true);
    try {
      console.log('🔄 Loading VK settings from database...');
      
      const response = await fetch(`/api/campaigns/${campaignId}/vk-settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ VK settings loaded:', data);
        
        if (data.success && data.settings) {
          setVkSettings(data.settings);
          
          // Обновляем поля формы с полученными данными
          if (data.settings.token) {
            form.setValue('vk.token', data.settings.token);
          }
          if (data.settings.groupId) {
            form.setValue('vk.groupId', data.settings.groupId);
          }
          
          console.log('🔄 VK form fields updated with database values');
        } else {
          console.log('ℹ️ No VK settings found in database');
          setVkSettings(null);
        }
      } else {
        console.error('❌ Failed to load VK settings:', response.statusText);
      }
    } catch (error: any) {
      console.error('❌ Error loading VK settings:', error);
    } finally {
      setLoadingVkSettings(false);
    }
  };

  // Функция загрузки Instagram настроек из базы данных
  // Функция для переключения Instagram аккаунтов
  const handleSwitchInstagramAccount = async () => {
    console.log('🔄 Instagram: Начинаем поиск аккаунтов для переключения');
    console.log('🔄 Instagram: Текущие настройки:', instagramSettings);
    
    if (!instagramSettings?.accessToken) {
      console.log('❌ Instagram: Отсутствует accessToken');
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Сначала настройте Instagram токен"
      });
      return;
    }

    setLoadingAccounts(true);
    try {
      console.log('🔍 Instagram: Отправляем запрос на поиск аккаунтов...');
      const response = await fetch(`/api/campaigns/${campaignId}/discover-instagram-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          accessToken: instagramSettings.accessToken
        })
      });

      const data = await response.json();
      console.log('📊 Instagram: Ответ от сервера:', data);
      
      if (data.success && data.accounts) {
        console.log('✅ Instagram: Найдены аккаунты:', data.accounts);
        setAvailableInstagramAccounts(data.accounts);
        setShowAccountSwitcher(true);
        toast({
          title: "Аккаунты найдены",
          description: `Найдено ${data.accounts.length} Instagram Business аккаунтов`
        });
      } else {
        console.log('❌ Instagram: Аккаунты не найдены:', data);
        throw new Error(data.error || 'Аккаунты не найдены');
      }
    } catch (error: any) {
      console.error('❌ Instagram: Ошибка при поиске аккаунтов:', error);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Функция выбора нового Instagram аккаунта
  const handleSelectNewAccount = async (accountId: string, accountName: string) => {
    try {
      setLoadingAccounts(true);
      
      // Обновляем настройки в базе данных
      const currentSettings = form.getValues();
      const updatedSettings = {
        ...currentSettings,
        instagram: {
          ...currentSettings.instagram,
          businessAccountId: accountId
        }
      };
      
      await onSubmit(updatedSettings);
      
      // Перезагружаем настройки Instagram
      await loadInstagramSettings();
      
      setShowAccountSwitcher(false);
      toast({
        title: "Аккаунт изменен",
        description: `Выбран новый аккаунт: ${accountName}`
      });
    } catch (error: any) {
      console.error('Error switching Instagram account:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось изменить аккаунт",
        variant: "destructive"
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadInstagramSettings = async () => {
    setLoadingInstagramSettings(true);
    try {
      // Используем API client с авторизацией 
      const response = await api.get(`/campaigns/${campaignId}/instagram-settings`);
      const data = response.data;
      
      if (data.success && data.settings) {
        setInstagramSettings(data.settings);
      }
    } catch (error: any) {
      // Если ошибка авторизации, попробуем обновить страницу
      if (error.response?.status === 401) {
        // Обработка ошибки авторизации
      }
    } finally {
      setLoadingInstagramSettings(false);
    }
  };

  // Загружаем Instagram и VK настройки при монтировании компонента
  useEffect(() => {
    if (campaignId) {
      loadInstagramSettings();
      loadVkSettings();
    }
  }, [campaignId]);

  // Обновляем форму когда Instagram настройки загружены
  useEffect(() => {
    if (instagramSettings) {
      
      // Приводим данные из базы к формату схемы формы
      const formattedInstagramData = {
        token: instagramSettings.longLivedToken || instagramSettings.accessToken || instagramSettings.token || '',
        accessToken: instagramSettings.longLivedToken || instagramSettings.accessToken || instagramSettings.token || '',
        businessAccountId: instagramSettings.businessAccountId || instagramSettings.instagramId || '',
        appId: instagramSettings.appId || '',
        appSecret: instagramSettings.appSecret || '',
      };
      
      
      // Обновляем каждое поле отдельно для уверенности
      form.setValue('instagram.token', formattedInstagramData.token);
      form.setValue('instagram.accessToken', formattedInstagramData.accessToken);
      form.setValue('instagram.businessAccountId', formattedInstagramData.businessAccountId);
      form.setValue('instagram.appId', formattedInstagramData.appId);
      form.setValue('instagram.appSecret', formattedInstagramData.appSecret);
      
      console.log('  - token:', form.getValues('instagram.token'));
      console.log('  - accessToken:', form.getValues('instagram.accessToken')); 
      console.log('  - businessAccountId:', form.getValues('instagram.businessAccountId'));
      console.log('  - appId:', form.getValues('instagram.appId'));
      console.log('  - appSecret:', form.getValues('instagram.appSecret'));
      
      // Принудительно обновляем отображение формы
      form.trigger('instagram');
    }
  }, [instagramSettings, form]);

  // Обновляем форму когда VK настройки загружены
  useEffect(() => {
    if (vkSettings) {
      console.log('🔄 Updating VK form fields with database values:', vkSettings);
      
      // Обновляем поля формы с данными из базы
      if (vkSettings.token) {
        form.setValue('vk.token', vkSettings.token);
      }
      if (vkSettings.groupId) {
        form.setValue('vk.groupId', vkSettings.groupId);
      }
      
      console.log('✅ VK form fields updated:', {
        token: form.getValues('vk.token'),
        groupId: form.getValues('vk.groupId'),
        groupName: vkSettings.groupName
      });
      
      // Принудительно обновляем отображение формы
      form.trigger('vk');
    }
  }, [vkSettings, form]);

  // Функции проверки API ключей
  const validateTelegramToken = async () => {
    const token = form.getValues("telegram.token");
    if (!token) {
      toast({
        variant: "destructive",
        description: "Введите токен Telegram бота для проверки"
      });
      return;
    }
    
    try {
      setTelegramStatus({ isLoading: true });
      const response = await api.post('/validate/telegram', { token });
      
      setTelegramStatus({
        isLoading: false,
        isValid: response.data.success,
        message: response.data.message
      });
      
      toast({
        variant: response.data.success ? "default" : "destructive",
        description: response.data.message
      });

      // Если валидация успешна, автоматически сохраняем настройки
      if (response.data.success) {
        await onSubmit(form.getValues());
      }
    } catch (error) {
      console.error('Error validating Telegram token:', error);
      setTelegramStatus({
        isLoading: false,
        isValid: false,
        message: 'Ошибка при проверке токена'
      });
      
      toast({
        variant: "destructive",
        description: "Не удалось проверить токен Telegram"
      });
    }
  };
  
  const validateVkToken = async () => {
    const token = form.getValues("vk.token");
    const groupId = form.getValues("vk.groupId");
    
    if (!token) {
      toast({
        variant: "destructive",
        description: "Введите токен ВКонтакте для проверки"
      });
      return;
    }
    
    try {
      setVkStatus({ isLoading: true });
      const response = await api.post('/validate/vk', { token, groupId });
      
      setVkStatus({
        isLoading: false,
        isValid: response.data.success,
        message: response.data.message
      });
      
      toast({
        variant: response.data.success ? "default" : "destructive",
        description: response.data.message
      });

      // Если валидация успешна, автоматически сохраняем настройки
      if (response.data.success) {
        await onSubmit(form.getValues());
      }
    } catch (error) {
      console.error('Error validating VK token:', error);
      setVkStatus({
        isLoading: false,
        isValid: false,
        message: 'Ошибка при проверке токена'
      });
      
      toast({
        variant: "destructive",
        description: "Не удалось проверить токен ВКонтакте"
      });
    }
  };
  
  const validateInstagramToken = async () => {
    const token = form.getValues("instagram.token");
    
    if (!token) {
      toast({
        variant: "destructive",
        description: "Введите токен Instagram для проверки"
      });
      return;
    }
    
    try {
      setInstagramStatus({ isLoading: true });
      const response = await api.post('/validate/instagram', { token });
      
      setInstagramStatus({
        isLoading: false,
        isValid: response.data.success,
        message: response.data.message
      });
      
      toast({
        variant: response.data.success ? "default" : "destructive",
        description: response.data.message
      });

      // Если валидация успешна, автоматически сохраняем настройки
      if (response.data.success) {
        await onSubmit(form.getValues());
      }
    } catch (error) {
      console.error('Error validating Instagram token:', error);
      setInstagramStatus({
        isLoading: false,
        isValid: false,
        message: 'Ошибка при проверке токена'
      });
      
      toast({
        variant: "destructive",
        description: "Не удалось проверить токен Instagram"
      });
    }
  };

  const fetchInstagramBusinessId = async () => {
    const accessToken = form.getValues("instagram.token");
    if (!accessToken) {
      toast({
        variant: "destructive",
        description: "Сначала введите и проверьте Access Token"
      });
      return;
    }
    
    try {
      setInstagramStatus({ isLoading: true });
      console.log('🔍 Fetching Instagram Business Account ID...');
      
      const response = await api.post(`/campaigns/${campaignId}/fetch-instagram-business-id`, {
        accessToken
      });
      
      if (response.data.success) {
        // Обновляем поле формы с полученным Business Account ID
        form.setValue('instagram.businessAccountId', response.data.businessAccountId);
        
        // Перезагружаем настройки из базы данных для синхронизации
        await loadInstagramSettings();
        
        toast({
          variant: "default",
          description: `Business Account ID получен: ${response.data.businessAccountId}`
        });
        
        console.log('✅ Instagram Business Account ID fetched:', response.data.businessAccountId);
      } else {
        toast({
          variant: "destructive",
          description: response.data.error || "Ошибка при получении Business Account ID"
        });
      }
      
      setInstagramStatus({ isLoading: false });
    } catch (error: any) {
      console.error('Error fetching Instagram Business ID:', error);
      setInstagramStatus({ isLoading: false });
      
      let errorMessage = error.response?.data?.error || "Ошибка при получении Instagram Business Account ID";
      
      // Если есть детали с доступными страницами, покажем их пользователю
      if (error.response?.data?.details?.availablePages) {
        const pages = error.response.data.details.availablePages;
        const pageInfo = pages.map((p: any) => {
          let status = 'нет Instagram';
          if (p.hasInstagramBusiness) status = 'есть Business Account';
          else if (p.hasConnectedInstagram) status = 'есть Connected Account';
          return `${p.name} (${status})`;
        }).join(', ');
        errorMessage += `\n\nВаши Facebook страницы: ${pageInfo}`;
      }
      
      toast({
        variant: "destructive",
        description: errorMessage
      });
    }
  };

  const discoverInstagramAccounts = async () => {
    const accessToken = form.getValues("instagram.token");
    if (!accessToken) {
      toast({
        variant: "destructive",
        description: "Сначала введите Access Token"
      });
      return;
    }

    try {
      setInstagramStatus({ isLoading: true });
      console.log('🔍 Discovering all Instagram accounts...');
      
      const response = await api.post(`/campaigns/${campaignId}/discover-instagram-accounts`, {
        accessToken
      });
      
      if (response.data.success && response.data.accounts) {
        setAvailableInstagramAccounts(response.data.accounts);
        console.log('✅ Instagram accounts discovered:', response.data.accounts);
        
        if (response.data.accounts.length === 0) {
          toast({
            variant: "destructive",
            description: "Не найдено Facebook страниц с подключенными Instagram аккаунтами"
          });
        } else {
          toast({
            variant: "default",
            description: `Найдено ${response.data.accounts.length} Instagram аккаунтов`
          });
        }
      } else {
        toast({
          variant: "destructive",
          description: response.data.error || "Ошибка при поиске Instagram аккаунтов"
        });
      }
      
      setInstagramStatus({ isLoading: false });
    } catch (error: any) {
      console.error('Error discovering Instagram accounts:', error);
      setInstagramStatus({ isLoading: false });
      
      toast({
        variant: "destructive",
        description: "Ошибка при поиске Instagram аккаунтов"
      });
    }
  };

  const selectKnownInstagramAccount = async (pageId: string, instagramId: string, pageName: string) => {
    const accessToken = form.getValues("instagram.token");
    if (!accessToken) {
      toast({
        variant: "destructive",
        description: "Сначала введите Access Token"
      });
      return;
    }

    try {
      setInstagramStatus({ isLoading: true });
      console.log(`🔍 Selecting known Instagram account: ${instagramId} from page ${pageName}`);
      
      // Обновляем поля формы
      form.setValue('instagram.businessAccountId', instagramId);
      
      // Получаем обновленные данные формы
      const formData = form.getValues();
      formData.instagram = {
        ...formData.instagram,
        businessAccountId: instagramId
      };
      
      // Используем основную функцию сохранения для consistency
      await onSubmit(formData);
      
      toast({
        variant: "default",
        description: `Instagram аккаунт "${pageName}" выбран (ID: ${instagramId})`
      });
      
      console.log('✅ Known Instagram account selected and saved successfully');
      setInstagramStatus({ isLoading: false });
    } catch (error: any) {
      console.error('Error selecting known Instagram account:', error);
      setInstagramStatus({ isLoading: false });
      
      toast({
        variant: "destructive",
        description: "Ошибка при выборе Instagram аккаунта"
      });
    }
  };
  
  const validateFacebookToken = async () => {
    const token = form.getValues("facebook.token");
    const pageId = form.getValues("facebook.pageId");
    
    if (!token) {
      toast({
        variant: "destructive",
        description: "Введите токен Facebook для проверки"
      });
      return;
    }
    
    try {
      setFacebookStatus({ isLoading: true });
      const response = await api.post('/validate/facebook', { token, pageId });
      
      setFacebookStatus({
        isLoading: false,
        isValid: response.data.success,
        message: response.data.message
      });
      
      toast({
        variant: response.data.success ? "default" : "destructive",
        description: response.data.message
      });

      // Если валидация успешна, автоматически сохраняем настройки
      if (response.data.success) {
        await onSubmit(form.getValues());
      }
    } catch (error) {
      console.error('Error validating Facebook token:', error);
      setFacebookStatus({
        isLoading: false,
        isValid: false,
        message: 'Ошибка при проверке токена'
      });
      
      toast({
        variant: "destructive",
        description: "Не удалось проверить токен Facebook"
      });
    }
  };
  
  const validateYoutubeApiKey = async () => {
    const apiKey = form.getValues("youtube.apiKey");
    const channelId = form.getValues("youtube.channelId");
    
    if (!apiKey) {
      toast({
        variant: "destructive",
        description: "Введите API ключ YouTube для проверки"
      });
      return;
    }
    
    try {
      setYoutubeStatus({ isLoading: true });
      const response = await api.post('/validate/youtube', { apiKey, channelId });
      
      setYoutubeStatus({
        isLoading: false,
        isValid: response.data.success,
        message: response.data.message
      });
      
      toast({
        variant: response.data.success ? "default" : "destructive",
        description: response.data.message
      });

      // Если валидация успешна, автоматически сохраняем настройки
      if (response.data.success) {
        await onSubmit(form.getValues());
      }
    } catch (error) {
      console.error('Error validating YouTube API key:', error);
      setYoutubeStatus({
        isLoading: false,
        isValid: false,
        message: 'Ошибка при проверке API ключа'
      });
      
      toast({
        variant: "destructive",
        description: "Не удалось проверить API ключ YouTube"
      });
    }
  };
  
  // Компонент статуса валидации
  const ValidationBadge = ({ status }: { status: ValidationStatus }) => {
    if (status.isLoading) {
      return <Badge variant="outline" className="ml-2"><Loader2 className="h-4 w-4 animate-spin" /></Badge>;
    }
    
    if (status.isValid === undefined) {
      return null;
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={status.isValid ? "success" : "destructive"} className="ml-2">
              {status.isValid ? 
                <CheckCircle className="h-4 w-4 mr-1" /> : 
                <XCircle className="h-4 w-4 mr-1" />
              }
              {status.isValid ? "Валиден" : "Ошибка"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{status.message || (status.isValid ? "Ключ валиден" : "Ключ не валиден")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const onSubmit = async (data: SocialMediaSettings) => {
    
    try {
      setIsLoading(true);

      // Используем apiRequest для правильной авторизации
      const response = await apiRequest(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        data: {
          social_media_settings: data
        }
      });


      toast({
        title: "Успешно!",
        description: "Настройки соцсетей обновлены"
      });

      onSettingsUpdated?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка!",
        description: error.response?.data?.message || error.message || "Ошибка при обновлении настроек"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Accordion type="multiple" className="space-y-2">
          {/* Telegram Settings */}
          <AccordionItem value="telegram">
            <AccordionTrigger className="py-2">
              <div className="flex items-center space-x-2">
                <span>Telegram</span>
                <ValidationBadge status={telegramStatus} />
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="telegram.token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bot Token</FormLabel>
                    <div className="flex space-x-2">
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Введите токен бота" 
                          {...field} 
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={validateTelegramToken}
                        disabled={telegramStatus.isLoading}
                      >
                        {telegramStatus.isLoading ? 
                          <Loader2 className="h-4 w-4 animate-spin" /> : 
                          <AlertCircle className="h-4 w-4" />
                        }
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telegram.chatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Чата или @username канала</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Например: -1001234567890 или @channel_name" 
                        {...field} 
                        value={field.value || ''}
                        className={field.value?.startsWith('@') ? "border-green-500" : ""}
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-orange-600">Важно!</span> Для аналитики лучше указывать @username канала.
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          {/* VK Settings */}
          <AccordionItem value="vk">
            <AccordionTrigger className="py-2">
              <div className="flex items-center space-x-2">
                <span>ВКонтакте</span>
                <ValidationBadge status={vkStatus} />
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">VK OAuth настройки</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                      {vkSettings?.groupName ? `Группа: ${vkSettings.groupName}` : 'Настройте VK OAuth для этой кампании'}
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant={vkSettings?.configured ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowVkWizard(true)}
                    disabled={loadingVkSettings}
                  >
                    {loadingVkSettings ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Загрузка...
                      </>
                    ) : (vkSettings?.configured ? 'Пересконфигурировать' : 'Настроить VK')}
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="vk.token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token</FormLabel>
                    <div className="flex space-x-2">
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Введите токен доступа" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={validateVkToken}
                        disabled={vkStatus.isLoading}
                      >
                        {vkStatus.isLoading ? 
                          <Loader2 className="h-4 w-4 animate-spin" /> : 
                          <AlertCircle className="h-4 w-4" />
                        }
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vk.groupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Группы</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Например: 228626989 (без знака минус)" 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      ID группы можно найти в адресной строке: vk.com/club<span className="font-semibold">123456789</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Instagram Settings */}
          <AccordionItem value="instagram">
            <AccordionTrigger className="py-2">
              <div className="flex items-center space-x-2">
                <span>Instagram</span>
                <ValidationBadge status={instagramStatus} />
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">Instagram API настройки</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                      {instagramSettings?.businessAccountId 
                        ? `Аккаунт: ${getInstagramAccountName(instagramSettings.businessAccountId)} (${instagramSettings.businessAccountId})` 
                        : 'Настройте Instagram API для этой кампании'
                      }
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {instagramSettings?.accessToken && (
                      <Button 
                        type="button" 
                        variant="outline"
                        size="sm"
                        onClick={handleSwitchInstagramAccount}
                        disabled={loadingAccounts || loadingInstagramSettings}
                      >
                        {loadingAccounts ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Поиск...
                          </>
                        ) : (
                          <>
                            🔄 Сменить аккаунт
                          </>
                        )}
                      </Button>
                    )}
                    <Button 
                      type="button" 
                      variant={instagramSettings?.configured || instagramSettings?.token ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        console.log('Открываем Instagram мастер для настройки/пересконфигурации');
                        setShowInstagramWizard(true);
                      }}
                      disabled={loadingInstagramSettings}
                    >
                      {loadingInstagramSettings ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Загрузка...
                        </>
                      ) : (instagramSettings?.configured || instagramSettings?.token) ? 'Пересконфигурировать' : 'Настроить Instagram'}
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Instagram Setup Wizard Inline */}
              {showInstagramWizard && (
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <InstagramSetupWizardSimple
                    campaignId={campaignId}
                    onCancel={() => {
                      console.log('Instagram wizard: Закрытие встроенного мастера');
                      setShowInstagramWizard(false);
                    }}
                    onComplete={() => {
                      console.log('🔄 Instagram setup completed, refreshing Instagram settings...');
                      setShowInstagramWizard(false);
                      
                      // Перезагружаем Instagram настройки из базы данных
                      loadInstagramSettings();
                      
                      if (onSettingsUpdated) {
                        onSettingsUpdated();
                      }
                      toast({
                        title: "Instagram OAuth настройка завершена",
                        description: "Instagram интеграция успешно настроена для этой кампании",
                      });
                    }}
                  />
                </div>
              )}

              {/* Переключатель аккаунтов Instagram */}
              {showAccountSwitcher && availableInstagramAccounts.length > 0 && (
                <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Выберите Instagram Business аккаунт:</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAccountSwitcher(false)}
                    >
                      Отмена
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {availableInstagramAccounts.map((account) => (
                      <Card key={account.id} className="cursor-pointer hover:bg-gray-100 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <h5 className="font-semibold">{account.name || getInstagramAccountName(account.id)}</h5>
                              {account.username && (
                                <p className="text-sm text-gray-600">@{account.username}</p>
                              )}
                              <span className="text-xs text-gray-500">ID: {account.id}</span>
                              {instagramSettings?.businessAccountId === account.id && (
                                <div className="flex items-center mt-1">
                                  <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                                  <span className="text-xs text-green-600 font-medium">Активный аккаунт</span>
                                </div>
                              )}
                            </div>
                            <Button 
                              onClick={() => handleSelectNewAccount(account.id, account.name || getInstagramAccountName(account.id))}
                              disabled={loadingAccounts}
                              size="sm"
                              variant={instagramSettings?.businessAccountId === account.id ? "default" : "outline"}
                            >
                              {instagramSettings?.businessAccountId === account.id ? 'Текущий' : 'Выбрать'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Instagram поля скрыты - используется только мастер настройки */}
            </AccordionContent>
          </AccordionItem>

          {/* Facebook Settings */}
          <AccordionItem value="facebook">
            <AccordionTrigger className="py-2">
              <div className="flex items-center space-x-2">
                <span>Facebook</span>
                <ValidationBadge status={facebookStatus} />
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="facebook.token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token</FormLabel>
                    <div className="flex space-x-2">
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Введите токен доступа" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={validateFacebookToken}
                        disabled={facebookStatus.isLoading}
                      >
                        {facebookStatus.isLoading ? 
                          <Loader2 className="h-4 w-4 animate-spin" /> : 
                          <AlertCircle className="h-4 w-4" />
                        }
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="facebook.pageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Например: 102938475647382" 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      ID Facebook страницы можно найти в настройках страницы или в URL: facebook.com/yourpagename
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          {/* YouTube Settings */}
          <AccordionItem value="youtube">
            <AccordionTrigger className="py-2">
              <div className="flex items-center space-x-2">
                <span>YouTube</span>
                <ValidationBadge status={youtubeStatus} />
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded">
                  <span className="font-medium">Требуется для YouTube:</span>
                  <br />• <span className="font-medium">API Key</span> - для базовых операций с YouTube API
                  <br />• <span className="font-medium">ID Канала</span> - для указания канала для загрузки
                  <br />• <span className="font-medium">OAuth авторизация</span> - для загрузки видео (см. ниже)
                </div>
                
                <FormField
                  control={form.control}
                  name="youtube.apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key (обязательно)</FormLabel>
                      <div className="flex space-x-2">
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Введите API ключ YouTube" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={validateYoutubeApiKey}
                          disabled={youtubeStatus.isLoading}
                        >
                          {youtubeStatus.isLoading ? 
                            <Loader2 className="h-4 w-4 animate-spin" /> : 
                            <AlertCircle className="h-4 w-4" />
                          }
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Получите в Google Cloud Console → APIs & Services → Credentials
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="youtube.channelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Канала (обязательно)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Например: UCxxxxxxxxxxxxxxxxxxxxxxx" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <div className="text-xs text-muted-foreground">
                        ID канала можно найти в YouTube Studio → Настройки → Канал → Основная информация
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* YouTube OAuth Setup */}
              <div className="border-t pt-4 mt-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">OAuth Авторизация (для загрузки видео)</h4>
                  <div className="text-xs text-muted-foreground">
                    После ввода API Key и Channel ID выполните OAuth авторизацию для возможности загрузки видео
                  </div>
                  
                  {/* Показываем статус OAuth токенов */}
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <span className="text-muted-foreground">Access Token:</span>
                      <span className={form.watch('youtube.accessToken') ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {form.watch('youtube.accessToken') ? 'Получен' : 'Отсутствует'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-muted-foreground">Refresh Token:</span>
                      <span className={form.watch('youtube.refreshToken') ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {form.watch('youtube.refreshToken') ? 'Получен' : 'Отсутствует'}
                      </span>
                    </div>
                  </div>
                  
                  <YouTubeOAuthSetup 
                    onAuthComplete={(authData) => {

                      
                      // Обновляем форму с полученными токенами
                      if (authData.accessToken) {
                        form.setValue('youtube.accessToken', authData.accessToken);
                      }
                      if (authData.refreshToken) {
                        form.setValue('youtube.refreshToken', authData.refreshToken);
                      }
                      if (authData.channelId) {
                        form.setValue('youtube.channelId', authData.channelId);
                      }
                      
                      // Сохраняем настройки автоматически
                      form.handleSubmit(onSubmit)();
                    }} 
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            type="submit" 
            disabled={isLoading}
            onClick={async () => {
              console.log('🔍 SAVE BUTTON CLICKED');
              console.log('🔍 Form isValid:', form.formState.isValid);
              console.log('🔍 Form errors:', form.formState.errors);
              console.log('🔍 Form values:', form.getValues());
              
              // Детальный анализ ошибок
              if (form.formState.errors.telegram) {
                console.log('❌ TELEGRAM ERRORS:', form.formState.errors.telegram);
              }
              if (form.formState.errors.facebook) {
                console.log('❌ FACEBOOK ERRORS:', form.formState.errors.facebook);
              }
              
              // Проверяем все поля формы
              console.log('🔍 Form values detailed:', JSON.stringify(form.getValues(), null, 2));
              console.log('🔍 Form errors detailed:', JSON.stringify(form.formState.errors, null, 2));
              
              // Принудительная валидация для диагностики
              const isValid = await form.trigger();
              console.log('🔍 Form trigger result:', isValid);
              
              if (!isValid) {
                console.log('❌ FORM VALIDATION FAILED');
                console.log('❌ Form errors after trigger:', form.formState.errors);
              } else {
                console.log('✅ FORM VALIDATION PASSED');
              }
            }}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сохранить настройки
          </Button>
        </div>
        </form>
      </Form>
      


      {/* VK Setup Wizard Dialog */}
      {showVkWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <VkSetupWizard
              campaignId={campaignId}
              onComplete={() => {
                console.log('🔄 VK setup completed, refreshing VK settings...');
                setShowVkWizard(false);
                
                // Перезагружаем VK настройки из базы данных
                loadVkSettings();
                
                if (onSettingsUpdated) {
                  onSettingsUpdated();
                }
                toast({
                  title: "VK OAuth настройка завершена",
                  description: "VK интеграция успешно настроена для этой кампании",
                });
              }}
              onCancel={() => {
                console.log('VK wizard: Закрытие через onCancel');
                setShowVkWizard(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}