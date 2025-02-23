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
import { DIRECTUS_URL } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import { z } from "zod";

interface CampaignFormProps {
  onClose: () => void;
}

// Определяем схему для формы создания кампании
const campaignFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional()
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export function CampaignForm({ onClose }: CampaignFormProps) {
  const { toast } = useToast();
  const { token, userId } = useAuthStore();

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const { mutate: createCampaign, isPending } = useMutation({
    mutationFn: async (values: CampaignFormValues) => {
      console.log("Creating campaign with values:", values);
      console.log("Using token:", token);
      console.log("Using userId:", userId);

      const response = await fetch(`${DIRECTUS_URL}/items/campaigns`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
          user: userId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Campaign creation failed:", data);
        throw new Error(data.errors?.[0]?.message || "Failed to create campaign");
      }

      console.log("Campaign created successfully:", data);
      return data.data;
    },
    onSuccess: (data) => {
      console.log("Mutation succeeded, invalidating queries");
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ 
        title: "Успешно", 
        description: "Кампания создана" 
      });
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      console.error("Mutation failed:", error);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (values: CampaignFormValues) => {
    console.log("Form submitted with values:", values);
    createCampaign(values);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Создать новую кампанию</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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