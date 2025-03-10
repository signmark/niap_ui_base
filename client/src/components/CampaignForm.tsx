import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/lib/store";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import { z } from "zod";

interface CampaignFormProps {
  onClose: () => void;
}

const campaignFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional()
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export function CampaignForm({ onClose }: CampaignFormProps) {
  const { toast } = useToast();
  const { userId } = useAuthStore();

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const { mutate: createCampaign, isPending } = useMutation({
    mutationFn: async (values: CampaignFormValues) => {
      console.log('Starting campaign creation with values:', values);
      console.log('Current userId:', userId);

      if (!userId) {
        console.error('No userId found');
        throw new Error("Необходима авторизация");
      }

      const authToken = localStorage.getItem('auth_token');
      console.log('Auth token present:', !!authToken);

      if (!authToken) {
        console.error('No auth token found');
        throw new Error("Токен авторизации не найден");
      }

      try {
        console.log('Sending request to Directus API');
        const response = await directusApi.post('/items/user_campaigns', {
          name: values.name,
          description: values.description || null,
          user_id: userId
        }, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        console.log('Directus API response:', response);

        if (!response.data?.data) {
          console.error('Invalid response format:', response);
          throw new Error("Некорректный ответ от сервера");
        }

        return response.data.data;
      } catch (error: any) {
        console.error('Directus API error:', error);
        console.error('Error response:', error.response?.data);
        throw new Error(error.response?.data?.errors?.[0]?.message || "Ошибка при создании кампании");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ 
        title: "Успешно", 
        description: "Кампания создана" 
      });
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      console.error('Create campaign error:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать кампанию",
        variant: "destructive",
      });
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Создать новую кампанию</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => createCampaign(values))} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Название</FormLabel>
                <FormControl>
                  <Input placeholder="Введите название кампании" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Описание</FormLabel>
                <FormControl>
                  <Textarea placeholder="Введите описание кампании" {...field} />
                </FormControl>
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
                  Создание...
                </>
              ) : (
                "Создать"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}