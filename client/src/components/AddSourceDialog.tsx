import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { insertContentSourceSchema } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

interface AddSourceDialogProps {
  onClose: () => void;
}

export function AddSourceDialog({ onClose }: AddSourceDialogProps) {
  const { toast } = useToast();
  const userId = useAuthStore((state) => state.userId);

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await apiRequest('/api/campaigns');
      return response;
    }
  });

  const form = useForm({
    resolver: zodResolver(insertContentSourceSchema),
    defaultValues: {
      name: "",
      url: "",
      type: "",
      userId: userId || "",
      campaignId: undefined
    }
  });

  const { mutate: createSource, isPending } = useMutation({
    mutationFn: async (values: any) => {
      // Преобразуем campaignId в число
      const formattedValues = {
        ...values,
        campaignId: values.campaignId ? Number(values.campaignId) : undefined
      };
      return await apiRequest('/api/sources', {
        method: 'POST',
        data: formattedValues
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
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

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Добавить источник для анализа</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => createSource(values))} className="space-y-4">
          <FormField
            control={form.control}
            name="campaignId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Кампания</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите кампанию" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingCampaigns ? (
                      <SelectItem value="">Загрузка...</SelectItem>
                    ) : campaigns?.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id.toString()}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Название</FormLabel>
                <FormControl>
                  <Input placeholder="Введите название источника" {...field} />
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
                  <Input placeholder="https://example.com" {...field} />
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип источника" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="website">Вебсайт</SelectItem>
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