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

// Импортируем функцию createProxyImageUrl из utils
import { createProxyImageUrl } from "../utils/media";
import { ThumbsUp, MessageSquare, Eye, Share2, BookmarkPlus, Bookmark } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

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
  
  // Инициализируем пустую структуру для медиаданных
  let mediaData: MediaData = { 
    images: [], 
    videos: [] 
  };
  
  console.log(`[TrendDetail] Processing trend ${topic?.id}, media_links type:`, topic?.media_links ? typeof topic.media_links : 'undefined');
  
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
            console.log(`[TrendDetail] Parsed JSON data:`, parsedData);
            
            // Обработка разных форматов структуры данных
            if (parsedData.images && Array.isArray(parsedData.images) && parsedData.images.length > 0) {
              mediaData.images = parsedData.images.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
              console.log(`[TrendDetail] Found ${mediaData.images.length} images in parsed JSON`);
            }
            
            if (parsedData.videos && Array.isArray(parsedData.videos) && parsedData.videos.length > 0) {
              mediaData.videos = parsedData.videos.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
              console.log(`[TrendDetail] Found ${mediaData.videos.length} videos in parsed JSON`);
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
              console.log(`[TrendDetail] Extracted media from posts: ${mediaData.images.length} images, ${mediaData.videos.length} videos`);
            }
          } catch (e) {
            console.error(`[TrendDetail] Error parsing JSON string:`, e);
          }
        } else if (Array.isArray(mediaLinks)) {
          // Это массив постов или медиа URLs
          console.log(`[TrendDetail] Processing media_links as array:`, mediaLinks);
          
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
          console.log(`[TrendDetail] Extracted from array: ${mediaData.images.length} images, ${mediaData.videos.length} videos`);
        } else if (mediaLinks && typeof mediaLinks === 'object') {
          // Это уже объект с полями images и videos
          console.log(`[TrendDetail] Processing media_links as object:`, mediaLinks);
          
          if (mediaLinks.images && Array.isArray(mediaLinks.images)) {
            mediaData.images = mediaLinks.images.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
          }
          
          if (mediaLinks.videos && Array.isArray(mediaLinks.videos)) {
            mediaData.videos = mediaLinks.videos.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
          }
          
          console.log(`[TrendDetail] Extracted from object: ${mediaData.images.length} images, ${mediaData.videos.length} videos`);
        }
      }
    } catch (e) {
      console.error(`[TrendDetail] Error processing media data:`, e);
    }
  }
  
  // Не добавляем параметры для избежания кеширования к URL напрямую,
  // это будет делать функция createProxyImageUrl

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
                src={topic && mediaData.images?.[currentImageIndex] ? createProxyImageUrl(mediaData.images[currentImageIndex], topic.id) : ''}
                alt={topic.title}
                loading="lazy"
                className="w-full h-auto object-contain max-h-[60vh]"
                crossOrigin="anonymous"
                onError={(e) => {
                  console.log(`[TrendDetail] Ошибка загрузки изображения через прокси для тренда ${topic.id}`);
                  e.currentTarget.onerror = null;
                  
                  // Если прокси не работает, пробуем прямую ссылку или альтернативный метод
                  if (e.currentTarget.src.includes('/api/proxy-image')) {
                    if (mediaData.images?.[currentImageIndex]) {
                      // Получаем исходный URL изображения
                      const directUrl = mediaData.images[currentImageIndex];
                      console.log(`[TrendDetail] Пробуем альтернативную загрузку:`, directUrl);
                      
                      // Проверяем, является ли это Instagram URL
                      const isInstagram = directUrl.includes('instagram.') || 
                                      directUrl.includes('fbcdn.net') || 
                                      directUrl.includes('cdninstagram.com');
                      
                      // Добавляем cache-busting параметр
                      const urlWithNocache = directUrl.includes('?') 
                        ? `${directUrl}&_nocache=${Date.now()}` 
                        : `${directUrl}?_nocache=${Date.now()}`;
                      
                      // Для Instagram повторяем попытку через прокси с дополнительными параметрами
                      if (isInstagram) {
                        console.log(`[TrendDetail] Instagram URL обнаружен, используем специальный режим`);
                        // Используем нашу функцию с флагом _retry
                        const instagramUrl = createProxyImageUrl(urlWithNocache, topic.id);
                        const retryUrl = instagramUrl + "&_retry=true";
                        e.currentTarget.src = retryUrl;
                      } else {
                        // Для неинстаграмных URL используем прямую ссылку
                        console.log(`[TrendDetail] Обычный URL, пробуем прямую ссылку`);
                        e.currentTarget.src = urlWithNocache;
                        // Добавляем атрибут crossorigin для преодоления CORS
                        e.currentTarget.crossOrigin = "anonymous";
                      }
                    } else {
                      console.log(`[TrendDetail] Нет URL изображения в данных для тренда ${topic.id}`);
                      e.currentTarget.style.display = 'none';
                    }
                  } else {
                    console.log(`[TrendDetail] И прямая ссылка тоже не работает`);
                    e.currentTarget.style.display = 'none';
                  }
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
              src={topic && mediaData.videos?.[0] ? createProxyImageUrl(mediaData.videos[0], topic.id) : ''} 
              controls 
              className="w-full max-h-[60vh]"
              controlsList="nodownload"
              preload="metadata"
              crossOrigin="anonymous"
              onError={(e) => {
                console.log(`[TrendDetail] Ошибка загрузки видео через прокси для тренда ${topic.id}`);
                e.currentTarget.onerror = null;
                
                // Если прокси не работает, пробуем прямую ссылку или альтернативный метод
                if (e.currentTarget.src.includes('/api/proxy-image')) {
                  if (mediaData.videos?.[0]) {
                    // Получаем исходный URL видео
                    const directUrl = mediaData.videos[0];
                    console.log(`[TrendDetail] Пробуем альтернативную загрузку видео:`, directUrl);
                    
                    // Проверяем, является ли это специальным URL
                    const isTelegram = directUrl.includes('tgcnt.ru') || directUrl.includes('t.me');
                    
                    // Добавляем cache-busting параметр
                    const urlWithNocache = directUrl.includes('?') 
                      ? `${directUrl}&_nocache=${Date.now()}` 
                      : `${directUrl}?_nocache=${Date.now()}`;
                    
                    // Для Telegram пробуем специальную обработку
                    if (isTelegram) {
                      console.log(`[TrendDetail] Telegram видео обнаружено, используем специальный режим`);
                      // Используем нашу функцию с флагом _retry
                      const telegramUrl = createProxyImageUrl(urlWithNocache, topic.id);
                      const retryUrl = telegramUrl + "&_retry=true";
                      e.currentTarget.src = retryUrl;
                    } else {
                      // Для обычных видео используем прямую ссылку
                      console.log(`[TrendDetail] Обычное видео, пробуем прямую ссылку`);
                      e.currentTarget.src = urlWithNocache;
                      // Добавляем атрибут crossorigin для преодоления CORS
                      e.currentTarget.crossOrigin = "anonymous";
                    }
                  } else {
                    console.log(`[TrendDetail] Нет URL видео в данных для тренда ${topic.id}`);
                    e.currentTarget.style.display = 'none';
                  }
                } else {
                  console.log(`[TrendDetail] И прямая ссылка для видео тоже не работает`);
                  e.currentTarget.style.display = 'none';
                }
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
          <p className="font-medium">{topic.title}</p>
          {topic.description && (
            <p className="mt-2 text-gray-700">{topic.description}</p>
          )}
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