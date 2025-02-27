import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { queryClient } from "@/lib/queryClient";
import { NewSourcesDialog } from "./NewSourcesDialog";

interface AddSourceDialogProps {
  campaignId: string;
  onClose: () => void;
}

const sourceSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  url: z.string().url("Введите корректный URL"),
  type: z.string().min(1, "Выберите тип источника")
});

type SourceForm = z.infer<typeof sourceSchema>;

export function AddSourceDialog({ campaignId, onClose }: AddSourceDialogProps) {
  const { toast } = useToast();
  const [isParsingSource, setIsParsingSource] = useState(false);
  const [parseResults, setParseResults] = useState<any>(null);

  const form = useForm<SourceForm>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      name: "",
      url: "",
      type: ""
    }
  });

  const { mutate: createSource, isPending } = useMutation({
    mutationFn: async (values: SourceForm) => {
      return await directusApi.post('/items/campaign_content_sources', {
        name: values.name,
        url: values.url,
        type: values.type,
        campaign_id: campaignId,
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_content_sources"] });
      toast({
        title: "Успешно",
        description: "Источник добавлен"
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const { mutate: parseSource, isPending: isParsing } = useMutation({
    mutationFn: async (values: SourceForm) => {
      setIsParsingSource(true);
      const authToken = localStorage.getItem('auth_token');

      if (!authToken) {
        throw new Error("Требуется авторизация. Пожалуйста, войдите в систему снова.");
      }

      const response = await fetch('/api/sources/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          url: values.url,
          sourceType: values.type
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.message || 'Ошибка при парсинге источника';
        throw new Error(errorMessage); // Improved error handling
      }

      return await response.json();
    },
    onSuccess: (data) => {
      setParseResults(data);
      toast({
        title: "Успешно",
        description: "Источник проанализирован"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsParsingSource(false);
    }
  });

  const isSocialMedia = (type: string) => ['telegram', 'vk'].includes(type);

  if (parseResults) {
    return (
      <NewSourcesDialog
        campaignId={campaignId}
        onClose={() => {
          setParseResults(null);
          onClose();
        }}
        sourcesData={parseResults}
      />
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Добавить источник для анализа</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => createSource(values))} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Название</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Тип источника</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип источника" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Веб-сайт</SelectItem>
                    <SelectItem value="telegram">Telegram канал</SelectItem>
                    <SelectItem value="vk">VK группа</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} type="button">
              Отмена
            </Button>
            {isSocialMedia(form.getValues('type')) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => parseSource(form.getValues())}
                disabled={isParsing || !form.formState.isValid}
              >
                {isParsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Анализ...
                  </>
                ) : (
                  "Проанализировать"
                )}
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Добавление...
                </>
              ) : (
                "Добавить"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}