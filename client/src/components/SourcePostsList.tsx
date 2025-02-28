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
              {(post.post_type === 'image' || post.post_type === 'image-text') && post.image_url && (
                <div className="w-full h-48 overflow-hidden rounded-md mb-3">
                  <img src={post.image_url} alt="Post image" className="w-full h-full object-cover" />
                </div>
              )}

              {post.post_type === 'video' && post.video_url && (
                <div className="w-full h-48 overflow-hidden rounded-md mb-3 relative bg-black">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white h-10 w-10 opacity-80">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </div>
                </div>
              )}

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
                  className="text-xs text-blue-500 hover:underline"
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