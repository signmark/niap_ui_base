import React from 'react';
import { CampaignContent } from '@/types';
import { SafeSocialPlatform, platformNames, safeSocialPlatforms } from '@/lib/social-platforms';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { CalendarIcon, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import PlatformSelector from './PlatformSelector';

// Создаем схему валидации
const scheduledPublicationSchema = z.object({
  scheduledAt: z.date().nullable(),
  selectedPlatforms: z.record(z.boolean()),
  platformTimes: z.record(z.string(), z.object({
    hour: z.string(),
    minute: z.string()
  })).optional()
});

type EditPublicationFormValues = z.infer<typeof scheduledPublicationSchema>;

// Генерация часов для выбора
const hours = Array.from({ length: 24 }, (_, i) => 
  i.toString().padStart(2, '0')
);

// Генерация минут для выбора (шаг 5 минут)
const minutes = Array.from({ length: 12 }, (_, i) => 
  (i * 5).toString().padStart(2, '0')
);

interface EditScheduledPublicationProps {
  content: CampaignContent;
  onCancel: () => void;
  onSave: () => void;
}

export default function EditScheduledPublication({ 
  content,
  onCancel,
  onSave 
}: EditScheduledPublicationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Устанавливаем начальное состояние для выбранных платформ
  const getInitialPlatforms = () => {
    const platforms: Record<SafeSocialPlatform, boolean> = {
      instagram: false,
      telegram: false,
      vk: false,
      facebook: false
    };
    
    if (content.socialPlatforms) {
      Object.keys(content.socialPlatforms).forEach(key => {
        if (safeSocialPlatforms.includes(key as SafeSocialPlatform)) {
          const platform = key as SafeSocialPlatform;
          platforms[platform] = content.socialPlatforms?.[platform]?.status !== 'cancelled';
        }
      });
    }
    
    return platforms;
  };

  // Получаем время из даты
  const getTimeFromDate = (date: Date | null | undefined) => {
    if (!date) return { hour: '12', minute: '00' };
    return {
      hour: date.getHours().toString().padStart(2, '0'),
      minute: (Math.floor(date.getMinutes() / 5) * 5).toString().padStart(2, '0')
    };
  };

  // Устанавливаем начальное состояние для времени публикации для каждой платформы
  const getInitialPlatformTimes = () => {
    const scheduledDate = content.scheduledAt ? new Date(content.scheduledAt) : null;
    const defaultTime = getTimeFromDate(scheduledDate);
    
    const times: Record<string, { hour: string, minute: string }> = {};
    
    safeSocialPlatforms.forEach(platform => {
      if (content.socialPlatforms?.[platform]) {
        const platformDate = content.socialPlatforms[platform].scheduledAt 
          ? new Date(content.socialPlatforms[platform].scheduledAt as string)
          : scheduledDate;
          
        times[platform] = getTimeFromDate(platformDate);
      } else {
        times[platform] = { ...defaultTime };
      }
    });
    
    return times;
  };

  // Создаем форму с начальными значениями
  const form = useForm<EditPublicationFormValues>({
    resolver: zodResolver(scheduledPublicationSchema),
    defaultValues: {
      scheduledAt: content.scheduledAt ? new Date(content.scheduledAt) : null,
      selectedPlatforms: getInitialPlatforms(),
      platformTimes: getInitialPlatformTimes()
    }
  });

  // Обработчик сохранения формы
  const onSubmit = async (values: EditPublicationFormValues) => {
    try {
      const { scheduledAt, selectedPlatforms, platformTimes } = values;
      
      // Если дата не выбрана, нельзя запланировать публикацию
      if (!scheduledAt) {
        toast({
          title: "Ошибка",
          description: "Пожалуйста, выберите дату публикации",
          variant: "destructive",
        });
        return;
      }
      
      // Проверяем и при необходимости обновляем токен авторизации
      const { refreshAuthToken } = await import('@/lib/refreshAuth');
      try {
        // Пытаемся обновить токен перед отправкой запроса
        await refreshAuthToken();
        console.log("Попытка обновления токена выполнена");
      } catch (refreshError) {
        console.warn('Ошибка обновления токена:', refreshError);
      }
      
      // Формируем объект socialPlatforms для отправки на сервер
      const socialPlatforms: Record<string, any> = {};
      
      Object.entries(selectedPlatforms).forEach(([platform, isSelected]) => {
        if (isSelected) {
          // Копируем существующие данные для платформы или создаем новые
          const existingData = content.socialPlatforms?.[platform as SafeSocialPlatform] || {};
          
          // Создаем дату публикации для этой платформы
          const platformDate = new Date(scheduledAt);
          const time = platformTimes?.[platform] || { hour: '12', minute: '00' };
          
          // Устанавливаем часы и минуты в локальном времени
          platformDate.setHours(parseInt(time.hour, 10), parseInt(time.minute, 10), 0, 0);
          
          // Создаем строку даты, используя UTC-совместимый формат для сервера
          // Это сохранит именно то время, которое выбрал пользователь
          // Сервер получит UTC-дату, но интерпретирует ее согласно своему часовому поясу (UTC+3)
          const localISOString = platformDate.toISOString();
          
          socialPlatforms[platform] = {
            ...existingData,
            status: 'scheduled',
            scheduledAt: localISOString,
            publishedAt: null
          };
        }
      });
      
      // Если не выбрана ни одна платформа, показываем предупреждение
      if (Object.keys(socialPlatforms).length === 0) {
        toast({
          title: "Предупреждение",
          description: "Не выбрана ни одна платформа для публикации",
          variant: "destructive",
        });
        return;
      }
      
      // Получаем токен авторизации из localStorage
      const authToken = localStorage.getItem('auth_token');
      
      // Формируем заголовки с авторизацией
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('Добавлен токен авторизации в заголовки запроса:', authToken.substring(0, 10) + '...');
      } else {
        console.warn('Токен авторизации не найден в localStorage!');
        toast({
          title: "Ошибка авторизации",
          description: "Необходимо авторизоваться для планирования публикаций",
          variant: "destructive"
        });
        return;
      }
      
      // Отправляем данные на сервер через новый endpoint direct-schedule
      await apiRequest(`/api/direct-schedule/${content.id}`, {
        method: 'POST',
        headers,
        data: {
          scheduledAt: scheduledAt.toISOString(),
          socialPlatforms
        }
      });
      
      // Обновляем кэш запроса для запланированных публикаций
      queryClient.invalidateQueries({ queryKey: ['/api/publish/scheduled'] });
      
      toast({
        title: "Успех",
        description: "Настройки публикации успешно обновлены",
      });
      
      onSave();
    } catch (error) {
      console.error("Ошибка при сохранении настроек публикации:", error);
      
      toast({
        title: "Ошибка",
        description: "Не удалось обновить настройки публикации. Пожалуйста, попробуйте снова.",
        variant: "destructive",
      });
    }
  };

  // Обработчик изменения выбора платформы
  const handlePlatformChange = (platform: SafeSocialPlatform, isSelected: boolean) => {
    console.log(`Platform ${platform} changed to: ${isSelected}`);
    form.setValue(`selectedPlatforms.${platform}`, isSelected);
    console.log('Updated selectedPlatforms:', form.getValues('selectedPlatforms'));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="scheduledAt"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Дата публикации</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "dd MMMM yyyy", { locale: ru })
                      ) : (
                        <span>Выберите дату</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value || undefined}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>
                Выберите дату, когда публикация должна быть опубликована.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <FormLabel>Социальные платформы</FormLabel>
          <PlatformSelector 
            selectedPlatforms={form.watch('selectedPlatforms')}
            onChange={handlePlatformChange}
          />
          <FormDescription>
            Выберите платформы, на которых нужно опубликовать контент.
          </FormDescription>
        </div>

        <div className="space-y-4">
          <FormLabel>Время публикации для каждой платформы</FormLabel>
          {safeSocialPlatforms.map(platform => (
            form.watch(`selectedPlatforms.${platform}`) && (
              <div key={platform} className="flex items-center space-x-4 p-3 border rounded-md">
                <div className="flex-1">
                  <Badge variant="outline">{platformNames[platform]}</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  
                  <FormField
                    control={form.control}
                    name={`platformTimes.${platform}.hour`}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-[70px]">
                          <SelectValue placeholder="Час" />
                        </SelectTrigger>
                        <SelectContent>
                          {hours.map(hour => (
                            <SelectItem key={hour} value={hour}>
                              {hour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  
                  <span>:</span>
                  
                  <FormField
                    control={form.control}
                    name={`platformTimes.${platform}.minute`}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-[70px]">
                          <SelectValue placeholder="Мин" />
                        </SelectTrigger>
                        <SelectContent>
                          {minutes.map(minute => (
                            <SelectItem key={minute} value={minute}>
                              {minute}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            )
          ))}
          <FormDescription>
            Настройте индивидуальное время для публикации на каждой платформе.
          </FormDescription>
        </div>

        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
          >
            Отмена
          </Button>
          <Button type="submit">
            Сохранить
          </Button>
        </div>
      </form>
    </Form>
  );
}