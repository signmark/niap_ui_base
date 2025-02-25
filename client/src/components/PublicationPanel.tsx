import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Calendar, Share2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";

interface PublicationPanelProps {
  campaignId: string;
}

export function PublicationPanel({ campaignId }: PublicationPanelProps) {
  // Получаем список сгенерированного контента
  const { data: content, isLoading } = useQuery({
    queryKey: ["/api/content", campaignId],
    queryFn: async () => {
      const response = await directusApi.get('/items/scheduled_content', {
        params: {
          filter: {
            user_campaigns_id: {
              _eq: campaignId
            }
          },
          fields: ['*'],
          sort: ['-created_at']
        }
      });
      return response.data?.data || [];
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Запланированные публикации</CardTitle>
        </CardHeader>
        <CardContent>
          {content?.length === 0 ? (
            <p className="text-center text-muted-foreground">
              Нет запланированных публикаций
            </p>
          ) : (
            <div className="space-y-4">
              {content?.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <h3 className="font-medium">{item.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.content}
                        </p>
                        <div className="flex gap-2">
                          {item.platforms.map((platform) => (
                            <Badge key={platform} variant="secondary">
                              {platform}
                            </Badge>
                          ))}
                        </div>
                        {item.scheduledFor && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {new Date(item.scheduledFor).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Share2 className="h-4 w-4" />
                        Опубликовать
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
