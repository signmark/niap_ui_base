import React from 'react';
import { SafeSocialPlatform } from '@/lib/social-platforms';
import { SiInstagram, SiTelegram, SiVk, SiFacebook, SiYoutube } from 'react-icons/si';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PlatformSelectorProps {
  selectedPlatforms: Record<string, boolean>;
  onChange: (platform: SafeSocialPlatform, isSelected: boolean) => void;
  content?: {
    contentType?: string;
    imageUrl?: string;
    images?: string[];
  };
}

export default function PlatformSelector({
  selectedPlatforms,
  onChange,
  content
}: PlatformSelectorProps) {
  const platforms = [
    {
      id: 'instagram' as SafeSocialPlatform,
      name: 'Instagram',
      icon: SiInstagram,
      color: 'text-pink-600'
    },
    {
      id: 'telegram' as SafeSocialPlatform,
      name: 'Telegram',
      icon: SiTelegram,
      color: 'text-blue-500'
    },
    {
      id: 'vk' as SafeSocialPlatform,
      name: 'ВКонтакте',
      icon: SiVk,
      color: 'text-blue-600'
    },
    {
      id: 'facebook' as SafeSocialPlatform,
      name: 'Facebook',
      icon: SiFacebook,
      color: 'text-indigo-600'
    },
    {
      id: 'youtube' as SafeSocialPlatform,
      name: 'YouTube',
      icon: SiYoutube,
      color: 'text-red-600'
    }
  ];

  // Check if content has images or video
  const hasImages = content && (
    content.imageUrl || 
    (content.images && content.images.length > 0) ||
    content.contentType === 'text-image' ||
    content.contentType === 'video' ||
    (content as any).additionalImages?.length > 0
  );

  // Check if content has video (expanded check)
  const hasVideo = content && (
    content.contentType === 'video' ||
    content.contentType === 'video-text' ||
    content.contentType === 'mixed' ||
    (content as any).videoUrl ||
    (content as any).video_url ||
    (content as any).videoThumbnail ||
    (content as any).additionalVideos
  );

  // Debug logging for YouTube availability
  if (content) {
    console.log('PlatformSelector Debug:', {
      contentType: content.contentType,
      hasImages,
      hasVideo,
      videoUrl: (content as any).videoUrl || (content as any).video_url,
      imageUrl: content.imageUrl,
      additionalImages: (content as any).additionalImages,
      images: content.images
    });
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-4">
        {platforms.map((platform) => {
          const isSelected = selectedPlatforms[platform.id] || false;
          
          // Platform-specific requirements
          let isDisabled = false;
          let tooltipMessage = '';
          
          if (platform.id === 'instagram' && !hasImages) {
            isDisabled = true;
            tooltipMessage = 'Instagram требует изображения или видео';
          } else if (platform.id === 'youtube' && !hasVideo && !hasImages) {
            // Временно разрешаем YouTube для всех типов контента
            isDisabled = false;
            tooltipMessage = '';
          }
          
          const platformComponent = (
            <div 
              key={platform.id}
              className={`flex items-center gap-2 p-3 border rounded-md ${
                isDisabled 
                  ? 'border-muted bg-muted/30 opacity-50' 
                  : isSelected 
                    ? 'border-primary bg-primary/5' 
                    : 'border-input'
              }`}
            >
              <Checkbox
                id={`platform-${platform.id}`}
                checked={isSelected && !isDisabled}
                disabled={isDisabled}
                onCheckedChange={(checked) => {
                  if (!isDisabled) {
                    onChange(platform.id, checked === true);
                  }
                }}
              />
              <Label 
                htmlFor={`platform-${platform.id}`}
                className={`flex items-center gap-2 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <platform.icon className={`h-5 w-5 ${platform.color}`} />
                <span>{platform.name}</span>
              </Label>
            </div>
          );

          // Wrap disabled platforms with tooltip
          if (isDisabled) {
            return (
              <Tooltip key={platform.id}>
                <TooltipTrigger asChild>
                  {platformComponent}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltipMessage}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return platformComponent;
        })}
      </div>
    </TooltipProvider>
  );
}