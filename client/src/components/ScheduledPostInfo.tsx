import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Clock, Instagram, AlertTriangle, CheckCircle2, Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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
                    {format(new Date(scheduledAt), 'dd.MM HH:mm')}
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Запланировано на {format(new Date(scheduledAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>
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
                          ? `Опубликовано ${status.publishedAt ? format(new Date(status.publishedAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : ''}`
                          : status.status === 'failed'
                            ? `Не удалось опубликовать: ${status.error || 'Ошибка публикации'}`
                            : 'Ожидает публикации'
                        }
                      </p>
                      {status.postUrl && (
                        <p className="text-xs mt-1">
                          <a 
                            href={status.postUrl} 
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
          <span>Запланировано на {format(new Date(scheduledAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
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
                      ? `Опубликовано ${status.publishedAt ? format(new Date(status.publishedAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : ''}`
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
          {Object.values(socialPlatforms).some(status => status.postUrl) && (
            <div className="mt-2">
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Ссылки на публикации:</h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(socialPlatforms)
                  .filter(([_, status]) => status.postUrl)
                  .map(([platform, status]) => (
                    <a 
                      key={platform}
                      href={status.postUrl!} 
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