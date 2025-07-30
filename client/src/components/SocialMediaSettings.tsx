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
import { YouTubeOAuthSetup } from "./YouTubeOAuthSetup";
import InstagramSetupWizard from "./InstagramSetupWizardComplete";
import type { SocialMediaSettings } from "@shared/schema";

const socialMediaSettingsSchema = z.object({
  telegram: z.object({
    token: z.string().nullable(),
    chatId: z.string().nullable(),
  }),
  vk: z.object({
    token: z.string().nullable(),
    groupId: z.string().nullable(),
  }),
  instagram: z.object({
    token: z.string().nullable(),
    accessToken: z.string().nullable(),
    businessAccountId: z.string().nullable(),
    appId: z.string().nullable(),
    appSecret: z.string().nullable(),
  }),
  facebook: z.object({
    token: z.string().nullable(),
    pageId: z.string().nullable(),
  }),
  youtube: z.object({
    apiKey: z.string().nullable(),
    channelId: z.string().nullable(),
    accessToken: z.string().nullable(),
    refreshToken: z.string().nullable(),
  }),
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
  
  // Состояние для Instagram настроек из базы данных
  const [instagramSettings, setInstagramSettings] = useState<any>(null);
  const [loadingInstagramSettings, setLoadingInstagramSettings] = useState(false);
  
  // Статусы валидации для каждой соцсети
  const [telegramStatus, setTelegramStatus] = useState<ValidationStatus>({ isLoading: false });
  const [vkStatus, setVkStatus] = useState<ValidationStatus>({ isLoading: false });
  const [instagramStatus, setInstagramStatus] = useState<ValidationStatus>({ isLoading: false });
  const [facebookStatus, setFacebookStatus] = useState<ValidationStatus>({ isLoading: false });
  const [youtubeStatus, setYoutubeStatus] = useState<ValidationStatus>({ isLoading: false });

  const form = useForm<SocialMediaSettings>({
    resolver: zodResolver(socialMediaSettingsSchema),
    defaultValues: initialSettings || {
      telegram: { token: null, chatId: null },
      vk: { token: null, groupId: null },
      instagram: { token: null, accessToken: null, businessAccountId: null, appId: null, appSecret: null },
      facebook: { token: null, pageId: null },
      youtube: { apiKey: null, channelId: null, accessToken: null, refreshToken: null }
    }
  });

  // Функция загрузки Instagram настроек из базы данных
  const loadInstagramSettings = async () => {
    console.log('🔥 Loading Instagram settings for campaign:', campaignId);
    setLoadingInstagramSettings(true);
    try {
      // Попробуем запрос напрямую без авторизации, так как роутер имеет fallback на системный токен
      const response = await fetch(`/api/campaigns/${campaignId}/instagram-settings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseText = await response.text();
      console.log('🔥 Raw response text:', responseText);
      console.log('🔥 Response status:', response.status);
      console.log('🔥 Response headers:', response.headers);
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🔥 Parsed JSON data:', data);
      } catch (e) {
        console.error('🔥 Failed to parse JSON:', e);
        console.log('🔥 Response is not valid JSON');
        return;
      }
      
      if (data.success && data.settings) {
        setInstagramSettings(data.settings);
        console.log('🔥 Instagram settings loaded successfully');
      } else {
        console.log('🔥 No Instagram settings found or request failed');
        console.log('🔥 Response data:', data);
      }
    } catch (error: any) {
      console.error('🔥 Error loading Instagram settings:', error);
      console.error('🔥 Error response:', error.response?.data);
      console.error('🔥 Error status:', error.response?.status);
      console.error('🔥 Error message:', error.message);
      
      // Если ошибка авторизации, попробуем обновить страницу
      if (error.response?.status === 401) {
        console.log('🔥 Authorization error - need to refresh token');
      }
    } finally {
      setLoadingInstagramSettings(false);
    }
  };

  // Загружаем Instagram настройки при монтировании компонента
  useEffect(() => {
    if (campaignId) {
      loadInstagramSettings();
    }
  }, [campaignId]);

  // Обновляем форму когда Instagram настройки загружены
  useEffect(() => {
    if (instagramSettings) {
      console.log('🔥 Updating form with Instagram settings:', instagramSettings);
      console.log('🔥 Current form values before update:', form.getValues('instagram'));
      
      // Приводим данные из базы к формату схемы формы
      const formattedInstagramData = {
        token: instagramSettings.longLivedToken || instagramSettings.accessToken || instagramSettings.token || '',
        accessToken: instagramSettings.longLivedToken || instagramSettings.accessToken || instagramSettings.token || '',
        businessAccountId: instagramSettings.businessAccountId || instagramSettings.instagramId || '',
        appId: instagramSettings.appId || '',
        appSecret: instagramSettings.appSecret || '',
      };
      
      console.log('🔥 Formatted Instagram data for form:', formattedInstagramData);
      
      // Обновляем каждое поле отдельно для уверенности
      form.setValue('instagram.token', formattedInstagramData.token);
      form.setValue('instagram.accessToken', formattedInstagramData.accessToken);
      form.setValue('instagram.businessAccountId', formattedInstagramData.businessAccountId);
      form.setValue('instagram.appId', formattedInstagramData.appId);
      form.setValue('instagram.appSecret', formattedInstagramData.appSecret);
      
      console.log('🔥 Form values after update:', form.getValues('instagram'));
      console.log('🔥 Form state dirty?', form.formState.isDirty);
      console.log('🔥 Form field values individual check:');
      console.log('  - token:', form.getValues('instagram.token'));
      console.log('  - accessToken:', form.getValues('instagram.accessToken')); 
      console.log('  - businessAccountId:', form.getValues('instagram.businessAccountId'));
      console.log('  - appId:', form.getValues('instagram.appId'));
      console.log('  - appSecret:', form.getValues('instagram.appSecret'));
      
      // Принудительно обновляем отображение формы
      form.trigger('instagram');
    }
  }, [instagramSettings, form]);



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
        console.log('🔥 Telegram валиден, автосохранение...');
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
        console.log('🔥 VK валиден, автосохранение...');
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
        console.log('🔥 Instagram валиден, автосохранение...');
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
        console.log('🔥 Facebook валиден, автосохранение...');
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
        console.log('🔥 YouTube валиден, автосохранение...');
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
    console.log('🔥 [SAVE SETTINGS] Отправляем настройки:', data);
    console.log('🔥 [SAVE SETTINGS] Campaign ID:', campaignId);
    console.log('🔥 [SAVE SETTINGS] Form data:', JSON.stringify(data, null, 2));
    
    try {
      setIsLoading(true);

      // Используем наш API endpoint вместо прямого обращения к Directus
      console.log('🔥 [SAVE SETTINGS] Отправляем PATCH запрос к /api/campaigns/', campaignId);
      const response = await api.patch(`/api/campaigns/${campaignId}`, {
        social_media_settings: data
      });

      console.log('🔥 [SAVE SETTINGS] Ответ сервера:', response);

      toast({
        title: "Успешно!",
        description: "Настройки соцсетей обновлены"
      });

      onSettingsUpdated?.();
    } catch (error: any) {
      console.error('🔥 [SAVE SETTINGS] Ошибка при обновлении настроек:', error);
      console.error('🔥 [SAVE SETTINGS] Детали ошибки:', error.response?.data);
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
                      Настройте Instagram API для этой кампании
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant={instagramSettings?.configured || initialSettings?.instagram?.token ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowInstagramWizard(!showInstagramWizard)}
                    disabled={loadingInstagramSettings}
                  >
                    {loadingInstagramSettings ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Загрузка...
                      </>
                    ) : (instagramSettings?.configured || initialSettings?.instagram?.token) ? 'Настроено' : 'Настроить Instagram'}
                  </Button>
                </div>
              </div>
              
              {showInstagramWizard && (
                <InstagramSetupWizard 
                  campaignId={campaignId}
                  instagramSettings={instagramSettings ? {
                    appId: (instagramSettings as any).appId || '',
                    appSecret: (instagramSettings as any).appSecret || '',
                    instagramId: (instagramSettings as any).businessAccountId || (instagramSettings as any).instagramId || '',
                    accessToken: (instagramSettings as any).longLivedToken || (instagramSettings as any).token || ''
                  } : {
                    appId: initialSettings?.instagram?.appId || '',
                    appSecret: initialSettings?.instagram?.appSecret || '',
                    instagramId: initialSettings?.instagram?.businessAccountId || '',
                    accessToken: initialSettings?.instagram?.token || ''
                  }}
                  onSettingsUpdate={(settings) => {
                    console.log('🔄 Instagram settings updated:', settings);
                    
                    // Перезагружаем настройки из базы данных
                    loadInstagramSettings();
                    
                    // Если получен флаг needsRefresh, делаем дополнительную задержку для обновления
                    if (settings.needsRefresh) {
                      setTimeout(() => {
                        console.log('🔄 Delayed refresh of Instagram settings...');
                        loadInstagramSettings();
                      }, 1000);
                    }
                    
                    if (onSettingsUpdated) {
                      onSettingsUpdated();
                    }
                    setShowInstagramWizard(false);
                  }}
                />
              )}
              
              <FormField
                control={form.control}
                name="instagram.token"
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
                        onClick={validateInstagramToken}
                        disabled={instagramStatus.isLoading}
                      >
                        {instagramStatus.isLoading ? 
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
                name="instagram.businessAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID бизнес-аккаунта</FormLabel>
                    <div className="flex space-x-2">
                      <FormControl>
                        <Input 
                          placeholder="Например: 17841409299499997" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={fetchInstagramBusinessId}
                        disabled={instagramStatus.isLoading}
                      >
                        {instagramStatus.isLoading ? 
                          <Loader2 className="h-4 w-4 animate-spin" /> : 
                          <span>🔍</span>
                        }
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Нажмите 🔍 для автоматического получения Business Account ID через Graph API
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сохранить настройки
          </Button>
        </div>
      </form>
    </Form>
  );
}