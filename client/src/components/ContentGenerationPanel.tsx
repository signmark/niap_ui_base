import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import RichTextEditor from "./RichTextEditor";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Расширенный интерфейс, совместимый с TrendsList
interface TrendTopic {
  id: string;
  title: string;
  source_id?: string;
  sourceId?: string;
  reactions: number;
  comments: number;
  views: number;
  created_at?: string; 
  createdAt?: string;
  is_bookmarked?: boolean;
  isBookmarked?: boolean;
  campaign_id?: string;
  campaignId?: string;
}

const generateContentSchema = z.object({
  topics: z.array(z.string()),
  prompt: z.string().min(1, "Требуется описание контента"),
  useAI: z.boolean().default(true),
  scheduledFor: z.date().optional(),
  platforms: z.array(z.enum(['telegram', 'vk', 'instagram', 'youtube'])),
  title: z.string().optional(),
  modelType: z.enum(['deepseek', 'qwen']).default('deepseek'),
  tone: z.enum(['informative', 'casual', 'professional', 'funny']).default('informative'),
});

type GenerateContentForm = z.infer<typeof generateContentSchema>;

interface ContentGenerationPanelProps {
  selectedTopics: TrendTopic[];
  onGenerated?: () => void;
}

// Типы для результатов генерации контента
interface GenerationResult {
  content: string;
}

export function ContentGenerationPanel({ selectedTopics, onGenerated }: ContentGenerationPanelProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<GenerateContentForm>({
    resolver: zodResolver(generateContentSchema),
    defaultValues: {
      topics: selectedTopics.map(topic => topic.id),
      prompt: "",
      useAI: true,
      platforms: ['telegram'],
      scheduledFor: undefined,
      title: "",
      modelType: 'deepseek',
      tone: 'informative',
    }
  });

  /**
   * Функция для очистки HTML-контента от HTML-тегов
   * @param html HTML-контент
   * @returns Очищенный текст
   */
  const stripHtml = (html: string | null | undefined): string => {
    if (!html) return '';
    
    // Обработка случая, когда html - это простой текст без HTML-тегов
    if (typeof html === 'string' && !html.includes('<')) {
      return html;
    }
    
    try {
      // Создаем временный DOM-элемент
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      // Возвращаем только текстовый контент
      return tempDiv.textContent || tempDiv.innerText || '';
    } catch (error) {
      console.error('Ошибка при очистке HTML:', error);
      // В случае ошибки возвращаем исходный текст, или пустую строку, если его нет
      return typeof html === 'string' ? html : '';
    }
  };

  // Мутация для генерации контента через API
  const { mutate: generateContent } = useMutation({
    mutationFn: async (values: GenerateContentForm) => {
      // Формируем контекст из выбранных трендов
      const trendsContext = selectedTopics.map(topic => topic.title).join(", ");
      
      // Очищаем HTML из prompt перед отправкой
      const plainTextPrompt = stripHtml(values.prompt);
      
      console.log('Отправка запроса с очищенным текстом:', plainTextPrompt);
      
      // Вызываем API генерации текста с выбранной моделью
      const response = await apiRequest(
        `/api/content-generation/${values.modelType}/text`,
        {
          method: 'POST',
          data: {
            prompt: plainTextPrompt,
            trendsContext,
            tone: values.tone,
          }
        }
      ) as GenerationResult;
      
      return response;
    },
    onSuccess: (data) => {
      // Сохраняем результат генерации
      setGeneratedContent(data.content);
      toast({
        title: "Успешно",
        description: "Контент сгенерирован"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при генерации",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    }
  });

  // Мутация для сохранения сгенерированного контента в Directus
  const { mutate: saveContent } = useMutation({
    mutationFn: async (content: string) => {
      const values = form.getValues();
      return await directusApi.post('/items/content_generations', {
        topics: values.topics,
        prompt: values.prompt,
        useAI: values.useAI,
        scheduledFor: values.scheduledFor,
        platforms: values.platforms,
        title: values.title,
        modelType: values.modelType,
        tone: values.tone,
        content,
        campaign_id: selectedTopics[0]?.campaign_id || selectedTopics[0]?.campaignId,
        status: 'pending'
      });
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Контент сохранен и запланирован"
      });
      // Сбрасываем форму и состояние
      onGenerated?.();
      setGeneratedContent(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при сохранении",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsSaving(false);
    }
  });

  const onSubmit = (values: GenerateContentForm) => {
    setIsGenerating(true);
    generateContent(values);
  };
  
  const handleSaveContent = () => {
    if (generatedContent) {
      setIsSaving(true);
      saveContent(generatedContent);
    }
  };

  const platformOptions = [
    { id: 'telegram', label: 'Telegram' },
    { id: 'vk', label: 'ВКонтакте' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'youtube', label: 'YouTube' },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Генерация контента</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Выбранные темы:</h3>
              <ul className="list-disc list-inside space-y-1">
                {selectedTopics.map(topic => (
                  <li key={topic.id} className="text-sm text-muted-foreground">
                    {topic.title}
                  </li>
                ))}
              </ul>
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Заголовок</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Введите заголовок публикации" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание контента</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value}
                      onChange={field.onChange}
                      placeholder="Опишите, какой контент нужно сгенерировать..."
                      minHeight="150px"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="platforms"
              render={() => (
                <FormItem>
                  <FormLabel>Платформы для публикации</FormLabel>
                  <div className="grid gap-4 md:grid-cols-2">
                    {platformOptions.map((platform) => (
                      <FormField
                        key={platform.id}
                        control={form.control}
                        name="platforms"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={platform.id}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(platform.id as any)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    const updated = checked
                                      ? [...current, platform.id]
                                      : current.filter((value) => value !== platform.id);
                                    field.onChange(updated);
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {platform.label}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduledFor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дата и время публикации</FormLabel>
                  <FormControl>
                    <DateTimePicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <FormField
                control={form.control}
                name="modelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Модель AI</FormLabel>
                    <Select 
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите модель" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="qwen">Qwen</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тон сообщения</FormLabel>
                    <Select 
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите тон" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="informative">Информативный</SelectItem>
                        <SelectItem value="casual">Повседневный</SelectItem>
                        <SelectItem value="professional">Профессиональный</SelectItem>
                        <SelectItem value="funny">Юмористический</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="useAI"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">
                    Использовать AI для улучшения контента
                  </FormLabel>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Генерация...
                </>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Сгенерировать</>
              )}
            </Button>
            
            {generatedContent && (
              <div className="mt-6 border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-2">Сгенерированный контент:</h3>
                <div className="prose max-w-none mb-4 bg-muted/50 p-4 rounded-md">
                  <div dangerouslySetInnerHTML={{ __html: generatedContent }} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigator.clipboard.writeText(generatedContent.replace(/<[^>]*>/g, ''))}
                  >
                    <Copy className="mr-2 h-4 w-4" /> Копировать текст
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleSaveContent}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      "Сохранить и запланировать"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}