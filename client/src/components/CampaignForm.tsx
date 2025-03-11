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

  const { getAuthToken } = useAuthStore();
  
  const { mutate: createCampaign, isPending } = useMutation({
    mutationFn: async (values: CampaignFormValues) => {
      if (!userId) {
        throw new Error("Необходима авторизация");
      }
      
      const token = getAuthToken();
      if (!token) {
        throw new Error("Отсутствует токен авторизации");
      }

      // Используем наш новый серверный маршрут вместо прямого обращения к Directus
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description?.trim() || null,
          userId: userId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Не удалось создать кампанию");
      }

      return await response.json();
    },
    onSuccess: (newCampaign) => {
      // Immediately update the cache to show the new campaign
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", userId] });
      
      // Show success message
      toast({
        description: "Кампания создана"
      });

      // Schedule form closure and reset after a short delay
      setTimeout(() => {
        form.reset();
        onClose();
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        description: error.message
      });
    }
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