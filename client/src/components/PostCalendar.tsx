
import { useState } from "react";
import { Calendar } from "./ui/calendar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";

export function PostCalendar({ campaignId }: { campaignId: string }) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const { toast } = useToast();

  const handleCreatePost = async () => {
    if (!selectedDate || !content) {
      toast({
        title: "Ошибка",
        description: "Заполните все обязательные поля",
        variant: "destructive"
      });
      return;
    }

    try {
      await directusApi.post("/items/campaign_posts", {
        campaign_id: campaignId,
        date: selectedDate.toISOString(),
        content,
        media_url: mediaUrl
      });

      toast({ description: "Пост создан" });
      setContent("");
      setMediaUrl("");
      setSelectedDate(undefined);
    } catch (error) {
      toast({ 
        description: "Ошибка при создании поста", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Календарь постов</h3>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border"
          />
        </div>
        
        <div className="space-y-4">
          <Textarea
            placeholder="Текст поста"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Input
            placeholder="URL медиа (опционально)"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
          />
          <Button onClick={handleCreatePost}>
            Создать пост
          </Button>
        </div>
      </div>
    </div>
  );
}
