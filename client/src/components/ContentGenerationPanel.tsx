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
import { Loader2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichTextEditor from "./RichTextEditor";

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
  modelType: z.enum(['deepseek', 'qwen', 'claude', 'gemini-2.5-flash', 'gemini-2.5-pro']).default('deepseek'),
});

type GenerateContentForm = z.infer<typeof generateContentSchema>;

interface ContentGenerationPanelProps {
  selectedTopics: TrendTopic[];
  onGenerated?: () => void;
}

export function ContentGenerationPanel({ selectedTopics, onGenerated }: ContentGenerationPanelProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<GenerateContentForm>({
    resolver: zodResolver(generateContentSchema),
    defaultValues: {
      topics: selectedTopics.map(topic => topic.id),
      prompt: "",
      useAI: true,
      platforms: ['telegram'],
      scheduledFor: undefined,
      title: "",
      modelType: "deepseek",
    }
  });

  const { mutate: generateContent } = useMutation({
    mutationFn: async (values: GenerateContentForm) => {
      return await directusApi.post('/items/content_generations', {
        ...values,
        campaign_id: selectedTopics[0]?.campaign_id || selectedTopics[0]?.campaignId,
        status: 'pending'
      });
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Контент сгенерирован и запланирован"
      });
      onGenerated?.();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    }
  });

  const onSubmit = (values: GenerateContentForm) => {
    setIsGenerating(true);
    generateContent(values);
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

            <Button type="submit" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Генерация...
                </>
              ) : (
                "Сгенерировать"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}