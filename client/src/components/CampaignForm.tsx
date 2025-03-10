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
  const { add: toast } = useToast();
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
      if (!userId) {
        throw new Error("Необходима авторизация");
      }

      const response = await directusApi.post('items/user_campaigns', {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        user_id: userId,
        status: 'active',
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString()
      });

      return response.data.data;
    },
    onSuccess: (newCampaign) => {
      // Update the cache directly
      queryClient.setQueryData(["user_campaigns", userId], (oldData: any[] = []) => {
        return [...oldData, newCampaign];
      });

      // Close the dialog first
      onClose();

      // Show success message
      toast({
        description: "Кампания создана"
      });

      // Reset form
      form.reset();
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