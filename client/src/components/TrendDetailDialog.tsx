import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThumbsUp, MessageSquare, Eye, Share2, BookmarkPlus, Bookmark } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface MediaData {
  images?: string[];
  videos?: string[];
}

interface TrendTopic {
  id: string;
  title: string;
  source_id: string;
  reactions: number;
  comments: number;
  views: number;
  created_at: string;
  is_bookmarked: boolean;
  campaign_id: string;
  media_links?: string;
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
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  
  // Создаем статическое тестовое изображение
  const tempImageId = parseInt((topic?.id || '').replace(/\D/g, '').substring(0, 2) || '1') % 20 + 1;
  const tempImageUrl = `https://picsum.photos/id/${100 + tempImageId}/800/600`;
  
  // Разбор JSON из поля media_links
  let mediaData: MediaData = { 
    images: [tempImageUrl], 
    videos: [] 
  };
  
  if (topic?.media_links) {
    try {
      const parsedData = JSON.parse(topic.media_links);
      // Проверяем, есть ли реальные изображения и видео
      if (parsedData.images && Array.isArray(parsedData.images) && parsedData.images.length > 0) {
        mediaData.images = parsedData.images;
      }
      
      if (parsedData.videos && Array.isArray(parsedData.videos) && parsedData.videos.length > 0) {
        mediaData.videos = parsedData.videos;
      }
    } catch (e) {
      console.error('Ошибка разбора JSON в media_links:', e);
      // Оставляем изображения по умолчанию
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

  // Следующее изображение
  const nextImage = () => {
    if (!mediaData.images || mediaData.images.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % mediaData.images!.length);
  };

  // Предыдущее изображение
  const prevImage = () => {
    if (!mediaData.images || mediaData.images.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + mediaData.images!.length) % mediaData.images!.length);
  };

  if (!topic) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{topic.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {sourceName || 'Неизвестный источник'} • {formatDate(topic.created_at)}
          </DialogDescription>
        </DialogHeader>

        {/* Медиа контент */}
        {mediaData.images && mediaData.images.length > 0 && (
          <div className="relative">
            <div className="aspect-video relative">
              <img
                src={mediaData.images[currentImageIndex]}
                alt={topic.title}
                className="w-full h-auto object-contain"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = 'https://placehold.co/600x400/jpeg?text=Изображение+недоступно';
                }}
              />
              {mediaData.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                  >
                    ←
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                  >
                    →
                  </button>
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    {currentImageIndex + 1} / {mediaData.images.length}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Видео контент */}
        {mediaData.videos && mediaData.videos.length > 0 && (
          <div className="mt-4">
            <video 
              src={mediaData.videos[0]} 
              controls 
              className="w-full"
              controlsList="nodownload"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '';
              }}
            />
            {mediaData.videos.length > 1 && (
              <div className="text-sm text-muted-foreground mt-1">
                и еще {mediaData.videos.length - 1} видео
              </div>
            )}
          </div>
        )}

        {/* Текст публикации */}
        <div className="my-4 text-base">
          <p>{topic.title}</p>
        </div>

        {/* Статистика */}
        <div className="flex justify-between items-center py-3 border-t border-b">
          <div className="flex items-center gap-5">
            <div className="flex items-center">
              <ThumbsUp className="h-4 w-4 mr-1" />
              <span>{topic.reactions?.toLocaleString() ?? 0}</span>
            </div>
            <div className="flex items-center">
              <MessageSquare className="h-4 w-4 mr-1" />
              <span>{topic.comments?.toLocaleString() ?? 0}</span>
            </div>
            <div className="flex items-center">
              <Eye className="h-4 w-4 mr-1" />
              <span>{topic.views?.toLocaleString() ?? 0}</span>
            </div>
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onBookmark(topic.id, !topic.is_bookmarked)}
            >
              {topic.is_bookmarked ? (
                <Bookmark className="h-4 w-4 text-primary mr-1" />
              ) : (
                <BookmarkPlus className="h-4 w-4 mr-1" />
              )}
              {topic.is_bookmarked ? "Сохранено" : "Сохранить"}
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}