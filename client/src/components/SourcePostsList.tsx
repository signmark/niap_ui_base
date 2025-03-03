import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { directusApi } from "@/lib/directus";

interface SourcePost {
  id: string;
  campaign_id: string;
  post_content: string;
  post_type: 'text' | 'image' | 'image-text' | 'video';
  url: string;
  image_url: string | null;
  video_url: string | null;
  likes: number;
  comments: number;
  views: number;
  shares: number;
  published_at: string;
}

interface SourcePostsListProps {
  campaignId: string;
  isLoading?: boolean;
}

export function SourcePostsList({ campaignId, isLoading: parentLoading }: SourcePostsListProps) {
  // Fetch posts for the campaign
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["/source_posts", campaignId],
    queryFn: async () => {
      const response = await directusApi.get("/items/source_posts", {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          },
          sort: ["-published_at"]
        }
      });
      return response.data?.data || [];
    }
  });

  const isLoading = parentLoading || postsLoading;

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full" />
        <p className="mt-2">Загрузка постов...</p>
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>Посты из источников отсутствуют. Соберите данные из источников, чтобы увидеть посты.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post: SourcePost) => (
        <Card key={post.id}>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{post.post_type}</Badge>
                {post.published_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: ru })}
                  </span>
                )}
              </div>

              <p className="text-sm line-clamp-3">{post.post_content}</p>

              <div className="flex gap-4 text-xs">
                <span title="Просмотры">👁 {post.views?.toLocaleString() || 0}</span>
                <span title="Лайки">❤️ {post.likes?.toLocaleString() || 0}</span>
                <span title="Комментарии">💬 {post.comments?.toLocaleString() || 0}</span>
                <span title="Репосты">🔄 {post.shares?.toLocaleString() || 0}</span>
              </div>

              {post.url && (
                <a 
                  href={post.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-xs"
                >
                  Открыть оригинал
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}