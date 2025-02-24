import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar } from "./ui/calendar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";
import { Loader2 } from "lucide-react";

interface Post {
  id: string;
  campaign_id: string;
  date: string;
  content: string;
  media_url?: string;
}

export function PostCalendar({ campaignId }: { campaignId: string }) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
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

  // Create new post
  const { mutate: createPost, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !content) {
        throw new Error("Заполните все обязательные поля");
      }

      await directusApi.post("/items/campaign_posts", {
        data: {
          campaign_id: campaignId,
          date: selectedDate.toISOString(),
          content,
          media_url: mediaUrl || null
        }
      });
    },
    onSuccess: () => {
      toast({ description: "Пост создан" });
      setContent("");
      setMediaUrl("");
      setSelectedDate(undefined);
      refetchPosts();
    },
    onError: (error: Error) => {
      toast({ 
        description: error.message || "Ошибка при создании поста", 
        variant: "destructive" 
      });
    }
  });

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
            initialFocus
          />

          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Запланированные посты:</h4>
            {posts?.map((post: Post) => (
              <div key={post.id} className="p-2 bg-secondary rounded-md mb-2">
                <p className="text-sm font-medium">
                  {new Date(post.date).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {post.content}
                </p>
              </div>
            ))}
          </div>
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