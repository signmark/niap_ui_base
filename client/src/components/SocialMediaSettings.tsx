import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
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
  }),
  facebook: z.object({
    token: z.string().nullable(),
    pageId: z.string().nullable(),
  }),
});

interface SocialMediaSettingsProps {
  campaignId: string;
  initialSettings?: SocialMediaSettings;
  onSettingsUpdated?: () => void;
}

export function SocialMediaSettings({
  campaignId,
  initialSettings,
  onSettingsUpdated
}: SocialMediaSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<SocialMediaSettings>({
    resolver: zodResolver(socialMediaSettingsSchema),
    defaultValues: initialSettings || {
      telegram: { token: null, chatId: null },
      vk: { token: null, groupId: null },
      instagram: { token: null },
      facebook: { token: null, pageId: null }
    }
  });

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
    <Card>
      <CardHeader>
        <CardTitle>Настройки публикации</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Telegram Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">Telegram</h3>
              <FormField
                control={form.control}
                name="telegram.token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bot Token</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Введите токен бота" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telegram.chatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Чата</FormLabel>
                    <FormControl>
                      <Input placeholder="Введите ID чата" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* VK Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">ВКонтакте</h3>
              <FormField
                control={form.control}
                name="vk.token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Введите токен доступа" {...field} />
                    </FormControl>
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
                      <Input placeholder="Введите ID группы" {...field} />
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
      </CardContent>
    </Card>
  );
}
