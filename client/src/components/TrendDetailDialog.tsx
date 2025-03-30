import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

// Импортируем функции для работы с медиа
import { createProxyImageUrl, createVideoThumbnailUrl, createStreamVideoUrl, isVideoUrl } from "../utils/media";
import { ThumbsUp, MessageSquare, Eye, Share2, BookmarkPlus, Bookmark, BookmarkCheck, ExternalLink, User, Video, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { handleInstagramVideoError } from "./instagram-error-handler";
import { TrendTopic } from "../lib/interfaces";
import { MediaAnalysisButton } from "./MediaAnalysisButton";

interface MediaData {
  images: string[];
  videos: string[];
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
  const [videoLoadError, setVideoLoadError] = React.useState(false);
  const { toast } = useToast();
  
  // Вспомогательная функция для безопасного отображения данных
  const safeRender = (item: any): string => {
    if (typeof item === 'string') {
      return item;
    } else if (typeof item === 'object' && item !== null) {
      // Приоритет для поля text, которое добавляется сервером при обработке
      if ('text' in item) {
        return item.text;
      } 
      // Обработка объектов с полями name и quantity
      else if ('name' in item) {
        return item.quantity ? `${item.name} (${item.quantity})` : item.name;
      }
      // Для других объектов - преобразуем в JSON строку
      return JSON.stringify(item);
    }
    // Преобразуем все остальные типы в строку
    return String(item);
  };
  
  // Инициализируем пустую структуру для медиаданных
  let mediaData: MediaData = { 
    images: [], 
    videos: [] 
  };
  
  // Обработка медиа данных из темы
  if (topic) {
    try {
      console.log("[TrendDetail] Исходные данные медиа в теме:", {
        mediaLinks: topic.mediaLinks,
        media_links: topic.media_links,
        hasVideoProp: topic.hasVideos || topic.hasVideo,
        hasVideo: Boolean(topic.hasVideos || topic.hasVideo)
      });

      // Проверяем, есть ли явное указание на наличие видео
      if (topic.hasVideos || topic.hasVideo) {
        console.log("[TrendDetail] Тренд имеет явное указание на видео");
      }
      
      // Пробуем сначала обработать новое поле mediaLinks
      if (topic.mediaLinks || topic.media_links) {
        const mediaLinks = topic.mediaLinks || topic.media_links;
        
        // Анализ типа данных
        if (typeof mediaLinks === 'string') {
          // Это JSON строка, пробуем распарсить
          try {
            // Удаляем лишние кавычки и экранирование - проблема с двойным экранированием
            let cleanMediaLinks = mediaLinks;
            
            // Если строка начинается и заканчивается кавычками, удаляем их
            if (cleanMediaLinks.startsWith('"') && cleanMediaLinks.endsWith('"')) {
              cleanMediaLinks = cleanMediaLinks.slice(1, -1);
              // Заменяем экранированные кавычки на обычные
              cleanMediaLinks = cleanMediaLinks.replace(/\\"/g, '"');
            }
            
            console.log("[TrendDetail] Очищенная строка mediaLinks:", cleanMediaLinks);
            
            const parsedData = JSON.parse(cleanMediaLinks);
            console.log("[TrendDetail] Распарсенные данные:", parsedData);
            
            // Обработка разных форматов структуры данных
            if (parsedData.images && Array.isArray(parsedData.images) && parsedData.images.length > 0) {
              mediaData.images = parsedData.images.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
            }
            
            if (parsedData.videos && Array.isArray(parsedData.videos) && parsedData.videos.length > 0) {
              mediaData.videos = parsedData.videos.filter((url: string) => url && typeof url === 'string' && url.trim() !== '');
              console.log("[TrendDetail] Найдены URL видео после фильтрации:", mediaData.videos);
            }
            
            // Проверка формата с постами
            if (parsedData.posts && Array.isArray(parsedData.posts) && parsedData.posts.length > 0) {
              for (const post of parsedData.posts) {
                if (post.image_url) {
                  mediaData.images.push(post.image_url);
                }
                if (post.video_url) {
                  mediaData.videos.push(post.video_url);
                  console.log("[TrendDetail] Найдено видео в посте:", post.video_url);
                }
              }
            }
          } catch (e) {
            console.error(`[TrendDetail] Error parsing JSON string:`, e);
          }
        } else if (Array.isArray(mediaLinks)) {
          // Массив объектов, обрабатываем каждый элемент
          for (const item of mediaLinks) {
            if (item.image_url) {
              mediaData.images.push(item.image_url);
            }
            if (item.video_url) {
              mediaData.videos.push(item.video_url);
            }
          }
        }
      }
    } catch (e) {
      console.error("[TrendDetail] Error processing media data:", e);
    }
  }
  
  // Обработка ошибки загрузки изображения
  const handleImageError = (imageUrl: string) => {
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(imageUrl);
      return newSet;
    });
  };
  
  if (!topic) {
    return null;
  }
  
  // Проверяем, есть ли у нас видео в трендах
  const videoUrl: string | undefined = mediaData.videos && mediaData.videos.length > 0 ? mediaData.videos[0] : undefined;
  
  // Используем либо найденное видео URL, либо явный флаг hasVideo из темы
  const hasVideo = Boolean(videoUrl) || Boolean(topic.hasVideos || topic.hasVideo);

  // Отладочная информация
  console.log("[TrendDetail] Видеоданные:", {
    mediaData,
    videoUrl,
    hasVideo,
    mediaLinksSource: topic.mediaLinks || topic.media_links,
    topicHasVideo: topic.hasVideo,
    topicHasVideos: topic.hasVideos
  });
  
  // Обрабатываем случай, когда в videoUrl приходит еще экранированная строка
  let processedVideoUrl = videoUrl;
  if (videoUrl && typeof videoUrl === 'string' && (videoUrl.startsWith('\\\"') || videoUrl.startsWith('"\\\"'))) {
    try {
      // Если строка начинается с экранированных кавычек, это может быть случай двойного экранирования
      let tempUrl = videoUrl;
      if (tempUrl.startsWith('"') && tempUrl.endsWith('"')) {
        tempUrl = tempUrl.slice(1, -1);
      }
      // Удаляем лишние экранирования
      tempUrl = tempUrl.replace(/\\\"/g, '"').replace(/\\\\/g, '\\');
      console.log("[TrendDetail] Обработан экранированный URL видео:", tempUrl);
      processedVideoUrl = tempUrl;
    } catch (e) {
      console.error("[TrendDetail] Ошибка при обработке экранированного URL видео:", e);
    }
  }

  // Определяем тип источника видео для соответствующей обработки
  const isInstagramVideo = processedVideoUrl && (
    processedVideoUrl.includes('instagram.com/p/') || 
    processedVideoUrl.includes('instagram.com/reel/') || 
    processedVideoUrl.includes('instagram.com/reels/') ||
    processedVideoUrl.includes('cdninstagram.com') || 
    processedVideoUrl.includes('fbcdn.net') ||
    processedVideoUrl.includes('scontent.') ||  // домены scontent часто встречаются в CDN Instagram
    (processedVideoUrl.includes('.mp4') && (
      processedVideoUrl.includes('ig_') || 
      processedVideoUrl.includes('instagram')
    )) ||
    processedVideoUrl.includes('HBksFQIYUmlnX') || // маркер Instagram видео
    processedVideoUrl.includes('_nc_vs=') ||     // другой маркер Instagram видео
    processedVideoUrl.includes('efg=')          // еще один маркер Instagram видео
  );
    
  if (isInstagramVideo) {
    console.log(`[TrendDetail] Определено как Instagram видео: ${isInstagramVideo}`);
  }
  
  // Состояние для хранения информации о видео ВКонтакте
  const [vkVideoInfo, setVkVideoInfo] = React.useState<{
    success: boolean;
    data?: {
      videoId: string;
      ownerId: string;
      videoLocalId: string;
      embedUrl: string;
    }
  } | null>(null);
  
  // Состояние для хранения информации о видео Instagram
  const [instagramVideoInfo, setInstagramVideoInfo] = React.useState<{
    success: boolean;
    data?: {
      videoUrl: string;
      thumbnailUrl: string;
    }
  } | null>(null);
  
  // Проверяем URL для ВК видео
  React.useEffect(() => {
    // Специальная обработка для видео ВКонтакте
    if (videoUrl && videoUrl.includes('vk.com/video')) {
      console.log("[TrendDetail] Обрабатываем видео ВКонтакте:", videoUrl);
      
      fetch(`/api/vk-video-info?url=${encodeURIComponent(videoUrl)}`)
        .then(response => response.json())
        .then(data => {
          console.log("[TrendDetail] Получена информация о видео ВК:", data);
          if (data.success) {
            setVkVideoInfo(data);
          } else {
            console.warn("[TrendDetail] Не удалось получить данные видео ВК:", data.error || "Неизвестная ошибка");
          }
        })
        .catch(error => {
          console.error('[TrendDetail] Error fetching VK video info:', error);
        });
    }
  }, [videoUrl]);
  
  // Проверяем URL для Instagram видео
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              {sourceName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-normal text-sm">{sourceName}</span>
                </div>
              )}
              {topic.accountUrl && (
                <a 
                  href={topic.accountUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {topic.sourceName || "Профиль"}
                </a>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {/* Медиа: видео или изображение */}
          {hasVideo && (
            <div className="mb-4">
              {vkVideoInfo?.success ? (
                <div className="aspect-video w-full rounded-md overflow-hidden">
                  <iframe 
                    src={vkVideoInfo.data?.embedUrl} 
                    width="100%" 
                    height="100%" 
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture;" 
                    frameBorder="0"
                    className="w-full min-h-[300px]"
                  />
                </div>
              ) : isInstagramVideo ? (
                <div className="aspect-square w-full rounded-md overflow-hidden relative">
                  {/* Состояние загрузки видео */}
                  {!videoUrl ? (
                    <div className="flex items-center justify-center bg-slate-700 rounded-md h-full w-full p-4">
                      <div className="text-center text-white">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3" />
                        <p className="text-sm">Загрузка видео...</p>
                      </div>
                    </div>
                  ) : (
                    // Прямая ссылка на видео из Instagram - используем Video тег для прямого воспроизведения
                    <video 
                      src={processedVideoUrl || ''}
                      controls
                      autoPlay={false}
                      loop={false}
                      muted={false}
                      playsInline
                      className="w-full max-h-[450px] object-contain"
                      crossOrigin="anonymous"
                      onLoadStart={() => {
                        setVideoLoadError(false);
                        console.log("[TrendDetail] Начало загрузки Instagram видео напрямую");
                      }}
                      onError={(e) => {
                        console.log(`[TrendDetail] Ошибка воспроизведения Instagram видео напрямую: ${processedVideoUrl}`, e);
                        setVideoLoadError(true);
                        // При ошибке воспроизведения предлагаем открыть оригинальный источник
                        e.currentTarget.style.display = 'none';
                        const errorContainer = document.createElement('div');
                        errorContainer.className = "flex items-center justify-center bg-slate-700 rounded-md h-full w-full p-4 absolute inset-0";
                        errorContainer.innerHTML = `
                          <div class="text-center text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3">
                              <polygon points="23 7 16 12 23 17 23 7"></polygon>
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                            </svg>
                            <p class="text-sm">Ошибка воспроизведения видео</p>
                            <a href="${processedVideoUrl}" target="_blank" rel="noopener noreferrer" class="text-xs mt-2 text-blue-300 hover:underline block">
                              Открыть оригинал
                            </a>
                          </div>
                        `;
                        e.currentTarget.parentNode?.appendChild(errorContainer);
                      }}
                    />
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
                        onLoadStart={() => {
                          setVideoLoadError(false);
                          console.log("[TrendDetail] Начало загрузки обычного видео");
                        }}
                        onError={(e) => {
                          console.log(`[TrendDetail] Ошибка воспроизведения обычного видео: ${videoUrl}`, e);
                          setVideoLoadError(true);
                          // При ошибке воспроизведения предлагаем открыть оригинальный источник
                          e.currentTarget.style.display = 'none';
                          const errorContainer = document.createElement('div');
                          errorContainer.className = "flex items-center justify-center bg-slate-700 rounded-md h-full w-full p-4 absolute inset-0";
                          errorContainer.innerHTML = `
                            <div class="text-center text-white">
                              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3">
                                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                              </svg>
                              <p class="text-sm">Ошибка воспроизведения видео</p>
                              <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="text-xs mt-2 text-blue-300 hover:underline block">
                                Открыть оригинал
                              </a>
                            </div>
                          `;
                          e.currentTarget.parentNode?.appendChild(errorContainer);
                        }}
                      />
                      
                      {/* Кнопка анализа видео */}
                      {mediaData.videos && mediaData.videos.length > 0 && (
                        <div className="absolute bottom-2 right-2 z-10">
                          <MediaAnalysisButton 
                            mediaUrl={mediaData.videos[0]} 
                            trendId={topic.id}
                            buttonText={topic.media_analysis ? "Просмотреть анализ" : "Анализировать"} 
                            buttonVariant="secondary" 
                            existingAnalysis={topic.media_analysis}
                            onAnalysisComplete={() => queryClient.invalidateQueries({ queryKey: ["/api/campaign-trends"] })}
                          />
                        </div>
                      )}
                    </div>
                  ) : videoThumbnailUrl ? (
                    <div className="relative">
                      <img
                        src={videoThumbnailUrl}
                        alt={topic.media_analysis && topic.media_analysis.description 
                          ? topic.media_analysis.description 
                          : topic.title}
                        loading="lazy"
                        className="w-full h-auto max-h-[350px] max-w-full rounded-md object-contain mx-auto"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/60 rounded-full p-3">
                          <Video className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      
                      {/* Кнопка анализа видео */}
                      {mediaData.videos && mediaData.videos.length > 0 && (
                        <div className="absolute bottom-2 right-2">
                          <MediaAnalysisButton 
                            mediaUrl={mediaData.videos[0]} 
                            trendId={topic.id}
                            buttonText={topic.media_analysis ? "Просмотреть анализ" : "Анализировать"} 
                            buttonVariant="secondary" 
                            existingAnalysis={topic.media_analysis}
                            onAnalysisComplete={() => queryClient.invalidateQueries({ queryKey: ['/api/campaign-trends'] })}
                          />
                        </div>
                      )}
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
              <div className="relative">
                <img
                  src={imageUrl}
                  alt={topic.media_analysis && topic.media_analysis.description 
                    ? topic.media_analysis.description 
                    : topic.title}
                  loading="lazy"
                  className="w-full h-auto max-h-[350px] max-w-full rounded-md object-contain mx-auto"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.log(`[TrendDetail] Ошибка загрузки изображения: ${imageUrl}`, e);
                    // При ошибке загрузки изображения пробуем другое из массива или показываем ошибку
                    if (mediaData.images && mediaData.images.length > 0) {
                      handleImageError(mediaData.images[0]);
                    } else {
                      // Если нет альтернативных изображений, показываем ошибку
                      e.currentTarget.style.display = 'none';
                      const errorContainer = document.createElement('div');
                      errorContainer.className = "flex items-center justify-center bg-slate-100 rounded-md h-[200px] w-full";
                      errorContainer.innerHTML = `
                        <div class="text-center text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                            <circle cx="9" cy="9" r="2"></circle>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                          </svg>
                          <p class="text-sm">Ошибка загрузки изображения</p>
                          ${topic.url ? `<a href="${topic.url}" target="_blank" rel="noopener noreferrer" class="text-xs mt-2 text-blue-500 hover:underline block">Открыть оригинал</a>` : ''}
                        </div>
                      `;
                      e.currentTarget.parentNode?.appendChild(errorContainer);
                    }
                  }}
                />
                
                {/* Кнопка анализа изображения */}
                {mediaData.images && mediaData.images.length > 0 && (
                  <div className="absolute bottom-2 right-2">
                    <MediaAnalysisButton 
                      mediaUrl={mediaData.images[0]} 
                      trendId={topic.id}
                      buttonText={topic.media_analysis ? "Просмотреть анализ" : "Анализировать"} 
                      buttonVariant="secondary" 
                      existingAnalysis={topic.media_analysis}
                      onAnalysisComplete={() => queryClient.invalidateQueries({ queryKey: ['/api/campaign-trends'] })}
                    />
                  </div>
                )}
              </div>
              
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
          
          {/* Результаты анализа медиаконтента (если есть) */}
          {topic.media_analysis && (
            <div className="mt-4 bg-gray-50 p-3 rounded-md border border-gray-100">
              <h3 className="text-md font-medium mb-2">Анализ медиаконтента</h3>
              <div className="space-y-2 text-sm">
                {topic.media_analysis.description && (
                  <div>
                    <span className="font-medium">Описание: </span>
                    <span>{topic.media_analysis.description}</span>
                  </div>
                )}
                
                {topic.media_analysis.objects && topic.media_analysis.objects.length > 0 && (
                  <div>
                    <span className="font-medium">Объекты: </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {topic.media_analysis.objects.map((obj, i) => (
                        <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {safeRender(obj)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {topic.media_analysis.mood && (
                  <div>
                    <span className="font-medium">Настроение: </span>
                    <span>{topic.media_analysis.mood}</span>
                  </div>
                )}
                
                {topic.media_analysis.colors && topic.media_analysis.colors.length > 0 && (
                  <div>
                    <span className="font-medium">Основные цвета: </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {topic.media_analysis.colors.map((color, i) => (
                        <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {safeRender(color)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
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

          {/* Кнопка для анализа медиаконтента */}
          {/* Удалена общая кнопка анализа медиаконтента, поскольку теперь
             результаты анализа отображаются в карточке тренда и
             у каждого изображения/видео есть своя кнопка анализа */}

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