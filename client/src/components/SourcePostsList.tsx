
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface SourcePost {
  id: string;
  sourceId: string;
  postContent: string;
  postType: string;
  url: string;
  imageUrl: string | null;
  videoUrl: string | null;
  likes: number;
  comments: number;
  views: number;
  shares: number;
  publishedAt: string;
  source?: {
    name: string;
    type: string;
  };
}

interface SourcePostsListProps {
  posts: SourcePost[];
  isLoading: boolean;
}

export function SourcePostsList({ posts, isLoading }: SourcePostsListProps) {
  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full" />
        <p className="mt-2">Загрузка постов...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>Посты из источников отсутствуют. Соберите данные из источников, чтобы увидеть посты.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <Card key={post.id}>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {post.postType === 'image' && post.imageUrl && (
                <div className="w-full h-48 overflow-hidden rounded-md mb-3">
                  <img src={post.imageUrl} alt="Post image" className="w-full h-full object-cover" />
                </div>
              )}
              
              {post.postType === 'video' && post.videoUrl && (
                <div className="w-full h-48 overflow-hidden rounded-md mb-3 relative bg-black">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white h-10 w-10 opacity-80">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <Badge variant="outline">{post.postType}</Badge>
                {post.publishedAt && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true, locale: ru })}
                  </span>
                )}
              </div>
              
              <p className="text-sm line-clamp-3">{post.postContent}</p>
              
              {post.source?.name && (
                <p className="text-xs text-muted-foreground">
                  Источник: {post.source.name} ({post.source.type})
                </p>
              )}
              
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
