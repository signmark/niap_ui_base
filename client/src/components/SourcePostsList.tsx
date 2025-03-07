import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ThumbsUp, Eye, RefreshCw, Calendar, ImageOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SourcePost {
  id: string;
  post_content: string | null;
  image_url: string | null;
  likes: number | null;
  views: number | null;
  comments: number | null;
  shares: number | null;
  source_id: string;
  campaign_id: string;
  url: string | null;
  post_type: string | null;
  video_url: string | null;
  date: string | null;
  metadata: any | null;
}

interface SourcePostsListProps {
  posts: SourcePost[];
  isLoading: boolean;
}

export function SourcePostsList({ posts, isLoading }: SourcePostsListProps) {
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

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

  // Функция для очистки HTML-тегов для превью
  const stripHtml = (html: string | null) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
  };

  // Функция для обеспечения правильного отображения URL
  const ensureValidUrl = (url: string | null) => {
    if (!url) return null;

    // If already starts with http/https, return as is
    if (url.match(/^https?:\/\//i)) {
      return url;
    }

    // For Telegram URLs specifically ensure we add https://
    if (url.includes('t.me') || url.includes('tgcnt.ru') || url.includes('telegram')) {
      return `https://${url}`;
    }

    // For other URLs, standard handling
    return `https://${url}`;
  };

  // Function to process image URLs to handle CORS
  const processImageUrl = (url: string | null) => {
    if (!url) return null;

    // For both Instagram and Telegram use weserv.nl proxy
    if (url.includes('instagram.') || url.includes('fbcdn.net') ||
        url.includes('tgcnt.ru') || url.includes('t.me') || url.includes('telegram')) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=placeholder`;
    }

    // For other sources use direct link
    return url;
  };

  // Проверка, является ли URL видео-файлом
  const isVideoUrl = (url: string | null): boolean => {
    if (!url) return false;

    // Для ссылок из Telegram (tgcnt.ru) не считаем .mp4 как видео,
    // так как они часто используют это расширение для GIF-анимаций
    if (url.includes('tgcnt.ru') || url.includes('t.me') || url.includes('telegram')) {
      return false;
    }

    // Для других ссылок проверяем расширение файла и явные признаки видео
    return url.toLowerCase().includes('video/') || 
           (url.toLowerCase().endsWith('.mp4') && !url.includes('tgcnt.ru')) || 
           url.toLowerCase().endsWith('.mov') || 
           url.toLowerCase().endsWith('.avi') || 
           url.toLowerCase().endsWith('.webm');
  };

  // Обработчик для открытия/закрытия всплывающего окна
  const handlePopoverChange = (open: boolean, postId: string) => {
    setOpenPopover(open ? postId : null);
  };

  // Обработчик ошибки загрузки изображения
  const handleImageError = (imageUrl: string) => {
    console.log("Failed to load image:", imageUrl);
    setFailedImages(prev => new Set(prev).add(imageUrl));
  };

  return (
    <div className="space-y-2">
      {posts.map((post: SourcePost) => (
        <Popover key={post.id} open={openPopover === post.id} onOpenChange={(open) => handlePopoverChange(open, post.id)}>
          <PopoverTrigger asChild>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  {post.image_url && !failedImages.has(post.image_url) ? (
                    <div className="flex-shrink-0">
                      <img
                        src={processImageUrl(post.image_url)}
                        alt="Миниатюра поста"
                        className="h-16 w-16 object-cover rounded-md"
                        onError={() => handleImageError(post.image_url!)}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                      />
                    </div>
                  ) : post.image_url ? (
                    <div className="flex-shrink-0 h-16 w-16 flex items-center justify-center bg-muted rounded-md">
                      <ImageOff className="h-6 w-6 text-muted-foreground" />
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs py-0 h-5">
                          {post.post_type || (post.image_url ? isVideoUrl(post.image_url) ? "Видео" : "Фото" : "Текст")}
                        </Badge>
                        {post.date && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(post.date), { addSuffix: true, locale: ru })}
                          </span>
                        )}
                      </div>
                      {post.url && (
                        <a
                          href={ensureValidUrl(post.url) || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Открыть оригинал
                        </a>
                      )}
                    </div>

                    {post.post_content ? (
                      <p className="text-sm line-clamp-2">{stripHtml(post.post_content)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Нет текстового описания</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {post.likes !== null && post.likes !== undefined && (
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          <span>{post.likes.toLocaleString('ru-RU')}</span>
                        </div>
                      )}
                      {post.views !== null && post.views !== undefined && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>{post.views.toLocaleString('ru-RU')}</span>
                        </div>
                      )}
                      {post.comments !== null && post.comments !== undefined && (
                        <div className="flex items-center gap-1">
                          <span>💬</span>
                          <span>{post.comments.toLocaleString('ru-RU')}</span>
                        </div>
                      )}
                      {post.shares !== null && post.shares !== undefined && (
                        <div className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          <span>{post.shares.toLocaleString('ru-RU')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PopoverTrigger>
          <PopoverContent className="w-[450px] p-0 max-h-[80vh] overflow-hidden" align="start">
            <div className="p-4 max-h-[calc(80vh-8px)] overflow-auto">
              {post.image_url && !failedImages.has(post.image_url) ? (
                <div className="mb-4">
                  <img
                    src={processImageUrl(post.image_url)}
                    alt="Изображение поста"
                    className="w-full h-auto max-w-full rounded-md object-cover"
                    style={{ maxHeight: '300px' }}
                    onError={() => handleImageError(post.image_url!)}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                  {post.url && (
                    <div className="mt-2 text-right">
                      <a
                        href={ensureValidUrl(post.url) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Открыть оригинал
                      </a>
                    </div>
                  )}
                </div>
              ) : post.image_url ? (
                <div className="mb-4 p-4 bg-muted rounded-md flex items-center justify-center" style={{ height: '100px' }}>
                  <div className="text-center">
                    <ImageOff className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Не удалось загрузить изображение</p>
                    {post.url && (
                      <a
                        href={ensureValidUrl(post.url) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline mt-2 block"
                      >
                        Открыть оригинал
                      </a>
                    )}
                  </div>
                </div>
              ) : null}
              {post.post_content ? (
                <div
                  className="text-sm prose prose-sm max-w-none dark:prose-invert
                    prose-headings:font-semibold
                    prose-p:my-1
                    prose-a:text-blue-500
                    prose-ul:my-1
                    prose-ol:my-1
                    prose-li:my-0.5
                    prose-img:rounded-md overflow-x-auto whitespace-pre-line"
                  dangerouslySetInnerHTML={{ __html: post.post_content }}
                />
              ) : (
                <p className="text-center text-muted-foreground">Нет текстового содержания</p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between text-sm text-muted-foreground border-t pt-3">
                <div className="flex flex-wrap items-center gap-4 mb-2">
                  {post.likes !== null && post.likes !== undefined && (
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      <span>{post.likes.toLocaleString('ru-RU')} лайков</span>
                    </div>
                  )}
                  {post.views !== null && post.views !== undefined && (
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{post.views.toLocaleString('ru-RU')} просмотров</span>
                    </div>
                  )}
                  {post.comments !== null && post.comments !== undefined && (
                    <div className="flex items-center gap-1">
                      <span>💬</span>
                      <span>{post.comments.toLocaleString('ru-RU')} комментариев</span>
                    </div>
                  )}
                  {post.shares !== null && post.shares !== undefined && (
                    <div className="flex items-center gap-1">
                      <RefreshCw className="h-4 w-4" />
                      <span>{post.shares.toLocaleString('ru-RU')} репостов</span>
                    </div>
                  )}
                </div>
                {post.date && (
                  <span className="text-xs">
                    {new Date(post.date).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </div>
              {post.url && (
                <div className="mt-2 text-xs">
                  <a
                    href={ensureValidUrl(post.url) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Открыть оригинал
                  </a>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}