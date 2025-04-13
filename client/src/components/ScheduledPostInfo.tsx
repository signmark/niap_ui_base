import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Clock, Instagram, AlertTriangle, CheckCircle2, Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateWithTimezone } from '@/lib/date-utils';

/**
 * Форматирует URL Telegram для правильного отображения
 * @param url URL Telegram для форматирования
 * @returns Форматированный URL
 */
const formatTelegramUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  // Проверяем, что это URL Telegram
  if (!url.includes('t.me')) return url;
  
  try {
    // Разбираем URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts.length === 0) return url;
    
    // ИСПРАВЛЕНИЕ: особый случай для URL вида https://t.me/-1002302366310
    // Формат отрицательных ID каналов/групп
    if (pathParts[0].startsWith('-100')) {
      // Отрицательные ID с -100 нужно форматировать в виде https://t.me/c/ID_БЕЗ_МИНУС_100
      const channelId = pathParts[0].substring(4); // Убираем -100
      const messageId = pathParts.length > 1 ? pathParts[1] : '';
      return `https://t.me/c/${channelId}${messageId ? `/${messageId}` : ''}`;
    }
    
    // ИСПРАВЛЕНИЕ: особый случай для других отрицательных ID
    if (pathParts[0].startsWith('-') && !pathParts[0].startsWith('-100')) {
      // Отрицательные ID нужно форматировать в виде https://t.me/c/ID_БЕЗ_МИНУСА
      const channelId = pathParts[0].substring(1); // Убираем только минус
      const messageId = pathParts.length > 1 ? pathParts[1] : '';
      return `https://t.me/c/${channelId}${messageId ? `/${messageId}` : ''}`;
    }
    
    // Проверяем, является ли первый сегмент пути числовым ID (проблемный случай)
    // Например: https://t.me/2302366310 (числовой ID канала без /c/)
    if (pathParts.length === 1 && pathParts[0].match(/^\d+$/)) {
      // Исправляем путь для числового ID (публичного канала), добавляя префикс /c/
      // Правильный формат для числовых ID каналов: https://t.me/c/1234567890/123
      // Но если нет ID поста, то этот вариант не сработает - нужно использовать ссылку для приватного канала
      // Возвращаем ссылку без изменений, так как она ведет на канал, а не конкретный пост
      if (url.split('/').length <= 4) {
        console.log('Обнаружен числовой ID канала Telegram без /c/ префикса', url);
        return `https://t.me/c/${pathParts[0]}`; // исправляем формат
      }
      
      // Если это URL с ID поста, форматируем правильно
      const messageId = pathParts.length > 1 ? pathParts[1] : '';
      return `https://t.me/c/${pathParts[0]}${messageId ? `/${messageId}` : ''}`;
    }
    
    // Фиксированная обработка URL-адресов Telegram
    // Пример: https://t.me/c/@ya_delayu_moschno/575 -> https://t.me/ya_delayu_moschno/575
    if (pathParts[0] === 'c') {
      // Имя канала следует за /c/
      let channelName = pathParts.length > 1 ? pathParts[1] : '';
      
      // Если имя канала начинается с @, удаляем его
      if (channelName.startsWith('@')) {
        channelName = channelName.substring(1);
      }
      
      // Если канал имеет числовой ID вместо имени (приватные каналы)
      if (channelName.match(/^\d+$/) && !channelName.startsWith('-100')) {
        // Сохраняем /c/ префикс для числовых ID - это правильный формат для приватных каналов
        return `https://t.me/c/${channelName}${pathParts.length > 2 ? `/${pathParts[2]}` : ''}`;
      }
      
      // Обычный случай - канал с именем
      return `https://t.me/${channelName}${pathParts.length > 2 ? `/${pathParts[2]}` : ''}`;
    } 
    
    // Проверяем, если имя пользователя начинается с @, удаляем символ @
    if (pathParts[0].startsWith('@')) {
      return `https://t.me/${pathParts[0].substring(1)}${pathParts.length > 1 ? `/${pathParts[1]}` : ''}`;
    }
    
    // Обычный URL для username: https://t.me/username/123
    return `https://t.me/${pathParts[0]}${pathParts.length > 1 ? `/${pathParts[1]}` : ''}`;
  } catch (error) {
    console.error('Ошибка при форматировании URL Telegram:', error);
    return url;
  }
};

interface SocialPublicationStatus {
  platform: string;
  status: 'pending' | 'published' | 'failed';
  publishedAt: string | null;
  postId?: string | null;
  postUrl?: string | null;
  error?: string | null;
}

interface ScheduledPostInfoProps {
  scheduledAt: string | null;
  publishedAt: string | null;
  socialPlatforms?: Record<string, SocialPublicationStatus> | null;
  compact?: boolean;
  className?: string;
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram size={14} />,
  telegram: <span className="text-xs">📱</span>,
  vk: <span className="text-xs">💬</span>,
  facebook: <span className="text-xs">👥</span>,
};

const platformNames: Record<string, string> = {
  instagram: "Instagram",
  telegram: "Telegram",
  vk: "ВКонтакте",
  facebook: "Facebook",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/30",
  published: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/30",
  failed: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/30",
};

export function ScheduledPostInfo({ scheduledAt, publishedAt, socialPlatforms, compact = false, className }: ScheduledPostInfoProps) {
  const hasPlatforms = socialPlatforms && Object.keys(socialPlatforms).length > 0;
  const isPublished = publishedAt !== null;
  const isScheduled = scheduledAt !== null && !isPublished;
  
  // If the post isn't scheduled or published, or there are no platforms, return null
  if ((!isScheduled && !isPublished) || !hasPlatforms) {
    return null;
  }
  
  // Convert null to undefined for type safety with Object methods
  const safeSocialPlatforms = socialPlatforms || {};

  // For compact display (inside a card)
  if (compact) {
    return (
      <div className={`flex flex-wrap gap-1.5 mt-2 ${className || ''}`}>
        {isScheduled && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="flex items-center gap-1 px-2 py-0.5 h-5 bg-muted/40">
                  <Clock size={12} />
                  <span className="text-[10px]">
                    {formatDateWithTimezone(scheduledAt)}
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Запланировано на {formatDateWithTimezone(scheduledAt)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {hasPlatforms && (
          <div className="flex gap-1">
            {Object.entries(safeSocialPlatforms).map(([platform, status]) => {
              const statusIcon = 
                status.status === 'published' ? <CheckCircle2 size={12} /> :
                status.status === 'failed' ? <AlertTriangle size={12} /> :
                <Clock size={12} />;
              
              return (
                <TooltipProvider key={platform}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className={`flex items-center gap-1 px-1.5 py-0.5 h-5 ${
                          statusColors[status.status] || "bg-muted/40"
                        }`}
                      >
                        {platformIcons[platform] || platform.substring(0, 1).toUpperCase()}
                        {statusIcon}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="font-medium">{platformNames[platform] || platform}</p>
                      <p className="text-xs">
                        {status.status === 'published' 
                          ? `Опубликовано ${formatDateWithTimezone(status.publishedAt)}`
                          : status.status === 'failed'
                            ? `Не удалось опубликовать: ${status.error || 'Ошибка публикации'}`
                            : 'Ожидает публикации'
                        }
                      </p>
                      {status.postUrl && (
                        <p className="text-xs mt-1">
                          <a 
                            href={platform === 'telegram' ? formatTelegramUrl(status.postUrl!) || status.postUrl : status.postUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            Посмотреть публикацию
                          </a>
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  // Full display (for details view)
  return (
    <div className={`space-y-3 mt-4 ${className || ''}`}>
      <h4 className="text-sm font-medium">Информация о публикации</h4>
      
      {isScheduled && (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="text-muted-foreground" size={16} />
          <span>Запланировано на {formatDateWithTimezone(scheduledAt)}</span>
        </div>
      )}
      
      {hasPlatforms && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">Платформы:</h5>
          <div className="grid gap-2">
            {Object.entries(safeSocialPlatforms).map(([platform, status]) => (
              <div 
                key={platform} 
                className={`flex items-center justify-between p-2 rounded-md border ${
                  statusColors[status.status] || "bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    {platformIcons[platform] || platform.substring(0, 1).toUpperCase()}
                  </div>
                  <span>{platformNames[platform] || platform}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">
                    {status.status === 'published' 
                      ? `Опубликовано ${formatDateWithTimezone(status.publishedAt)}`
                      : status.status === 'failed'
                        ? 'Не удалось опубликовать'
                        : 'Ожидает публикации'
                    }
                  </span>
                  {status.status === 'published' ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : status.status === 'failed' ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle size={14} className="text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{status.error || 'Ошибка публикации'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Clock size={14} className="text-amber-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Links to published posts if available */}
          {Object.values(safeSocialPlatforms).some(status => status.postUrl) && (
            <div className="mt-2">
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Ссылки на публикации:</h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(safeSocialPlatforms)
                  .filter(([_, status]) => status.postUrl)
                  .map(([platform, status]) => (
                    <a 
                      key={platform}
                      href={platform === 'telegram' ? formatTelegramUrl(status.postUrl!) || status.postUrl! : status.postUrl!} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline flex items-center gap-1"
                    >
                      {platformIcons[platform] || platform.substring(0, 1).toUpperCase()}
                      <span>{platformNames[platform] || platform}</span>
                    </a>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}