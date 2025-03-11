import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublishingStatusProps {
  contentId: string;
  className?: string;
}

interface PlatformStatus {
  status: 'pending' | 'publishing' | 'published' | 'failed';
  publishedAt?: string | null;
  postUrl?: string | null;
  error?: string | null;
}

interface StatusResponse {
  success: boolean;
  status: {
    platforms: Record<string, PlatformStatus>;
  };
  platforms: Record<string, PlatformStatus>;
}

const platformIcons: Record<string, string> = {
  instagram: '📸',
  telegram: '📱',
  vk: '💬',
  facebook: '👥'
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
  publishing: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
  published: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
  failed: 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
};

export function PublishingStatus({ contentId, className }: PublishingStatusProps) {
  const [pollingEnabled, setPollingEnabled] = useState(false);
  
  const { data, isLoading, isError } = useQuery({
    queryKey: ['publishing-status', contentId],
    queryFn: async () => {
      const response = await fetch(`/api/content/${contentId}/publish-status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Ошибка при получении статуса публикации');
      }
      return response.json() as Promise<StatusResponse>;
    },
    enabled: pollingEnabled,
    refetchInterval: 5000, // Опрашиваем каждые 5 секунд
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true
  });
  
  useEffect(() => {
    // Включаем polling если есть платформы в процессе публикации
    if (data?.platforms) {
      const hasPublishingPlatforms = Object.values(data.platforms).some(
        platform => platform.status === 'publishing' || platform.status === 'pending'
      );
      setPollingEnabled(hasPublishingPlatforms);
    }
  }, [data]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  if (isError || !data) {
    return null;
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'publishing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'published':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };
  
  return (
    <div className={cn("w-full", className)}>
      <div className="space-y-2">
        {Object.entries(data.platforms).map(([platform, status]) => (
          <div key={platform} className="flex items-center justify-between bg-muted/30 rounded p-1 px-2">
            <div className="flex items-center gap-1.5">
              <span>{platformIcons[platform]}</span>
              <span className="text-sm font-medium capitalize">{platform}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary"
                className={cn(
                  "flex items-center gap-1 text-xs py-0 h-5",
                  statusColors[status.status]
                )}
              >
                {getStatusIcon(status.status)}
                <span className="truncate">{status.status}</span>
              </Badge>
              {status.postUrl && status.status === 'published' && (
                <a 
                  href={status.postUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  Открыть
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}