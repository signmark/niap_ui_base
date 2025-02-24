import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar } from "./ui/calendar";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Post {
  id: string;
  campaign_id: string;
  content: string;
  post_type: 'text' | 'image' | 'image-text' | 'video';
  image_url: string | null;
  video_url: string | null;
  scheduled_at: string;
}

export function PostCalendar({ campaignId }: { campaignId: string }) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("12:00");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [postType, setPostType] = useState<'text' | 'image' | 'image-text' | 'video'>("text");
  const { toast } = useToast();

  // Fetch existing posts
  const { data: posts, refetch: refetchPosts } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "posts"],
    queryFn: async () => {
      const response = await directusApi.get("/items/campaign_posts", {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          }
        }
      });
      return response.data?.data || [];
    }
  });

  // Convert local time to UTC
  const toUTCDate = (localDate: Date, timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date(localDate);

    // Устанавливаем локальное время
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    date.setMilliseconds(0);

    // Преобразуем в UTC
    const utcDate = new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        hours, // Используем исходные часы
        minutes // Используем исходные минуты
      )
    );

    return utcDate;
  };

  // Format time for display
  const formatTime = (dateStr: string) => {
    const utcDate = new Date(dateStr);
    // Преобразуем UTC обратно в локальное время
    const localDate = new Date(utcDate);

    return localDate.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Create new post
  const { mutate: createPost, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !content) {
        throw new Error("Заполните все обязательные поля");
      }

      const scheduledAt = toUTCDate(selectedDate, selectedTime);

      await directusApi.post("/items/campaign_posts", {
        campaign_id: campaignId,
        post_type: postType,
        content,
        image_url: (postType === "image" || postType === "image-text") ? mediaUrl : null,
        video_url: postType === "video" ? mediaUrl : null,
        scheduled_at: scheduledAt.toISOString()
      });
    },
    onSuccess: () => {
      toast({ description: "Пост создан" });
      setContent("");
      setMediaUrl("");
      setSelectedDate(undefined);
      setSelectedTime("12:00");
      setPostType("text");
      refetchPosts();
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка при создании поста",
        variant: "destructive"
      });
    }
  });

  // Generate time options
  const timeOptions = Array.from({ length: 24 * 2 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  // Helper function to get dot color based on post type
  const getDotColor = (type: string) => {
    switch (type) {
      case 'text':
        return 'bg-blue-500';
      case 'image':
      case 'image-text':
        return 'bg-yellow-500';
      case 'video':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Generate calendar day content
  const getDayContent = (day: Date) => {
    const postsForDay = posts?.filter(post => {
      const postDate = new Date(post.scheduled_at);
      return postDate.getDate() === day.getDate() &&
             postDate.getMonth() === day.getMonth() &&
             postDate.getFullYear() === day.getFullYear();
    });

    if (!postsForDay?.length) return null;

    const chunks = [];
    for (let i = 0; i < postsForDay.length; i += 3) {
      chunks.push(postsForDay.slice(i, i + 3));
    }

    return (
      <div className="flex flex-col gap-1 mt-1">
        {chunks.map((chunk, chunkIndex) => (
          <div key={chunkIndex} className="flex gap-1 justify-center">
            {chunk.map((post) => (
              <div
                key={post.id}
                className={`w-2 h-2 rounded-full ${getDotColor(post.post_type)}`}
                title={`${formatTime(post.scheduled_at)} - ${post.content.substring(0, 20)}...`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Get posts for selected date
  const getSelectedDatePosts = () => {
    if (!selectedDate || !posts) return [];

    return posts.filter(post => {
      const postDate = new Date(post.scheduled_at);
      return postDate.getDate() === selectedDate.getDate() &&
             postDate.getMonth() === selectedDate.getMonth() &&
             postDate.getFullYear() === selectedDate.getFullYear();
    });
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
            components={{
              DayContent: ({ date }) => (
                <div className="flex flex-col items-center">
                  <span>{date.getDate()}</span>
                  {getDayContent(date)}
                </div>
              )
            }}
            initialFocus
          />

          {selectedDate && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Посты на {selectedDate.toLocaleDateString()}:</h4>
              {getSelectedDatePosts().map((post: Post) => (
                <div key={post.id} className="p-2 bg-secondary rounded-md mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getDotColor(post.post_type)}`} />
                    <p className="text-sm font-medium">
                      {formatTime(post.scheduled_at)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{post.content}</p>
                  {(post.image_url || post.video_url) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Медиа: {post.image_url || post.video_url}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex gap-4">
            <Select value={postType} onValueChange={(value: 'text' | 'image' | 'image-text' | 'video') => setPostType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Тип поста" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Текст</SelectItem>
                <SelectItem value="image">Изображение</SelectItem>
                <SelectItem value="image-text">Текст с изображением</SelectItem>
                <SelectItem value="video">Видео</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger>
                <SelectValue placeholder="Время публикации" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map(time => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea
            placeholder="Текст поста"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          {(postType === "image" || postType === "image-text" || postType === "video") && (
            <Input
              placeholder={`URL ${postType === "video" ? "видео" : "изображения"}`}
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
            />
          )}
          <Button onClick={() => createPost()} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Создание...
              </>
            ) : (
              "Создать пост"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}