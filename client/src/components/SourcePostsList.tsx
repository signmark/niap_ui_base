import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface SourcePost {
  id: string;
  post_content: string | null;
  source_id: string;
  campaign_id: string;
  created_at: string;
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
                <Badge variant="outline">Текст</Badge>
                {post.created_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ru })}
                  </span>
                )}
              </div>

              <p className="text-sm line-clamp-3">{post.post_content}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}