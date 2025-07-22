import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { InstagramDirectAuth } from "./InstagramDirectAuth";
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
  const queryClient = useQueryClient();
  
  // Получаем данные кампании через авторизованный API
  const { data: response, refetch } = useQuery({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId
  });
  
  const campaign = response?.data || response;
  
  // Логирование для диагностики
  console.log('🔥 SocialMediaSettings campaign response:', response);
  console.log('🔥 SocialMediaSettings campaign data:', campaign);
  console.log('🔥 SocialMediaSettings social_media_settings:', campaign?.social_media_settings);
  console.log('🔥 SocialMediaSettings instagram settings:', campaign?.social_media_settings?.instagram);
  
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
      instagram: { token: null, accessToken: null, businessAccountId: null },
      facebook: { token: null, pageId: null },
      youtube: { apiKey: null, channelId: null, accessToken: null, refreshToken: null }
    }
  });

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

  // Обработчик успешной авторизации Instagram
  const handleInstagramAuth = async (sessionData: any) => {
    try {
      const response = await api.patch(`/campaigns/${campaignId}`, {
        social_media_settings: {
          instagram: sessionData
        }
      });
      
      // Принудительно инвалидируем кеш после сохранения в базе данных
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      
      toast({
        description: "Instagram аккаунт успешно подключен"
      });
    } catch (error) {
      console.error('Error saving Instagram auth:', error);
      toast({
        variant: "destructive",
        description: "Ошибка при сохранении авторизации Instagram"
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

      // Исключаем Instagram из данных - он обновляется отдельно через InstagramDirectAuth
      const { instagram, ...dataWithoutInstagram } = data;
      
      // Получаем текущие настройки Instagram из кампании
      const existingInstagramSettings = campaign?.social_media_settings?.instagram;
      
      // Объединяем данные, сохраняя Instagram настройки
      const finalData = {
        ...dataWithoutInstagram,
        instagram: existingInstagramSettings || {}
      };

      console.log('🔥 Отправляемые данные (Instagram сохранен):', finalData);
      
      // Используем наш API endpoint вместо прямого обращения к Directus
      const response = await api.patch(`/campaigns/${campaignId}`, {
        social_media_settings: finalData
      });

      toast({
        description: "Настройки соцсетей обновлены"
      });

      onSettingsUpdated?.();
    } catch (error: any) {
      console.error('🔥 Ошибка при обновлении настроек:', error);
      toast({
        variant: "destructive",
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
              {/* Instagram Direct Auth Setup */}
              <InstagramDirectAuth 
                campaignId={campaignId}
                existingSession={campaign?.social_media_settings?.instagram}
                onAuthSuccess={async (sessionData) => {
                  console.log('🔥 Instagram onAuthSuccess called with sessionData:', sessionData);
                  
                  // Обновляем статус после успешной авторизации
                  setInstagramStatus({
                    isLoading: false,
                    isValid: true,
                    message: 'Instagram авторизация настроена'
                  });
                  
                  if (sessionData) {
                    await handleInstagramAuth(sessionData);
                  }
                  
                  // Принудительно инвалидируем кеш для обновления данных
                  console.log('🔥 Инвалидируем кеш для кампании:', campaignId);
                  await queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId] });
                  await queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
                  
                  // Обновляем кампанию после изменений
                  await refetch();
                  
                  console.log('🔥 Данные кампании после обновления:', campaign?.social_media_settings?.instagram);
                  
                  onSettingsUpdated?.();
                }}
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
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сохранить настройки
          </Button>
        </div>
      </form>
    </Form>
  );
}