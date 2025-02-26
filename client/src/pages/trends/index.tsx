import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";

export default function Trends() {
  const { toast } = useToast();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign"],
    queryFn: async () => {
      const response = await directusApi.get('/items/user_campaigns/a99c0c78-bed0-4ec6-80d2-325500680bef');
      console.log('Campaign response:', response);
      return response.data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">
          {campaign?.data?.name || "Основная кампания"}
        </h1>
        <p className="text-muted-foreground mt-2">
          Новая крутая кампания
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Ключевые слова</h2>
            <div className="flex gap-2">
              <Input
                placeholder="Введите запрос для поиска ключевых слов"
                className="flex-1"
              />
              <Button>
                Искать
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}