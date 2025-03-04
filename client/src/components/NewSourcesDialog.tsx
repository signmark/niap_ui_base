import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface NewSourcesDialogProps {
  campaignId: string;
  onClose: () => void;
  sourcesData: {
    success?: boolean;
    data?: {
      sources: Array<{
        url: string;
        name: string;
        followers: number;
        platform: string;
        description: string;
        rank: number;
      }>;
    };
  };
}

export function NewSourcesDialog({ campaignId, onClose, sourcesData }: NewSourcesDialogProps) {
  console.log('Dialog received sourcesData:', sourcesData);

  // Тестовые данные для отладки отображения
  const testSources = [
    {
      url: 'https://instagram.com/bewellbykelly',
      name: 'Kelly LeVeque',
      followers: 550700,
      platform: 'instagram.com',
      description: 'Clinical nutritionist, best-selling author, and mom',
      rank: 5
    },
    {
      url: 'https://instagram.com/pp_mari_food',
      name: 'Марина',
      followers: 200000,
      platform: 'instagram.com',
      description: 'Рецепты и советы по правильному питанию',
      rank: 5
    }
  ];

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Тестовый вывод источников</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {testSources.map((source, index) => (
            <Card key={index} className="p-4">
              <CardContent className="p-0">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{source.name}</h3>
                      <Badge variant="outline" className="whitespace-nowrap">
                        {source.followers} подписчиков
                      </Badge>
                    </div>

                    {source.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {source.description}
                      </p>
                    )}

                    <p className="text-sm break-all mt-2">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {source.url}
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}