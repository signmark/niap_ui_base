import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Импортируем функцию createProxyImageUrl из utils
import { createProxyImageUrl } from "../utils/media";
import { ThumbsUp, MessageSquare, Eye, Share2, BookmarkPlus, Bookmark, BookmarkCheck, ExternalLink, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";

interface MediaData {
  images: string[];
  videos: string[];
}

interface TrendTopic {
  id: string;
  title: string;
  description?: string; // Добавляем поле description
  source_id: string;
  reactions: number;
  comments: number;
  views: number;
  created_at: string;
  is_bookmarked: boolean;
  campaign_id: string;
  media_links?: string;
  mediaLinks?: string; // Альтернативное имя поля (для обратной совместимости)
  url?: string; // URL оригинальной публикации
  sourceUrl?: string; // URL источника (аккаунта или страницы)
  reposts?: number; // Количество репостов
}

interface TrendDetailDialogProps {
  topic: TrendTopic | null;
  isOpen: boolean;
  onClose: () => void;
  onBookmark: (id: string, isBookmarked: boolean) => void;
  sourceName?: string;
}

export function TrendDetailDialog({
  topic,
  isOpen,
  onClose,
  onBookmark,
  sourceName
}: TrendDetailDialogProps) {
  // Нет необходимости в отслеживании индекса изображения, т.к. показываем только первое
  const [failedImages, setFailedImages] = React.useState<Set<string>>(new Set());
  
  // Инициализируем пустую структуру для медиаданных
  let mediaData: MediaData = { 
    images: [], 
    videos: [] 
  };
  
  // Обработка медиа данных из темы
  if (topic) {
    try {
      // Пробуем сначала обработать новое поле mediaLinks
      if (topic.mediaLinks || topic.media_links) {
        const mediaLinks = topic.mediaLinks || topic.media_links;
        
        // Анализ типа данных
        if (typeof mediaLinks === 'string') {
          // Это JSON строка, пробуем распарсить
          try {
            const parsedData = JSON.parse(mediaLinks);
            
            // Обработка разных форматов структуры данных
            if (parsedData.images && Array.isArray(parsedData.images) && parsedData.images.length > 0) {
              mediaData.images = parsedData.images.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
            }
            
            if (parsedData.videos && Array.isArray(parsedData.videos) && parsedData.videos.length > 0) {
              mediaData.videos = parsedData.videos.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
            }
            
            // Проверка формата с постами
            if (parsedData.posts && Array.isArray(parsedData.posts) && parsedData.posts.length > 0) {
              for (const post of parsedData.posts) {
                if (post.image_url) {
                  mediaData.images.push(post.image_url);
                }
                if (post.video_url) {
                  mediaData.videos.push(post.video_url);
                }
              }
            }
          } catch (e) {
            console.error(`[TrendDetail] Error parsing JSON string:`, e);
          }
        } else if (Array.isArray(mediaLinks)) {
          // Это массив постов или медиа URLs
          
          for (const item of mediaLinks) {
            if (typeof item === 'string') {
              // Это прямая ссылка на изображение/видео
              if (item.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i)) {
                mediaData.images.push(item);
              } else if (item.match(/\.(mp4|webm|ogg|mov)($|\?)/i)) {
                mediaData.videos.push(item);
              }
            } else if (item && typeof item === 'object') {
              // Это объект поста
              if (item.image_url) {
                mediaData.images.push(item.image_url);
              }
              if (item.video_url) {
                mediaData.videos.push(item.video_url);
              }
            }
          }
        } else if (mediaLinks && typeof mediaLinks === 'object') {
          // Это уже объект с полями images и videos
          
          if (mediaLinks.images && Array.isArray(mediaLinks.images)) {
            mediaData.images = mediaLinks.images.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
          }
          
          if (mediaLinks.videos && Array.isArray(mediaLinks.videos)) {
            mediaData.videos = mediaLinks.videos.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
          }
        }
      }
    } catch (e) {
      console.error(`[TrendDetail] Error processing media data:`, e);
    }
  }

  // Функция для форматирования даты создания
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true, locale: ru });
    } catch (e) {
      return dateString;
    }
  };

  // Удалены функции навигации по изображениям, т.к. мы показываем только первое изображение

  // Обработчик ошибки загрузки изображения
  const handleImageError = (imageUrl: string) => {
    console.log("Failed to load image:", imageUrl);
    setFailedImages(prev => new Set(prev).add(imageUrl));
  };

  if (!topic) return null;

  // Создаем проксированный URL только для первого изображения
  const imageUrl = mediaData.images && mediaData.images.length > 0 && !failedImages.has(mediaData.images[0])
    ? createProxyImageUrl(mediaData.images[0], topic.id)
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px] md:w-[650px] lg:w-[700px] p-0">
        <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-rounded-md scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold">{topic.title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {sourceName || 'Неизвестный источник'} • {formatDate(topic.created_at)}
            </DialogDescription>
          </DialogHeader>

          {/* Медиа контент */}
          {imageUrl && (
            <div className="mb-4">
              <img
                src={imageUrl}
                alt={topic.title}
                loading="lazy"
                className="w-full h-auto max-h-[350px] max-w-full rounded-md object-contain mx-auto"
                crossOrigin="anonymous"
                onError={() => handleImageError(mediaData.images[0])}
              />
              {topic.url && (
                <div className="text-right mt-2">
                  <a
                    href={topic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Открыть оригинал
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Текст публикации */}
          {topic.description ? (
            <div className="font-normal whitespace-pre-line mt-4 text-base leading-normal">{topic.description}</div>
          ) : (
            <div className="font-normal whitespace-pre-line mt-4 text-base leading-normal">{topic.title}</div>
          )}

          {/* Разделитель */}
          <Separator className="my-4" />

          {/* Статистика в стиле как на скриншоте */}
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4" />
              <span>{topic.reactions?.toLocaleString('ru-RU') ?? 0} лайков</span>
              
              <span className="mx-1">•</span>
              
              <Eye className="h-4 w-4" />
              <span>{topic.views?.toLocaleString('ru-RU') ?? 0} просмотров</span>
              
              <span className="mx-1">•</span>
              
              <MessageSquare className="h-4 w-4" />
              <span>{topic.comments?.toLocaleString('ru-RU') ?? 0} комментариев</span>
            </div>
            
            {topic.reposts && topic.reposts > 0 && (
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                <span>{topic.reposts?.toLocaleString('ru-RU')} репостов</span>
              </div>
            )}
            
            <div>
              {new Date(topic.created_at).toLocaleDateString('ru-RU')}
            </div>
            
            {topic.url && (
              <div>
                <a 
                  href={topic.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  Открыть оригинал
                </a>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onBookmark(topic.id, !topic.is_bookmarked)}
            >
              {topic.is_bookmarked ? (
                <BookmarkCheck className="h-5 w-5 text-primary" />
              ) : (
                <BookmarkPlus className="h-5 w-5" />
              )}
              <span className="ml-2">
                {topic.is_bookmarked ? "Убрать из закладок" : "Добавить в закладки"}
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}