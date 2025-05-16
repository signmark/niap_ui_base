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
      youtube: { apiKey: null, channelId: null }
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
      await directusApi.patch(`/items/user_campaigns/${campaignId}`, {
        social_media_settings: data
      });

      toast({
        description: "Настройки соцсетей обновлены"
      });

      onSettingsUpdated?.();
    } catch (error) {
      console.error('Error updating social media settings:', error);
      toast({
        variant: "destructive",
        description: "Ошибка при обновлении настроек"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Telegram Settings */}
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className="font-medium">Telegram</h3>
            <ValidationBadge status={telegramStatus} />
          </div>
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
                      <Loader2 className="h-4 w-4 animate-spin mr-1" /> : 
                      <AlertCircle className="h-4 w-4 mr-1" />
                    }
                    Проверить
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
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-orange-600">Важно!</span> Для корректной работы аналитики рекомендуется указывать @username канала, а не его ID. 
                  Если вы укажете только числовой ID канала (например, -100...), вы не сможете собирать аналитику из-за ограничений Telegram API.
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* VK Settings */}
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className="font-medium">ВКонтакте</h3>
            <ValidationBadge status={vkStatus} />
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
                      <Loader2 className="h-4 w-4 animate-spin mr-1" /> : 
                      <AlertCircle className="h-4 w-4 mr-1" />
                    }
                    Проверить
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
                <div className="text-xs text-muted-foreground mt-1">
                  ID группы ВКонтакте можно найти в адресной строке: vk.com/club<span className="font-semibold">123456789</span> или в настройках группы. Вводите только числовой ID без знака минус.
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Instagram Settings */}
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className="font-medium">Instagram</h3>
            <ValidationBadge status={instagramStatus} />
          </div>
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
                      <Loader2 className="h-4 w-4 animate-spin mr-1" /> : 
                      <AlertCircle className="h-4 w-4 mr-1" />
                    }
                    Проверить
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="instagram.accessToken"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Дополнительный токен</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="Введите дополнительный токен" 
                    {...field} 
                    value={field.value || ''}
                  />
                </FormControl>
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
                <FormControl>
                  <Input 
                    placeholder="Например: 17841409299499997" 
                    {...field} 
                    value={field.value || ''}
                  />
                </FormControl>
                <div className="text-xs text-muted-foreground mt-1">
                  Для публикации в Instagram требуется ID бизнес-аккаунта. Его можно получить через 
                  <a href="https://developers.facebook.com/tools/explorer/" target="_blank" className="text-blue-500 ml-1 hover:underline">Graph API Explorer</a>. 
                  Подключите Instagram к Facebook Business Suite для корректной работы публикаций.
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Facebook Settings */}
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className="font-medium">Facebook</h3>
            <ValidationBadge status={facebookStatus} />
          </div>
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
                      <Loader2 className="h-4 w-4 animate-spin mr-1" /> : 
                      <AlertCircle className="h-4 w-4 mr-1" />
                    }
                    Проверить
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
                <div className="text-xs text-muted-foreground mt-1">
                  ID Facebook страницы можно найти в настройках страницы или в URL-адресе: facebook.com/<span className="font-semibold">yourpagename</span>. 
                  Если используете числовой ID, убедитесь, что он соответствует бизнес-странице, связанной с вашим Instagram-аккаунтом.
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* YouTube Settings */}
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className="font-medium">YouTube</h3>
            <ValidationBadge status={youtubeStatus} />
          </div>
          <FormField
            control={form.control}
            name="youtube.apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key</FormLabel>
                <div className="flex space-x-2">
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Введите API ключ" 
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
                      <Loader2 className="h-4 w-4 animate-spin mr-1" /> : 
                      <AlertCircle className="h-4 w-4 mr-1" />
                    }
                    Проверить
                  </Button>
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
                <FormLabel>ID Канала</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Введите ID канала" 
                    {...field} 
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить настройки"
          )}
        </Button>
      </form>
    </Form>
  );
}