import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Импортируем функции для работы с медиа
import { createProxyImageUrl, createVideoThumbnailUrl, createStreamVideoUrl, isVideoUrl } from "../utils/media";
import { ThumbsUp, MessageSquare, Eye, Share2, BookmarkPlus, Bookmark, BookmarkCheck, ExternalLink, User, Video } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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
      return format(date, "d MMMM yyyy 'г.' HH:mm", { locale: ru });
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

  // Проверяем наличие видео
  const hasVideo = mediaData.videos && mediaData.videos.length > 0;
  const videoUrl = hasVideo ? mediaData.videos[0] : null;
  const isVkVideo = videoUrl && videoUrl.includes('vk.com/video');
  const isInstagramVideo = videoUrl && (
    videoUrl.includes('instagram.com/p/') || 
    videoUrl.includes('instagram.com/reel/') || 
    videoUrl.includes('instagram.com/reels/') ||
    (videoUrl.includes('instagram.') && (
      videoUrl.includes('.mp4') || 
      videoUrl.includes('fbcdn.net') || 
      videoUrl.endsWith('.mp4') || 
      videoUrl.includes('instagram.fuio')
    ))
  );
  
  // Состояние для хранения информации о видео ВКонтакте
  const [vkVideoInfo, setVkVideoInfo] = React.useState<{
    success: boolean;
    data?: {
      videoId: string;
      ownerId: string;
      videoLocalId: string;
      embedUrl: string;
      iframeUrl: string;
      directUrl: string;
    }
  } | null>(null);
  
  // Состояние для хранения информации о видео Instagram
  const [instagramVideoInfo, setInstagramVideoInfo] = React.useState<{
    success: boolean;
    data?: {
      postId: string;
      embedUrl: string;
      originalUrl: string;
      normalizedUrl: string;
    }
  } | null>(null);
  
  // Получаем информацию о видео ВКонтакте, если это необходимо
  React.useEffect(() => {
    if (isVkVideo && videoUrl) {
      fetch(`/api/vk-video-info?url=${encodeURIComponent(videoUrl)}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setVkVideoInfo(data);
          }
        })
        .catch(error => {
          console.error('Error fetching VK video info:', error);
        });
    }
  }, [isVkVideo, videoUrl]);
  
  // Получаем информацию о видео Instagram, если это необходимо
  React.useEffect(() => {
    if (isInstagramVideo && videoUrl) {
      fetch(`/api/instagram-video-info?url=${encodeURIComponent(videoUrl)}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setInstagramVideoInfo(data);
          }
        })
        .catch(error => {
          console.error('Error fetching Instagram video info:', error);
        });
    }
  }, [isInstagramVideo, videoUrl]);
  
  // Создаем проксированный URL только для первого изображения
  const imageUrl = mediaData.images && mediaData.images.length > 0 && !failedImages.has(mediaData.images[0])
    ? createProxyImageUrl(mediaData.images[0], topic.id)
    : null;
    
  // Создаем превью из видео, если у нас нет изображения, но есть видео
  const videoThumbnailUrl = !imageUrl && videoUrl ? createVideoThumbnailUrl(videoUrl, topic.id) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px] md:w-[650px] lg:w-[700px] p-0">
        <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold">{topic.title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              <a 
                href={topic.accountUrl || topic.sourceUrl || ""} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {sourceName || topic.sourceName || ''}
              </a>
            </DialogDescription>
          </DialogHeader>

          {/* Медиа контент */}
          {/* Если есть видео, показываем его */}
          {hasVideo && (
            <div className="mb-4">
              {/* Для видео ВКонтакте используем специальный формат ссылки */}
              {isVkVideo ? (
                <div className="aspect-video w-full rounded-md overflow-hidden relative">
                  {vkVideoInfo && vkVideoInfo.success ? (
                    <iframe 
                      src={`https://vk.com/video_ext.php?oid=${vkVideoInfo.data?.ownerId}&id=${vkVideoInfo.data?.videoLocalId}&hd=2`}
                      width="100%" 
                      height="100%" 
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;" 
                      frameBorder="0" 
                      allowFullScreen
                      className="aspect-video"
                    ></iframe>
                  ) : (
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center bg-slate-700 rounded-md h-full w-full p-4"
                    >
                      <div className="text-center text-white">
                        <Video className="h-12 w-12 mx-auto mb-3" />
                        <p className="text-sm">Открыть видео ВКонтакте</p>
                        <p className="text-xs mt-2 text-gray-300">(Загрузка информации о видео...)</p>
                      </div>
                    </a>
                  )}
                </div>
              ) : isInstagramVideo ? (
                <div className="aspect-square w-full rounded-md overflow-hidden relative">
                  {/* Если это прямая ссылка на видео файл Instagram (.mp4) */}
                  {videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('fbcdn.net')) ? (
                    <video 
                      src={createStreamVideoUrl(videoUrl, topic.id, 'instagram')}
                      controls
                      autoPlay={false}
                      loop={false}
                      muted={false}
                      playsInline
                      className="w-full max-h-[450px] object-contain"
                      crossOrigin="anonymous"
                    />
                  ) : instagramVideoInfo && instagramVideoInfo.success ? (
                    <iframe 
                      src={instagramVideoInfo.data?.embedUrl}
                      width="100%" 
                      height="100%" 
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;" 
                      frameBorder="0" 
                      allowFullScreen
                      className="aspect-square min-h-[450px]"
                    ></iframe>
                  ) : (
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center bg-slate-700 rounded-md h-full w-full p-4"
                    >
                      <div className="text-center text-white">
                        <Video className="h-12 w-12 mx-auto mb-3" />
                        <p className="text-sm">Открыть публикацию Instagram</p>
                        <p className="text-xs mt-2 text-gray-300">(Загрузка информации о публикации...)</p>
                      </div>
                    </a>
                  )}
                </div>
              ) : (
                <div className="relative">
                  {/* Для других типов видео используем наш новый стриминг API */}
                  {videoUrl ? (
                    <div className="aspect-video w-full rounded-md overflow-hidden relative">
                      <video 
                        src={createStreamVideoUrl(videoUrl, topic.id)}
                        controls
                        autoPlay={false}
                        loop={false}
                        muted={false}
                        playsInline
                        className="w-full max-h-[450px] object-contain"
                        poster={videoThumbnailUrl || undefined}
                        crossOrigin="anonymous"
                      />
                    </div>
                  ) : videoThumbnailUrl ? (
                    <div className="relative">
                      <img
                        src={videoThumbnailUrl}
                        alt={topic.title}
                        loading="lazy"
                        className="w-full h-auto max-h-[350px] max-w-full rounded-md object-contain mx-auto"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/60 rounded-full p-3">
                          <Video className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center bg-muted rounded-md h-[200px]">
                      <Video className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
              {videoUrl && (
                <div className="text-right mt-2">
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Открыть видео в источнике
                  </a>
                </div>
              )}
            </div>
          )}
          
          {/* Если нет видео, но есть изображение, показываем его */}
          {!hasVideo && imageUrl && (
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
              <span>{typeof topic.reactions === 'number' ? Math.round(topic.reactions).toLocaleString('ru-RU') : (topic.reactions ?? 0)} лайков</span>
              
              <span className="mx-1">•</span>
              
              <Eye className="h-4 w-4" />
              <span>{typeof topic.views === 'number' ? Math.round(topic.views).toLocaleString('ru-RU') : (topic.views ?? 0)} просмотров</span>
              
              <span className="mx-1">•</span>
              
              <MessageSquare className="h-4 w-4" />
              <span>{typeof topic.comments === 'number' ? Math.round(topic.comments).toLocaleString('ru-RU') : (topic.comments ?? 0)} комментариев</span>
            </div>
            
            {topic.reposts && topic.reposts > 0 && (
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                <span>{typeof topic.reposts === 'number' ? Math.round(topic.reposts).toLocaleString('ru-RU') : (topic.reposts ?? 0)} репостов</span>
              </div>
            )}
            
            <div className="mt-4 border-t pt-2 flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {/* Отображаем дату в полном формате */}
                  {(topic.created_at) ? 
                    new Date(topic.created_at).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) 
                    : ""}
                </span>
              </div>
              
              {topic.url && (
                <a 
                  href={topic.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  Открыть оригинал
                </a>
              )}
            </div>
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